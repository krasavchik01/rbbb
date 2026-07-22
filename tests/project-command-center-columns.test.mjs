import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');
const filterSource = fs.readFileSync(new URL('../src/components/projects/CommandCenterColumnFilter.tsx', import.meta.url), 'utf8');

const expectedKeys = [
  'company',
  'project',
  'season',
  'contract',
  'subject',
  'service',
  'stage',
  'period',
  'partner',
  'leader',
  'status',
  'completeness',
  'money',
  'hours',
  'bonus',
];

test('command center column filter key list covers requested Excel-like fields', () => {
  assert.match(pageSource, /const COMMAND_CENTER_COLUMN_FILTER_KEYS = \[/);
  for (const key of expectedKeys) {
    assert.match(pageSource, new RegExp(`'${key}'`));
    assert.match(pageSource, new RegExp(`filters\\.${key}|columnFilters\\.${key}`));
  }
  assert.match(pageSource, /const EMPTY_COLUMN_FILTERS = COMMAND_CENTER_COLUMN_FILTER_KEYS\.reduce/);
  assert.match(pageSource, /readInitialColumnFilters\(\)/);
  assert.match(pageSource, /syncCommandCenterUrl\(\{ search, columnFilters, viewFilter, deadlineFilter, periodFilter, auditPeriodTypeFilter, sortBy \}\)/);
});

test('column filters compose as OR inside one column and AND across columns', () => {
  assert.match(pageSource, /split\(\/\[,;\|\\n\]\+\//);
  assert.match(pageSource, /tokens\.some\(\(token\) => normalized\.includes\(token\)\)/);
  assert.match(pageSource, /textColumnMatches\(row\.company, filters\.company\) &&/);
  assert.match(pageSource, /textColumnMatches\(`\$\{row\.name\} \$\{row\.client\}`, filters\.project\) &&/);
  assert.match(pageSource, /numberColumnMatches\(hourValue, filters\.hours\) &&/);
  assert.match(pageSource, /numberColumnMatches\(bonusValue, filters\.bonus\)/);
  assert.match(pageSource, /rowMatchesColumnFilters\(row, columnFilters, canSeeContractMoney, isExecutive\)/);
});

test('true saved views use localStorage rather than hardcoded pseudo-presets', () => {
  assert.match(pageSource, /COMMAND_CENTER_VIEW_STORAGE_KEY/);
  assert.match(pageSource, /type SavedCommandCenterView/);
  assert.match(pageSource, /window\.localStorage\.setItem\(COMMAND_CENTER_VIEW_STORAGE_KEY, JSON\.stringify\(views\)\)/);
  assert.match(pageSource, /const saveCurrentView = \(\) =>/);
  assert.match(pageSource, /const applySavedView = \(viewId: string\) =>/);
  assert.match(pageSource, /Сохранённые виды свода/);
  assert.match(pageSource, /Сохранить вид/);
  assert.doesNotMatch(pageSource, />\s*CEO daily\s*</);
  assert.doesNotMatch(pageSource, />\s*Need contract data\s*</);
  assert.doesNotMatch(pageSource, />\s*At risk\s*</);
  assert.doesNotMatch(pageSource, />\s*My portfolio\s*</);
});

test('column filter popover is a reusable table-header control', () => {
  assert.match(filterSource, /export function CommandCenterColumnFilter/);
  assert.match(filterSource, /aria-label=\{`Фильтр колонки: \$\{label\}`\}/);
  assert.match(filterSource, /OR внутри введённых слов, AND с другими колонками/);
  for (const label of ['Наша компания', 'Договор', 'Предмет договора', 'Этап', 'Бизнес-сезон', 'Партнёр', 'Руководитель', 'Полнота данных', 'Часы', 'Бонус']) {
    assert.match(pageSource, new RegExp(`label="${label}"`));
  }
});
