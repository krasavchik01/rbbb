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

  test('deputy director can assign a company while an assistant stays read-only', async ({ page }) => {
    let network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto(`/project/${demoProject.id}`);
    await waitForDemoApp(page);
    const companySelect = page.getByRole('combobox', { name: 'Выбрать компанию проекта', exact: true });
    const saveCompany = page.getByRole('button', { name: 'Назначить компанию', exact: true });
    await expect(companySelect).toBeVisible();
    await expect(saveCompany).toBeVisible();
    await companySelect.click();
    await page.getByRole('option').first().click();
    await saveCompany.click();
    await expect.poll(() => network.mutationRequests.filter((request) => request.url.includes('/rest/v1/projects')).length).toBe(1);
    expect(network.productionMutations).toEqual([]);

    network = await loginAsDemoRole(page, 'assistant_1');
    await page.goto(`/project/${demoProject.id}`);
    await waitForDemoApp(page);
    await expect(page.getByRole('button', { name: 'Назначить компанию', exact: true })).toHaveCount(0);
    expect(network.productionMutations).toEqual([]);
  });

  test('deputy director can prepare a bulk company assignment but cannot bulk delete', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto('/projects');
    await waitForDemoApp(page);

    const projectCheckbox = page.getByRole('checkbox', { name: `Выбрать проект ${demoProject.name}`, exact: true });
    await expect(projectCheckbox).toBeVisible();
    await projectCheckbox.check();
    const companySelect = page.getByRole('combobox', { name: 'Выбрать компанию для выбранных проектов', exact: true });
    const bulkAssign = page.getByRole('button', { name: 'Назначить компанию выбранным', exact: true });
    await expect(companySelect).toBeVisible();
    await expect(bulkAssign).toBeVisible();
    await expect(page.getByRole('button', { name: 'Удалить выбранные', exact: true })).toHaveCount(0);

    await companySelect.click();
    await page.getByRole('option').first().click();
    await bulkAssign.click();
    await expect(page.getByRole('heading', { name: 'Назначить компанию выбранным проектам?', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Назначить 1', exact: true }).click();
    await expect.poll(() => network.mutationRequests.filter((request) => request.url.includes('/rest/v1/projects')).length).toBe(1);

    expect(network.productionMutations).toEqual([]);
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
