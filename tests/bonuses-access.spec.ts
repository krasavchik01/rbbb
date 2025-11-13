import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

// Демо-пользователи
const DEMO_USERS = {
  ceo: { email: 'ceo@rbpartners.com', password: 'ceo', role: 'CEO' },
  deputy: { email: 'deputy@mak.kz', password: 'deputy', role: 'Заместитель директора' },
  partner: { email: 'partner@rbpartners.com', password: 'partner', role: 'Партнер' },
  manager: { email: 'manager@rbpartners.com', password: 'manager', role: 'Менеджер 1' },
};

// Функция быстрого входа через localStorage
async function quickLogin(page: any, user: { email: string; password: string; role: string }) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);
  
  // Определяем роль
  let role = 'employee';
  if (user.email.includes('ceo')) role = 'ceo';
  else if (user.email.includes('deputy')) role = 'deputy_director';
  else if (user.email.includes('partner')) role = 'partner';
  else if (user.email.includes('manager')) role = 'manager_1';
  
  await page.evaluate((userData) => {
    localStorage.clear();
    const userObj = {
      id: userData.role === 'ceo' ? 'ceo_1' :
          userData.role === 'deputy_director' ? 'deputy_1' :
          userData.role === 'partner' ? 'partner_1' :
          userData.role === 'manager_1' ? 'manager_1' : 'employee_1',
      email: userData.email,
      name: userData.roleName,
      role: userData.role,
      department: 'Тест',
      position: userData.roleName
    };
    localStorage.setItem('user', JSON.stringify(userObj));
  }, { ...user, role, roleName: user.role });
  
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);
  
  // Проверяем, что пользователь авторизован - ищем элементы дашборда или сайдбара
  const sidebar = page.locator('[class*="sidebar"], [class*="Sidebar"], nav');
  const dashboard = page.locator('text=/Дашборд|Проекты|Бонусы/i');
  
  // Ждем появления либо сайдбара, либо элементов дашборда
  try {
    await Promise.race([
      sidebar.first().waitFor({ timeout: 10000 }),
      dashboard.first().waitFor({ timeout: 10000 })
    ]);
  } catch (e) {
    // Если не загрузилось, проверяем что не видна форма входа
    const loginForm = page.locator('input[type="email"], input[type="password"]');
    const loginFormCount = await loginForm.count();
    if (loginFormCount > 0) {
      const userFromStorage = await page.evaluate(() => localStorage.getItem('user'));
      throw new Error(`Пользователь не авторизован. User in storage: ${userFromStorage}`);
    }
  }
}

