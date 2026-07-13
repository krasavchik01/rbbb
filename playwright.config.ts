import { defineConfig, devices } from '@playwright/test';

// Исторические сценарии ниже завязаны на удалённый маршрут /create-project и
// подмену пользователя через localStorage. Они сохранены как справочный архив,
// но не должны входить в действующий production-safe прогон. Их бизнес-функции
// покрыты demo-* и access/role-page-access.spec.ts с изолированными данными.
const legacyTestFiles = [
  '**/bonuses-access.spec.ts',
  '**/bonuses-simple-check.spec.ts',
  '**/full-project-cycle.spec.ts',
  '**/menu-detailed-check.spec.ts',
  '**/menu-full-verification.spec.ts',
  '**/project-amendments.spec.ts',
  '**/project-creation-flow.spec.ts',
  '**/project-files.spec.ts',
  '**/project-services.spec.ts',
  '**/project-stages.spec.ts',
  '**/quick-project-cycle.spec.ts',
];

/**
 * Конфигурация Playwright для тестирования приложения
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: legacyTestFiles,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:8080', // Используем порт 8080
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Можно добавить другие браузеры
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  webServer: process.env.SKIP_WEBSERVER ? undefined : {
    command: 'npm run dev -- --port 8080 --host',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

