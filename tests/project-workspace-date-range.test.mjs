import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/pages/ProjectWorkspace.tsx', 'utf8');

test('project workspace renders ranges in chronological order even when saved dates are reversed', () => {
  assert.match(source, /const dateRangeCell = \(leftValue: any, rightValue: any\): string => \{/);
  assert.match(source, /leftStamp !== null && rightStamp !== null && leftStamp > rightStamp/);
  assert.match(source, /return `\$\{dateCell\(rightValue\)\} — \$\{dateCell\(leftValue\)\}`;/);
  assert.match(source, /dateRangeCell\(normalizedStartDate \|\| normalizedContract\?\.serviceStartDate, normalizedDeadline \|\| normalizedContract\?\.serviceEndDate\)/);
  assert.match(source, /dateRangeCell\(stage\.startDate, stage\.endDate \|\| stage\.deadline\)/);
});
