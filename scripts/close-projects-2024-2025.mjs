#!/usr/bin/env node
/**
 * Закрыть проекты 2024-2025: status → 'completed' для проектов, у которых
 * все часы (approved) в 2024-2025, и нет ни одного часа в 2026+.
 *
 * Логика:
 *   1. Группируем timesheet_entries по project_id, статус='approved'.
 *   2. Для каждой группы считаем min/max(work_date).
 *   3. Закрываем только если max(work_date) ≤ '2025-12-31' (нет активности
 *      в 2026 году).
 *   4. Не трогаем проекты у которых уже status='completed'.
 *   5. В notes.closedAt помечаем дату массового закрытия — для отката.
 *
 * Использование: node scripts/close-projects-2024-2025.mjs           # dry-run
 *                node scripts/close-projects-2024-2025.mjs --commit  # реально
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const CUTOFF_DATE = '2025-12-31';
const MARKER = 'auto-closed-2024-2025';

const COMMIT = process.argv.includes('--commit');

async function readAll(sb, table, select, filters = (q) => q) {
  const rows = [];
  let from = 0;
  for (;;) {
    const q = filters(sb.from(table).select(select)).range(from, from + 999);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Loading projects + approved timesheet_entries…');

  const projects = await readAll(sb, 'projects', 'id,name,status,start_date,deadline,notes');
  const entries = await readAll(sb, 'timesheet_entries', 'project_id,work_date,hours,status',
    (q) => q.eq('status', 'approved').not('project_id', 'is', null));

  console.log(`Projects: ${projects.length}  /  Approved entries with project_id: ${entries.length}\n`);

  // GROUP BY project_id → { hours, dateMin, dateMax }
  const byProject = new Map();
  for (const e of entries) {
    let g = byProject.get(e.project_id);
    if (!g) { g = { hours: 0, dateMin: e.work_date, dateMax: e.work_date }; byProject.set(e.project_id, g); }
    g.hours += Number(e.hours) || 0;
    if (e.work_date < g.dateMin) g.dateMin = e.work_date;
    if (e.work_date > g.dateMax) g.dateMax = e.work_date;
  }

  const candidates = [];
  const skipReasons = { alreadyCompleted: 0, hasFuture: 0, noHours: 0 };
  for (const p of projects) {
    if (p.status === 'completed') { skipReasons.alreadyCompleted++; continue; }
    const g = byProject.get(p.id);
    if (!g) { skipReasons.noHours++; continue; }
    if (g.dateMax > CUTOFF_DATE) { skipReasons.hasFuture++; continue; }
    candidates.push({
      id: p.id, name: p.name, status: p.status,
      hours: g.hours, dateMin: g.dateMin, dateMax: g.dateMax,
      notes: p.notes,
    });
  }
  candidates.sort((a, b) => b.hours - a.hours);

  console.log(`К закрытию: ${candidates.length} проектов`);
  console.log(`Пропущено:`);
  console.log(`  уже completed:           ${skipReasons.alreadyCompleted}`);
  console.log(`  есть часы в 2026+:       ${skipReasons.hasFuture}`);
  console.log(`  нет approved часов:      ${skipReasons.noHours}`);

  console.log(`\nТоп 30 кандидатов (по часам):`);
  candidates.slice(0, 30).forEach((c) => {
    console.log(`  ${c.hours.toFixed(1).padStart(7)}ч  [${c.dateMin}..${c.dateMax}]  ${c.name.slice(0, 70)}`);
  });
  if (candidates.length > 30) console.log(`  … +${candidates.length - 30} more`);

  if (!COMMIT) {
    console.log('\n(dry-run) Re-run с --commit для применения.');
    return;
  }
  if (candidates.length === 0) {
    console.log('\nНечего закрывать.');
    return;
  }

  console.log('\n=== COMMIT MODE ===');
  const now = new Date().toISOString();
  let done = 0, failed = 0;
  for (const c of candidates) {
    // Записываем маркер в notes, чтобы откатить можно было выборочно
    // по `notes LIKE '%auto-closed-2024-2025%'`.
    let notesObj = {};
    try { notesObj = typeof c.notes === 'string' ? JSON.parse(c.notes) : (c.notes || {}); } catch { notesObj = {}; }
    notesObj.closedAt = now;
    notesObj.closedBy = MARKER;
    notesObj.closedReason = 'auto-close: проект 2024-2025, все часы в окне';
    const newNotes = JSON.stringify(notesObj);

    const { error } = await sb.from('projects').update({
      status: 'completed',
      notes: newNotes,
    }).eq('id', c.id);
    if (error) {
      failed++;
      console.error(`  failed ${c.name.slice(0, 50)}: ${error.message}`);
    } else {
      done++;
      if (done % 50 === 0) process.stdout.write(`  ${done}/${candidates.length}\r`);
    }
  }
  console.log(`\nDONE. Closed: ${done}  Failed: ${failed}`);
  console.log(`\nRollback (по маркеру):`);
  console.log(`  UPDATE projects SET status='active'`);
  console.log(`  WHERE notes::text LIKE '%"closedBy":"${MARKER}"%';`);
}

main().catch((e) => { console.error(e); process.exit(1); });
