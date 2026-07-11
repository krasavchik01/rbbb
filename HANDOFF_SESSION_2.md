# Handoff Session 2

Дата фиксации: 2026-07-11  
Рабочая папка: `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb`  
Важно: этот документ фиксирует фактическое состояние текущей сессии и репозитория. Код, БД и бизнес-логика не исправлялись в момент подготовки handoff.

## 1. Первоначальная цель проекта

Пользователь хочет превратить текущую систему управления проектами RBI/RB Partners в простую единую систему учета проектов, команд, таймшитов, закрытия проектов и бонусов.

Первичная практическая задача сессии:

- взять Excel-файлы партнеров по закрытым/ведущимся проектам;
- извлечь из них клиентов, вид аудита, период аудита, партнера, руководителя проекта, команду, налоговика, примечания;
- найти соответствующие проекты в существующей системе;
- дополнить проекты командой и ролями;
- закрыть прошедшие проекты 2024-2025 годов;
- подтвердить связанные таймшиты;
- сделать так, чтобы генеральный директор и админ могли видеть итоговую картину по проектам, команде, статусам, таймшитам, бонусам и расчетам.

Позже цель расширилась: не просто разнести данные, а упростить всю логику проекта и вкладок, чтобы все сводилось в один большой реестр проектов с разным уровнем доступа по ролям.

## 2. Все требования пользователя, включая изменения по ходу работы

Основные требования по данным:

- Использовать Excel-файл партнера как источник закрытых или расписанных проектов.
- В Excel есть: наименование клиента, вид аудита, период аудита, партнер, руководитель проекта, состав группы через запятую, налоговик, иногда примечание.
- Файл `Проекты Кенжекулов` пользователь обозначил как файл с точно закрытыми проектами.
- Другие файлы ранее могли быть таймшитами, не проектными ведомостями.
- Позже добавлены RBI-файлы по кварталам 2024, 2025, 2026 и две дополнительные партнерские таблицы.
- Нужно находить похожие проекты, не создавать дубли там, где проект уже есть.
- Нужно улучшать качество данных с учетом новых показаний, но не портить существующие данные.
- Нужно добавить отсутствующих сотрудников, если они есть в партнерских таблицах и не найдены в системе.
- Если `Саида ГПХ`, это другая Саида, не внутренняя сотрудница. Ее нельзя мапить на внутреннюю Саиду.
- Люди из группы должны попадать в проект как отдельные участники, а не одной строкой "группа".
- Партнер, руководитель, менеджер, ассистент, налоговик должны быть назначаемыми ролями внутри команды проекта.
- RBI/партнерские таблицы нужно разнести по проектам, но конфликтные случаи не заливать вслепую.

Требования по закрытию проектов и таймшитам:

- Проекты из подтвержденных закрытых таблиц должны быть закрыты.
- Команда проекта должна быть распределена.
- Таймшиты должны быть подтверждены.
- CEO должен видеть, что команда распределена, таймшиты распределены и участники назначены.
- Генеральный директор должен иметь возможность подтвердить итог и закрыть проект.

Требования по архитектуре и "единой истине":

- Все проектные таблицы по итогу должны сводиться в один большой свод по проектам.
- Не должно быть много разрозненных таблиц для утверждения команды, бонусов, партнеров, закрытия и т.д.
- Основной источник истины должен быть один: проект.
- В одном проектном реестре должны быть проект, сумма, сроки, команда, партнеры, руководители, статусы, таймшиты, бонусы, расчеты, задачи.
- Вкладки/страницы могут различаться по доступу и роли пользователя, но не должны создавать разные источники данных.
- Логика должна быть проще, понятнее и функциональнее.
- Эффективность системы не должна упасть.
- Нельзя ломать то, что сейчас работает.

Требования по ролям и доступам:

- Админ и генеральный директор должны видеть полный CEO-свод.
- Замдиректора не должен видеть полный CEO-свод, но должен видеть частично: проект, сумму, сроки, команду, назначение команды.
- Генеральный директор должен видеть проект, сумму, сроки, команду, завершение, сдачу таймшитов, договоры/языки договоров, бонусы и итоговые подтверждения.
- У каждой роли должна быть своя роль в процессе, но общий реестр должен быть один.
- Генеральный директор должен видеть закрытые проекты и фильтровать по статусам.
- Генеральный директор должен видеть, кто сколько бонусов получил.
- Партнер может быть руководителем, руководитель может быть партнером, менеджер может быть ассистентом или супервайзером. Система не должна жестко ограничивать выбор человека только его штатной должностью.

Требования по UI/UX:

- Упростить фильтры, потому что текущие фильтры были слишком сложными.
- В любой выпадающий список команды нужно показывать всех сотрудников, а не только людей с соответствующей должностью.
- Выпадающий список должен быть поисковым: пользователь вводит первые 2-3 буквы и видит совпадения.
- Не нужно заставлять листать весь список сотрудников.
- В бонусах должны быть видны партнеры и руководители, иначе непонятно, как проект закрыт.
- Нужно показать суммы, бонусы и проценты понятнее.
- Пользователь критиковал слайдеры как неудобные: желательно сделать простое изменение процента стрелками вверх/вниз и видимую сумму.
- Была жалоба на mojibake-текст вида `РќР°Р·РЅР°С‡...`; текст в интерфейсе должен быть нормальным русским.

Требования к текущей задаче handoff:

- Подготовить полный handoff для другого агента.
- Изучить всю текущую сессию и фактическое состояние репозитория.
- Создать `HANDOFF_SESSION_2.md` в корне проекта.
- Ничего не исправлять и не переписывать.
- Не выдумывать отсутствующую информацию, неизвестное помечать как неизвестное.

## 3. Что конкретно было реализовано

Ниже перечислено то, что по состоянию сессии было реализовано или подготовлено. Часть изменений находится в незакоммиченном состоянии.

### Упрощение проектного интерфейса

- Центральная страница проектов сведена к `ProjectCommandCenter`.
- `src/pages/Projects.tsx` теперь открывает `ProjectCommandCenter` с разным `scope`:
  - `executive` для `ceo` и `admin`;
  - `operations` для остальных ролей.
- Старый маршрут `/project-command-center` редиректит на `/projects`.
- Ряд legacy-маршрутов редиректятся на `/projects` или `/timesheets`.
- Меню и навигация частично упрощены через изменения в `AppSidebar`, `MobileNavigation`, `AppHeader`.

### Назначение команды

- В страницах/компонентах назначения команды снята жесткая фильтрация сотрудников по штатной роли.
- В выпадающих списках можно выбирать любого сотрудника на любую проектную роль.
- Добавлен/используется поисковый dropdown `EmployeeSearchSelect` в ключевых местах.
- Поправлен текст с mojibake на странице назначения команды.

### CEO/админ свод и бонусы

- В `CEOSummaryTable` расширена логика CEO-сводки:
  - фильтры по статусам;
  - поиск;
  - сортировка;
  - показ партнеров, руководителей и команды;
  - расчетные суммы, база бонуса, проценты, прибыль, часы;
  - expanded row с управлением бонусами/командой/закрытием.
- Добавлены быстрые фильтры, включая ожидающие CEO, закрытые, без команды, без суммы, оплаченные.
- Исправлено сохранение/чтение финансов из `projects.notes.finances`, чтобы бонусы не терялись при маппинге проекта.
- `calculateProjectFinances` теперь сохраняет уже существующие поля бонусов и ручные корректировки.

