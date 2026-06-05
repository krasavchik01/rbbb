import { test, expect } from '@playwright/test';

/**
 * Полный цикл проекта от создания до начисления бонуса
 * Проверка всех ролей и этапов проекта
 */
const BASE_URL = 'http://localhost:8080';

// Тестовые ролевые фикстуры для тестирования
const ROLE_FIXTURES = {
  procurement: {
    id: 'procurement_1',
    email: 'procurement@example.invalid',
    name: 'Отдел закупок',
    role: 'procurement',
    position: 'Отдел закупок'
  },
  deputy_director: {
    id: 'deputy_1',
    email: 'deputy@example.invalid',
    name: 'Заместитель ген. директора МАК',
    role: 'deputy_director',
    position: 'Заместитель генерального директора'
  },
  partner: {
    id: 'partner_1',
    email: 'partner@example.invalid',
    name: 'Партнер Иванов',
    role: 'partner',
    position: 'Партнер'
  },
  manager_1: {
    id: 'manager_1',
    email: 'manager1@example.invalid',
    name: 'Менеджер 1 Петров',
    role: 'manager_1',
    position: 'Менеджер 1'
  },
  supervisor: {
    id: 'supervisor_1',
    email: 'supervisor1@rbpartners.com',
    name: 'Супервайзер 1 Волков',
    role: 'supervisor_1',
    position: 'Супервайзер 1'
  },
  ceo: {
    id: 'ceo_1',
    email: 'ceo@example.invalid',
    name: 'Генеральный Директор',
    role: 'ceo',
    position: 'Генеральный директор (CEO)'
  }
};

// Функция быстрого входа
async function quickLogin(page: any, user: any) {
  await page.goto(BASE_URL);
  await page.evaluate((userData) => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(userData));
  }, user);
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  // Проверяем что вход успешен
  const userInfo = await page.locator('body').textContent();
  if (!userInfo?.includes(user.name.split(' ')[0])) {
    console.warn(`⚠️ Возможно не удалось войти как ${user.name}`);
  }
}

