/**
 * Импорт таймщитов из Excel/CSV (выгрузка из Google Sheets).
 *
 * Ожидаемые колонки (поиск по подстроке в заголовке, регистр не важен):
 *   Сотрудник | Дата | Проект | Должность | Категория Секция | Часы
 *   | Локация | Город | Руководитель | Партнер | Примечание
 *
 * Особенности:
 * - Дата может быть строкой ("1.10.2024", "02.10.24", "2024-10-01")
 *   или Excel serial number.
 * - Строки `---------Административная работа----------` — это не проект.
 *   Если в «Примечание» написано про конкретный проект (например,
 *   «Планирование инвентаризации в ТОО BAPY Mining») — берём проект оттуда.
 * - Строки «Отсутствие (Отпуск, больничный)» — не проектные, считаются отдельно.
 * - Руководитель и партнёр меняются от проекта к проекту — агрегируем per-project.
 * - Один сотрудник может иметь несколько строк по одному проекту с разными
 *   секциями (Денежные средства, Дебиторская задолженность, ...) — суммируем
 *   часы и берём min/max даты как период.
 */

import * as XLSX from 'xlsx';

export interface ParsedRow {
  rowIndex: number;
  employee: string;
  rawDate: string;
  isoDate: string | null;
  rawProject: string;
  effectiveProject: string;       // либо проект, либо извлечённый из примечания для admin-строк
  position: string;
  section: string;
  hours: number;
  location: string;
  city: string;
  manager: string;
  partner: string;
  notes: string;
  kind: 'project' | 'admin' | 'absence';
  /** Имя для проекта пришло из «Примечание», а не из колонки «Проект» */
  fromNotes: boolean;
  /** Если admin-строку удалось сопоставить с реальным проектом ещё на этапе парсинга — пара (id, имя) */
  preMatchFromNotes: { id: string; name: string } | null;
}

export interface ProjectAggregate {
  /** Как написано в таймщите (используем для отображения и матчинга) */
  projectName: string;
  totalHours: number;
  rowsCount: number;
  uniqueDays: number;               // сколько уникальных дат у этого сотрудника по этому проекту
  periodFrom: string | null;
  periodTo: string | null;
  sections: string[];
  managers: string[];
  partners: string[];
  locations: string[];
  cities: string[];
  position: string;                 // должность сотрудника на этом проекте (чаще всего одна)
  matchedProjectId: string | null;
  matchedProjectName: string | null;
  matchScore: 'high' | 'medium' | 'none';
  fromNotes: boolean;               // строка была «---Административная работа---», проект восстановлен из примечания
}

export interface EmployeeAggregate {
  employee: string;
  matchedUserId: string | null;
  matchedUserName: string | null;
  matchedUserRole: string | null;
  projects: ProjectAggregate[];
  totalProjectHours: number;
  adminHours: number;
  absenceDays: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  employees: EmployeeAggregate[];
  warnings: string[];
  detectedColumns: Record<string, number>;  // name → column index (для диагностики)
}

// ─── helpers ────────────────────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  employee:  ['сотрудник', 'employee', 'фио', 'имя сотрудника'],
  date:      ['дата', 'date'],
  project:   ['проект', 'project', 'клиент'],
  position:  ['должность', 'position', 'роль'],
  section:   ['категория секция', 'категория-секция', 'категория', 'секция', 'category', 'section'],
  hours:     ['часы', 'hours', 'часов', 'час'],
  location:  ['локация', 'location', 'место'],
  city:      ['город', 'локация 2', 'локация2', 'тип локации'],
  manager:   ['руководитель', 'manager', 'lead'],
  partner:   ['партнер', 'партнёр', 'partner'],
  notes:     ['примечание', 'notes', 'комментарий', 'note'],
};

function findColumn(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const a of aliases) {
      if (h.includes(a)) return i;
    }
  }
  return -1;
}

