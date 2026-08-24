import { expect, test } from '@playwright/test';
import { loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

test('admin searches people and roles in the role-check menu', async ({ page }) => {
  const network = await loginAsDemoRole(page, 'admin');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects');
  await waitForDemoApp(page);

  await page.getByText('Проверить роль', { exact: true }).click();
  const search = page.getByLabel('Поиск роли или сотрудника');
  await expect(search).toBeVisible();

  await search.fill('Ассистент');
  await expect(page.getByRole('option', { name: /Ассистент 1: Демо Ассистент/i })).toBeVisible();
  await expect(page.getByRole('option', { name: /Партнер: Демо Партнёр/i })).toHaveCount(0);

  await search.fill('Партнёр');
  await expect(page.getByRole('option', { name: /Партнер: Демо Партнёр/i })).toBeVisible();
  await expect(page.getByRole('option', { name: /Ассистент 1: Демо Ассистент/i })).toHaveCount(0);
  expect(network.productionMutations).toEqual([]);
});
