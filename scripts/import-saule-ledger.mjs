#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const INPUT = path.join(process.cwd(), 'САУЛЕ 2024 окт-2025 окт.xlsx');
const OUT_DIR = path.join(process.cwd(), 'reports', 'saule-ledger-import');
const MARKER = 'auto:saule-ledger-2024-2025';
const COMMIT = process.argv.includes('--commit');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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

const NAME_ALIASES = {
  'Бадамбаева Сауле': 'Сауле Бадамбаева',
  Сауле: 'Сауле Бадамбаева',
  Райхан: 'Нускабаева Райхан',
  Марат: 'Медекенов Марат',
  Мая: 'Мая',
  Саия: 'Шардарбекова Саия',
  Сая: 'Шардарбекова Саия',
  Газиз: 'Алдонгаров Газиз',
  Гаухар: 'Сартаева Гаухар',
  Гульжан: 'Гульжан Чалова',
  Тинай: 'Қасымбек Тинай',
  Ернур: 'Жамбыл Ернур',
  Ерлан: 'Ерлан',
  Светлана: 'Светлана',
  Руслан: 'Руслан',
  Забира: 'Zabira Yerlankyzy',
  Бакытжан: 'Бекжанов Бақытжан',
  Бахытжан: 'Бекжанов Бақытжан',
  Спандияр: 'Идрисов Спандияр',
  Улжан: 'Улжан',
  Акулпа: 'Акулпа',
  Рошангуль: 'Рошангуль',
  Дана: 'Турлыгазина Дана',
  Ержан: 'Ержан',
  Юра: 'Юра',
};

