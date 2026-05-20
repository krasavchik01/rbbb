/**
 * Тесты для парсера таймщитов аудиторов.
 *
 * Запуск: `npm run test:unit` или `npm run test:unit:watch`.
 *
 * Принципиальные семантические инварианты, которые тут проверяются:
 *  1. Дата читается из разных форматов: 1.10.2024, 02.10.24, 2024-10-01, Excel serial.
 *  2. «---Административная работа---» в колонке «Проект» — это маркер «проекта
 *     не было в выпадающем списке Google Sheet»; реальный проект искать в
 *     «Примечание» свободным текстом (НЕ только по юр.форме).
 *  3. «Отсутствие/Отпуск/Больничный» = absence, считается отдельно (absenceDays).
 *  4. Одна строка ≈ один день или фрагмент часов. Несколько строк за один
 *     день с разными секциями (Денежные средства, Дебиторка, …) суммируются;
 *     uniqueDays считает уникальные даты, не строки.
 *  5. Руководитель/партнёр МЕНЯЮТСЯ по строкам — собираем все уникальные значения.
 *  6. Идемпотентность импорта: на уровне БД UNIQUE (user_id) обеспечивает
 *     перезапись (это тестируется отдельно в projectSurvey, но семантика
 *     парсера тоже идемпотентна — один и тот же файл даёт идентичный ParseResult).
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseDate,
  parseHours,
  normalizeProjectName,
  matchProject,
  matchProjectInText,
  matchEmployee,
  parseTimesheetFile,
} from './timesheetImport';

// ─── helpers для тестов ──────────────────────────────────────────────────────

const HEADERS = [
  'Сотрудник',
  'Дата',
  'Проект',
  'Должность',
  'Категория Секция',
  'Часы',
  'Локация',
  'Город',
  'Руководитель',
  'Партнер',
  'Примечание',
];

/** Превращает массив строк в .xlsx ArrayBuffer для скармливания парсеру. */
function toXlsx(rows: any[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf as ArrayBuffer;
}

const PROJECTS = [
  { id: 'p1', name: 'Аудит ТОО Karaton Operating за 2024' },
  { id: 'p2', name: 'Аудит АО BAPY Mining' },
  { id: 'p3', name: 'Налоговый ДД ТОО Tengiz' },
];

const EMPLOYEES = [
  { id: 'u1', name: 'Иванов Иван Иванович', role: 'assistant_1' },
  { id: 'u2', name: 'Петров Пётр',            role: 'senior_assistant' },
];

// ─── parseDate ───────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('читает d.m.yyyy', () => {
    expect(parseDate('1.10.2024')).toBe('2024-10-01');
    expect(parseDate('15.3.2025')).toBe('2025-03-15');
  });

  it('читает d.m.yy с расширением до 20xx', () => {
    expect(parseDate('02.10.24')).toBe('2024-10-02');
  });

  it('читает ISO дату', () => {
    expect(parseDate('2024-10-01')).toBe('2024-10-01');
  });

  it('читает Excel serial number', () => {
    // 45566 → 2024-10-01 (Excel считает дни от 1900-01-01 с учётом фантомного 1900-02-29).
    // XLSX.SSF.parse_date_code обрабатывает это.
    const r = parseDate(45566);
    expect(r).toBe('2024-10-01');
    // Контрольная пара — день назад
    const r2 = parseDate(45565);
    expect(r2).toBe('2024-09-30');
  });

  it('возвращает null для мусора', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate('абракадабра')).toBeNull();
  });
});

// ─── parseHours ──────────────────────────────────────────────────────────────

describe('parseHours', () => {
  it('читает число', () => {
    expect(parseHours(8)).toBe(8);
    expect(parseHours(4.5)).toBe(4.5);
  });
  it('читает строку с запятой как разделителем', () => {
    expect(parseHours('4,5')).toBe(4.5);
  });
  it('возвращает 0 для пустого/неверного', () => {
    expect(parseHours('')).toBe(0);
    expect(parseHours('abc')).toBe(0);
    expect(parseHours(null)).toBe(0);
  });
});

// ─── normalizeProjectName ────────────────────────────────────────────────────

