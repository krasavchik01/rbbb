# RBBB Stabilization and Canonical Data Model Design

**Дата:** 2026-07-11

**Статус:** утверждённый устный дизайн, ожидает письменного review

**Ветка:** `codex/rbbb-recovery-2026-07-11`

**Recovery commit:** `50e783b`

## 1. Цель

Первый самостоятельный этап завершения RBBB должен сделать дальнейшую работу
предсказуемой и безопасной: сохранить текущее локальное состояние, закрепить
единственные источники истины в коде, убрать расхождения TypeScript-моделей и
получить зелёные `typecheck`, `build` и автоматические тесты без повторного
импорта и без изменения live-данных.

Этап не завершает всю программу RBBB. После него отдельными design/plan циклами
идут сверка импортов, единый `/projects`, платёжный реестр и production rollout.

## 2. Подтверждённая исходная точка

Перед написанием этого документа создан внешний Unicode-безопасный ZIP-снимок:

- архив: `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\snapshots\rbbb-prework-20260711-183244.zip`;
- SHA-256: `33494BBE5395798CF4705F9C1890DCD3BB533E679810E043E5CF6B9F13F637D2`;
- manifest: `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\snapshots\rbbb-prework-20260711-183244-manifest.txt`;
- архив содержит 3119 записей, включая 77 Excel-файлов с Unicode-именами;
- исключены `.git`, `node_modules`, `dist`, env-файлы, `.vercel`,
  `playwright-report`, `test-results` и `supabase/.temp`.

Локальная рабочая версия сохранена recovery-коммитом `50e783b` поверх
`6fc7200`. Env-файлы, локальные agent-настройки и сгенерированные test artifacts
в commit не включены.

Диагностическая baseline:

- `npm run typecheck`: 181 ошибка;
- самые крупные очаги: `ProjectWorkspace.tsx` (29), `Bonuses.tsx` (18),
  `Projects-simple.tsx` (17), `ProjectApproval.tsx` (15),
  `excelExport.ts` (14), `notifications.ts` (11);
- live Supabase на момент read-only проверки: 1043 проекта, 140 сотрудников,
  14629 approved-таймшитов на 110364,4 часа;
- RBI: 144 проекта с marker и 152 участника с `assignedBy` marker;
- partner-ledger marker: 64 проекта, 839 approved-таймшитов на 6233,8 часа;
- `project_team`, `project_participants` и `bonuses`: 0 строк;
- все непустые `projects.notes` из live-выборки корректно разобрались как JSON;
- найдено два известных одноимённых employee-дубля: Чалова и Мухашев.

Live-проверка выполнялась только через `SELECT`. Ни один import/commit/cleanup
script не запускался.

## 3. Декомпозиция полной программы

Полное завершение RBBB делится на пять независимых результатов:

1. **Стабилизация и каноническая модель** — предмет этого документа.
2. **Сверка и reconciliation импортов** — RBI conflicts/not-found,
   Кенжекулов, неизвестные Excel, дубли и история применённых marker.
3. **Единый `/projects` и роли** — один интерфейс с role-aware columns,
   actions и financial visibility.
4. **Бонусы и платёжный реестр** — предварительный расчёт, ручное утверждение,
   запись финальных выплат в `bonuses` и экспорт Excel.
5. **Production rollout** — deploy, smoke-test по ролям, read-only data audit и
   rollback readiness.

Каждый результат получает собственный design и implementation plan. Это не
позволяет смешать исправление типов, массовые изменения данных и UI-переделку в
один непроверяемый релиз.

## 4. Канонические источники истины

