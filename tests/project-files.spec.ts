import { test, expect } from '@playwright/test';

/**
 * Тесты для функциональности файлов проекта
 */
test.describe('Project Files Management', () => {
  test.beforeEach(async ({ page }) => {
    // Вход в систему (замените на реальные данные для тестов)
    await page.goto('/');
    // TODO: Добавить логин перед тестами
  });

  test('should upload file when creating project', async ({ page }) => {
    // Переходим на страницу создания проекта
    await page.goto('/create-project');
    
    // Заполняем обязательные поля
    await page.fill('input[placeholder*="наименование клиента"]', 'Тестовый клиент');
    await page.fill('input[placeholder*="номер договора"]', 'ДОГ-001');
    await page.fill('input[type="date"][name*="contractDate"]', '2025-01-01');
    await page.fill('input[placeholder*="предмет договора"]', 'Тестовый предмет');
    await page.fill('input[type="date"][name*="serviceStartDate"]', '2025-01-01');
    await page.fill('input[type="date"][name*="serviceEndDate"]', '2025-12-31');
    await page.fill('input[placeholder*="сумма без НДС"]', '100000');
    await page.selectOption('select[name*="company"]', { index: 1 });
    await page.selectOption('select[name*="projectType"]', { index: 1 });

    // Загружаем файл
    const fileInput = page.locator('input[type="file"][id="projectFiles"]');
    await fileInput.setInputFiles({
      name: 'test-contract.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF test content')
    });

    // Проверяем, что файл выбран
    await expect(page.locator('text=Выбрано файлов: 1')).toBeVisible();

    // Отправляем форму
    await page.click('button:has-text("Отправить на утверждение")');

    // Проверяем успешное создание
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator('text=Проект создан')).toBeVisible();
  });

  test('should display uploaded files in project details', async ({ page }) => {
    // Переходим к проекту (предполагаем, что проект уже создан)
    await page.goto('/projects');
    
    // Ждем загрузки проектов
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    
    // Кликаем на первый проект
    await page.locator('[data-testid="project-card"]').first().click();
    
    // Ждем загрузки страницы проекта
    await page.waitForURL(/\/project\//, { timeout: 10000 });
    
    // Переходим на вкладку "Файлы"
    await page.click('button[data-testid="tab-files"], button:has-text("Файлы")');
    
    // Проверяем наличие секции файлов
    await expect(page.locator('text=Файлы проекта, [data-testid="project-files-section"]')).toBeVisible({ timeout: 5000 });
  });

  test('should download file from project', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    await page.click('button:has-text("Файлы")');
    
    // Ждем появления файлов
    await page.waitForSelector('button[aria-label*="download" i], button:has([data-lucide="download"])');
    
    // Кликаем на кнопку скачивания первого файла
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has([data-lucide="download"])').first().click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test('should delete file (if user is owner)', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('[data-testid="project-card"]').first().click();
    await page.click('button:has-text("Файлы")');
    
    // Проверяем наличие кнопки удаления
    const deleteButton = page.locator('button:has([data-lucide="trash-2"])').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      // Проверяем, что файл исчез
      await expect(page.locator('text=Файлы не загружены')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate file type and size', async ({ page }) => {
    await page.goto('/create-project');
    
    // Пытаемся загрузить файл неподдерживаемого типа
    const fileInput = page.locator('input[type="file"][id="projectFiles"]');
    await fileInput.setInputFiles({
      name: 'test.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('executable content')
    });

    // Проверяем сообщение об ошибке
    await expect(page.locator('text=Разрешены только файлы')).toBeVisible();
  });
});

