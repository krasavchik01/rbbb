/**
 * Запись новых drafts в БД + удаление старой пачки.
 *
 * Порядок (safe):
 *  1. INSERT новых строк с batch_id='2026-06-04-drive-bulk' чанками по 500
 *  2. Верификация: реально ли вставилось N строк
 *  3. DELETE WHERE import_batch_id='2026-05-27-drive-bulk'
 *  4. Финальная сверка
 *
 * Источник drafts: tmp/reimport-drafts.json (создан reimport-drive-dryrun.mjs).
 *
 * Manual записи Әспен Камиля (source='manual') НЕ затронуты — мы трогаем
 * только записи с конкретными import_batch_id.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

const OLD_BATCH = '2026-06-04-drive-bulk-v2';
const NEW_BATCH = '2026-06-04-drive-bulk-v3';

console.log('Загружаю drafts из tmp/reimport-drafts.json…');
const { drafts } = JSON.parse(readFileSync(path.resolve('tmp/reimport-drafts.json'), 'utf8'));
console.log(`  drafts: ${drafts.length}`);

// Pre-flight checks
const { count: oldBatchCount } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .eq('import_batch_id', OLD_BATCH);
console.log(`\nСейчас в старой пачке "${OLD_BATCH}": ${oldBatchCount} строк`);

const { count: newBatchAlreadyCount } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .eq('import_batch_id', NEW_BATCH);
console.log(`Сейчас в новой пачке "${NEW_BATCH}": ${newBatchAlreadyCount} строк (должно быть 0)`);
if (newBatchAlreadyCount > 0) {
  console.error('⚠️ Новая пачка УЖЕ существует. Прерываю — это либо повторный запуск, либо коллизия.');
  console.error('   Если хочешь перезалить — сначала DELETE FROM timesheet_entries WHERE import_batch_id=new.');
  process.exit(1);
}

// 1) INSERT chunks
console.log(`\n[1/3] INSERT ${drafts.length} строк чанками по 500…`);
const CHUNK = 500;
let inserted = 0;
const errors = [];
for (let i = 0; i < drafts.length; i += CHUNK) {
  const chunk = drafts.slice(i, i + CHUNK).map((d) => ({
    employee_id: d.employeeId,
    employee_name: d.employeeName,
    project_id: d.projectId,
    project_name: d.projectName,
    work_date: d.workDate,
    hours: d.hours,
    section: d.section ?? null,
    position: d.position ?? null,
    location: d.location ?? null,
    city: d.city ?? null,
    manager_raw: d.managerRaw ?? null,
    partner_raw: d.partnerRaw ?? null,
    notes: d.notes ?? null,
    source: d.source || 'import',
    status: d.status || 'submitted',
    import_batch_id: NEW_BATCH,
  }));
  const { data, error } = await sb.from('timesheet_entries').insert(chunk).select('id');
  if (error) {
    console.error(`  ⛔ chunk ${i}-${i + chunk.length - 1} FAIL:`, error.message);
    errors.push({ start: i, end: i + chunk.length - 1, error: error.message });
    continue;
  }
  inserted += (data || []).length;
  process.stdout.write(`  ${inserted}/${drafts.length}\r`);
}
console.log(`  Вставлено: ${inserted}/${drafts.length}`);
if (errors.length > 0) {
  console.error(`\n⛔ Были ошибки на ${errors.length} чанках. Прерываю — НЕ удаляю старую пачку.`);
  console.error('   Чтобы откатить вставку: DELETE FROM timesheet_entries WHERE import_batch_id=new.');
  for (const e of errors.slice(0, 3)) console.error('   ', e);
  process.exit(2);
}

// 2) Verify
console.log(`\n[2/3] Верификация…`);
const { count: postInsertCount } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .eq('import_batch_id', NEW_BATCH);
console.log(`  В новой пачке "${NEW_BATCH}": ${postInsertCount} строк (ожидали ${drafts.length})`);
if (postInsertCount !== drafts.length) {
  console.error(`  ⛔ Несовпадение! Прерываю, старую пачку НЕ удаляю.`);
  process.exit(3);
}

// 3) DELETE old batch in chunks (Supabase лимиты на DELETE большие, но
//    делаем чанками для прогресса).
console.log(`\n[3/3] DELETE старой пачки "${OLD_BATCH}" (${oldBatchCount} строк)…`);
// Удаляем одним запросом — у PostgREST нет лимита на DELETE rows, режется только SELECT
const { error: delErr, count: delCount } = await sb
  .from('timesheet_entries')
  .delete({ count: 'exact' })
  .eq('import_batch_id', OLD_BATCH);
if (delErr) {
  console.error(`  ⛔ DELETE FAIL:`, delErr.message);
  console.error(`  Состояние: новые ${postInsertCount} строк вставлены, старая пачка осталась.`);
  console.error(`  Сделай вручную: DELETE FROM timesheet_entries WHERE import_batch_id='${OLD_BATCH}';`);
  process.exit(4);
}
console.log(`  Удалено: ${delCount} строк`);

// Финальная сверка
const { count: finalTotal } = await sb.from('timesheet_entries').select('*', { count: 'exact', head: true });
const { count: finalMay } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .gte('work_date', '2026-05-01')
  .lte('work_date', '2026-05-31');
const { count: finalJun } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .gte('work_date', '2026-06-01')
  .lte('work_date', '2026-06-30');
console.log(`\n=== ГОТОВО ===`);
console.log(`Всего timesheet_entries: ${finalTotal}`);
console.log(`  Май 2026:  ${finalMay} строк`);
console.log(`  Июнь 2026: ${finalJun} строк`);
console.log(`Batch '${NEW_BATCH}' активен.`);
