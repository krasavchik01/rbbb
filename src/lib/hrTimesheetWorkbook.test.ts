import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildMonthCalendar, createHrTimesheetWorkbook } from './hrTimesheetWorkbook';

describe('HR timesheet workbook', () => {
  it('builds the July 2026 calendar and norm', () => {
    const month = buildMonthCalendar(2026, 6);
    expect(month.calendarDays).toBe(31);
    expect(month.workingDays).toBe(23);
    expect(month.weekendDays).toBe(8);
    expect(month.normHours).toBe(184);
    expect(month.periodLabel).toBe('за июль 2026 года');
  });

  it('creates a detailed workbook with period, calendar rows and zero-hour employees', () => {
    const month = buildMonthCalendar(2026, 6);
    const workbook = createHrTimesheetWorkbook(XLSX, {
      month,
      employees: [
        { id: 'e1', name: 'Сотрудник с часами' },
        { id: 'e2', name: 'Сотрудник без часов' },
      ],
      matrix: new Map([['e1', new Map([['2026-07-01', 8]])]]),
      dayCodes: new Map([['e2', new Map([
        ['2026-07-01', 'ОТ'],
        ['2026-07-02', 'ОТ'],
      ])]]),
      employeeSummary: new Map([
        ['e1', { hours: 8, days: 1 }],
        ['e2', { hours: 0, days: 0, vacationDays: 2, vacationWorkingDays: 2 }],
      ]),
      projects: [],
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(sheet.A1.v).toBe('ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ');
    expect(sheet.A2.v).toBe('за июль 2026 года');
    expect(sheet.A7.v).toBe('Сотрудник');
    expect(sheet.A10.v).toBe('Сотрудник с часами');
    expect(sheet.A11.v).toBe('Сотрудник без часов');
    expect(sheet.B11.v).toBe('ОТ');
    expect(sheet.AH11.v).toBe(2);
    expect(sheet.AI11.v).toBe(168);
    expect(sheet.AJ11.v).toBe(-168);
    expect(sheet['!printArea']).toBe('A1:AJ11');
    expect(sheet['!merges']).toContainEqual(expect.objectContaining({ s: { r: 0, c: 0 } }));
  });
});