### Excel/partner ledger: Кенжекулов

- Были созданы скрипты анализа/закрытия по партнерскому ledger.
- По ранее зафиксированному результату:
  - агрессивный проход обновил 47 строк ledger;
  - это 41 уникальный проект;
  - ошибок обновления не было;
  - подтверждены таймшиты: 697 строк / 5129.8 часов;
  - осталось 5 unmatched: `БОЗОЙ`, `АО КТК`, `Мирбуш`, `ТОО ТИМ`, `ТОО TGAlfarabi`;
  - `Саида (ГПХ)` оставлена внешним лицом, не замаплена на внутреннюю Саиду.

### RBI Excel enrichment

Созданы и использованы скрипты:

- `scripts/dryrun-rbi-project-enrichment.mjs`
- `scripts/add-rbi-missing-people.mjs`

Функция `dryrun-rbi-project-enrichment.mjs`:

- читает RBI/партнерские Excel-файлы;
- извлекает строки проектов;
- нормализует клиентов, проекты, периоды, людей;
- ищет соответствия с текущими проектами в Supabase;
- классифицирует совпадения как exact/probable/conflict/not_found;
- предлагает добавления команды;
- формирует отчеты;
- в режиме `--commit` пишет только безопасные совпадения без конфликтов и без незамапленных людей;
- обновляет `projects.notes.team`;
- записывает маркер `rbiEnrichment`;
- может обновлять `partner_id` и `manager_id` там, где это безопасно.

Функция `add-rbi-missing-people.mjs`:

- читает `reports/rbi-project-enrichment-dryrun/people-review.json`;
- канонизирует имена;
- схлопывает часть дублей с обратным порядком имени/фамилии;
- добавляет отсутствующих сотрудников в `employees`;
- назначает роль по источнику:
  - source role `partner` -> `partner`;
  - source role `project_leader` -> `manager`;
  - source role `tax` -> `tax_specialist`;
  - остальные -> `employee`;
- email/password/whatsapp не заполняются.

Зафиксированные результаты RBI по отчетам:

- Source rows: 467.
- Exact matches: 228.
- Probable matches: 50.
- Project conflicts: 66.
- Not found: 123.
- People mapped: 833.
- Team additions proposed: 268.
- Existing team members: 384.
- Unmatched people после добавления сотрудников: 0.
- External/GPH people: 12.

По предыдущей проверке live Supabase в рамках сессии:

- 144 проекта имели `notes.rbiEnrichment.marker = auto:rbi-project-enrichment-2026-07-02`.
- 152 team members имели `assignedBy = auto:rbi-project-enrichment-2026-07-02`.

Эта live-проверка не была повторена при подготовке handoff из-за ограничения сети в текущем окружении.

### Добавление отсутствующих людей

После первого RBI dry-run было найдено 54 уникальных отсутствующих человека. Скрипт добавления людей схлопнул часть дублей и добавил 51 сотрудника:

- 4 с ролью `partner`;
- 2 с ролью `manager`;
- 45 с ролью `employee`.

Примеры добавленных людей из зафиксированного вывода:

- `Кудайбергенова Шолпанай` как `partner`;
- `Сауле Тримова` как `employee`;
- `Альфира Хисамитдинова` как `employee`;
- `Жумадилов Бакыт` как `partner`;
- `Василий Павленко` как `employee`.

Логины/пароли/email этим людям не создавались.

### Seafile / файлы / email / восстановление пароля

В рабочем дереве есть незакоммиченные изменения, не напрямую связанные с RBI-import, но фактически присутствующие:

- добавлены API-хелперы для Seafile;
- добавлены proxy/endpoints для Seafile;
- изменен `ProjectFileManager`;
- добавлен перенос/миграция файлов из Supabase Storage в Seafile;
- добавлены email settings, SMTP test/send email, восстановление пароля;
- добавлена миграция email settings;
- добавлены страницы `ForgotPassword` и `ResetPassword`.

Эти изменения нужно считать частью текущего dirty state, но они не были основной задачей последней просьбы пользователя.

## 4. Какие файлы создавались и изменялись, с точными путями

### Созданный файл handoff

- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\HANDOFF_SESSION_2.md`

### Модифицированные tracked-файлы

По `git diff --name-status`:

- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\.vercelignore`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\send-email.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\test-smtp.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\server.js`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\App.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\AppHeader.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\AppSidebar.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\MobileNavigation.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\ProtectedRoute.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\projects\AuditPeriodsEditor.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\projects\CEOSummaryTable.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\projects\ContractEditor.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\projects\ProjectFileManager.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\projects\TeamAssignment.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\settings\UserCompanyAssignment.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\contexts\AuthContext.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\hooks\useFilteredProjects.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\hooks\useProjects.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\hooks\useSupabaseData.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\integrations\supabase\types.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\api.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\appSettings.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\auditPeriods.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\emailService.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\supabaseDataStore.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\userCompanyAccess.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\AssignPartners.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\Bonuses.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\CreateProjectProcurement.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\HR.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\Index.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\ProjectApproval.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\ProjectSurveyResults.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\ProjectWorkspace.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\Register.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\SMTPSettings.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\Settings.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\Timesheets.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\UserManagement.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\types\companies.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\types\project-v3.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\types\roles.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\tests\access\role-page-access.spec.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\tests\server-file-auth.test.mjs`

### Untracked-файлы и папки, которые сейчас есть в рабочем дереве

- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\.agents\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\.claude\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\PLAN.md`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\_email-utils.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\_seafile-access.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\_seafile-utils.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\email-settings.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\request-password-reset.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\api\seafile\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\docs\superpowers\plans\2026-07-01-seafile-file-access.md`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\playwright-report\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\reports\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\add-rbi-missing-people.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\analyze-kenzhekulov-projects.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\approve-ledger-project-timesheets.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\auto-assign-partners-from-timesheets.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\cleanup-timesheet-exact-duplicates.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\cleanup-timesheet-manual-import-overlays.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\close-partner-ledger-projects.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\dryrun-rbi-project-enrichment.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\fix-partner-ledger-multi-partners.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\fix-saida-gph-ledger-mapping.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\import-saule-ledger.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\scripts\migrate-supabase-storage-to-seafile.mjs`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\components\settings\EmailSettingsPanel.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\contractData.test.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\contractData.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\lib\roleAccess.ts`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\ForgotPassword.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\ProjectCommandCenter.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\Projects.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\src\pages\ResetPassword.tsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\supabase\.temp\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\supabase\migrations\20260609000000_refresh_employees_password_schema.sql`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\supabase\migrations\20260624000000_add_email_settings.sql`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\test-results\`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\tests\seafile-access.test.mjs`

## 5. Текущая архитектура проекта

Проект является React/Vite SPA с Supabase как основным backend/storage данных приложения и рядом serverless/API endpoints.

Ключевые части:

- Frontend:
  - `src\App.tsx` - маршруты и layout.
  - `src\pages\Projects.tsx` - единая точка входа в проектный центр.
  - `src\pages\ProjectCommandCenter.tsx` - центральный проектный реестр/операционный центр.
  - `src\components\projects\CEOSummaryTable.tsx` - CEO/админ финансовый и бонусный свод.
  - `src\pages\AssignPartners.tsx` - назначение команды/партнеров.
  - `src\pages\ProjectApproval.tsx` - утверждение проектов.
  - `src\pages\Bonuses.tsx` - бонусы.
  - `src\pages\Timesheets.tsx` - таймшиты.
  - `src\pages\ProjectWorkspace.tsx` - рабочее пространство проекта.

