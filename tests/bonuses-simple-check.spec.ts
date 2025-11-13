import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

test.describe('Простая проверка доступа к бонусам', () => {
  test('CEO видит бонусы, партнер не видит', async ({ page }) => {
    // Логинимся как CEO
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('user', JSON.stringify({
        id: 'ceo_1',
        email: 'ceo@rbpartners.com',
        name: 'Генеральный Директор',
        role: 'ceo',
        position: 'Генеральный директор (CEO)'
      }));
    });
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Переходим на бонусы
    await page.goto(`${BASE_URL}/bonuses`, { waitUntil: 'domcontentloaded' });
    
    // Ждем загрузки React
    await page.waitForFunction(() => {
      return document.querySelector('main') || 
             document.querySelector('[class*="container"]') ||
             document.body.innerText.includes('Бонус') ||
             document.body.innerText.includes('нет доступа');
    }, { timeout: 30000 });
    
    await page.waitForTimeout(3000);
    
    // Проверяем консоль на ошибки
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    const bodyText = await page.locator('body').textContent() || '';
    console.log('CEO page text length:', bodyText.length);
    console.log('CEO page text (first 1000 chars):', bodyText.substring(0, 1000));
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    
    // CEO должен видеть бонусы (не должно быть "нет доступа")
    const hasNoAccess = bodyText.includes('нет доступа') || bodyText.includes('Нет доступа');
    expect(hasNoAccess).toBeFalsy();
    
    // Логинимся как партнер
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({
        id: 'partner_1',
        email: 'partner@rbpartners.com',
        name: 'Партнер',
        role: 'partner',
        position: 'Партнер'
      }));
    });
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Переходим на бонусы
    await page.goto(`${BASE_URL}/bonuses`, { waitUntil: 'domcontentloaded' });
    
    // Ждем загрузки React
    await page.waitForFunction(() => {
      return document.querySelector('main') || 
             document.querySelector('[class*="container"]') ||
             document.body.innerText.includes('Бонус') ||
             document.body.innerText.includes('нет доступа') ||
             document.body.innerText.includes('Нет доступа');
    }, { timeout: 30000 });
    
    await page.waitForTimeout(3000);
    
    const partnerBodyText = await page.locator('body').textContent() || '';
    console.log('Partner page text length:', partnerBodyText.length);
    console.log('Partner page text (first 1000 chars):', partnerBodyText.substring(0, 1000));
    
    // Партнер должен видеть сообщение об отсутствии доступа
    const partnerHasNoAccess = partnerBodyText.includes('нет доступа') || partnerBodyText.includes('Нет доступа');
    expect(partnerHasNoAccess).toBeTruthy();
  });
});

