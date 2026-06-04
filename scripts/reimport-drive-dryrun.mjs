/**
 * Прогон всех xlsx-файлов из tmp/timesheets-drive/ через тот же парсер,
 * что используется в /import-timesheet. Печатает dry-run отчёт.
 *
 * Ничего не пишет в БД. Только читает employees+projects и собирает
 * drafts. Использует --experimental-strip-types для импорта .ts-парсера.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Тянем парсер прямо из src/. Node 22.14 + --experimental-strip-types.
const { parseTimesheetFile, normalizeProjectName, matchEmployee } =
  await import('../src/lib/timesheetImport.ts');

/**
 * Override-таблица: имя из xlsx (как написано) → имя из employees (точно как в БД).
 * Применяется когда matchEmployee не справляется из-за латинизации, опечаток
 * или смены фамилии.
 *
 * Источник истины — текущий dry-run против БД, см. /scripts/import-timesheets.mjs
 * для известных случаев.
 */
const EMPLOYEE_OVERRIDES = {
  'Жорабеков Жанибек': 'Zhorabekov Zhanibek',     // в БД латиница
  'Марат Сагадат': 'Sagadat Marat',                // в БД латиница, перевёрнут
  'Ерланкызы Забира': 'Zabira Yerlankyzy',         // в БД латиница, перевёрнут
  'Боранбай Анара': 'Боранбай Анар',               // опечатка в xlsx (лишняя «а»)
  'Шардабекова Саия': 'Шардарбекова Саия Гамзатовна', // опечатка в xlsx
  'Тулепбергенова Мая': 'Кенжебек Мая Тельманкызы',   // смена фамилии (devорсе)
  'Хисамутдинова Альфира': 'Хиссамуддинова Альфира',  // опечатка в xlsx
  'Аида Жидебай': 'Жидебай Аида Қайратқызы',          // перевёрнут (xlsx vs БД)
};

const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

console.log('Загружаю employees и projects из Supabase…');
const employees = [];
{
  let cur = 0;
  for (;;) {
    const { data } = await sb.from('employees').select('id, name, role').order('id').range(cur, cur + 999);
    employees.push(...(data || []));
    if ((data || []).length < 1000) break;
    cur += 1000;
  }
}
console.log(`  employees: ${employees.length}`);

const projects = [];
{
  let cur = 0;
  for (;;) {
    const { data } = await sb.from('projects').select('id, name').order('id').range(cur, cur + 999);
    projects.push(...(data || []));
    if ((data || []).length < 1000) break;
    cur += 1000;
  }
}
console.log(`  projects: ${projects.length}`);

const DRIVE_DIR = path.resolve('tmp/timesheets-drive');
const INDEX_PATH = path.join(DRIVE_DIR, '_index.json');
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
console.log(`  Файлов в index: ${index.length}`);

const empList = employees.map((e) => ({ id: e.id, name: e.name, role: e.role }));
const projList = projects.map((p) => ({ id: p.id, name: p.name }));

// Сводный сбор
const allDrafts = [];
const perFile = [];
const unmatchedEmployees = new Map();
const unmatchedProjects = new Map();
const skippedZeroHours = new Map();

for (const item of index) {
  const filePath = path.join(DRIVE_DIR, `${item.id}.xlsx`);
  let buffer;
  try {
    buffer = readFileSync(filePath);
  } catch (err) {
    perFile.push({ id: item.id, title: item.title, status: 'no-file', error: err.message });
    continue;
  }
  let result;
  try {
    result = parseTimesheetFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), projList, empList);
  } catch (err) {
    perFile.push({ id: item.id, title: item.title, status: 'parse-error', error: err.message });
    continue;
  }

  // Для каждого сотрудника, найденного в файле — собираем drafts
  const fileDrafts = [];
  const projectIdByName = new Map();
  for (const emp of result.employees) {
    for (const pg of emp.projects) {
      if (!pg.matchedProjectId) continue;
      const key = normalizeProjectName(pg.projectName) || pg.projectName.toLowerCase();
      projectIdByName.set(key, pg.matchedProjectId);
    }
  }

  for (const emp of result.employees) {
    // Если matcher не нашёл — пробуем override (известные смены фамилий,
    // латинизация, опечатки). Override применяется к ИСХОДНОМУ имени из xlsx.
    if (!emp.matchedUserId) {
      const overrideTo = EMPLOYEE_OVERRIDES[emp.employee.trim()];
      if (overrideTo) {
        const m = matchEmployee(overrideTo, empList);
        if (m.id) {
          emp.matchedUserId = m.id;
          emp.matchedUserName = m.name;
          emp.matchedUserRole = m.role;
        }
      }
    }
    if (!emp.matchedUserId) {
      const cur = unmatchedEmployees.get(emp.employee) || { files: new Set(), rowsAcrossFiles: 0 };
      cur.files.add(item.title);
      cur.rowsAcrossFiles += emp.projects.reduce((s, p) => s + (p.rowsCount || 0), 0);
      unmatchedEmployees.set(emp.employee, cur);
      continue;
    }
    for (const r of result.rows) {
      if (r.employee !== emp.employee) continue;
      if (r.kind === 'absence') continue;
      if (!r.effectiveProject) continue;
      if (!r.isoDate) continue;
      if (!r.hours || r.hours === 0) {
        const cur = skippedZeroHours.get(emp.employee) || 0;
        skippedZeroHours.set(emp.employee, cur + 1);
        continue;
      }
      const nameKey = normalizeProjectName(r.effectiveProject) || r.effectiveProject.toLowerCase();
      const matchedProjectId =
        r.preMatchFromNotes?.id && !String(r.preMatchFromNotes.id).startsWith('self:')
          ? r.preMatchFromNotes.id
          : projectIdByName.get(nameKey) || null;
      if (!matchedProjectId) {
        const cur = unmatchedProjects.get(r.effectiveProject) || { rows: 0, employees: new Set() };
        cur.rows++;
        cur.employees.add(emp.matchedUserName || emp.employee);
        unmatchedProjects.set(r.effectiveProject, cur);
        continue;
      }
      fileDrafts.push({
        driveFileId: item.id,
        employeeId: emp.matchedUserId,
        employeeName: emp.matchedUserName || emp.employee,
        projectId: matchedProjectId,
        projectName: r.effectiveProject,
        workDate: r.isoDate,
        hours: r.hours,
        section: r.section || undefined,
        position: r.position || undefined,
        location: r.location || undefined,
        city: r.city || undefined,
        managerRaw: r.manager || undefined,
        partnerRaw: r.partner || undefined,
        notes: r.notes || undefined,
        source: 'import',
        status: 'submitted',
      });
    }
  }
  allDrafts.push(...fileDrafts);
  perFile.push({
    id: item.id,
    title: item.title,
    status: 'ok',
    rowsInFile: result.rows.length,
    employeesInFile: result.employees.length,
    matchedEmployees: result.employees.filter((e) => e.matchedUserId).length,
    draftsProduced: fileDrafts.length,
  });
}

