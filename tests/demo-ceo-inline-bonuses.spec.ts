import { expect, test } from '@playwright/test';
import {
  DEMO_EMPLOYEE_IDS,
  DEMO_PROJECT_ID,
  demoProject,
  loginAsDemoRole,
  waitForDemoApp,
  type DemoNetworkJournal,
} from './helpers/demo-fixtures';

const TEAM_LEDGER_EXPECTATIONS = [
  {
    id: DEMO_EMPLOYEE_IDS.partner,
    name: 'Демо Партнёр',
    role: 'Партнер',
    hours: '0.0 ч',
    inputValue: '840000',
    money: /840\s*000\s*₸/,
  },
  {
    id: DEMO_EMPLOYEE_IDS.manager,
    name: 'Демо Менеджер',
    role: 'Менеджер 1',
    hours: '6.0 ч',
    inputValue: '336000',
    money: /336\s*000\s*₸/,
  },
  {
    id: DEMO_EMPLOYEE_IDS.assistant,
    name: 'Демо Ассистент',
    role: 'Ассистент 1',
    hours: '8.0 ч',
    inputValue: '100800',
    money: /100\s*800\s*₸/,
  },
] as const;

function projectPatchRequests(network: DemoNetworkJournal) {
  return network.mutationRequests.filter((request) => (
    request.method === 'PATCH' && request.url.includes('/rest/v1/projects')
  ));
}

function projectPatch(network: DemoNetworkJournal) {
  const request = projectPatchRequests(network).at(-1);
  expect(request, 'expected a PATCH request for the demo project').toBeTruthy();
  const payload = JSON.parse(request?.body || '{}') as Record<string, unknown>;
  const notes = typeof payload.notes === 'string'
    ? JSON.parse(payload.notes) as Record<string, any>
    : (payload.notes || {}) as Record<string, any>;
  return { request: request!, payload, notes };
}

async function openDemoProjectInline(page: Parameters<typeof loginAsDemoRole>[0]) {
  const shell = page.getByTestId('project-summary-shell');
  const row = shell.locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
  await expect(row).toHaveCount(1);
  const detail = row.getByTestId(`project-details-${DEMO_PROJECT_ID}`);
  await expect(detail).toBeVisible();
  return detail;
}

