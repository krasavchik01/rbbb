import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');
const filterSource = fs.readFileSync(new URL('../src/components/projects/CommandCenterColumnFilter.tsx', import.meta.url), 'utf8');

test('command center has Excel-like column filters attached to table headers', () => {
  assert.match(pageSource, /type ColumnFilterKey = 'company' \| 'project' \| 'service' \| 'period' \| 'status' \| 'money'/);
  assert.match(pageSource, /const \[columnFilters, setColumnFilters\] = useState<ColumnFilterState>/);
  assert.match(pageSource, /rowMatchesColumnFilters\(row, columnFilters, canSeeContractMoney\)/);
  assert.match(pageSource, /readInitialColumnFilters\(\)/);
  assert.match(pageSource, /syncCommandCenterUrl\(\{ search, columnFilters, viewFilter, deadlineFilter, periodFilter, auditPeriodTypeFilter, sortBy \}\)/);
  assert.match(pageSource, /<CommandCenterColumnFilter label="Проект \/ клиент"/);
  assert.match(pageSource, /<CommandCenterColumnFilter label="Вид услуги"/);
  assert.match(pageSource, /<CommandCenterColumnFilter label="Период \/ дедлайн"/);
  assert.match(pageSource, /<CommandCenterColumnFilter label="Статус \/ партнёр \/ руководитель"/);
  assert.match(pageSource, /<CommandCenterColumnFilter label="Сумма договора"/);
});

test('column filters compose as OR inside one column and AND across columns', () => {
  assert.match(pageSource, /split\(\/\[,;\|\\n\]\+\//);
  assert.match(pageSource, /tokens\.some\(\(token\) => normalized\.includes\(token\)\)/);
  assert.match(pageSource, /textColumnMatches\(row\.company, filters\.company\) &&/);
  assert.match(pageSource, /textColumnMatches\(`\$\{row\.name\} \$\{row\.client\}`, filters\.project\) &&/);
});

test('saved CEO views are available from the filter bar', () => {
  assert.match(pageSource, /CEO daily/);
  assert.match(pageSource, /Need contract data/);
  assert.match(pageSource, /At risk/);
  assert.match(pageSource, /My portfolio/);
});

test('column filter popover is a reusable table-header control', () => {
  assert.match(filterSource, /export function CommandCenterColumnFilter/);
  assert.match(filterSource, /aria-label=\{`Фильтр колонки: \$\{label\}`\}/);
  assert.match(filterSource, /OR внутри введённых слов, AND с другими колонками/);
});
