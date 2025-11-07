/**
 * Хелперы для аутентификации в тестах
 */

import { Page } from '@playwright/test';

/**
 * Выполняет вход в систему
 * @param page - Страница Playwright
 * @param email - Email пользователя
 * @param password - Пароль пользователя
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  
  // Заполняем форму входа
  await page.fill('input[type="email"], input[placeholder*="email" i]', email);
  await page.fill('input[type="password"]', password);
  
  // Нажимаем кнопку входа
  await page.click('button:has-text("Войти"), button[type="submit"]');
  
  // Ждем редиректа на главную страницу
  await page.waitForURL(/\/dashboard|\/projects/, { timeout: 10000 });
}

/**
 * Вход как отдел закупок
 */
export async function loginAsProcurement(page: Page) {
  // TODO: Использовать реальные тестовые данные
  await login(page, 'procurement@test.com', 'test123');
}

/**
 * Вход как CEO
 */
export async function loginAsCEO(page: Page) {
  // TODO: Использовать реальные тестовые данные
  await login(page, 'ceo@test.com', 'test123');
}

