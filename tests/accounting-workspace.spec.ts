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
      await expect(page.getByRole('heading', { name: 'Бухгалтерский кабинет' })).toBeVisible({ timeout: 20_000 });

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
    await expect(page.getByText('Обмен с 1С')).toBeVisible();
    await expect(page.getByText('Обмен работает')).toBeVisible();
    await page.getByRole('button', { name: 'Подробности 1С' }).click();
    await expect(page.getByRole('button', { name: /Клиенты \/ проекты/ })).toContainText('1');
    await expect(page.getByText('Договор не найден в проектах HUB').first()).toBeVisible();
    await expect(page.getByText('Бонусная ведомость')).toHaveCount(0);
    await expect(page.getByText('Свод', { exact: true })).toHaveCount(0);
  });

  test('accountant gets an exact 1C correction path for every unmatched record', async ({ page }) => {
    await loginAsDemoRole(page, 'accountant');
    await page.goto('/accounting');
    await waitForDemoApp(page);

    await page.getByRole('button', { name: 'Подробности 1С' }).click();
    await expect(page.getByText('1С → Продажа → Счета на оплату покупателям').first()).toBeVisible();
    await expect(page.getByText(/В 1С указан договор «24\/10-49», но проекта с таким номером договора в HUB нет/).first()).toBeVisible();
    await expect(page.getByText(/Контрагент:.*АО Демонстрационный клиент/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Скопировать бухгалтеру' }).first()).toBeVisible();
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
    await expect(page.getByText('Получить просроченную оплату').first()).toBeVisible();
    await expect(page.getByText(/Просрочено на \d+ дн\./).first()).toBeVisible();

    await page.getByRole('button', { name: 'Оплата' }).first().click();
    await page.getByLabel('Сумма', { exact: true }).fill('5000000');
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
    await expect(page.getByRole('button', { name: 'Счёт', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'АВР', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'ЭСФ', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Оплата', exact: true }).first()).toBeVisible();
    await expect(page.getByText('Следующее действие').first()).toBeVisible();

    const screenshotPath = process.env.ACCOUNTING_MOBILE_SCREENSHOT;
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('mobile accountant sees filters immediately and can combine and reset them', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDemoRole(page, 'accountant');
    await page.goto('/accounting');
    await waitForDemoApp(page);

    const toggle = page.getByTestId('accounting-filter-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeInViewport();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Наша компания')).toBeVisible();
    await expect(page.getByLabel('Оплата и задолженность')).toBeVisible();
    await expect(page.getByLabel('Документы')).toBeVisible();
    await expect(page.getByLabel('Сумма договора от')).toBeVisible();
    await expect(page.getByLabel('Сортировка')).toBeVisible();

    await page.getByLabel('Поиск по бухгалтерскому реестру').fill('точно-нет-такого-проекта');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
    await expect(page.getByTestId('accounting-result-count')).toContainText('0 из');
    await page.getByRole('button', { name: 'Сбросить всё' }).click();
    await expect(page.getByLabel('Поиск по бухгалтерскому реестру')).toHaveValue('');
    await expect(page.getByText('Ничего не найдено')).toHaveCount(0);

    await page.getByLabel('Сумма договора от').fill('не число');
    await expect(page.getByText('Укажите корректную минимальную сумму. Фильтр по сумме применится после исправления.')).toBeVisible();
    await expect(page.getByTestId('accounting-result-count')).not.toContainText('0 из');
    await page.getByLabel('Сумма договора от').fill('2000000');
    await page.getByLabel('Сумма договора до').fill('1000000');
    await expect(page.getByText('Минимальная сумма не может быть больше максимальной. Фильтр по сумме применится после исправления.')).toBeVisible();
    await page.getByRole('button', { name: 'Сбросить всё' }).click();
    await expect(page.getByLabel('Сумма договора от')).toHaveValue('');
    await expect(page.getByLabel('Сумма договора до')).toHaveValue('');
  });

  test('AVR creation requires a visible signature return deadline', async ({ page }) => {
    await loginAsDemoRole(page, 'accountant');
    await page.goto('/accounting');
    await waitForDemoApp(page);

    await page.getByRole('button', { name: 'АВР', exact: true }).first().click();
    await expect(page.getByLabel('Получить подписанный АВР до')).toBeVisible();
    await expect(page.getByLabel('Получить подписанный АВР до')).not.toHaveValue('');
  });

  test('a project closed in the summary is closed in accounting but outstanding debt remains visible', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'accountant');
    const project = network.tableRows.projects[0];
    addAccountingFixture(project);
    const notes = JSON.parse(String(project.notes || '{}'));
    notes.status = 'completed';
    project.notes = JSON.stringify(notes);
    project.status = 'completed';

    await page.goto('/accounting');
    await waitForDemoApp(page);

    await expect(page.getByText('Проект закрыт · бухгалтерия требует действий').first()).toBeVisible();
    await expect(page.getByText('Получить просроченную оплату').first()).toBeVisible();
    await expect(page.getByText(/28\s*млн\s*₸/).first()).toBeVisible();
  });
});