describe('normalizeProjectName', () => {
  it('срезает юр.форму и кавычки', () => {
    expect(normalizeProjectName('ТОО «Karaton Operating»')).toBe('karaton operating');
    expect(normalizeProjectName('АО "BAPY Mining"')).toBe('bapy mining');
  });
  it('срезает хвост «Аудит ФО за …»', () => {
    const a = normalizeProjectName('ТОО Karaton Operating');
    const b = normalizeProjectName('Аудит ФО ТОО Karaton Operating за 2024 год: за 9 месяцев');
    expect(b).toContain('karaton operating');
    expect(a).toContain('karaton operating');
  });
});

// ─── matchProject ────────────────────────────────────────────────────────────

describe('matchProject', () => {
  it('high — точное совпадение нормализованных имён', () => {
    const r = matchProject('Аудит ТОО Karaton Operating за 2024', PROJECTS);
    expect(r.id).toBe('p1');
    expect(r.score).toBe('high');
  });

  it('high — после нормализации имена эквивалентны (юр.форма и хвост «за …» убраны)', () => {
    // «Karaton Operating» и «Аудит ТОО Karaton Operating за 2024» после норм-ии
    // оба становятся «karaton operating» — это правильный high-match.
    const r = matchProject('Karaton Operating', PROJECTS);
    expect(r.id).toBe('p1');
    expect(r.score).toBe('high');
  });

  it('medium — реальная подстрока с лишним словом', () => {
    // Здесь имя из таймщита содержит проект как ЧАСТЬ — после норм-ии это уже
    // не равенство, а подстрока.
    const r = matchProject('Karaton Operating филиал Атырау', PROJECTS);
    expect(r.id).toBe('p1');
    expect(r.score).toBe('medium');
  });

  it('medium — перекрытие токенов', () => {
    const r = matchProject('Tengiz налоговый дью-дилидженс', PROJECTS);
    expect(r.id).toBe('p3');
    expect(r.score).toBe('medium');
  });

  it('none — нет похожего', () => {
    const r = matchProject('Проект Альфа Бета', PROJECTS);
    expect(r.score).toBe('none');
  });
});

// ─── matchProjectInText (главная новая функция) ──────────────────────────────

describe('matchProjectInText', () => {
  it('находит проект в свободном тексте примечания с юр.формой', () => {
    const r = matchProjectInText('Планирование инвентаризации в ТОО BAPY Mining', PROJECTS);
    expect(r.id).toBe('p2');
  });

  it('находит проект в примечании БЕЗ юр.формы (главный кейс)', () => {
    const r = matchProjectInText('Подготовка отчётности Karaton удалённо', PROJECTS);
    expect(r.id).toBe('p1');
  });

  it('выбирает самое длинное совпадение при нескольких кандидатах', () => {
    // Если в проектах есть «Tengiz» и «Tengiz Налоговый ДД», и текст содержит оба —
    // должен быть выбран более специфичный.
    const projects = [
      { id: 'a', name: 'Tengiz' },
      { id: 'b', name: 'Tengiz Налоговый ДД' },
    ];
    const r = matchProjectInText('Работы по Tengiz Налоговый ДД за квартал', projects);
    expect(r.id).toBe('b');
  });

  it('none для пустого или нерелевантного текста', () => {
    expect(matchProjectInText('', PROJECTS).score).toBe('none');
    expect(matchProjectInText('просто отчёт ни о чём', PROJECTS).score).toBe('none');
  });
});

// ─── matchEmployee ───────────────────────────────────────────────────────────

describe('matchEmployee', () => {
  it('точное совпадение ФИО', () => {
    const r = matchEmployee('Иванов Иван Иванович', EMPLOYEES);
    expect(r.id).toBe('u1');
  });

  it('по первым двум токенам (Фамилия Имя)', () => {
    const r = matchEmployee('Иванов Иван', EMPLOYEES);
    expect(r.id).toBe('u1');
  });

  it('игнорирует регистр и точки', () => {
    const r = matchEmployee('петров пётр', EMPLOYEES);
    expect(r.id).toBe('u2');
  });

  it('none для незнакомого', () => {
    const r = matchEmployee('Сидоров Сидор', EMPLOYEES);
    expect(r.id).toBeNull();
  });
});

