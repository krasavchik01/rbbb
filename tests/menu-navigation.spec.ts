import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke-test активных пунктов навигации.
 *
 * Исторически этот файл пытался кликать по тексту меню и часто попадал в
 * заголовки/дубли вместо ссылок. Для product-cleanup важнее другое:
 * активные route должны открываться под admin, а legacy-мусор не должен быть
 * частью матрицы меню.
 */

type Role = 'admin' | 'ceo' | 'deputy_director' | 'hr' | 'partner' | 'procurement' | 'assistant_1' | 'manager_1';

async function blockProductionNetwork(page: Page) {
  await page.route('**://*.supabase.co/**', async (route) => {
    const url = route.request().url();
    const body = url.includes('/auth/v1/user') ? { user: null } : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], success: true, projects: [], tasks: [] }),
    });
  });
}

async function loginAs(page: Page, role: Role = 'admin') {
  await blockProductionNetwork(page);
  await page.goto('/');
  await page.evaluate((currentRole) => {
    localStorage.clear();
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: `qa-${currentRole}`,
        email: `${currentRole}@example.invalid`,
        name: `QA ${currentRole}`,
        role: currentRole,
        department: 'QA',
        position: currentRole,
      })
    );
  }, role);
}

const activeAdminRoutes = [
  '/',
  '/projects',
  '/project-approval',
  '/hr',
  '/timesheets',
  '/timesheet-approval',
  '/attendance',
  '/bonuses',
  '/analytics',
  '/calendar',
  '/tasks',
  '/notifications',
  '/settings',
  '/user-management',
  '/diagnostics',
  '/database-test',
  '/smtp-settings',
  '/service-memos',
  '/ai',
];

const removedLegacyRoutes = [
  '/survey',
  '/project-survey',
  '/project-survey-results',
  '/import-timesheet',
  '/create-project',
  '/template-constructor/new',
  '/msuk-compliance',
  '/audit',
  '/ifrs9',
];

test.describe('Menu/navigation smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  for (const route of activeAdminRoutes) {
    test(`active admin route opens: ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

      await expect(page.locator('body')).not.toContainText('Вход в систему');
      await expect(page).not.toHaveURL(/\/404(?:[?#].*)?$/);
      await expect(page.locator('body')).not.toContainText(/not found/i);
    });
  }

  test('legacy product routes are not part of active menu smoke matrix', () => {
    for (const route of removedLegacyRoutes) {
      expect(activeAdminRoutes).not.toContain(route);
    }
  });
});
