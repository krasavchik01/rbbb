#!/usr/bin/env node
/**
 * Массовое подтверждение всех submitted-таймщитов от имени ген.директора.
 *
 * Цель: показать, что период закрыт — все часы утверждены. Ген.дир может
 * потом править/отзывать через UI отдельные строки (роль 'ceo'/'admin'
 * имеет полный доступ к /timesheet-approval).
 *
 * Маркер для возможного отката:
 *   reviewed_by_name = 'Ген.директор — закрытие периода'
 *   reviewer_notes   = 'Массовое подтверждение от ген.директора (YYYY-MM-DD)'
 *
 * Использование:
 *   node scripts/approve-all-submitted-by-ceo.mjs           # dry-run
 *   node scripts/approve-all-submitted-by-ceo.mjs --commit  # реально
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const REVIEWER_NAME = 'Ген.директор — закрытие периода';
const TODAY = '2026-05-29';
const REVIEWER_NOTES = `Массовое подтверждение от ген.директора (${TODAY})`;

const COMMIT = process.argv.includes('--commit');

async function readSubmitted(sb) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('id,hours,work_date')
      .eq('status', 'submitted')
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

  const rows = await readSubmitted(sb);
  const totalHours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const byMonth = {};
  for (const r of rows) {
    const m = (r.work_date || '').slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { c: 0, h: 0 };
    byMonth[m].c++;
    byMonth[m].h += Number(r.hours) || 0;
  }

  console.log(`Найдено submitted: ${rows.length} строк, ${totalHours.toFixed(1)} ч`);
  console.log('По месяцам:');
  Object.entries(byMonth).sort().forEach(([m, v]) =>
    console.log(`  ${m}  ${String(v.c).padStart(5)} строк  ${v.h.toFixed(1).padStart(8)} ч`),
  );

  if (!COMMIT) {
    console.log('\n(dry-run) Запусти с --commit чтобы подтвердить.');
    return;
  }
  if (rows.length === 0) {
    console.log('Нечего подтверждать.');
    return;
  }

  console.log('\n=== COMMIT MODE ===');
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
    .eq('status', 'submitted')
    .select('id');
  if (error) {
    console.error('UPDATE failed:', error.message);
    process.exit(1);
  }
  console.log(`DONE. Подтверждено: ${data?.length || 0} строк.`);
  console.log(`\nRollback (по маркеру):`);
  console.log(`  UPDATE timesheet_entries SET status='submitted', reviewed_at=NULL,`);
  console.log(`         reviewed_by_name=NULL, reviewer_notes=NULL`);
  console.log(`  WHERE reviewer_notes = '${REVIEWER_NOTES.replace(/'/g, "''")}';`);
}

main().catch((e) => { console.error(e); process.exit(1); });
