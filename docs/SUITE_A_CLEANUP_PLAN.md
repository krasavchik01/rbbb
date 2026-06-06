# Suite-A Cleanup Plan

> Цель: убрать legacy-мусор и сфокусировать Suite-A на сильном рабочем ядре: проекты, роли, задачи, часы, утверждения, бонусы, прозрачность.

## 1. Продуктовое решение

Владелец продукта хочет, чтобы Suite-A перестал быть сборником старых экспериментов.

Что считается legacy-кандидатом:

- аудиторские процедуры;
- IFRS/МСФО-модули;
- проектные опросники;
- старый импорт таймшитов через `/import-timesheet`;
- создание проекта из шаблонов;
- конструктор шаблонов;
- UI/баннеры/меню, которые ведут в эти сценарии;
- любые функции, которые не поддерживают текущую операционную модель компании.

Главный принцип:

> Лучше меньше функций, но каждая логичная, рабочая, быстрая и нужная.

## 2. Safety rules

Проект production-sensitive. Поэтому cleanup делаем безопасно:

1. Не удаляем реальные данные из Supabase без отдельного явного решения.
2. Сначала убираем UI-входы и routes.
3. Потом удаляем мёртвые imports/components/pages.
4. Потом чистим типы, тесты, docs.
5. После каждой фазы запускаем verification bundle.
6. Коммиты маленькие и понятные.

Verification bundle:

```bash
npm run test:routes
npm run test:access
npm run build
npx tsc --noEmit
```

## 3. Первичный inventory legacy-кандидатов

### 3.1. Survey / questionnaire / old timesheet import

Найдены входы:

- `src/App.tsx`
  - `/survey` → `SurveyHub`
  - `/project-survey` → redirect to `/survey?tab=fill`
  - `/project-survey-results` → redirect to `/survey?tab=results`
  - `/import-timesheet` → redirect to `/survey?tab=import`
- `src/components/AppSidebar.tsx`
  - пункт меню `Опрос и команды` → `/survey`
- `src/components/Layout.tsx`
  - глобально рендерит `ProjectSurveyBanner`
- `src/components/ProjectSurveyBanner.tsx`
  - кнопка `Пройти опрос` / `Продолжить` → `/project-survey`
- `src/pages/SurveyHub.tsx`
  - центральная legacy-страница опросов/импорта
- `src/components/hr/TimesheetAnalyticsTab.tsx`
  - текстовые ссылки/инструкции на `/import-timesheet`

Продуктовое направление: **убрать этот workflow из основного продукта**. Если часть данных ещё нужна для аналитики, оставить только read-only отображение без пользовательского legacy-ввода.

### 3.2. Template constructor / create project from template

Найдены входы:

- `src/App.tsx`
  - `/template-constructor/:id` → `TemplateConstructor`
  - `/create-project` → `CreateProjectFromTemplate`
- `src/pages/TemplateConstructor.tsx`
- `src/pages/CreateProjectFromTemplate.tsx`
- `src/pages/CreateProjectFromTemplate.tsx`
  - кнопка `Создать шаблон` → `/template-constructor/new`

Продуктовое решение владельца: **создание шаблонов — хунта, убрать из основного workflow**.

Рекомендуемое направление: основной путь создания проекта должен быть `CreateProjectProcurement` / procurement-flow, а не шаблонный конструктор.

### 3.3. Audit / IFRS / MСФО

Найдено:

- `src/_legacy/audit-and-ifrs9/...`
- `src/App.tsx`
  - `/audit` уже redirect → `/`
  - `/ifrs9` уже redirect → `/`

Текущее состояние лучше, чем у survey/templates: аудит уже вынесен в `_legacy`, но нужно проверить, не тянется ли он в bundle/imports/docs.

## 4. Proposed cleanup phases

### Phase 1 — отключить legacy входы из UI

Цель: пользователь больше не видит мусорные функции.

Действия:

- Убрать пункт `Опрос и команды` из `AppSidebar`.
- Убрать `ProjectSurveyBanner` из `Layout`.
- Заменить `/survey`, `/project-survey`, `/project-survey-results`, `/import-timesheet` на redirect в безопасное место:
  - либо `/projects`,
  - либо `/timesheets`,
  - либо `/404` после согласования.
- Убрать `/create-project` и `/template-constructor/:id` из основного доступа:
  - либо redirect на `/create-project-procurement`,
  - либо `/404` после согласования.
- Обновить route tests.