| Домен | Единственный источник истины | Правило совместимости |
|---|---|---|
| Проект | строка `projects` и JSON в `projects.notes` | неизвестные ключи notes всегда сохраняются |
| Команда проекта | `projects.notes.team` | `project_team` и `project_participants` не читаются и не заполняются |
| Команда периода | `projects.notes.auditPeriods[].team` | проектная команда не копируется в периоды автоматически |
| Таймшиты для расчётов | `timesheet_entries` со `status = 'approved'` | submitted/draft/rejected могут показываться отдельно, но не входят в бонус |
| Предварительный бонус | `projects.notes.finances.teamBonuses` | формулы и проценты считаются черновиком, не фактом выплаты |
| Утверждённая выплата | таблица `bonuses` | запись только в отдельном payout workflow; на этом этапе запрещена |
| Файлы | Seafile и project metadata | прямые Seafile credentials/path не выдаются клиенту |
| Рабочий интерфейс | `/projects` | legacy routes могут временно редиректить, но не создают вторую модель |

`projects.partner_id` и `projects.manager_id` остаются совместимыми индексными
полями существующей схемы. Они не переопределяют `notes.team`. Если позже
потребуется их синхронизация для запросов, она проектируется как явная
денормализация с отдельным тестом, а не как второй источник истины.

## 5. Архитектура первого этапа

### 5.1 Канонический notes adapter

Создаётся небольшой изолированный модуль в `src/lib`, отвечающий только за:

- безопасный разбор `projects.notes`, независимо от того, пришёл JSON-объект или
  строка;
- нормализацию отсутствующих коллекций без изменения исходных данных;
- чтение и обновление `team`, `auditPeriods` и `finances.teamBonuses`;
- merge-update, сохраняющий все неизвестные ключи notes и import markers;
- сериализацию обратно в формат, который ожидает текущая live-схема.

Компоненты не должны самостоятельно делать `JSON.parse`, строить альтернативные
team arrays или полностью заменять notes. Они получают данные через функции
adapter и передают в writer только целевое изменение.

Если notes не разбирается, adapter возвращает диагностическую ошибку и raw value.
Запись такого проекта блокируется, чтобы UI не затёр повреждённый JSON пустым
объектом.

### 5.2 Канонические domain types

Тип live-строки Supabase и тип данных интерфейса разделяются:

- generated Supabase types описывают фактические snake_case columns;
- один canonical project domain type описывает нормализованные `notes`, team,
  periods и finances;
- mapper из DB row в domain object находится рядом с notes adapter;
- mapper update payload формирует только допустимые live columns.

`src/types/project.ts`, `project-simple.ts`, `project-v3.ts`, внутренние типы
datastore и hook-local расширения не удаляются одним большим изменением. Сначала
они переводятся на импорт или совместимые aliases canonical type, затем
неиспользуемые определения удаляются отдельными маленькими коммитами.

`any` допускается только на внешней границе разбора legacy JSON. Внутри domain
adapter и новых тестов используются конкретные типы.

### 5.3 Единый project data access

Для продуктового контура выбирается один hook/repository path. Приоритет —
существующий `useProjects` из `src/hooks/useSupabaseData.ts`, потому что именно
его используют текущие `/projects`, `Bonuses`, `Timesheets` и approval pages.

Остальные hooks (`src/hooks/useProjects.ts`, `useProjects-simple.ts`,
`useDataStore.ts`) на первом этапе:

- либо становятся тонкими совместимыми facade над выбранным repository;
- либо остаются только у legacy страниц, но возвращают тот же canonical type;
- не выполняют чтение `project_team` как источник команды.

Смена hook не должна одновременно менять внешний вид страниц.

### 5.4 Таймшиты и бонусный черновик

Существующий `src/lib/timesheets.ts` остаётся единственной точкой доступа к
таймшитам. Новые расчётные функции получают только approved rows или явно
фильтруют `status === 'approved'` до агрегации.

`src/lib/bonusCalculation.ts` становится чистой вычислительной функцией:

- вход: canonical project, approved hours и явно переданные настройки;
- выход: предварительный расчёт с указанием использованной формулы;
- сохранение черновика: только merge в `notes.finances.teamBonuses`;
- таблица `bonuses` не читается как альтернативная формула и не заполняется.

Текущие `ROLE_BONUS`, `DEFAULT_BONUS_PERCENT` и другие проценты считаются
техническими defaults. UI и отчёты обязаны маркировать результат как
предварительный, пока не утверждён официальный реестр процентов.

