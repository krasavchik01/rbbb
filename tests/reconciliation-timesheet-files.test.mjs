import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanExpectedEmployeeName,
  compareFingerprintSets,
  parseSheetRows,
} from '../scripts/reconciliation/timesheet-files.mjs';

test('cleans duplicate suffix from employee workbook names', () => {
  assert.equal(cleanExpectedEmployeeName('Бадамбаева Сауле(1).xlsx'), 'Бадамбаева Сауле');
});

test('parses a timesheet matrix from a discovered header', () => {
  const rows = parseSheetRows([
    ['Табель'],
    ['Сотрудник', 'Дата', 'Проект', 'Часы', 'Примечание'],
    ['Аманов Онгар', 45589, 'ТОО «FinQ»', 8, 'Проверка'],
  ], { employeeId: 'e1', expectedEmployeeName: 'Аманов Онгар', sheetName: 'Time Sheet' });
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { workDate: rows[0].workDate, hours: rows[0].hours, projectName: rows[0].projectName },
    { workDate: '2024-10-24', hours: 8, projectName: 'ТОО «FinQ»' },
  );
});

test('uses the historical eight-hour rule for blank partner hours', () => {
  const rows = parseSheetRows([
    ['Сотрудник', 'Дата', 'Проект', 'Часы'],
    ['Бадамбаева Сауле', 45589, 'ТОО «FinQ»', 0],
  ], { employeeId: 'e2', expectedEmployeeName: 'Бадамбаева Сауле', sheetName: 'Time Sheet' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hours, 8);
  assert.equal(rows[0].hoursInferred, true);
});

test('compares fingerprint collections without treating names as proof', () => {
  const result = compareFingerprintSets(new Set(['a', 'b']), new Set(['b', 'c']));
  assert.deepEqual(result, { matched: 1, sourceOnly: ['a'], liveOnly: ['c'] });
});

test('preserves duplicate fingerprint multiplicity', () => {
  const result = compareFingerprintSets(['a', 'a', 'b'], ['a', 'b', 'b']);
  assert.equal(result.matched, 2);
  assert.deepEqual(result.sourceOnly, ['a']);
  assert.deepEqual(result.liveOnly, ['b']);
});