test.describe('Проверка доступа к бонусам', () => {
  test('CEO должен видеть страницу бонусов', async ({ page }) => {
    await quickLogin(page, DEMO_USERS.ceo);
    
    // Переходим на страницу бонусов
    await page.goto(`${BASE_URL}/bonuses`, { waitUntil: 'domcontentloaded' });
    
    // Ждем загрузки React приложения
    await page.waitForSelector('main, [class*="container"], h1', { timeout: 15000 });
    await page.waitForTimeout(5000);
    
    // Делаем скриншот для отладки
    await page.screenshot({ path: 'test-results/ceo-bonuses.png', fullPage: true });
    
    // Проверяем, что страница загрузилась - ищем любой текст на странице
    const bodyText = await page.locator('body').textContent();
    console.log('Body text length:', bodyText?.length);
    console.log('Body text sample:', bodyText?.substring(0, 500));
    
    // Проверяем наличие заголовка "Бонусы" или статистики или сообщения
    const hasBonusesContent = bodyText?.includes('Бонус') || 
                              bodyText?.includes('бонус') || 
                              bodyText?.includes('₸') ||
                              bodyText?.includes('нет доступа');
    expect(hasBonusesContent).toBeTruthy();
    
    // Если есть "нет доступа" - это ошибка для CEO
    if (bodyText?.includes('нет доступа')) {
      throw new Error('CEO не должен видеть сообщение об отсутствии доступа');
    }
  });

  test('Заместитель директора должен видеть страницу бонусов', async ({ page }) => {
    await quickLogin(page, DEMO_USERS.deputy);
    
    // Переходим на страницу бонусов
    await page.goto(`${BASE_URL}/bonuses`);
    await page.waitForTimeout(2000);
    
    // Проверяем, что страница загрузилась
    const pageTitle = await page.locator('h1').first();
    await expect(pageTitle).toContainText('Бонусы');
    
    // Проверяем, что НЕ показывается сообщение об отсутствии доступа
    const noAccessMessage = page.locator('text=У вас нет доступа');
    await expect(noAccessMessage).not.toBeVisible();
  });

  test('Партнер НЕ должен видеть бонусы - показывается сообщение об отсутствии доступа', async ({ page }) => {
    await quickLogin(page, DEMO_USERS.partner);
    
    // Переходим на страницу бонусов
    await page.goto(`${BASE_URL}/bonuses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Делаем скриншот для отладки
    await page.screenshot({ path: 'test-results/partner-bonuses.png', fullPage: true });
    
    // Проверяем содержимое страницы
    const bodyText = await page.locator('body').textContent();
    console.log('Partner body text:', bodyText?.substring(0, 300));
    
    // Проверяем, что показывается сообщение об отсутствии доступа
    const hasNoAccess = bodyText?.includes('нет доступа') || bodyText?.includes('Нет доступа');
    expect(hasNoAccess).toBeTruthy();
    
    // Проверяем, что показывается правильное сообщение
    const hasCorrectMessage = bodyText?.includes('генеральный директор') || bodyText?.includes('заместитель директора');
    expect(hasCorrectMessage).toBeTruthy();
  });

  test('Менеджер НЕ должен видеть бонусы', async ({ page }) => {
    await quickLogin(page, DEMO_USERS.manager);
    
    // Переходим на страницу бонусов
    await page.goto(`${BASE_URL}/bonuses`);
    await page.waitForTimeout(2000);
    
    // Проверяем, что показывается сообщение об отсутствии доступа
    const noAccessMessage = page.locator('text=У вас нет доступа к просмотру бонусов');
    await expect(noAccessMessage).toBeVisible();
  });

  test('Вкладка "Бонусы" в Analytics видна только CEO и deputy_director', async ({ page }) => {
    // Проверяем для CEO
    await quickLogin(page, DEMO_USERS.ceo);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(3000);
    
    const bonusesTab = page.locator('button, [role="tab"]').filter({ hasText: /Бонус/i });
    const bonusesTabCount = await bonusesTab.count();
    expect(bonusesTabCount).toBeGreaterThan(0);
    
    // Проверяем для deputy
    await quickLogin(page, DEMO_USERS.deputy);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(3000);
    
    const bonusesTabDeputy = page.locator('button, [role="tab"]').filter({ hasText: /Бонус/i });
    const bonusesTabDeputyCount = await bonusesTabDeputy.count();
    expect(bonusesTabDeputyCount).toBeGreaterThan(0);
    
    // Проверяем для partner - вкладка должна быть скрыта
    await quickLogin(page, DEMO_USERS.partner);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(3000);
    
    const bonusesTabPartner = page.locator('button, [role="tab"]').filter({ hasText: /Бонус/i });
    const bonusesTabPartnerCount = await bonusesTabPartner.count();
    expect(bonusesTabPartnerCount).toBe(0);
  });

  test('Пункт "Бонусы" в сайдбаре виден только CEO и deputy_director', async ({ page }) => {
    // Проверяем для CEO
    await quickLogin(page, DEMO_USERS.ceo);
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    const bonusesMenuItem = page.locator('a:has-text("Бонусы"), button:has-text("Бонусы")');
    await expect(bonusesMenuItem).toBeVisible();
    
    // Проверяем для deputy
    await quickLogin(page, DEMO_USERS.deputy);
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    const bonusesMenuItemDeputy = page.locator('a:has-text("Бонусы"), button:has-text("Бонусы")');
    await expect(bonusesMenuItemDeputy).toBeVisible();
    
    // Проверяем для partner - пункт должен быть скрыт
    await quickLogin(page, DEMO_USERS.partner);
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    
    const bonusesMenuItemPartner = page.locator('a:has-text("Бонусы"), button:has-text("Бонусы")');
    await expect(bonusesMenuItemPartner).not.toBeVisible();
  });
});

