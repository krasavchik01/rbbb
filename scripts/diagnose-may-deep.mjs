/**
 * Поиск конкретных людей в timesheet_entries по фамилии.
 * Запуск: node scripts/diagnose-may-deep.mjs "Галымжанов" "Жамбыл"
 *
 * Что покажет:
 *  - есть ли вообще в employees (по точному и нечёткому совпадению)
 *  - есть ли в timesheet_entries за май и за всё время
 *  - какой employee_id используется, совпадает ли с employees
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: node scripts/diagnose-may-deep.mjs "Фамилия1" "Фамилия2"');
  process.exit(1);
}

// Тянем всех employees (с пагинацией)
const employees = [];
{
  let cur = 0;
  for (;;) {
    const { data } = await sb.from('employees').select('id, name, role, level, email').order('id').range(cur, cur + 999);
    employees.push(...(data || []));
    if ((data || []).length < 1000) break;
    cur += 1000;
  }
}
console.log(`Загружено employees: ${employees.length}`);

for (const q of names) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Поиск: "${q}"`);
  console.log('='.repeat(80));

  // 1) В employees — по подстроке без учёта регистра
  const matchesEmp = employees.filter((e) => (e.name || '').toLowerCase().includes(q.toLowerCase()));
  console.log(`\nВ employees найдено: ${matchesEmp.length}`);
  for (const e of matchesEmp) {
    console.log(`  id=${e.id}  name="${e.name}"  role=${e.role}  level=${e.level}  email=${e.email}`);
  }

  // 2) В timesheet_entries — по подстроке имени (ilike)
  const { data: tsByName } = await sb
    .from('timesheet_entries')
    .select('id, employee_id, employee_name, work_date, project_name, hours, source, status, import_batch_id, created_at')
    .ilike('employee_name', `%${q}%`)
    .order('work_date');
  console.log(`\nЗаписей timesheet_entries (по подстроке имени): ${(tsByName || []).length}`);
  if (tsByName && tsByName.length > 0) {
    // По месяцу
    const byMonth = new Map();
    for (const r of tsByName) {
      const ym = (r.work_date || '').slice(0, 7);
      const k = `${ym} | ${r.source} | ${r.import_batch_id || '(manual)'}`;
      byMonth.set(k, (byMonth.get(k) || 0) + 1);
    }
    console.log('  По месяцам / источнику:');
    for (const [k, v] of [...byMonth.entries()].sort()) console.log(`    ${k}: ${v}`);

    // Первые/последние записи
    console.log(`\n  Первая запись: ${tsByName[0].work_date} "${tsByName[0].project_name}" ${tsByName[0].hours}ч`);
    console.log(`  Последняя запись: ${tsByName[tsByName.length-1].work_date} "${tsByName[tsByName.length-1].project_name}" ${tsByName[tsByName.length-1].hours}ч`);

    // Уникальные employee_id, которые используются
    const ids = [...new Set(tsByName.map((r) => r.employee_id))];
    console.log(`\n  Уникальных employee_id в этих записях: ${ids.length}`);
    for (const id of ids) {
      const emp = employees.find((e) => e.id === id);
      console.log(`    ${id}  →  ${emp ? `"${emp.name}" (${emp.role})` : 'НЕТ в employees'}`);
    }
  }

  // 3) Если есть совпадения в employees — проверим по employee_id всех записей
  if (matchesEmp.length > 0) {
    const empIds = matchesEmp.map((e) => e.id);
    const { data: tsById } = await sb
      .from('timesheet_entries')
      .select('id, employee_id, employee_name, work_date, source')
      .in('employee_id', empIds);
    console.log(`\nЗаписей по employee_id найденных людей (${empIds.length} id): ${(tsById || []).length}`);
    if (tsById && tsById.length > 0) {
      const byMonth = new Map();
      for (const r of tsById) {
        const ym = (r.work_date || '').slice(0, 7);
        byMonth.set(ym, (byMonth.get(ym) || 0) + 1);
      }
      for (const [k, v] of [...byMonth.entries()].sort()) console.log(`    ${k}: ${v} строк`);
    }
  }
}