test.describe('CEO inline project bonuses', () => {
  test('one project row shows the project picture and every employee bonus without another dashboard', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const shell = page.getByTestId('project-summary-shell');
    await expect(shell).toBeVisible();
    await expect(shell.locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`)).toHaveCount(1);

    const detail = await openDemoProjectInline(page);
    await expect(detail).toContainText(demoProject.name);
    await expect(detail).toContainText('Как складывается доход');
    await expect(detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`)).toBeVisible();
    await expect(page.getByRole('button', {
      name: `Уменьшить бонусный пул ${demoProject.name} на 50 000 тенге`,
      exact: true,
    })).toBeVisible();
    await expect(page.getByRole('button', {
      name: `Увеличить бонусный пул ${demoProject.name} на 50 000 тенге`,
      exact: true,
    })).toBeVisible();
    const teamLedger = detail.getByTestId('project-team-ledger');
    await expect(teamLedger).toBeVisible();
    const memberRows = teamLedger.locator('[data-team-member-row="true"]');
    await expect(memberRows).toHaveCount(TEAM_LEDGER_EXPECTATIONS.length);
    for (const employee of TEAM_LEDGER_EXPECTATIONS) {
      const member = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${employee.id}`);
      await expect(member).toBeVisible();
      await expect(member).toContainText(employee.name);
      await expect(member).toContainText(employee.role);
      await expect(member).toContainText(employee.hours);
      await expect(member.locator('input')).toHaveValue(employee.inputValue);
    }
    const rowGeometry = await memberRows.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top), width: Math.round(rect.width) };
    }));
    expect(new Set(rowGeometry.map(({ top }) => top)).size).toBe(TEAM_LEDGER_EXPECTATIONS.length);
    expect(Math.min(...rowGeometry.map(({ width }) => width))).toBeGreaterThan(900);
    await expect(detail.getByTestId('project-advanced-content')).toHaveCount(0);
    await expect(page).toHaveURL(/\/projects$/);
    expect(network.mutationRequests).toEqual([]);
    expect(network.productionMutations).toEqual([]);
  });

  test('employee plus changes only that employee and persists after reload', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);
    let detail = await openDemoProjectInline(page);

    const partnerInput = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.partner}`).locator('input');
    const managerInput = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.manager}`).locator('input');
    let assistantInput = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.assistant}`).locator('input');
    await expect(partnerInput).toHaveValue('840000');
    await expect(managerInput).toHaveValue('336000');
    await expect(assistantInput).toHaveValue('100800');

    await detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.assistant}`)
      .getByTestId(`employee-bonus-${DEMO_EMPLOYEE_IDS.assistant}-plus`)
      .click();

    await expect.poll(() => projectPatchRequests(network).length).toBe(1);
    await expect(assistantInput).toHaveValue('110800');
    await expect(partnerInput).toHaveValue('840000');
    await expect(managerInput).toHaveValue('336000');

    const patch = projectPatch(network);
    expect(new URL(patch.request.url).searchParams.get('id')).toBe(`eq.${DEMO_PROJECT_ID}`);
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.assistant]).toMatchObject({
      amount: 110_800,
      manuallyAdjusted: true,
    });
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.partner].amount).toBe(840_000);
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.manager].amount).toBe(336_000);
    expect(patch.notes.finances.totalPaidBonuses).toBe(1_286_800);

    await page.reload();
    await waitForDemoApp(page);
    detail = await openDemoProjectInline(page);
    assistantInput = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.assistant}`).locator('input');
    await expect(assistantInput).toHaveValue('110800');
    await expect(detail).toContainText(/1\s*286\s*800\s*₸/);
    expect(projectPatchRequests(network)).toHaveLength(1);
    expect(network.productionMutations).toEqual([]);
  });

  test('typed employee amount plus step is saved once without a blur race', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);
    const detail = await openDemoProjectInline(page);
    const assistant = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.assistant}`);
    const input = assistant.locator('input');

    await input.fill('120800');
    await page.getByRole('button', {
      name: 'Увеличить бонус Демо Ассистент на 10 000 тенге',
      exact: true,
    }).click();

    await expect.poll(() => projectPatchRequests(network).length).toBe(1);
    await expect(input).toHaveValue('130800');
    const patch = projectPatch(network);
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.assistant]).toMatchObject({
      amount: 130_800,
      manuallyAdjusted: true,
    });
    expect(projectPatchRequests(network)).toHaveLength(1);
    expect(network.productionMutations).toEqual([]);
  });

  test('an employee edit merges against the latest project and does not overwrite another CEO change', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);
    const detail = await openDemoProjectInline(page);

    const storedProject = network.tableRows.projects[0] as Record<string, any>;
    const latestNotes = JSON.parse(String(storedProject.notes)) as Record<string, any>;
    latestNotes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.partner] = {
      ...latestNotes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.partner],
      amount: 900_000,
      manuallyAdjusted: true,
    };
    storedProject.notes = JSON.stringify(latestNotes);
    storedProject.updated_at = '2026-07-12T01:00:00.000Z';

    await detail.getByRole('button', {
      name: 'Увеличить бонус Демо Ассистент на 10 000 тенге',
      exact: true,
    }).click();

    await expect.poll(() => projectPatchRequests(network).length).toBe(1);
    const patch = projectPatch(network);
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.partner]).toMatchObject({
      amount: 900_000,
      manuallyAdjusted: true,
    });
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.assistant]).toMatchObject({
      amount: 110_800,
      manuallyAdjusted: true,
    });
    expect(network.productionMutations).toEqual([]);
  });

  test('project pool plus saves a manual pool for this project', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);
    let detail = await openDemoProjectInline(page);

    let pool = detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`);
    let poolInput = pool.locator('input');
    await expect(poolInput).toHaveValue('3360000');
    await pool.getByTestId('project-bonus-pool-plus').click();

    await expect.poll(() => projectPatchRequests(network).length).toBe(1);
    await expect(poolInput).toHaveValue('3410000');
    const patch = projectPatch(network);
    expect(new URL(patch.request.url).searchParams.get('id')).toBe(`eq.${DEMO_PROJECT_ID}`);
    expect(patch.notes.finances).toMatchObject({
      bonusPoolOverrideAmount: 3_410_000,
      bonusPoolManuallyAdjusted: true,
      totalBonusAmount: 3_410_000,
    });

    await page.reload();
    await waitForDemoApp(page);
    detail = await openDemoProjectInline(page);
    pool = detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`);
    poolInput = pool.locator('input');
    await expect(poolInput).toHaveValue('3410000');
    expect(projectPatchRequests(network)).toHaveLength(1);
    expect(network.productionMutations).toEqual([]);
  });

  test('pool recalculation preserves an employee assigned only to an audit period', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    const project = network.tableRows.projects[0] as Record<string, any>;
    const notes = JSON.parse(String(project.notes)) as Record<string, any>;
    notes.auditPeriods[0].team.push({
      userId: DEMO_EMPLOYEE_IDS.procurement,
      userName: 'Демо Закупки',
      role: 'supervisor_1',
      bonusPercent: 4,
    });
    notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.procurement] = {
      amount: 75_000,
      percent: 2.23,
      role: 'supervisor_1',
      manuallyAdjusted: true,
    };
    project.notes = JSON.stringify(notes);

    await page.goto('/projects');
    await waitForDemoApp(page);
    await openDemoProjectInline(page);
    await page.getByRole('button', {
      name: `Увеличить бонусный пул ${demoProject.name} на 50 000 тенге`,
      exact: true,
    }).click();

    await expect.poll(() => projectPatchRequests(network).length).toBe(1);
    const patch = projectPatch(network);
    expect(patch.notes.finances.teamBonuses[DEMO_EMPLOYEE_IDS.procurement]).toMatchObject({
      amount: 75_000,
      manuallyAdjusted: true,
    });
    expect(network.productionMutations).toEqual([]);
  });

  test('project-level pending registry row is visible and locks edits without an employee link', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    network.tableRows.bonuses.push({
      id: 'demo-pending-project-bonus',
      project_id: DEMO_PROJECT_ID,
      employee_id: null,
      bonus_amount: 50_000,
      status: 'pending',
      payment_date: null,
      created_at: '2026-07-12T00:00:00.000Z',
      updated_at: '2026-07-12T00:00:00.000Z',
    });

    await page.goto('/projects');
    await waitForDemoApp(page);
    const detail = await openDemoProjectInline(page);
    await expect(detail).toContainText(/В реестре ждёт\s*50\s*000/);
    const bonuses = detail.getByTestId('project-bonus-editor');
    await expect(bonuses).toContainText('Только просмотр');
    await expect(bonuses.locator('input, button')).toHaveCount(0);
    await expect(detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`)).toHaveCount(0);
    expect(projectPatchRequests(network)).toHaveLength(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('admin can inspect the CEO picture but only the real CEO can change money', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'admin');
    await page.goto('/projects');
    await waitForDemoApp(page);
    const detail = await openDemoProjectInline(page);

    await expect(detail).toContainText('Изменение бонусов доступно только генеральному директору');
    const bonuses = detail.getByTestId('project-bonus-editor');
    await expect(bonuses).toContainText('Только просмотр');
    await expect(bonuses.locator('input, button')).toHaveCount(0);
    await expect(detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`)).toHaveCount(0);
    const teamLedger = detail.getByTestId('project-team-ledger');
    await expect(teamLedger.locator('[data-team-member-row="true"]')).toHaveCount(TEAM_LEDGER_EXPECTATIONS.length);
    for (const employee of TEAM_LEDGER_EXPECTATIONS) {
      const member = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${employee.id}`);
      await expect(member).toBeVisible();
      await expect(member).toContainText(employee.name);
      await expect(member).toContainText(employee.role);
      await expect(member).toContainText(employee.hours);
      await expect(member).toContainText(employee.money);
      await expect(member.locator('input, button')).toHaveCount(0);
    }
    expect(projectPatchRequests(network)).toHaveLength(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('390px view has no page or project horizontal overflow and uses 40px bonus controls', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    const detail = await openDemoProjectInline(page);
    const shell = page.getByTestId('project-summary-shell');
    const pool = detail.getByTestId(`project-bonus-pool-${DEMO_PROJECT_ID}`);
    const assistant = detail.getByTestId(`member-bonus-${DEMO_PROJECT_ID}-${DEMO_EMPLOYEE_IDS.assistant}`);

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    for (const surface of [shell, detail, pool, assistant]) {
      const dimensions = await surface.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(dimensions.scrollWidth - dimensions.clientWidth).toBeLessThanOrEqual(1);
    }

    const decrease = assistant.getByTestId(`employee-bonus-${DEMO_EMPLOYEE_IDS.assistant}-minus`);
    const increase = assistant.getByTestId(`employee-bonus-${DEMO_EMPLOYEE_IDS.assistant}-plus`);
    await assistant.scrollIntoViewIfNeeded();
    for (const [control, accessibleName] of [
      [decrease, 'Уменьшить бонус Демо Ассистент на 10 000 тенге'],
      [increase, 'Увеличить бонус Демо Ассистент на 10 000 тенге'],
    ] as const) {
      await expect(control).toBeVisible();
      await expect(control).toHaveAccessibleName(accessibleName);
      const box = await control.boundingBox();
      expect(box?.width || 0).toBeGreaterThanOrEqual(40);
      expect(box?.height || 0).toBeGreaterThanOrEqual(40);
      expect(box?.x || 0).toBeGreaterThanOrEqual(0);
      expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(390);
    }
    expect(network.productionMutations).toEqual([]);
  });
});
