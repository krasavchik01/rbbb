import type * as XLSXNs from 'xlsx';

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export interface MonthCalendarDay {
  day: number;
  date: string;
  weekday: string;
  isWeekend: boolean;
}

export interface MonthCalendar {
  year: number;
  month: number;
  label: string;
  periodLabel: string;
  calendarDays: number;
  workingDays: number;
  weekendDays: number;
  normHours: number;
  days: MonthCalendarDay[];
}

export function buildMonthCalendar(year: number, month: number): MonthCalendar {
  const calendarDays = new Date(year, month + 1, 0).getDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  const days = Array.from({ length: calendarDays }, (_, index) => {
    const day = index + 1;
    const weekdayIndex = new Date(year, month, day).getDay();
    return {
      day,
      date: `${year}-${pad(month + 1)}-${pad(day)}`,
      weekday: WEEKDAYS_RU[weekdayIndex],
      isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
    };
  });
  const weekendDays = days.filter((day) => day.isWeekend).length;
  const workingDays = calendarDays - weekendDays;
  const label = `${MONTHS_RU[month]} ${year}`;
  return {
    year,
    month,
    label,
    periodLabel: `за ${label} года`,
    calendarDays,
    workingDays,
    weekendDays,
    normHours: workingDays * 8,
    days,
  };
}

type EmployeeSummary = {
  hours: number;
  days: number;
  vacationDays?: number;
  vacationWorkingDays?: number;
};
type ProjectSummary = { name: string; hours: number; company?: string };

export interface HrTimesheetWorkbookInput {
  month: MonthCalendar;
  employees: Array<{ id: string; name?: string; email?: string }>;
  matrix: Map<string, Map<string, number>>;
  dayCodes?: Map<string, Map<string, string>>;
  employeeSummary: Map<string, EmployeeSummary>;
  projects: ProjectSummary[];
}

