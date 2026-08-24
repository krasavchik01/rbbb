import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { demoProject, loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

test.describe('CEO command center completion', () => {
  test('business season, canonical project states and search are usable in the unified summary', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const filters = page.getByTestId('project-primary-filters');
    await expect(filters.getByText('Бизнес-сезон', { exact: true })).toBeVisible();
    await expect(filters.getByText('Вид Excel', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Сохранить вид', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Сохранённые виды свода' })).toHaveCount(0);

    const stateFilter = filters.locator(':scope > div').filter({ hasText: /^Состояние проекта/ });
    await stateFilter.getByRole('combobox').click();
    const stateOptions = page.getByRole('option');
    await expect(stateOptions).toHaveCount(4);
    await expect(stateOptions).toHaveText(['Все', 'В работе', 'Готовы к бонусам', 'Закрытые']);
    await page.keyboard.press('Escape');

    await expect(page.getByLabel('Единый свод проектов')).toBeVisible();
    await page.getByPlaceholder(/Клиент, проект, партнёр или руководитель/i).fill(demoProject.name.slice(0, 12));
    await expect(page.getByTestId('project-summary-shell').locator(`tr[data-project-id="${demoProject.id}"]`)).toBeVisible();
    await expect(page.getByRole('button', { name: /Фильтр колонки:/ })).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('CEO filters the unified summary by contract amount and uploaded contract file', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const filters = page.getByTestId('project-primary-filters');
    const row = page.getByTestId('project-summary-shell').locator(`tr[data-project-id="${demoProject.id}"]`);
    const amountFrom = filters.getByLabel('Сумма договора от', { exact: true });
    const amountTo = filters.getByLabel('Сумма договора до', { exact: true });
    await expect(amountFrom).toBeVisible();
    await expect(amountTo).toBeVisible();

    await amountFrom.fill('47000000');
    await expect(row).toBeVisible();
    await amountTo.fill('47000000');
    await expect(row).toHaveCount(0);
    await amountTo.fill('');

    const contractFilter = filters.getByRole('combobox', { name: 'Наличие договора', exact: true });
    await contractFilter.click();
    await page.getByRole('option', { name: 'Договор загружен', exact: true }).click();
    await expect(row).toBeVisible();

    await contractFilter.click();
    await page.getByRole('option', { name: 'Договор не загружен', exact: true }).click();
    await expect(row).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('CEO downloads the legacy partner workbook with ИТОГО and partner sheets', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ceo_legacy_partner_workbook_.*\.xlsx$/);
    const workbook = XLSX.readFile((await download.path()) || '');
    expect(workbook.SheetNames).toContain('ИТОГО');
    expect(workbook.SheetNames).toContain('Демо Партнёр');
    const totalRows = XLSX.utils.sheet_to_json(workbook.Sheets['ИТОГО'], { header: 1 }) as unknown[][];
    expect(totalRows[0][0]).toContain('CEO ведомость');
    expect(totalRows[3]).toContain('Проект / клиент');
    expect(totalRows[3]).toContain('Сумма без НДС');
    expect(totalRows[3]).toContain('Партнер');
    expect(totalRows[3]).toContain('Распределено команде');
    expect(totalRows[totalRows.length - 1]).toContain('ИТОГО');
    expect(JSON.stringify(totalRows)).toContain('Демо Партнёр');
    expect(JSON.stringify(totalRows)).toContain('48');
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('admin has the unified command center and can edit project deadlines', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'admin');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    await expect(page.getByText('CEO-ведомость')).toBeVisible();
    const table = page.getByLabel('Единый свод проектов');
    const projectRow = table.locator(`tr[data-project-id="${demoProject.id}"]`);
    await expect(projectRow).toBeVisible();
    const projectDetails = projectRow.getByTestId(`project-details-${demoProject.id}`);
    await expect(projectDetails).toBeVisible();
    await projectDetails.getByTestId('project-management-details').locator('summary').click();
    await expect(projectRow.getByLabel(`Партнёр проекта ${demoProject.name}`)).toBeVisible();
    await expect(projectRow.getByLabel(`Руководитель проекта ${demoProject.name}`)).toBeVisible();
    await expect(projectRow).toContainText(/48\s*000\s*000\s*₸/);
    await expect(page.getByRole('button', { name: /Скачать Excel ИТОГО/ })).toBeVisible();
    await projectRow.getByRole('button', { name: /15\.01\.2026.*20\.12\.2026.*изменить/i }).click();
    await projectRow.getByLabel(`Начало проекта ${demoProject.name}`).fill('2026-02-01');
    await projectRow.getByLabel(`Дедлайн проекта ${demoProject.name}`).fill('2026-11-30');
    await projectRow.getByRole('button', { name: 'Сохранить', exact: true }).click();

    await expect.poll(() => network.mutationRequests.length).toBe(1);
    const payload = network.mutationRequests.map((request) => request.body || '').join('\n');
    expect(payload).toContain('2026-02-01');
    expect(payload).toContain('2026-11-30');
    expect(payload).toContain('serviceEndDate');
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('the unified CEO row replaces duplicate portfolio dashboards', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    await expect(page.getByLabel('Картина бизнеса генерального директора')).toBeHidden();
    await expect(page.getByText('Общая аналитика портфеля', { exact: true })).toBeHidden();
    const detail = page.getByLabel('Единый свод проектов').getByTestId(`project-details-${demoProject.id}`);
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Команда');
    await expect(detail).toContainText('Таймшиты');
    await expect(detail).toContainText('Как складывается доход');
    await expect(detail).toContainText('Ведомость бонусов');
    expect(network.productionMutations).toEqual([]);
  });

  for (const width of [390, 768]) {
    test(`mobile command center remains readable at ${width}px`, async ({ page }) => {
      const network = await loginAsDemoRole(page, 'ceo');
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/projects');
      await waitForDemoApp(page);
      await expect(page.getByText('CEO-ведомость')).toBeVisible();
      await expect(page.getByLabel('Картина бизнеса генерального директора')).toBeHidden();
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
      const shell = page.getByTestId('project-summary-shell');
      const detail = shell.locator(`tr[data-project-id="${demoProject.id}"]`).getByTestId(`project-details-${demoProject.id}`);
      await expect(detail).toBeVisible();
      await expect(detail.getByText('Таймшиты', { exact: true })).toBeAttached();
      await expect(detail.getByText('Как складывается доход', { exact: true })).toBeAttached();
      await expect(detail.getByText('Ведомость бонусов', { exact: true })).toBeAttached();
      await page.screenshot({ path: `test-results/command-center-${width}.png`, fullPage: true });
      expect(network.productionMutations).toEqual([]);
    });
  }
});