/**
 * Конверсия Excel serial date в ISO-строку (YYYY-MM-DD) без зависимости от
 * XLSX.SSF (он не всегда доступен в Node ESM-сборке xlsx).
 *
 * Excel считает 1900-01-01 за день 1, но включает фантомный 1900-02-29 —
 * это легаси-баг от Lotus 1-2-3. Поэтому константа 25569 это «дни между
 * 1900-01-01 и 1970-01-01 минус 2».
 */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseDate(raw: any): string | null {
  if (raw == null || raw === '') return null;
  // Excel serial number (45597 ≈ 2024-10-01, 45200 ≈ 2023-09-01, …)
  if (typeof raw === 'number' && raw > 30000 && raw < 90000) {
    return excelSerialToIso(raw);
  }
  const s = String(raw).trim();
  // 1.10.2024 / 02.10.24 / 23.10.2024 / 2024-10-01
  let m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (m) {
    let d = m[1];
    let mo = m[2];
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Если число в текстовой форме («45597»)
  if (/^\d{5,6}$/.test(s)) {
    const n = Number(s);
    if (n > 30000 && n < 90000) return excelSerialToIso(n);
  }
  return null;
}

export function parseHours(raw: any): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const n = Number(String(raw).replace(',', '.').trim());
  return isNaN(n) ? 0 : n;
}

/**
 * Стоп-слова, которые не несут смысла при матчинге проектов аудита.
 * Юр.формы, общие слова, временные маркеры. Сравнение токен-в-токен (lowercase).
 *
 * ВАЖНО: используем token-based фильтрацию вместо regex с `\b`, потому что
 * в JavaScript `\b` работает только по ASCII `\w` — `\bтоо\b` НЕ матчит русскую «тоо».
 */
const STOP_TOKENS = new Set([
  // юр.формы
  'тоо', 'ао', 'чк', 'ип', 'зао', 'поо', 'ltd', 'ltd.',
  // общие слова в названиях проектов
  'аудит', 'фо', 'финансовой', 'отчётности', 'отчетности',
  // временные маркеры
  'за', 'год', 'года', 'годов', 'годы',
  'месяц', 'месяца', 'месяцев', 'месяцы',
  'период',
  // соединительные
  'по', 'в', 'на', 'для', 'и',
]);

/** Цифра-год (2020-2099) — отдельным проходом, чтобы не зависеть от токенайзера. */
const YEAR_RE = /\b20\d{2}\b/g;

/**
 * Нормализация названия проекта: убираем кавычки, скобки, юр.формы и шумовые
 * слова. Используется только для матчинга — исходное имя в UI остаётся как было.
 *
 * Алгоритм:
 *  1. lowercase, заменить тире/двоеточия на пробел, убрать кавычки и скобки с
 *     содержимым.
 *  2. Убрать года (20\d\d).
 *  3. Разбить на токены по пробелам, выкинуть стоп-слова и короткие токены
 *     длиной 1–2 (типа «о», «и», «:»).
 *  4. Собрать обратно через пробел.
 */
