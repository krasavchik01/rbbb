#!/usr/bin/env node
/**
 * Откат массового апрува 2024-2025: возвращаем все строки, утверждённые
 * скриптом approve-timesheets-2024-2025.mjs, обратно в статус 'submitted',
 * чтобы они снова попали в очередь «Утверждение часов» и партнёры могли
 * подтвердить их вручную через UI.
 *
 * Маркер: reviewed_by_name = 'Bulk approval 2024-2025'.
 * Параллельно чистим reviewed_at / reviewed_by_name / reviewer_notes / reviewed_by.
 *
 * Использование:
 *   node scripts/rollback-bulk-approval-to-submitted.mjs           # dry-run
 *   node scripts/rollback-bulk-approval-to-submitted.mjs --commit  # реально
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const MARKER = 'Bulk approval 2024-2025';
const COMMIT = process.argv.includes('--commit');

async function readAll(sb) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('id,status,hours,work_date,reviewed_by_name')
      .eq('reviewed_by_name', MARKER)
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

  console.log(`Маркер: reviewed_by_name = '${MARKER}'`);
  const rows = await readAll(sb);
  const totalHours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const dates = rows.map((r) => r.work_date).filter(Boolean).sort();
  console.log(`Найдено: ${rows.length} строк, ${totalHours.toFixed(1)} часов`);
  if (rows.length) console.log(`Даты: ${dates[0]} … ${dates[dates.length - 1]}`);

  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log('По текущему статусу:', byStatus);

  if (!COMMIT) {
    console.log('\n(dry-run) Re-run с --commit чтобы перевести их в submitted.');
    return;
  }
  if (rows.length === 0) {
    console.log('Нечего откатывать.');
    return;
  }

  console.log('\n=== COMMIT MODE ===');
  const { data, error } = await sb
    .from('timesheet_entries')
    .update({
      status: 'submitted',
      reviewed_at: null,
      reviewed_by: null,
      reviewed_by_name: null,
      reviewer_notes: null,
    })
    .eq('reviewed_by_name', MARKER)
    .select('id');
  if (error) {
    console.error('UPDATE failed:', error.message);
    process.exit(1);
  }
  console.log(`DONE. Откатили в submitted: ${data?.length || 0} строк.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
