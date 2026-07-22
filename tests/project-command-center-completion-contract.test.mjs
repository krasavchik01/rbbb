import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');
const pulseSource = fs.readFileSync(new URL('../src/components/projects/ProjectPortfolioPulse.tsx', import.meta.url), 'utf8');
const workloadSource = fs.readFileSync(new URL('../src/components/projects/ProjectWorkloadChart.tsx', import.meta.url), 'utf8');
const integritySource = fs.readFileSync(new URL('../src/components/projects/ProjectDataIntegrityDrawer.tsx', import.meta.url), 'utf8');
const permissionsSource = fs.readFileSync(new URL('../src/lib/projectCommandCenterPermissions.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../src/lib/supabaseDataStore.ts', import.meta.url), 'utf8');

test('CEO portfolio analytics layer is mounted above the smart table', () => {
  assert.match(pageSource, /<ProjectPortfolioPulse summary=\{summary\} onApplyView=\{applyPulseView\} \/>/);
  assert.match(pageSource, /<ProjectWorkloadChart items=\{workloadItems\} \/>/);
  assert.match(pulseSource, /CEO portfolio pulse/);
  assert.match(pulseSource, /Риски портфеля/);
  assert.match(pulseSource, /Таймшиты/);
  assert.match(workloadSource, /Загрузка команды по таймшитам/);
  assert.match(workloadSource, /approvedHours/);
  assert.match(workloadSource, /pendingHours/);
  assert.match(workloadSource, /activeProjects/);
});

test('historical data integrity drawer is read-only and preview-first', () => {
  assert.match(pageSource, /<ProjectDataIntegrityDrawer model=\{commandModel\} canRepair=\{canManageTeam \|\| canManageProjectStatus\} \/>/);
  assert.match(integritySource, /Это read-only проверка/);
  assert.match(integritySource, /Изменений без подтверждения: 0/);
  assert.match(integritySource, /Команды периодов и таймшиты: не изменяются/);
  assert.match(integritySource, /Bulk fix disabled until explicit approval/);
});

test('command center permissions are centralized for sensitive actions', () => {
  assert.match(pageSource, /projectCommandCenterCapabilities\(user\?\.role\)/);
  assert.match(permissionsSource, /const MONEY_ROLES = \['admin', 'ceo', 'procurement'\]/);
  assert.match(permissionsSource, /canCloseProjects: isExecutive/);
  assert.match(permissionsSource, /canEditPeriods: canManageTeam \|\| userRole === 'partner'/);
  assert.match(permissionsSource, /Only procurement, delegated deputy directors, CEO and admin can edit contract value/);
});

test('admin gets CEO-level command center plus date editing persistence', () => {
  assert.match(permissionsSource, /const EXECUTIVE_ROLES = \['ceo', 'admin'\]/);
  assert.match(pageSource, /user\?\.role === 'ceo' \|\| user\?\.role === 'admin' \? 'executive' : 'operations'/);
  assert.match(pageSource, /Изменить сроки/);
  assert.match(pageSource, /saveProjectDates/);
  assert.match(pageSource, /serviceStartDate: projectDateDraft\.startDate/);
  assert.match(pageSource, /serviceEndDate: projectDateDraft\.deadline/);
  assert.match(storeSource, /projectUpdatePayload\.start_date = nextStartDate/);
  assert.match(storeSource, /projectUpdatePayload\.deadline = nextDeadline/);
});
