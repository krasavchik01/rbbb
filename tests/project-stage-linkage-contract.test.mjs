import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dataStoreSource = fs.readFileSync(new URL('../src/lib/supabaseDataStore.ts', import.meta.url), 'utf8');
const projectsSource = fs.readFileSync(new URL('../src/pages/Projects-simple.tsx', import.meta.url), 'utf8');

test('Supabase project mapper exposes stage and audit-period metadata from notes to legacy project UI', () => {
  assert.match(dataStoreSource, /stages\?: any\[\]/);
  assert.match(dataStoreSource, /auditPeriods\?: any\[\]/);
  assert.match(dataStoreSource, /stages: Array\.isArray\(notes\.stages\) \? notes\.stages : undefined/);
  assert.match(dataStoreSource, /auditPeriods: Array\.isArray\(notes\.auditPeriods\) \? notes\.auditPeriods : undefined/);
});

test('legacy procurement stage editor creates a primary audit period when all explicit stages are removed', () => {
  assert.match(projectsSource, /const sourceStages = stagesWithPeriods\.length > 0 \? stagesWithPeriods : \[\{/);
  assert.match(projectsSource, /name: 'Основной период'/);
  assert.match(projectsSource, /auditPeriodId: `ap_\$\{projectId\}_primary`/);
  assert.match(projectsSource, /const auditPeriods: AuditPeriod\[\] = sourceStages\.map/);
});

test('legacy procurement stage editor infers audit-period type from the saved date range and preserves period-level team overrides', () => {
  assert.match(projectsSource, /function auditPeriodTypeForRange\(startDate: string, endDate: string\)/);
  assert.match(projectsSource, /type: auditPeriodTypeForRange\(stage\.startDate \|\| defaultPeriodStart, stage\.endDate \|\| defaultPeriodEnd\)/);
  assert.match(projectsSource, /team: existing\?\.team/);
  assert.match(projectsSource, /teamSource: existing\?\.teamSource/);
  assert.doesNotMatch(projectsSource, /type: existing\?\.type \|\| 'custom'/);
});