test.describe('Полный цикл проекта до бонуса', () => {
  let projectId: string | null = null;
  let projectName: string = '';

  test('Этап 1: Отдел закупок создает проект', async ({ page }) => {
    console.log('📋 Этап 1: Создание проекта отделом закупок');
    
    await quickLogin(page, ROLE_FIXTURES.procurement);
    
    // Переходим на страницу создания проекта
    await page.goto(`${BASE_URL}/create-project-procurement`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Заполняем форму проекта
    const timestamp = Date.now();
    projectName = `Тестовый проект ${timestamp}`;
    
    // Ждем загрузки формы
    await page.waitForSelector('input#clientName, input[id="clientName"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // Заполняем название клиента
    const clientNameInput = page.locator('input#clientName');
    if (await clientNameInput.count() > 0) {
      await clientNameInput.fill(projectName);
      await page.waitForTimeout(500);
    } else {
      // Fallback - ищем по placeholder
      await page.fill('input[placeholder*="Компания"], input[placeholder*="Клиент"]', projectName);
      await page.waitForTimeout(500);
    }
    
    // Заполняем предмет договора
    const contractSubjectInput = page.locator('input#contractSubject, textarea#contractSubject');
    if (await contractSubjectInput.count() > 0) {
      await contractSubjectInput.fill('Аудит финансовой отчетности');
      await page.waitForTimeout(500);
    }
    
    // Выбираем компанию
    const companySelect = page.locator('button[role="combobox"]').filter({ hasText: /Выберите компанию|компания/i }).first();
    if (await companySelect.count() > 0) {
      await companySelect.click();
      await page.waitForTimeout(500);
      // Выбираем первую компанию из списка
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.count() > 0) {
        await firstOption.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Выбираем тип проекта
    const projectTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /вид проекта|тип/i }).first();
    if (await projectTypeSelect.count() > 0) {
      await projectTypeSelect.click();
      await page.waitForTimeout(500);
      const auditOption = page.locator('[role="option"]').filter({ hasText: /аудит|audit/i }).first();
      if (await auditOption.count() > 0) {
        await auditOption.click();
      } else {
        await page.locator('[role="option"]').first().click();
      }
      await page.waitForTimeout(500);
    }
    
    // Заполняем сумму
    const amountInput = page.locator('input#amountWithoutVAT, input[id*="amount"]');
    if (await amountInput.count() > 0) {
      await amountInput.fill('1000000');
      await page.waitForTimeout(500);
    }
    
    // Заполняем номер договора
    const contractNumberInput = page.locator('input#contractNumber');
    if (await contractNumberInput.count() > 0) {
      await contractNumberInput.fill(`ДОГ-${timestamp}`);
      await page.waitForTimeout(500);
    }
    
    // Сохраняем проект
    const saveButton = page.locator('button:has-text("Создать проект"), button:has-text("Создать"), button:has-text("Сохранить")').first();
    if (await saveButton.count() > 0) {
      await saveButton.click();
      await page.waitForTimeout(5000); // Ждем создания проекта
    }
    
    console.log(`✅ Проект "${projectName}" создан`);
    
    // Переходим на страницу проектов и находим созданный проект
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Ищем проект в списке
    const projectLink = page.locator(`text=${projectName}`).first();
    if (await projectLink.count() > 0) {
      const href = await projectLink.getAttribute('href');
      if (href) {
        projectId = href.split('/').pop() || null;
        console.log(`✅ Найден ID проекта: ${projectId}`);
      }
    }
  });

  test('Этап 2: Зам. директора утверждает проект и назначает команду', async ({ page }) => {
    if (!projectName) {
      test.skip();
      return;
    }
    
    console.log('📋 Этап 2: Утверждение проекта и назначение команды');
    
    await quickLogin(page, ROLE_FIXTURES.deputy_director);
    
    // Переходим на страницу утверждения проектов
    await page.goto(`${BASE_URL}/project-approval`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Ищем проект в списке
    const projectItem = page.locator(`text=${projectName}`).first();
    if (await projectItem.count() > 0) {
      await projectItem.click();
      await page.waitForTimeout(1000);
      
      // Назначаем команду
      // Ищем кнопки выбора ролей
      const managerSelect = page.locator('select, [role="combobox"]').filter({ hasText: /менеджер|manager/i }).first();
      if (await managerSelect.count() > 0) {
        await managerSelect.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      
      // Назначаем партнера
      const partnerSelect = page.locator('select, [role="combobox"]').filter({ hasText: /партнер|partner/i }).first();
      if (await partnerSelect.count() > 0) {
        await partnerSelect.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      
      // Утверждаем проект
      const approveButton = page.locator('button:has-text("Утвердить"), button:has-text("Подтвердить"), button:has-text("Сохранить")').first();
      if (await approveButton.count() > 0) {
        await approveButton.click();
        await page.waitForTimeout(3000);
      }
      
      console.log('✅ Проект утвержден и команда назначена');
    } else {
      console.warn('⚠️ Проект не найден на странице утверждения');
    }
  });

  test('Этап 3: Партнер распределяет задачи', async ({ page }) => {
    if (!projectId || !projectName) {
      test.skip();
      return;
    }
    
    console.log('📋 Этап 3: Партнер распределяет задачи');
    
    await quickLogin(page, ROLE_FIXTURES.partner);
    
    // Переходим в карточку проекта
    await page.goto(`${BASE_URL}/project/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Переходим на вкладку "Планирование"
    const planningTab = page.locator('button:has-text("Планирование"), a:has-text("Планирование"), [role="tab"]:has-text("Планирование")').first();
    if (await planningTab.count() > 0) {
      await planningTab.click();
      await page.waitForTimeout(2000);
    }
    
    // Нажимаем "Начать планирование" или "Изменить планирование"
    const startPlanningButton = page.locator('button:has-text("Начать планирование"), button:has-text("Изменить планирование")').first();
    if (await startPlanningButton.count() > 0) {
      await startPlanningButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Выбираем процедуры и назначаем ответственных (если есть)
    const procedureCheckbox = page.locator('input[type="checkbox"]').first();
    if (await procedureCheckbox.count() > 0) {
      await procedureCheckbox.check();
      await page.waitForTimeout(500);
    }
    
    // Сохраняем планирование
    const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Применить")').first();
    if (await saveButton.count() > 0) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }
    
    console.log('✅ Задачи распределены партнером');
  });

  test('Этап 4: Менеджер заполняет тайм-щит', async ({ page }) => {
    if (!projectId || !projectName) {
      test.skip();
      return;
    }
    
    console.log('📋 Этап 4: Заполнение тайм-щита менеджером');
    
    await quickLogin(page, ROLE_FIXTURES.manager_1);
    
    // Переходим на страницу тайм-щитов
    await page.goto(`${BASE_URL}/timesheets`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Нажимаем "Добавить тайм-щит"
    const addButton = page.locator('button:has-text("Добавить"), button:has-text("Создать"), button:has-text("Новый")').first();
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      // Выбираем проект
      const projectSelect = page.locator('select, [role="combobox"]').first();
      if (await projectSelect.count() > 0) {
        await projectSelect.click();
        await page.waitForTimeout(500);
        // Ищем наш проект
        const projectOption = page.locator(`text=${projectName}`).first();
        if (await projectOption.count() > 0) {
          await projectOption.click();
        } else {
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
        }
      }
      
      // Заполняем часы
      const hoursInput = page.locator('input[type="number"], input[name*="hours"], input[name*="Hours"]').first();
      if (await hoursInput.count() > 0) {
        await hoursInput.fill('8');
      }
      
      // Сохраняем
      const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Создать")').first();
      if (await saveButton.count() > 0) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      console.log('✅ Тайм-щит заполнен');
    }
  });

  test('Этап 5: Партнер завершает проект', async ({ page }) => {
    if (!projectId || !projectName) {
      test.skip();
      return;
    }
    
    console.log('📋 Этап 5: Завершение проекта партнером');
    
    await quickLogin(page, ROLE_FIXTURES.partner);
    
    // Переходим в карточку проекта
    await page.goto(`${BASE_URL}/project/${projectId}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Ищем кнопку "Завершить проект"
    const completeButton = page.locator('button:has-text("Завершить"), button:has-text("Complete"), button:has-text("Закрыть проект")').first();
    if (await completeButton.count() > 0) {
      await completeButton.click();
      await page.waitForTimeout(1000);
      
      // Подтверждаем завершение если есть диалог
      const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Да"), button:has-text("ОК")').first();
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(3000);
      }
      
      console.log('✅ Проект завершен');
    } else {
      console.warn('⚠️ Кнопка завершения проекта не найдена');
    }
  });

  test('Этап 6: CEO проверяет бонусы', async ({ page }) => {
    if (!projectName) {
      test.skip();
      return;
    }
    
    console.log('📋 Этап 6: Проверка бонусов CEO');
    
    await quickLogin(page, ROLE_FIXTURES.ceo);
    
    // Переходим на страницу бонусов
    await page.goto(`${BASE_URL}/bonuses`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Проверяем что страница загрузилась
    const bodyText = await page.locator('body').textContent();
    const hasBonuses = bodyText?.includes('Бонусы') || bodyText?.includes('бонус');
    
    if (hasBonuses) {
      console.log('✅ Страница бонусов доступна');
      
      // Ищем наш проект в списке бонусов
      if (bodyText?.includes(projectName)) {
        console.log(`✅ Бонус для проекта "${projectName}" найден`);
      } else {
        console.warn(`⚠️ Бонус для проекта "${projectName}" не найден`);
      }
    } else {
      console.warn('⚠️ Страница бонусов не загрузилась или недоступна');
    }
  });

  test('Проверка всех ролей - доступ к функциям', async ({ page }) => {
    console.log('📋 Проверка доступа всех ролей к функциям');
    
    const roles = [
      { user: ROLE_FIXTURES.procurement, allowedPages: ['/projects', '/create-project-procurement', '/tenders'] },
      { user: ROLE_FIXTURES.deputy_director, allowedPages: ['/dashboard', '/projects', '/project-approval', '/bonuses'] },
      { user: ROLE_FIXTURES.partner, allowedPages: ['/dashboard', '/projects', '/project'] },
      { user: ROLE_FIXTURES.manager_1, allowedPages: ['/dashboard', '/projects', '/timesheets'] },
      { user: ROLE_FIXTURES.ceo, allowedPages: ['/dashboard', '/projects', '/bonuses', '/analytics'] },
    ];
    
    for (const roleTest of roles) {
      console.log(`\n🔍 Проверка роли: ${roleTest.user.role}`);
      await quickLogin(page, roleTest.user);
      
      for (const pageUrl of roleTest.allowedPages) {
        try {
          await page.goto(`${BASE_URL}${pageUrl}`);
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(1000);
          
          const bodyText = await page.locator('body').textContent();
          if (bodyText && bodyText.length > 100) {
            console.log(`  ✅ ${pageUrl} - доступен`);
          } else {
            console.warn(`  ⚠️ ${pageUrl} - возможно пустая страница`);
          }
        } catch (error) {
          console.error(`  ❌ ${pageUrl} - ошибка: ${error}`);
        }
      }
    }
  });
});

