import { test, expect } from '@playwright/test';

/**
 * Интеграционный тест: создание проекта со всеми новыми полями
 */
test.describe('Complete Project Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Добавить логин как отдел закупок
  });

  test('should create project with files, stages, and services', async ({ page }) => {
    await page.goto('/create-project');
    
    // === ШАГ 1: Основная информация ===
    await page.fill('input[placeholder*="наименование клиента"]', 'Интеграционный тест');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-TEST-001');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Комплексный аудит');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '1000000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });
    
    // === ШАГ 2: Этапы проекта ===
    await page.check('input[data-testid="has-stages-checkbox"], input[id="hasStages"]');
    await expect(page.locator('[data-testid="project-stages-section"], text=Этапы проекта')).toBeVisible();
    
    // Добавляем первый этап
    await page.click('button:has-text("Добавить этап")');
    const stageNameInputs = page.locator('input[id*="stage-name"]');
    const stageStartInputs = page.locator('input[id*="stage-start"]');
    const stageEndInputs = page.locator('input[id*="stage-end"]');
    
    await stageNameInputs.last().fill('Подготовительный этап');
    await stageStartInputs.last().fill('2025-01-01');
    await stageEndInputs.last().fill('2025-03-31');
    
    // Добавляем второй этап
    await page.click('button:has-text("Добавить этап")');
    await stageNameInputs.last().fill('Основной этап аудита');
    await stageStartInputs.last().fill('2025-04-01');
    await stageEndInputs.last().fill('2025-09-30');
    
    // === ШАГ 3: Дополнительные услуги ===
    await page.check('input[data-testid="has-additional-services-checkbox"], input[id="hasAdditionalServices"]');
    await expect(page.locator('[data-testid="additional-services-section"], text=Дополнительные услуги')).toBeVisible();
    
    // Добавляем услугу
    await page.click('button:has-text("Добавить услугу")');
    const serviceNameInputs = page.locator('input[id*="service-name"]');
    const serviceDescInputs = page.locator('textarea[id*="service-desc"]');
    const serviceCostInputs = page.locator('input[id*="service-cost"]');
    
    await serviceNameInputs.last().fill('Обучение персонала');
    if (await serviceDescInputs.count() > 0) {
      await serviceDescInputs.last().fill('Проведение тренингов');
    }
    if (await serviceCostInputs.count() > 0) {
      await serviceCostInputs.last().fill('150000');
    }
    
    // === ШАГ 4: Файлы ===
    const fileInput = page.locator('input[data-testid="project-files-input"], input[id="projectFiles"]');
    await fileInput.setInputFiles([
      {
        name: 'contract.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF contract content')
      },
      {
        name: 'additional-doc.doc',
        mimeType: 'application/msword',
        buffer: Buffer.from('DOC content')
      }
    ]);
    
    await expect(page.locator('[data-testid="files-count"], text=Выбрано файлов: 2')).toBeVisible();
    
    // === ШАГ 5: Отправка ===
    await page.click('button[data-testid="submit-project-button"], button:has-text("Отправить на утверждение")');
    
    // Проверяем успешное создание
    await expect(page).toHaveURL(/\/projects/, { timeout: 15000 });
    
    // === ШАГ 6: Проверка в деталях проекта ===
    // Ждем появления проектов в списке
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    
    // Находим созданный проект и открываем его
    const projectCards = page.locator('[data-testid="project-card"]');
    const cardCount = await projectCards.count();
    if (cardCount > 0) {
      await projectCards.first().click();
      
      await page.waitForURL(/\/project\//, { timeout: 10000 });
      
      // Проверяем вкладку "Этапы"
      await page.click('button[data-testid="tab-stages"], button:has-text("Этапы")');
      await expect(page.locator('[data-testid="stages-tab-content"], text=Этапы проекта')).toBeVisible({ timeout: 5000 });
      
      // Проверяем вкладку "Услуги"
      await page.click('button[data-testid="tab-services"], button:has-text("Услуги")');
      await expect(page.locator('[data-testid="services-tab-content"], text=Дополнительные услуги')).toBeVisible({ timeout: 5000 });
      
      // Проверяем вкладку "Файлы"
      await page.click('button[data-testid="tab-files"], button:has-text("Файлы")');
      await expect(page.locator('text=Файлы проекта, [data-testid="project-files-section"]')).toBeVisible({ timeout: 5000 });
    }
  });
});

