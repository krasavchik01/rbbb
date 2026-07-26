import { expect, test } from '@playwright/test';
import {
  DEMO_EMPLOYEE_IDS,
  demoEmployees,
  demoProject,
  loginAsDemoRole,
  waitForDemoApp,
  type DemoNetworkJournal,
} from './helpers/demo-fixtures';

const SECOND_PROJECT_ID = 'demo-project-002';
const SECOND_PROJECT_NAME = 'АО Второй демонстрационный клиент — аудит 2026';

const employeeName = (id: string) => (
  demoEmployees.find((employee) => employee.id === id)?.name || id
);

function installTwoProjectBonusLedger(network: DemoNetworkJournal) {
  const secondProject = JSON.parse(JSON.stringify(demoProject)) as typeof demoProject;
  const secondNotes = JSON.parse(String(secondProject.notes)) as Record<string, any>;
  secondProject.id = SECOND_PROJECT_ID;
  secondProject.name = SECOND_PROJECT_NAME;
  secondProject.updated_at = '2026-07-20T00:00:00.000Z';
  secondNotes.name = SECOND_PROJECT_NAME;
  secondNotes.clientName = 'АО Второй демонстрационный клиент';
  secondNotes.contract.serviceStartDate = '2024-10-01';
  secondNotes.contract.serviceEndDate = '2025-09-30';
  secondProject.start_date = '2024-10-01';
  secondNotes.finances.teamBonuses = {
    [DEMO_EMPLOYEE_IDS.partner]: { amount: 160_000, percent: 25, role: 'partner', manuallyAdjusted: true },
    [DEMO_EMPLOYEE_IDS.manager]: { amount: 64_000, percent: 10, role: 'manager_1', manuallyAdjusted: true },
    [DEMO_EMPLOYEE_IDS.assistant]: { amount: 25_200, percent: 3, role: 'assistant_1', manuallyAdjusted: true },
  };
  secondProject.notes = JSON.stringify(secondNotes);
  network.tableRows.projects.push(secondProject);

  network.tableRows.bonuses.push(
    {
      id: 'demo-paid-partner-bonus',
      project_id: demoProject.id,
      employee_id: DEMO_EMPLOYEE_IDS.partner,
      bonus_amount: 840_000,
      kpi_percentage: 100,
      status: 'approved',
      payment_date: '2026-07-21T00:00:00.000Z',
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-21T00:00:00.000Z',
    },
    {
      id: 'demo-approved-manager-bonus',
      project_id: demoProject.id,
      employee_id: DEMO_EMPLOYEE_IDS.manager,
      bonus_amount: 336_000,
      kpi_percentage: 100,
      status: 'approved',
      payment_date: null,
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
    },
  );
}

async function openExecutiveBonusLedger(
  page: Parameters<typeof loginAsDemoRole>[0],
  role: 'ceo' | 'admin',
) {
  const network = await loginAsDemoRole(page, role);
  installTwoProjectBonusLedger(network);
  await page.goto('/bonuses');
  await waitForDemoApp(page);
  await expect(page).toHaveURL(/\/bonuses$/);
  await expect(page.getByTestId('bonus-dashboard')).toBeVisible();
  return network;
}

