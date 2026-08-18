import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url), 'utf8');
const integritySource = fs.readFileSync(new URL('../src/components/projects/ProjectDataIntegrityDrawer.tsx', import.meta.url), 'utf8');
const inlineDetailSource = fs.readFileSync(new URL('../src/components/projects/ProjectInlineDetail.tsx', import.meta.url), 'utf8');
const permissionsSource = fs.readFileSync(new URL('../src/lib/projectCommandCenterPermissions.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../src/lib/supabaseDataStore.ts', import.meta.url), 'utf8');

test('CEO sees one directly editable unified row per project', () => {
  assert.match(pageSource, /aria-label="Единый свод проектов"/);
  assert.match(pageSource, /data-testid="project-ledger-row"/);
  assert.match(pageSource, /renderProjectInlineDetail\(row, false, true\)/);
  assert.match(pageSource, /onPick=\{\(employeeId\) => addTeamMember\(row, 'partner', employeeId\)\}/);
  assert.match(pageSource, /onPick=\{\(employeeId\) => addTeamMember\(row, 'project_leader', employeeId\)\}/);
  assert.match(inlineDetailSource, /label="Бонусный пул"/);
  assert.match(inlineDetailSource, /label="Итого бонусов"/);
  assert.match(inlineDetailSource, /label=\{overallocated \? 'Сверх пула' : 'Остаток'\}/);
  assert.match(pageSource, /Скачать Excel ИТОГО/);
});

test('portfolio totals live in the unified table header without separate dashboards', () => {
  assert.doesNotMatch(pageSource, /<ExecutivePortfolioOverview\b/);
  assert.doesNotMatch(pageSource, /<ExecutivePortfolioVisuals\b/);
  assert.doesNotMatch(pageSource, /<ProjectWorkloadChart\b/);
  assert.match(pageSource, /Проектов:[\s\S]{0,120}executiveSummary\.totalProjects/);
  assert.match(pageSource, /Договоры:[\s\S]{0,120}executiveSummary\.contractAmount/);
  assert.match(pageSource, /Бонусный пул:[\s\S]{0,120}executiveSummary\.plannedBonusPool/);
  assert.match(pageSource, /Выплачено:[\s\S]{0,120}executiveSummary\.paidFromRegistry/);
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
  assert.match(permissionsSource, /const PROJECT_DETAILS_EDITOR_ROLES = \['admin', 'admin_assistant', 'procurement'\]/);
  assert.match(permissionsSource, /const MONEY_ROLES = \['admin', 'ceo', 'procurement'\]/);
  assert.doesNotMatch(permissionsSource, /const MONEY_ROLES = \[[^\]]*admin_assistant/);
  assert.doesNotMatch(permissionsSource, /const EXECUTIVE_ROLES = \[[^\]]*admin_assistant/);
  assert.match(permissionsSource, /canCloseProjects: isExecutive/);
  assert.match(permissionsSource, /canEditPeriods: canManageTeam \|\| userRole === 'partner' \|\| userRole === 'procurement'/);
  assert.match(pageSource, /Редактировать проект/);
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
