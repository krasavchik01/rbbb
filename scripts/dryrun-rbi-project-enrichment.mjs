#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';
const SOURCE_DIR = process.argv.find((arg) => arg.startsWith('--dir='))?.slice('--dir='.length)
  || 'C:/Users/UserPC/AppData/Local/Temp/Rar$DRa114884.41954.rartemp';
const OUT_DIR = path.join(process.cwd(), 'reports', 'rbi-project-enrichment-dryrun');
const COMMIT = process.argv.includes('--commit');
const MARKER = 'auto:rbi-project-enrichment-2026-07-02';

const ROLE_BONUS = {
  partner: 25,
  project_leader: 4,
  manager_1: 10,
  manager_2: 8,
  manager_3: 6,
  supervisor_3: 15,
  supervisor_2: 10,
  supervisor_1: 6,
  tax_specialist_1: 3,
  tax_specialist_2: 3,
  assistant_3: 4,
  assistant_2: 4,
  assistant_1: 2,
  contractor: 0,
};

const NAME_ALIASES = new Map(Object.entries({
  'Газиз Алдонгаров': 'Алдонгаров Газиз',
  'Алдонгаров Азиз': 'Алдонгаров Газиз',
  'Алдонгаров Г.': 'Алдонгаров Газиз',
  'Ерлан Арнабеков': 'Арнабеков Ерлан',
  'Арнабеков Е.': 'Арнабеков Ерлан',
  'Сауле Бадамбаева': 'Бадамбаева Сауле',
  'Бадамбаева С.': 'Бадамбаева Сауле',
  'Шынгыс Сартаев': 'Сартаев Шынгыс',
  'Сартаев Шынгысбек': 'Сартаев Шынгыс',
  'Жорабеков Жанибек': 'Жанибек Жорабеков',
  'Жорабеков Ж.': 'Жанибек Жорабеков',
  'Жанибек Жорабеков': 'Жанибек Жорабеков',
  'Сейфуллина Гульмира': 'Сейфуллина Гульмира',
  'Гульмира Сейфулина': 'Сейфуллина Гульмира',
  'Сейфулина Гульмира': 'Сейфуллина Гульмира',
  'Гульмира Сейфуллина': 'Сейфуллина Гульмира',
  'Касымбек Тинай': 'Тинай Касымбек',
  'Камила Жаркинбекова': 'Жаркынбекова Камиля',
  'Камиля Жаркынбекова': 'Жаркымбекова Камиля',
  'Камиля Жаркинбекова': 'Жаркымбекова Камиля',
  'Камиля Жаркимбекова': 'Жаркымбекова Камиля',
  'Жаркинбекова Камиля': 'Жаркымбекова Камиля',
  'Жаркынбекова Камиля': 'Жаркымбекова Камиля',
  'Арнабекова Гульшат': 'Арнабекова Гулшат',
  'Бахытжан Бекжанов': 'Бекжанов Бақытжан',
  'Бекжанов Бакытжан': 'Бекжанов Бақытжан',
  'Бекжанов Бахытжан': 'Бекжанов Бақытжан',
  'Бакыт Жумадилов': 'Жумадилов Бакыт',
  'Марат Сагадат': 'Сагадат Марат',
  'Медекенов Марат': 'Марат Медекенов',
  'Мухашев Куаныш': 'Мухашев Куаныш',
  'Куаныш Мухашев': 'Мухашев Куаныш',
  'Нускабаева Райхан': 'Нускабаева Райхан',
  'Райхан': 'Нускабаева Райхан',
  'Забира': 'Zabira Yerlankyzy',
  'Ерланкызы Забира': 'Zabira Yerlankyzy',
  'Забира Ерланкизи': 'Забира Ерланкызы',
  'Ерланкизи Забира': 'Забира Ерланкызы',
  'Пономарёв Юрий': 'Пономарев Юрий',
  'Пономарев Юрий': 'Пономарев Юрий',
  'Худайберген Ерлан': 'Худайберген Ерлан',
  'Куандыкова Жанар': 'Куандыкова Жанар',
  'Идрисов Спандияр': 'Идрисов Спандияр',
  'Искаков Аскар': 'Искаков Аскар',
  'Боранбай Анара': 'Боранбай Анара',
  'Быков Роман': 'Быков Роман',
  'Гулжан Чалова': 'Чалова Гульжан',
  'Чалова Гульжан': 'Чалова Гульжан',
  'Света Каби': 'Каби Светлана',
  'Мая Тулепберген': 'Кенжебек Мая',
  'Тулепберген Мая': 'Кенжебек Мая',
  'Тулепбергенова Мая': 'Кенжебек Мая',
  'Павленко Василий': 'Василий Павленко',
  'Василий': 'Василий Павленко',
  'Сауле Тримов': 'Тримова Сауле',
  'Тримова Сауле': 'Сауле Тримова',
  'Лебеков Ермек': 'Ермек Лебеков',
  'Эрмек Ембердиев': 'Ембердиев Ермек',
  'Шолпанай Кудайбергенова': 'Кудайбергенова Шолпанай',
  'Кудайбергенова Шолпанай': 'Кудайбергенова Шолпанай',
  'Баур': 'Молдабаев Бауыржан',
  'Бахытжан': 'Бекжанов Бақытжан',
  'Гулсим': 'Бисенова Гульсим',
  'Бисенова Гулсим': 'Бисенова Гульсим',
  'Сакен': 'Сейткереев Сакен',
  'Акмолдир': 'Акмолдир Омарова',
  'Сыч Дмитрий': 'Дмитрий Сыч',
  'Сауле Бадамьаева': 'Сауле Бадамбаева',
  'Сауле Бадамабаева': 'Сауле Бадамбаева',
  'Ерлан Арнабекоа': 'Арнабеков Ерлан',
  'Кенжекулов Адилжжан': 'Кенжекулов Адилжан',
  'Сая Шардарбекова': 'Шардарбекова Саия',
  'Райымбек': 'Раимбек',
  'Раимбек': 'Раимбек',
  'Куптулеуова Альбина': 'Куптлеуова Альбина',
  'Альбина Куптлеулова': 'Куптлеуова Альбина',
  'Терегелди Улжан': 'Төрегелді Улжан',
}));