const CLIENT_ALIASES = {
  'TOO «Bapy Mining»': 'ТОО Bapy Mining',
  'AO «Центр развития города Алматы»': 'АО Центр развития города Алматы',
};

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/[«»"“”'`]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[ә]/g, 'а')
    .replace(/[ғ]/g, 'г')
    .replace(/[қ]/g, 'к')
    .replace(/[ң]/g, 'н')
    .replace(/[ө]/g, 'о')
    .replace(/[ұү]/g, 'у')
    .replace(/[һ]/g, 'х')
    .replace(/[і]/g, 'и')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .replace(/\b(тоо|ао|too|ao|ltd|llp|llc|за|период|год|г)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNotes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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

function excelDateToISO(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed?.y || !parsed?.m || !parsed?.d) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const raw = compact(value);
  const year = raw.match(/20\d{2}/)?.[0];
  if (/апр/i.test(raw) && /май/i.test(raw) && year) return `${year}-05-31`;
  if (year) return `${year}-12-31`;
  return null;
}

function parseAuditYear(periodRaw, auditType) {
  const source = `${periodRaw} ${auditType}`;
  const match = compact(source).match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function parsePeople(value) {
  const raw = compact(value);
  if (!raw || raw === '-') return [];
  return raw
    .split(',')
    .map((part) => compact(part))
    .filter(Boolean)
    .map((part) => {
      const isTax = /налог/i.test(part);
      const isContractor = /гпх/i.test(part);
      const cleanName = compact(part.replace(/\([^)]*\)/g, '').replace(/налоги?/giu, ''));
      return {
        sourceName: part,
        name: NAME_ALIASES[cleanName] || cleanName,
        isTax,
        isContractor,
      };
    })
    .filter((p) => p.name);
}

function normalizeRole(role, level, fallback = 'assistant_1') {
  const normalizedLevel = ['1', '2', '3'].includes(String(level || '')) ? String(level) : '1';
  if (role === 'partner') return 'partner';
  if (role === 'project_leader') return 'project_leader';
  if (role === 'manager' || role === 'project_manager') return `manager_${normalizedLevel}`;
  if (role === 'supervisor') return `supervisor_${normalizedLevel}`;
  if (role === 'tax_specialist') return `tax_specialist_${normalizedLevel === '3' ? '2' : normalizedLevel}`;
  if (role === 'assistant' || role === 'employee') return `assistant_${normalizedLevel}`;
  return fallback;
}

function findEmployee(name, employeeIndex) {
  const normalized = normalizeText(NAME_ALIASES[name] || name);
  if (!normalized) return null;
  const exact = employeeIndex.byName.get(normalized);
  if (exact) return exact;
  const parts = normalized.split(' ').filter((x) => x.length > 2);
  const candidates = employeeIndex.employees.filter((employee) => {
    const employeeName = normalizeText(employee.name);
    return parts.every((part) => employeeName.includes(part));
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return candidates.find((e) => normalizeText(e.name).startsWith(parts[0])) || candidates[0];
  }
  return null;
}

function buildTeam(row, employeeIndex) {
  const now = new Date().toISOString();
  const people = [
    { sourceName: row.partner, name: row.partner, forcedRole: 'partner', isContractor: false },
    ...row.managers.map((p) => ({ ...p, forcedRole: 'project_leader' })),
    ...row.team.map((p) => ({ ...p, forcedRole: p.isTax ? 'tax_specialist_1' : null })),
  ];
  const members = [];
  const external = [];
  const seen = new Set();

  for (const person of people) {
    const name = compact(person.name);
    if (!name) continue;
    if (person.isContractor) {
      external.push({ name: person.sourceName || name, role: person.forcedRole || (person.isTax ? 'tax_specialist_1' : 'contractor') });
      continue;
    }
    const employee = findEmployee(name, employeeIndex);
    if (!employee) {
      external.push({ name: person.sourceName || name, role: person.forcedRole || (person.isTax ? 'tax_specialist_1' : 'external') });
      continue;
    }
    const role = person.forcedRole || normalizeRole(employee.role, employee.level);
    const key = `${employee.id}|${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({
      userId: employee.id,
      userName: employee.name || name,
      role,
      bonusPercent: ROLE_BONUS[role] ?? 0,
      assignedAt: now,
      assignedBy: MARKER,
    });
  }

  return { members, external };
}

function projectYears(projectName) {
  return [...compact(projectName).matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
}

function yearFitsProject(year, projectName) {
  if (!year) return true;
  const years = projectYears(projectName);
  if (years.length === 0) return true;
  if (years.includes(year)) return true;
  if (years.length >= 2) return year >= Math.min(...years) && year <= Math.max(...years);
  return false;
}

function scoreProject(row, project) {
  const clientName = CLIENT_ALIASES[row.clientName] || row.clientName;
  const client = normalizeText(clientName);
  const dbName = normalizeText(project.name);
  const notes = parseNotes(project.notes);
  const notesName = normalizeText(notes?.name || notes?.clientName || notes?.client?.name || '');
  const projectText = `${dbName} ${notesName}`.trim();
  let score = 0;

  if (projectText === client) score += 120;
  if (client && (projectText.includes(client) || client.includes(projectText))) score += 80;

  const clientTokens = client.split(' ').filter((token) => token.length >= 3);
  const hitTokens = clientTokens.filter((token) => projectText.includes(token)).length;
  if (clientTokens.length > 0) score += Math.round((hitTokens / clientTokens.length) * 60);

  if (row.auditYear) {
    if (yearFitsProject(row.auditYear, project.name)) score += 30;
    else score -= 50;
  }
  if (/спец/i.test(row.auditType) && /спец|назнач/i.test(project.name)) score += 15;
  if (/аудит/i.test(row.auditType) && /аудит|финансов/i.test(project.name)) score += 10;

  return score;
}

function directClientScore(row, project) {
  const client = normalizeText(CLIENT_ALIASES[row.clientName] || row.clientName);
  const projectName = normalizeText(project.name);
  const notes = parseNotes(project.notes);
  const notesClient = normalizeText(notes?.clientName || notes?.client?.name || notes?.name || '');
  if (projectName === client || notesClient === client) return 3;
  if (projectName.includes(client) || notesClient.includes(client)) return 2;
  if (client.includes(projectName) || client.includes(notesClient)) return 1;
  return 0;
}

function chooseMatch(row, projects) {
  const ranked = projects
    .map((project) => ({ project, score: scoreProject(row, project), directScore: directClientScore(row, project) }))
    .filter((x) => x.score >= 85)
    .sort((a, b) => {
      if (b.directScore !== a.directScore) return b.directScore - a.directScore;
      if (b.score !== a.score) return b.score - a.score;
      const statusRank = (status) => (status === 'active' || status === 'in_progress' ? 3 : 2);
      return statusRank(b.project.status) - statusRank(a.project.status);
    });
  if (ranked.length === 0) return { action: 'create', ranked: [] };

  const bestScore = ranked[0].score;
  const bestDirectScore = ranked[0].directScore;
  const best = ranked.filter((x) => x.score === bestScore && x.directScore === bestDirectScore);
  const sameLogicalProject = best.filter((x) => normalizeText(x.project.name) === normalizeText(ranked[0].project.name));
  if (sameLogicalProject.length > 1) {
    return { action: 'update_duplicates', projects: sameLogicalProject.map((x) => x.project), project: sameLogicalProject[0].project, ranked: ranked.slice(0, 5) };
  }
  if (best.length === 1 || bestScore - (ranked[1]?.score || 0) >= 20 || bestDirectScore > (ranked[1]?.directScore || 0)) {
    return { action: 'update', projects: [ranked[0].project], project: ranked[0].project, ranked: ranked.slice(0, 5) };
  }

  return { action: 'update_best_duplicate', projects: [ranked[0].project], project: ranked[0].project, ranked: ranked.slice(0, 5) };
}

function mergeTeam(existingTeam, newTeam) {
  const merged = Array.isArray(existingTeam) ? [...existingTeam] : [];
  const keys = new Set(merged.map((m) => `${m?.userId || m?.id}|${m?.role}`));
  for (const member of newTeam) {
    const key = `${member.userId}|${member.role}`;
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(member);
  }
  return merged;
}

function periodFor(row, team) {
  const year = row.auditYear || 2024;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  return {
    id: `saule_${row.no || normalizeText(row.clientName).slice(0, 24)}_${year}`,
    name: String(row.periodRaw || year),
    type: 'year',
    startDate,
    endDate,
    year,
    partnerName: row.partner,
    status: 'completed',
    deadline: row.reportDate || undefined,
    taskIds: [],
    documentIds: [],
    team,
    sourceProjectId: undefined,
    createdBy: MARKER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeProjectName(row) {
  const period = row.periodRaw ? ` за ${row.periodRaw}` : '';
  const type = row.auditType ? ` - ${row.auditType}` : '';
  return `${CLIENT_ALIASES[row.clientName] || row.clientName}${type}${period}`;
}

function buildNotes(row, team, externalPeople, existingNotes = {}) {
  const projectName = existingNotes.name || makeProjectName(row);
  const period = periodFor(row, team);
  const existingPeriods = Array.isArray(existingNotes.auditPeriods) ? existingNotes.auditPeriods : [];
  const periodKey = `${period.name}|${period.startDate}|${period.endDate}`;
  const auditPeriods = [
    ...existingPeriods.filter((p) => `${p?.name}|${p?.startDate}|${p?.endDate}` !== periodKey),
    period,
  ];

  return {
    ...existingNotes,
    id: existingNotes.id || `saule_${row.no || normalizeText(row.clientName).slice(0, 20)}_${Date.now()}`,
    name: projectName,
    clientName: CLIENT_ALIASES[row.clientName] || row.clientName,
    client: {
      ...(existingNotes.client || {}),
      name: CLIENT_ALIASES[row.clientName] || row.clientName,
    },
    type: row.auditType,
    auditType: row.auditType,
    status: 'completed',
    completionPercent: 100,
    team,
    auditPeriods,
    contract: {
      ...(existingNotes.contract || {}),
      serviceStartDate: existingNotes.contract?.serviceStartDate || period.startDate,
      serviceEndDate: existingNotes.contract?.serviceEndDate || (row.reportDate || period.endDate),
      amountWithoutVAT: Number(existingNotes.contract?.amountWithoutVAT || 0),
      currency: existingNotes.contract?.currency || 'KZT',
    },
    sauleLedgerImport: {
      marker: MARKER,
      sourceFile: path.basename(INPUT),
      sourceRowNo: row.no,
      sourceSheet: row.sourceSheet,
      clientName: row.clientName,
      periodRaw: row.periodRaw,
      auditType: row.auditType,
      reportDate: row.reportDate,
      reportDateRaw: row.reportDateRaw,
      externalPeople,
      note: row.note,
      appliedAt: new Date().toISOString(),
    },
    closedAt: existingNotes.closedAt || new Date().toISOString(),
    closedBy: existingNotes.closedBy || MARKER,
    closedReason: existingNotes.closedReason || 'saule ledger import',
    updated_at: new Date().toISOString(),
  };
}

function parseWorkbook() {
  const workbook = XLSX.readFile(INPUT, { cellDates: false, raw: true });
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: true });
    const headerIdx = grid.findIndex((row) => row.some((cell) => normalizeText(cell).includes('наименование клиента')));
    if (headerIdx < 0) continue;
    for (const rawRow of grid.slice(headerIdx + 1)) {
      const no = compact(rawRow[0]);
      const clientName = compact(rawRow[1]);
      const auditType = compact(rawRow[5]);
      if (!clientName && !auditType) continue;
      const periodRaw = compact(rawRow[4]);
      const reportDate = excelDateToISO(rawRow[6]);
      const partner = NAME_ALIASES[compact(rawRow[7])] || compact(rawRow[7]);
      rows.push({
        sourceSheet: sheetName,
        no,
        clientName,
        amountWithVAT: Number(rawRow[2] || 0),
        amountWithoutVAT: Number(rawRow[3] || 0),
        periodRaw,
        auditYear: parseAuditYear(periodRaw, auditType),
        auditType,
        reportDate,
        reportDateRaw: compact(rawRow[6]),
        partner,
        managers: parsePeople(rawRow[8]),
        team: parsePeople(rawRow[9]),
        note: compact(rawRow[10]),
      });
    }
  }
  return rows;
}

async function main() {
  const rows = parseWorkbook();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [projects, employees] = await Promise.all([
    readAll(supabase, 'projects', 'id,name,status,start_date,deadline,kpi_percentage,notes,updated_at'),
    readAll(supabase, 'employees', 'id,name,email,role,level'),
  ]);

  const employeeIndex = {
    employees,
    byName: new Map(employees.map((employee) => [normalizeText(employee.name), employee])),
  };

  const decisions = rows.map((row) => {
    const { members, external } = buildTeam(row, employeeIndex);
    const existingByMarker = projects.find((project) => {
      const notes = parseNotes(project.notes);
      return notes?.sauleLedgerImport?.marker === MARKER && String(notes?.sauleLedgerImport?.sourceRowNo || '') === String(row.no || '');
    });
    const match = existingByMarker
      ? { action: 'update_existing_marker', project: existingByMarker, ranked: [{ project: existingByMarker, score: 999 }] }
      : chooseMatch(row, projects);
    return {
      ...row,
      action: match.action,
      matchedProjectId: match.project?.id || null,
      matchedProjectIds: (match.projects || []).map((project) => project.id),
      matchedProjectName: match.project?.name || null,
      matchedProjectStatus: match.project?.status || null,
      candidates: (match.ranked || []).map((x) => ({
        id: x.project.id,
        name: x.project.name,
        status: x.project.status,
        score: x.score,
        directScore: x.directScore,
      })),
      teamMembers: members,
      externalPeople: external,
      targetProjectName: match.project?.name || makeProjectName(row),
    };
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'saule-ledger-import-report.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    marker: MARKER,
    commit: COMMIT,
    source: path.basename(INPUT),
    rows: decisions,
  }, null, 2), 'utf8');

  const sheetRows = decisions.map((d) => ({
    no: d.no,
    clientName: d.clientName,
    auditType: d.auditType,
    period: d.periodRaw,
    reportDate: d.reportDate || d.reportDateRaw,
    action: d.action,
    targetProjectName: d.targetProjectName,
    candidates: d.candidates.map((c) => `${c.score}:${c.status}:${c.name}`).join(' | '),
    team: d.teamMembers.map((m) => `${m.role}:${m.userName}`).join(', '),
    external: d.externalPeople.map((p) => `${p.role}:${p.name}`).join(', '),
  }));
  const reportWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(reportWorkbook, XLSX.utils.json_to_sheet(sheetRows), 'Import Plan');
  XLSX.writeFile(reportWorkbook, path.join(OUT_DIR, 'saule-ledger-import-plan.xlsx'));

  const summary = {
    source: path.basename(INPUT),
    rows: decisions.length,
    toUpdate: decisions.filter((d) => d.action.startsWith('update')).length,
    toCreate: decisions.filter((d) => d.action === 'create').length,
    externalPeople: [...new Set(decisions.flatMap((d) => d.externalPeople.map((p) => p.name)))].sort(),
    report: path.join(OUT_DIR, 'saule-ledger-import-plan.xlsx'),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!COMMIT) {
    console.log('\nDry-run only. Add --commit to write projects.');
    return;
  }

  let updated = 0;
  let created = 0;
  let failed = 0;
  for (const decision of decisions) {
    try {
      const targetProjects = (decision.matchedProjectIds || [])
        .map((id) => projects.find((p) => p.id === id))
        .filter(Boolean);
      const current = targetProjects[0] || null;
      const existingNotes = parseNotes(current?.notes);
      const team = mergeTeam(existingNotes.team, decision.teamMembers);
      const notes = buildNotes(decision, team, decision.externalPeople, existingNotes);
      const startDate = notes.contract?.serviceStartDate || `${decision.auditYear || 2024}-01-01`;
      const deadline = decision.reportDate || notes.contract?.serviceEndDate || `${decision.auditYear || 2024}-12-31`;

      if (targetProjects.length > 0) {
        for (const target of targetProjects) {
          const targetNotes = parseNotes(target.notes);
          const targetTeam = mergeTeam(targetNotes.team, decision.teamMembers);
          const targetNextNotes = buildNotes(decision, targetTeam, decision.externalPeople, targetNotes);
          const { error } = await supabase
            .from('projects')
            .update({
              name: target.name || targetNextNotes.name,
              status: 'completed',
              start_date: target.start_date || startDate,
              deadline,
              kpi_percentage: 100,
              notes: JSON.stringify(targetNextNotes),
              updated_at: new Date().toISOString(),
            })
            .eq('id', target.id);
          if (error) throw error;
          updated += 1;
        }
      } else {
        const { error } = await supabase.from('projects').insert({
          name: notes.name,
          status: 'completed',
          start_date: startDate,
          deadline,
          kpi_percentage: 100,
          notes: JSON.stringify(notes),
        });
        if (error) throw error;
        created += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`FAILED row ${decision.no} ${decision.clientName}: ${error.message}`);
    }
  }

  console.log(`\nCOMMIT DONE. Updated: ${updated}. Created: ${created}. Failed: ${failed}. Marker: ${MARKER}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
