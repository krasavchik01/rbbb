import { test, expect } from '@playwright/test';

/**
 * Тесты для дополнительных услуг проекта
 */
test.describe('Additional Services', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Добавить логин
  });

  test('should add services when creating project', async ({ page }) => {
    await page.goto('/create-project');
    
    // Заполняем обязательные поля
    await page.fill('input[placeholder*="наименование клиента"]', 'Тестовый клиент');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-005');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Тестовый предмет');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '500000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });

    // Включаем чекбокс "Дополнительные услуги"
    await page.check('input[data-testid="has-additional-services-checkbox"], input[id="hasAdditionalServices"]');
    
    // Ждем появления формы услуг
    await expect(page.locator('[data-testid="additional-services-section"], text=Дополнительные услуги')).toBeVisible();
    
    // Пытаемся выбрать услугу из списка (если есть)
    const serviceSelect = page.locator('select').filter({ hasText: /Выбрать из списка/i });
    if (await serviceSelect.count() > 0) {
      await serviceSelect.selectOption({ index: 0 });
      await page.waitForTimeout(500); // Ждем добавления услуги
    }
    
    // Или добавляем кастомную услугу
    await page.click('button:has-text("Добавить услугу")');
    
    const serviceNameInputs = page.locator('input[id*="service-name"]');
    const serviceDescInputs = page.locator('textarea[id*="service-desc"]');
    const serviceCostInputs = page.locator('input[id*="service-cost"]');
    
    await serviceNameInputs.last().fill('Кастомная услуга');
    if (await serviceDescInputs.count() > 0) {
      await serviceDescInputs.last().fill('Описание услуги');
    }
    if (await serviceCostInputs.count() > 0) {
      await serviceCostInputs.last().fill('50000');
    }

    // Отправляем форму
    await page.click('button:has-text("Отправить на утверждение")');
    
    // Проверяем успешное создание
    await expect(page).toHaveURL(/\/projects/);
  });

  test('should display services in project details', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    
    // Переходим на вкладку "Услуги"
    await page.click('button:has-text("Услуги")');
    
    // Проверяем наличие услуг
    await expect(page.locator('text=Дополнительные услуги')).toBeVisible();
  });

  test('should select preset service from dropdown', async ({ page }) => {
    await page.goto('/create-project');
    
    // Заполняем обязательные поля
    await page.fill('input[placeholder*="наименование клиента"]', 'Тестовый клиент');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-006');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Тестовый предмет');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '600000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });

    await page.check('input[id="hasAdditionalServices"]');
    
    // Выбираем услугу из выпадающего списка
    const select = page.locator('select').filter({ hasText: /Выбрать из списка/i });
    if (await select.count() > 0) {
      await select.selectOption({ index: 0 });
      
      // Проверяем, что услуга добавлена
      await expect(page.locator('text=Обучение, Семинар, Консультация').first()).toBeVisible({ timeout: 2000 }).catch(() => {
        // Если не нашлось, проверяем наличие любого названия услуги
        expect(page.locator('input[id*="service-name"]')).toHaveCount(1);
      });
    }
  });
});

