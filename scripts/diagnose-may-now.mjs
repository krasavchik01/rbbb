/**
 * Прямо сейчас: ВСЕ employee_name с записями за май 2026.
 * Если в этом списке кого-то нет, кто, по словам пользователя, заполнил —
 * значит записи в БД и правда нет (загрузка не прошла).
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

// COUNT
const { count } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .gte('work_date', '2026-05-01')
  .lte('work_date', '2026-05-31');
console.log(`Записей в БД за май 2026 ПРЯМО СЕЙЧАС: ${count}`);

// Полная пагинация с .order — гарантированно стабильно
const rows = [];
let cur = 0;
for (;;) {
  const { data } = await sb
    .from('timesheet_entries')
    .select('id, employee_id, employee_name, work_date, source, status, created_at, import_batch_id')
    .gte('work_date', '2026-05-01')
    .lte('work_date', '2026-05-31')
    .order('id')
    .range(cur, cur + 999);
  rows.push(...(data || []));
  if ((data || []).length < 1000) break;
  cur += 1000;
}
console.log(`Выгружено через пагинацию: ${rows.length}`);

// Группировка по employee_name (как в xlsx-файле — текст, точно как его записали)
const byName = new Map();
for (const r of rows) {
  const k = r.employee_name || '(пустое имя)';
  let m = byName.get(k);
  if (!m) m = { rows: 0, hours: 0, ids: new Set(), sources: new Set(), batches: new Set(), latestCreated: null };
  byName.set(k, m);
  m.rows++;
  m.ids.add(r.employee_id);
  m.sources.add(r.source);
  if (r.import_batch_id) m.batches.add(r.import_batch_id);
  if (!m.latestCreated || r.created_at > m.latestCreated) m.latestCreated = r.created_at;
}

console.log(`\nУникальных employee_name: ${byName.size}\n`);
console.log('ВСЕ имена с записями за май 2026 (отсортировано по имени):');
console.log('─'.repeat(120));
const sortedNames = [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'));
for (const [name, m] of sortedNames) {
  const sources = [...m.sources].join('+');
  const batch = [...m.batches].map((b) => b.slice(0, 22)).join(', ') || '—';
  console.log(`  ${name.padEnd(42)} ${String(m.rows).padStart(3)} строк | src=${sources.padEnd(15)} | batch=${batch} | last=${m.latestCreated?.slice(0,16)}`);
}

// Дополнительно: подняли ли импорт-батчи свежее 2026-05-27?
const latestBatches = new Map();
const latestManual = { count: 0, latest: null };
for (const r of rows) {
  if (r.source === 'manual') {
    latestManual.count++;
    if (!latestManual.latest || r.created_at > latestManual.latest) latestManual.latest = r.created_at;
    continue;
  }
  const b = r.import_batch_id || '(no-batch)';
  let m = latestBatches.get(b);
  if (!m) m = { rows: 0, latest: null };
  latestBatches.set(b, m);
  m.rows++;
  if (!m.latest || r.created_at > m.latest) m.latest = r.created_at;
}
console.log(`\nИмпорт-пачки за май (отсортированы по дате):`);
const sortedBatches = [...latestBatches.entries()].sort((a, b) => (b[1].latest || '').localeCompare(a[1].latest || ''));
for (const [b, m] of sortedBatches) {
  console.log(`  ${b.padEnd(40)} ${m.rows} строк | последняя запись: ${m.latest?.slice(0,16)}`);
}
console.log(`\nРучных записей: ${latestManual.count}, последняя: ${latestManual.latest?.slice(0,16) || '—'}`);
