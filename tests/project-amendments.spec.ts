import { test, expect } from '@playwright/test';

/**
 * Тесты для доп соглашений проекта
 */
test.describe('Project Amendments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Добавить логин как отдел закупок
  });

  test('should add amendment to existing project (procurement only)', async ({ page }) => {
    // Переходим к существующему проекту
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    
    await page.waitForURL(/\/project\//, { timeout: 10000 });
    
    // Переходим на вкладку "Доп соглашения"
    await page.click('button[data-testid="tab-amendments"], button:has-text("Доп соглашения")');
    
    // Проверяем наличие кнопки добавления (только для отдела закупок)
    const addButton = page.locator('button[data-testid="add-amendment-button"], button:has-text("Добавить доп соглашение")');
    
    if (await addButton.isVisible({ timeout: 2000 })) {
      await addButton.click();
      
      // Заполняем форму доп соглашения
      await page.fill('input[id="amendment-number"]', 'ДС-001');
      await page.fill('input[id="amendment-date"]', '2025-01-15');
      await page.fill('textarea[id="amendment-description"]', 'Изменение суммы договора на 10%');
      
      // Опционально загружаем файл
      const fileInput = page.locator('input[type="file"][id="amendment-file"]');
      await fileInput.setInputFiles({
        name: 'amendment.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF amendment content')
      });
      
      // Сохраняем
      await page.click('button:has-text("Добавить доп соглашение"):not([disabled])');
      
      // Проверяем успешное добавление
      await expect(page.locator('text=Доп соглашение добавлено')).toBeVisible({ timeout: 5000 });
      
      // Проверяем, что доп соглашение отображается в списке
      await expect(page.locator('text=ДС-001')).toBeVisible();
    } else {
      // Если кнопка не видна, значит пользователь не из отдела закупок
      test.skip();
    }
  });

  test('should display amendments in project details', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    
    // Переходим на вкладку "Доп соглашения"
    await page.click('button:has-text("Доп соглашения")');
    
    // Проверяем наличие секции
    await expect(page.locator('text=Дополнительные соглашения')).toBeVisible();
  });

  test('should validate amendment form fields', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    await page.click('button:has-text("Доп соглашения")');
    
    const addButton = page.locator('button:has-text("Добавить доп соглашение")');
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Пытаемся сохранить без заполнения полей
      await page.click('button:has-text("Добавить доп соглашение"):not([disabled])');
      
      // Проверяем сообщения об ошибках
      await expect(page.locator('text=Укажите номер доп соглашения, Укажите дату доп соглашения, Укажите описание изменений').first()).toBeVisible({ timeout: 2000 });
    }
  });

  test('should download amendment file', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    await page.click('button:has-text("Доп соглашения")');
    
    // Ищем ссылку на файл доп соглашения
    const fileLink = page.locator('a:has-text("Открыть файл")').first();
    
    if (await fileLink.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await fileLink.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBeTruthy();
    }
  });
});

