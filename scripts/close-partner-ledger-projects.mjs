#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const MARKER = 'auto:partner-ledger-close-2026-06-09';
const OUT_DIR = path.join(process.cwd(), 'reports', 'partner-ledger-close');
const COMMIT = process.argv.includes('--commit');
const AGGRESSIVE = process.argv.includes('--aggressive');
const FORCE_BEST = process.argv.includes('--force-best');
const FILE_ARGS = process.argv
  .filter((arg) => /\.(xlsx|xls)$/i.test(arg))
  .map((arg) => path.resolve(process.cwd(), arg));

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
  'Кенжекулов А.А.': 'Кенжекулов Адилжан',
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
  Нурхан: 'Галымжанов Нурхан',
  Аскар: 'Искаков Аскар',
  Куаныш: 'Мухашев Куаныш',
  Ермек: 'Ембердиев Ермек',
  Дана: 'Турлыгазина Дана',
  Сая: 'Шардарбекова Саия',
  Саида: 'Бекболова Саийда',
};

const CLIENT_ALIASES = {
  'КМГ-Аэро': 'КазМунайГаз Аэро',
  'КМГ Аэро': 'КазМунайГаз Аэро',
};

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
    .trim();
}

function tokenSet(value) {
  return normalizeText(value).split(' ').filter((x) => x.length >= 2);
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

function parseAuditYear(auditType) {
  const match = compact(auditType).match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function projectYears(name) {
  return [...compact(name).matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
}

function yearFitsProject(auditYear, projectName) {
  if (!auditYear) return true;
  const years = projectYears(projectName);
  if (years.length === 0) return true;
  if (years.includes(auditYear)) return true;
  if (years.length >= 2) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    return auditYear >= min && auditYear <= max;
  }
  return false;
}

function normalizeProjectTarget(clientName, auditType) {
  return normalizeText(`${clientName} ${auditType}`)
    .replace(/\b(тоо|ао|чк|частная|компания|ltd|llc|за|год|г)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreProject(row, project) {
  const clientSource = CLIENT_ALIASES[row.clientName] || row.clientName;
  const client = normalizeText(clientSource);
  const dbName = normalizeText(project.name);
  const target = normalizeProjectTarget(clientSource, row.auditType);
  let score = 0;

  if (dbName === target) score += 110;
  if (dbName.includes(target) || target.includes(dbName)) score += 80;
  if (client && dbName.includes(client)) score += 55;

  const clientTokens = tokenSet(clientSource).filter((t) => !['тоо', 'ао', 'чк', 'ltd'].includes(t));
  const hitTokens = clientTokens.filter((t) => dbName.includes(t)).length;
  if (clientTokens.length > 0) score += Math.round((hitTokens / clientTokens.length) * 35);

  if (row.auditYear) {
    if (yearFitsProject(row.auditYear, project.name)) score += 35;
    else score -= 55;
  }
  if (/пфо|6м|6 м|6месяц/i.test(row.auditType) && /пфо|промеж|6м|6 м|6 месяц/i.test(project.name)) score += 15;
  if (/аудит\s*фо/i.test(row.auditType) && /аудит|финансов/i.test(project.name)) score += 10;

  return score;
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
  if (/\(гпх\)/i.test(String(name || ''))) return null;
  const normalized = normalizeText(name);
  if (!normalized) return null;
  const exact = employeeIndex.byName.get(normalized);
  if (exact) return exact;
  const parts = normalized.split(' ').filter((x) => x.length > 2);
  const candidates = employeeIndex.employees.filter((e) => {
    const employeeName = normalizeText(e.name);
    return parts.every((part) => employeeName.includes(part));
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return candidates.find((e) => normalizeText(e.name).startsWith(parts[0])) || candidates[0];
  return null;
}

function buildTeam(row, employeeIndex) {
  const now = new Date().toISOString();
  const people = [
    { sourceName: row.partner, forcedRole: 'partner' },
    ...row.managers.map((sourceName) => ({ sourceName, forcedRole: 'project_leader' })),
    ...row.team.map((sourceName) => ({ sourceName, forcedRole: null })),
    ...row.tax.map((sourceName) => ({ sourceName, forcedRole: 'tax_specialist_1' })),
  ];
  const members = [];
  const external = [];
  const seen = new Set();

  for (const person of people) {
    const sourceName = compact(person.sourceName);
    if (!sourceName) continue;
    const employee = findEmployee(sourceName, employeeIndex);
    if (!employee) {
      external.push({ name: sourceName, role: person.forcedRole || 'external' });
      continue;
    }
    const role = person.forcedRole || normalizeRole(employee.role, employee.level);
    const key = `${employee.id}|${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({
      userId: employee.id,
      userName: employee.name || sourceName,
      role,
      bonusPercent: ROLE_BONUS[role] ?? 0,
      assignedAt: now,
      assignedBy: MARKER,
    });
  }

  return { members, external };
}

function parseLedgerWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: false });
    const headerIdx = grid.findIndex((r) => r.some((c) => normalizeText(c).includes('наименование клиента')));
    if (headerIdx < 0) continue;
    const headers = grid[headerIdx].map((h) => normalizeText(h));
    const col = (needle) => headers.findIndex((h) => h.includes(needle));
    const idx = {
      no: headers.findIndex((h) => h === '№' || h === 'no' || h === 'n'),
      client: col('наименование клиента'),
      audit: col('вид аудита'),
      period: col('период аудита'),
      partner: col('партнер'),
      manager: col('руководитель проекта'),
      team: col('состав группы'),
      tax: col('налоги'),
      note: col('примечание'),
    };
    if (idx.client < 0 || idx.audit < 0) continue;
    for (const r of grid.slice(headerIdx + 1)) {
      const clientName = compact(r[idx.client]);
      const auditType = compact(r[idx.audit]);
      if (!clientName && !auditType) continue;
      rows.push({
        sourceFile: path.basename(filePath),
        sourceSheet: sheetName,
        no: compact(r[idx.no]),
        clientName,
        auditType,
        auditYear: parseAuditYear(auditType),
        periodRaw: compact(r[idx.period]),
        partner: NAME_ALIASES[compact(r[idx.partner])] || compact(r[idx.partner]),
        managers: parsePeople(r[idx.manager]),
        team: parsePeople(r[idx.team]),
        tax: parsePeople(r[idx.tax]),
        note: compact(r[idx.note]),
      });
    }
  }
  return rows;
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

function parseNotes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function mergeTeam(existingTeam, newTeam) {
  const removeRoles = new Set(['partner', 'project_leader']);
  const merged = existingTeam.filter((m) => !removeRoles.has(m?.role));
  const keys = new Set(merged.map((m) => `${m.userId}|${m.role}`));
  for (const member of newTeam) {
    const key = `${member.userId}|${member.role}`;
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(member);
  }
  return merged;
}

function readAmountWithoutVAT(notes) {
  return (
    Number(notes?.contract?.amountWithoutVAT) ||
    Number(notes?.finances?.amountWithoutVAT) ||
    Number(notes?.amountWithoutVAT) ||
    Number(notes?.amount) ||
    0
  );
}

function calculateLedgerFinances(notes, team) {
  const existingFinances = notes?.finances || {};
  const amountWithoutVAT = readAmountWithoutVAT(notes);
  const preExpensePercent = existingFinances.preExpensePercent ?? 30;
  const preExpenseAmount = amountWithoutVAT * (preExpensePercent / 100);
  const contractors = Array.isArray(existingFinances.contractors) ? existingFinances.contractors : [];
  const totalContractorsAmount = contractors.reduce((sum, c) => sum + (Number(c?.amount) || 0), 0);
  const bonusBase = amountWithoutVAT - totalContractorsAmount - preExpenseAmount;
  const bonusPercent = existingFinances.bonusPercent || 10;
  const totalBonusAmount = bonusBase * (bonusPercent / 100);
  const existingTeamBonuses = existingFinances.teamBonuses || {};
  const teamBonuses = {};

  for (const member of team || []) {
    const userId = member?.userId || member?.id || member?.employeeId;
    if (!userId) continue;
    const existingBonus = existingTeamBonuses[userId] || {};
    const memberPercent = Number(member?.bonusPercent) || ROLE_BONUS[member?.role] || 0;
    const calculatedAmount = totalBonusAmount * (memberPercent / 100);
    const amount = existingBonus.manuallyAdjusted ? Number(existingBonus.amount) || 0 : calculatedAmount;
    const percent = existingBonus.manuallyAdjusted
      ? (totalBonusAmount > 0 ? Number(((amount / totalBonusAmount) * 100).toFixed(2)) : existingBonus.percent || memberPercent)
      : memberPercent;

    teamBonuses[userId] = {
      ...existingBonus,
      role: member.role,
      percent,
      amount,
      manuallyAdjusted: Boolean(existingBonus.manuallyAdjusted),
    };
  }

  const totalPaidBonuses = Object.values(teamBonuses).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalCosts = totalPaidBonuses + totalContractorsAmount + preExpenseAmount;
  const grossProfit = amountWithoutVAT - totalCosts;
  const profitMargin = amountWithoutVAT > 0 ? (grossProfit / amountWithoutVAT) * 100 : 0;

  return {
    ...existingFinances,
    amountWithoutVAT,
    preExpensePercent,
    preExpenseAmount,
    contractors,
    totalContractorsAmount,
    bonusBase,
    bonusPercent,
    totalBonusAmount,
    teamBonuses,
    totalPaidBonuses,
    totalCosts,
    grossProfit,
    profitMargin,
  };
}

async function main() {
  const files = FILE_ARGS.length > 0
    ? FILE_ARGS
    : (await fs.readdir(process.cwd()))
      .filter((f) => /^Проекты .*\.xlsx$/i.test(f))
      .map((f) => path.join(process.cwd(), f));

  if (files.length === 0) {
    throw new Error('Не найдено файлов реестра. Передай путь: node scripts/close-partner-ledger-projects.mjs "Проекты Кенжекулов.xlsx"');
  }

  const ledgerRows = files.flatMap(parseLedgerWorkbook);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [projects, employees] = await Promise.all([
    readAll(supabase, 'projects', 'id,name,status,start_date,deadline,notes,updated_at'),
    readAll(supabase, 'employees', 'id,name,email,role,level'),
  ]);

  const employeeIndex = {
    employees,
    byName: new Map(employees.map((e) => [normalizeText(e.name), e])),
  };

  const decisions = ledgerRows.map((row) => {
    const ranked = projects
      .map((project) => ({ project, score: scoreProject(row, project) }))
      .filter((x) => x.score >= (AGGRESSIVE ? 50 : 85))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const statusRank = (s) => (s === 'active' || s === 'in_progress' ? 3 : s === 'completed' || s === 'closed' ? 1 : 2);
        if (statusRank(b.project.status) !== statusRank(a.project.status)) return statusRank(b.project.status) - statusRank(a.project.status);
        return String(a.project.name || '').length - String(b.project.name || '').length;
      })
      .slice(0, 8);
    const bestScore = ranked[0]?.score || 0;
    const bestCandidates = ranked.filter((x) => x.score === bestScore);
    const team = buildTeam(row, employeeIndex);
    const safeToCommit = Boolean(ranked[0]) && bestScore >= 85 && bestCandidates.length === 1;
    const commitAllowed = FORCE_BEST
      ? Boolean(ranked[0]) && bestScore >= (AGGRESSIVE ? 50 : 85)
      : AGGRESSIVE
        ? Boolean(ranked[0]) && bestCandidates.length === 1
        : safeToCommit;
    return {
      ...row,
      matchScore: bestScore,
      matchStatus: !ranked[0] ? 'unmatched' : bestCandidates.length > 1 ? 'duplicate_candidates' : bestScore >= 105 ? 'high' : bestScore >= 85 ? 'medium' : 'low',
      commitAllowed,
      matchedProjectId: ranked[0]?.project.id || null,
      matchedProjectName: ranked[0]?.project.name || null,
      matchedProjectStatus: ranked[0]?.project.status || null,
      candidates: ranked.map((x) => ({
        id: x.project.id,
        name: x.project.name,
        status: x.project.status,
        score: x.score,
      })),
      teamMembers: team.members,
      externalPeople: team.external,
    };
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'partner-ledger-close-report.json');
  await fs.writeFile(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    marker: MARKER,
    commit: COMMIT,
    aggressive: AGGRESSIVE,
    forceBest: FORCE_BEST,
    files: files.map((f) => path.basename(f)),
    rows: decisions,
  }, null, 2), 'utf8');

  const wsRows = decisions.map((d) => ({
    sourceFile: d.sourceFile,
    no: d.no,
    clientName: d.clientName,
    auditType: d.auditType,
    period: d.periodRaw,
    matchStatus: d.matchStatus,
    matchScore: d.matchScore,
    commitAllowed: d.commitAllowed ? 'yes' : 'no',
    matchedProjectName: d.matchedProjectName || '',
    matchedProjectStatus: d.matchedProjectStatus || '',
    candidates: d.candidates.map((c) => `${c.score}:${c.status}:${c.name}`).join(' | '),
    teamMatched: d.teamMembers.map((m) => `${m.role}:${m.userName}`).join(', '),
    externalPeople: d.externalPeople.map((p) => `${p.role}:${p.name}`).join(', '),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(wsRows), 'Close Plan');
  const xlsxPath = path.join(OUT_DIR, 'partner-ledger-close-plan.xlsx');
  XLSX.writeFile(workbook, xlsxPath);

  const summary = {
    files: files.map((f) => path.basename(f)),
    ledgerRows: decisions.length,
    commitAllowed: decisions.filter((d) => d.commitAllowed).length,
    unmatched: decisions.filter((d) => d.matchStatus === 'unmatched').length,
    duplicateCandidates: decisions.filter((d) => d.matchStatus === 'duplicate_candidates').length,
    low: decisions.filter((d) => d.matchStatus === 'low').length,
    alreadyCompleted: decisions.filter((d) => ['completed', 'closed'].includes(d.matchedProjectStatus)).length,
    externalPeople: [...new Set(decisions.flatMap((d) => d.externalPeople.map((p) => p.name)))].sort(),
    reportJson: jsonPath,
    reportXlsx: xlsxPath,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!COMMIT) {
    console.log('\nDry-run only. Add --commit to update projects. Add --aggressive to allow lower-score single matches. Add --force-best to pick one best candidate from duplicate groups.');
    return;
  }

  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();
  for (const d of decisions.filter((x) => x.commitAllowed && x.matchedProjectId)) {
    const current = projects.find((p) => p.id === d.matchedProjectId);
    const notes = parseNotes(current?.notes);
    const existingTeam = Array.isArray(notes.team) ? notes.team : [];
    const team = mergeTeam(existingTeam, d.teamMembers);
    const nextNotes = {
      ...notes,
      team,
      finances: calculateLedgerFinances(notes, team),
      partnerLedgerClose: {
        marker: MARKER,
        sourceFile: d.sourceFile,
        sourceRowNo: d.no,
        clientName: d.clientName,
        auditType: d.auditType,
        periodRaw: d.periodRaw,
        externalPeople: d.externalPeople,
        appliedAt: now,
      },
      closedAt: notes.closedAt || now,
      closedBy: notes.closedBy || MARKER,
      closedReason: notes.closedReason || 'partner ledger: closed project',
      updated_at: now,
    };
    const { error } = await supabase
      .from('projects')
      .update({ status: 'completed', notes: JSON.stringify(nextNotes), updated_at: now })
      .eq('id', d.matchedProjectId);
    if (error) {
      failed += 1;
      console.error(`FAILED ${d.clientName}: ${error.message}`);
    } else {
      updated += 1;
    }
  }
  console.log(`\nCOMMIT DONE. Updated projects: ${updated}. Failed: ${failed}. Marker: ${MARKER}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
