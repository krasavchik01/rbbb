/**
 * Диагностика парсера таймщитов на реальном файле.
 *
 * Запуск:
 *   node scripts/diagnose_timesheet.mjs "Бадамбаева Сауле(1).xlsx"
 *
 * Выводит:
 *  - найденные колонки (alias → индекс)
 *  - warnings парсера
 *  - сводку по сотрудникам и проектам
 *  - КАЖДУЮ исходную строку с расшифровкой: что распарсилось, что нет, почему
 *  - сырой дамп строк, которые попали в kind='admin' или absence
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Импортируем парсер из src/. Vite-алиас @ тут не нужен — относительный путь.
const parserPath = path.resolve('src/lib/timesheetImport.ts');

// Так как файл .ts, прогоняем через tsx-эквивалент. Проще — динамически
// собрать «скриптовую» версию: импортируем функции через свежий ts-compile.
// На практике в этом проекте Node 22+ и --experimental-strip-types работает.

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node scripts/diagnose_timesheet.mjs <file.xlsx>');
  process.exit(1);
}

const filePath = path.resolve(fileArg);
console.log(`\n=== Diagnose timesheet: ${filePath} ===\n`);

const buf = readFileSync(filePath);

// 1. Сырая структура книги
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
console.log('Sheets in file:', wb.SheetNames);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
console.log(`Total rows (incl header): ${arr.length}`);
console.log(`\nFirst 3 rows raw:`);
for (let i = 0; i < Math.min(3, arr.length); i++) {
  console.log(`  [${i}]`, JSON.stringify(arr[i]));
}

console.log('\nHeader row (row 0):');
console.log(arr[0]);

console.log('\nSample data rows (rows 1, 5, 10, 50, last):');
const sampleIdx = [1, 5, 10, 50, arr.length - 1].filter((i) => i > 0 && i < arr.length);
for (const i of sampleIdx) {
  console.log(`  [row ${i}]`, JSON.stringify(arr[i]));
}

// 2. Прогоняем через парсер.
// Так как parser в TS, импортируем через ts-loader (Node 22 strip-types).
const { parseTimesheetFile, parseDate, normalizeProjectName } = await import(
  '../src/lib/timesheetImport.ts'
);

// Пустой список проектов/сотрудников — увидим какие имена парсер выдал
// «as-is» из файла, чтобы сравнить с реальной базой.
const result = parseTimesheetFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), [], []);

console.log('\n=== Detected columns ===');
console.log(result.detectedColumns);

console.log('\n=== Warnings ===');
if (result.warnings.length === 0) console.log('  (none)');
else result.warnings.forEach((w) => console.log('  -', w));

console.log(`\n=== Employees: ${result.employees.length} ===`);
for (const emp of result.employees) {
  console.log(
    `\n• ${emp.employee} — total ${emp.totalProjectHours}h, admin ${emp.adminHours}h, absence ${emp.absenceDays}d, projects ${emp.projects.length}`,
  );
  for (const p of emp.projects) {
    console.log(
      `    - "${p.projectName}" — ${p.totalHours}h за ${p.uniqueDays}д ` +
        `(${p.rowsCount} зап.) [${p.periodFrom || '?'} → ${p.periodTo || '?'}] ` +
        `fromNotes=${p.fromNotes} sections=${p.sections.length} ` +
        `managers=[${p.managers.join(', ')}] partners=[${p.partners.join(', ')}]`,
    );
  }
}

// 3. Покажем уникальные значения проблемных колонок
const uniqProjects = new Set();
const uniqPositions = new Set();
const uniqSections = new Set();
const adminRows = [];
const absenceRows = [];
const datelessRows = [];

for (const r of result.rows) {
  uniqProjects.add(r.rawProject);
  if (r.position) uniqPositions.add(r.position);
  if (r.section) uniqSections.add(r.section);
  if (r.kind === 'admin') adminRows.push(r);
  if (r.kind === 'absence') absenceRows.push(r);
  if (!r.isoDate) datelessRows.push(r);
}

console.log(`\n=== Unique values in raw "Проект" column (${uniqProjects.size}) ===`);
for (const v of [...uniqProjects].sort()) {
  if (v) console.log('  ·', v);
}

console.log(`\n=== Unique positions (${uniqPositions.size}) ===`);
for (const v of [...uniqPositions].sort()) console.log('  ·', v);

console.log(`\n=== Unique sections (${uniqSections.size}) ===`);
for (const v of [...uniqSections].sort()) console.log('  ·', v);

console.log(`\n=== Admin rows (${adminRows.length}) — what's in notes ===`);
for (const r of adminRows.slice(0, 20)) {
  console.log(
    `  [row ${r.rowIndex}] date="${r.rawDate}"→${r.isoDate} hours=${r.hours} ` +
      `effectiveProject="${r.effectiveProject}" fromNotes=${r.fromNotes} ` +
      `notes="${r.notes.slice(0, 100)}"`,
  );
}
if (adminRows.length > 20) console.log(`  ... and ${adminRows.length - 20} more`);

console.log(`\n=== Absence rows (${absenceRows.length}) ===`);
for (const r of absenceRows.slice(0, 10)) {
  console.log(`  [row ${r.rowIndex}] date="${r.rawDate}"→${r.isoDate} rawProject="${r.rawProject}"`);
}

console.log(`\n=== Rows with UNPARSED date (${datelessRows.length}) ===`);
for (const r of datelessRows.slice(0, 10)) {
  console.log(`  [row ${r.rowIndex}] rawDate="${r.rawDate}" employee="${r.employee}" project="${r.rawProject}"`);
}

console.log('\n=== Done ===\n');
