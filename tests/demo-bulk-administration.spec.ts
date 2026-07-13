import { expect, test } from '@playwright/test';
import { demoProject, loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

test.describe('bulk administration and deputy project status', () => {
  test('CEO can select projects in bulk and sees an exact destructive preview', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/projects');
    await waitForDemoApp(page);

    const projectCheckbox = page.getByRole('checkbox', { name: `Выбрать проект ${demoProject.name}`, exact: true });
    await expect(projectCheckbox).toBeVisible();
    await projectCheckbox.check();
    await expect(page.getByText('Выбрано записей: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Удалить выбранные', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Удалить выбранные проекты?', exact: true })).toBeVisible();
    await expect(page.getByText(/Будет удалено записей: 1/)).toBeVisible();

    expect(network.productionMutations).toEqual([]);
    expect(network.mutationRequests).toEqual([]);
  });

  test('deputy director can choose Ready for bonuses but cannot finalize payment status', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto('/projects');
    await waitForDemoApp(page);

    const status = page.getByRole('combobox', { name: `Изменить статус проекта ${demoProject.name}`, exact: true });
    await expect(status).toBeVisible();
    await status.click();
    await expect(page.getByRole('option', { name: 'Готово к бонусам', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Завершён', exact: true })).toHaveCount(0);

    expect(network.productionMutations).toEqual([]);
    expect(network.mutationRequests).toEqual([]);
  });

  test('deputy director can start the two-step closure from the project workspace', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto(`/project/${demoProject.id}`);
    await waitForDemoApp(page);

    await expect(page.getByRole('button', { name: /Готов к закрытию/ })).toBeVisible();
    await expect(page.getByText(/Как заместитель директора, отметьте проект готовым/)).toBeVisible();

    expect(network.productionMutations).toEqual([]);
    expect(network.mutationRequests).toEqual([]);
  });

  test('CEO can select employees in bulk while the current account stays protected', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/hr?tab=employees');
    await waitForDemoApp(page);

    await expect(page.getByRole('checkbox', { name: /Алия Генеральный директор/ })).toBeDisabled();
    const employeeCheckbox = page.getByRole('checkbox', { name: /Демо Партнёр/ });
    await expect(employeeCheckbox).toBeVisible();
    await employeeCheckbox.check();
    await expect(page.getByText('Выбрано: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Удалить выбранных', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Удалить выбранных сотрудников?', exact: true })).toBeVisible();
    await expect(page.getByText(/Утверждённые часы и историческое участие/)).toBeVisible();

    expect(network.productionMutations).toEqual([]);
    expect(network.mutationRequests).toEqual([]);
  });
});