const ORG_WORDS = new Set([
  'тоо', 'ао', 'зао', 'нао', 'оюл', 'ргу', 'чк', 'llp', 'ltd', 'limited', 'too', 'ao',
  'акционерное', 'общество', 'товарищество', 'компания', 'группа',
  'казахстан', 'казахстана', 'республика', 'республики', 'рк', 'national', 'bank', 'банк',
  'investment', 'invest', 'fund', 'capital', 'company', 'limited',
]);

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/й/g, 'и')
    .replace(/ы/g, 'и')
    .replace(/[ә]/g, 'а')
    .replace(/[ғ]/g, 'г')
    .replace(/[қ]/g, 'к')
    .replace(/[ң]/g, 'н')
    .replace(/[ө]/g, 'о')
    .replace(/[ұү]/g, 'у')
    .replace(/[һ]/g, 'х')
    .replace(/[і]/g, 'и')
    .replace(/[ұү]/g, 'у')
    .replace(/[ұү]/g, 'у')
    .replace(/[«»"“”'`№]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !ORG_WORDS.has(token));
}

function cleanPersonName(value) {
  const raw = compact(value)
    .replace(/\bгпх\b/ig, ' ')
    .replace(/\s+-\s+до\s+.*$/i, '')
    .replace(/\s+до\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}.*$/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return NAME_ALIASES.get(raw) || raw;
}

function splitPeople(value) {
  const raw = compact(value);
  if (!raw || raw === '-' || raw === '+') return [];
  return raw
    .split(/[,;\n]+|\s+\/\s+|\/|\s+и\s+/i)
    .map(cleanPersonName)
    .filter((name) => {
      const n = normalizeText(name);
      return n && n !== 'гпх' && !['кпн', 'ндс', 'форма', 'ни', 'нт', 'ндпи', 'налог'].includes(n);
    });
}

function dateText(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return compact(value);
}

function headerIndex(rows) {
  return rows.findIndex((row) => {
    const line = row.map(normalizeText).join(' | ');
    return (
      (line.includes('заказчик') || line.includes('наименование клиента') || line.includes('наименование проекта'))
      && (line.includes('партнер') || line.includes('состав') || line.includes('руководитель'))
    );
  });
}

function buildHeaderMap(row) {
  const normalized = row.map(normalizeText);
  const find = (...needles) => normalized.findIndex((h) => needles.every((needle) => h.includes(normalizeText(needle))));
  return {
    no: find('номер') >= 0 ? find('номер') : normalized.findIndex((h) => h === 'n' || h === 'no'),
    client: find('заказчик') >= 0 ? find('заказчик') : find('наименование клиента') >= 0 ? find('наименование клиента') : find('наименование проекта'),
    auditType: find('вид аудита') >= 0 ? find('вид аудита') : find('вид проекта'),
    auditPeriod: find('период аудита'),
    status: find('статус'),
    reportDate: find('дата выпуска отчета') >= 0 ? find('дата выпуска отчета') : find('дата предоставления отчетов'),
    partner: find('партнер'),
    leader: find('руководитель проекта') >= 0 ? find('руководитель проекта') : find('руководитель'),
    team: find('состав группы') >= 0 ? find('состав группы') : find('состав группы 12m'),
    tax: find('налоги'),
    note: find('примечание'),
    company: find('компания аудитор') >= 0 ? find('компания аудитор') : find('компания'),
    partner6: find('партнер 6м') >= 0 ? find('партнер 6м') : find('партнер 9м'),
    team6: find('состав группы 6м') >= 0 ? find('состав группы 6м') : find('состав группы 9м'),
    partner12: find('партнер 12m') >= 0 ? find('партнер 12m') : find('партнер 12м'),
    team12: find('состав группы 12m') >= 0 ? find('состав группы 12m') : find('состав группы 12м'),
    start6: find('начало аудита 6м') >= 0 ? find('начало аудита 6м') : find('начало аудита 9м'),
    end6: find('завершение аудита 6м') >= 0 ? find('завершение аудита 6м') : find('завершение аудита 9м'),
    start12: find('начало аудита 12м'),
    end12: find('завершение аудита 12м'),
    contractNo: find('номер договора'),
    contractDate: find('дата договора'),
  };
}

function cell(row, index) {
  return index >= 0 ? compact(row[index]) : '';
}

function addPeople(entry, role, names) {
  for (const name of names) {
    if (!name) continue;
    entry.people.push({ name, role });
  }
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellStyles: true });
  const file = path.basename(filePath);
  const entries = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: false });
    const idx = headerIndex(rows);
    if (idx < 0) continue;

    const headers = buildHeaderMap(rows[idx]);
    let lastEntry = null;

    for (let r = idx + 1; r < rows.length; r += 1) {
      const row = rows[r];
      const rowHasData = row.some((v) => compact(v));
      if (!rowHasData) continue;

      const client = cell(row, headers.client);
      const no = cell(row, headers.no);
      const hasNewProject = Boolean(client) && (Boolean(no) || headers.no < 0 || /^\d+/.test(no) || cell(row, headers.auditType));

      if (!hasNewProject && lastEntry) {
        addPeople(lastEntry, 'partner', splitPeople(cell(row, headers.partner12) || cell(row, headers.partner) || cell(row, headers.partner6)));
        addPeople(lastEntry, 'project_leader', splitPeople(cell(row, headers.leader)));
        addPeople(lastEntry, 'team', splitPeople(cell(row, headers.team12) || cell(row, headers.team) || cell(row, headers.team6)));
        continue;
      }
      if (!hasNewProject) continue;

      const entry = {
        id: `${file}::${sheetName}::${r + 1}`,
        file,
        sheet: sheetName,
        row: r + 1,
        clientName: client,
        auditType: cell(row, headers.auditType),
        auditPeriod: cell(row, headers.auditPeriod),
        sourceStatus: cell(row, headers.status),
        reportDate: dateText(row[headers.reportDate]),
        company: cell(row, headers.company),
        note: cell(row, headers.note),
        contractNo: cell(row, headers.contractNo),
        contractDate: dateText(row[headers.contractDate]),
        starts: [dateText(row[headers.start6]), dateText(row[headers.start12])].filter(Boolean),
        ends: [dateText(row[headers.end6]), dateText(row[headers.end12])].filter(Boolean),
        people: [],
      };

      addPeople(entry, 'partner', splitPeople(cell(row, headers.partner12) || cell(row, headers.partner) || cell(row, headers.partner6)));
      addPeople(entry, 'project_leader', splitPeople(cell(row, headers.leader)));
      addPeople(entry, 'team', splitPeople(cell(row, headers.team12) || cell(row, headers.team) || cell(row, headers.team6)));

      // In partner-ledger files the "Налоги" column can contain names. In quarterly RBI files it often contains tax types.
      if (!/кпн|ндс|налог на|форма|прочие налоги/i.test(cell(row, headers.tax))) {
        addPeople(entry, 'tax_specialist_1', splitPeople(cell(row, headers.tax)));
      }

      entries.push(entry);
      lastEntry = entry;
    }
  }

  return entries;
}

