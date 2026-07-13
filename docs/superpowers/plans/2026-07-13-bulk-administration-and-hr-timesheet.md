# Bulk Administration and HR Timesheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Очистить проекты старых компаний и добавить проверяемые массовые операции, статусы deputy и подробный календарный Excel-табель.

**Architecture:** Правила live-очистки вынесены в чистый модуль и dry-run-first script. UI использует bulk-методы data store и общие функции защиты/статусов. Excel-книга строится отдельной чистой функцией из уже рассчитанной месячной модели.

**Tech Stack:** React 18, TypeScript, Supabase, SheetJS `xlsx`, Vitest/Node test, Playwright, Vercel.

---

### Task 1: Правила и безопасная live-очистка проектов

**Files:**
- Create: `scripts/lib/project-retention.mjs`
- Create: `scripts/purge-projects-by-company.mjs`
- Test: `tests/project-retention.test.mjs`

- [ ] Написать тесты: пять активных компаний сохраняются; consortium/консорциум/концорсиум сохраняются; пустая компания сохраняется; чистые Anderson/Parker удаляются; смешанная строка с МАК сохраняется.
- [ ] Запустить `node --test tests/project-retention.test.mjs` и получить FAIL до реализации.
- [ ] Реализовать `classifyProjectCompany(value)` с результатом `keep | delete` и причиной.
- [ ] Реализовать script, который по умолчанию только читает БД, создаёт снимок и требует `--commit --expected-count=N` для удаления.
- [ ] Повторить тест и dry-run; сверить список компаний и количество.
- [ ] Зафиксировать код отдельным коммитом.

### Task 2: Массовое удаление проектов

**Files:**
- Modify: `src/lib/supabaseDataStore.ts`
- Modify: `src/hooks/useSupabaseData.ts`
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Test: `tests/demo-project-bulk-actions.spec.ts`

- [ ] Добавить failing UI-тест выбора одной строки, всех отфильтрованных строк и появления панели с количеством.
- [ ] Добавить `deleteProjects(ids)` с уникализацией ID, порциями и проверкой оставшихся записей.
- [ ] Прокинуть bulk-метод через `useProjects` и синхронно обновлять локальный state.
- [ ] Добавить checkbox в header/rows, панель действий и подтверждение; разрешить только CEO/admin.
- [ ] При ошибке оставить неуспешные ID выбранными и показать toast.
- [ ] Запустить целевой Playwright-тест и role matrix.

### Task 3: Массовое удаление сотрудников

**Files:**
- Create: `src/lib/employeeBulkActions.ts`
- Modify: `src/lib/supabaseDataStore.ts`
- Modify: `src/hooks/useSupabaseData.ts`
- Modify: `src/pages/HR.tsx`
- Test: `src/lib/employeeBulkActions.test.ts`
- Test: `tests/demo-hr-bulk-actions.spec.ts`

- [ ] Написать unit-тест защиты текущего пользователя и последнего CEO/admin.
- [ ] Добавить `deleteEmployees(ids)` без удаления `timesheet_entries` и project team snapshots.
- [ ] Добавить checkbox, «Выбрать найденных», массовую панель и подтверждение.
- [ ] Заблокировать выбор текущего пользователя и операцию, оставляющую систему без CEO/admin.
- [ ] Проверить, что удалённый сотрудник исчезает из state, а production mutations перехвачены тестом.

### Task 4: Статусы заместителя директора

**Files:**
- Create: `src/lib/projectStatusActions.ts`
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Modify: `src/pages/ProjectWorkspace.tsx`
- Test: `src/lib/projectStatusActions.test.ts`
- Test: `tests/demo-project-status-actions.spec.ts`

- [ ] Написать тест разрешённых статусов: deputy не получает `completed`, но получает `pending_payment_approval`.
- [ ] Реализовать status options и patch builder с историей изменения.
- [ ] Добавить status Select в свод и права deputy для двух кнопок карточки проекта.
- [ ] При `pending_payment_approval` пересчитать финансы и уведомить CEO/admin; таблицу `bonuses` не изменять.
- [ ] Проверить deputy, CEO и обычного сотрудника в Playwright.

### Task 5: Подробный календарный Excel-табель

**Files:**
- Create: `src/lib/hrTimesheetWorkbook.ts`
- Modify: `src/components/hr/TimesheetAnalyticsTab.tsx`
- Test: `src/lib/hrTimesheetWorkbook.test.ts`

- [ ] Написать unit-тест июля 2026: 31 календарный день, 23 рабочих, 8 выходных, норма 184 часа.
- [ ] Построить строки заголовка, периода, KPI, дней недели и типа дня.
- [ ] Включить всех сотрудников, формулы итогов и отклонения, merges, widths, freeze/filters/print settings.
- [ ] Добавить заголовок периода на листы «Сводка» и «Проекты».
- [ ] Прочитать сгенерированную книгу обратно и проверить ключевые диапазоны/формулы.

### Task 6: Полная проверка, live-операция и production

**Files:**
- Modify: `reports/demo-readiness/*`

- [ ] Запустить typecheck, build, lint error gate, unit, node, role matrix и demo suites.
- [ ] Запустить purge dry-run, проверить снимок и точное ожидаемое количество.
- [ ] Запустить purge commit только с `--expected-count`, затем read-only подтвердить остаток и сохранность 34 неопределённых/консорциумов.
- [ ] Закоммитить и отправить ветку в GitHub.
- [ ] Выполнить `vercel --prod --yes`.
- [ ] Проверить production в браузере за CEO/deputy/HR и отсутствие console errors.