export function normalizeProjectName(s: string): string {
  if (!s) return '';
  const cleaned = s
    .toLowerCase()
    .replace(/[«»"'„""]/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[-—–:;,.]/g, ' ')
    .replace(YEAR_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t))
    .join(' ');
}

const ADMIN_PROJECT_RE = /^-{3,}.*административн|административная\s+работа|^-{3,}/i;
const ABSENCE_RE = /отсутствие|отпуск|больничн/i;

function detectKind(project: string): 'project' | 'admin' | 'absence' {
  const trimmed = project.trim();
  if (!trimmed) return 'project';
  if (ABSENCE_RE.test(trimmed)) return 'absence';
  if (ADMIN_PROJECT_RE.test(trimmed)) return 'admin';
  return 'project';
}

/**
 * Резервный извлекатель «по юр.форме» — на случай, если в системе нет
 * подходящего проекта, но в примечании виден кандидат с юр.формой.
 * Используется только если matchProjectInText ничего не нашёл.
 */
function extractProjectFromNotes(notes: string): string {
  if (!notes) return '';
  const re = /((?:ТОО|АО|ЧК|ИП|ПОО|ЗАО)\s+[«"]?[А-ЯA-Z][^«"\n,;]{2,60}[»"]?)/;
  const m = notes.match(re);
  return m ? m[1].trim() : '';
}

/**
 * Ищет упоминание реального проекта в свободном тексте (например в «Примечание»).
 * Отличие от matchProject: там вход — это название проекта, тут — длинный текст,
 * внутри которого надо найти название из списка системных проектов.
 *
 * Стратегия:
 *  1. Нормализованное название проекта целиком встречается в нормализованном тексте.
 *     При нескольких кандидатах выбираем самое длинное (наиболее специфичное).
 *  2. Иначе — перекрытие длинных токенов имени проекта в тексте ≥ 60%.
 */
export function matchProjectInText(
  text: string,
  projects: Array<{ id: string; name: string }>,
): { id: string | null; name: string | null; score: 'high' | 'medium' | 'none' } {
  const normText = normalizeProjectName(text);
  if (!normText) return { id: null, name: null, score: 'none' };

  let bestSub: { id: string; name: string; len: number } | null = null;
  for (const p of projects) {
    const pn = normalizeProjectName(p.name);
    if (!pn || pn.length < 3) continue;
    if (normText.includes(pn)) {
      if (!bestSub || pn.length > bestSub.len) {
        bestSub = { id: p.id, name: p.name, len: pn.length };
      }
    }
  }
  if (bestSub) return { id: bestSub.id, name: bestSub.name, score: 'medium' };

  let bestRatio = 0;
  let bestId: string | null = null;
  let bestName: string | null = null;
  for (const p of projects) {
    const pn = normalizeProjectName(p.name);
    const tokens = pn.split(' ').filter((t) => t.length >= 4);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => normText.includes(t)).length;
    const ratio = hits / tokens.length;
    // Порог 0.5 (мягче чем у matchProject, у которого 0.6) — потому что
    // в свободном тексте примечания много «шума» вокруг названия проекта,
    // и достаточно, чтобы половина значимых токенов совпала.
    if (ratio >= 0.5 && ratio > bestRatio) {
      bestRatio = ratio;
      bestId = p.id;
      bestName = p.name;
    }
  }
  if (bestId) return { id: bestId, name: bestName, score: 'medium' };
  return { id: null, name: null, score: 'none' };
}

// ─── project matching ──────────────────────────────────────────────────────

export function matchProject(
  rawName: string,
  projects: Array<{ id: string; name: string }>,
): { id: string | null; name: string | null; score: 'high' | 'medium' | 'none' } {
  const norm = normalizeProjectName(rawName);
  if (!norm) return { id: null, name: null, score: 'none' };

  // 1) точное совпадение нормализованных имён
  for (const p of projects) {
    if (normalizeProjectName(p.name) === norm) {
      return { id: p.id, name: p.name, score: 'high' };
    }
  }

  // 2) подстрока в одну или другую сторону
  for (const p of projects) {
    const pn = normalizeProjectName(p.name);
    if (!pn) continue;
    if (pn.includes(norm) || norm.includes(pn)) {
      return { id: p.id, name: p.name, score: 'medium' };
    }
  }

  // 3) перекрытие токенов ≥ 60% длинных слов
  const tokens = norm.split(' ').filter((t) => t.length >= 4);
  if (tokens.length === 0) return { id: null, name: null, score: 'none' };
  let bestId: string | null = null;
  let bestName: string | null = null;
  let bestRatio = 0;
  for (const p of projects) {
    const pn = normalizeProjectName(p.name);
    const matched = tokens.filter((t) => pn.includes(t)).length;
    const ratio = matched / tokens.length;
    if (ratio >= 0.6 && ratio > bestRatio) {
      bestRatio = ratio;
      bestId = p.id;
      bestName = p.name;
    }
  }
  if (bestId) return { id: bestId, name: bestName, score: 'medium' };
  return { id: null, name: null, score: 'none' };
}

// ─── employee matching ────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function matchEmployee(
  rawName: string,
  employees: Array<{ id: string; name: string; role?: string | null }>,
): { id: string | null; name: string | null; role: string | null } {
  const norm = normalizeName(rawName);
  if (!norm) return { id: null, name: null, role: null };
  for (const e of employees) {
    if (normalizeName(e.name) === norm) return { id: e.id, name: e.name, role: e.role || null };
  }
  // По первым двум токенам (Фамилия Имя)
  const tokens = norm.split(' ').filter(Boolean);
  if (tokens.length >= 2) {
    const key = tokens.slice(0, 2).join(' ');
    for (const e of employees) {
      const en = normalizeName(e.name);
      if (en.startsWith(key) || en.includes(key)) {
        return { id: e.id, name: e.name, role: e.role || null };
      }
    }
  }
  return { id: null, name: null, role: null };
}

// ─── main parse ────────────────────────────────────────────────────────────

export function parseTimesheetFile(
  buffer: ArrayBuffer,
  projects: Array<{ id: string; name: string }>,
  employees: Array<{ id: string; name: string; role?: string | null }>,
  options?: { sheetName?: string },
): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = options?.sheetName || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const warnings: string[] = [];

  if (!ws) {
    return { rows: [], employees: [], warnings: [`Не нашёл лист «${sheetName}»`], detectedColumns: {} };
  }

  const arr: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (arr.length < 2) {
    return { rows: [], employees: [], warnings: ['В файле нет данных'], detectedColumns: {} };
  }

  const headers = arr[0].map((h: any) => String(h ?? '').toLowerCase().trim());
  const cols: Record<string, number> = {};
  for (const key of Object.keys(COLUMN_ALIASES)) {
    cols[key] = findColumn(headers, COLUMN_ALIASES[key]);
  }

  const required: Array<keyof typeof COLUMN_ALIASES> = ['employee', 'date', 'project', 'hours'];
  const missingRequired = required.filter((k) => cols[k] === -1);

  // Fallback на позиционные индексы шаблона: ТОЛЬКО если заголовок «не похож на
  // таймщит» (не нашёл ни одной из обязательных колонок). Если хотя бы одна
  // основная колонка найдена по алиасу — значит заголовок осмысленный, и
  // подставлять «-1» в индексы 7/8/9 опасно: можно случайно прочитать данные
  // не той колонки.
  //
  // Ранее был баг: в реальном файле без колонки «Город» fallback всё равно
  // выставлял cols.city = 7, что совпадало с индексом «Руководитель». В итоге
  // city и manager читали один столбец.
  const useFallback = missingRequired.length === required.length;
  if (useFallback) {
    warnings.push(
      'Заголовок не распознан — использую позиционный шаблон (первые 11 колонок). Проверьте результаты вручную.',
    );
    if (cols.employee === -1) cols.employee = 0;
    if (cols.date === -1) cols.date = 1;
    if (cols.project === -1) cols.project = 2;
    if (cols.position === -1) cols.position = 3;
    if (cols.section === -1) cols.section = 4;
    if (cols.hours === -1) cols.hours = 5;
    if (cols.location === -1) cols.location = 6;
    if (cols.city === -1) cols.city = 7;
    if (cols.manager === -1) cols.manager = 8;
    if (cols.partner === -1) cols.partner = 9;
    if (cols.notes === -1) cols.notes = 10;
  } else if (missingRequired.length > 0) {
    warnings.push(
      `Не нашёл обязательные колонки: ${missingRequired.join(', ')}. Эти данные будут пропущены.`,
    );
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < arr.length; i++) {
    const r = arr[i];
    const employee = String(r[cols.employee] ?? '').trim();
    const rawProject = String(r[cols.project] ?? '').trim();
    const notes = String(r[cols.notes] ?? '').trim();
    if (!employee && !rawProject && !notes) continue;

    const kind = detectKind(rawProject);
    let effectiveProject = rawProject;
    let fromNotesFlag = false;
    let preMatchedFromNotes: { id: string; name: string } | null = null;
    if (kind === 'admin') {
      // Сначала пытаемся узнать в примечании реальный системный проект.
      // «Административная работа» в файле — это не оверхед, а маркер
      // «проекта не было в выпадающем списке Google Sheet, я написал в примечании».
      const m = matchProjectInText(notes, projects);
      if (m.id && m.name) {
        effectiveProject = m.name;       // нормализованное имя проекта из системы
        preMatchedFromNotes = { id: m.id, name: m.name };
        fromNotesFlag = true;
      } else {
        // Запасной путь: вытащить кандидата по юр.форме, даже если в системе его нет —
        // покажем в UI как «не найден» вместо молчаливого скидывания в adminHours.
        const fromNotes = extractProjectFromNotes(notes);
        if (fromNotes) {
          effectiveProject = fromNotes;
          fromNotesFlag = true;
        } else {
          // Ни matchProjectInText, ни regex-извлекатель ничего не нашли —
          // это настоящий админ-час без проекта. Сбрасываем effectiveProject,
          // чтобы агрегация скинула эти часы в adminHours, а не создавала
          // фантомный проект «---Административная работа---».
          effectiveProject = '';
        }
      }
    }

    rows.push({
      rowIndex: i + 1,
      employee,
      rawDate: String(r[cols.date] ?? '').trim(),
      isoDate: parseDate(r[cols.date]),
      rawProject,
      effectiveProject,
      position: String(r[cols.position] ?? '').trim(),
      section: String(r[cols.section] ?? '').trim(),
      hours: parseHours(r[cols.hours]),
      location: String(r[cols.location] ?? '').trim(),
      city: String(r[cols.city] ?? '').trim(),
      manager: String(r[cols.manager] ?? '').trim(),
      partner: String(r[cols.partner] ?? '').trim(),
      notes,
      kind,
      fromNotes: fromNotesFlag,
      preMatchFromNotes: preMatchedFromNotes,
    });
  }

  // ─── агрегация ───────────────────────────────────────────────────────────
  const byEmp = new Map<string, EmployeeAggregate>();
  // Для подсчёта уникальных дней по каждому (сотрудник, проект)
  const daysIndex = new Map<ProjectAggregate, Set<string>>();

  for (const r of rows) {
    if (!r.employee) continue;

    let emp = byEmp.get(r.employee);
    if (!emp) {
      const m = matchEmployee(r.employee, employees);
      emp = {
        employee: r.employee,
        matchedUserId: m.id,
        matchedUserName: m.name,
        matchedUserRole: m.role,
        projects: [],
        totalProjectHours: 0,
        adminHours: 0,
        absenceDays: 0,
      };
      byEmp.set(r.employee, emp);
    }

    if (r.kind === 'absence') {
      emp.absenceDays += 1;
      continue;
    }

    if (!r.effectiveProject) {
      // административная без узнаваемого проекта в примечании
      emp.adminHours += r.hours;
      continue;
    }

    const key = normalizeProjectName(r.effectiveProject) || r.effectiveProject.toLowerCase();
    let pg = emp.projects.find((p) => (normalizeProjectName(p.projectName) || p.projectName.toLowerCase()) === key);
    if (!pg) {
      // Если admin-строку мы уже сматчили в фазе парсинга — переиспользуем,
      // не гоняем matchProject повторно (на длинном тексте он бы ничего не нашёл).
      const match = r.preMatchFromNotes
        ? { id: r.preMatchFromNotes.id, name: r.preMatchFromNotes.name, score: 'medium' as const }
        : matchProject(r.effectiveProject, projects);
      pg = {
        projectName: r.effectiveProject,
        totalHours: 0,
        rowsCount: 0,
        uniqueDays: 0,
        periodFrom: null,
        periodTo: null,
        sections: [],
        managers: [],
        partners: [],
        locations: [],
        cities: [],
        position: r.position || '',
        matchedProjectId: match.id,
        matchedProjectName: match.name,
        matchScore: match.score,
        fromNotes: r.fromNotes,
      };
      emp.projects.push(pg);
      daysIndex.set(pg, new Set<string>());
    }

    pg.totalHours += r.hours;
    pg.rowsCount += 1;
    emp.totalProjectHours += r.hours;
    if (r.fromNotes) pg.fromNotes = true;

    if (r.isoDate) {
      if (!pg.periodFrom || r.isoDate < pg.periodFrom) pg.periodFrom = r.isoDate;
      if (!pg.periodTo   || r.isoDate > pg.periodTo)   pg.periodTo   = r.isoDate;
      daysIndex.get(pg)!.add(r.isoDate);
    }
    if (r.section && !pg.sections.includes(r.section)) pg.sections.push(r.section);
    // Руководитель и партнёр МЕНЯЮТСЯ от строки к строке — собираем все уникальные
    if (r.manager && !pg.managers.includes(r.manager)) pg.managers.push(r.manager);
    if (r.partner && !pg.partners.includes(r.partner)) pg.partners.push(r.partner);
    if (r.location && !pg.locations.includes(r.location)) pg.locations.push(r.location);
    if (r.city && !pg.cities.includes(r.city)) pg.cities.push(r.city);
  }

  // Финализируем uniqueDays
  for (const [pg, set] of daysIndex.entries()) {
    pg.uniqueDays = set.size;
  }

  // Сортируем проекты у каждого сотрудника по часам убыванию — самые «весомые» сверху
  for (const emp of byEmp.values()) {
    emp.projects.sort((a, b) => b.totalHours - a.totalHours);
  }

  return {
    rows,
    employees: Array.from(byEmp.values()).sort((a, b) => b.totalProjectHours - a.totalProjectHours),
    warnings,
    detectedColumns: cols,
  };
}
