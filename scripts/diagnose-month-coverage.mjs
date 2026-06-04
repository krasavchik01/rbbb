/**
 * Покрытие timesheet_entries по месяцам — сколько уникальных сотрудников
 * каждый месяц подал часы. Помогает понять: «много людей не попало в табель»
 * — это правда или они в другом месяце.
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

const FROM = '2026-01-01';
const TO = '2026-12-31';

async function fetchAll() {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('employee_id, employee_name, work_date, hours, source, status, import_batch_id, created_at')
      .gte('work_date', FROM)
      .lte('work_date', TO)
      .range(from, from + 999);
    if (error) { console.error(error); break; }
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
    from += 1000;
  }
  return out;
}

const entries = await fetchAll();
console.log(`Всего записей за ${FROM}..${TO}: ${entries.length}`);

// По месяцам
const byMonth = new Map(); // 'YYYY-MM' → { rows, employees:Set, sources:Set, batches:Set }
for (const e of entries) {
  const ym = (e.work_date || '').slice(0, 7);
  let m = byMonth.get(ym);
  if (!m) { m = { rows: 0, employees: new Set(), sources: new Map(), batches: new Set(), totalHours: 0 }; byMonth.set(ym, m); }
  m.rows++;
  m.totalHours += Number(e.hours || 0);
  if (e.employee_id) m.employees.add(e.employee_id);
  m.sources.set(e.source, (m.sources.get(e.source) || 0) + 1);
  if (e.import_batch_id) m.batches.add(e.import_batch_id);
}
console.log('\nПо месяцам:');
console.log('месяц       | строк | сотрудн | часов  | источники         | импорт-пачек');
for (const ym of [...byMonth.keys()].sort()) {
  const m = byMonth.get(ym);
  const src = [...m.sources].map(([k,v]) => `${k}:${v}`).join(' ');
  console.log(`  ${ym}    | ${String(m.rows).padStart(5)} | ${String(m.employees.size).padStart(7)} | ${m.totalHours.toFixed(0).padStart(6)} | ${src.padEnd(20)} | ${m.batches.size}`);
}

// Когда создавались записи за май (created_at) — может быть, импорт прошёл недавно?
const may = entries.filter((e) => e.work_date?.startsWith('2026-05'));
console.log(`\nДля мая 2026 (${may.length} записей):`);
const createdMonths = new Map();
for (const e of may) {
  const cm = (e.created_at || '').slice(0, 10);
  createdMonths.set(cm, (createdMonths.get(cm) || 0) + 1);
}
console.log('  Когда заведены в БД (created_at):');
for (const k of [...createdMonths.keys()].sort()) {
  console.log(`    ${k}: ${createdMonths.get(k)}`);
}
console.log('  Источники май:');
const maySources = new Map();
for (const e of may) maySources.set(e.source, (maySources.get(e.source) || 0) + 1);
for (const [k,v] of maySources) console.log(`    ${k}: ${v}`);

// Список 15 сотрудников за май
console.log('\n15 сотрудников с записями за май 2026:');
const empMap = new Map();
for (const e of may) {
  let m = empMap.get(e.employee_id);
  if (!m) { m = { name: e.employee_name, rows: 0, hours: 0, sources: new Set() }; empMap.set(e.employee_id, m); }
  m.rows++;
  m.hours += Number(e.hours || 0);
  m.sources.add(e.source);
}
for (const [id, m] of [...empMap.entries()].sort((a,b) => b[1].hours - a[1].hours)) {
  console.log(`  ${m.name.padEnd(45)} ${String(m.rows).padStart(4)} строк / ${m.hours.toFixed(0).padStart(4)} ч / ${[...m.sources].join('+')}`);
}

// Сравнение: сколько всего активных сотрудников могут подавать часы
const { data: emps } = await sb.from('employees').select('id, name, role').limit(2000);
const everSubmittedIds = new Set();
{
  const { data: all } = await sb.from('timesheet_entries').select('employee_id').not('employee_id', 'is', null).limit(50000);
  for (const r of (all || [])) everSubmittedIds.add(r.employee_id);
}
console.log(`\nВ employees: ${emps.length} сотрудников`);
console.log(`Когда-либо подавали timesheet_entries: ${everSubmittedIds.size}`);

// Кто НЕ подавал за май, но подавал когда-то
const mayEmpIds = new Set([...empMap.keys()]);
const skippedMay = [...everSubmittedIds]
  .filter((id) => !mayEmpIds.has(id))
  .map((id) => emps.find((e) => e.id === id))
  .filter(Boolean);
console.log(`\nКогда-либо подавал, но не в мае: ${skippedMay.length} человек`);
console.log('Первые 30:');
for (const e of skippedMay.slice(0, 30)) {
  console.log(`  ${e.name} (${e.role || '?'})`);
}