- Data layer:
  - `src\lib\supabaseDataStore.ts` - основной слой чтения/записи Supabase и fallback на localStorage.
  - `src\hooks\useSupabaseData.ts` - hooks для данных.
  - `src\hooks\useProjects.ts` - проекты.
  - `src\hooks\useFilteredProjects.ts` - фильтрация проектов.
  - `src\integrations\supabase\types.ts` - типы Supabase.

- Types/business logic:
  - `src\types\project-v3.ts` - расширенная модель проекта и расчет финансов.
  - `src\types\roles.ts` - локальные роли, разрешения и проценты бонусов.
  - `src\lib\roleAccess.ts` - новая матрица доступа страниц.
  - `src\lib\contractData.ts` - контрактные данные, новый untracked-файл.
  - `src\lib\auditPeriods.ts` - периоды аудита.
  - `src\lib\appSettings.ts` - настройки приложения.

- API/server:
  - `server.js` - Node/Express сервер и proxy/API.
  - `api\*.mjs` - serverless endpoints для email, Seafile и т.д.

- Scripts/reports:
  - `scripts\*.mjs` - одноразовые и сервисные скрипты импорта/очистки/миграций.
  - `reports\*` - результаты dry-run/commit/QA.

Текущая практическая архитектурная идея:

- Supabase `projects` остается центральной таблицей.
- Значительная часть сложной проектной модели хранится в JSON-строке `projects.notes`.
- Top-level поля `projects.name`, `projects.status`, `projects.partner_id`, `projects.manager_id`, `projects.start_date`, `projects.deadline`, `projects.kpi_percentage` используются для быстрых связей/фильтров.
- Более богатые данные - команда, финансы, задачи, договоры, периоды, RBI markers - живут в `notes`.
- Это дает гибкость, но создает технический долг: часть данных не нормализована и не имеет строгих DB constraints.

## 6. Структура базы данных, таблицы, поля, связи и миграции

Информация ниже взята из `src\integrations\supabase\types.ts` и списка миграций в репозитории. Фактическое состояние live Supabase может отличаться, потому что не все миграции могли быть применены.

### Основные таблицы

#### `projects`

Поля:

- `id: string`
- `name: string`
- `status: project_status`
- `partner_id: string | null` -> FK `employees.id`
- `manager_id: string | null` -> FK `employees.id`
- `start_date: string | null`
- `deadline: string | null`
- `kpi_percentage: number | null`
- `notes: string | null`
- `created_at: string`
- `updated_at: string`

Назначение:

- центральная таблица проектов;
- `notes` содержит JSON расширенной модели проекта;
- `partner_id` и `manager_id` дублируют ключевые роли для быстрых связей.

#### `employees`

Поля:

- `id: string`
- `name: string`
- `email: string | null`
- `password: string | null`
- `role: app_role`
- `level: employee_level | null`
- `whatsapp: string | null`
- `created_at: string`
- `updated_at: string`

Назначение:

- сотрудники и пользователи системы;
- новые RBI-люди добавлены сюда без email/password/whatsapp.

#### `timesheets`

Поля:

- `id: string`
- `employee_id: string | null` -> FK `employees.id`
- `project_id: string | null` -> FK `projects.id`
- `date: string`
- `hours: number`
- `work_type: string`
- `notes: string | null`
- `created_at: string`
- `updated_at: string`

Назначение:

- старая/основная таблица таймшитов по проектам.

#### `timesheet_entries`

Поля:

- `id: string`
- `employee_id: string | null`
- `employee_name: string`
- `project_id: string | null`
- `project_name: string`
- `work_date: string`
- `hours: number`
- `section: string | null`
- `position: string | null`
- `location: string | null`
- `city: string | null`
- `manager_raw: string | null`
- `partner_raw: string | null`
- `notes: string | null`
- `source: string`
- `import_batch_id: string | null`
- `status: string`
- `reviewed_by: string | null`
- `reviewed_by_name: string | null`
- `reviewed_at: string | null`
- `reviewer_notes: string | null`
- `created_by: string | null`
- `created_at: string`
- `updated_at: string`

Назначение:

- импортированные/детальные таймшиты;
- поддерживает review/approval.

#### `bonuses`

Поля:

- `id: string`
- `employee_id: string | null` -> FK `employees.id`
- `project_id: string | null` -> FK `projects.id`
- `bonus_amount: number`
- `kpi_percentage: number`
- `payment_date: string | null`
- `status: bonus_status`
- `created_at: string`
- `updated_at: string`

Назначение:

- отдельная таблица бонусов, но текущая бизнес-логика также хранит teamBonuses внутри `projects.notes.finances`.
- Это потенциальный конфликт "единой истины".

#### `project_team`

Поля:

- `id: string`
- `project_id: string | null` -> FK `projects.id`
- `employee_id: string | null` -> FK `employees.id`
- `role_on_project: string`
- `created_at: string`
- `updated_at: string`

Назначение:

- нормализованная таблица проектной команды.
- В текущей реализации команда в основном живет в `projects.notes.team`; неясно, насколько активно используется `project_team`.

#### `project_participants`

Поля:

- `id: string`
- `project_id: string | null` -> FK `projects.id`
- `employee_id: string | null` -> FK `employees.id`
- `created_at: string`

Назначение:

- участники проекта; фактическая роль в текущей логике не до конца ясна.

#### `tasks`

Поля:

- `id: string`
- `project_id: string | null` -> FK `projects.id`
- `parent_task_id: string | null` -> FK `tasks.id`
- `reporter: string | null` -> FK `employees.id`
- `title: string`
- `description: string | null`
- `status: string`
- `priority: string`
- `labels: string[]`
- `assignees: Json`
- `estimate_h: number | null`
- `spent_h: number | null`
- `due_at: string | null`
- `attachments: Json`
- `checklist: Json`
- `comments: Json`
- `created_at: string`
- `updated_at: string`

Назначение:

- задачи проекта. Пользователь хотел, чтобы задачи тоже попадали в общий проектный свод.

#### `attendance`

Поля:

- `id: string`
- `employee_id: string | null` -> FK `employees.id`
- `date: string`
- `check_in: string | null`
- `check_out: string | null`
- `check_in_lat/lng/accuracy`
- `check_out_lat/lng/accuracy`
- `location_type: string | null`
- `office_id: string | null`
- `work_duration: number | null`
- `status: string | null`
- `notes: string | null`
- `created_at`
- `updated_at`

Назначение:

- посещаемость; пользователь отдельно упоминал, что посещаемость - отдельная таблица.

#### `companies`

Поля:

- `id`
- `name`
- `brand_color`
- `active`
- `created_at`
- `updated_at`

#### `user_company_access`

Поля:

- `id`
- `user_id`
- `company_ids: Json`
- `created_at`
- `updated_at`

Назначение:

- доступ пользователя к компаниям.

#### `app_settings`

Поля:

- `id`
- `show_demo_users`
- office location fields
- maintenance fields
- recent activity flags/roles
- `companies: Json`
- timestamps

#### Survey/AI/service memo tables

Есть также таблицы:

