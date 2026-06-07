import { expect, test, type Page } from '@playwright/test';

type Role =
  | 'admin'
  | 'ceo'
  | 'deputy_director'
  | 'hr'
  | 'partner'
  | 'procurement'
  | 'assistant_1'
  | 'manager_1';

const roles: Role[] = [
  'admin',
  'ceo',
  'deputy_director',
  'hr',
  'partner',
  'procurement',
  'assistant_1',
  'manager_1',
];

const allRoles = roles;

const routeMatrix: Array<{ path: string; allowed: readonly Role[] }> = [
  { path: '/dashboard', allowed: allRoles },
  { path: '/projects', allowed: allRoles },
  { path: '/hr', allowed: ['admin', 'ceo', 'deputy_director', 'hr'] },
  { path: '/employees', allowed: ['admin', 'ceo', 'deputy_director', 'hr'] },
  { path: '/analytics', allowed: ['admin', 'ceo', 'deputy_director'] },
  { path: '/timesheets', allowed: allRoles },
  { path: '/timesheet-approval', allowed: ['admin', 'ceo', 'deputy_director', 'hr', 'partner'] },
  { path: '/assign-partners', allowed: ['admin', 'ceo', 'deputy_director'] },
  { path: '/bonuses', allowed: ['admin', 'ceo', 'deputy_director'] },
  { path: '/settings', allowed: allRoles },
  { path: '/calendar', allowed: allRoles },
  { path: '/tasks', allowed: allRoles },
  { path: '/attendance', allowed: allRoles },
  { path: '/user-management', allowed: ['admin'] },
  { path: '/create-project-procurement', allowed: ['admin', 'procurement'] },
  { path: '/project-approval', allowed: ['admin', 'ceo', 'deputy_director'] },
  { path: '/tenders', allowed: ['procurement'] },
  { path: '/diagnostics', allowed: ['admin'] },
  { path: '/database-test', allowed: ['admin'] },
  { path: '/notifications', allowed: allRoles },
  { path: '/smtp-settings', allowed: ['admin'] },
  { path: '/service-memos', allowed: allRoles },
  { path: '/role-management', allowed: ['admin'] },
  { path: '/settings-diagnostics', allowed: ['admin'] },
  { path: '/ai', allowed: ['admin', 'ceo', 'deputy_director', 'partner', 'hr'] },
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
            await expect(page).toHaveURL(new RegExp(`${routeInfo.path.replace('/', '\\/')}(?:[?#].*)?$`));
            await expect(page.locator('body')).not.toContainText('Вход в систему');
          } else {
            await expect(page).toHaveURL(/\/dashboard(?:[?#].*)?$/);
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
