import { expect, test } from '@playwright/test';
import { loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

function addAccountingFixture(project: any) {
  const notes = JSON.parse(String(project.notes || '{}'));
  notes.accounting = {
    version: 1,
    contact: {
      name: 'Алия Садыкова',
      phone: '+7 700 123 45 67',
      email: 'finance@example.invalid',
    },
    documents: [{
      id: 'invoice-existing',
      type: 'invoice',
      number: 'СФ-001',
      issueDate: '2026-07-01',
      dueDate: '2026-07-15',
      amount: 48_000_000,
      status: 'sent',
      createdAt: '2026-07-01T00:00:00.000Z',
    }],
    payments: [{
      id: 'payment-existing',
      date: '2026-07-05',
      amount: 20_000_000,
      kind: 'advance',
      reference: 'ПП №101',
      createdAt: '2026-07-05T00:00:00.000Z',
    }],
  };
  project.notes = JSON.stringify(notes);
}

test.describe('accounting workspace', () => {
  for (const executiveRole of ['ceo', 'admin'] as const) {
    test(`${executiveRole} can inspect the accountant view and return to the full summary`, async ({ page }) => {
      await loginAsDemoRole(page, executiveRole);

      await page.goto('/accounting');
      await expect(page.getByRole('heading', { name: 'Бухгалтерский кабинет' })).toBeVisible();

      await page.goto('/projects');
      await expect(page).toHaveURL(/\/projects(?:[?#].*)?$/);
      await expect(page.getByText('Бонусная ведомость')).toBeVisible();
    });
  }

  test('accountant is isolated from the executive summary and bonus routes', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'accountant');
    const projectId = String(network.tableRows.projects[0].id);

    for (const restrictedPath of ['/projects', '/bonuses', `/project/${projectId}`, '/timesheets', '/attendance', '/settings']) {
      await page.goto(restrictedPath);
      await expect(page).toHaveURL(/\/accounting(?:[?#].*)?$/);
    }

    await expect(page.getByRole('heading', { name: 'Бухгалтерский кабинет' })).toBeVisible();
    await expect(page.getByText('Бонусная ведомость')).toHaveCount(0);
    await expect(page.getByText('Свод', { exact: true })).toHaveCount(0);
  });

  test('accountant sees the full register and can record a partial payment', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'accountant');
    addAccountingFixture(network.tableRows.projects[0]);
    await page.goto('/accounting');
    await waitForDemoApp(page);

    await expect(page.getByRole('heading', { name: 'Бухгалтерский кабинет' })).toBeVisible();
    await expect(page.getByText('Оплачено по факту').first()).toBeVisible();
    await expect(page.getByText(/28\s*млн\s*₸/).first()).toBeVisible();
    await expect(page.getByText('Просроченная оплата').first()).toBeVisible();

    await page.getByRole('button', { name: 'Оплата' }).first().click();
    await page.getByLabel('Сумма').fill('5000000');
    await page.getByLabel('Номер платёжного поручения / назначение').fill('ПП №202');
    await page.getByRole('button', { name: 'Учесть оплату' }).click();

    await expect(page.getByText(/25\s*млн\s*₸/).first()).toBeVisible();
    await expect(page.getByText(/23\s*млн\s*₸/).first()).toBeVisible();
    expect(network.mutationRequests.some((request) => request.method === 'PATCH' && request.url.includes('/rest/v1/projects'))).toBe(true);

    const screenshotPath = process.env.ACCOUNTING_SCREENSHOT;
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('mobile accountant screen keeps the three primary actions visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const network = await loginAsDemoRole(page, 'accountant');
    addAccountingFixture(network.tableRows.projects[0]);
    await page.goto('/accounting');
    await waitForDemoApp(page);

    await expect(page.getByRole('heading', { name: 'Бухгалтерский кабинет' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Счёт' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'АВР' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Оплата' }).first()).toBeVisible();

    const screenshotPath = process.env.ACCOUNTING_MOBILE_SCREENSHOT;
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