- `project_survey_config`
- `project_survey_proposals`
- `project_survey_responses`
- `ai_tasks`
- `n8n_chat_histories`
- `profiles`
- `service_memos`
- `service_memo_workflow`

Они не были центральными в последней задаче импорта проектов.

### Enums

#### `app_role`

По Supabase types:

- `partner`
- `project_manager`
- `assistant`
- `tax_specialist`
- `designer`
- `it_auditor`
- `admin`
- `manager`
- `employee`
- `it_admin`

Важно: локальные TypeScript-роли в `src\types\roles.ts` шире Supabase enum. Это архитектурный разрыв.

#### `project_status`

- `active`
- `in_progress`
- `completed`

#### `bonus_status`

- `approved`
- `pending`

#### `employee_level`

Точный список смотреть в `src\integrations\supabase\types.ts`.

### Functions

- `has_role(_role app_role, _user_id uuid?) -> boolean`

### Миграции в репозитории

В `supabase\migrations` есть исторические миграции, включая:

- `024_work_papers_system.sql`
- `20250109000001_project_data_tables.sql`
- `20250109000002_fix_uuid_issue.sql`
- `20250122000000_add_tenders_table.sql`
- `20250122000001_add_real_employees.sql`
- `20250122000002_clear_and_add_real_employees.sql`
- `20250122000003_add_audit_roles.sql`
- `20250122000004_add_manager_roles.sql`
- `20250122000004_add_manager_roles_simple.sql`
- `20250122120000_clear_all_demo_employees.sql`
- `20250123000001_project_files_and_amendments.sql`
- серия миграций `202508...`
- `20251022000001_create_attendance_table.sql`
- `20260101000000_add_app_settings.sql`
- `20260101000001_add_notifications.sql`
- `20260224000000_add_memos_and_evaluations.sql`
- `20260318000000_create_user_company_access.sql`
- `20260319000000_fix_attendance_rls_and_add_types.sql`
- `20260320000000_add_password_to_employees.sql`
- `20260512000000_add_project_survey.sql`
- `20260521000000_add_ai_audit_log.sql`
- `20260521010000_add_ai_chat.sql`
- `20260521020000_add_ai_tasks.sql`
- `20260526000000_add_recent_activity_visibility.sql`
- `20260526010000_add_recent_activity_visible_roles.sql`
- `20260527000000_add_timesheet_entries.sql`

Untracked новые миграции:

- `supabase\migrations\20260609000000_refresh_employees_password_schema.sql`
- `supabase\migrations\20260624000000_add_email_settings.sql`

Неизвестно:

- какие из миграций применены в live Supabase;
- применены ли две untracked миграции;
- полностью ли схема live DB соответствует `src\integrations\supabase\types.ts`.

## 7. Логика проектов, сотрудников, ролей, команд, оценок и бонусов

### Проекты

Проект сейчас имеет два слоя данных:

- top-level Supabase fields в `projects`;
- расширенный JSON в `projects.notes`.

`src\lib\supabaseDataStore.ts`:

- при создании проекта кладет полную модель в `notes`;
- при чтении проекта парсит `notes`;
- при обновлении проекта мержит изменения в JSON;
- возвращает объект проекта, где `notes` остается доступным отдельно.

`src\types\project-v3.ts` описывает расширенный проект:

- client;
- contract;
- team;
- tasks;
- kpiRatings;
- reportInfo;
- finances;
- files;
- stages;
- auditPeriods;
- services/amendments;
- visibility.

### Команда

Ключевая текущая логика команды:

- команда проекта хранится в `project.notes.team`;
- team members имеют `employeeId`, `name`, `role`, `roleDisplayName`, проценты/суммы бонусов и служебные поля;
- RBI import добавлял участников в `notes.team`;
- marker импорта: `assignedBy = auto:rbi-project-enrichment-2026-07-02`;
- для проекта также могут обновляться `partner_id` и `manager_id`, если безопасно.

Практический принцип после требований пользователя:

- любой сотрудник может быть назначен в любую проектную роль;
- системная роль сотрудника не должна блокировать назначение в проектную роль;
- dropdown должен быть поисковым.

### Роли

В `src\types\roles.ts` есть расширенные локальные роли:

- `ceo`
- `deputy_director`
- `company_director`
- `procurement`
- `partner`
- `project_leader`
- `manager_1`
- `manager_2`
- `manager_3`
- `supervisor_1`
- `supervisor_2`
- `supervisor_3`
- `tax_specialist_1`
- `tax_specialist_2`
- `assistant_1`
- `assistant_2`
- `assistant_3`
- `contractor`
- `academy`
- `hr`
- `accountant`
- `admin_staff`
- `admin`

Supabase `app_role` значительно уже:

- `partner`
- `project_manager`
- `assistant`
- `tax_specialist`
- `designer`
- `it_auditor`
- `admin`
- `manager`
- `employee`
- `it_admin`

Это означает, что часть ролей существует только в приложении/типах/JSON и не является прямым Supabase enum.

### Матрица доступа

`src\lib\roleAccess.ts`:

- `all` - все роли;
- `admin` - admin;
- `executive` - ceo, admin;
- `management` - ceo, deputy_director, admin;
- `hrManagement` - hr, ceo, deputy_director, admin;
- `procurement` / `procurementAdmin`;
- `ai`.

Целевое поведение:

- admin/CEO видят полный проектный и бонусный свод;
- deputy_director видит операционную часть и назначение команды;
- финансовые детали и CEO approval должны быть ограничены.

### Оценки/KPI

В проекте есть:

- `kpi_percentage` top-level в `projects`;
- `kpiRatings` в расширенной модели;
- бонусы используют KPI-проценты.

Точная актуальная UI-логика оценок требует отдельной проверки, потому что часть кода изменилась и часть остается legacy.

### Бонусы

В `PROJECT_ROLES` из `src\types\roles.ts` заданы проценты:

- `partner`: 25
- `project_leader`: 4
- `manager_1`: 10
- `manager_2`: 8
- `manager_3`: 6
- `supervisor_3`: 15
- `supervisor_2`: 10
- `supervisor_1`: 6
- `tax_specialist_1`: 3
- `tax_specialist_2`: 3
- `assistant_3`: 4
- `assistant_2`: 4
- `assistant_1`: 2
- остальные роли: 0

`calculateProjectFinances`:

- читает сумму без НДС;
- берет `preExpensePercent`, по умолчанию 30;
- учитывает contractors;
- считает `bonusBase = amountWithoutVAT - totalContractorsAmount - preExpenseAmount`;
- берет `bonusPercent`, по умолчанию 10;
- считает `totalBonusAmount`;
- распределяет `teamBonuses` по участникам;
- сохраняет ручные корректировки, если `manuallyAdjusted`;
- считает `totalPaidBonuses`, `totalCosts`, `grossProfit`, `profitMargin`.

Проблема/техдолг:

- есть отдельная таблица `bonuses`;
- есть `project.notes.finances.teamBonuses`;
- пользователь хочет один источник истины, но сейчас бонусы потенциально существуют в двух местах.

## 8. Все используемые Excel, Google Sheets, папки и другие источники данных

### Excel-файлы RBI/партнеров, указанные пользователем

Пути из временной RAR-папки:

- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\1 кв Проекты 2024_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\1 кв Проекты 2025_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\1 кв Проекты 2026_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\2 кв Проекты 2024_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\2 кв Проекты 2025_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\3 кв Проекты 2024_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\3 кв Проекты 2025_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\4 кв Проекты 2024_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\4 кв Проекты 2025_RBI.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\Гульмира_Аудит ФО 2025-2026_Проекты.xlsx`
- `C:\Users\UserPC\AppData\Local\Temp\Rar$DRa114884.41954.rartemp\Сейфулина_Проекты октябрь 2024-октябрь 2025.xlsx`

Риск: это temp/RAR path. Файлы могут исчезнуть после закрытия архива/очистки temp. Если нужно продолжать импорт, сначала проверить наличие файлов или перенести их в устойчивую папку.

### Локальные Excel-файлы в корне проекта

В сессии упоминались/использовались:

- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\Проекты Кенжекулов.xlsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\САУЛЕ 2024 окт-2025 окт.xlsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\Аманов Онгар.xlsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\Бадамбаева Сауле(1).xlsx`
- `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb\Сартаева Гаухар(1).xlsx`

Точное состояние импорта последних трех файлов неизвестно.

### Reports folders

Ключевые отчеты:

- `reports\kenzhekulov-projects\analysis.json`
- `reports\kenzhekulov-projects\summary.txt`
- `reports\partner-ledger-close\partner-ledger-close-plan.xlsx`
- `reports\partner-ledger-close\partner-ledger-close-report.json`
- `reports\rbi-project-enrichment-dryrun\dryrun.json`
- `reports\rbi-project-enrichment-dryrun\matches.csv`
- `reports\rbi-project-enrichment-dryrun\needs-review.csv`
- `reports\rbi-project-enrichment-dryrun\people-review.csv`
- `reports\rbi-project-enrichment-dryrun\people-review.json`
- `reports\rbi-project-enrichment-dryrun\people-add-results.csv`
- `reports\rbi-project-enrichment-dryrun\people-add-results.json`
- `reports\rbi-project-enrichment-dryrun\commit-results.csv`
- `reports\rbi-project-enrichment-dryrun\commit-results.json`
- `reports\rbi-project-enrichment-dryrun\summary.md`
- `reports\saule-ledger-import\saule-ledger-import-plan.xlsx`
- `reports\saule-ledger-import\saule-ledger-import-report.json`
- `reports\timesheet-duplicate-cleanup\*`
- `reports\tinay-timesheet-fix\*`
- `reports\supabase-to-seafile-*.json`
- `reports\qa\*.md`

### Google Sheets

В этой сессии Google Sheets connector не использовался. Google Sheets как источник данных не подтвержден. Если они есть у пользователя вне сессии, информация неизвестна.

### Supabase

Supabase является основным live source of truth для:

- projects;
- employees;
- timesheets/timesheet_entries;
- bonuses;
- companies;
- settings;
- files metadata.

### Seafile

Появилась интеграция с Seafile:

- URL/credentials берутся из env;
- API-хелперы в `api\_seafile-utils.mjs`, `api\_seafile-access.mjs`;
- миграционный скрипт `scripts\migrate-supabase-storage-to-seafile.mjs`;
- отчеты `reports\supabase-to-seafile-*`.

Насколько миграция полностью завершена - неизвестно.

## 9. Что импортировалось, что не импортировалось и почему

### Импортировано/обновлено

По Кенжекулов ledger:

- 47 ledger rows / 41 unique projects обновлены/закрыты;
- связанные таймшиты подтверждены: 697 rows / 5129.8 hours;
- команда распределена там, где проект/люди были уверенно сопоставлены;
- `Саида (ГПХ)` не замаплена на внутреннюю Саиду.

По RBI enrichment:

- безопасные exact/probable совпадения были записаны в Supabase;
- после добавления missing people повторный commit записал дополнительные команды;
- зафиксированный итог по live-проверке: 144 проекта с RBI marker, 152 team members с RBI assignedBy marker;
- добавлен 51 новый сотрудник из RBI files.

### Не импортировано

RBI:

- 66 project conflicts;
- 123 not found projects;
- 12 external/GPH people.

Причины:

- конфликтующие данные по партнеру/руководителю/проекту;
- неоднозначное сопоставление проекта;
- проект не найден в системе;
- внешние/ГПХ люди не должны автоматически становиться внутренними сотрудниками;
- пользователь явно просил не ломать существующее и улучшать качество данных, поэтому конфликтные случаи не заливались вслепую.

Кенжекулов:

- 5 unmatched projects: `БОЗОЙ`, `АО КТК`, `Мирбуш`, `ТОО ТИМ`, `ТОО TGAlfarabi`.

Причина:

- проекты не были уверенно найдены/сопоставлены.

Неизвестно:

- импортированы ли полностью файлы `Аманов Онгар.xlsx`, `Бадамбаева Сауле(1).xlsx`, `Сартаева Гаухар(1).xlsx`;
- применялись ли отчеты `saule-ledger-import` в live DB;
- полностью ли закрыты все проекты RBI, потому что RBI enrichment был в первую очередь про команду/данные, а не финальное закрытие/approval.

## 10. Все принятые решения и причины

### Не создавать новые таблицы под каждый workflow

Причина: пользователь резко обозначил, что не хочет "миллион таблиц" и хочет одну большую таблицу/свод по проектам.

Практическое решение:

- вести проектную истину через `projects` и `projects.notes`;
- UI делать role-based, но не data-source-based.

### Хранить расширенные проектные поля в `projects.notes`

Причина:

- текущая система уже использует `notes` как JSON;
- быстрее и безопаснее дополнять без рискованных миграций схемы;
- это позволяет не ломать существующие таблицы.

Минус:

- нет строгих constraints;
- сложнее писать SQL-отчеты;
- `notes` становится перегруженным.

### Импортировать только безопасные совпадения

Причина:

- конфликтные партнеры/руководители могут испортить данные;
- пользователь хотел качество данных;
- часть названий похожа, но не гарантированно та же сущность.

### Добавлять отсутствующих людей как employees без логинов

Причина:

- они нужны для проектных команд и бонусной истории;
- email/password неизвестны;
- создание активных аккаунтов без данных было бы неверным.

### Не мапить ГПХ/внешних людей на внутренних

Причина:

- пользователь явно сказал, что `Саида ГПХ` - другая Саида;
- важно не начислить бонусы внутреннему сотруднику ошибочно.

### Разрешить выбор любого сотрудника в любую проектную роль

Причина:

- пользователь прямо сказал, что партнер может быть руководителем, руководитель партнером, менеджер ассистентом/супервайзером;
- проектная роль не равна штатной роли.

### Сделать поисковый dropdown

Причина:

- пользователь не хочет листать весь список сотрудников.

### CEO/admin полный свод, deputy partial

Причина:

- требование пользователя по доступам: CEO/admin видят полный CEO-свод, замдиректор видит операционную часть.

## 11. Что пробовали сделать, но не получилось

- Полностью автоматом импортировать все RBI строки не было сделано: 66 conflicts и 123 not found оставлены на review.
- Не получилось безопасно закрыть все RBI проекты только по таблицам, потому что не все проекты нашли точное соответствие в системе.
- Не было подтверждено, что все новые RBI team additions корректно отображаются в продовом UI после деплоя: это пользователь собирался проверить вручную.
- Были проблемы с mojibake/encoding:
  - в UI был текст вида `РќР°Р·...`;
  - текущие скрипты/отчеты при чтении через PowerShell показывают русские строки mojibake;
  - неизвестно, проблема только консольная или файлы реально содержат битую кодировку.
