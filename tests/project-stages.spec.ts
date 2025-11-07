import { test, expect } from '@playwright/test';

/**
 * Тесты для этапов проекта
 */
test.describe('Project Stages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Добавить логин
  });

  test('should add stages when creating project', async ({ page }) => {
    await page.goto('/create-project');
    
    // Заполняем обязательные поля
    await page.fill('input[placeholder*="наименование клиента"]', 'Тестовый клиент');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-002');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Тестовый предмет');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '200000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });

    // Включаем чекбокс "Этапы проекта"
    await page.check('input[data-testid="has-stages-checkbox"], input[id="hasStages"]');
    
    // Ждем появления формы этапов
    await expect(page.locator('[data-testid="project-stages-section"], text=Этапы проекта')).toBeVisible();
    
    // Добавляем этап
    await page.click('button:has-text("Добавить этап")');
    
    // Заполняем данные этапа (берем последний добавленный)
    const stageNameInputs = page.locator('input[id*="stage-name"]');
    const stageStartInputs = page.locator('input[id*="stage-start"]');
    const stageEndInputs = page.locator('input[id*="stage-end"]');
    const stageDescInputs = page.locator('textarea[id*="stage-desc"]');
    
    await stageNameInputs.last().fill('Аудит за 6 месяцев');
    await stageStartInputs.last().fill('2025-01-01');
    await stageEndInputs.last().fill('2025-06-30');
    if (await stageDescInputs.count() > 0) {
      await stageDescInputs.last().fill('Первый этап аудита');
    }

    // Отправляем форму
    await page.click('button[data-testid="submit-project-button"], button:has-text("Отправить на утверждение")');
    
    // Проверяем успешное создание
    await expect(page).toHaveURL(/\/projects/, { timeout: 15000 });
  });

  test('should display stages in project details', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    await page.locator('[data-testid="project-card"]').first().click();
    
    await page.waitForURL(/\/project\//, { timeout: 10000 });
    
    // Переходим на вкладку "Этапы"
    await page.click('button[data-testid="tab-stages"], button:has-text("Этапы")');
    
    // Проверяем наличие секции этапов
    await expect(page.locator('[data-testid="stages-tab-content"], text=Этапы проекта')).toBeVisible({ timeout: 5000 });
    
    // Проверяем отображение этапа (если есть)
    const stages = page.locator('[data-testid="project-stage"]');
    const stageCount = await stages.count();
    if (stageCount > 0) {
      await expect(stages.first()).toBeVisible();
    }
  });

  test('should add multiple stages', async ({ page }) => {
    await page.goto('/create-project');
    
    // Заполняем обязательные поля
    await page.fill('input[placeholder*="наименование клиента"]', 'Тестовый клиент');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-003');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Тестовый предмет');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '300000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });

    await page.check('input[id="hasStages"]');
    
    // Добавляем первый этап
    await page.click('button:has-text("Добавить этап")');
    await page.fill('input[id*="stage-name"]:last-of-type', 'Этап 1');
    await page.fill('input[id*="stage-start"]:last-of-type', '2025-01-01');
    await page.fill('input[id*="stage-end"]:last-of-type', '2025-03-31');
    
    // Добавляем второй этап
    await page.click('button:has-text("Добавить этап")');
    await page.fill('input[id*="stage-name"]:last-of-type', 'Этап 2');
    await page.fill('input[id*="stage-start"]:last-of-type', '2025-04-01');
    await page.fill('input[id*="stage-end"]:last-of-type', '2025-06-30');
    
    // Проверяем, что оба этапа отображаются
    const stageInputs = page.locator('input[id*="stage-name"]');
    await expect(stageInputs).toHaveCount(2);
  });

  test('should remove stage', async ({ page }) => {
    await page.goto('/create-project');
    
    // Заполняем обязательные поля
    await page.fill('input[placeholder*="наименование клиента"]', 'Тестовый клиент');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-004');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Тестовый предмет');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '400000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });

    await page.check('input[id="hasStages"]');
    
    // Добавляем этап
    await page.click('button:has-text("Добавить этап")');
    
    // Удаляем этап
    await page.click('button:has([data-lucide="trash-2"])');
    
    // Проверяем, что этап удален
    await expect(page.locator('text=Этапы не добавлены')).toBeVisible();
  });
});

