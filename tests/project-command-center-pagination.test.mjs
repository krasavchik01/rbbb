import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');

test('project command center renders a bounded page instead of every matching project', () => {
  assert.match(source, /const PROJECT_TABLE_PAGE_SIZES = \[25, 50\]/);
  assert.match(source, /filteredRows\.slice\(tablePageStart, tablePageEnd\)/);
  assert.match(source, /visibleRows\.map\(\(row\) =>/);
  assert.doesNotMatch(source, /filteredRows\.map\(\(row\) =>/);
});

test('pagination resets after filters change and clamps after data changes', () => {
  assert.match(source, /setTablePage\(1\);[\s\S]*search, companyFilter, partnerFilter/);
  assert.match(source, /setTablePage\(\(current\) => Math\.min\(current, tablePageCount\)\)/);
});

test('bulk actions and exports keep using all filtered rows', () => {
  assert.match(source, /filteredRows\.flatMap\(projectIdsForRow\)/);
  assert.match(source, /buildLegacyCeoWorkbook\(XLSX, filteredRows, paymentRegistrySummary\.byProject\)/);
  assert.match(source, /buildProjectExportRows\(filteredRows,\s*\{/);
});