- PowerShell path с `Rar$DRa...` может ломаться при неосторожном использовании `$`, поэтому пути нужно всегда передавать как literal/single-quoted.
- Некоторые inline shell/script попытки в ходе работы ломались из-за quoting/PowerShell, затем обходились более устойчивыми скриптами.
- Нельзя сейчас подтвердить live DB состояние повторным запросом из-за restricted network в текущем окружении.

## 12. Известные ошибки, временные решения, заглушки и технический долг

### Data model debt

- `projects.notes` перегружен и хранит большую часть бизнес-логики как JSON.
- Есть потенциальный split-brain между:
  - `projects.notes.team`;
  - `project_team`;
  - `project_participants`;
  - `projects.partner_id`;
  - `projects.manager_id`.
- Есть потенциальный split-brain между:
  - `bonuses`;
  - `projects.notes.finances.teamBonuses`.

### Roles debt

- Локальные роли в `src\types\roles.ts` шире, чем Supabase enum `app_role`.
- Не все локальные роли могут быть сохранены напрямую в `employees.role`.
- Скрипты добавления людей мапят часть ролей грубо: `project_leader` -> `manager`, остальные -> `employee`.

### Encoding debt

- Русские тексты в некоторых generated/report/script файлах показываются mojibake.
- Перед повторным запуском/редактированием скриптов нужно проверить encoding и output.

### Import debt

- RBI conflicts/not found требуют ручного review.
- External/GPH люди не импортированы и требуют отдельной политики: external participant, contractor или просто note.
- Новые employees добавлены без email/password/whatsapp, поэтому они не являются полноценными пользователями.
- Непонятно, есть ли дубли сотрудников после добавления RBI people.

### UI debt

- Пользователь все еще считает UI сложным.
- Слайдеры бонусов были раскритикованы; нужна замена/упрощение на более понятный процентный control и видимую сумму.
- Фильтры были частично упрощены, но пользователь просил "нормальные фильтры"; финальное UX не утверждено.
- Нужно проверить, что CEO/admin действительно видит закрытые проекты, партнеров, руководителей, бонусы и суммы.

### Repo state debt

- Очень большой dirty working tree.
- Много unrelated work в одном дереве: проекты, Seafile, email/password reset, tests, reports.
- Нет коммита, который отделяет RBI import scripts от UI/Seafile/email изменений.
- `git status` показывает warning о permission denied для `C:\Users\UserPC/.config/git/ignore`.

### Security/config debt

- Некоторые scripts/API могут содержать Supabase URL/key прямо в коде. Значения в этом handoff не указаны.
- Следует вынести любые ключи в env, даже если это anon key.
- Неизвестно, какие env переменные реально настроены на Vercel/локально.

## 13. Что сейчас работает, что работает частично и что не работает

### Работает или должно работать по реализованной логике

- React/Vite SPA с Supabase.
- Единый вход `/projects` в `ProjectCommandCenter`.
- CEO/admin scope для project center.
- Назначение любого сотрудника на проектную роль в измененных dropdown.
- Поисковый выбор сотрудников в ключевых местах.
- Чтение финансов из `projects.notes.finances`.
- Сохранение существующих/manual bonus данных при пересчете финансов.
- RBI dry-run/report generation.
- Добавление missing people из RBI people review.
- Safe RBI commit для clean matches.
- Kенжекулов ledger close/timesheet approval по ранее выполненному скрипту.

### Работает частично

- "Один большой свод по проектам": направление реализовано через `ProjectCommandCenter`/`CEOSummaryTable`, но система все еще содержит legacy страницы и несколько таблиц/источников.
- CEO visibility: код менялся, но нужна ручная проверка под admin/CEO.
- Бонусы: расчеты есть, но source of truth не до конца единый.
- Таймшиты: связанные таблицы есть, approval делался для ledger, но RBI закрытие/approval не завершены полностью.
- Фильтры: упрощались, но пользователь просил дальнейшее упрощение.
- Seafile/email/password reset: есть незакоммиченные реализации, но состояние production неизвестно.

### Не работает / не завершено / неизвестно

- Автоматический импорт всех RBI проектов не завершен.
- 66 conflicts и 123 not found не разнесены.
- Не подтверждено, что все проекты из RBI закрыты.
- Не подтверждено, что все связанные RBI таймшиты подтверждены.
- Неизвестно, отображаются ли все новые участники в бонусах после деплоя.
- Неизвестно, применены ли новые миграции email settings/password refresh.
- Неизвестно, прошли ли все тесты после текущих изменений.

## 14. Все незавершенные задачи

1. Проверить UI под admin/CEO:
   - видны ли закрытые проекты;
   - видны ли партнеры/руководители;
   - видны ли команды;
   - видны ли суммы/бонусы/проценты;
   - можно ли фильтровать по статусам.

2. Проверить UI под deputy_director:
   - видит ли только разрешенную часть;
   - может ли назначать команду;
   - не видит ли полный CEO financial scope.

3. Разобрать `reports\rbi-project-enrichment-dryrun\needs-review.csv`:
   - 66 conflicts;
   - 123 not found;
   - принять решения по каждому.

4. Решить политику по external/GPH людям:
   - external participant in notes;
   - contractor;
   - employee without login;
   - не учитывать в бонусах.

5. Проверить и почистить дубли employees после RBI add.

6. Решить единый source of truth для бонусов:
   - `bonuses`;
   - `projects.notes.finances.teamBonuses`;
   - либо синхронизация/миграция.

7. Решить единый source of truth для команды:
   - `projects.notes.team`;
   - `project_team`;
   - `project_participants`;
   - top-level `partner_id/manager_id`.

8. Закрыть/подтвердить оставшиеся проекты, если пользователь подтвердит conflicts/not found.

9. Подтвердить RBI-related таймшиты, если это еще не сделано.

10. Упростить bonus controls:
   - заменить/дополнить слайдеры понятным numeric stepper;
   - показывать сумму рядом с процентом.

11. Завершить фильтры в `ProjectCommandCenter`/`CEOSummaryTable` по фактическому workflow пользователя.

12. Проверить encoding скриптов и отчетов.

13. Разнести dirty work на осмысленные коммиты:
   - project center / roles / UI;
   - RBI scripts/reports;
   - Seafile;
   - email/password reset;
   - tests.

14. Прогнать build/typecheck/tests.

15. Деплой и ручная проверка пользователем.

## 15. Команды запуска, сборки, тестирования и развёртывания

Из `package.json`:

- Установка зависимостей:
  - `npm install`
  - на Vercel используется `npm install --legacy-peer-deps`

- Dev frontend:
  - `npm run dev`

- Dev server/API:
  - `npm run dev:server`
  - или напрямую `node server.js`

- Build:
  - `npm run build`

- Preview:
  - `npm run preview`

- Start:
  - `npm start`

- Typecheck:
  - `npm run typecheck`

- Lint:
  - `npm run lint`

- Playwright tests:
  - `npm test`
  - или `npm run test`

- Unit tests:
  - `npm run test:unit`

- Access tests:
  - `npm run test:access`

- Route tests:
  - `npm run test:routes`

- Auth readiness:
  - `npm run audit:auth-readiness`

Vercel:

