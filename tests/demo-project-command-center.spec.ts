import { expect, test } from '@playwright/test';
import { demoProject, loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

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

  test('portfolio analytics, workload chart and integrity drawer are visible to CEO', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    await expect(page.getByLabel('CEO portfolio pulse')).toBeVisible();
    await expect(page.getByLabel('Загрузка команды по таймшитам')).toBeVisible();
    await page.getByTitle('Раскрыть').first().click();
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
      await expect(page.getByLabel(`Паспорт проекта ${demoProject.name}`)).toBeVisible();
      await expect(page.getByText('Финансовый waterfall CEO')).toBeVisible();
      await page.screenshot({ path: `test-results/command-center-${width}.png`, fullPage: true });
      expect(network.productionMutations).toEqual([]);
    });
  }
});
