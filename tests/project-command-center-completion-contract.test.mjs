import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');
const pulseSource = fs.readFileSync(new URL('../src/components/projects/ProjectPortfolioPulse.tsx', import.meta.url), 'utf8');
const executiveOverviewSource = fs.readFileSync(new URL('../src/components/projects/ExecutivePortfolioOverview.tsx', import.meta.url), 'utf8');
const executiveVisualsSource = fs.readFileSync(new URL('../src/components/projects/ExecutivePortfolioVisuals.tsx', import.meta.url), 'utf8');
const workloadSource = fs.readFileSync(new URL('../src/components/projects/ProjectWorkloadChart.tsx', import.meta.url), 'utf8');
const integritySource = fs.readFileSync(new URL('../src/components/projects/ProjectDataIntegrityDrawer.tsx', import.meta.url), 'utf8');
const inlineDetailSource = fs.readFileSync(new URL('../src/components/projects/ProjectInlineDetail.tsx', import.meta.url), 'utf8');
const permissionsSource = fs.readFileSync(new URL('../src/lib/projectCommandCenterPermissions.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../src/lib/supabaseDataStore.ts', import.meta.url), 'utf8');

test('CEO sees one compact editable project register before optional detail', () => {
  assert.match(pageSource, /aria-label="Общая CEO-таблица проектов"/);
  assert.match(pageSource, /Проект и договор/);
  assert.match(pageSource, /Партнёр \/ руководитель/);
  assert.match(pageSource, /Часы \/ сложность/);
  assert.match(pageSource, /workloadComplexity\(row\.hours\)/);
  assert.match(pageSource, /onPick=\{\(employeeId\) => addTeamMember\(row, 'partner', employeeId\)\}/);
  assert.match(pageSource, /onPick=\{\(employeeId\) => addTeamMember\(row, 'project_leader', employeeId\)\}/);
  assert.match(inlineDetailSource, /data-testid="project-advanced-toggle"/);
  assert.match(inlineDetailSource, /Ещё детали/);
  assert.match(pageSource, /advancedRows\[row\.id\] &&/);
  assert.match(pageSource, /Скачать Excel ИТОГО/);
});

test('CEO portfolio analytics layer is mounted above the smart table', () => {
  assert.match(pageSource, /<ExecutivePortfolioOverview[\s\S]*summary=\{executiveSummary\}[\s\S]*onApplyView=\{applyPulseView\}/);
  assert.match(pageSource, /<ExecutivePortfolioVisuals[\s\S]*summary=\{executiveSummary\}/);
  assert.match(pageSource, /<ProjectWorkloadChart[\s\S]*items=\{workloadItems\}/);
  assert.match(executiveOverviewSource, /Картина бизнеса/);
  assert.match(executiveOverviewSource, /Сначала риски и деньги/);
  assert.match(executiveOverviewSource, /Выплачено по реестру/);
  assert.match(executiveVisualsSource, /Путь бонусов/);
  assert.match(executiveVisualsSource, /Сроки активных проектов/);
  assert.match(pulseSource, /hoursLoading/);
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
  assert.match(pageSource, /Изменить сумму/);
  assert.match(pageSource, /Скачать договор:/);
  assert.match(pageSource, /saveContractAmount/);
  assert.match(pageSource, /amountWithoutVAT: amount/);
  assert.match(pageSource, /saveProjectDates/);
  assert.match(pageSource, /serviceStartDate: projectDateDraft\.startDate/);
  assert.match(pageSource, /serviceEndDate: projectDateDraft\.deadline/);
  assert.match(storeSource, /projectUpdatePayload\.start_date = nextStartDate/);
  assert.match(storeSource, /projectUpdatePayload\.deadline = nextDeadline/);
});
