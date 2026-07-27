import { expect, test } from '@playwright/test';
import {
  DEMO_PROJECT_ID,
  demoProject,
  loginAsDemoRole,
  waitForDemoApp,
  type DemoNetworkJournal,
} from './helpers/demo-fixtures';

function projectPatches(network: DemoNetworkJournal) {
  return network.mutationRequests.filter((request) => {
    if (request.method !== 'PATCH' || !request.url.includes('/rest/v1/projects')) return false;
    return new URL(request.url).searchParams.get('id') === `eq.${DEMO_PROJECT_ID}`;
  });
}

function patchPayload(network: DemoNetworkJournal, index = -1) {
  const patches = projectPatches(network);
  const request = index < 0 ? patches.at(index) : patches[index];
  expect(request, 'expected a PATCH for the existing demo project').toBeTruthy();
  return JSON.parse(request?.body || '{}') as Record<string, unknown>;
}

function patchNotes(network: DemoNetworkJournal, index = -1) {
  const payload = patchPayload(network, index);
  return typeof payload.notes === 'string'
    ? JSON.parse(payload.notes) as Record<string, any>
    : payload.notes as Record<string, any>;
}

test.describe('procurement edits an existing project without privileged access', () => {
  test('procurement changes project deadlines in the unified summary', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'procurement');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const row = page
      .getByTestId('project-summary-shell')
      .locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
    await expect(row).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Создать проект', exact: true })).toBeVisible();
    await expect(row.getByRole('link', { name: 'Редактировать проект', exact: true })).toBeVisible();

    const dateEditor = row.getByRole('button', { name: /15\.01\.2026.*20\.12\.2026.*изменить/i });
    await expect(dateEditor).toBeEnabled();
    await dateEditor.click();
    await row.getByLabel(`Начало проекта ${demoProject.name}`).fill('2026-02-02');
    await row.getByLabel(`Дедлайн проекта ${demoProject.name}`).fill('2026-11-29');
    await row.getByRole('button', { name: 'Сохранить', exact: true }).click();

    await expect.poll(() => projectPatches(network).length).toBe(1);
    const payload = patchPayload(network);
    const notes = patchNotes(network);
    expect(payload.start_date).toBe('2026-02-02');
    expect(payload.deadline).toBe('2026-11-29');
    expect(notes.contract).toMatchObject({
      serviceStartDate: '2026-02-02',
      serviceEndDate: '2026-11-29',
    });

    await expect(row.getByTestId('project-bonus-editor')).toHaveCount(0);
    await expect(row.locator('[data-testid^="member-bonus-"]')).toHaveCount(0);
    await expect(row.getByRole('combobox', { name: `Изменить статус проекта ${demoProject.name}` })).toHaveCount(0);
    await expect(row.getByRole('button', { name: `Партнёр проекта ${demoProject.name}` })).toHaveCount(0);
    await expect(row.getByRole('button', { name: `Руководитель проекта ${demoProject.name}` })).toHaveCount(0);
    await expect(row.getByRole('button', { name: /Убрать .* из команды проекта/i })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Удалить', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('project-bulk-actions')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Бонусы', exact: true })).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });

  test('procurement updates the project card and contract in its editor', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'procurement');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const row = page
      .getByTestId('project-summary-shell')
      .locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
    await row.getByRole('link', { name: 'Редактировать проект', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/project/${DEMO_PROJECT_ID}(?:[?#].*)?$`));

    const dialog = page.getByRole('dialog', { name: 'Редактирование проекта' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Название клиента').fill('АО Демо клиент — уточнено закупками');
    await dialog.getByRole('tab', { name: 'Договор', exact: true }).click();

    const contractPanel = dialog.getByRole('tabpanel');
    const contractInputs = contractPanel.locator('input');
    await contractInputs.nth(0).fill('DEMO-2026-001-ДС');
    await contractInputs.nth(1).fill('2026-02-01');
    await contractPanel.locator('textarea').fill('Аудит и сопровождение по уточнённому договору');
    await contractInputs.nth(2).fill('2026-02-02');
    await contractInputs.nth(3).fill('2026-11-29');
    await contractInputs.nth(4).fill('49000000');
    await dialog.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();

    await expect.poll(() => projectPatches(network).length).toBe(1);
    const payload = patchPayload(network);
    const notes = patchNotes(network);
    expect(payload.start_date).toBe('2026-02-02');
    expect(payload.deadline).toBe('2026-11-29');
    expect(notes.client).toMatchObject({
      name: 'АО Демо клиент — уточнено закупками',
    });
    expect(notes.contract).toMatchObject({
      number: 'DEMO-2026-001-ДС',
      date: '2026-02-01',
      subject: 'Аудит и сопровождение по уточнённому договору',
      serviceStartDate: '2026-02-02',
      serviceEndDate: '2026-11-29',
      amountWithoutVAT: 49_000_000,
    });
    expect(notes.finances).toMatchObject({
      amountWithoutVAT: 49_000_000,
    });

    await expect(page.getByText('Бонусы', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Управлять в своде', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Назначить компанию', exact: true })).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
    expect(network.unhandledRequests).toEqual([]);
  });
});