- `vercel.json` задает build command `npm run build`, output `dist`, install command `npm install --legacy-peer-deps`.
- Все маршруты SPA переписываются на `/index.html`.
- `/seafile-proxy/(.*)` переписывается на `https://cloud.rbpartners.kz/$1`.

Скрипты RBI:

- Dry-run:
  - `node scripts/dryrun-rbi-project-enrichment.mjs`
- Commit safe matches:
  - `node scripts/dryrun-rbi-project-enrichment.mjs --commit`
- Add missing people:
  - `node scripts/add-rbi-missing-people.mjs --commit`

Перед повторным запуском RBI scripts:

- проверить наличие Excel-файлов в temp path;
- проверить encoding;
- проверить, что scripts не содержат stale hardcoded credentials;
- сделать свежий dry-run.

## 16. Переменные окружения, только названия

Названия env, встречающиеся в проекте:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_SERVICE_ROLE`
- `REQUIRE_SUPABASE_JWT`
- `ALLOWED_ORIGINS`
- `NAS_STORAGE_PATH`
- `PORT`
- `PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `VITE_PUBLIC_APP_URL`
- `APP_URL`
- `SITE_URL`
- `VERCEL_URL`
- `SEAFILE_URL`
- `SEAFILE_USERNAME`
- `SEAFILE_PASSWORD`
- `SEAFILE_TOKEN`
- `SEAFILE_REPO_ID`
- `VITE_SEAFILE_BASE_URL`
- `VITE_SEAFILE_URL`
- `VITE_SEAFILE_TOKEN`
- `VITE_SEAFILE_REPO_ID`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_FROM`
- `SMTP_FROM_NAME`
- `MAIL_HOST`
- `MAIL_USER`
- `MAIL_PASSWORD`
- `MAIL_PORT`
- `MAIL_SECURE`
- `MAIL_FROM`
- `MAIL_FROM_NAME`

Секретные значения намеренно не указаны.

## 17. Текущий git branch, последний commit и git status

Текущая ветка:

- `main`

Последний commit:

- `6fc7200 (HEAD -> main, origin/main, origin/HEAD) fix(project-workspace): restore isCompleted flag`

`git status --short` на момент handoff:

```text
 M .vercelignore
 M api/send-email.mjs
 M api/test-smtp.mjs
 M server.js
 M src/App.tsx
 M src/components/AppHeader.tsx
 M src/components/AppSidebar.tsx
 M src/components/MobileNavigation.tsx
 M src/components/ProtectedRoute.tsx
 M src/components/projects/AuditPeriodsEditor.tsx
 M src/components/projects/CEOSummaryTable.tsx
 M src/components/projects/ContractEditor.tsx
 M src/components/projects/ProjectFileManager.tsx
 M src/components/projects/TeamAssignment.tsx
 M src/components/settings/UserCompanyAssignment.tsx
 M src/contexts/AuthContext.tsx
 M src/hooks/useFilteredProjects.ts
 M src/hooks/useProjects.ts
 M src/hooks/useSupabaseData.ts
 M src/integrations/supabase/types.ts
 M src/lib/api.ts
 M src/lib/appSettings.ts
 M src/lib/auditPeriods.ts
 M src/lib/emailService.ts
 M src/lib/supabaseDataStore.ts
 M src/lib/userCompanyAccess.ts
 M src/pages/AssignPartners.tsx
 M src/pages/Bonuses.tsx
 M src/pages/CreateProjectProcurement.tsx
 M src/pages/HR.tsx
 M src/pages/Index.tsx
 M src/pages/ProjectApproval.tsx
 M src/pages/ProjectSurveyResults.tsx
 M src/pages/ProjectWorkspace.tsx
 M src/pages/Register.tsx
 M src/pages/SMTPSettings.tsx
 M src/pages/Settings.tsx
 M src/pages/Timesheets.tsx
 M src/pages/UserManagement.tsx
 M src/types/companies.ts
 M src/types/project-v3.ts
 M src/types/roles.ts
 M tests/access/role-page-access.spec.ts
 M tests/server-file-auth.test.mjs
