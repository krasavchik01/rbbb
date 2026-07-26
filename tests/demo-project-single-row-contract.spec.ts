import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  DEMO_EMPLOYEE_IDS,
  DEMO_PROJECT_ID,
  demoProject,
  loginAsDemoRole,
  waitForDemoApp,
  type DemoNetworkJournal,
} from './helpers/demo-fixtures';

const SECOND_PROJECT_ID = 'demo-project-002';
const DETACHED_BONUS_EMPLOYEE_ID = 'demo-detached-bonus';
const EXTRA_EMPLOYEE = {
  id: 'demo-unassigned-accountant',
  name: 'Мария Свободный сотрудник',
  email: 'free.accountant@demo.invalid',
  role: 'accountant',
  level: '1',
  whatsapp: '+7 700 000 00 07',
  created_at: '2026-07-12T00:00:00.000Z',
  updated_at: '2026-07-12T00:00:00.000Z',
};
const DETACHED_BONUS_EMPLOYEE = {
  id: DETACHED_BONUS_EMPLOYEE_ID,
  name: 'Сохранённый Бонус',
  email: 'detached.bonus@demo.invalid',
  role: 'assistant',
  level: '1',
  whatsapp: '+7 700 000 00 08',
  created_at: '2026-07-12T00:00:00.000Z',
  updated_at: '2026-07-12T00:00:00.000Z',
};

const DEMO_TEAM_LEDGER = [
  {
    id: DEMO_EMPLOYEE_IDS.partner,
    name: 'Демо Партнёр',
    role: 'Партнер',
    approvedHours: '0.0',
    bonusAmount: '840000',
  },
  {
    id: DEMO_EMPLOYEE_IDS.manager,
    name: 'Демо Менеджер',
    role: 'Менеджер 1',
    approvedHours: '6.0',
    bonusAmount: '336000',
  },
  {
    id: DEMO_EMPLOYEE_IDS.assistant,
    name: 'Демо Ассистент',
    role: 'Ассистент 1',
    approvedHours: '8.0',
    bonusAmount: '100800',
  },
] as const;

const employeeSearchPlaceholder = /Поиск по (?:имени|ФИО).*(?:почте|email).*роли/i;

type TeamMemberRecord = {
  id?: string;
  userId?: string;
  user_id?: string;
};

type ProjectNotesRecord = {
  team?: TeamMemberRecord[];
  companyId?: string;
  companyName?: string;
  company?: string;
  ourCompany?: string;
  finances: {
    teamBonuses: Record<string, { amount: number }>;
    totalPaidBonuses: number;
    bonusPoolOverrideAmount?: number;
    bonusPoolManuallyAdjusted?: boolean;
    totalBonusAmount?: number;
  };
};

function addSecondProjectWithSameBusinessFields(network: DemoNetworkJournal) {
  const duplicateBusinessProject = JSON.parse(JSON.stringify(demoProject)) as typeof demoProject;
  duplicateBusinessProject.id = SECOND_PROJECT_ID;
  duplicateBusinessProject.created_at = '2026-01-15T09:00:00.000Z';
  duplicateBusinessProject.updated_at = '2026-07-12T01:00:00.000Z';
  network.tableRows.projects.push(duplicateBusinessProject);
}

function addArchivedPeriodOutsideProjectDates(network: DemoNetworkJournal) {
  const project = network.tableRows.projects.find((item) => item.id === DEMO_PROJECT_ID);
  expect(project).toBeTruthy();
  const notes = JSON.parse(String(project?.notes || '{}'));
  notes.auditPeriods = [{
    id: 'archived-2017',
    name: 'Архив 2017',
    startDate: '2017-01-01',
    endDate: '2017-12-31',
    deadline: '2017-12-31',
    team: [],
  }];
  project!.notes = JSON.stringify(notes);
}

