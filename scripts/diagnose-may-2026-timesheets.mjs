/**
 * Диагностика: почему HR в /hr?tab=timesheet за май 2026 видит лишь ~15 строк,
 * хотя файлы импортировали по большему числу сотрудников.
 *
 * Проверяет:
 *  - сколько timesheet_entries за май 2026 в БД
 *  - сколько уникальных employee_id, по каким статусам и источникам
 *  - сколько из них реально мэтчится с таблицей employees (а сколько — «сироты»)
 *  - какие имена-сироты часто всплывают (топ-20)
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

const FROM = '2026-05-01';
const TO = '2026-05-31';

console.log(`\n=== Диагностика timesheet_entries ${FROM}..${TO} ===\n`);

// Сами записи — пагинируем (PostgREST режет на 1000)
async function fetchAll() {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('id, employee_id, employee_name, project_id, project_name, work_date, hours, status, source, import_batch_id, created_at')
      .gte('work_date', FROM)
      .lte('work_date', TO)
      .range(from, from + 999);
    if (error) {
      console.error('fetch err:', error);
      break;
    }
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
    from += 1000;
  }
  return out;
}

const entries = await fetchAll();
console.log(`Всего записей: ${entries.length}`);

// Уникальные employee_id
const uniqueIds = new Set(entries.map((e) => e.employee_id));
console.log(`Уникальных employee_id: ${uniqueIds.size}`);
console.log(`  Из них null: ${uniqueIds.has(null) ? 1 : 0}`);

// По статусам
const byStatus = new Map();
for (const e of entries) byStatus.set(e.status, (byStatus.get(e.status) || 0) + 1);
console.log('\nПо статусам:');
for (const [k, v] of byStatus) console.log(`  ${k}: ${v}`);

// По источникам
const bySource = new Map();
for (const e of entries) bySource.set(e.source, (bySource.get(e.source) || 0) + 1);
console.log('\nПо источникам:');
for (const [k, v] of bySource) console.log(`  ${k}: ${v}`);

// employees: загружаем всех (с пагинацией на всякий случай)
async function fetchEmployees() {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('employees').select('id, name').range(from, from + 999);
    if (error) { console.error('emp err:', error); break; }
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
    from += 1000;
  }
  return out;
}
const employees = await fetchEmployees();
console.log(`\nВсего employees в БД: ${employees.length}`);
const empIds = new Set(employees.map((e) => e.id));

// Уникальные employee_id из записей — мэтчатся ли они с employees?
const matched = [];
const orphan = [];
for (const id of uniqueIds) {
  if (id == null) continue;
  if (empIds.has(id)) matched.push(id);
  else orphan.push(id);
}
console.log(`Из ${uniqueIds.size} уникальных employee_id записей:`);
console.log(`  есть в employees: ${matched.length}`);
console.log(`  СИРОТ (нет в employees): ${orphan.length}`);

// По сиротам — какие имена и сколько часов
if (orphan.length > 0) {
  console.log('\nТоп-20 имён-сирот в timesheet_entries (employee_name + employee_id):');
  const nameByOrphanId = new Map();
  const hoursByOrphanId = new Map();
  const rowsByOrphanId = new Map();
  for (const e of entries) {
    if (!orphan.includes(e.employee_id)) continue;
    nameByOrphanId.set(e.employee_id, e.employee_name);
    hoursByOrphanId.set(e.employee_id, (hoursByOrphanId.get(e.employee_id) || 0) + Number(e.hours || 0));
    rowsByOrphanId.set(e.employee_id, (rowsByOrphanId.get(e.employee_id) || 0) + 1);
  }
  const sorted = orphan
    .map((id) => ({ id, name: nameByOrphanId.get(id), hours: hoursByOrphanId.get(id), rows: rowsByOrphanId.get(id) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);
  for (const o of sorted) {
    console.log(`  "${o.name}"  id=${o.id}  ${o.rows} строк / ${o.hours.toFixed(1)} ч`);
  }
}

// Сколько в видимом списке (имитация фронта visibleEmployees)
const visibleEmployeeIds = matched;
console.log(`\nИмитация /hr?tab=timesheet visibleEmployees: ${visibleEmployeeIds.length} строк`);
console.log(`Скрыто (сироты): ${orphan.length}, плюс null=${uniqueIds.has(null) ? entries.filter(e => e.employee_id == null).length : 0} строк`);
