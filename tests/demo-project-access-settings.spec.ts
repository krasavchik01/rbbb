import { expect, test } from '@playwright/test';
import { loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

function appSettingsPatches(network: Awaited<ReturnType<typeof loginAsDemoRole>>) {
  return network.mutationRequests.filter((request) => (
    request.method === 'POST' && request.url.includes('/api/project-access-settings')
  ));
}

test.describe('Project summary access settings', () => {
  test('admin controls every role with checkboxes and the saved matrix survives reload', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'admin');
    await page.goto('/settings?tab=access');
    await waitForDemoApp(page);

    const matrix = page.getByTestId('project-access-management');
    await expect(matrix).toBeVisible();

    const ceoBonus = page.getByRole('checkbox', { name: 'Генеральный директор (CEO): Бонусы' });
    const adminBonus = page.getByRole('checkbox', { name: 'Администратор: Бонусы' });
    const deputyBonus = page.getByRole('checkbox', { name: 'Заместитель генерального директора: Бонусы' });

    await expect(ceoBonus).toBeChecked();
    await expect(adminBonus).toBeChecked();
    await expect(deputyBonus).not.toBeChecked();

    await expect(deputyBonus).toBeDisabled();
    const deputyHours = page.getByRole('checkbox', { name: 'Заместитель генерального директора: Таймшиты' });
    await expect(deputyHours).toBeChecked();
    await deputyHours.click();
    await page.getByTestId('save-project-access').click();
    await expect.poll(() => appSettingsPatches(network).length).toBe(1);

    const patch = JSON.parse(appSettingsPatches(network)[0].body || '{}');
    expect(patch.projectAccess.bonuses).toEqual(['ceo', 'admin']);
    expect(patch.projectAccess.hours).not.toContain('deputy_director');

    await page.reload();
    await waitForDemoApp(page);
    await expect(page.getByTestId('project-access-management')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Заместитель генерального директора: Бонусы' })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Заместитель генерального директора: Таймшиты' })).not.toBeChecked();
    expect(network.productionMutations).toEqual([]);
  });

  test('CEO can inspect company access but cannot change the global visibility matrix', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/settings?tab=access');
    await waitForDemoApp(page);

    await expect(page.getByRole('heading', { name: 'Доступ к проектам по компаниям' })).toBeVisible();
    await expect(page.getByTestId('project-access-management')).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('deputy director does not receive the access-control tab', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto('/settings');
    await waitForDemoApp(page);

    await expect(page.getByRole('tab', { name: 'Доступы' })).toHaveCount(0);
    await expect(page.getByTestId('project-access-management')).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });
});
