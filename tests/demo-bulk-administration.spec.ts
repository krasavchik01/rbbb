import { expect, test } from '@playwright/test';
import { demoProject, loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

test.describe('bulk administration and deputy project status', () => {
  test('deputy director can add a GPH amount from the project summary', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.goto('/projects');
    await waitForDemoApp(page);

    await page.locator('tr').filter({ hasText: demoProject.name }).first().getByRole('button').first().click();
    await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
    await page.getByTestId('add-contractor').click();
    const contractorNameInput = page.getByTestId('contractor-name-input');
    const gphInput = page.getByTestId('contractor-amount-input');
    await expect(contractorNameInput).toBeVisible();
    await expect(gphInput).toBeVisible();
    await contractorNameInput.fill('Тестовый Исполнитель');
    await gphInput.fill('250000');
    await page.getByTestId('save-contractor-amount').click();
    await expect.poll(() => network.mutationRequests.filter((request) => request.url.includes('/rest/v1/projects')).length).toBe(1);
    const projectUpdate = network.mutationRequests.find((request) => request.url.includes('/rest/v1/projects'));
    expect(projectUpdate?.body).toContain('Тестовый Исполнитель');
    expect(projectUpdate?.body).toContain('250000');
    expect(network.productionMutations).toEqual([]);
  });

  test('shows a compact loading indicator while timesheet entries are fetched', async ({ page }) => {
    await loginAsDemoRole(page, 'ceo');
    let releaseTimesheetsRequest!: () => void;
    const timesheetsRequestGate = new Promise<void>((resolve) => {
      releaseTimesheetsRequest = resolve;
    });

    await page.route('**/rest/v1/timesheet_entries*', async (route) => {
      await timesheetsRequestGate;
      await route.fallback();
    });

    const navigation = page.goto('/timesheets');
    await expect(page.getByRole('status', { name: 'Загружаем таймшиты', exact: true })).toBeVisible();
    await expect(page.getByText('Загружаем записи…', { exact: true })).toBeVisible();

    releaseTimesheetsRequest();
    await navigation;
    await waitForDemoApp(page);
    await expect(page.getByRole('status', { name: 'Загружаем таймшиты', exact: true })).toHaveCount(0);
  });

  test('shows a clear loading state while the project summary is being fetched', async ({ page }) => {
    await loginAsDemoRole(page, 'ceo');
    let releaseProjectsRequest!: () => void;
    const projectsRequestGate = new Promise<void>((resolve) => {
      releaseProjectsRequest = resolve;
    });

    await page.route('**/rest/v1/projects*', async (route) => {
      await projectsRequestGate;
      await route.fallback();
    });

    const navigation = page.goto('/projects');
    await expect(page.getByRole('status', { name: 'Загружаем свод', exact: true })).toBeVisible();
    await expect(page.getByText('Получаем проекты, команды и показатели. Это может занять несколько секунд.', { exact: true })).toBeVisible();

    releaseProjectsRequest();
    await navigation;
    await waitForDemoApp(page);
    await expect(page.getByRole('status', { name: 'Загружаем свод', exact: true })).toHaveCount(0);
  });

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