?? .agents/
?? .claude/
?? HANDOFF_SESSION_2.md
?? PLAN.md
?? api/_email-utils.mjs
?? api/_seafile-access.mjs
?? api/_seafile-utils.mjs
?? api/email-settings.mjs
?? api/request-password-reset.mjs
?? api/seafile/
?? docs/superpowers/plans/2026-07-01-seafile-file-access.md
?? playwright-report/
?? reports/
?? scripts/add-rbi-missing-people.mjs
?? scripts/analyze-kenzhekulov-projects.mjs
?? scripts/approve-ledger-project-timesheets.mjs
?? scripts/auto-assign-partners-from-timesheets.mjs
?? scripts/cleanup-timesheet-exact-duplicates.mjs
?? scripts/cleanup-timesheet-manual-import-overlays.mjs
?? scripts/close-partner-ledger-projects.mjs
?? scripts/dryrun-rbi-project-enrichment.mjs
?? scripts/fix-partner-ledger-multi-partners.mjs
?? scripts/fix-saida-gph-ledger-mapping.mjs
?? scripts/import-saule-ledger.mjs
?? scripts/migrate-supabase-storage-to-seafile.mjs
?? src/components/settings/EmailSettingsPanel.tsx
?? src/lib/contractData.test.ts
?? src/lib/contractData.ts
?? src/lib/roleAccess.ts
?? src/pages/ForgotPassword.tsx
?? src/pages/ProjectCommandCenter.tsx
?? src/pages/Projects.tsx
?? src/pages/ResetPassword.tsx
?? supabase/.temp/
?? supabase/migrations/20260609000000_refresh_employees_password_schema.sql
?? supabase/migrations/20260624000000_add_email_settings.sql
?? test-results/
?? tests/seafile-access.test.mjs
```

Git также выводил warning:

- `warning: unable to access 'C:\Users\UserPC/.config/git/ignore': Permission denied`
- LF/CRLF warnings для множества файлов.

## 18. Полное описание незакоммиченных изменений

`git diff --stat`:

```text
44 files changed, 3174 insertions(+), 1261 deletions(-)
```

Смысловые группы незакоммиченных изменений:

### Project center / project simplification

- `src\App.tsx`
- `src\pages\Projects.tsx`
- `src\pages\ProjectCommandCenter.tsx`
- `src\components\AppSidebar.tsx`
- `src\components\MobileNavigation.tsx`
- `src\components\AppHeader.tsx`

Суть:

- новый единый project center;
- редиректы legacy routes;
- упрощенная навигация;
- role-aware view.

### Team assignment / approvals / CEO summary

- `src\pages\AssignPartners.tsx`
- `src\pages\ProjectApproval.tsx`
- `src\components\projects\AuditPeriodsEditor.tsx`
- `src\components\projects\TeamAssignment.tsx`
- `src\components\projects\CEOSummaryTable.tsx`

Суть:

- выбор всех сотрудников в проектные роли;
- поисковый dropdown;
- расширение CEO summary;
- отображение команды/партнеров/руководителей/финансов;
- частичное исправление mojibake.

### Financial/project model

- `src\types\project-v3.ts`
- `src\types\roles.ts`
- `src\lib\supabaseDataStore.ts`
- `src\hooks\useProjects.ts`
- `src\hooks\useFilteredProjects.ts`
- `src\hooks\useSupabaseData.ts`
- `src\lib\auditPeriods.ts`
- `src\lib\contractData.ts`
- `src\lib\contractData.test.ts`

Суть:

- сохранение `notes.finances`;
- корректировка bonus/team finance behavior;
- contract/audit period helpers.

### Access/user/company settings

- `src\lib\roleAccess.ts`
- `src\components\ProtectedRoute.tsx`
- `src\lib\userCompanyAccess.ts`
- `src\components\settings\UserCompanyAssignment.tsx`
- `src\types\companies.ts`
- `src\pages\Settings.tsx`
- `src\pages\UserManagement.tsx`
- `src\contexts\AuthContext.tsx`

Суть:

- role access matrix;
- настройки компаний/доступов;
- auth/user management changes.

### Timesheets/bonuses/workspace

- `src\pages\Timesheets.tsx`
- `src\pages\Bonuses.tsx`
- `src\pages\ProjectWorkspace.tsx`
- `src\pages\ProjectSurveyResults.tsx`

Суть:

- изменения отображения/логики таймшитов, бонусов, workspace;
- точное поведение требует ручной проверки.

### Seafile/file management

- `server.js`
- `api\_seafile-utils.mjs`
- `api\_seafile-access.mjs`
- `api\seafile\*`
- `src\components\projects\ProjectFileManager.tsx`
- `scripts\migrate-supabase-storage-to-seafile.mjs`
- `reports\supabase-to-seafile-*.json`
- `tests\seafile-access.test.mjs`
- `tests\server-file-auth.test.mjs`

Суть:

- Seafile proxy/API/helpers;
- миграция файлов;
- тесты доступа.

### Email/password reset

- `api\_email-utils.mjs`
- `api\email-settings.mjs`
- `api\request-password-reset.mjs`
- `api\send-email.mjs`
- `api\test-smtp.mjs`
- `src\lib\emailService.ts`
- `src\pages\SMTPSettings.tsx`
- `src\components\settings\EmailSettingsPanel.tsx`
- `src\pages\ForgotPassword.tsx`
- `src\pages\ResetPassword.tsx`
- `supabase\migrations\20260624000000_add_email_settings.sql`
- `supabase\migrations\20260609000000_refresh_employees_password_schema.sql`

Суть:

- email settings;
- SMTP testing;
- password reset flow;
- employee password schema refresh.

### Import/cleanup scripts and reports

- `scripts\analyze-kenzhekulov-projects.mjs`
- `scripts\close-partner-ledger-projects.mjs`
- `scripts\approve-ledger-project-timesheets.mjs`
- `scripts\fix-partner-ledger-multi-partners.mjs`
- `scripts\fix-saida-gph-ledger-mapping.mjs`
- `scripts\import-saule-ledger.mjs`
- `scripts\dryrun-rbi-project-enrichment.mjs`
- `scripts\add-rbi-missing-people.mjs`
- `scripts\cleanup-timesheet-exact-duplicates.mjs`
- `scripts\cleanup-timesheet-manual-import-overlays.mjs`
- `scripts\auto-assign-partners-from-timesheets.mjs`
- `reports\*`

Суть:

- analysis/dry-run/commit scripts for partner ledgers;
- cleanup reports;
- RBI enrichment reports.

## 19. Рекомендуемый порядок продолжения работы

1. Сначала сохранить текущее состояние:
   - не начинать новые правки, пока не разобран dirty tree;
   - создать backup/diff или рабочий branch.

2. Проверить build/typecheck:
   - `npm run typecheck`;
   - `npm run build`;
   - если падает, фиксировать только минимально необходимые ошибки.

3. Проверить UI локально под admin/CEO:
   - `/projects`;
   - `/bonuses`;
   - `/timesheets`;
   - project expanded row;
   - закрытые проекты;
   - партнеры/руководители/команды;
   - суммы/бонусы.

4. Проверить UI под deputy_director:
   - доступ к операционной части;
   - отсутствие полного CEO financial scope.

5. Проверить live DB факт RBI:
   - сколько проектов с `rbiEnrichment.marker`;
   - сколько team members с `assignedBy`;
   - нет ли дублей сотрудников;
   - совпадает ли с отчетами.

6. Разобрать `needs-review.csv`:
   - сначала conflicts;
   - затем not found;
   - по каждому принять решение: update existing, create new project, skip, manual review.

7. Решить единый source of truth:
   - команда;
   - бонусы;
   - project status/closure;
   - timesheet approval.

8. Сделать маленькую миграционную/синхронизационную стратегию, если нужно:
   - не ломать текущий UI;
   - сначала read compatibility;
   - потом write consistency.

9. Упростить bonus controls:
   - numeric percent input/stepper;
   - visible amount;
   - clear save/apply behavior.

10. Проверить encoding:
   - особенно RBI scripts/reports;
   - не запускать commit scripts до проверки.

11. После подтверждения:
   - закоммитить логические группы отдельно;
   - деплой;
   - пользовательская ручная проверка.

## 20. Вопросы, которые остались без ответа

1. Какой объект должен быть окончательным source of truth для команды: `projects.notes.team` или `project_team`?

2. Какой объект должен быть окончательным source of truth для бонусов: `bonuses` или `projects.notes.finances.teamBonuses`?

3. Нужно ли нормализовать `projects.notes` в отдельные таблицы позже, или пока оставить JSON-модель?

4. Нужно ли создавать проекты для 123 RBI `not found`, или часть из них должна быть пропущена?

5. Как решать 66 RBI conflicts:
   - доверять Excel партнеров;
   - доверять текущей системе;
   - показывать CEO ручной выбор;
   - создавать conflict queue?

6. Как учитывать external/GPH участников:
   - как external people в notes;
   - как contractors;
   - как employees без login;
   - исключать из бонусов?

7. Нужно ли новым RBI employees создавать email/password и давать доступ, или они нужны только как historical team members?

8. Должны ли RBI проекты автоматически закрываться после enrichment, или закрытие делает CEO вручную?

9. Должны ли RBI-related таймшиты автоматически подтверждаться, или нужен отдельный approval step?

10. Какой точный статусный workflow проекта должен быть:
    - active;
    - in_progress;
    - completed;
    - pending CEO approval;
    - paid;
    - archived?

11. Какие фильтры пользователь считает "нормальными" в финальном виде:
    - период;
    - партнер;
    - руководитель;
    - статус;
    - команда;
    - сумма;
    - таймшиты;
    - бонус/оплата?

12. Нужно ли сохранять старые страницы `AssignPartners`, `ProjectApproval`, `Bonuses` как отдельные routes, или полностью встроить их в `/projects`?

13. Какие из untracked Seafile/email/password reset изменений нужно включить в следующий релиз, а какие отложить?

14. Применены ли untracked Supabase migrations в live DB?

15. Какие файлы из temp RAR folder нужно сохранить в постоянную папку проекта/данных?

16. Нужно ли импортировать локальные Excel `Аманов Онгар.xlsx`, `Бадамбаева Сауле(1).xlsx`, `Сартаева Гаухар(1).xlsx`, если они еще не обработаны?

17. Какой production URL/деплой пользователь будет проверять вручную?

18. Должны ли отчеты `reports\*` попадать в git или оставаться локальными артефактами?

19. Нужно ли удалять hardcoded Supabase anon values из scripts перед коммитом?

20. Нужно ли делать отдельный audit данных после всех импортов: projects без команды, team without employees, duplicate employees, closed projects without approved timesheets, bonus sum mismatch?
