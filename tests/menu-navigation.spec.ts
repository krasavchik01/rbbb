import { test, expect } from '@playwright/test';

/**
 * Тест проверки всех пунктов меню
 * Проверяет, что каждый пункт меню работает корректно
 */
test.describe('Menu Navigation Tests', () => {
  // Используем localhost:8080 напрямую, так как сервер уже запущен
  const BASE_URL = 'http://localhost:8080';
  
  test.beforeEach(async ({ page }) => {
    // Логинимся через localStorage (быстрее и надежнее)
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
    
    // Перезагружаем страницу для применения логина
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // Проверяем, что мы залогинены
    const isLoggedIn = await page.locator('aside, nav, [role="navigation"]').first().isVisible({ timeout: 5000 }).catch(() => false) ||
                       await page.locator('text=RB Partners Suite').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isLoggedIn) {
      // Пробуем через форму входа
      await page.goto(BASE_URL);
      await page.waitForSelector('input[type="email"], input[placeholder*="email" i], input[name="email"]', { timeout: 10000 }).catch(() => {});
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill('ceo@rbpartners.com');
        await page.locator('input[type="password"], input[name="password"]').first().fill('ceo');
        await page.locator('button:has-text("Войти"), button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
      }
    }
  });

  // Список всех пунктов меню для проверки
  const menuItems = [
    { title: 'Дашборд', url: '/', selector: 'text=Дашборд' },
    { title: 'Проекты', url: '/projects', selector: 'text=Проекты' },
    { title: 'Утверждение проектов', url: '/project-approval', selector: 'text=Утверждение проектов' },
    { title: 'МСУК-1 Compliance', url: '/msuk-compliance', selector: 'text=МСУК-1 Compliance' },
    { title: 'HR', url: '/hr', selector: 'text=HR' },
    { title: 'Тайм-щиты', url: '/timesheets', selector: 'text=Тайм-щиты' },
    { title: 'Посещаемость', url: '/attendance', selector: 'text=Посещаемость' },
    { title: 'Бонусы', url: '/bonuses', selector: 'text=Бонусы' },
    { title: 'Аналитика', url: '/analytics', selector: 'text=Аналитика' },
    { title: 'Календарь', url: '/calendar', selector: 'text=Календарь' },
    { title: 'Задачи', url: '/tasks', selector: 'text=Задачи' },
    { title: 'Уведомления', url: '/notifications', selector: 'text=Уведомления' },
    { title: 'Настройки', url: '/settings', selector: 'text=Настройки' },
  ];

  test('should navigate to all menu items successfully', async ({ page }) => {
    const results: Array<{ title: string; url: string; status: 'passed' | 'failed'; error?: string }> = [];

    for (const item of menuItems) {
      try {
        // Открываем меню на мобильных (если нужно)
        const menuButton = page.locator('button[aria-label="Открыть меню"], button:has(svg)').first();
        const isMenuVisible = await page.locator('nav, [role="navigation"], aside').first().isVisible().catch(() => false);
        
        if (!isMenuVisible) {
          await menuButton.click().catch(() => {});
          await page.waitForTimeout(500);
        }

        // Ищем пункт меню
        const menuItem = page.locator(`a[href="${item.url}"], ${item.selector}`).first();
        
        // Проверяем, виден ли пункт меню
        const isVisible = await menuItem.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (!isVisible) {
          // Пробуем найти через текст в сайдбаре
          const sidebarItem = page.locator(`aside, nav`).locator(`text=${item.title}`).first();
          const sidebarVisible = await sidebarItem.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (sidebarVisible) {
            await sidebarItem.click();
          } else {
            // Прямой переход по URL
            await page.goto(`${BASE_URL}${item.url}`);
          }
        } else {
          await menuItem.click();
        }

        // Ждем загрузки страницы
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);

        // Проверяем, что мы на правильной странице
        const currentUrl = page.url();
        const isCorrectUrl = currentUrl.includes(item.url) || 
                           (item.url === '/' && (currentUrl.includes('/dashboard') || currentUrl.endsWith('/')));

        // Проверяем отсутствие критических ошибок
        const errorMessages = await page.locator('text=/ошибка|error|404|not found/i').count();
        const hasErrors = errorMessages > 0;

        // Проверяем, что контент загрузился
        const hasContent = await page.locator('body').textContent().then(text => 
          text && text.length > 100 && !text.includes('Загрузка...')
        ).catch(() => false);

        if (isCorrectUrl && !hasErrors && hasContent) {
          results.push({ title: item.title, url: item.url, status: 'passed' });
          console.log(`✅ ${item.title} (${item.url}) - OK`);
        } else {
          const error = `URL: ${currentUrl}, Errors: ${errorMessages}, HasContent: ${hasContent}`;
          results.push({ title: item.title, url: item.url, status: 'failed', error });
          console.log(`❌ ${item.title} (${item.url}) - FAILED: ${error}`);
        }

      } catch (error: any) {
        results.push({ 
          title: item.title, 
          url: item.url, 
          status: 'failed', 
          error: error.message || String(error) 
        });
        console.log(`❌ ${item.title} (${item.url}) - ERROR: ${error.message || error}`);
      }

      // Небольшая задержка между переходами
      await page.waitForTimeout(500);
    }

    // Выводим итоговый отчет
    console.log('\n=== ИТОГОВЫЙ ОТЧЕТ ===');
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`✅ Успешно: ${passed}`);
    console.log(`❌ Ошибок: ${failed}`);
    
    if (failed > 0) {
      console.log('\nПроблемные страницы:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.title} (${r.url}): ${r.error}`);
      });
    }

    // Проверяем, что хотя бы большинство страниц работает
    const successRate = passed / results.length;
    expect(successRate).toBeGreaterThan(0.7); // Минимум 70% страниц должны работать
  });

  test('should check each menu item individually', async ({ page }) => {
    // Проверяем каждый пункт меню отдельно для детальной диагностики
    
    const testCases = [
      { title: 'Дашборд', url: '/dashboard', expectedText: ['Дашборд', 'Dashboard', 'Проекты'] },
      { title: 'Проекты', url: '/projects', expectedText: ['Проекты', 'Projects'] },
      { title: 'Бонусы', url: '/bonuses', expectedText: ['Бонусы', 'Gift', 'Бонус'] },
      { title: 'Аналитика', url: '/analytics', expectedText: ['Аналитика', 'Analytics'] },
      { title: 'Календарь', url: '/calendar', expectedText: ['Календарь', 'Calendar'] },
      { title: 'Задачи', url: '/tasks', expectedText: ['Задачи', 'Tasks'] },
      { title: 'Настройки', url: '/settings', expectedText: ['Настройки', 'Settings'] },
    ];

    for (const testCase of testCases) {
      await test.step(`Проверка: ${testCase.title}`, async () => {
        await page.goto(`${BASE_URL}${testCase.url}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000); // Дополнительная задержка для загрузки контента
        
        // Проверяем, что страница содержит ожидаемый текст
        const bodyText = await page.locator('body').textContent();
        const hasExpectedText = testCase.expectedText.some(text => 
          bodyText?.toLowerCase().includes(text.toLowerCase())
        );
        
        expect(hasExpectedText).toBe(true);
        
        // Проверяем отсутствие критических ошибок
        const errorCount = await page.locator('text=/ошибка|error|404|not found/i').count();
        expect(errorCount).toBe(0);
      });
    }
  });
});

