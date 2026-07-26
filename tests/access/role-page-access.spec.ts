import { expect, test, type Page } from '@playwright/test';
import { ROUTE_ACCESS } from '../../src/lib/roleAccess';
import { USER_ROLES, type UserRole } from '../../src/types/roles';

type Role = UserRole;

const roles: Role[] = USER_ROLES;
const unifiedProjectRoutes: Record<string, string> = {
  '/assign-partners': '/projects',
  '/bonuses': '/projects',
  '/project-approval': '/projects',
};

const routeMatrix: Array<{ path: string; allowed: readonly Role[]; expectedPath?: string }> = [
  { path: '/dashboard', allowed: roles, expectedPath: '/projects' },
  { path: '/timesheet-approval', allowed: roles, expectedPath: '/projects' },
  { path: '/calendar', allowed: roles, expectedPath: '/projects' },
  { path: '/tasks', allowed: roles, expectedPath: '/projects' },
  ...Object.entries(ROUTE_ACCESS).map(([path, allowed]) => ({
    path,
    allowed,
    expectedPath: unifiedProjectRoutes[path],
  })),
];

async function blockProductionNetwork(page: Page) {
  await page.route('**://*.supabase.co/**', async (route) => {
    const url = route.request().url();
    const body = url.includes('/auth/v1/user')
      ? { user: null }
      : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], success: true, projects: [], tasks: [] }),
    });
  });
}

async function loginAs(page: Page, role: Role) {
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

test.describe('production-safe role route access matrix', () => {
  for (const role of roles) {
    test.describe(`role=${role}`, () => {
      for (const routeInfo of routeMatrix) {
        test(`${role} -> ${routeInfo.path}`, async ({ page }) => {
          await loginAs(page, role);
          await page.goto(routeInfo.path);

          const allowed = routeInfo.allowed.includes(role);
          if (allowed) {
            const expectedPath = routeInfo.expectedPath || routeInfo.path;
            await expect(page).toHaveURL(new RegExp(`${expectedPath.replace('/', '\\/')}(?:[?#].*)?$`));
            await expect(page.locator('body')).not.toContainText('Вход в систему');
          } else {
            await expect(page).toHaveURL(/\/projects(?:[?#].*)?$/);
          }
        });
      }
    });
  }
});


test.describe('legacy workflow redirects', () => {
  const redirects = [
    ['/survey', /\/projects(?:[?#].*)?$/],
    ['/project-survey', /\/projects(?:[?#].*)?$/],
    ['/project-survey-results', /\/projects(?:[?#].*)?$/],
    ['/import-timesheet', /\/timesheets(?:[?#].*)?$/],
    ['/create-project', /\/create-project-procurement(?:[?#].*)?$/],
    ['/template-constructor/new', /\/create-project-procurement(?:[?#].*)?$/],
    ['/msuk-compliance', /\/projects(?:[?#].*)?$/],
    ['/service-memos', /\/projects(?:[?#].*)?$/],
  ] as const;

  for (const [from, to] of redirects) {
    test(`${from} redirects to active workflow`, async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto(from);
      await expect(page).toHaveURL(to);
      await expect(page.locator('body')).not.toContainText('Опрос и команды');
      await expect(page.locator('body')).not.toContainText('Создать шаблон');
    });
  }
});

test.describe('unauthenticated route protection', () => {
  for (const routeInfo of routeMatrix.filter((item) => item.path !== '/dashboard').slice(0, 8)) {
    test(`guest -> ${routeInfo.path} redirects to login`, async ({ page }) => {
      await blockProductionNetwork(page);
      await page.goto(routeInfo.path);
      await expect(page).toHaveURL(/\/$/);
    });
  }
});