export function createHrTimesheetWorkbook(
  XLSX: typeof XLSXNs,
  input: HrTimesheetWorkbookInput,
) {
  const { month, employees, matrix, dayCodes = new Map(), employeeSummary, projects } = input;
  const workbook = XLSX.utils.book_new();
  const finalColumnIndex = month.calendarDays + 4;
  const finalColumn = XLSX.utils.encode_col(finalColumnIndex);
  const rows: any[][] = [
    ['ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ'],
    [month.periodLabel],
    [
      `Календарные дни: ${month.calendarDays}`, '', '', '',
      `Рабочие дни: ${month.workingDays}`, '', '', '',
      `Выходные дни: ${month.weekendDays}`, '', '', '',
      `Норма часов: ${month.normHours}`,
    ],
    [],
    ['Обозначения: Р — рабочий день; В — выходной; ОТ — отпуск; число — отработанные часы; пустая ячейка — часы не внесены'],
    [],
    ['Сотрудник', ...month.days.map((day) => day.day), 'Итого', 'Отпуск, дн.', 'Норма к отработке', 'Отклонение'],
    ['День недели', ...month.days.map((day) => day.weekday), '', '', '', ''],
    ['Тип дня', ...month.days.map((day) => day.isWeekend ? 'В' : 'Р'), '', '', '', ''],
  ];

  for (const employee of employees) {
    const employeeMatrix = matrix.get(String(employee.id)) || new Map<string, number>();
    const employeeDayCodes = dayCodes.get(String(employee.id)) || new Map<string, string>();
    const summary = employeeSummary.get(String(employee.id)) || { hours: 0, days: 0 };
    const adjustedNorm = Math.max(0, month.normHours - (summary.vacationWorkingDays || 0) * 8);
    rows.push([
      employee.name || employee.email || 'Без имени',
      ...month.days.map((day) => {
        const code = employeeDayCodes.get(day.date);
        if (code) return code;
        const value = Number(employeeMatrix.get(day.date) || 0);
        return value > 0 ? Number(value.toFixed(1)) : '';
      }),
      Number(summary.hours.toFixed(1)),
      summary.vacationDays || 0,
      adjustedNorm,
      Number((summary.hours - adjustedNorm).toFixed(1)),
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: finalColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: finalColumnIndex } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 7 } },
    { s: { r: 2, c: 8 }, e: { r: 2, c: 11 } },
    { s: { r: 2, c: 12 }, e: { r: 2, c: 15 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: finalColumnIndex } },
  ];
  sheet['!cols'] = [
    { wch: 30 },
    ...month.days.map(() => ({ wch: 5 })),
    { wch: 10 },
    { wch: 13 },
    { wch: 20 },
    { wch: 12 },
  ];
  sheet['!rows'] = [{ hpt: 28 }, { hpt: 22 }, { hpt: 20 }, {}, { hpt: 20 }, {}, { hpt: 24 }, { hpt: 20 }, { hpt: 28 }];
  sheet['!autofilter'] = { ref: `A7:${finalColumn}${Math.max(9, rows.length)}` };
  (sheet as any)['!freeze'] = { xSplit: 1, ySplit: 9, topLeftCell: 'B10', activePane: 'bottomRight', state: 'frozen' };
  (sheet as any)['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  (sheet as any)['!margins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  (sheet as any)['!printArea'] = `A1:${finalColumn}${rows.length}`;

  const firstEmployeeRow = 10;
  for (let index = 0; index < employees.length; index += 1) {
    const rowNumber = firstEmployeeRow + index;
    const totalAddress = `${XLSX.utils.encode_col(month.calendarDays + 1)}${rowNumber}`;
    const vacationAddress = `${XLSX.utils.encode_col(month.calendarDays + 2)}${rowNumber}`;
    const normAddress = `${XLSX.utils.encode_col(month.calendarDays + 3)}${rowNumber}`;
    const deltaAddress = `${XLSX.utils.encode_col(month.calendarDays + 4)}${rowNumber}`;
    const firstDay = `B${rowNumber}`;
    const lastDay = `${XLSX.utils.encode_col(month.calendarDays)}${rowNumber}`;
    sheet[totalAddress] = { ...(sheet[totalAddress] || {}), t: 'n', f: `SUM(${firstDay}:${lastDay})`, v: employeeSummary.get(String(employees[index].id))?.hours || 0 };
    const summary = employeeSummary.get(String(employees[index].id));
    const adjustedNorm = Math.max(0, month.normHours - (summary?.vacationWorkingDays || 0) * 8);
    sheet[vacationAddress] = { ...(sheet[vacationAddress] || {}), t: 'n', v: summary?.vacationDays || 0 };
    sheet[normAddress] = { ...(sheet[normAddress] || {}), t: 'n', v: adjustedNorm };
    sheet[deltaAddress] = { ...(sheet[deltaAddress] || {}), t: 'n', f: `${totalAddress}-${normAddress}`, v: (summary?.hours || 0) - adjustedNorm };
  }

  XLSX.utils.book_append_sheet(workbook, sheet, `Табель ${month.label}`.slice(0, 31));

  const summaryRows: any[][] = [
    ['СВОДКА ПО СОТРУДНИКАМ'],
    [month.periodLabel],
    [],
    ['Сотрудник', 'Часов', 'Дней с часами', 'Отпуск, календ. дн.', 'Отпуск, раб. дн.', 'Средний день', 'Норма к отработке', 'Отклонение'],
  ];
  for (const employee of employees) {
    const summary = employeeSummary.get(String(employee.id)) || { hours: 0, days: 0 };
    const adjustedNorm = Math.max(0, month.normHours - (summary.vacationWorkingDays || 0) * 8);
    summaryRows.push([
      employee.name || employee.email || 'Без имени',
      Number(summary.hours.toFixed(1)),
      summary.days,
      summary.vacationDays || 0,
      summary.vacationWorkingDays || 0,
      summary.days > 0 ? Number((summary.hours / summary.days).toFixed(1)) : 0,
      adjustedNorm,
      Number((summary.hours - adjustedNorm).toFixed(1)),
    ]);
  }
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 19 }, { wch: 17 }, { wch: 14 }, { wch: 20 }, { wch: 14 }];
  summarySheet['!autofilter'] = { ref: `A4:H${Math.max(4, summaryRows.length)}` };
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  const projectRows: any[][] = [
    ['ЧАСЫ ПО ПРОЕКТАМ'],
    [month.periodLabel],
    [],
    ['Проект', 'Часов', 'Компания'],
    ...projects.map((project) => [project.name, Number(project.hours.toFixed(1)), project.company || '—']),
  ];
  const projectSheet = XLSX.utils.aoa_to_sheet(projectRows);
  projectSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  projectSheet['!cols'] = [{ wch: 52 }, { wch: 12 }, { wch: 24 }];
  projectSheet['!autofilter'] = { ref: `A4:C${Math.max(4, projectRows.length)}` };
  XLSX.utils.book_append_sheet(workbook, projectSheet, 'Проекты');

  return workbook;
}
