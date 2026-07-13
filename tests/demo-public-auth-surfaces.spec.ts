import { expect, test, type Page } from '@playwright/test';
import { installDemoNetwork, waitForDemoApp } from './helpers/demo-fixtures';

const PUBLIC_SURFACES = [
  { route: '/', heading: 'Вход в систему' },
  { route: '/register', heading: 'Регистрация' },
  { route: '/forgot-password', heading: 'Восстановление пароля' },
  { route: '/reset-password', heading: 'Новый пароль' },
];

async function unnamedVisibleButtons(page: Page) {
  return page.locator('button:visible').evaluateAll((buttons) => buttons
    .filter((button) => {
      const id = button.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
      return !(button.textContent?.trim() || label || button.getAttribute('aria-label') || button.getAttribute('title') || button.getAttribute('aria-labelledby'));
    })
    .map((button) => button.outerHTML.slice(0, 240)));
}

test.describe('public authentication surfaces', () => {
  for (const surface of PUBLIC_SURFACES) {
    test(`${surface.route} is clear, accessible and production-isolated`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      const network = await installDemoNetwork(page);
      await page.goto(surface.route);
      await waitForDemoApp(page);

      await expect(page.getByRole('heading', { name: surface.heading, exact: true })).toBeVisible();
      await expect(unnamedVisibleButtons(page)).resolves.toEqual([]);
      expect(consoleErrors.filter((message) => !message.includes('favicon'))).toEqual([]);
      expect(network.productionMutations).toEqual([]);
      expect(network.unhandledRequests).toEqual([]);
    });
  }

  test('password visibility controls expose their current action', async ({ page }) => {
    const network = await installDemoNetwork(page);
    await page.goto('/');
    await waitForDemoApp(page);

    const showPassword = page.getByRole('button', { name: 'Показать пароль' });
    await expect(showPassword).toBeVisible();
    await showPassword.click();
    await expect(page.getByRole('button', { name: 'Скрыть пароль' })).toBeVisible();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    expect(network.productionMutations).toEqual([]);
  });
});
