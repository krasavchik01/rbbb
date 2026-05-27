#!/usr/bin/env node
/**
 * Миграция: подтянуть данные из timesheet_entries в projects.
 *
 * Делает четыре шага в одной транзакции (логически — physically applied step-by-step,
 * чтобы можно было прервать и продолжить):
 *
 *   A. Resolve admin/no-project rows — для timesheet_entries с project_id IS NULL,
 *      где в notes упомянуто реальное имя проекта, найти match в projects.
 *      UPDATE timesheet_entries SET project_id = X.
 *
 *   B. Create missing projects — имена проектов из timesheet_entries, для которых
 *      не нашлось карточки → INSERT в projects (status: closed если max(work_date)
 *      > 6 мес назад, иначе in_progress). Затем UPDATE timesheet_entries.
 *
 *   C. Period start/end — для каждого проекта min/max(work_date) →
 *      projects.start_date / due_date (только если они пустые;
 *      --overwrite-dates чтобы заменить).
 *
 *   D. Team[] дополнение — для каждого проекта собрать список сотрудников из часов,
 *      дополнить notes.team[]. Существующих не трогать (по userId).
 *      Роль берётся из employees.role/level через normalizeUserRole.
 *
 * По умолчанию — DRY-RUN. Пишет отчёт в tmp/timesheets-to-projects-report.txt
 * и полный snapshot в tmp/timesheets-to-projects.json.
 *
 * Для применения: node scripts/timesheets-to-projects.mjs --commit
 *
 * Можно ограничить шаги: --steps=A,B   или   --steps=C,D
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const OUT_DIR = path.resolve('tmp');
const OUT_JSON = path.resolve('tmp/timesheets-to-projects.json');
const OUT_REPORT = path.resolve('tmp/timesheets-to-projects-report.txt');

const ARGS = process.argv.slice(2);
const COMMIT = ARGS.includes('--commit');
const OVERWRITE_DATES = ARGS.includes('--overwrite-dates');
const STEPS = (() => {
  const arg = ARGS.find((a) => a.startsWith('--steps='));
  if (!arg) return new Set(['A', 'B', 'C', 'D']);
  return new Set(arg.slice('--steps='.length).split(',').map((s) => s.trim().toUpperCase()));
})();

// Порог «закрытый проект» — если max(work_date) старше → status='closed'.
const CLOSED_CUTOFF_DAYS = 180;
// Минимум часов на новый проект — отсекаем мусор от типографских ошибок.
const MIN_HOURS_FOR_NEW_PROJECT = 4;

// ─── Reused helpers (synced with scripts/import-timesheets.mjs) ─────────────

const norm = (s) => String(s || '').toLowerCase().replace(/[«»""''\-_().,:;]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length >= 2);

function classifyProject(projectRaw) {
  const s = String(projectRaw || '').trim();
  if (!s) return 'empty';
  if (/Административн/i.test(s)) return 'admin';
  if (/Без проекта/i.test(s)) return 'noproject';
  if (/Отсутств|Отпуск|больничн/i.test(s)) return 'absence';
  if (/^[-=*]{3,}/.test(s)) return 'sep';
  return 'project';
}

function buildProjectIndex(projects) {
  return projects
    .filter((p) => p.name)
    .map((p) => ({ id: p.id, name: p.name, status: p.status, normalized: norm(p.name), tokens: tokens(p.name) }));
}

function matchProject(text, projectIndex) {
  const t = norm(text);
  if (!t) return null;
  let best = projectIndex.find((p) => p.normalized === t);
  if (best) return best;
  best = projectIndex
    .filter((p) => p.normalized.length >= 10 && (t.includes(p.normalized) || p.normalized.includes(t)))
    .sort((a, b) => a.normalized.length - b.normalized.length)[0];
  if (best) return best;
  const textTokens = new Set(tokens(text));
  const scored = projectIndex
    .map((p) => {
      const matched = p.tokens.filter((tk) => textTokens.has(tk)).length;
      return { p, score: p.tokens.length > 0 ? matched / p.tokens.length : 0, matched };
    })
    .filter((x) => x.matched >= 2 && x.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.matched - a.matched);
  return scored[0]?.p || null;
}

// ─── Role mapping (mirrors src/types/roles.ts) ──────────────────────────────

const USER_ROLES = new Set([
  'ceo', 'deputy_director', 'company_director', 'procurement', 'partner', 'project_leader',
  'manager_1', 'manager_2', 'manager_3', 'supervisor_3', 'supervisor_2', 'supervisor_1',
  'tax_specialist_1', 'tax_specialist_2', 'assistant_3', 'assistant_2', 'assistant_1',
  'contractor', 'academy', 'hr', 'accountant', 'admin_staff', 'admin',
]);

const BONUS_PCT_BY_ROLE = {
  partner: 25, project_leader: 4,
  manager_1: 10, manager_2: 8, manager_3: 6,
  supervisor_3: 15, supervisor_2: 10, supervisor_1: 6,
  tax_specialist_1: 3, tax_specialist_2: 3,
  assistant_3: 4, assistant_2: 4, assistant_1: 2,
};

function normalizeLevel(level) {
  return (level === '2' || level === '3') ? level : '1';
}

function normalizeUserRole(role, level) {
  if (role && USER_ROLES.has(role)) return role;
  const lvl = normalizeLevel(level);
  switch (role) {
    case 'assistant':       return `assistant_${lvl}`;
    case 'manager':         return `manager_${lvl}`;
    case 'supervisor':      return `supervisor_${lvl}`;
    case 'tax_specialist':  return `tax_specialist_${lvl}`;
    case 'project_manager': return 'project_leader';
    case 'employee':        return 'assistant_1';
    case 'it_admin':        return 'admin';
    default:                return 'assistant_1';
  }
}

// ─── Supabase paginated readers ─────────────────────────────────────────────

async function readAll(sb, table, select) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`Read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ─── Notes JSON helpers ─────────────────────────────────────────────────────

function parseNotes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function stringifyNotes(obj) {
  return JSON.stringify(obj);
}

// ─── Steps ──────────────────────────────────────────────────────────────────

/**
 * Step A. Resolve admin/no-project rows — для строк с project_id IS NULL,
 * у которых в notes (поле с текстом) или project_name классифицировано как
 * admin/noproject, попробовать найти матч проекта через notes-текст.
 */