test.describe('executive employee bonus ledger', () => {
  test('CEO sees reconciled totals, status infographic and every project source by employee', async ({ page }) => {
    const network = await openExecutiveBonusLedger(page, 'ceo');

    await expect(page.getByRole('heading', { name: /Бонусная ведомость/i })).toBeVisible();
    await expect(page.getByTestId('bonus-kpi-planned')).toContainText(/1\s*526\s*000/);
    await expect(page.getByTestId('bonus-kpi-paid')).toContainText(/840\s*000/);
    await expect(page.getByTestId('bonus-kpi-approved')).toContainText(/336\s*000/);
    await expect(page.getByTestId('bonus-kpi-unregistered')).toContainText(/350\s*000/);
    await expect(page.getByTestId('bonus-reconciliation')).toContainText(/Сверка сошлась/i);

    const statusChart = page.getByTestId('bonus-status-chart');
    const employeeChart = page.getByTestId('bonus-top-employees-chart');
    await expect(statusChart).toBeVisible();
    await expect(employeeChart).toBeVisible();
    await expect(statusChart.locator('svg.recharts-surface')).toBeVisible();
    await expect(employeeChart.locator('svg.recharts-surface')).toBeVisible();

    const table = page.getByTestId('bonus-employee-table');
    await expect(table).toBeVisible();
    const employeeRows = table.locator('[data-bonus-employee-row="true"]');
    await expect(employeeRows).toHaveCount(3);

    const partnerRow = page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.partner}`);
    await expect(partnerRow).toContainText(employeeName(DEMO_EMPLOYEE_IDS.partner));
    await expect(partnerRow).toContainText(/1\s*000\s*000/);
    await expect(partnerRow.getByTestId('bonus-project-sources')).toContainText(demoProject.name);
    await expect(partnerRow.getByTestId('bonus-project-sources')).toContainText(SECOND_PROJECT_NAME);
    await expect(partnerRow.getByTestId('bonus-project-sources')).toContainText(/840\s*000/);
    await expect(partnerRow.getByTestId('bonus-project-sources')).toContainText(/160\s*000/);

    const managerRow = page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.manager}`);
    await expect(managerRow).toContainText(/400\s*000/);
    const assistantRow = page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.assistant}`);
    await expect(assistantRow).toContainText(/126\s*000/);

    expect(network.mutationRequests).toEqual([]);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('one employee receipt prints all bonus sources, the total and signature fields', async ({ page }) => {
    await page.addInitScript(() => {
      (window as typeof window & { __bonusPrintCalled?: boolean }).print = () => {
        (window as typeof window & { __bonusPrintCalled?: boolean }).__bonusPrintCalled = true;
      };
    });
    const network = await openExecutiveBonusLedger(page, 'ceo');
    const partnerName = employeeName(DEMO_EMPLOYEE_IDS.partner);

    await page.getByRole('button', { name: `Распечатать ведомость: ${partnerName}` }).click();

    const slip = page.getByTestId('bonus-print-slip');
    await expect(slip).toBeVisible();
    await expect(slip).toContainText(/Ведомость выплаты бонуса/i);
    await expect(slip).toContainText(partnerName);
    await expect(slip).toContainText(demoProject.name);
    await expect(slip).toContainText(SECOND_PROJECT_NAME);
    await expect(slip).toContainText(/1\s*000\s*000/);
    await expect(slip).toContainText(/Сумму .* получил\(а\)/i);
    await expect(slip).toContainText(/Подпись/i);
    await expect(slip).toContainText(/Дата/i);
    await expect.poll(() => page.evaluate(() => (
      Boolean((window as typeof window & { __bonusPrintCalled?: boolean }).__bonusPrintCalled)
    ))).toBe(true);

    expect(network.mutationRequests).toEqual([]);
    expect(network.productionMutations).toEqual([]);
  });

  test('season filter changes KPI, employee sources and the exact signed print amount together', async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    const network = await openExecutiveBonusLedger(page, 'ceo');

    await page.locator('label').filter({ hasText: 'Бизнес-сезон' }).getByRole('combobox').click();
    await page.getByRole('option', { name: /Сезон 2027/ }).click();

    await expect(page.getByTestId('bonus-kpi-planned')).toContainText(/1\s*276\s*800/);
    const partnerRow = page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.partner}`);
    await expect(partnerRow.getByTestId('bonus-project-sources')).toContainText(demoProject.name);
    await expect(partnerRow.getByTestId('bonus-project-sources')).not.toContainText(SECOND_PROJECT_NAME);

    await partnerRow.getByRole('button', { name: /Распечатать ведомость/ }).click();
    const slip = page.getByTestId('bonus-print-slip');
    await expect(slip).toContainText(demoProject.name);
    await expect(slip).not.toContainText(SECOND_PROJECT_NAME);
    await expect(slip).toContainText(/Сумму 840\s*000 ₸ получил\(а\)/);

    expect(network.productionMutations).toEqual([]);
  });

  test('amount range filters every source and keeps employees, KPI and print in the same scope', async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    const network = await openExecutiveBonusLedger(page, 'ceo');
    const metric = page.getByTestId('bonus-amount-metric');
    const minimum = page.getByTestId('bonus-amount-min');
    const maximum = page.getByTestId('bonus-amount-max');
    const employeeRows = page.locator('[data-bonus-employee-row="true"]');

    const selectMetric = async (name: RegExp) => {
      await metric.click();
      await page.getByRole('option', { name }).click();
    };
    const setRange = async (from: number, to: number) => {
      await minimum.fill(String(from));
      await maximum.fill(String(to));
    };

    await selectMetric(/^Рассчитано$/i);
    await setRange(830_000, 850_000);
    await expect(page.getByTestId('bonus-visible-count')).toContainText('1');
    await expect(employeeRows).toHaveCount(1);
    await expect(page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.partner}`)).toBeVisible();
    await expect(page.getByTestId('bonus-project-sources')).toContainText(demoProject.name);
    await expect(page.getByTestId('bonus-project-sources')).not.toContainText(SECOND_PROJECT_NAME);
    await expect(page.getByTestId('bonus-kpi-planned')).toContainText(/840\s*000/);

    await selectMetric(/^Утверждено$/i);
    await setRange(330_000, 340_000);
    await expect(page.getByTestId('bonus-visible-count')).toContainText('1');
    await expect(employeeRows).toHaveCount(1);
    await expect(page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.manager}`)).toBeVisible();
    await expect(page.getByTestId('bonus-kpi-planned')).toContainText(/336\s*000/);
    await expect(page.getByTestId('bonus-kpi-approved')).toContainText(/336\s*000/);

    await selectMetric(/^Выплачено$/i);
    await setRange(830_000, 850_000);
    await expect(page.getByTestId('bonus-visible-count')).toContainText('1');
    await expect(employeeRows).toHaveCount(1);
    await expect(page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.partner}`)).toBeVisible();
    await expect(page.getByTestId('bonus-kpi-paid')).toContainText(/840\s*000/);

    await selectMetric(/^Не в реестре$/i);
    await setRange(150_000, 170_000);
    await expect(page.getByTestId('bonus-visible-count')).toContainText('1');
    await expect(employeeRows).toHaveCount(1);
    const partnerRow = page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.partner}`);
    await expect(partnerRow).toBeVisible();
    await expect(partnerRow.getByTestId('bonus-project-sources')).toContainText(SECOND_PROJECT_NAME);
    await expect(partnerRow.getByTestId('bonus-project-sources')).not.toContainText(demoProject.name);
    await expect(page.getByTestId('bonus-kpi-planned')).toContainText(/160\s*000/);
    await expect(page.getByTestId('bonus-kpi-approved')).toContainText(/0\s*₸/);
    await expect(page.getByTestId('bonus-kpi-paid')).toContainText(/0\s*₸/);
    await expect(page.getByTestId('bonus-kpi-unregistered')).toContainText(/160\s*000/);

    await partnerRow.getByRole('button', { name: /Распечатать ведомость/ }).click();
    const slip = page.getByTestId('bonus-print-slip');
    await expect(slip).toContainText(SECOND_PROJECT_NAME);
    await expect(slip).not.toContainText(demoProject.name);
    await expect(slip).toContainText(/Расчётный итог:\s*160\s*000\s*₸/i);

    expect(network.mutationRequests).toEqual([]);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('admin has the same ledger while deputy has neither the route nor its navigation item', async ({ page }) => {
    let network = await loginAsDemoRole(page, 'admin');
    await page.goto('/projects');
    await waitForDemoApp(page);
    await expect(page.locator('[data-sidebar="content"] a[href="/bonuses"]')).toBeVisible();
    installTwoProjectBonusLedger(network);
    await page.goto('/bonuses');
    await waitForDemoApp(page);
    await expect(page).toHaveURL(/\/bonuses$/);
    await expect(page.getByTestId('bonus-dashboard')).toBeVisible();
    expect(network.productionMutations).toEqual([]);

    network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto('/projects');
    await waitForDemoApp(page);
    await expect(page.locator('[data-sidebar="content"] a[href="/bonuses"]')).toHaveCount(0);
    await page.goto('/bonuses');
    await waitForDemoApp(page);
    await expect(page).toHaveURL(/\/projects(?:[?#].*)?$/);
    await expect(page.getByTestId('bonus-dashboard')).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('the executive bonus ledger stays readable without horizontal page scrolling on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const network = await openExecutiveBonusLedger(page, 'ceo');

    await expect(page.getByTestId('bonus-amount-metric')).toBeVisible();
    await expect(page.getByTestId('bonus-amount-min')).toBeVisible();
    await expect(page.getByTestId('bonus-amount-max')).toBeVisible();
    await page.getByTestId('bonus-amount-metric').click();
    await page.getByRole('option', { name: /^Не в реестре$/i }).click();
    await page.getByTestId('bonus-amount-min').fill('150000');
    await page.getByTestId('bonus-amount-max').fill('170000');
    await expect(page.getByTestId('bonus-visible-count')).toContainText('1');

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
    }));
    expect(Math.max(geometry.body, geometry.root)).toBeLessThanOrEqual(geometry.viewport + 1);
    await expect(page.getByTestId('bonus-kpi-planned')).toBeVisible();
    await expect(page.getByTestId(`bonus-employee-row-${DEMO_EMPLOYEE_IDS.partner}`)).toBeVisible();
    expect(network.productionMutations).toEqual([]);
  });
});
