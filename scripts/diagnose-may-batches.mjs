/**
 * Какие именно import-пачки и от кого подгружены за май 2026.
 * Помогает понять — это один файл или несколько, и кто остался непокрытым.
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

const { data } = await sb
  .from('timesheet_entries')
  .select('import_batch_id, created_at, created_by, source, employee_name')
  .gte('work_date', '2026-05-01')
  .lte('work_date', '2026-05-31')
  .order('created_at', { ascending: false });

const byBatch = new Map();
for (const r of (data || [])) {
  const key = r.import_batch_id || `(manual:${r.source})`;
  let b = byBatch.get(key);
  if (!b) { b = { rows: 0, employees: new Set(), createdAt: r.created_at, createdBy: r.created_by, source: r.source }; byBatch.set(key, b); }
  b.rows++;
  b.employees.add(r.employee_name);
}
console.log('Пачки импорта за май 2026:');
for (const [k, v] of byBatch) {
  console.log(`  ${k.slice(0, 40).padEnd(40)} ${String(v.rows).padStart(4)} строк / ${v.employees.size} чел. / ${v.source} / ${v.createdAt?.slice(0,10)}`);
}

// Полный список людей с записями за май
const ppl = new Set();
for (const r of (data || [])) ppl.add(r.employee_name);
console.log(`\nВсего уникальных имён в записях за май: ${ppl.size}`);
console.log([...ppl].sort().join('\n  · '));

// Все сотрудники в БД, для сравнения
const { data: emps } = await sb.from('employees').select('id, name, role').order('name');
console.log(`\nВсего сотрудников в employees: ${emps.length}`);
const inMay = new Set([...ppl].map((n) => n?.trim().toLowerCase()));
const notInMay = emps.filter((e) => !inMay.has((e.name || '').trim().toLowerCase()));
console.log(`\nСотрудники, которых НЕТ в записях за май (${notInMay.length}):`);
for (const e of notInMay) console.log(`  ${e.name} (${e.role || '?'})`);
