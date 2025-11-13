import { test, expect } from '@playwright/test';

/**
 * Детальная проверка всех страниц с скриншотами
 */
test.describe('Детальная проверка всех страниц', () => {
  const BASE_URL = 'http://localhost:8080';

  test.beforeEach(async ({ page }) => {
    // Логинимся через localStorage
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.clear();
      const user = {
        id: 'ceo_1',
        email: 'ceo@rbpartners.com',
        name: 'Генеральный Директор',
        role: 'ceo',
        position: 'Генеральный директор (CEO)'
      };
      localStorage.setItem('user', JSON.stringify(user));
    });
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  const pages = [
    { name: 'Дашборд', url: '/dashboard', checkText: ['Дашборд', 'Проекты', 'Сотрудники'] },
    { name: 'Проекты', url: '/projects', checkText: ['Проекты', 'Создать'] },
    { name: 'Бонусы', url: '/bonuses', checkText: ['Бонусы', '₸', 'Список бонусов'] },
    { name: 'Аналитика', url: '/analytics', checkText: ['Аналитика', 'Проекты', 'Финансы'] },
    { name: 'Календарь', url: '/calendar', checkText: ['Календарь', 'Предстоящие'] },
    { name: 'Задачи', url: '/tasks', checkText: ['Задачи', 'Список', 'Канбан'] },
    { name: 'Настройки', url: '/settings', checkText: ['Настройки', 'Профиль', 'Уведомления'] },
    { name: 'HR', url: '/hr', checkText: ['HR', 'Сотрудники'] },
    { name: 'Тайм-щиты', url: '/timesheets', checkText: ['Тайм-щиты'] },
    { name: 'Посещаемость', url: '/attendance', checkText: ['Посещаемость'] },
  ];

  for (const pageInfo of pages) {
    test(`Проверка страницы: ${pageInfo.name}`, async ({ page }) => {
      await page.goto(`${BASE_URL}${pageInfo.url}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Проверяем что страница загрузилась
      const bodyText = await page.locator('body').textContent();
      
      // Проверяем наличие ожидаемого текста
      const hasExpectedText = pageInfo.checkText.some(text => 
        bodyText?.toLowerCase().includes(text.toLowerCase())
      );

      // Проверяем отсутствие заглушек
      const hasStub = bodyText?.includes('в разработке') || 
                      bodyText?.includes('будет система') ||
                      bodyText?.includes('здесь будет');

      // Проверяем отсутствие ошибок
      const hasErrors = await page.locator('text=/ошибка|error|404|not found/i').count() > 0;
      
      // Делаем скриншот
      await page.screenshot({ 
        path: `test-results/screenshot-${pageInfo.name.replace(/\s+/g, '-')}.png`,
        fullPage: true 
      });

      // Проверки
      expect(hasExpectedText, `Страница ${pageInfo.name} должна содержать ожидаемый текст`).toBe(true);
      expect(hasStub, `Страница ${pageInfo.name} не должна содержать заглушки`).toBe(false);
      expect(hasErrors, `Страница ${pageInfo.name} не должна содержать ошибки`).toBe(false);
      
      // Проверяем что есть контент (не пустая страница)
      const contentLength = bodyText?.length || 0;
      expect(contentLength, `Страница ${pageInfo.name} должна содержать контент`).toBeGreaterThan(500);
    });
  }

  test('Проверка консоли на ошибки', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Проходим по всем страницам
    for (const pageInfo of pages) {
      await page.goto(`${BASE_URL}${pageInfo.url}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Фильтруем только критичные ошибки (NaN в children)
    const criticalErrors = errors.filter(e => 
      e.includes('NaN') && e.includes('children') ||
      e.includes('Failed to') ||
      e.includes('Cannot read')
    );

    console.log('Найденные ошибки:', errors);
    expect(criticalErrors.length, `Не должно быть критичных ошибок: ${criticalErrors.join(', ')}`).toBe(0);
  });
});