### 5.5 Typecheck stabilization

Ошибки исправляются по причинам, а не массовым отключением compiler flags:

1. DB/domain naming (`company_id`/`companyId`, nullable поля, status enums).
2. Project/team/finance model drift.
3. Supabase insert/update payload types.
4. Неявные `any` на legacy JSON boundaries.
5. Неиспользуемые imports/state, появившиеся после объединения страниц.

Запрещено ослаблять `strict`, `noUnusedLocals`, добавлять глобальные `@ts-ignore`
или исключать проблемные продуктовые страницы из `tsconfig`.

## 6. Поток данных

```text
Supabase projects row
        |
        v
DB row mapper -> safe notes adapter -> CanonicalProject
        |                                |
        |                                +-> /projects and role views
        |                                +-> approved timesheet aggregation
        |                                +-> preliminary bonus calculation
        |
targeted update request
        |
        v
merge into original notes -> validate -> serialize -> projects.update
```

Ключевой инвариант: изменение одного домена notes не удаляет contract, files,
import markers, closed metadata или другие неизвестные поля.

## 7. Ошибки и защитные ограничения

- Invalid notes JSON: показать project id/name в диагностике, заблокировать
  update, не подставлять `{}` для записи.
- Неизвестная роль или status: сохранить raw value, вернуть typed warning,
  исключить только из соответствующего расчёта.
- Ошибка Supabase: UI не делает optimistic final save; пользователь видит
  понятную ошибку, cached state не объявляется сохранённым.
- Частичный batch: расчёт и UI остаются read-only; batch data mutations не входят
  в первый этап.
- Duplicate team member: adapter дедуплицирует только представление по
  `userId + role`, но не переписывает live JSON без отдельного reconciliation
  решения.
- Import marker: никакой writer не удаляет и не переименовывает marker.
- Bonus payout: отсутствие строки в `bonuses` означает «не утверждено/не
  выплачено», а не нулевую выплату.

## 8. Тестовая стратегия

### Unit tests

- parse string/object/empty notes;
- invalid JSON не допускает write;
- targeted team update сохраняет неизвестные notes keys и markers;
- period team не наследуется и не перезаписывается автоматически;
- approved-hours aggregation исключает остальные statuses;
- bonus draft читается и сохраняется только в
  `notes.finances.teamBonuses`;
- mapper корректно обрабатывает snake_case, null и live status values.

### Integration and existing tests

- `npm run typecheck`;
- `npm run build`;
- `npm run test:unit`;
- Node tests для server/Seafile/navigation;
- Playwright access test для существующей role matrix, без изменения ожидаемого
  UI в рамках первого этапа.

Build запускается после recovery snapshot, потому что он создаёт `dist`.

## 9. Критерии готовности первого этапа

Этап завершён только если одновременно выполнено всё:

1. `npm run typecheck` завершается без ошибок.
2. Production build завершается успешно без ослабления TypeScript config.
3. Unit и доступные non-destructive integration tests зелёные.
4. `/projects`, `/timesheets` и `/bonuses` используют совместимые canonical
   project/team/finance types.
5. В продуктовых расчётах учитываются только approved timesheets.
6. Bonus calculation не создаёт строки в `bonuses`.
7. Ни один import/cleanup/approval script не был запущен с write-флагом.
8. Read-only повторная live-сверка показывает неизменные counts/markers либо
   документированное внешнее изменение, произошедшее не из этой работы.
9. Все изменения находятся в небольших тематических commits поверх recovery
   commit.

## 10. Вне объёма первого этапа

- решение 66 RBI conflicts и 123 not-found;
- создание пяти ненайденных проектов Кенжекулова;
- применение данных из неизвестных Excel;
- merge employee-дублей;
- изменение официальной бонусной формулы или процентов;
- запись выплат в `bonuses`;
- полная UI-переделка `/projects`;
- Auth/RLS migration и полная нормализация БД;
- deploy в production.

Эти работы не отменяются; они намеренно начинаются после стабильной canonical
модели и зелёной baseline.
