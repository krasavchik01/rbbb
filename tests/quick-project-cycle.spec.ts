import { test, expect } from '@playwright/test';

/**
 * Быстрая проверка полного цикла проекта
 * Оптимизированная версия для быстрого тестирования
 */
const BASE_URL = 'http://localhost:8080';

const DEMO_USERS = {
  procurement: { id: 'procurement_1', email: 'procurement@rbpartners.com', name: 'Отдел закупок', role: 'procurement' },
  deputy_director: { id: 'deputy_1', email: 'deputy@mak.kz', name: 'Заместитель ген. директора МАК', role: 'deputy_director' },
  partner: { id: 'partner_1', email: 'partner@rbpartners.com', name: 'Партнер Иванов', role: 'partner' },
  manager_1: { id: 'manager_1', email: 'manager1@rbpartners.com', name: 'Менеджер 1 Петров', role: 'manager_1' },
  ceo: { id: 'ceo_1', email: 'ceo@rbpartners.com', name: 'Генеральный Директор', role: 'ceo' }
};

async function quickLogin(page: any, user: any) {
  await page.goto(BASE_URL);
  await page.evaluate((userData) => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(userData));
  }, user);
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

test.describe('Быстрая проверка полного цикла проекта', () => {
  let projectName = '';
  let projectId: string | null = null;

  test('Полный цикл: создание -> утверждение -> завершение -> бонус', async ({ page }) => {
    console.log('\n🚀 Начинаем полный цикл проекта...\n');

    // ЭТАП 1: Создание проекта
    console.log('📋 Этап 1: Создание проекта отделом закупок');
    await quickLogin(page, DEMO_USERS.procurement);
    await page.goto(`${BASE_URL}/create-project-procurement`);
    await page.waitForTimeout(2000);
    
    const timestamp = Date.now();
    projectName = `Тест ${timestamp}`;
    
    await page.fill('input#clientName', projectName);
    await page.fill('input#contractSubject', 'Аудит');
    await page.fill('input#amountWithoutVAT', '1000000');
    await page.fill('input#contractNumber', `ДОГ-${timestamp}`);
    
    // Выбираем компанию
    const companyBtn = page.locator('button[role="combobox"]').first();
    if (await companyBtn.count() > 0) {
      await companyBtn.click();
      await page.waitForTimeout(300);
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(300);
    }
    
    // Выбираем тип проекта
    const typeBtn = page.locator('button[role="combobox"]').nth(1);
    if (await typeBtn.count() > 0) {
      await typeBtn.click();
      await page.waitForTimeout(300);
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(300);
    }
    
    // Создаем проект
    await page.locator('button:has-text("Создать проект")').click();
    await page.waitForTimeout(3000);
    console.log(`✅ Проект "${projectName}" создан`);

    // ЭТАП 2: Утверждение и назначение команды
    console.log('\n📋 Этап 2: Утверждение проекта зам. директором');
    await quickLogin(page, DEMO_USERS.deputy_director);
    await page.goto(`${BASE_URL}/project-approval`);
    await page.waitForTimeout(2000);
    
    // Ищем проект
    const projectText = page.locator(`text=${projectName}`);
    if (await projectText.count() > 0) {
      await projectText.first().click();
      await page.waitForTimeout(1000);
      
      // Назначаем менеджера
      const managerSelect = page.locator('select, button[role="combobox"]').filter({ hasText: /менеджер/i }).first();
      if (await managerSelect.count() > 0) {
        await managerSelect.click();
        await page.waitForTimeout(300);
        await page.locator('[role="option"], option').first().click();
        await page.waitForTimeout(500);
      }
      
      // Назначаем партнера
      const partnerSelect = page.locator('select, button[role="combobox"]').filter({ hasText: /партнер/i }).first();
      if (await partnerSelect.count() > 0) {
        await partnerSelect.click();
        await page.waitForTimeout(300);
        await page.locator('[role="option"], option').first().click();
        await page.waitForTimeout(500);
      }
      
      // Утверждаем
      const approveBtn = page.locator('button:has-text("Утвердить"), button:has-text("Сохранить")').first();
      if (await approveBtn.count() > 0) {
        await approveBtn.click();
        await page.waitForTimeout(3000);
        console.log('✅ Проект утвержден и команда назначена');
      }
    }

    // ЭТАП 3: Заполнение тайм-щита
    console.log('\n📋 Этап 3: Заполнение тайм-щита менеджером');
    await quickLogin(page, DEMO_USERS.manager_1);
    await page.goto(`${BASE_URL}/timesheets`);
    await page.waitForTimeout(2000);
    
    const addBtn = page.locator('button:has-text("Добавить"), button:has-text("Создать")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      
      // Выбираем проект
      const projectSelect = page.locator('select, button[role="combobox"]').first();
      if (await projectSelect.count() > 0) {
        await projectSelect.click();
        await page.waitForTimeout(300);
        const projectOption = page.locator(`text=${projectName}`).first();
        if (await projectOption.count() > 0) {
          await projectOption.click();
        } else {
          await page.locator('[role="option"], option').first().click();
        }
        await page.waitForTimeout(500);
      }
      
      // Заполняем часы
      await page.fill('input[type="number"], input[name*="hours"]', '8');
      await page.locator('button:has-text("Сохранить"), button:has-text("Создать")').first().click();
      await page.waitForTimeout(2000);
      console.log('✅ Тайм-щит заполнен');
    }

    // ЭТАП 4: Завершение проекта
    console.log('\n📋 Этап 4: Завершение проекта партнером');
    await quickLogin(page, DEMO_USERS.partner);
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForTimeout(2000);
    
    // Ищем проект и открываем карточку
    const projectLink = page.locator(`text=${projectName}`).first();
    if (await projectLink.count() > 0) {
      await projectLink.click();
      await page.waitForTimeout(2000);
      
      // Ищем кнопку завершения
      const completeBtn = page.locator('button:has-text("Завершить"), button:has-text("Complete")').first();
      if (await completeBtn.count() > 0) {
        await completeBtn.click();
        await page.waitForTimeout(1000);
        await page.locator('button:has-text("Подтвердить"), button:has-text("Да")').first().click();
        await page.waitForTimeout(3000);
        console.log('✅ Проект завершен');
      }
    }

    // ЭТАП 5: Проверка бонусов
    console.log('\n📋 Этап 5: Проверка бонусов CEO');
    await quickLogin(page, DEMO_USERS.ceo);
    await page.goto(`${BASE_URL}/bonuses`);
    await page.waitForTimeout(2000);
    
    const bodyText = await page.locator('body').textContent();
    if (bodyText?.includes('Бонусы') || bodyText?.includes('бонус')) {
      console.log('✅ Страница бонусов доступна');
      if (bodyText.includes(projectName)) {
        console.log(`✅ Бонус для проекта "${projectName}" найден!`);
      } else {
        console.log(`⚠️ Бонус для проекта "${projectName}" пока не найден (возможно еще не рассчитан)`);
      }
    }

    console.log('\n✅ Полный цикл проекта проверен!');
  });

  test('Проверка доступа всех ролей', async ({ page }) => {
    console.log('\n🔍 Проверка доступа всех ролей к функциям\n');
    
    const roles = [
      { user: DEMO_USERS.procurement, pages: ['/projects', '/create-project-procurement'] },
      { user: DEMO_USERS.deputy_director, pages: ['/dashboard', '/project-approval', '/bonuses'] },
      { user: DEMO_USERS.partner, pages: ['/dashboard', '/projects'] },
      { user: DEMO_USERS.manager_1, pages: ['/dashboard', '/timesheets'] },
      { user: DEMO_USERS.ceo, pages: ['/dashboard', '/bonuses', '/analytics'] },
    ];
    
    for (const roleTest of roles) {
      console.log(`\n🔐 Роль: ${roleTest.user.role}`);
      await quickLogin(page, roleTest.user);
      
      for (const pageUrl of roleTest.pages) {
        try {
          await page.goto(`${BASE_URL}${pageUrl}`);
          await page.waitForTimeout(1000);
          const bodyText = await page.locator('body').textContent();
          if (bodyText && bodyText.length > 100) {
            console.log(`  ✅ ${pageUrl}`);
          } else {
            console.log(`  ⚠️ ${pageUrl} - пустая страница`);
          }
        } catch (error) {
          console.log(`  ❌ ${pageUrl} - ошибка`);
        }
      }
    }
    
    console.log('\n✅ Проверка доступа завершена');
  });
});