Проверки:

```bash
npm run test:routes
npm run test:access
npm run build
npx tsc --noEmit
```

Коммит:

```bash
git commit -m "fix(product): hide legacy survey and template entry points"
```

### Phase 2 — удалить мёртвые страницы и imports

**Status:** done — legacy survey/template files removed after references check.

Цель: кодовая база становится проще, bundle легче.

После Phase 1 проверить, какие файлы больше не используются:

- `src/pages/SurveyHub.tsx`
- `src/components/ProjectSurveyBanner.tsx`
- `src/pages/TemplateConstructor.tsx`
- `src/pages/CreateProjectFromTemplate.tsx`

Если imports отсутствуют — удалить.

Проверки:

```bash
npm run test:routes
npm run test:access
npm run build
npx tsc --noEmit
```

Коммит:

```bash
git commit -m "refactor(product): remove legacy survey and template pages"
```

### Phase 3 — очистить тексты, подсказки, аналитику

Цель: UI больше не направляет людей в старые процессы.

Кандидаты:

- `src/components/hr/TimesheetAnalyticsTab.tsx`
  - заменить инструкции `зайти в /import-timesheet` на актуальную модель работы с timesheets.

Решение нужно принять отдельно:

- если новый источник часов — `timesheet_entries`, то старый импорт должен уйти из пользовательского текста;
- если импорт нужен только админам как служебный инструмент, вынести его в admin-only diagnostics/tools, а не показывать как workflow сотрудникам.

Коммит:

```bash
git commit -m "docs(ui): remove legacy timesheet import guidance"
```

### Phase 4 — audit legacy bundle cleanup

**Status:** done — `src/_legacy/audit-and-ifrs9` removed after confirming no runtime imports.

Цель: понять, можно ли полностью удалить `src/_legacy/audit-and-ifrs9`.

Действия:

- Проверить imports из `_legacy`.
- Проверить routes `/audit`, `/ifrs9`.
- Если ничего не используется — удалить `_legacy/audit-and-ifrs9`.
- Если есть полезные куски — вынести в архивную ветку или docs, но не держать в runtime source.

Коммит:

```bash
git commit -m "chore(product): archive obsolete audit modules"
```

### Phase 5 — создать product guardrails

Цель: больше не допускать мусор обратно.

Добавить правила:

- Любая новая функция должна отвечать на вопрос: какую роль, какой workflow и какую бизнес-боль она закрывает?
- Нет роли/цели/workflow → не добавлять.
- Нет теста маршрута/доступа → не считать готовым.
- Нет error-state → не считать production-ready.

Возможные проверки:

- тест на отсутствие banned routes в sidebar;
- тест на отсутствие legacy routes в App;
- docs checklist в PR/review.

Коммит:

```bash
git commit -m "test(product): prevent legacy workflows from reappearing"
```

## 5. Что НЕ делаем без отдельного решения

- Не удаляем таблицы Supabase.
- Не удаляем реальные ответы/старые timesheet rows.
- Не ломаем исторические данные, если они нужны для отчётов.
- Не делаем огромный рефакторинг всех статусов за один коммит.

## 6. Рекомендуемый первый practical step

Начать с Phase 1:

1. Убрать `Опрос и команды` из sidebar.
2. Убрать `ProjectSurveyBanner` из layout.
3. Redirect legacy routes:
   - `/survey` → `/projects` или `/timesheets`
   - `/project-survey` → `/projects` или `/timesheets`
   - `/project-survey-results` → `/projects`
   - `/import-timesheet` → `/timesheets`
   - `/create-project` → `/create-project-procurement`
   - `/template-constructor/:id` → `/create-project-procurement`
4. Прогнать verification bundle.
5. Только потом удалить страницы физически.

## 7. Открытые решения для владельца продукта

Перед кодовым удалением нужно выбрать:

1. Куда вести старые survey links?
   - `/projects`
   - `/timesheets`
   - `/404`

2. Куда вести старые template links?
   - `/create-project-procurement`
   - `/projects`
   - `/404`

3. Нужен ли вообще какой-то admin-only импорт таймшитов?
   - нет, удалить из UI полностью;
   - да, но только как служебный инструмент админа;
   - да, но переписать отдельно под новую модель.

4. Удалять ли `_legacy/audit-and-ifrs9` из repo полностью или оставить как архив?
   - удалить;
   - оставить в `_legacy` пока;
   - вынести в отдельную ветку/архив.
