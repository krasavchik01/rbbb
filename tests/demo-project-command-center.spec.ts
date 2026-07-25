import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { demoProject, loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

test.describe('CEO command center completion', () => {
  test('column filters and saved views are usable in the project summary', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Название вида');
      await dialog.accept('CEO daily demo');
    });
    await page.getByRole('button', { name: 'Сохранить вид' }).click();
    await expect(page.getByRole('combobox', { name: 'Сохранённые виды свода' })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('rbbb:project-command-center:saved-views:v1') || '')).toContain('CEO daily demo');

    await expect(page.getByRole('button', { name: 'Фильтр колонки: Наша компания' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр колонки: Договор' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр колонки: Предмет договора' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр колонки: Этап' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр колонки: Бизнес-сезон' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Фильтр колонки: Часы' })).toBeVisible();

    await page.getByRole('button', { name: 'Фильтр колонки: Проект / клиент' }).click();
    await page.getByLabel('Поиск по колонке Проект / клиент').fill(demoProject.name.slice(0, 12));
    await expect(page.getByText('Фильтры колонок:')).toBeVisible();
    await expect(page.getByRole('link', { name: demoProject.name })).toBeVisible();
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

  test('admin has CEO command center and can edit project deadlines and contract amount', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'admin');
    await page.goto('/projects');
    await waitForDemoApp(page);

    await expect(page.getByText('CEO-ведомость')).toBeVisible();
    await expect(page.getByLabel('CEO portfolio pulse')).toBeVisible();
    await expect(page.getByLabel('Общая CEO-таблица проектов')).toBeVisible();
    await expect(page.getByLabel(`Партнёр проекта ${demoProject.name}`)).toBeVisible();
    await expect(page.getByLabel(`Руководитель проекта ${demoProject.name}`)).toBeVisible();
    await expect(page.getByText('Сложность: Низкая')).toBeVisible();
    await expect(page.getByRole('button', { name: /Скачать Excel ИТОГО/ })).toBeVisible();
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    await page.getByLabel(`Сумма договора ${demoProject.name}`).fill('12345678');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect.poll(() => network.mutationRequests.map((request) => request.body || '').join('\n')).toContain('12345678');

    await page.getByRole('button', { name: 'Изменить сроки' }).first().click();
    await expect(page.getByLabel(`Краткая карточка проекта ${demoProject.name}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Скачать договор', exact: true }).first()).toBeVisible();
    await page.getByLabel(`Начало проекта ${demoProject.name}`).fill('2026-02-01');
    await page.getByLabel(`Дедлайн проекта ${demoProject.name}`).fill('2026-11-30');
    await page.getByRole('button', { name: 'Сохранить сроки' }).click();

    await expect.poll(() => network.mutationRequests.length).toBeGreaterThan(1);
    const payload = network.mutationRequests.map((request) => request.body || '').join('\n');
    expect(payload).toContain('2026-02-01');
    expect(payload).toContain('2026-11-30');
    expect(payload).toContain('serviceEndDate');
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('portfolio analytics, workload chart and integrity drawer are visible to CEO', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    await expect(page.getByLabel('CEO portfolio pulse')).toBeVisible();
    await expect(page.getByLabel('Загрузка команды по таймшитам')).toBeVisible();
    await page.getByTitle('Раскрыть').first().click();
    await expect(page.getByLabel(`Краткая карточка проекта ${demoProject.name}`)).toBeVisible();
    await page.getByRole('button', { name: 'Расширенное редактирование' }).click();
    await expect(page.getByLabel('Проверка целостности данных проекта')).toBeVisible();
    await expect(page.getByText('Это read-only проверка. Массовые исправления запрещены без preview и подтверждения.')).toBeVisible();
    expect(network.productionMutations).toEqual([]);
  });

  for (const width of [390, 768]) {
    test(`mobile command center remains readable at ${width}px`, async ({ page }) => {
      const network = await loginAsDemoRole(page, 'ceo');
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/projects');
      await waitForDemoApp(page);
      await expect(page.getByText('CEO-ведомость')).toBeVisible();
      await expect(page.getByLabel('CEO portfolio pulse')).toBeVisible();
      await page.getByTitle('Раскрыть').first().click();
      await expect(page.getByLabel(`Краткая карточка проекта ${demoProject.name}`)).toBeVisible();
      await expect(page.getByText('Таймшиты', { exact: true }).last()).toBeAttached();
      await expect(page.getByText('Финансы CEO', { exact: true })).toBeAttached();
      await page.screenshot({ path: `test-results/command-center-${width}.png`, fullPage: true });
      expect(network.productionMutations).toEqual([]);
    });
  }
});
