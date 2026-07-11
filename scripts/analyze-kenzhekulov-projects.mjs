import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const INPUT = path.join(process.cwd(), 'Проекты Кенжекулов.xlsx');
const OUT_DIR = path.join(process.cwd(), 'reports', 'kenzhekulov-projects');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const MONTHS = {
  январ: 1,
  феврал: 2,
  март: 3,
  апрел: 4,
  ма: 5,
  июн: 6,
  июл: 7,
  август: 8,
  сентябр: 9,
  октябр: 10,
  ноябр: 11,
  декабр: 12,
};

const NAME_ALIASES = {
  Райхан: 'Нускабаева Райхан',
  Ернур: 'Жамбыл Ернур',
  Забира: 'Zabira Yerlankyzy',
  'Ерланкызы Забира': 'Zabira Yerlankyzy',
  Жанибек: 'Zhorabekov Zhanibek',
  'Жорабеков Жанибек': 'Zhorabekov Zhanibek',
  Онгар: 'Аманов Онгар',
  Бахытжан: 'Бекжанов Бақытжан',
  'Бекжанов Бакытжан': 'Бекжанов Бақытжан',
  Спандияр: 'Идрисов Спандияр',
  Акмолдир: 'Акмолдир',
  Саида: 'Бекболова Саийда',
  'Кенжекулов А.А.': 'Кенжекулов Адилжан',
  Нурхан: 'Галымжанов Нурхан',
  Аскар: 'Искаков Аскар',
  Куаныш: 'Мухашев Куаныш',
  Ермек: 'Ембердиев Ермек',
  Дана: 'Турлыгазина Дана',
  Сая: 'Шардарбекова Саия',
};

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/[«»"“”'`]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-яәғқңөұүһі0-9]+/giu, ' ')
    .trim();
}

