import { expect, test, type Page } from '@playwright/test';
import {
  DEMO_PROJECT_ID,
  demoProject,
  loginAsDemoRole,
  waitForDemoApp,
} from './helpers/demo-fixtures';

async function visibleUnnamedButtons(page: Page) {
  return page.locator('button:visible').evaluateAll((buttons) => buttons
    .filter((button) => {
      const text = button.textContent?.trim() || '';
      const id = button.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
      return !text && !label && !button.getAttribute('aria-label') && !button.getAttribute('title') && !button.getAttribute('aria-labelledby');
    })
    .map((button) => button.outerHTML.slice(0, 240)));
}

test.describe('executive demo: project to payment registry', () => {
  test('CEO command center keeps company, contract, dates, team and money in one project passport', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    const shell = page.getByTestId('project-summary-shell');
    const projectRow = shell.locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
    await expect(projectRow).toHaveCount(1);
    const snapshot = projectRow.getByTestId(`project-details-${DEMO_PROJECT_ID}`);
    await expect(snapshot).toBeVisible();
    await expect(snapshot).toContainText('RBI Audit Kazakhstan');
    await expect(snapshot).toContainText('DEMO-2026-001');
    await expect(snapshot).toContainText('15.01.2026 — 20.12.2026');
    await expect(snapshot).not.toContainText(/бизнес-сезон|audit period/i);
    await expect(snapshot).toContainText(/48\s*000\s*000\s*₸/);
    await expect(snapshot).toContainText('Демо Партнёр');
    await expect(snapshot).toContainText('Демо Менеджер');
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('CEO sees one transparent project passport with price, team and approved hours', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    const projectRow = page.getByTestId('project-summary-shell').locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
    await expect(projectRow).toContainText(demoProject.name);
    await expect(projectRow).toContainText(/48\s*000\s*000\s*₸/);
    const projectLink = projectRow.getByRole('link', { name: 'Файлы и договор', exact: true });
    await expect(projectLink).toBeVisible();

    await projectLink.click();
    await expect(page).toHaveURL(new RegExp(`/project/${DEMO_PROJECT_ID}$`));
    await expect(page.getByRole('heading', { name: 'Свод проекта' })).toBeVisible();
    await expect(page.getByLabel('Свод проекта')).toContainText('Вся ключевая информация одной таблицей');
    await expect(page.getByLabel('Свод проекта')).toContainText('15.01.2026 — 20.12.2026');
    await expect(page.getByLabel('Свод проекта')).not.toContainText('20.12.2026 — 15.01.2026');
    await expect(page.getByRole('tab', { name: /Дашборд|Обзор/ })).toHaveCount(0);
    await expect(page.getByText('Общий прогресс')).toHaveCount(0);
    await expect(page.getByText('Статус выполнения')).toHaveCount(0);
    await expect(page.getByText('Таймлайн')).toHaveCount(0);
    await expect(page.getByText('Управление командой')).toHaveCount(0);
    await expect(page.getByText('Финансовая сводка')).toHaveCount(0);
    await expect(page.getByText('14ч')).toBeVisible();
    await expect(page.getByText('+4ч ждут партнёра')).toBeVisible();
    await expect(page.getByText('Демо Партнёр').first()).toBeVisible();
    await expect(page.getByText('Демо Менеджер').first()).toBeVisible();
    await expect(page.getByText('Демо Ассистент').first()).toBeVisible();
    await expect(page.getByText('Сумма без НДС')).toBeVisible();
    await expect(page.getByText(/48\s*000\s*000\s*₸/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Управлять в своде' })).toBeVisible();
    await expect(visibleUnnamedButtons(page)).resolves.toEqual([]);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('team assignment is obvious for CEO and read-only for an assistant', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto(`/project/${DEMO_PROJECT_ID}`);
    await waitForDemoApp(page);
    await page.getByRole('button', { name: 'Управлять в своде' }).click();
    await expect(page).toHaveURL(/\/projects\?q=/);
    await waitForDemoApp(page);
    const row = page.getByTestId('project-summary-shell').locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
    await expect(row).toContainText('Команда · 3 чел.');
    await expect(row.getByRole('button', { name: `Партнёр проекта ${demoProject.name}`, exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: `Руководитель проекта ${demoProject.name}`, exact: true })).toBeVisible();
    expect(network.productionMutations).toEqual([]);

  });

  test('assistant sees the same team and price but cannot change either', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'assistant_1');
    await page.goto(`/project/${DEMO_PROJECT_ID}`);
    await waitForDemoApp(page);

    await expect(page.getByText('Демо Партнёр').first()).toBeVisible();
    await expect(page.getByText('Демо Менеджер').first()).toBeVisible();
    await expect(page.getByText('Демо Ассистент').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Изменить состав' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Управлять в своде' })).toHaveCount(0);
    await page.getByRole('tab', { name: /Договор/ }).click();
    await expect(page.getByText(/48\s*000\s*000/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Редактировать' })).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('Seafile metadata is visible and file management follows the procurement role', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'procurement');
    await page.goto(`/project/${DEMO_PROJECT_ID}`);
    await waitForDemoApp(page);

    await expect(page.getByLabel('📁 Файлы').getByText('Договор_DEMO-2026-001.pdf')).toBeVisible();
    await expect(page.getByText(/242\.5 KB.*other.*15\.01\.2026/)).toBeVisible();
    const downloadButton = page.getByRole('button', { name: /Скачать файл/ });
    await expect(downloadButton).toBeVisible();
    await downloadButton.click();
    await expect.poll(() => network.requests.some((entry) => entry.url.includes('/api/seafile/download-url'))).toBe(true);
    await expect(page.getByRole('button', { name: /Удалить файл/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить файлы' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Изменить состав' })).toHaveCount(0);

    await page.getByRole('tab', { name: /Договор/ }).click();
    await expect(page.getByRole('tabpanel').getByText('№DEMO-2026-001')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Редактировать' }).last()).toBeVisible();
    await expect(visibleUnnamedButtons(page)).resolves.toEqual([]);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('timesheets clearly separate approved and submitted hours', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/timesheets');
    await waitForDemoApp(page);

    await expect(page.getByText('18.0 ч')).toBeVisible();
    await expect(page.getByText('2', { exact: true })).toBeVisible();
    await expect(page.getByText('1', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /Список/ }).click();
    await expect(page.getByText('Утверждено')).toHaveCount(3);
    await expect(page.getByText('На проверке')).toHaveCount(2);
    await expect(page.getByText(demoProject.name)).toHaveCount(3);
    expect(network.productionMutations).toEqual([]);
  });

  test('CEO bonus route opens the protected employee bonus ledger', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/bonuses');
    await waitForDemoApp(page);

    await expect(page).toHaveURL(/\/bonuses$/);
    await expect(page.getByTestId('bonus-dashboard')).toBeVisible();
    await expect(page.getByTestId('bonus-employee-table')).toBeVisible();
    await expect(page.getByText('Предварительный расчёт · технические проценты')).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('procurement form calculates contract price and submits only to the isolated fixture', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'procurement');
    await page.goto('/create-project-procurement');
    await waitForDemoApp(page);

    await page.locator('#clientName').fill('АО Новый демонстрационный клиент');
    await page.locator('#contractNumber').fill('CEO-DEMO-002');
    await page.locator('#contractDate').fill('2026-07-12');
    await page.locator('#contractSubject').fill('Аудит финансовой отчётности');
    await page.locator('#amountWithoutVAT').fill('48000000');
    await expect(page.getByText(/Итого с НДС:.*55\s*680\s*000 KZT/)).toBeVisible();

    await page.getByText('Выберите компанию').click();
    await page.getByRole('option', { name: 'ТОО МАК' }).click();
    await page.getByText('Выберите вид проекта').click();
    await page.getByRole('option', { name: 'Финансовый аудит' }).click();
    await page.getByTestId('submit-project-button').click();

    await expect(page).toHaveURL(/\/projects$/);
    const projectPost = network.mutationRequests.find((entry) => entry.method === 'POST' && entry.url.includes('/rest/v1/projects'));
    expect(projectPost?.body).toContain('48000000');
    expect(projectPost?.body).toContain('АО Новый демонстрационный клиент');
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });
});
