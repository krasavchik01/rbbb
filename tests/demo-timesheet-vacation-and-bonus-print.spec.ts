import { expect, test } from '@playwright/test';
import { loginAsDemoRole, waitForDemoApp } from './helpers/demo-fixtures';

test.describe('Vacation timesheets and employee bonus printing', () => {
  test('employee submits a vacation date range without project or bonus hours', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'assistant_1');
    await page.goto('/timesheets');
    await waitForDemoApp(page);

    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    const vacationType = page.getByRole('radio', { name: 'Отпуск', exact: true });
    await expect(vacationType).toBeVisible();
    await vacationType.click();
    await expect(page.getByText('Период попадёт в табель кодом «ОТ» и не добавит проектные часы или бонусы.')).toBeVisible();

    const dateInputs = page.getByRole('dialog').locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await dateInputs.nth(0).fill('2026-07-20');
    await dateInputs.nth(1).fill('2026-07-22');
    await page.getByRole('button', { name: 'Создать', exact: true }).click();

    await expect(page.getByText('Отпуск за 3 календ. дн. отправлен на проверку', { exact: true })).toBeVisible();
    const vacationMutation = network.mutationRequests.find((request) => (
      request.method === 'POST' && request.url.includes('/rest/v1/timesheet_entries')
    ));
    expect(vacationMutation).toBeTruthy();
    const rows = JSON.parse(vacationMutation?.body || '[]');
    expect(rows).toHaveLength(3);
    expect(rows.map((row: any) => row.work_date)).toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
    expect(rows.every((row: any) => (
      row.project_id === null
      && row.project_name === 'Отпуск'
      && row.hours === 0
      && row.section === '__vacation__'
      && row.status === 'submitted'
    ))).toBe(true);
    expect(network.productionMutations).toEqual([]);
  });

  test('employee receipt is the only printable body content', async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    const network = await loginAsDemoRole(page, 'ceo');
    await page.goto('/bonuses');
    await waitForDemoApp(page);

    const printButton = page.getByRole('button', { name: 'Распечатать ведомость: Демо Партнёр', exact: true });
    await expect(printButton).toBeVisible();
    await printButton.click();
    await expect(page.getByTestId('bonus-print-slip')).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    const printLayout = await page.evaluate(() => {
      const root = document.getElementById('root');
      const overlay = document.querySelector('.bonus-print-overlay');
      const slip = document.querySelector('.bonus-print-slip');
      return {
        bodyClass: document.body.classList.contains('bonus-print-mode'),
        overlayIsBodyChild: overlay?.parentElement === document.body,
        rootDisplay: root ? getComputedStyle(root).display : null,
        overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
        overlayPosition: overlay ? getComputedStyle(overlay).position : null,
        slipPosition: slip ? getComputedStyle(slip).position : null,
      };
    });

    expect(printLayout).toEqual({
      bodyClass: true,
      overlayIsBodyChild: true,
      rootDisplay: 'none',
      overlayDisplay: 'block',
      overlayPosition: 'static',
      slipPosition: 'static',
    });
    expect(network.productionMutations).toEqual([]);
  });
});
