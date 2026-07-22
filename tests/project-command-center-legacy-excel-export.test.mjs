import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');
const blueprint = fs.readFileSync(new URL('../docs/ceo-workbook-blueprint.md', import.meta.url), 'utf8');

const expectedHeaders = [
  'Проект / клиент',
  'Вид проекта',
  'Наша компания',
  'Договор',
  'Дата договора',
  'Предмет договора',
  'Срок оказания услуг',
  'Сумма без НДС',
  'Бонус %',
  'Итого бонусный пул',
  'Партнер',
  'Сумма партнера',
  'Руководитель проекта',
  'Сумма руководителя',
  'Супервайзер 3',
  'Сумма СВ3',
  'Налоговик 1',
  'Ассистент 1',
  'ГПХ / субподряд',
  'Сумма ГПХ',
  'Предрасход',
  'Итого бонусы',
  'Разница план/факт',
  'Итого расходы',
  'База после расходов',
  'Грязный доход',
];

test('CEO Excel export follows the legacy horizontal workbook matrix', () => {
  assert.match(pageSource, /const LEGACY_CEO_EXPORT_HEADERS = \[/);
  for (const header of expectedHeaders) assert.match(pageSource, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(pageSource, /Проект → сумма → бонусный пул → роли → ГПХ\/предрасход → доход/);
  assert.match(pageSource, /legacyTotalsRow\(rows\)/);
  assert.match(pageSource, /ИТОГО/);
});

test('CEO Excel export creates one total sheet and partner sheets', () => {
  assert.match(pageSource, /function buildLegacyCeoWorkbook\(XLSX: any, sourceRows: any\[\]\)/);
  assert.match(pageSource, /appendLegacyCeoSheet\(XLSX, workbook, 'ИТОГО', sourceRows\)/);
  assert.match(pageSource, /const byPartner = new Map<string, any\[\]>\(\)/);
  assert.match(pageSource, /legacyPartnerKeys\(row\)/);
  assert.match(pageSource, /legacyUniqueSheetName\(workbook, sheetName\)/);
});

test('CEO download path uses the legacy workbook while non-executive export remains available', () => {
  assert.match(pageSource, /if \(isExecutive && canSeeContractMoney\) \{/);
  assert.match(pageSource, /buildLegacyCeoWorkbook\(XLSX, filteredRows\)/);
  assert.match(pageSource, /ceo_legacy_partner_workbook_/);
  assert.match(pageSource, /buildProjectExportRows\(filteredRows, tableDetailLevel/);
});

test('legacy blueprint remains the acceptance contract for the export', () => {
  assert.match(blueprint, /Each project row presents:/);
  assert.match(blueprint, /Partner \+ amount/);
  assert.match(blueprint, /Project lead \+ amount/);
  assert.match(blueprint, /GPH \+ GPH amount/);
  assert.match(blueprint, /Gross income/);
});