function parseNotes(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function projectDisplayName(project) {
  const notes = project._notes || {};
  return notes.name || notes.clientName || notes.client?.name || project.name || '';
}

function projectYears(project) {
  const notes = project._notes || {};
  const text = [
    project.name,
    notes.name,
    notes.clientName,
    notes.contract?.subject,
    notes.contract?.serviceStartDate,
    notes.contract?.serviceEndDate,
  ].join(' ');
  return [...text.matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
}

function entryYears(entry) {
  const text = [entry.auditType, entry.auditPeriod, entry.reportDate, entry.starts.join(' '), entry.ends.join(' ')].join(' ');
  return [...text.matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
}

function scoreProject(entry, project) {
  const clientNorm = normalizeText(entry.clientName);
  const clientTokens = tokens(entry.clientName);
  const projectNorm = normalizeText(projectDisplayName(project));
  const projectTokens = tokens(projectDisplayName(project));
  const auditNorm = normalizeText(entry.auditType);

  let score = 0;
  if (clientTokens.length > 0) {
    const projectTokenSet = new Set(projectTokens);
    const directHits = clientTokens.filter((token) => projectTokenSet.has(token) || projectNorm.includes(token));
    if (directHits.length === 0) return 0;
    if (clientTokens.length >= 3 && directHits.length === 1) score -= 45;
  }

  if (clientNorm && projectNorm === clientNorm) score += 120;
  if (clientNorm && (projectNorm.includes(clientNorm) || clientNorm.includes(projectNorm))) score += 85;

  const tokenHits = clientTokens.filter((token) => projectTokens.includes(token) || projectNorm.includes(token)).length;
  if (clientTokens.length > 0) score += Math.round((tokenHits / clientTokens.length) * 50);

  const eYears = entryYears(entry);
  const pYears = projectYears(project);
  if (eYears.length && pYears.length) {
    if (eYears.some((year) => pYears.includes(year))) score += 35;
    else score -= 45;
  }

  if (auditNorm.includes('аудит') && projectNorm.includes('аудит')) score += 12;
  if (auditNorm.includes('фо') && /фо|финансов|кфо|офо/.test(projectNorm)) score += 12;
  if (auditNorm.includes('согласован') && projectNorm.includes('согласован')) score += 14;
  if (auditNorm.includes('спец') && /спец|специаль/.test(projectNorm)) score += 14;

  return score;
}

function defaultRole(employee, sourceRole) {
  if (sourceRole === 'partner') return 'partner';
  if (sourceRole === 'project_leader') return 'project_leader';
  if (sourceRole === 'tax_specialist_1') return 'tax_specialist_1';
  if (!employee) return sourceRole || 'team';
  if (employee.role === 'partner') return 'partner';
  if (employee.role === 'manager') return `manager_${employee.level || '1'}`;
  if (employee.role === 'supervisor') return `supervisor_${employee.level || '1'}`;
  if (employee.role === 'tax_specialist') return `tax_specialist_${employee.level === '2' ? '2' : '1'}`;
  if (employee.role === 'assistant' || employee.role === 'employee') return `assistant_${employee.level || '1'}`;
  return employee.role || 'assistant_1';
}

function buildEmployeeIndex(employees) {
  const byName = new Map();
  for (const employee of employees) byName.set(normalizeText(employee.name), employee);
  return { employees, byName };
}

function findEmployee(sourceName, index) {
  const clean = cleanPersonName(sourceName);
  const cleanTokens = normalizeText(clean).split(' ');
  if (!clean || cleanTokens.includes('гпх')) return { employee: null, external: true, clean };
  const norm = normalizeText(clean);
  if (index.byName.has(norm)) return { employee: index.byName.get(norm), external: false, clean };

  const parts = tokens(clean).filter((part) => part.length > 2);
  const candidates = index.employees.filter((employee) => {
    const employeeName = normalizeText(employee.name);
    return parts.length > 0 && parts.every((part) => employeeName.includes(part));
  });
  if (candidates.length === 1) return { employee: candidates[0], external: false, clean };
  if (candidates.length > 1) {
    const preferred = candidates.find((employee) => normalizeText(employee.name).startsWith(parts[0])) || candidates[0];
    return { employee: preferred, external: false, clean, ambiguousEmployees: candidates.map((e) => e.name) };
  }

  if (parts.length === 2) {
    const looseCandidates = index.employees.filter((employee) => {
      const employeeParts = tokens(employee.name);
      return parts.every((part) => employeeParts.some((employeePart) => employeePart.startsWith(part) || part.startsWith(employeePart)));
    });
    if (looseCandidates.length === 1) return { employee: looseCandidates[0], external: false, clean };
    if (looseCandidates.length > 1) {
      return { employee: looseCandidates[0], external: false, clean, ambiguousEmployees: looseCandidates.map((e) => e.name) };
    }
  }
  return { employee: null, external: false, clean };
}

function classifyMatch(matches) {
  const [best, second] = matches;
  if (!best || best.score < 65) return 'not_found';
  if (best.score >= 105 && (!second || best.score - second.score >= 12)) return 'exact';
  if (best.score >= 82 && (!second || best.score - second.score >= 10)) return 'probable';
  return 'conflict';
}

function currentTeam(project) {
  const notes = project._notes || {};
  return Array.isArray(notes.team) ? notes.team : [];
}

function analyzeEntry(entry, projects, employeeIndex) {
  const rawMatches = projects
    .map((project) => ({ project, score: scoreProject(entry, project) }))
    .sort((a, b) => b.score - a.score)
    .filter((match) => match.score > 0);

  const seenProjectKeys = new Set();
  const matches = [];
  for (const match of rawMatches) {
    const key = normalizeText(projectDisplayName(match.project));
    if (seenProjectKeys.has(key)) continue;
    seenProjectKeys.add(key);
    matches.push(match);
    if (matches.length >= 5) break;
  }
  const matchType = classifyMatch(matches);
  const best = matchType === 'not_found' ? null : matches[0]?.project;

  const seen = new Set();
  const mappedPeople = [];
  const unmatchedPeople = [];
  const externalPeople = [];
  for (const person of entry.people) {
    const found = findEmployee(person.name, employeeIndex);
    if (found.external) {
      externalPeople.push({ sourceName: person.name, cleanName: found.clean, sourceRole: person.role });
      continue;
    }
    if (!found.employee) {
      unmatchedPeople.push({ sourceName: person.name, cleanName: found.clean, sourceRole: person.role });
      continue;
    }
    const role = defaultRole(found.employee, person.role);
    const key = `${found.employee.id}|${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mappedPeople.push({
      sourceName: person.name,
      employeeId: found.employee.id,
      employeeName: found.employee.name,
      sourceRole: person.role,
      role,
      bonusPercent: ROLE_BONUS[role] ?? 0,
      ambiguousEmployees: found.ambiguousEmployees || [],
    });
  }

  let additions = [];
  let existing = [];
  let conflicts = [];
  if (best) {
    const team = currentTeam(best);
    const teamIds = new Set(team.map((member) => member.userId).filter(Boolean));
    additions = mappedPeople.filter((person) => !teamIds.has(person.employeeId));
    existing = mappedPeople.filter((person) => teamIds.has(person.employeeId));

    const partnerIds = new Set(team.filter((m) => m.role === 'partner').map((m) => m.userId));
    const leaderIds = new Set(team.filter((m) => m.role === 'project_leader').map((m) => m.userId));
    for (const person of mappedPeople) {
      if (person.role === 'partner' && partnerIds.size && !partnerIds.has(person.employeeId)) {
        conflicts.push(`partner differs: existing ${[...partnerIds].join(', ')} vs ${person.employeeName}`);
      }
      if (person.role === 'project_leader' && leaderIds.size && !leaderIds.has(person.employeeId)) {
        conflicts.push(`project leader differs: existing ${[...leaderIds].join(', ')} vs ${person.employeeName}`);
      }
    }
  }

  return {
    entry,
    matchType,
    bestProject: best ? {
      id: best.id,
      name: projectDisplayName(best),
      status: best.status,
      score: matches[0]?.score ?? 0,
      teamCount: currentTeam(best).length,
    } : null,
    candidates: matches.map((m) => ({ id: m.project.id, name: projectDisplayName(m.project), status: m.project.status, score: m.score })),
    mappedPeople,
    additions,
    existing,
    unmatchedPeople,
    externalPeople,
    conflicts,
  };
}

function csvEscape(value) {
  const s = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  return [
    columns.map((c) => csvEscape(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvEscape(c.get(row))).join(',')),
  ].join('\n');
}

function summarize(results) {
  const summary = {
    sourceRows: results.length,
    exact: results.filter((r) => r.matchType === 'exact').length,
    probable: results.filter((r) => r.matchType === 'probable').length,
    conflict: results.filter((r) => r.matchType === 'conflict').length,
    notFound: results.filter((r) => r.matchType === 'not_found').length,
    mappedPeople: results.reduce((sum, r) => sum + r.mappedPeople.length, 0),
    additions: results.reduce((sum, r) => sum + r.additions.length, 0),
    existingPeople: results.reduce((sum, r) => sum + r.existing.length, 0),
    unmatchedPeople: results.reduce((sum, r) => sum + r.unmatchedPeople.length, 0),
    externalPeople: results.reduce((sum, r) => sum + r.externalPeople.length, 0),
  };
  return summary;
}

function sourcePayload(result) {
  return {
    marker: MARKER,
    importedAt: new Date().toISOString(),
    file: result.entry.file,
    sheet: result.entry.sheet,
    row: result.entry.row,
    clientName: result.entry.clientName,
    auditType: result.entry.auditType,
    auditPeriod: result.entry.auditPeriod,
    sourceStatus: result.entry.sourceStatus,
    reportDate: result.entry.reportDate,
    company: result.entry.company,
    note: result.entry.note,
    contractNo: result.entry.contractNo,
    contractDate: result.entry.contractDate,
    matchType: result.matchType,
    matchScore: result.bestProject?.score ?? null,
  };
}

function asTeamMember(person) {
  return {
    userId: person.employeeId,
    userName: person.employeeName,
    role: person.role,
    bonusPercent: person.bonusPercent,
    assignedAt: new Date().toISOString(),
    assignedBy: MARKER,
    sourceRole: person.sourceRole,
  };
}

function dedupeSources(sources) {
  const seen = new Set();
  const out = [];
  for (const source of sources) {
    const key = `${source.file}|${source.sheet}|${source.row}|${source.clientName}|${source.auditType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

function levenshtein(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left) return right.length;
  if (!right) return left.length;
  const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[left.length][right.length];
}

function similarEmployeeScore(sourceName, employeeName) {
  const sourceTokens = tokens(sourceName);
  const employeeTokens = tokens(employeeName);
  if (!sourceTokens.length || !employeeTokens.length) return 0;

  let score = 0;
  for (const sourceToken of sourceTokens) {
    const bestTokenScore = employeeTokens.reduce((best, employeeToken) => {
      if (employeeToken === sourceToken) return Math.max(best, 40);
      if (employeeToken.startsWith(sourceToken) || sourceToken.startsWith(employeeToken)) return Math.max(best, 28);
      const distance = levenshtein(sourceToken, employeeToken);
      if (distance <= 1 && Math.min(sourceToken.length, employeeToken.length) >= 5) return Math.max(best, 24);
      if (distance <= 2 && Math.min(sourceToken.length, employeeToken.length) >= 8) return Math.max(best, 18);
      return best;
    }, 0);
    score += bestTokenScore;
  }
  if (sourceTokens.length === 1) score -= 10;
  return score;
}

function suggestPeopleAction(name, suggestions) {
  const norm = normalizeText(name);
  if (norm.includes('гпх')) return 'mark_external_gph';
  if (suggestions[0]?.score >= 55) return 'add_alias_to_employee';
  if (suggestions[0]?.score >= 35) return 'manual_check_possible_employee';
  return 'create_employee_or_mark_external';
}

async function writePeopleReview(results, employees) {
  const grouped = new Map();
  for (const result of results) {
    for (const person of result.unmatchedPeople) {
      const key = person.cleanName;
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: person.cleanName,
          count: 0,
          roles: new Set(),
          files: new Set(),
          examples: [],
        });
      }
      const row = grouped.get(key);
      row.count += 1;
      row.roles.add(person.sourceRole);
      row.files.add(result.entry.file);
      if (row.examples.length < 3) {
        row.examples.push(`${result.entry.clientName} (${result.entry.file}, ${result.entry.sheet} row ${result.entry.row})`);
      }
    }
  }

  const rows = [...grouped.values()]
    .map((row) => {
      const suggestions = employees
        .map((employee) => ({ employee, score: similarEmployeeScore(row.name, employee.name) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return {
        ...row,
        suggestions,
        action: suggestPeopleAction(row.name, suggestions),
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  await fs.writeFile(path.join(OUT_DIR, 'people-review.csv'), toCsv(rows, [
    { header: 'source_name', get: (r) => r.name },
    { header: 'count', get: (r) => r.count },
    { header: 'source_roles', get: (r) => [...r.roles] },
    { header: 'recommended_action', get: (r) => r.action },
    { header: 'best_employee', get: (r) => r.suggestions[0] ? `${r.suggestions[0].employee.name} [${r.suggestions[0].employee.role}_${r.suggestions[0].employee.level}] score=${r.suggestions[0].score}` : '' },
    { header: 'other_candidates', get: (r) => r.suggestions.slice(1).map((s) => `${s.employee.name} (${s.score})`) },
    { header: 'files', get: (r) => [...r.files] },
    { header: 'examples', get: (r) => r.examples },
  ]), 'utf8');

  await fs.writeFile(path.join(OUT_DIR, 'people-review.json'), JSON.stringify(rows.map((row) => ({
    name: row.name,
    count: row.count,
    sourceRoles: [...row.roles],
    recommendedAction: row.action,
    suggestions: row.suggestions.map((s) => ({
      id: s.employee.id,
      name: s.employee.name,
      role: s.employee.role,
      level: s.employee.level,
      score: s.score,
    })),
    files: [...row.files],
    examples: row.examples,
  })), null, 2), 'utf8');
}

function cleanCommitResults(results) {
  return results.filter((result) => (
    ['exact', 'probable'].includes(result.matchType)
    && result.bestProject
    && result.conflicts.length === 0
    && result.unmatchedPeople.length === 0
  ));
}

function groupCommitUpdates(results, projectRows) {
  const byProjectId = new Map(projectRows.map((project) => [project.id, project]));
  const grouped = new Map();
  for (const result of cleanCommitResults(results)) {
    const projectId = result.bestProject.id;
    if (!grouped.has(projectId)) {
      const project = byProjectId.get(projectId);
      grouped.set(projectId, {
        project,
        results: [],
        people: [],
      });
    }
    const group = grouped.get(projectId);
    group.results.push(result);
    group.people.push(...result.additions);
  }
  return [...grouped.values()].filter((group) => group.project);
}

function mergeProjectNotes(project, group) {
  const notes = parseNotes(project.notes);
  const existingTeam = Array.isArray(notes.team) ? notes.team : [];
  const teamKeys = new Set(existingTeam.map((member) => `${member.userId}|${member.role}`));
  const newMembers = [];

  for (const person of group.people) {
    const key = `${person.employeeId}|${person.role}`;
    if (teamKeys.has(key)) continue;
    teamKeys.add(key);
    newMembers.push(asTeamMember(person));
  }

  const existingSources = Array.isArray(notes.rbiEnrichment?.sources) ? notes.rbiEnrichment.sources : [];
  const sources = dedupeSources([...existingSources, ...group.results.map(sourcePayload)]);
  const allPartnerIds = [...existingTeam, ...newMembers].filter((m) => m.role === 'partner').map((m) => m.userId);
  const allLeaderIds = [...existingTeam, ...newMembers].filter((m) => m.role === 'project_leader').map((m) => m.userId);

  const nextNotes = {
    ...notes,
    team: [...existingTeam, ...newMembers],
    rbiEnrichment: {
      marker: MARKER,
      updatedAt: new Date().toISOString(),
      sourceRows: sources.length,
      sources,
    },
    updated_at: new Date().toISOString(),
  };

  return {
    notes: nextNotes,
    newMembers,
    partnerId: project.partner_id || allPartnerIds[0] || null,
    managerId: project.manager_id || allLeaderIds[0] || null,
  };
}

async function commitResults(sb, results, projectRows) {
  const groups = groupCommitUpdates(results, projectRows);
  const committed = [];
  const skipped = [];

  for (const group of groups) {
    const merged = mergeProjectNotes(group.project, group);
    if (merged.newMembers.length === 0 && group.results.length === 0) {
      skipped.push({ projectId: group.project.id, projectName: projectDisplayName({ ...group.project, _notes: parseNotes(group.project.notes) }), reason: 'nothing_to_add' });
      continue;
    }

    const updatePayload = {
      notes: JSON.stringify(merged.notes),
      updated_at: new Date().toISOString(),
    };
    if (!group.project.partner_id && merged.partnerId) updatePayload.partner_id = merged.partnerId;
    if (!group.project.manager_id && merged.managerId) updatePayload.manager_id = merged.managerId;

    const { error } = await sb.from('projects').update(updatePayload).eq('id', group.project.id);
    if (error) throw error;

    committed.push({
      projectId: group.project.id,
      projectName: projectDisplayName({ ...group.project, _notes: parseNotes(group.project.notes) }),
      rows: group.results.length,
      addedMembers: merged.newMembers.length,
      addedNames: merged.newMembers.map((m) => `${m.userName} [${m.role}]`),
      partnerSet: Boolean(updatePayload.partner_id),
      managerSet: Boolean(updatePayload.manager_id),
    });
  }

  await fs.writeFile(path.join(OUT_DIR, 'commit-results.csv'), toCsv(committed, [
    { header: 'project_id', get: (r) => r.projectId },
    { header: 'project_name', get: (r) => r.projectName },
    { header: 'source_rows', get: (r) => r.rows },
    { header: 'added_members', get: (r) => r.addedMembers },
    { header: 'added_names', get: (r) => r.addedNames },
    { header: 'partner_id_set', get: (r) => r.partnerSet },
    { header: 'manager_id_set', get: (r) => r.managerSet },
  ]), 'utf8');

  await fs.writeFile(path.join(OUT_DIR, 'commit-results.json'), JSON.stringify({ committed, skipped }, null, 2), 'utf8');
  return { committed, skipped };
}

async function main() {
  const files = (await fs.readdir(SOURCE_DIR))
    .filter((file) => /\.xlsx$/i.test(file) && !file.startsWith('~$'))
    .map((file) => path.join(SOURCE_DIR, file));

  const entries = files.flatMap(parseWorkbook)
    .filter((entry) => entry.clientName && !/^итого|количество/i.test(entry.clientName));

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [{ data: projects, error: projectError }, { data: employees, error: employeeError }] = await Promise.all([
    sb.from('projects').select('id,name,status,partner_id,manager_id,notes,start_date,deadline'),
    sb.from('employees').select('id,name,role,level,email').order('name'),
  ]);
  if (projectError) throw projectError;
  if (employeeError) throw employeeError;

  const parsedProjects = projects.map((project) => ({ ...project, _notes: parseNotes(project.notes) }));
  const employeeIndex = buildEmployeeIndex(employees);
  const results = entries.map((entry) => analyzeEntry(entry, parsedProjects, employeeIndex));
  const summary = summarize(results);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'dryrun.json'), JSON.stringify({ summary, results }, null, 2), 'utf8');
  await fs.writeFile(path.join(OUT_DIR, 'matches.csv'), toCsv(results, [
    { header: 'match_type', get: (r) => r.matchType },
    { header: 'score', get: (r) => r.bestProject?.score ?? '' },
    { header: 'source_file', get: (r) => r.entry.file },
    { header: 'sheet', get: (r) => r.entry.sheet },
    { header: 'row', get: (r) => r.entry.row },
    { header: 'client', get: (r) => r.entry.clientName },
    { header: 'audit_type', get: (r) => r.entry.auditType },
    { header: 'audit_period', get: (r) => r.entry.auditPeriod },
    { header: 'source_status', get: (r) => r.entry.sourceStatus },
    { header: 'matched_project', get: (r) => r.bestProject?.name ?? '' },
    { header: 'matched_project_id', get: (r) => r.bestProject?.id ?? '' },
    { header: 'project_status', get: (r) => r.bestProject?.status ?? '' },
    { header: 'additions', get: (r) => r.additions.map((p) => `${p.employeeName} [${p.role}]`) },
    { header: 'existing', get: (r) => r.existing.map((p) => `${p.employeeName} [${p.role}]`) },
    { header: 'unmatched_people', get: (r) => r.unmatchedPeople.map((p) => `${p.cleanName} [${p.sourceRole}]`) },
    { header: 'external_people', get: (r) => r.externalPeople.map((p) => `${p.cleanName} [${p.sourceRole}]`) },
    { header: 'conflicts', get: (r) => r.conflicts },
  ]), 'utf8');

  const conflictRows = results.filter((r) => r.matchType === 'conflict' || r.conflicts.length || r.unmatchedPeople.length);
  await fs.writeFile(path.join(OUT_DIR, 'needs-review.csv'), toCsv(conflictRows, [
    { header: 'reason', get: (r) => [r.matchType === 'conflict' ? 'project_match_conflict' : '', r.conflicts.length ? 'team_conflict' : '', r.unmatchedPeople.length ? 'unmatched_people' : ''].filter(Boolean) },
    { header: 'source_file', get: (r) => r.entry.file },
    { header: 'sheet', get: (r) => r.entry.sheet },
    { header: 'row', get: (r) => r.entry.row },
    { header: 'client', get: (r) => r.entry.clientName },
    { header: 'audit_type', get: (r) => r.entry.auditType },
    { header: 'best_candidate', get: (r) => r.candidates[0] ? `${r.candidates[0].name} (${r.candidates[0].score})` : '' },
    { header: 'second_candidate', get: (r) => r.candidates[1] ? `${r.candidates[1].name} (${r.candidates[1].score})` : '' },
    { header: 'unmatched_people', get: (r) => r.unmatchedPeople.map((p) => `${p.cleanName} [${p.sourceRole}]`) },
    { header: 'conflicts', get: (r) => r.conflicts },
  ]), 'utf8');

  const md = [
    '# RBI project enrichment dry-run',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source dir: ${SOURCE_DIR}`,
    '',
    '## Summary',
    '',
    `- Source rows parsed: ${summary.sourceRows}`,
    `- Exact matches: ${summary.exact}`,
    `- Probable matches: ${summary.probable}`,
    `- Project conflicts: ${summary.conflict}`,
    `- Not found in system: ${summary.notFound}`,
    `- People mapped: ${summary.mappedPeople}`,
    `- Team additions proposed: ${summary.additions}`,
    `- Already in project teams: ${summary.existingPeople}`,
    `- Unmatched people names: ${summary.unmatchedPeople}`,
    `- External/GPH people: ${summary.externalPeople}`,
    '',
    '## Top review items',
    '',
    ...conflictRows.slice(0, 30).map((r) => `- ${r.matchType}: ${r.entry.clientName} (${r.entry.file}, ${r.entry.sheet} row ${r.entry.row}) -> ${r.candidates[0]?.name || 'no candidate'}; unmatched: ${r.unmatchedPeople.map((p) => p.cleanName).join(', ') || '-'}; conflicts: ${r.conflicts.join('; ') || '-'}`),
    '',
  ].join('\n');
  await fs.writeFile(path.join(OUT_DIR, 'summary.md'), md, 'utf8');
  await writePeopleReview(results, employees);

  let commitSummary = null;
  if (COMMIT) {
    commitSummary = await commitResults(sb, results, projects);
  }

  console.log(JSON.stringify({ ...summary, commit: commitSummary ? {
    projectsUpdated: commitSummary.committed.length,
    membersAdded: commitSummary.committed.reduce((sum, row) => sum + row.addedMembers, 0),
    skipped: commitSummary.skipped.length,
  } : undefined }, null, 2));
  console.log(`Reports: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