function normalizeProjectName(client, auditType) {
  return normalizeText(`${client} ${auditType}`)
    .replace(/\bтоо\b/g, '')
    .replace(/\bао\b/g, '')
    .replace(/\bл?тд\b/g, '')
    .replace(/\bза\b/g, '')
    .replace(/\bгод\b/g, '')
    .replace(/\bг\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePeople(value) {
  const raw = compact(value);
  if (!raw || raw === '-') return [];
  return raw
    .split(',')
    .map((x) => compact(x))
    .filter((x) => x && x !== '-')
    .map((x) => NAME_ALIASES[x] || x);
}

function parsePeriod(value) {
  const raw = compact(value);
  const years = [...raw.matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
  const months = [];
  for (const [stem, month] of Object.entries(MONTHS)) {
    const re = new RegExp(stem, 'i');
    if (re.test(raw)) months.push(month);
  }
  if (!raw) return { raw, startYear: null, endYear: null, months };
  const startYear = years[0] || null;
  const endYear = years[years.length - 1] || startYear;
  return { raw, startYear, endYear, months };
}

function parseAuditYear(auditType) {
  const match = compact(auditType).match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

async function readAll(supabase, table, select) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function scoreProject(row, project) {
  const target = normalizeProjectName(row.clientName, row.auditType);
  const db = normalizeProjectName(project.name, '');
  const client = normalizeText(row.clientName);
  const auditYear = String(row.auditYear || '');
  let score = 0;
  if (db === target) score += 100;
  if (db.includes(target) || target.includes(db)) score += 70;
  if (client && db.includes(client)) score += 45;
  if (auditYear && db.includes(auditYear)) score += 25;
  if (normalizeText(project.name).includes(normalizeText(row.auditType))) score += 20;
  return score;
}

function makeTeam(row, employeesByName) {
  const people = [
    { name: row.partner, role: 'partner', bonusPercent: 25 },
    ...row.managers.map((name) => ({ name, role: 'manager', bonusPercent: 20 })),
    ...row.team.map((name) => ({ name, role: 'assistant', bonusPercent: 10 })),
    ...row.tax.map((name) => ({ name, role: 'tax', bonusPercent: 10 })),
  ];
  const dedup = new Map();
  for (const person of people) {
    if (!person.name) continue;
    const key = `${person.role}|${normalizeText(person.name)}`;
    if (!dedup.has(key)) {
      const employee = findEmployee(person.name, employeesByName);
      dedup.set(key, {
        ...person,
        employeeId: employee?.id || null,
        employeeName: employee?.name || person.name,
        matched: Boolean(employee),
      });
    }
  }
  return [...dedup.values()];
}

function findEmployee(name, employeesByName) {
  if (/\(гпх\)/i.test(String(name || ''))) return null;
  const normalized = normalizeText(name);
  const exact = employeesByName.get(normalized);
  if (exact) return exact;
  const parts = normalized.split(' ').filter((x) => x.length > 2);
  if (parts.length === 0) return null;
  const candidates = [...employeesByName.entries()]
    .filter(([employeeName]) => parts.every((part) => employeeName.includes(part)))
    .map(([, employee]) => employee);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return candidates.find((e) => normalizeText(e.name).startsWith(parts[0])) || candidates[0];
  return null;
}

async function main() {
  const workbook = XLSX.readFile(INPUT, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: false });
  const rows = grid.slice(1).map((r) => {
    const clientName = compact(r[1]);
    const auditType = compact(r[4]);
    const period = parsePeriod(r[5]);
    const partner = NAME_ALIASES[compact(r[6])] || compact(r[6]);
    return {
      no: compact(r[0]),
      clientName,
      auditType,
      auditYear: parseAuditYear(auditType),
      periodRaw: period.raw,
      periodStartYear: period.startYear,
      periodEndYear: period.endYear,
      periodMonths: period.months,
      partner,
      managers: parsePeople(r[7]),
      team: parsePeople(r[8]),
      tax: parsePeople(r[9]),
      note: compact(r[10]),
    };
  }).filter((r) => r.clientName || r.auditType);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [projects, employees] = await Promise.all([
    readAll(supabase, 'projects', 'id,name,status,start_date,deadline,notes'),
    readAll(supabase, 'employees', 'id,name,email,role,level'),
  ]);
  const employeesByName = new Map(employees.map((e) => [normalizeText(e.name), e]));

  const enriched = rows.map((row) => {
    const candidates = projects
      .map((project) => ({ project, score: scoreProject(row, project) }))
      .filter((x) => x.score >= 45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const best = candidates[0] || null;
    const confidence = !best ? 'unmatched' : best.score >= 90 ? 'high' : best.score >= 65 ? 'medium' : 'low';
    return {
      ...row,
      proposedStatus: 'completed',
      teamProposed: makeTeam(row, employeesByName),
      matchConfidence: confidence,
      matchedProjectId: best?.project.id || null,
      matchedProjectName: best?.project.name || null,
      matchedProjectStatus: best?.project.status || null,
      matchScore: best?.score || 0,
      candidates: candidates.map((x) => ({
        id: x.project.id,
        name: x.project.name,
        status: x.project.status,
        score: x.score,
      })),
    };
  });

  const summary = {
    source: path.basename(INPUT),
    rows: enriched.length,
    high: enriched.filter((r) => r.matchConfidence === 'high').length,
    medium: enriched.filter((r) => r.matchConfidence === 'medium').length,
    low: enriched.filter((r) => r.matchConfidence === 'low').length,
    unmatched: enriched.filter((r) => r.matchConfidence === 'unmatched').length,
    alreadyCompleted: enriched.filter((r) => r.matchedProjectStatus === 'completed' || r.matchedProjectStatus === 'closed').length,
    unmatchedEmployees: [...new Set(enriched.flatMap((r) => r.teamProposed.filter((m) => !m.matched).map((m) => m.name)))].sort(),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'analysis.json'), JSON.stringify({ summary, rows: enriched }, null, 2), 'utf8');
  await fs.writeFile(path.join(OUT_DIR, 'summary.txt'), [
    `Источник: ${summary.source}`,
    `Строк проектов: ${summary.rows}`,
    `Совпадения high: ${summary.high}`,
    `Совпадения medium: ${summary.medium}`,
    `Совпадения low: ${summary.low}`,
    `Не найдено: ${summary.unmatched}`,
    `Уже completed/closed среди найденных: ${summary.alreadyCompleted}`,
    '',
    'Не сопоставлены сотрудники:',
    ...summary.unmatchedEmployees.map((x) => `- ${x}`),
  ].join('\n'), 'utf8');

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