// Итоги
console.log('\n=== ИТОГИ ===');
console.log(`Файлов обработано: ${perFile.length}`);
console.log(`  ok:          ${perFile.filter((x) => x.status === 'ok').length}`);
console.log(`  no-file:     ${perFile.filter((x) => x.status === 'no-file').length}`);
console.log(`  parse-error: ${perFile.filter((x) => x.status === 'parse-error').length}`);
console.log(`\nВсего drafts (готовых строк для INSERT): ${allDrafts.length}`);

// По месяцам
const byMonth = new Map();
for (const d of allDrafts) {
  const ym = (d.workDate || '').slice(0, 7);
  let m = byMonth.get(ym);
  if (!m) { m = { rows: 0, employees: new Set(), hours: 0 }; byMonth.set(ym, m); }
  m.rows++;
  m.employees.add(d.employeeId);
  m.hours += d.hours;
}
console.log('\nDrafts по месяцам:');
for (const ym of [...byMonth.keys()].sort()) {
  const m = byMonth.get(ym);
  console.log(`  ${ym}: ${String(m.rows).padStart(5)} строк / ${String(m.employees.size).padStart(3)} сотр. / ${m.hours.toFixed(0).padStart(6)} ч`);
}

// По сотрудникам
const byEmp = new Map();
for (const d of allDrafts) {
  let m = byEmp.get(d.employeeId);
  if (!m) { m = { name: d.employeeName, rows: 0, hours: 0, months: new Set() }; byEmp.set(d.employeeId, m); }
  m.rows++;
  m.hours += d.hours;
  m.months.add((d.workDate || '').slice(0, 7));
}
console.log(`\nDrafts по сотрудникам (${byEmp.size}):`);
for (const [id, m] of [...byEmp.entries()].sort((a, b) => b[1].rows - a[1].rows)) {
  console.log(`  ${m.name.padEnd(40)} ${String(m.rows).padStart(5)} строк / ${m.hours.toFixed(0).padStart(5)} ч / ${m.months.size} мес.`);
}

// Несматченные сотрудники
console.log(`\nФайлы с несматченными ФИО (имя в xlsx → нет в employees): ${unmatchedEmployees.size}`);
for (const [name, info] of unmatchedEmployees) {
  console.log(`  "${name}"  файл: ${[...info.files].join(', ')}  пропущено строк: ${info.rowsAcrossFiles}`);
}

// Несматченные проекты
console.log(`\nНесматченные проекты (название не нашлось в projects): ${unmatchedProjects.size}`);
const topUnmatched = [...unmatchedProjects.entries()]
  .sort((a, b) => b[1].rows - a[1].rows)
  .slice(0, 20);
for (const [name, info] of topUnmatched) {
  console.log(`  "${name.slice(0, 60)}"  ${info.rows} строк  (${[...info.employees].slice(0, 3).join(', ')}${info.employees.size > 3 ? '...' : ''})`);
}
if (unmatchedProjects.size > 20) console.log(`  …ещё ${unmatchedProjects.size - 20}`);

// Сравнение с тем что в БД сейчас
console.log('\n=== Сейчас в БД ===');
const { count: dbAll } = await sb.from('timesheet_entries').select('*', { count: 'exact', head: true });
console.log(`Всего timesheet_entries: ${dbAll}`);
const { count: dbBatch } = await sb.from('timesheet_entries').select('*', { count: 'exact', head: true }).eq('import_batch_id', '2026-05-27-drive-bulk');
console.log(`Из старой пачки 2026-05-27-drive-bulk: ${dbBatch}`);

// Сохраняем drafts для последующей записи
const outPath = path.resolve('tmp/reimport-drafts.json');
writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  drafts: allDrafts,
  perFile,
  unmatchedEmployees: [...unmatchedEmployees.entries()].map(([k, v]) => ({ name: k, files: [...v.files], rows: v.rowsAcrossFiles })),
  unmatchedProjects: [...unmatchedProjects.entries()].map(([k, v]) => ({ name: k, rows: v.rows, employees: [...v.employees] })),
}, null, 2));
console.log(`\nDrafts сохранены: ${outPath} (${(JSON.stringify({drafts:allDrafts}).length/1024).toFixed(0)} KB)`);