function stepA_resolveAdmin(entries, projectIndex) {
  const updates = [];     // { id, project_id, project_name }
  const stillNullSamples = {};   // employee_name → first 5 projects unresolved

  for (const e of entries) {
    if (e.project_id) continue;            // уже привязан
    const cls = classifyProject(e.project_name);
    if (cls === 'absence') continue;       // отпуск/больничный — не привязываем
    if (cls === 'project') {
      // у строки project_name выглядит как проект, но project_id NULL —
      // пробуем матчнуть прямо по project_name.
      const hit = matchProject(e.project_name, projectIndex);
      if (hit) {
        updates.push({ id: e.id, project_id: hit.id, project_name: hit.name, via: 'project_name' });
        continue;
      }
    }
    // admin / noproject / unmatched project — пробуем notes
    if (e.notes) {
      const hit = matchProject(e.notes, projectIndex);
      if (hit) {
        updates.push({ id: e.id, project_id: hit.id, project_name: hit.name, via: 'notes' });
        continue;
      }
    }
    // не вышло — собираем sample для отчёта
    const key = e.employee_name || '(unknown)';
    stillNullSamples[key] = stillNullSamples[key] || new Set();
    if (stillNullSamples[key].size < 5) stillNullSamples[key].add(e.project_name || '(empty)');
  }

  return { updates, stillNullSamples };
}

/**
 * Step B. Missing projects — собрать незавершённый список (после A) и
 * предложить создать. Группировка по resolved project_name.
 */
