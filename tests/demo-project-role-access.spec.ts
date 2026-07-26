import { expect, test, type Page } from '@playwright/test';
import { USER_ROLES, type UserRole } from '../src/types/roles';
import { DEMO_PROJECT_ID, demoProject, loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

const PROJECT_EDIT_ROLES: UserRole[] = ['procurement', 'admin'];
const TEAM_EDIT_ROLES: UserRole[] = ['ceo', 'deputy_director', 'admin'];

async function dynamicProjectSurface(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const unnamedButtons = Array.from(document.querySelectorAll('button'))
      .filter(visible)
      .filter((button) => {
        const id = button.getAttribute('id');
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
        return !(button.textContent?.trim() || label || button.getAttribute('aria-label') || button.getAttribute('title') || button.getAttribute('aria-labelledby'));
      })
      .map((button) => button.outerHTML.slice(0, 240));
    return {
      text: document.body.innerText,
      unnamedButtons,
      hasErrorBoundary: document.body.innerText.includes('Страница «страница» упала'),
      hasViteOverlay: Boolean(document.querySelector('vite-error-overlay')),
    };
  });
}

test.describe('project passport by every role', () => {
  for (const role of USER_ROLES) {
    test(`${role}: project, team, files and contract are role-correct`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      const network = await loginAsDemoRole(page, role);
      await page.goto(`/project/${DEMO_PROJECT_ID}`);
      await waitForDemoApp(page);

      await expect(page.getByRole('heading', { name: demoProject.name })).toBeVisible();
      await expect(page.getByText('Демо Партнёр').first()).toBeVisible();
      await expect(page.getByText('Демо Менеджер').first()).toBeVisible();
      await expect(page.getByText('14ч')).toBeVisible();
      await expect(page.getByText('+4ч ждут партнёра')).toBeVisible();

      const canEditProject = PROJECT_EDIT_ROLES.includes(role);
      const canEditTeam = TEAM_EDIT_ROLES.includes(role);
      await expect(page.getByRole('button', { name: 'Управлять в своде' })).toHaveCount(canEditTeam ? 1 : 0);

      await page.getByRole('tab', { name: /Файлы/ }).click();
      await expect(page.getByLabel('📁 Файлы').getByText('Договор_DEMO-2026-001.pdf')).toBeVisible();
      await expect(page.getByRole('button', { name: /Скачать файл/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Добавить файлы/ })).toHaveCount(canEditProject ? 1 : 0);
      await expect(page.getByRole('button', { name: /Удалить файл/ })).toHaveCount(canEditProject ? 1 : 0);

      await page.getByRole('tab', { name: /Договор/ }).click();
      await expect(page.getByRole('tabpanel').getByText('№DEMO-2026-001')).toBeVisible();
      const contractPanel = page.getByRole('tabpanel');
      await expect(contractPanel.getByRole('button', { name: 'Редактировать' })).toHaveCount(canEditProject ? 1 : 0);

      const surface = await dynamicProjectSurface(page);
      expect(surface.hasErrorBoundary).toBe(false);
      expect(surface.hasViteOverlay).toBe(false);
      expect(surface.text).not.toMatch(/\bNaN\b|\bundefined\b/);
      expect(surface.unnamedButtons).toEqual([]);
      expect(consoleErrors.filter((message) => !message.includes('favicon'))).toEqual([]);
      expect(network.productionMutations).toEqual([]);
      expect(network.unhandledRequests).toEqual([]);
    });
  }
});
