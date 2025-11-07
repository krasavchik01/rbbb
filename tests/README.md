# Playwright тесты

## Установка

```bash
npm install
npx playwright install
```

## Запуск тестов

```bash
# Запустить все тесты
npm run test

# Запустить с UI (интерактивный режим)
npm run test:ui

# Запустить в headed режиме (с видимым браузером)
npm run test:headed

# Запустить в debug режиме
npm run test:debug

# Запустить конкретный тест
npx playwright test tests/project-files.spec.ts
```

## Структура тестов

- `tests/project-files.spec.ts` - Тесты загрузки и управления файлами проекта
- `tests/project-stages.spec.ts` - Тесты этапов проекта
- `tests/project-services.spec.ts` - Тесты дополнительных услуг
- `tests/project-amendments.spec.ts` - Тесты доп соглашений
- `tests/project-creation-flow.spec.ts` - Интеграционный тест полного цикла создания проекта

## Настройка тестовых данных

Перед запуском тестов нужно:

1. Создать тестовых пользователей в Supabase:
   - procurement@test.com (отдел закупок)
   - ceo@test.com (CEO)
   - deputy@test.com (зам директора)

2. Обновить данные в `tests/helpers/auth.ts` с реальными учетными данными

3. Настроить `playwright.config.ts`:
   - Указать правильный `baseURL`
   - Настроить `webServer` если нужно

## Примечания

- Тесты используют `data-testid` атрибуты для поиска элементов
- Некоторые тесты могут требовать предварительной настройки данных в БД
- Тесты предполагают, что dev сервер запущен на `localhost:5173`

