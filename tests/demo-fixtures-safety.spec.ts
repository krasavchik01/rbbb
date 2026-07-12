import { expect, test } from '@playwright/test';
import { loginAsDemoRole } from './helpers/demo-fixtures';

test('demo fixtures block production and render business data', async ({ page }) => {
  const network = await loginAsDemoRole(page, 'admin');
  await page.goto('/projects');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('body')).not.toContainText('Вход в систему');
  await expect(page.locator('body')).toContainText('АО Демонстрационный клиент');
  expect(network.unhandledRequests).toEqual([]);
  expect(network.productionMutations).toEqual([]);
  expect(network.requests.length).toBeGreaterThan(0);
});