function stepB_missingProjects(entries, alreadyResolved) {
  // Apply A's resolutions virtually
  const resolved = new Map(alreadyResolved.map((u) => [u.id, u]));
  // Группа: project_name (после resolve) → { hours, rows, dateMin, dateMax, employees:Set }
  const byName = new Map();
  for (const e of entries) {
    const r = resolved.get(e.id);
    const project_id = r?.project_id || e.project_id;
    if (project_id) continue;     // привязан после A — не нуждается в создании
    const cls = classifyProject(e.project_name);
    if (cls !== 'project') continue;   // admin/noproject/absence не создаём как новые проекты
    const name = e.project_name.trim();
    if (!name) continue;
    let g = byName.get(name);
    if (!g) {
      g = { name, hours: 0, rows: 0, dateMin: e.work_date, dateMax: e.work_date, employees: new Set() };
      byName.set(name, g);
    }
    g.hours += Number(e.hours) || 0;
    g.rows++;
    if (e.work_date < g.dateMin) g.dateMin = e.work_date;
    if (e.work_date > g.dateMax) g.dateMax = e.work_date;
    if (e.employee_name) g.employees.add(e.employee_name);
  }

  const today = new Date();
  const cutoff = new Date(today.getTime() - CLOSED_CUTOFF_DAYS * 86400000).toISOString().slice(0, 10);
  const candidates = [];
  const skipped = [];
  for (const g of byName.values()) {
    const status = g.dateMax < cutoff ? 'closed' : 'in_progress';
    const row = {
      name: g.name,
      hours: g.hours,
      rows: g.rows,
      dateMin: g.dateMin,
      dateMax: g.dateMax,
      employees: [...g.employees],
      status,
    };
    if (g.hours < MIN_HOURS_FOR_NEW_PROJECT) skipped.push(row);
    else candidates.push(row);
  }
  candidates.sort((a, b) => b.hours - a.hours);
  return { candidates, skipped };
}

// В проде enum project_status содержит только 'active' и 'completed'.
function dbStatus(logicalStatus) {
  return logicalStatus === 'closed' ? 'completed' : 'active';
}

/**
 * Step C. Period start/end — посчитать min/max по project_id.
 */
function stepC_periods(entries, projects, resolutionMap, dateCols) {
  const byProject = new Map();
  for (const e of entries) {
    const pid = resolutionMap.get(e.id)?.project_id || e.project_id;
    if (!pid) continue;
    let g = byProject.get(pid);
    if (!g) { g = { dateMin: e.work_date, dateMax: e.work_date }; byProject.set(pid, g); }
    if (e.work_date < g.dateMin) g.dateMin = e.work_date;
    if (e.work_date > g.dateMax) g.dateMax = e.work_date;
  }
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const updates = [];   // { id, name, start_date?, due_date? }
  for (const [pid, g] of byProject) {
    const p = projectMap.get(pid);
    if (!p) continue;   // ещё не создан (case B)
    // start_date — реальная колонка; end_date — тоже (если есть). due_date
    // в нашей реальной БД нет, не пишем.
    const startCol = dateCols.HAS_START_DATE ? 'start_date' : null;
    const endCol = dateCols.HAS_END_DATE ? 'end_date' : (dateCols.HAS_DUE_DATE ? 'due_date' : null);
    const startNeeded = startCol && (OVERWRITE_DATES || !p[startCol]);
    const endNeeded = endCol && (OVERWRITE_DATES || !p[endCol]);
    if (!startNeeded && !endNeeded) continue;
    const u = { id: pid, name: p.name };
    if (startNeeded) u[startCol] = g.dateMin;
    if (endNeeded) u[endCol] = g.dateMax;
    updates.push(u);
  }
  return updates;
}

/**
 * Step D. Team[] — собрать (employee_id, hours, position) по проекту и
 * дополнить notes.team[]. Не трогаем existing.
 */
