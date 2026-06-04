/**
 * Точный счёт записей за май 2026 — три разных способа, чтобы убедиться,
 * что счёт стабилен и пагинация работает.
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

// 1) COUNT через head (без выгрузки данных)
const { count: countExact, error: err1 } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .gte('work_date', '2026-05-01')
  .lte('work_date', '2026-05-31');
if (err1) console.error(err1);
console.log(`[1] COUNT exact (head=true): ${countExact}`);

// 2) like '2026-05%'
const { count: countLike } = await sb
  .from('timesheet_entries')
  .select('*', { count: 'exact', head: true })
  .like('work_date', '2026-05%');
console.log(`[2] COUNT exact (like 2026-05%): ${countLike}`);

// 3) Полная пагинация
async function fetchAll() {
  const out = [];
  let cur = 0;
  for (;;) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('id, employee_id, employee_name, work_date, source')
      .like('work_date', '2026-05%')
      .order('work_date')
      .range(cur, cur + 999);
    if (error) { console.error(error); break; }
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
    cur += 1000;
  }
  return out;
}
const rows = await fetchAll();
console.log(`[3] Полная пагинация: ${rows.length}`);

const uniqIds = new Set(rows.map((r) => r.employee_id));
const uniqNames = new Set(rows.map((r) => r.employee_name));
console.log(`    Уникальных employee_id: ${uniqIds.size} (null=${uniqIds.has(null)})`);
console.log(`    Уникальных employee_name: ${uniqNames.size}`);

// Список имён
console.log('\nВсе employee_name за май:');
const byName = new Map();
for (const r of rows) {
  const k = r.employee_name || '(null)';
  let m = byName.get(k);
  if (!m) { m = { rows: 0, ids: new Set(), sources: new Set() }; byName.set(k, m); }
  m.rows++;
  m.ids.add(r.employee_id);
  m.sources.add(r.source);
}
for (const [name, m] of [...byName.entries()].sort()) {
  const ids = [...m.ids].map((x) => x?.slice(0, 8) || 'null').join(',');
  console.log(`  ${name.padEnd(45)} ${String(m.rows).padStart(4)}  src=${[...m.sources].join('+')}  ids=${ids}`);
}

// Дополнительно: какие даты используются (вдруг есть работающие 1 мая = праздник)
const byDate = new Map();
for (const r of rows) byDate.set(r.work_date, (byDate.get(r.work_date) || 0) + 1);
console.log(`\nДней с записями: ${byDate.size}`);
