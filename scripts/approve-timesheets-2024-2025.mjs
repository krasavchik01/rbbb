#!/usr/bin/env node
/**
 * Массовый апрув всех timesheet_entries за 2024-2025 годы.
 *
 * Логика: всё, что попадает в окно дат и НЕ в статусе 'rejected', получает
 * status='approved' с пометкой reviewed_by_name='Bulk approval 2024-2025'.
 *
 * Идея — закрыть исторический период разом, чтобы bonusCalculation (берёт
 * approved часы) увидел полную картину. Партнёры будут продолжать апрувить
 * новые часы (2026+) через UI.
 *
 * Использование: node scripts/approve-timesheets-2024-2025.mjs           # dry-run
 *                node scripts/approve-timesheets-2024-2025.mjs --commit  # реально
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const DATE_FROM = '2024-01-01';
const DATE_TO = '2025-12-31';
const REVIEWER_NAME = 'Bulk approval 2024-2025';
const REVIEWER_NOTES = 'Массовое подтверждение исторического периода 2024-2025.';

const COMMIT = process.argv.includes('--commit');

async function readAllStatusBreakdown(sb) {
  // Постраничный select только нужных полей — чтобы посчитать breakdown по
  // статусам в окне дат (PostgREST режет default до 1000).
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('id,status,hours,project_id')
      .gte('work_date', DATE_FROM)
      .lte('work_date', DATE_TO)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`Период: ${DATE_FROM} … ${DATE_TO}`);
  const rows = await readAllStatusBreakdown(sb);
  const byStatus = {};
  let totalHours = 0;
  let withProject = 0, withoutProject = 0;
  for (const r of rows) {
    const k = r.status || '(null)';
    if (!byStatus[k]) byStatus[k] = { count: 0, hours: 0 };
    byStatus[k].count++;
    byStatus[k].hours += Number(r.hours) || 0;
    totalHours += Number(r.hours) || 0;
    if (r.project_id) withProject++; else withoutProject++;
  }

  console.log(`Всего строк: ${rows.length}  /  Всего часов: ${totalHours.toFixed(1)}`);
  console.log(`С project_id: ${withProject}  /  Без project_id: ${withoutProject}`);
  console.log('\nРаспределение по текущему статусу:');
  Object.entries(byStatus).sort().forEach(([s, v]) => {
    console.log(`  ${s.padEnd(12)}  ${v.count.toString().padStart(6)} строк  ${v.hours.toFixed(1).padStart(8)} ч`);
  });

  const toApproveCount = rows.filter((r) => r.status !== 'approved' && r.status !== 'rejected').length;
  const toApproveHours = rows
    .filter((r) => r.status !== 'approved' && r.status !== 'rejected')
    .reduce((s, r) => s + (Number(r.hours) || 0), 0);
  console.log(`\nК апруву (не approved, не rejected): ${toApproveCount} строк, ${toApproveHours.toFixed(1)} ч`);

  if (!COMMIT) {
    console.log('\n(dry-run) Re-run с --commit для применения.');
    return;
  }
  if (toApproveCount === 0) {
    console.log('\nНечего апрувить.');
    return;
  }

  console.log('\n=== COMMIT MODE ===');
  // UPDATE одним запросом по фильтру (без предварительного списка id —
  // PostgREST с .in() ограничен длиной URL, а нас тут >1000 строк).
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('timesheet_entries')
    .update({
      status: 'approved',
      reviewed_by: null,
      reviewed_by_name: REVIEWER_NAME,
      reviewed_at: now,
      reviewer_notes: REVIEWER_NOTES,
    })
    .gte('work_date', DATE_FROM)
    .lte('work_date', DATE_TO)
    .neq('status', 'approved')
    .neq('status', 'rejected')
    .select('id');
  if (error) {
    console.error('UPDATE failed:', error.message);
    process.exit(1);
  }
  const updated = data?.length || 0;
  console.log(`DONE. Approved: ${updated} строк.`);
  console.log(`\nRollback (маркер уникален):`);
  console.log(`  UPDATE timesheet_entries SET status='submitted', reviewed_at=NULL, reviewed_by_name=NULL, reviewer_notes=NULL`);
  console.log(`  WHERE reviewer_notes = '${REVIEWER_NOTES.replace(/'/g, "''")}';`);
}

main().catch((e) => { console.error(e); process.exit(1); });
