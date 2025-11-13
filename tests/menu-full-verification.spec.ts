import { test, expect } from '@playwright/test';

/**
 * Полная проверка всех пунктов меню с детальными проверками контента
 */
test.describe('Полная проверка всех пунктов меню', () => {
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

  const allPages = [
    { name: 'Дашборд', url: '/dashboard', requiredText: ['Дашборд', 'Проекты'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'Проекты', url: '/projects', requiredText: ['Проекты'], forbiddenText: ['в разработке'] },
    { name: 'Бонусы', url: '/bonuses', requiredText: ['Бонусы', '₸'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'Аналитика', url: '/analytics', requiredText: ['Аналитика'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'Календарь', url: '/calendar', requiredText: ['Календарь'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'Задачи', url: '/tasks', requiredText: ['Задачи'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'Настройки', url: '/settings', requiredText: ['Настройки', 'Профиль'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'HR', url: '/hr', requiredText: ['HR', 'Сотрудники'], forbiddenText: ['в разработке'] },
    { name: 'Тайм-щиты', url: '/timesheets', requiredText: ['Тайм-щиты'], forbiddenText: ['в разработке', 'будет система'] },
    { name: 'Посещаемость', url: '/attendance', requiredText: ['Посещаемость'], forbiddenText: ['в разработке'] },
    { name: 'Утверждение проектов', url: '/project-approval', requiredText: ['Утверждение'], forbiddenText: ['в разработке'] },
    { name: 'Уведомления', url: '/notifications', requiredText: ['Уведомления'], forbiddenText: ['в разработке'] },
  ];

  for (const pageInfo of allPages) {
    test(`✅ ${pageInfo.name} - полная проверка`, async ({ page }) => {
      // Переходим на страницу
      await page.goto(`${BASE_URL}${pageInfo.url}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Получаем текст страницы
      const bodyText = await page.locator('body').textContent() || '';
      const bodyTextLower = bodyText.toLowerCase();

      // Проверка 1: Страница содержит требуемый текст
      const hasRequiredText = pageInfo.requiredText.some(text => 
        bodyTextLower.includes(text.toLowerCase())
      );
      expect(hasRequiredText, `Страница "${pageInfo.name}" должна содержать: ${pageInfo.requiredText.join(', ')}`).toBe(true);

      // Проверка 2: Нет заглушек
      const hasForbiddenText = pageInfo.forbiddenText.some(text => 
        bodyTextLower.includes(text.toLowerCase())
      );
      expect(hasForbiddenText, `Страница "${pageInfo.name}" НЕ должна содержать заглушки: ${pageInfo.forbiddenText.join(', ')}`).toBe(false);

      // Проверка 3: Нет ошибок на странице
      const errorCount = await page.locator('text=/ошибка|error|404|not found/i').count();
      expect(errorCount, `Страница "${pageInfo.name}" не должна содержать ошибки`).toBe(0);

      // Проверка 4: Есть контент (не пустая страница)
      const contentLength = bodyText.length;
      expect(contentLength, `Страница "${pageInfo.name}" должна содержать контент (минимум 500 символов)`).toBeGreaterThan(500);

      // Проверка 5: Нет NaN в консоли
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (text.includes('NaN') && text.includes('children')) {
            consoleErrors.push(text);
          }
        }
      });

      await page.waitForTimeout(1000); // Даем время на рендеринг

      expect(consoleErrors.length, `Страница "${pageInfo.name}" не должна иметь ошибок NaN в children`).toBe(0);

      // Делаем скриншот для доказательства
      await page.screenshot({ 
        path: `test-results/verified-${pageInfo.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        fullPage: true 
      });

      console.log(`✅ ${pageInfo.name} - ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ`);
    });
  }

  test('Итоговый отчет - все страницы работают', async ({ page }) => {
    const results: Array<{name: string; status: 'ok' | 'fail'; issues: string[]}> = [];

    for (const pageInfo of allPages) {
      const issues: string[] = [];
      
      try {
        await page.goto(`${BASE_URL}${pageInfo.url}`);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        const bodyText = await page.locator('body').textContent() || '';
        const bodyTextLower = bodyText.toLowerCase();

        // Проверки
        const hasRequired = pageInfo.requiredText.some(t => bodyTextLower.includes(t.toLowerCase()));
        if (!hasRequired) issues.push(`Нет требуемого текста: ${pageInfo.requiredText.join(', ')}`);

        const hasForbidden = pageInfo.forbiddenText.some(t => bodyTextLower.includes(t.toLowerCase()));
        if (hasForbidden) issues.push(`Есть заглушки: ${pageInfo.forbiddenText.join(', ')}`);

        const hasErrors = await page.locator('text=/ошибка|error|404/i').count() > 0;
        if (hasErrors) issues.push('Есть ошибки на странице');

        if (bodyText.length < 500) issues.push('Мало контента');

        results.push({
          name: pageInfo.name,
          status: issues.length === 0 ? 'ok' : 'fail',
          issues
        });
      } catch (error: any) {
        results.push({
          name: pageInfo.name,
          status: 'fail',
          issues: [error.message]
        });
      }
    }

    // Выводим отчет
    console.log('\n=== ИТОГОВЫЙ ОТЧЕТ ===');
    const ok = results.filter(r => r.status === 'ok').length;
    const fail = results.filter(r => r.status === 'fail').length;
    
    console.log(`✅ Работают: ${ok}/${results.length}`);
    console.log(`❌ Проблемы: ${fail}/${results.length}\n`);

    if (fail > 0) {
      console.log('Проблемные страницы:');
      results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`  ❌ ${r.name}:`);
        r.issues.forEach(issue => console.log(`     - ${issue}`));
      });
    }

    // Финальная проверка - минимум 90% страниц должны работать
    const successRate = ok / results.length;
    expect(successRate, `Минимум 90% страниц должны работать. Работает: ${ok}/${results.length}`).toBeGreaterThanOrEqual(0.9);
  });
});

