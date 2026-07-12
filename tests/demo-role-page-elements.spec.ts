import { expect, test, type Page } from '@playwright/test';
import { ROUTE_ACCESS } from '../src/lib/roleAccess';
import { USER_ROLES, type UserRole } from '../src/types/roles';
import { ACTIVE_STATIC_ROUTES, PAGE_CATALOG, isKnownInternalHref } from '../scripts/demo-readiness/catalog.mjs';
import { loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

const BASE_SIDEBAR = ['/projects', '/timesheets', '/attendance', '/notifications', '/settings'];

function expectedSidebar(role: UserRole) {
  const routes = [...BASE_SIDEBAR];
  if (['hr', 'ceo', 'deputy_director', 'admin'].includes(role)) routes.push('/hr');
  if (role === 'procurement') routes.push('/create-project-procurement', '/tenders');
  if (role === 'admin') routes.push('/user-management', '/diagnostics');
  return routes.sort();
}

async function pageSurface(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const unnamedButtons = Array.from(document.querySelectorAll('button'))
      .filter(visible)
      .filter((button) => {
        const text = button.textContent?.trim() || '';
        const id = button.getAttribute('id');
        const associatedLabel = id
          ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim()
          : '';
        const labelledBy = button.getAttribute('aria-labelledby')
          ?.split(/\s+/)
          .map((labelId) => document.getElementById(labelId)?.textContent?.trim() || '')
          .join(' ')
          .trim();
        return !text && !associatedLabel && !labelledBy && !button.getAttribute('aria-label') && !button.getAttribute('title');
      })
      .map((button) => ({
        testId: button.getAttribute('data-testid'),
        icon: button.querySelector('svg')?.getAttribute('class') || button.querySelector('svg')?.outerHTML.slice(0, 120) || null,
        parentText: button.parentElement?.textContent?.trim().slice(0, 120) || '',
      }));
    const internalHrefs = Array.from(document.querySelectorAll('a[href]'))
      .filter(visible)
      .map((anchor) => anchor.getAttribute('href') || '')
      .filter((href) => href.startsWith('/'));
    return {
      text: document.body.innerText,
      unnamedButtons,
      internalHrefs,
      hasViteOverlay: Boolean(document.querySelector('vite-error-overlay')),
    };
  });
}

test.describe('demo sidebar by every role', () => {
  for (const role of USER_ROLES) {
    test(`${role}: sidebar is minimal and role-correct`, async ({ page }) => {
      const network = await loginAsDemoRole(page, role);
      await page.goto('/projects');
      await waitForDemoApp(page);

      const sidebarLinks = page.locator('[data-sidebar="content"] a[href]');
      const hrefs = (await sidebarLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') || ''))).sort();
      expect(hrefs).toEqual(expectedSidebar(role));
      expect(network.productionMutations).toEqual([]);
      expect(network.unhandledRequests).toEqual([]);
    });
  }
});

test.describe('every role and active page surface', () => {
  for (const role of USER_ROLES) {
    for (const [route, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
      if (!allowedRoles.includes(role)) continue;
      test(`${role}: ${route} has a complete usable surface`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        const network = await loginAsDemoRole(page, role);
        await page.goto(route);
        await waitForDemoApp(page);

        await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}(?:[?#].*)?$`));
        const surface = await pageSurface(page);
        const catalog = PAGE_CATALOG[route as keyof typeof PAGE_CATALOG];
        expect(catalog, `Missing page catalog entry for ${route}`).toBeTruthy();
        expect(catalog.expectedText.some((token: string) => surface.text.toLowerCase().includes(token.toLowerCase()))).toBe(true);
        expect(surface.text).not.toContain('Вход в систему');
        expect(surface.text).not.toMatch(/404|not found/i);
        expect(surface.text).not.toMatch(/\bNaN\b/);
        expect(surface.text).not.toMatch(/\bundefined\b/);
        expect(surface.hasViteOverlay).toBe(false);
        expect(surface.unnamedButtons).toEqual([]);
        expect(surface.internalHrefs.filter((href) => !isKnownInternalHref(href))).toEqual([]);
        expect(consoleErrors.filter((message) => !message.includes('favicon'))).toEqual([]);
        expect(network.productionMutations).toEqual([]);
        expect(network.unhandledRequests).toEqual([]);
        expect(ACTIVE_STATIC_ROUTES.has(route)).toBe(true);
      });
    }
  }
});