function addProtectedDetachedBonus(network: DemoNetworkJournal) {
  network.tableRows.employees.push({ ...DETACHED_BONUS_EMPLOYEE });
  const project = network.tableRows.projects.find((item) => item.id === DEMO_PROJECT_ID);
  expect(project).toBeTruthy();
  const notes = JSON.parse(String(project?.notes || '{}'));
  notes.finances.teamBonuses[DETACHED_BONUS_EMPLOYEE_ID] = {
    employeeName: DETACHED_BONUS_EMPLOYEE.name,
    role: 'assistant_2',
    percent: 6.61,
    amount: 222_222,
    manuallyAdjusted: true,
  };
  project!.notes = JSON.stringify(notes);
}

function targetProjectPatches(network: DemoNetworkJournal) {
  return network.mutationRequests.filter((request) => {
    if (request.method !== 'PATCH' || !request.url.includes('/rest/v1/projects')) return false;
    return new URL(request.url).searchParams.get('id') === `eq.${DEMO_PROJECT_ID}`;
  });
}

function latestTargetNotes(network: DemoNetworkJournal) {
  const request = targetProjectPatches(network).at(-1);
  expect(request, 'expected a PATCH for the demo project').toBeTruthy();
  const payload = JSON.parse(request?.body || '{}') as { notes?: string | ProjectNotesRecord };
  return typeof payload.notes === 'string'
    ? JSON.parse(payload.notes) as ProjectNotesRecord
    : payload.notes as ProjectNotesRecord;
}

function teamMemberIds(notes: ProjectNotesRecord) {
  return (notes.team || []).map((member) => String(
    member.userId || member.user_id || member.id || '',
  ));
}

async function searchAndPick(page: Page, trigger: Locator, query: string, expectedName: string) {
  await trigger.click();
  const search = page.getByPlaceholder(employeeSearchPlaceholder).last();
  await expect(search).toBeVisible();
  await search.fill(query);
  const option = page.getByRole('option', { name: new RegExp(expectedName, 'i') }).last();
  await expect(option).toBeVisible();
  // Toasts deliberately stay visible long enough to be read and can overlap the
  // bottom of the picker on a short viewport. Keyboard selection is the same
  // supported user path and keeps this contract independent of toast placement.
  await option.press('Enter');
}

async function projectRow(page: Page) {
  const shell = page.getByTestId('project-summary-shell');
  await expect(shell).toBeVisible();
  const row = shell.locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
  await expect(row).toHaveCount(1);
  return row;
}

async function openProjectDetail(page: Page) {
  const row = await projectRow(page);
  const detail = row.getByTestId(`project-details-${DEMO_PROJECT_ID}`);
  if (!(await detail.isVisible())) {
    await row.getByRole('button', { name: /Открыть (?:свод|проект)/i }).click();
  }
  await expect(detail).toBeVisible();
  return detail;
}