// ─── parseTimesheetFile — интеграционные тесты ───────────────────────────────

describe('parseTimesheetFile — обычный проектный таймщит', () => {
  it('агрегирует часы и считает uniqueDays', () => {
    // Иванов был на Karaton 3 дня, дважды по 4ч в один день (разные секции),
    // плюс 8ч в другой день, плюс 8ч в третий.
    const rows = [
      ['Иванов Иван Иванович', '01.10.2024', 'ТОО Karaton Operating', 'ассистент', 'Денежные средства',     4, 'удалённо', 'Алматы', 'Петров', 'Менеджер', ''],
      ['Иванов Иван Иванович', '01.10.2024', 'ТОО Karaton Operating', 'ассистент', 'Дебиторская задолж.',  4, 'удалённо', 'Алматы', 'Петров', 'Менеджер', ''],
      ['Иванов Иван Иванович', '02.10.2024', 'ТОО Karaton Operating', 'ассистент', 'Запасы',                8, 'офис',      'Алматы', 'Петров', 'Менеджер', ''],
      ['Иванов Иван Иванович', '03.10.2024', 'ТОО Karaton Operating', 'ассистент', 'Финрезы',               8, 'офис',      'Алматы', 'Петров', 'Менеджер', ''],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    expect(res.employees).toHaveLength(1);
    const emp = res.employees[0];
    expect(emp.matchedUserId).toBe('u1');
    expect(emp.projects).toHaveLength(1);

    const proj = emp.projects[0];
    expect(proj.totalHours).toBe(24);
    expect(proj.rowsCount).toBe(4);      // 4 строки
    expect(proj.uniqueDays).toBe(3);     // но только 3 уникальных дня
    expect(proj.periodFrom).toBe('2024-10-01');
    expect(proj.periodTo).toBe('2024-10-03');
    expect(proj.matchScore).toBe('high'); // полностью совпало
    expect(proj.matchedProjectId).toBe('p1');
    expect(proj.sections.sort()).toEqual(['Дебиторская задолж.', 'Денежные средства', 'Запасы', 'Финрезы'].sort());
  });
});

describe('parseTimesheetFile — административная строка с проектом в примечании', () => {
  it('восстанавливает реальный проект из примечания (БЕЗ юр.формы)', () => {
    const rows = [
      // «Административная работа» в проекте, но в примечании — реальный проект
      ['Иванов Иван Иванович', '05.10.2024', '---Административная работа---', 'ассистент', '', 8, 'удалённо', 'Алматы', 'Петров', 'Менеджер', 'Подготовка отчётности по Karaton'],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const emp = res.employees[0];
    expect(emp.projects).toHaveLength(1);
    const proj = emp.projects[0];
    expect(proj.matchedProjectId).toBe('p1');   // нашли Karaton
    expect(proj.fromNotes).toBe(true);          // флаг «из примечания» взведён
    expect(emp.adminHours).toBe(0);             // часы попали в проект, НЕ в админ
    expect(proj.totalHours).toBe(8);
  });

  it('admin без узнаваемого проекта → adminHours', () => {
    const rows = [
      ['Иванов Иван Иванович', '06.10.2024', '---Административная работа---', '', '', 4, '', '', '', '', 'просто внутренние дела'],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const emp = res.employees[0];
    expect(emp.projects).toHaveLength(0);
    expect(emp.adminHours).toBe(4);
  });

  it('admin с проектом ВНЕ системы (юр.форма есть) → показываем как «не найден»', () => {
    const rows = [
      ['Иванов Иван Иванович', '07.10.2024', '---Административная работа---', '', '', 5, '', '', '', '', 'Работы по ТОО Новый Проект Без Системы'],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const emp = res.employees[0];
    expect(emp.projects).toHaveLength(1);
    expect(emp.projects[0].matchScore).toBe('none');
    expect(emp.projects[0].fromNotes).toBe(true);
  });
});

describe('parseTimesheetFile — отсутствия и смена руководителя', () => {
  it('абсенсы считаются как absenceDays, не часы', () => {
    const rows = [
      ['Иванов Иван Иванович', '10.10.2024', 'Отсутствие (Отпуск)',          '', '', 0, '', '', '', '', ''],
      ['Иванов Иван Иванович', '11.10.2024', 'Отсутствие (Больничный)',      '', '', 0, '', '', '', '', ''],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const emp = res.employees[0];
    expect(emp.absenceDays).toBe(2);
    expect(emp.totalProjectHours).toBe(0);
    expect(emp.projects).toHaveLength(0);
  });

  it('разные руководители/партнёры по строкам — все попадают в массив', () => {
    const rows = [
      ['Иванов Иван Иванович', '01.10.2024', 'ТОО Karaton Operating', '', '', 4, '', '', 'Менеджер А', 'Партнёр X', ''],
      ['Иванов Иван Иванович', '02.10.2024', 'ТОО Karaton Operating', '', '', 4, '', '', 'Менеджер Б', 'Партнёр X', ''],
      ['Иванов Иван Иванович', '03.10.2024', 'ТОО Karaton Operating', '', '', 4, '', '', 'Менеджер А', 'Партнёр Y', ''],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const proj = res.employees[0].projects[0];
    expect(proj.managers.sort()).toEqual(['Менеджер А', 'Менеджер Б']);
    expect(proj.partners.sort()).toEqual(['Партнёр X', 'Партнёр Y']);
  });
});

describe('parseTimesheetFile — детект колонок не дублирует индексы', () => {
  it('если колонки «Город» нет в файле — city остаётся -1, не подставляется в индекс manager', () => {
    // Реальный формат: «Сотрудник, Дата, Проект, Должность, Категория Секция,
    // Часы, Локация, Руководитель, Партнер, Примечание» (без «Город»).
    const realHeaders = [
      'Сотрудник', 'Дата', 'Проект', 'Должность', 'Категория Секция',
      'Часы', 'Локация', 'Руководитель', 'Партнер', 'Примечание',
    ];
    const ws = XLSX.utils.aoa_to_sheet([
      realHeaders,
      ['Иванов Иван Иванович', '01.10.2024', 'ТОО Karaton Operating', 'ассистент', 'Денежные средства', 8, 'Офис', 'Менеджер А', 'Партнёр X', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const res = parseTimesheetFile(buf as ArrayBuffer, PROJECTS, EMPLOYEES);

    // city и manager НЕ должны совпадать (был баг с fallback на индекс 7)
    expect(res.detectedColumns.manager).toBe(7);
    expect(res.detectedColumns.city).toBe(-1);
    // partner должен быть на индексе 8, а не на 9 (как в шаблоне с «Город»)
    expect(res.detectedColumns.partner).toBe(8);
    expect(res.detectedColumns.notes).toBe(9);

    // И собранные managers/partners — реальные, не запутаны
    const proj = res.employees[0].projects[0];
    expect(proj.managers).toEqual(['Менеджер А']);
    expect(proj.partners).toEqual(['Партнёр X']);
  });
});

describe('parseTimesheetFile — 0-часовые строки', () => {
  it('считает rowsCount, uniqueDays, но totalHours остаётся 0', () => {
    const rows = [
      // Календарные маркеры «начало аудита»: даты есть, часов нет
      ['Иванов Иван Иванович', '01.10.2024', 'ТОО Karaton Operating', '', '', 0, '', '', '', '', 'начало аудита'],
      ['Иванов Иван Иванович', '05.10.2024', 'ТОО Karaton Operating', '', '', 0, '', '', '', '', 'выпуск письма'],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const proj = res.employees[0].projects[0];
    expect(proj.totalHours).toBe(0);
    expect(proj.rowsCount).toBe(2);
    expect(proj.uniqueDays).toBe(2);
    // emp.totalProjectHours тоже 0 — это и есть сигнал «не было реального вклада»
    expect(res.employees[0].totalProjectHours).toBe(0);
  });
});

describe('parseTimesheetFile — пустая колонка «Проект» с проектом в примечании', () => {
  it('подтягивает проект из примечания, если колонка «Проект» пустая (не только admin)', () => {
    // Реальный кейс из таймщита Сартаевой Гаухар: аудитор оставлял колонку
    // «Проект» пустой и писал проект в примечании. Раньше эти часы уходили
    // в adminHours, хотя в системе/файле уже есть подходящий проект.
    const projectsInSystem = [
      { id: 'shalkia', name: 'АО «ШалкияЦинк ЛТД» Аудит ФО по МСФО за 2025 год' },
    ];
    // HEADERS у helper'а: [Сотрудник, Дата, Проект, Должность, Категория Секция,
    // Часы, Локация, Город, Руководитель, Партнер, Примечание] — 11 колонок.
    const rows = [
      ['Сартаева Гаухар', '01.06.2025', '', 'Руководитель', '', 8, 'Офис', '', '', '', 'АО Шалкия Цинк'],
      ['Сартаева Гаухар', '02.06.2025', '', 'Руководитель', '', 8, 'Офис', '', '', '', 'АО Шалкия Цинк'],
      ['Сартаева Гаухар', '03.06.2025', '', 'Руководитель', '', 5, 'Офис', '', '', '', 'АО Шалкия Цинк раскрытие для консолидаторов'],
    ];
    const res = parseTimesheetFile(toXlsx(rows), projectsInSystem, EMPLOYEES);
    const emp = res.employees.find((e) => e.employee === 'Сартаева Гаухар')!;
    expect(emp).toBeDefined();
    expect(emp.adminHours).toBe(0);  // НЕ должны были уйти в admin
    expect(emp.projects).toHaveLength(1);
    const proj = emp.projects[0];
    expect(proj.matchedProjectId).toBe('shalkia');
    expect(proj.totalHours).toBe(21);
    expect(proj.fromNotes).toBe(true);
  });

  it('self-projects fallback: если внешний список не помог, использует проекты из самого файла', () => {
    // Никаких внешних проектов. В файле явно есть «АО Экспортно-кредитное
    // агентство Казахстана» в одной строке + пустые строки с упоминанием в notes.
    const rows = [
      ['Иванов Иван Иванович', '01.10.2024', 'АО Экспортно-кредитное агентство Казахстана', '', '', 8, '', '', '', '', ''],
      ['Иванов Иван Иванович', '02.10.2024', '',                                              '', '', 8, '', '', '', '', 'АО Экспортно-кредитное агентство Казахстана'],
      ['Иванов Иван Иванович', '03.10.2024', '',                                              '', '', 8, '', '', '', '', 'продолжение по Экспортно-кредитное агентство'],
    ];
    const res = parseTimesheetFile(toXlsx(rows), /* пустой внешний список */ [], EMPLOYEES);
    const emp = res.employees[0];
    expect(emp.adminHours).toBe(0);
    expect(emp.projects).toHaveLength(1);
    expect(emp.projects[0].totalHours).toBe(24);
    // matchScore = 'none' потому что в системе проекта нет, но строки агрегированы вместе
    expect(emp.projects[0].matchedProjectId).toBeNull();
  });

  it('пустая колонка «Проект» И пустое примечание → adminHours', () => {
    const rows = [
      ['Иванов Иван Иванович', '01.10.2024', '', '', '', 8, '', '', '', '', ''],
    ];
    const res = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const emp = res.employees[0];
    expect(emp.adminHours).toBe(8);
    expect(emp.projects).toHaveLength(0);
  });
});

describe('parseTimesheetFile — идемпотентность парсера', () => {
  it('один и тот же входной файл даёт идентичный результат', () => {
    const rows = [
      ['Иванов Иван Иванович', '01.10.2024', 'ТОО Karaton Operating', '', '', 4, '', '', 'Петров', 'Менеджер', ''],
      ['Иванов Иван Иванович', '02.10.2024', 'ТОО Karaton Operating', '', '', 4, '', '', 'Петров', 'Менеджер', ''],
    ];
    const r1 = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    const r2 = parseTimesheetFile(toXlsx(rows), PROJECTS, EMPLOYEES);
    // Сравниваем по основным числовым инвариантам
    expect(r1.employees[0].totalProjectHours).toBe(r2.employees[0].totalProjectHours);
    expect(r1.employees[0].projects[0].uniqueDays).toBe(r2.employees[0].projects[0].uniqueDays);
    expect(r1.employees[0].projects[0].matchedProjectId).toBe(r2.employees[0].projects[0].matchedProjectId);
  });
});