function stepD_team(entries, projects, employees, resolutionMap) {
  const empById = new Map(employees.map((e) => [e.id, e]));
  // GROUP BY project_id, employee_id
  const agg = new Map();    // pid → Map(empId → { hours, lastPosition })
  for (const e of entries) {
    const pid = resolutionMap.get(e.id)?.project_id || e.project_id;
    if (!pid) continue;
    if (!e.employee_id) continue;
    let bucket = agg.get(pid);
    if (!bucket) { bucket = new Map(); agg.set(pid, bucket); }
    let m = bucket.get(e.employee_id);
    if (!m) { m = { hours: 0, lastPosition: null }; bucket.set(e.employee_id, m); }
    m.hours += Number(e.hours) || 0;
    if (e.position) m.lastPosition = e.position;
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const updates = [];  // { id, name, addedMembers: [...], newNotes }
  for (const [pid, bucket] of agg) {
    const p = projectMap.get(pid);
    if (!p) continue;
    const notes = parseNotes(p.notes);
    const team = Array.isArray(notes.team) ? notes.team : [];
    const existingIds = new Set(team.map((m) => m?.userId || m?.id).filter(Boolean));
    const added = [];
    for (const [empId, m] of bucket) {
      if (existingIds.has(empId)) continue;
      const emp = empById.get(empId);
      if (!emp) continue;       // на случай удалённого
      const role = normalizeUserRole(emp.role, emp.level);
      const bonusPercent = BONUS_PCT_BY_ROLE[role] ?? 0;
      added.push({
        userId: empId,
        userName: emp.name,
        role,
        bonusPercent,
        assignedAt: new Date().toISOString(),
        assignedBy: 'timesheets-to-projects',
        hoursFromTimesheets: Math.round(m.hours * 100) / 100,
        positionFromTimesheets: m.lastPosition || null,
      });
    }
    if (added.length === 0) continue;
    const newNotes = { ...notes, team: [...team, ...added] };
    updates.push({ id: pid, name: p.name, addedMembers: added, newNotes });
  }
  return updates;
}

// ─── Commit appliers ────────────────────────────────────────────────────────

async function applyA(sb, updates) {
  console.log(`  [A] applying ${updates.length} timesheet_entries resolutions…`);
  let done = 0;
  for (const u of updates) {
    const { error } = await sb.from('timesheet_entries').update({
      project_id: u.project_id, project_name: u.project_name,
    }).eq('id', u.id);
    if (error) { console.error(`    failed for ${u.id}:`, error.message); continue; }
    done++;
    if (done % 100 === 0) process.stdout.write(`    ${done}/${updates.length}\r`);
  }
  console.log(`    done: ${done}/${updates.length}`);
}

async function applyB(sb, candidates, entries, resolutionMap, dateCols) {
  console.log(`  [B] creating ${candidates.length} projects…`);
  const created = [];
  for (const c of candidates) {
    const id = crypto.randomUUID();
    const notes = stringifyNotes({
      team: [],
      finances: {},
      contract: {},
      source: 'timesheets-to-projects',
      createdFromTimesheets: { hours: c.hours, rows: c.rows, employees: c.employees },
    });
    const insertRow = { id, name: c.name, status: dbStatus(c.status), notes };
    if (dateCols.HAS_CODE) insertRow.code = `TS-${id.slice(0, 8).toUpperCase()}`;
    if (dateCols.HAS_START_DATE) insertRow.start_date = c.dateMin;
    if (dateCols.HAS_END_DATE) insertRow.end_date = c.dateMax;
    else if (dateCols.HAS_DUE_DATE) insertRow.due_date = c.dateMax;
    if (dateCols.HAS_DEADLINE) insertRow.deadline = c.dateMax;   // NOT NULL в проде
    const { error } = await sb.from('projects').insert(insertRow);
    if (error) { console.error(`    failed for "${c.name}":`, error.message); continue; }
    created.push({ id, name: c.name });
    // Найти все timesheet_entries с этим project_name (которые после A всё ещё NULL) — привязать
    const toLink = entries.filter((e) => {
      if (resolutionMap.get(e.id)?.project_id) return false;
      if (e.project_id) return false;
      return e.project_name?.trim() === c.name && classifyProject(e.project_name) === 'project';
    });
    for (const e of toLink) {
      const { error: e2 } = await sb.from('timesheet_entries').update({
        project_id: id, project_name: c.name,
      }).eq('id', e.id);
      if (e2) console.error(`    failed to link entry ${e.id}:`, e2.message);
    }
  }
  console.log(`    created: ${created.length}/${candidates.length}`);
  return created;
}

async function applyC(sb, updates) {
  console.log(`  [C] setting period dates on ${updates.length} projects…`);
  let done = 0;
  for (const u of updates) {
    const { id, name, ...patch } = u;
    const { error } = await sb.from('projects').update(patch).eq('id', id);
    if (error) { console.error(`    failed for "${name}":`, error.message); continue; }
    done++;
  }
  console.log(`    done: ${done}/${updates.length}`);
}

async function applyD(sb, updates) {
  console.log(`  [D] extending team[] in ${updates.length} projects…`);
  let done = 0;
  for (const u of updates) {
    const { error } = await sb.from('projects').update({
      notes: stringifyNotes(u.newNotes),
    }).eq('id', u.id);
    if (error) { console.error(`    failed for "${u.name}":`, error.message); continue; }
    done++;
  }
  console.log(`    done: ${done}/${updates.length}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Loading employees / projects / timesheet_entries…');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const employees = await readAll(sb, 'employees', 'id,name,role,level');
  // projects: на старте берём всё, потом смотрим какие реально колонки есть
  // (в проде нет due_date — см. README). Чтобы не падать, читаем *.
  const projects = await readAll(sb, 'projects', '*');
  const entries = await readAll(sb, 'timesheet_entries', 'id,employee_id,employee_name,project_id,project_name,work_date,hours,position,section,notes,status,source');

  // Какие колонки реально присутствуют в `projects` (в проде часть из миграций
  // — code, due_date, end_date — может отсутствовать).
  const projectSample = projects[0] || {};
  const HAS_START_DATE = 'start_date' in projectSample;
  const HAS_DUE_DATE = 'due_date' in projectSample;
  const HAS_END_DATE = 'end_date' in projectSample;
  const HAS_CODE = 'code' in projectSample;
  const HAS_COMPANY_ID = 'company_id' in projectSample;
  const HAS_DEADLINE = 'deadline' in projectSample;
  console.log(`  columns: start_date=${HAS_START_DATE} due_date=${HAS_DUE_DATE} end_date=${HAS_END_DATE} deadline=${HAS_DEADLINE} code=${HAS_CODE} company_id=${HAS_COMPANY_ID}`);

  console.log(`Loaded: ${employees.length} employees, ${projects.length} projects, ${entries.length} timesheet_entries`);

  const projectIndex = buildProjectIndex(projects);

  // ── A
  let resolutionMap = new Map();
  let aReport = null;
  if (STEPS.has('A')) {
    console.log('\n[A] Resolve admin/no-project rows…');
    const { updates, stillNullSamples } = stepA_resolveAdmin(entries, projectIndex);
    aReport = { updates, stillNullSamples };
    resolutionMap = new Map(updates.map((u) => [u.id, u]));
    console.log(`  resolved: ${updates.length} entries`);
  }

  // ── B
  let bReport = null;
  if (STEPS.has('B')) {
    console.log('\n[B] Missing projects to create…');
    const { candidates, skipped } = stepB_missingProjects(entries, [...resolutionMap.values()]);
    bReport = { candidates, skipped };
    console.log(`  candidates: ${candidates.length} (skipped <${MIN_HOURS_FOR_NEW_PROJECT}h: ${skipped.length})`);
  }

  // ── C
  let cReport = null;
  if (STEPS.has('C')) {
    console.log('\n[C] Period start/end…');
    // На dry-run шаге C новые проекты ещё не существуют в `projects`, поэтому
    // его список будет считаться только по существующим. В commit это нормально:
    // C запускается ПОСЛЕ B и читает уже свежие projects при следующем запуске.
    const updates = stepC_periods(entries, projects, resolutionMap, { HAS_START_DATE, HAS_DUE_DATE, HAS_END_DATE });
    cReport = { updates };
    console.log(`  projects to update: ${updates.length}`);
  }

  // ── D
  let dReport = null;
  if (STEPS.has('D')) {
    console.log('\n[D] Team[] extensions…');
    const updates = stepD_team(entries, projects, employees, resolutionMap);
    dReport = { updates };
    const totalMembers = updates.reduce((s, u) => s + u.addedMembers.length, 0);
    console.log(`  projects to extend: ${updates.length} (+${totalMembers} members)`);
  }

  // ── Write reports
  const report = [];
  report.push('='.repeat(80));
  report.push(`TIMESHEETS → PROJECTS  (${COMMIT ? 'COMMIT' : 'DRY-RUN'})`);
  report.push('='.repeat(80));
  report.push(`employees=${employees.length}  projects=${projects.length}  timesheet_entries=${entries.length}`);
  report.push('');
  if (aReport) {
    report.push('--- [A] Resolve admin/no-project rows ---');
    report.push(`Resolved: ${aReport.updates.length}`);
    const byVia = {};
    aReport.updates.forEach((u) => { byVia[u.via] = (byVia[u.via] || 0) + 1; });
    Object.entries(byVia).forEach(([k, v]) => report.push(`  via ${k}: ${v}`));
    const unmatched = Object.entries(aReport.stillNullSamples).slice(0, 20);
    if (unmatched.length) {
      report.push(`Still unresolved samples (top 20 employees):`);
      unmatched.forEach(([emp, projects]) => {
        report.push(`  ${emp}: ${[...projects].join(' | ')}`);
      });
    }
    report.push('');
  }
  if (bReport) {
    report.push('--- [B] Missing projects to create ---');
    report.push(`Candidates: ${bReport.candidates.length}  (skipped <${MIN_HOURS_FOR_NEW_PROJECT}h: ${bReport.skipped.length})`);
    bReport.candidates.slice(0, 50).forEach((c) => {
      report.push(`  ${c.hours.toFixed(1).padStart(7)}h  ${c.rows.toString().padStart(4)} rows  ${c.status.padEnd(12)}  [${c.dateMin}..${c.dateMax}]  ${c.name.slice(0, 80)}`);
    });
    if (bReport.candidates.length > 50) report.push(`  … +${bReport.candidates.length - 50} more`);
    report.push('');
  }
  if (cReport) {
    report.push('--- [C] Period start/end ---');
    report.push(`Projects to update: ${cReport.updates.length}`);
    cReport.updates.slice(0, 30).forEach((u) => {
      const parts = [];
      for (const k of ['start_date', 'due_date', 'end_date']) {
        if (u[k]) parts.push(`${k}=${u[k]}`);
      }
      report.push(`  ${parts.join(' ').padEnd(32)}  ${u.name.slice(0, 70)}`);
    });
    if (cReport.updates.length > 30) report.push(`  … +${cReport.updates.length - 30} more`);
    report.push('');
  }
  if (dReport) {
    report.push('--- [D] Team[] extensions ---');
    const totalMembers = dReport.updates.reduce((s, u) => s + u.addedMembers.length, 0);
    report.push(`Projects extending: ${dReport.updates.length}  (+${totalMembers} members total)`);
    dReport.updates.slice(0, 20).forEach((u) => {
      const names = u.addedMembers.map((m) => `${m.userName}(${m.role}, ${m.hoursFromTimesheets}h)`).join(', ');
      report.push(`  ${u.name.slice(0, 60)}`);
      report.push(`    + ${names}`);
    });
    if (dReport.updates.length > 20) report.push(`  … +${dReport.updates.length - 20} more`);
    report.push('');
  }

  fs.writeFileSync(OUT_REPORT, report.join('\n'));
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    summary: {
      mode: COMMIT ? 'commit' : 'dry-run',
      steps: [...STEPS],
      employees: employees.length,
      projects: projects.length,
      entries: entries.length,
    },
    A: aReport, B: bReport, C: cReport, D: dReport,
  }, null, 2));
  console.log('\n' + report.join('\n'));
  console.log(`\nReports:\n  ${OUT_REPORT}\n  ${OUT_JSON}`);

  if (!COMMIT) {
    console.log('\n(dry-run) Re-run with --commit to apply changes.');
    return;
  }

  // ── COMMIT
  console.log('\n=== COMMIT MODE ===');
  if (STEPS.has('A') && aReport?.updates.length) await applyA(sb, aReport.updates);
  if (STEPS.has('B') && bReport?.candidates.length) await applyB(sb, bReport.candidates, entries, resolutionMap, { HAS_START_DATE, HAS_DUE_DATE, HAS_END_DATE, HAS_CODE, HAS_COMPANY_ID, HAS_DEADLINE });
  if (STEPS.has('C') && cReport?.updates.length) await applyC(sb, cReport.updates);
  if (STEPS.has('D') && dReport?.updates.length) await applyD(sb, dReport.updates);
  console.log('\nDONE.');
}

main().catch((e) => { console.error(e); process.exit(1); });