async function expectEditableTeamLedger(detail: Locator) {
  const ledger = detail.getByTestId('project-team-ledger');
  await expect(ledger).toBeVisible();
  const memberRows = ledger.locator('[data-team-member-row="true"]');
  await expect(memberRows).toHaveCount(DEMO_TEAM_LEDGER.length);

  for (const employee of DEMO_TEAM_LEDGER) {
    const member = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${employee.id}`);
    await expect(member).toBeVisible();
    await expect(member).toContainText(employee.name);
    await expect(member).toContainText(employee.role);
    await expect(member).toContainText(`${employee.approvedHours} ч`);
    await expect(member.locator('input')).toHaveValue(employee.bonusAmount);
  }

  const geometry = await memberRows.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { top: Math.round(rect.top), width: Math.round(rect.width) };
  }));
  expect(new Set(geometry.map(({ top }) => top)).size).toBe(DEMO_TEAM_LEDGER.length);
  expect(Math.min(...geometry.map(({ width }) => width))).toBeGreaterThan(900);
}

test.describe('single-row project command center contract', () => {
  test('CEO sees exactly one visible row per project id and no period or business-season UI', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    addSecondProjectWithSameBusinessFields(network);
    addArchivedPeriodOutsideProjectDates(network);
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const shell = page.getByTestId('project-summary-shell');
    await expect(shell).toBeVisible();
    const visibleRows = shell.locator('tr[data-project-id]');
    await expect(visibleRows).toHaveCount(2);
    await expect(shell.locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`)).toHaveCount(1);
    await expect(shell.locator(`tr[data-project-id="${SECOND_PROJECT_ID}"]`)).toHaveCount(1);

    const filters = page.getByTestId('project-primary-filters');
    await expect(filters).not.toContainText(/бизнес-сезон|календарный период|наличие периодов|тип периода|audit period/i);
    await expect(shell).not.toContainText(/бизнес-сезон|audit period|\bпериод(?:ы|ов|а|е|ом)?\b/i);
    await expect(filters.getByRole('combobox', { name: /период|бизнес-сезон/i })).toHaveCount(0);

    await page.getByRole('textbox', { name: 'Дата начала диапазона', exact: true }).fill('2017-01-01');
    await page.getByRole('textbox', { name: 'Дата окончания диапазона', exact: true }).fill('2017-12-31');
    await expect(shell.locator('tr[data-project-id]')).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('one CEO row shows company, contract, dates, full team and complete bonus totals', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    const row = await projectRow(page);

    for (const label of [
      'Наша компания',
      'Договор',
      'Срок',
      'Команда',
      'Сумма без НДС',
      'Бонусный пул',
      'Итого бонусов',
      'Остаток',
    ]) {
      await expect(row).toContainText(label);
    }
    await expect(row).toContainText('RBI Audit Kazakhstan');
    await expect(row).toContainText('DEMO-2026-001');
    await expect(row).toContainText(/15\.01\.2026\s*[—-]\s*20\.12\.2026/);
    await expect(row).toContainText('Демо Партнёр');
    await expect(row).toContainText('Демо Менеджер');
    await expect(row).toContainText('Демо Ассистент');
    await expect(row).toContainText(/48\s*000\s*000\s*₸/);
    await expect(row).toContainText(/3\s*360\s*000\s*₸/);
    await expect(row).toContainText(/1\s*276\s*800\s*₸/);
    await expect(row).toContainText(/2\s*083\s*200\s*₸/);
    await expectEditableTeamLedger(row.getByTestId(`project-details-${DEMO_PROJECT_ID}`));
    expect(network.productionMutations).toEqual([]);
  });

  test('deputy director assigns our company directly in the row without losing the team', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    const row = await projectRow(page);

    const company = row.getByRole('combobox', { name: `Наша компания проекта ${demoProject.name}`, exact: true });
    await expect(company).toBeEnabled();
    await company.click();
    await page.getByRole('option', { name: 'ТОО МАК', exact: true }).click();
    await expect.poll(() => targetProjectPatches(network).length).toBe(1);

    const notes = latestTargetNotes(network);
    expect(notes).toMatchObject({
      companyId: 'mak',
      companyName: 'ТОО МАК',
      company: 'ТОО МАК',
      ourCompany: 'ТОО МАК',
    });
    expect(teamMemberIds(notes)).toEqual(expect.arrayContaining([
      DEMO_EMPLOYEE_IDS.partner,
      DEMO_EMPLOYEE_IDS.manager,
      DEMO_EMPLOYEE_IDS.assistant,
    ]));
    expect(network.productionMutations).toEqual([]);
  });

  test('team pickers search every employee and changing the partner preserves the rest of the team', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    network.tableRows.employees.push({ ...EXTRA_EMPLOYEE });
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    let row = await projectRow(page);

    await searchAndPick(
      page,
      row.getByRole('button', { name: `Партнёр проекта ${demoProject.name}`, exact: true }),
      EXTRA_EMPLOYEE.email,
      EXTRA_EMPLOYEE.name,
    );
    await expect.poll(() => targetProjectPatches(network).length).toBe(1);
    let notes = latestTargetNotes(network);
    expect(teamMemberIds(notes)).toEqual(expect.arrayContaining([
      EXTRA_EMPLOYEE.id,
      DEMO_EMPLOYEE_IDS.manager,
      DEMO_EMPLOYEE_IDS.assistant,
    ]));
    expect(teamMemberIds(notes)).not.toContain(DEMO_EMPLOYEE_IDS.partner);

    row = await projectRow(page);
    const leader = row.getByRole('button', { name: `Руководитель проекта ${demoProject.name}`, exact: true });
    await leader.click();
    const search = page.getByPlaceholder(employeeSearchPlaceholder).last();
    await search.fill('ceo@demo.invalid');
    await expect(page.getByRole('option', { name: /Алия Генеральный директор/i }).last()).toBeVisible();
    await page.keyboard.press('Escape');

    const role = row.getByRole('combobox', { name: `Роль нового участника проекта ${demoProject.name}`, exact: true });
    await role.click();
    await page.getByRole('option', { name: 'Супервайзер 3', exact: true }).click();
    const participant = row.getByRole('button', {
      name: new RegExp(`Добавить (?:участника проекта|сотрудника в команду проекта) ${demoProject.name}`),
    });
    await searchAndPick(page, participant, 'procurement@demo.invalid', 'Демо Закупки');
    await expect.poll(() => targetProjectPatches(network).length).toBe(2);
    notes = latestTargetNotes(network);
    expect(teamMemberIds(notes)).toEqual(expect.arrayContaining([
      EXTRA_EMPLOYEE.id,
      DEMO_EMPLOYEE_IDS.manager,
      DEMO_EMPLOYEE_IDS.assistant,
      DEMO_EMPLOYEE_IDS.procurement,
    ]));
    expect(network.productionMutations).toEqual([]);
  });

  test('CEO saves an exact amount for every employee and an exact project pool', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    let detail = await openProjectDetail(page);

    const exactAmounts: Array<[string, number]> = [
      [DEMO_EMPLOYEE_IDS.partner, 900_001],
      [DEMO_EMPLOYEE_IDS.manager, 400_002],
      [DEMO_EMPLOYEE_IDS.assistant, 100_003],
    ];
    for (const [employeeId, amount] of exactAmounts) {
      const input = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${employeeId}`).locator('input');
      await expect(input).toBeEnabled();
      await input.fill(String(amount));
      await input.press('Enter');
      await expect.poll(() => targetProjectPatches(network).length).toBe(
        exactAmounts.findIndex(([candidate]) => candidate === employeeId) + 1,
      );
      await expect(input).toHaveValue(String(amount));
    }

    const poolInput = detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`).locator('input');
    await expect(poolInput).toBeEnabled();
    await poolInput.fill('4500007');
    await poolInput.press('Enter');
    await expect.poll(() => targetProjectPatches(network).length).toBe(4);

    const notes = latestTargetNotes(network);
    expect(notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.partner].amount).toBe(900_001);
    expect(notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.manager].amount).toBe(400_002);
    expect(notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.assistant].amount).toBe(100_003);
    expect(notes.finances.totalPaidBonuses).toBe(1_400_006);
    expect(notes.finances).toMatchObject({
      bonusPoolOverrideAmount: 4_500_007,
      bonusPoolManuallyAdjusted: true,
      totalBonusAmount: 4_500_007,
    });

    await page.reload();
    await waitForDemoApp(page);
    detail = await openProjectDetail(page);
    for (const [employeeId, amount] of exactAmounts) {
      await expect(detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${employeeId}`).locator('input')).toHaveValue(String(amount));
    }
    await expect(detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`).locator('input')).toHaveValue('4500007');
    expect(network.productionMutations).toEqual([]);
  });

  test('deputy director edits team and status without any bonus DOM or bonus amount', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    const row = await projectRow(page);

    await expect(row.getByRole('button', { name: `Партнёр проекта ${demoProject.name}`, exact: true })).toBeEnabled();
    await expect(row.getByRole('button', { name: `Руководитель проекта ${demoProject.name}`, exact: true })).toBeEnabled();
    await expect(row.getByRole('button', {
      name: new RegExp(`Добавить (?:участника проекта|сотрудника в команду проекта) ${demoProject.name}`),
    })).toBeEnabled();

    const status = row.getByRole('combobox', { name: `Изменить статус проекта ${demoProject.name}`, exact: true });
    await expect(status).toBeEnabled();
    await status.click();
    await page.getByRole('option', { name: 'Планирование', exact: true }).click();
    await expect.poll(() => targetProjectPatches(network).length).toBe(1);

    const detail = await openProjectDetail(page);
    const teamLedger = detail.getByTestId('project-team-ledger');
    await expect(teamLedger).toBeVisible();
    await expect(teamLedger.locator('[data-team-member-row="true"]')).toHaveCount(DEMO_TEAM_LEDGER.length);
    for (const employee of DEMO_TEAM_LEDGER) {
      const member = detail.getByTestId(`project-team-member-${DEMO_PROJECT_ID}-${employee.id}`);
      await expect(member).toContainText(employee.name);
      await expect(member).toContainText(employee.role);
      await expect(member).toContainText(`${employee.approvedHours} ч`);
    }
    await expect(detail.getByTestId('project-bonus-editor')).toHaveCount(0);
    await expect(detail.locator('[data-testid^="member-bonus-"]')).toHaveCount(0);
    await expect(detail.locator('[data-testid^="employee-bonus-"]')).toHaveCount(0);
    await expect(detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`)).toHaveCount(0);
    await expect(detail).not.toContainText('Бонусный пул');
    await expect(detail).not.toContainText(/3\s*360\s*000\s*₸/);
    await expect(detail).not.toContainText(/1\s*276\s*800\s*₸/);
    await expect(detail).not.toContainText(/2\s*083\s*200\s*₸/);
    expect(targetProjectPatches(network)).toHaveLength(1);
    expect(network.productionMutations).toEqual([]);
  });

  test('a protected detached bonus is completely hidden from the deputy director', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    addProtectedDetachedBonus(network);
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const row = await projectRow(page);
    await expect(row).toContainText('Команда · 3 чел.');
    await expect(row).not.toContainText(DETACHED_BONUS_EMPLOYEE.name);
    await expect(row).not.toContainText('Сохранённый бонус · вне команды');
    await expect(row).not.toContainText(/222\s*222\s*₸/);
    await expect(row.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DETACHED_BONUS_EMPLOYEE_ID}`)).toHaveCount(0);
    await expect(row.getByTestId('project-bonus-editor')).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('CEO can correct a protected detached bonus without adding the employee to the team', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    addProtectedDetachedBonus(network);
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const row = await projectRow(page);
    const detachedBonus = row.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DETACHED_BONUS_EMPLOYEE_ID}`);
    const input = detachedBonus.locator('input');
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue('222222');
    await input.fill('333333');
    await input.press('Enter');

    await expect.poll(() => targetProjectPatches(network).length).toBe(1);
    const notes = latestTargetNotes(network);
    expect(notes.finances.teamBonuses[DETACHED_BONUS_EMPLOYEE_ID].amount).toBe(333_333);
    expect((notes.finances.teamBonuses[DETACHED_BONUS_EMPLOYEE_ID] as any).manuallyAdjusted).toBe(true);
    expect(teamMemberIds(notes)).not.toContain(DETACHED_BONUS_EMPLOYEE_ID);
    await expect(row).toContainText('Команда · 3 чел.');
    expect(network.productionMutations).toEqual([]);
  });
});
