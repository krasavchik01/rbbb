# HANDOFF_SESSION_1.md

Дата фиксации: 2026-07-11.

Корень проекта: `C:\Users\UserPC\Desktop\РАЗРАБОТКА\RBBB\rbbb`.

Документ фиксирует фактическое состояние проекта HUB / RBBB по текущей сессии, приложенному pasted-text и локальной проверке репозитория. Код, схемы и конфигурация не исправлялись в рамках подготовки этого handoff; создан только этот файл.

Важное ограничение: production-состояние `https://rbbb.vercel.app` в этом запросе не перепроверялось из-за restricted network. Сведения о production-деплое и production-проверках ниже взяты из текущей сессии.

## 1. Первоначальная цель проекта

Цель проекта - довести HUB / RBBB до простой рабочей системы управления проектами аудиторской/консалтинговой группы, построенной вокруг одной основной таблицы проектов, которая соответствует управленческому "Своду" CEO.

Бизнес-идея:

- В системе есть одна база проектов, но разные роли видят разные колонки, действия и финансовые детали.
- CEO/admin видят полную финансовую картину: суммы, бонусный фонд, распределение бонусов, проценты участников, ручные корректировки.
- Deputy director назначает партнеров и команды, контролирует workflow, но не должен видеть лишние бонусные детали, если это не разрешено.
- Partner видит свои проекты и проекты, где он участвует как партнер.
- Project team / employees видят свои проекты, периоды и могут подавать timesheet.
- HR видит attendance/timesheets и связанные кадровые данные.
- Procurement создает проекты, ведет договоры, доп. соглашения и файлы.

Система должна быть не отдельным набором демо-страниц, а рабочим операционным контуром: проекты, периоды, команды, договоры, файлы, timesheets, оценки, бонусы, роли, компании и импорты из Excel должны сходиться в одной модели.

## 2. Все требования пользователя и изменения требований по ходу работы

### Базовая модель проектов

- Основой должна быть одна таблица проектов/свод.
- У проекта может быть несколько периодов: год, квартал, месяц или кастомный период.
- Период должен вести себя как мини-проект: собственные даты, deadline, команда, партнер, руководитель, сумма/контекст.
- Команда проекта не должна автоматически размазываться по всем периодам.
- Должны быть действия: добавить период, удалить период, переименовать период, назначить partner/leader/supervisor/tax specialist/assistant, перетащить или вручную распределить участников, удалить участника из роли/периода.

### Роли и доступ

- Разные роли работают с одной базой, но видят разные данные.
- CEO/admin видят деньги, бонусы, бонусный фонд, проценты и могут корректировать распределение.
- Deputy director назначает партнеров/команду, но не должен получать лишние бонусные данные.
- Partner видит свои проекты.
- Employee видит свои проекты и timesheet.
- HR видит attendance/timesheet.
- Procurement создает проекты, договоры, допики и файлы.
- Доступ по "нашей компании" должен работать: пример из сессии - Gulshat должна видеть только проекты `ТОО МАК`, если ей назначен доступ только к MAK.

### Фильтры и представления

Требовались сильные простые фильтры:

- our company;
- partner;
- year;
- quarter;
- month;
- deadlines;
- periods;
- no contract;
- no amount;
- no partner;
- no leader;
- overdue;
- closed / in progress;
- search by client/project/partner/leader.

Также требовались:

- download/export filtered list;
- короткий и детальный уровни таблицы;
- карточка проекта должна раскрываться внутри summary и показывать даты, периоды, договоры, файлы, команду и суммы.

### Компании

- "Наши компании" должны управляться админом.
- Admin companies должны быть единственным источником для procurement project creation.
- Нельзя плодить дубликаты названий.
- Нужны mapping/normalization для старых/разных названий.

### Timesheets

- Timesheet должен быть ежедневным: project/date/hours/description/admin work.
- Поиск проекта в timesheet должен включать все доступные проекты, а не ломаться на "mine".
- Если пользователь есть в проекте или периоде, проект должен быть доступен для timesheet.
- Employees не должны видеть approval/status чужих timesheets.
- Timesheet data должна попадать в summary и бонусные расчеты.
- Только approved hours должны идти в bonuses.

### Договоры и файлы

- Договоры, доп. соглашения и файлы должны быть в одном месте без дублей.
- Нужна поддержка многих файлов.
- Из-за Supabase bandwidth/storage quota файлы должны уходить в Seafile.
- Старые Supabase Storage файлы были частично мигрированы в Seafile.
- Старые физические объекты Supabase Storage не удалялись.
- Metadata проектов должна указывать на Seafile.
- Нужен доступ к скачиванию файлов для партнеров и участников проекта, а не только для админов.
- Загрузка не должна падать из-за кириллических имен файлов.
- Для больших файлов нужно обходить HTTP 413 через direct upload link в Seafile.

### Seafile security update в текущей сессии

Изменение требований по ходу работы:

- Чтение файлов из Seafile должно быть разрешено участникам проекта/задачи и broad roles.
- Запись/изменение файлов должна быть ограничена привилегированными ролями.
- Итоговое правило, зафиксированное в коде:
  - read: `admin`, `ceo`, `deputy_director`, `company_director`, `procurement`, а также участники проекта/задачи;
  - write/delete/upload: `admin`, `ceo`, `deputy_director`, `company_director`, `procurement`;
  - project team member может читать, но не может писать.

### Email/password recovery

- SMTP settings должны управляться в admin UI.
- Должна быть отправка тестового письма.
- Password recovery должен использовать production URL, не `localhost:3000`.
- Нужны переменные production URL: `NEXT_PUBLIC_APP_URL`, `VITE_APP_URL`, `VITE_PUBLIC_APP_URL`, `PUBLIC_APP_URL`, `APP_URL`, `SITE_URL` или Vercel URL.
- Email отправляется через SMTP из env или server-side settings.

### Git/worktree

- Worktree грязный, много uncommitted/untracked изменений.
- Нельзя откатывать чужие изменения.
- Нельзя делать `git reset` / `git checkout` без явного запроса.
- Перед изменениями нужно инспектировать diff/state.

### Текущий запрос пользователя

- Создать в корне проекта `HANDOFF_SESSION_1.md`.
- Изучить текущую сессию и фактическое состояние репозитория.
- Ничего не исправлять и не переписывать.
- Не выдумывать отсутствующую информацию; неизвестное помечать как неизвестное.

## 3. Что конкретно было реализовано

### Реализация, подтвержденная в текущей сессии

В этой сессии был реализован серверный контроль доступа к Seafile-файлам:

- Новый серверный helper `api/_seafile-access.mjs`.
- Разделение Seafile access mode на `read` и `write`.
- Read access:
  - broad roles: `admin`, `ceo`, `deputy_director`, `company_director`, `procurement`;
  - участники проекта через `projects.partner_id`, `projects.manager_id`, `project_team.employee_id`, `notes.team`, вложенные `notes`, `auditPeriods`;
  - участники задачи через `tasks.assignees`, `tasks.reporter`, fallback на проект задачи.
- Write access:
  - только `admin`, `ceo`, `deputy_director`, `company_director`, `procurement`;
  - участники проекта без privileged role получают `403 No permission to change this file`.
- Endpoints Seafile подключены к нужному access mode:
  - `api/seafile/download-url.mjs` -> read;
  - `api/seafile/list.mjs` -> read;
  - `api/seafile/file.mjs` -> write;
  - `api/seafile/upload-link.mjs` -> write;
  - `api/seafile/upload.mjs` -> write.
- `server.js` в local/standalone flow обновлен по ролям file upload/delete: вместо старого набора с `manager` используется `admin`, `ceo`, `deputy_director`, `company_director`, `procurement`.
- `src/components/projects/ContractEditor.tsx` научен открывать Seafile contract/amendment links через `supabaseDataStore.getSeafileDownloadUrl`, а не напрямую по `seafile://`.
- Добавлены тесты `tests/seafile-access.test.mjs`.
- Обновлен `tests/server-file-auth.test.mjs`.

Целевые тесты пройдены:

```text
node --test tests\seafile-access.test.mjs tests\server-file-auth.test.mjs
14 tests, 14 pass
```

### Реализация, уже находящаяся в dirty worktree до handoff

Фактическое состояние репозитория содержит большие uncommitted изменения по нескольким направлениям:

- Канонический каталог "наших компаний" и alias-нормализация в `src/types/companies.ts`.
- Доступ пользователей по компаниям через `user_company_access` и фильтрация проектов в `src/lib/userCompanyAccess.ts`, `src/hooks/useSupabaseData.ts`, `src/hooks/useFilteredProjects.ts`.
- Обновленная auth/session логика с legacy employee password + попыткой Supabase Auth session в `src/contexts/AuthContext.tsx`.
- Email SMTP settings и password reset:
  - `api/_email-utils.mjs`;
  - `api/email-settings.mjs`;
  - `api/request-password-reset.mjs`;
  - `api/send-email.mjs`;
  - `api/test-smtp.mjs`;
  - `src/lib/emailService.ts`;
  - `src/pages/ForgotPassword.tsx`;
  - `src/pages/ResetPassword.tsx`;
  - `src/components/settings/EmailSettingsPanel.tsx`.
- Contract/file normalization:
  - `src/lib/contractData.ts`;
  - `src/lib/contractData.test.ts`;
  - `src/components/projects/ContractEditor.tsx`;
  - `src/components/projects/ProjectFileManager.tsx`.
- Audit periods:
  - `src/lib/auditPeriods.ts`;
  - `src/components/projects/AuditPeriodsEditor.tsx`.
- CEO bonus summary:
  - `src/components/projects/CEOSummaryTable.tsx`;
  - `src/lib/bonusCalculation.ts` already exists and is used.
- New/changed pages:
  - `src/pages/Projects.tsx`;
  - `src/pages/ProjectCommandCenter.tsx`;
  - `src/pages/ProjectWorkspace.tsx`;
  - `src/pages/Bonuses.tsx`;
  - `src/pages/Timesheets.tsx`;
  - `src/pages/Settings.tsx`;
  - `src/pages/UserManagement.tsx`;
  - `src/pages/SMTPSettings.tsx`.
- Import/cleanup scripts and generated reports for timesheets, partner ledgers, RBI project enrichment, Seafile migration.

### Production facts from session, not reverified in this request

From the prior current-session context:

- Production URL: `https://rbbb.vercel.app`.
- Seafile server-side access check had been deployed.
- Checks reported:
  - download-url without headers -> 401;
  - admin download-url -> 200;
  - admin list -> 200;
  - admin upload-link -> 200.

## 4. Файлы, создававшиеся и изменявшиеся

### Файл, созданный этим handoff-запросом

- `HANDOFF_SESSION_1.md`

### Дополнительный untracked файл, появившийся в финальной проверке

- `HANDOFF_SESSION_2.md`

Примечание: этого файла не было в `git status --short --untracked-files=all`, снятом перед созданием `HANDOFF_SESSION_1.md`, но он появился в финальном статусе. `LastWriteTime`: 2026-07-11 17:48:25, размер 78627 байт. Он не создавался и не изменялся в рамках этого handoff-запроса; содержимое не инспектировалось.

### Файлы, созданные/измененные в текущей Seafile access работе

Созданы:

- `api/_seafile-access.mjs`
- `tests/seafile-access.test.mjs`
- `docs/superpowers/plans/2026-07-01-seafile-file-access.md`

Изменены:

- `api/seafile/download-url.mjs`
- `api/seafile/list.mjs`
- `api/seafile/file.mjs`
- `api/seafile/upload-link.mjs`
- `api/seafile/upload.mjs`
- `server.js`
- `src/components/projects/ContractEditor.tsx`
- `tests/server-file-auth.test.mjs`

Важно: часть этих файлов уже имела uncommitted изменения до Seafile access patch, особенно `ContractEditor.tsx` и `server.js`. Точный автор отдельных старых изменений неизвестен.

### Текущие modified tracked файлы по `git status`

- `.vercelignore`
- `api/send-email.mjs`
- `api/test-smtp.mjs`
- `server.js`
- `src/App.tsx`
- `src/components/AppHeader.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/MobileNavigation.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/projects/AuditPeriodsEditor.tsx`
- `src/components/projects/CEOSummaryTable.tsx`
- `src/components/projects/ContractEditor.tsx`
- `src/components/projects/ProjectFileManager.tsx`
- `src/components/projects/TeamAssignment.tsx`
- `src/components/settings/UserCompanyAssignment.tsx`
- `src/contexts/AuthContext.tsx`
- `src/hooks/useFilteredProjects.ts`
- `src/hooks/useProjects.ts`
- `src/hooks/useSupabaseData.ts`
- `src/integrations/supabase/types.ts`
- `src/lib/api.ts`
- `src/lib/appSettings.ts`
- `src/lib/auditPeriods.ts`
- `src/lib/emailService.ts`
- `src/lib/supabaseDataStore.ts`
- `src/lib/userCompanyAccess.ts`
- `src/pages/AssignPartners.tsx`
- `src/pages/Bonuses.tsx`
- `src/pages/CreateProjectProcurement.tsx`
- `src/pages/HR.tsx`
- `src/pages/Index.tsx`
- `src/pages/ProjectApproval.tsx`
- `src/pages/ProjectSurveyResults.tsx`
- `src/pages/ProjectWorkspace.tsx`
- `src/pages/Register.tsx`
- `src/pages/SMTPSettings.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Timesheets.tsx`
- `src/pages/UserManagement.tsx`
- `src/types/companies.ts`
- `src/types/project-v3.ts`
- `src/types/roles.ts`
- `tests/access/role-page-access.spec.ts`
- `tests/server-file-auth.test.mjs`

### Текущие untracked файлы/папки по `git status --untracked-files=all`

Skill/config:

- `.agents/skills/brainstorming/SKILL.md`
- `.agents/skills/brainstorming/scripts/frame-template.html`
- `.agents/skills/brainstorming/scripts/helper.js`
- `.agents/skills/brainstorming/scripts/server.cjs`
- `.agents/skills/brainstorming/scripts/start-server.sh`
- `.agents/skills/brainstorming/scripts/stop-server.sh`
- `.agents/skills/brainstorming/spec-document-reviewer-prompt.md`
- `.agents/skills/brainstorming/visual-companion.md`
- `.agents/skills/using-superpowers/SKILL.md`
- `.agents/skills/using-superpowers/references/codex-tools.md`
- `.agents/skills/using-superpowers/references/copilot-tools.md`
- `.agents/skills/using-superpowers/references/gemini-tools.md`
- `.agents/skills/writing-plans/SKILL.md`
- `.agents/skills/writing-plans/plan-document-reviewer-prompt.md`
- `.claude/settings.local.json`
- `.claude/skills/brainstorming/SKILL.md`
- `.claude/skills/brainstorming/scripts/frame-template.html`
- `.claude/skills/brainstorming/scripts/helper.js`
- `.claude/skills/brainstorming/scripts/server.cjs`
- `.claude/skills/brainstorming/scripts/start-server.sh`
- `.claude/skills/brainstorming/scripts/stop-server.sh`
- `.claude/skills/brainstorming/spec-document-reviewer-prompt.md`
- `.claude/skills/brainstorming/visual-companion.md`
- `.claude/skills/using-superpowers/SKILL.md`
- `.claude/skills/using-superpowers/references/codex-tools.md`
- `.claude/skills/using-superpowers/references/copilot-tools.md`
- `.claude/skills/using-superpowers/references/gemini-tools.md`
- `.claude/skills/writing-plans/SKILL.md`
- `.claude/skills/writing-plans/plan-document-reviewer-prompt.md`
- `PLAN.md`

API:

- `api/_email-utils.mjs`
- `api/_seafile-access.mjs`
- `api/_seafile-utils.mjs`
- `api/email-settings.mjs`
- `api/request-password-reset.mjs`
- `api/seafile/download-url.mjs`
- `api/seafile/file.mjs`
- `api/seafile/list.mjs`
- `api/seafile/signed-upload.mjs`
- `api/seafile/upload-link.mjs`
- `api/seafile/upload.mjs`

Docs/reports:

- `docs/superpowers/plans/2026-07-01-seafile-file-access.md`
- `playwright-report/index.html`
- `reports/kenzhekulov-projects/analysis.json`
- `reports/kenzhekulov-projects/summary.txt`
- `reports/partner-ledger-close/partner-ledger-close-report.json`
- `reports/qa/claude-broken-actions.md`
- `reports/qa/claude-role-logic-audit.md`
- `reports/qa/claude-timesheet-performance.md`
- `reports/rbi-project-enrichment-dryrun/commit-results.csv`
- `reports/rbi-project-enrichment-dryrun/commit-results.json`
- `reports/rbi-project-enrichment-dryrun/dryrun.json`
- `reports/rbi-project-enrichment-dryrun/matches.csv`
- `reports/rbi-project-enrichment-dryrun/needs-review.csv`
- `reports/rbi-project-enrichment-dryrun/people-add-results.csv`
- `reports/rbi-project-enrichment-dryrun/people-add-results.json`
- `reports/rbi-project-enrichment-dryrun/people-review.csv`
- `reports/rbi-project-enrichment-dryrun/people-review.json`
- `reports/rbi-project-enrichment-dryrun/summary.md`
- `reports/saule-ledger-import/saule-ledger-import-report.json`
- `reports/supabase-to-seafile-dry-run-2026-07-01T09-41-40-752Z.json`
- `reports/supabase-to-seafile-dry-run-2026-07-01T09-45-00-798Z.json`
- `reports/supabase-to-seafile-dry-run-2026-07-01T09-47-08-472Z.json`
- `reports/supabase-to-seafile-migration-2026-07-01T09-46-23-416Z.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T06-34-31-607Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T06-35-08-534Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T06-36-02-050Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T06-36-32-370Z-execute.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T06-37-03-900Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-15-52-940Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-16-32-047Z-manual-import-overlays-execute.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-17-10-940Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-17-32-633Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-19-02-098Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-19-27-367Z-manual-import-overlays-execute.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-19-54-384Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-20-12-502Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-21-39-979Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-21-58-044Z-manual-import-overlays-execute.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-22-17-601Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-08T08-22-48-081Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-16T09-08-48-512Z-manual-import-overlays-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-16T09-08-48-603Z-dry-run.json`
- `reports/timesheet-duplicate-cleanup/2026-06-16T09-13-38-046Z-dry-run.json`
- `reports/tinay-timesheet-fix/2026-06-09T08-31-51-777Z-dry-run.json`
- `reports/tinay-timesheet-fix/2026-06-09T08-32-04-288Z-commit.json`

Scripts:

- `scripts/add-rbi-missing-people.mjs`
- `scripts/analyze-kenzhekulov-projects.mjs`
- `scripts/approve-ledger-project-timesheets.mjs`
- `scripts/auto-assign-partners-from-timesheets.mjs`
- `scripts/cleanup-timesheet-exact-duplicates.mjs`
- `scripts/cleanup-timesheet-manual-import-overlays.mjs`
- `scripts/close-partner-ledger-projects.mjs`
- `scripts/dryrun-rbi-project-enrichment.mjs`
- `scripts/fix-partner-ledger-multi-partners.mjs`
- `scripts/fix-saida-gph-ledger-mapping.mjs`
- `scripts/import-saule-ledger.mjs`
- `scripts/migrate-supabase-storage-to-seafile.mjs`

Source/tests/migrations:

- `src/components/settings/EmailSettingsPanel.tsx`
- `src/lib/contractData.test.ts`
- `src/lib/contractData.ts`
- `src/lib/roleAccess.ts`
- `src/pages/ForgotPassword.tsx`
- `src/pages/ProjectCommandCenter.tsx`
- `src/pages/Projects.tsx`
- `src/pages/ResetPassword.tsx`
- `supabase/.temp/cli-latest`
- `supabase/migrations/20260609000000_refresh_employees_password_schema.sql`
- `supabase/migrations/20260624000000_add_email_settings.sql`
- `test-results/.last-run.json`
- `tests/seafile-access.test.mjs`

## 5. Текущая архитектура проекта

### Frontend

- Vite 5 + React 18 + TypeScript.
- Entry/config:
  - `vite.config.ts`: dev server host `::`, port `8080`, proxy `/seafile-proxy` to Seafile, alias `@` -> `src`.
  - `src/App.tsx`: route composition.
- UI:
  - Radix UI primitives;
  - Tailwind;
  - lucide-react icons.
- State/data:
  - `src/lib/supabaseDataStore.ts` is the main data facade for employees/projects/timesheets/bonuses/companies/files/work papers.
  - `src/hooks/useSupabaseData.ts`, `src/hooks/useProjects.ts`, `src/hooks/useFilteredProjects.ts` provide React hooks.
  - Supabase is the main data store.
  - localStorage remains fallback/cache in some places, especially `supabaseDataStore` and app settings.
  - `src/lib/timesheets.ts` intentionally has no localStorage fallback.

### Backend/API

There are two API styles:

- Vercel-style serverless files under `api/`.
- Local/standalone Express server in `server.js`.

Important API areas:

- Email:
  - `api/_email-utils.mjs`;
  - `api/email-settings.mjs`;
  - `api/send-email.mjs`;
  - `api/test-smtp.mjs`;
  - `api/request-password-reset.mjs`.
- Seafile:
  - `api/_seafile-utils.mjs`;
  - `api/_seafile-access.mjs`;
  - `api/seafile/download-url.mjs`;
  - `api/seafile/list.mjs`;
  - `api/seafile/file.mjs`;
  - `api/seafile/upload-link.mjs`;
  - `api/seafile/upload.mjs`;
  - `api/seafile/signed-upload.mjs` exists untracked; exact integration status not fully inspected.
- AI endpoints exist under `api/ai/*` and AI tables/migrations exist, but they were not central in this session.

### Deployment

- `vercel.json`:
  - build command `npm run build`;
  - output `dist`;
  - framework `vite`;
  - install command `npm install --legacy-peer-deps`;
  - rewrites:
    - `/seafile-proxy/(.*)` -> `https://cloud.rbpartners.kz/$1`;
    - fallback routes to `/index.html`.
- Production URL from session: `https://rbbb.vercel.app`.

### Data model architecture

The practical current architecture is hybrid:

- Real project rows are in Supabase `projects`.
- A small set of columns is typed in Supabase (`id`, `name`, `start_date`, `deadline`, `status`, `kpi_percentage`, `partner_id`, `manager_id`, `notes`, timestamps).
- Most business data is stored in `projects.notes` JSON:
  - client fields;
  - contract;
  - finances;
  - team;
  - files;
  - auditPeriods;
  - source/import metadata;
  - status/workflow fields.
- This JSON-heavy approach is the actual code path for many features.

Known architecture mismatch:

- Older migrations describe more normalized project schemas (`project_data`, richer `projects`, `project_team`, work papers).
- Current generated Supabase types and code use the simpler `projects` table plus `notes`.
- Therefore do not assume every migration represents the current production table shape.

## 6. Структура базы данных, таблицы, поля, связи и миграции

Primary source inspected: `src/integrations/supabase/types.ts` plus migrations under `supabase/migrations`.

### Generated Supabase tables currently represented in types

- `attendance`
- `bonuses`
- `companies`
- `employees`
- `app_settings`
- `timesheet_entries`
- `project_survey_responses`
- `project_survey_proposals`
- `project_survey_config`
- `ai_tasks`
- `service_memos`
- `service_memo_workflow`
- `n8n_chat_histories`
- `profiles`
- `project_participants`
- `project_team`
- `projects`
- `tasks`
- `timesheets`
- `user_company_access`

Generated function:

- `has_role`

Generated enums:

- `app_role`
- `bonus_status`
- `employee_level`
- `project_status`

### Key table fields and relationships

`employees`:

- `id`
- `name`
- `email`
- `role`
- `level`
- `whatsapp`
- `password`
- `created_at`
- `updated_at`

Notes:

- `role` is an app role enum in generated types.
- `password` exists for legacy employee login.
- Untracked migration `20260609000000_refresh_employees_password_schema.sql` adds `employees.password` and notifies PostgREST schema reload.

`projects`:

- `id`
- `name`
- `start_date`
- `deadline`
- `status`
- `kpi_percentage`
- `partner_id`
- `manager_id`
- `notes`
- `created_at`
- `updated_at`

Relationships:

- `partner_id` and `manager_id` are intended to point to `employees.id`, but session notes state many/most projects do not populate `partner_id`; partner is usually in `notes.team`.
- `project_team.project_id` also points to projects.
- `timesheet_entries.project_id` is text and links logically to `projects.id`.

`project_team`:

- `id`
- `project_id`
- `employee_id`
- `role_on_project`
- `created_at`

Relationship:

- `project_id` -> projects.
- `employee_id` -> employees.

Current access logic uses this table only as one of several ways to determine membership; `notes.team` is often more important.

`timesheet_entries`:

- `id`
- `employee_id`
- `employee_name`
- `project_id`
- `project_name`
- `work_date`
- `hours`
- `section`
- `position`
- `location`
- `city`
- `manager_raw`
- `partner_raw`
- `notes`
- `source`
- `import_batch_id`
- `status`
- `reviewed_by`
- `reviewed_by_name`
- `reviewed_at`
- `reviewer_notes`
- `created_by`
- `created_at`
- `updated_at`

Indexes from migration:

- `idx_ts_entries_employee_date`
- `idx_ts_entries_project_status`
- `idx_ts_entries_status`
- `idx_ts_entries_batch`

Status values used by code:

- `draft`
- `submitted`
- `approved`
- `rejected`

Source values:

- `manual`
- `import`
- `survey`

RLS in migration is open (`USING(true)` / `WITH CHECK(true)`), with filtering enforced in application code.

`bonuses`:

- `id`
- `employee_id`
- `project_id`
- `bonus_amount`
- `kpi_percentage`
- `payment_date`
- `status`
- `created_at`
- `updated_at`

Relationships:

- `employee_id` -> employees.
- `project_id` -> projects.

`companies`:

- `id`
- `name`
- `active`
- `brand_color`
- `created_at`
- `updated_at`

Separate frontend canonical company catalog exists in `src/types/companies.ts`; this is currently more important for "our company" UI/normalization than the older `companies` table.

`app_settings`:

- `id`
- `show_demo_users`
- `office_location_enabled`
- `office_latitude`
- `office_longitude`
- `office_radius_meters`
- `office_address`
- `maintenance_mode`
- `maintenance_message`
- `recent_activity_enabled`
- `recent_activity_visible_roles`
- `companies`
- `created_at`
- `updated_at`

Notes:

- `companies` may be either plain array or settings envelope with `__suiteASettings: 1`.
- Email settings can fall back into this envelope if `email_settings` table is missing.

`user_company_access`:

- `id`
- `user_id`
- `company_ids`
- `created_at`
- `updated_at`

Usage:

- `user_id` is employee/user id.
- `company_ids` stores canonical IDs from admin company catalog.
- No row means no restriction.
- Empty array or null behavior differs by helper:
  - `getUserAllowedCompanyIds` returns null if no row;
  - hooks treat missing/empty allowed IDs as full access.

`project_files` from migration `20250123000001_project_files_and_amendments.sql`:

- `id`
- `project_id`
- `file_name`
- `file_type`
- `file_size`
- `storage_path`
- `category`
- `uploaded_by`
- `uploaded_at`
- `created_at`
- `updated_at`

RLS:

- select/insert are effectively open in migration (`USING(true)`, `WITH CHECK(true)`) with TODO comments.
- delete checks owner/admin but references role columns inconsistently with current schema.

Current implementation increasingly stores files in `projects.notes.files`, especially Seafile metadata.

`project_amendments`:

- `id`
- `project_id`
- `number`
- `date`
- `description`
- `file_url`
- `created_by`
- `created_at`
- `updated_at`

RLS:

- select open;
- insert intended for procurement/admin/ceo;
- update/delete intended for creator/admin;
- policies may reference inconsistent `role`/`app_role`.

`project_survey_responses`:

- `id`
- `user_id`
- `user_name`
- `user_role`
- `status`
- `answers`
- `submitted_at`
- `updated_at`
- `created_at`

`project_survey_proposals`:

- `id`
- `project_id`
- `project_name`
- `status`
- `proposed_team`
- `proposed_status`
- `status_votes`
- `respondents_count`
- `participants_count`
- `confidence`
- `reviewed_by`
- `reviewed_by_name`
- `reviewed_at`
- `applied_at`
- `override_notes`
- `generated_at`
- `updated_at`

`project_survey_config`:

- `id`
- `enabled`
- `title`
- `description`
- `deadline`
- `started_at`
- `started_by`
- `started_by_name`
- `updated_at`

`service_memos`:

- `id`
- `title`
- `description`
- `priority`
- `category`
- `overall_status`
- `current_stage_index`
- `created_at`
- `updated_at`
- `completed_at`
- `created_by`

`service_memo_workflow`:

- `id`
- `memo_id`
- `stage_index`
- `department`
- `department_label`
- `status`
- `approver_id`
- `approved_at`
- `comments`
- `created_at`

`project_evaluations`:

- Created by migration `20260224000000_add_memos_and_evaluations.sql`.
- It is not present in the generated `Database` tables list inspected in `src/integrations/supabase/types.ts`.
- Fields in migration:
  - `id`
  - `project_id`
  - `evaluated_user_id`
  - `evaluator_id`
  - `type`
  - `rating`
  - `comment`
  - `is_anonymous`
  - `created_at`
  - `updated_at`
- This mismatch means either generated types are stale or migration not applied/represented.

`ai_tasks`:

- Contains task fields for AI-created tasks: assigned user, creator, title, description, priority, project, due date, status, notification channel/timestamps, source and timestamps.

`profiles`, `tasks`, `timesheets`, `attendance`, `n8n_chat_histories`, `project_participants`:

- Present in generated types.
- They were not fully inspected in this handoff beyond table presence and selected usage in Seafile access/task access.

### Migration inventory

Observed migration files include:

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
- many `20250815...` migrations for an older normalized system
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
- untracked `20260609000000_refresh_employees_password_schema.sql`
- untracked `20260624000000_add_email_settings.sql`

## 7. Логика проектов, сотрудников, ролей, команд, оценок и бонусов

### Roles

Frontend role model in `src/types/roles.ts` includes:

- `ceo`
- `deputy_director`
- `company_director`
- `procurement`
- `partner`
- `project_leader`
- `manager_1`
- `manager_2`
- `manager_3`
- `supervisor_3`
- `supervisor_2`
- `supervisor_1`
- `tax_specialist_1`
- `tax_specialist_2`
- `assistant_3`
- `assistant_2`
- `assistant_1`
- `contractor`
- `academy`
- `hr`
- `accountant`
- `admin_staff`
- `admin`

Role normalization:

- `it_admin` -> `admin`
- `project_manager` -> `project_leader`
- `employee` -> `assistant_1`
- generic `assistant` + level -> `assistant_1/2/3`
- generic `manager` + level -> `manager_1/2/3`
- generic `supervisor` + level -> `supervisor_1/2/3`
- generic `tax_specialist` + level -> `tax_specialist_1/2`

`src/lib/roleAccess.ts` defines route access:

- `/projects`, `/timesheets`, `/attendance`, `/notifications`, `/settings`: all roles.
- `/hr`, `/employees`: `hr`, `ceo`, `deputy_director`, `admin`.
- `/analytics`, `/bonuses`: `ceo`, `admin`.
- `/assign-partners`, `/project-approval`: `ceo`, `deputy_director`, `admin`.
- `/user-management`, `/diagnostics`, `/database-test`, `/smtp-settings`, `/role-management`, `/settings-diagnostics`: admin.
- `/create-project-procurement`: `procurement`, `admin`.
- `/tenders`: procurement.
- `/ai`: `ceo`, `deputy_director`, `admin`, `partner`, `hr`.

Known issue: `src/lib/roleAccess.ts` currently has a TypeScript error (`Argument of type 'string' is not assignable to parameter of type 'never'`), so route access needs type cleanup.

### Permissions in `src/types/roles.ts`

Important permissions:

- `VIEW_ALL_COMPANIES`: ceo/admin.
- `VIEW_COMPANY_DATA`: ceo/deputy/company_director/admin.
- `VIEW_FINANCIAL_DATA`: ceo/admin.
- `VIEW_BONUSES`, `VIEW_ALL_BONUSES`: ceo/deputy.
- `CREATE_PROJECT`: procurement/admin.
- `APPROVE_PROJECT`: deputy/ceo/admin.
- `ASSIGN_TEAM`: deputy/ceo/admin.
- `PLAN_PROJECT`, `COMPLETE_PROJECT`: partner/admin.
- `CHANGE_BONUS_MANUALLY`: ceo.
- `APPROVE_PAYMENTS`: ceo.
- `VIEW_PROFIT`: ceo/admin.
- `RATE_TEAM`: managers/partner.
- `RATE_MANAGER`: partner.
- `VIEW_ALL_KPI`: ceo/deputy/admin.
- `MANAGE_USERS`: ceo/hr/admin.
- `MANAGE_COMPANIES`: ceo/admin.
- `CHANGE_TEAM`: deputy/partner/admin.
- `UPLOAD_CONTRACT`: procurement/admin.
- `VIEW_CONTRACT`: project roles/academy.

### Project workflow/status

`src/types/project-v3.ts` defines workflow-like statuses:

- `new`
- `pending_approval`
- `approved`
- `planning`
- `in_progress`
- `ready_to_complete`
- `pending_payment_approval`
- `completed`
- `cancelled`

Supabase generated `project_status` is narrower/older:

- `active`
- `in_progress`
- `completed`

There is mapping via `src/lib/projectWorkflow` used by `supabaseDataStore.createProject/updateProject`.

Known debt: several TypeScript errors come from status mismatch between ProjectV3 workflow statuses and generated Supabase statuses.

### Team and periods

Main practical team source:

- `project.notes.team`

Possible additional membership sources:

- `projects.partner_id`
- `projects.manager_id`
- `project_team`
- `auditPeriods[].team`
- nested notes inspected recursively by Seafile access.

Audit periods:

- Implemented in `src/lib/auditPeriods.ts` and `src/components/projects/AuditPeriodsEditor.tsx`.
- Period fields:
  - `id`
  - `name`
  - `type`
  - `startDate`
  - `endDate`
  - `year`
  - `partnerId`
  - `partnerName`
  - `status`
  - `deadline`
  - `taskIds`
  - `documentIds`
  - `team`
  - `teamSource`
  - `amountWithoutVAT`
  - `sourceProjectId`
  - `createdBy`
  - `createdAt`
  - `updatedAt`
- `getAuditPeriods(project)` reads periods from `project.auditPeriods` or `project.notes.auditPeriods`.
- `getEffectivePartnerId(project, auditPeriodId)` prefers period partner, then falls back to project notes team partner.
- UI supports add period, update partner, add/remove member to role, copy project team, drag/drop between periods/roles.

### Employees/auth

Current login flow in `src/contexts/AuthContext.tsx`:

- Finds employee by email in Supabase `employees`.
- If `employees.password` exists, compares it as legacy password.
- Attempts Supabase Auth `signInWithPassword`.
- If Supabase Auth session fails and no legacy password exists, login fails.
- Stores base user in localStorage key `user`.
- Loads company access from `user_company_access`.
- Supports admin impersonation with localStorage key `rb_original_user`.

### Bonuses

Defaults from `PROJECT_ROLES` / bonus calculation:

- partner: 25
- project_leader: 4
- manager_1: 10
- manager_2: 8
- manager_3: 6
- supervisor_3: 15
- supervisor_2: 10
- supervisor_1: 6
- tax_specialist_1: 3
- tax_specialist_2: 3
- assistant_3: 4
- assistant_2: 4
- assistant_1: 2
- contractor/academy/admin/ceo/deputy/hr/procurement: 0

`src/lib/bonusCalculation.ts` is the unified formula used by CEO summary and bonuses:

- Base amount: amount without VAT from project/contract/notes/finances.
- Default overhead/pre-expense: 30%.
- Contractors deducted.
- Remainder = amount - overhead - contractors, clamped to >= 0.
- Default bonus pool: 10% of remainder.
- Role distributions calculate potential/final bonus amounts.
- Manual overrides are read from `finances.teamBonuses`.
- Approved timesheet hours are used for bonus context.

`src/components/projects/CEOSummaryTable.tsx`:

- Uses `computeProjectBonus`.
- Supports global overhead %, global bonus %, role distribution, per-project overrides.
- Filters include all/pending/closed/missing_team/missing_amount/needs_attention/paid.
- Aggregates bonus pool, gross profit, paid bonuses, role totals, person totals.

Known current mismatch:

- `Bonuses.tsx` adds `hiddenFromEmployee` to structures not typed for it.
- Typecheck reports several bonus-related type errors.

### Evaluations

Migration `20260224000000_add_memos_and_evaluations.sql` creates `project_evaluations` with evaluator/evaluated user, rating/comment/anonymous fields.

Actual frontend usage in current session was not fully traced. Since `project_evaluations` is not present in generated `types.ts`, its applied status is unknown.

## 8. Используемые Excel, Google Sheets, папки и другие источники данных

### Supabase

Primary application database and legacy file source.

Used env names include Supabase URL, anon/publishable key, service role key. Values are intentionally not reproduced.

### Seafile

File storage target:

- Default URL in code: `https://cloud.rbpartners.kz`.
- Server config names:
  - `SEAFILE_URL`
  - `VITE_SEAFILE_BASE_URL`
  - `VITE_SEAFILE_URL`
  - `SEAFILE_TOKEN`
  - `VITE_SEAFILE_TOKEN`
  - `SEAFILE_REPO_ID`
  - `VITE_SEAFILE_REPO_ID`

### Excel sources found in scripts/reports

Known Excel/data sources from reports/scripts:

- `САУЛЕ 2024 окт-2025 окт.xlsx`
  - Used by `scripts/import-saule-ledger.mjs`.
  - Used by `scripts/close-partner-ledger-projects.mjs`.
  - Generated reports in `reports/saule-ledger-import/` and `reports/partner-ledger-close/`.
- `Проекты Кенжекулов.xlsx`
  - Used by `scripts/analyze-kenzhekulov-projects.mjs`.
  - Summary in `reports/kenzhekulov-projects/summary.txt`.
- RBI source directory:
  - `C:/Users/UserPC/AppData/Local/Temp/Rar$DRa114884.41954.rartemp`
  - Used by `scripts/dryrun-rbi-project-enrichment.mjs`.
  - Report names include files such as `1 кв Проекты 2024_RBI.xlsx`, `1 кв Проекты 2025_RBI.xlsx`, `Сейфулина_Проекты октябрь 2024-октябрь 2025.xlsx`, and other quarter/year RBI workbooks referenced in CSV/JSON reports.
- Timesheet import Excel source:
  - Exact source workbook names are not all visible in current summary.
  - `timesheet_entries.source='import'` and `import_batch_id` are used.
  - Import helpers/scripts include `scripts/import-timesheets.mjs`, `scripts/reimport-drive-dryrun.mjs`, `scripts/reimport-drive-commit.mjs`, and cleanup scripts.

### Google Sheets / Google Drive

No active Google Sheets connector usage or exact Google Sheet URL/file ID was found in the inspected repository state or current session summary.

There are scripts named `reimport-drive-dryrun.mjs` and `reimport-drive-commit.mjs`, suggesting some Drive source existed historically, but exact Google Drive/Sheets file IDs and paths are unknown.

### Local reports/folders

Important report folders:

- `reports/supabase-to-seafile-*.json`
- `reports/timesheet-duplicate-cleanup/`
- `reports/tinay-timesheet-fix/`
- `reports/saule-ledger-import/`
- `reports/partner-ledger-close/`
- `reports/rbi-project-enrichment-dryrun/`
- `reports/kenzhekulov-projects/`
- `reports/qa/`

## 9. Что импортировалось, что не импортировалось и почему

### Supabase Storage -> Seafile

Executed migration report:

- `reports/supabase-to-seafile-migration-2026-07-01T09-46-23-416Z.json`
- Mode: `execute`
- `deleteSource`: false
- Projects scanned: 1020
- Projects with candidates: 2
- Candidate files: 5
- Migrated: 5
- Skipped: 0
- Errors: 0

Migrated project candidates:

- Project `32c1c739-05ba-4d57-b28f-61f1f1d7b1a3`: 2 files migrated.
- Project `727e3a84-18c1-4088-aaee-4e1d5f80b0c8`: 3 files migrated.

Not imported/deleted:

- Old Supabase Storage physical files were not deleted because `deleteSource=false`.
- Only candidate files found in project metadata were migrated; files not referenced by inspected project metadata are unknown/not migrated.

### Saule ledger import

Report:

- `reports/saule-ledger-import/saule-ledger-import-report.json`
- Generated: `2026-06-16T11:02:10.761Z`
- Source: `САУЛЕ 2024 окт-2025 окт.xlsx`
- `commit`: true
- Rows: 27
- Actions:
  - `update_duplicates`: 5
  - `update`: 10
  - `create`: 12
- Rows with matched existing project: 15
- External people: 22

Meaning:

- This was applied/committed.
- Some rows updated existing projects, including duplicates.
- 12 rows were created as new projects.
- External/GPH/unmatched people were preserved in import metadata rather than always mapped to employees.

### Partner ledger close plan

Report:

- `reports/partner-ledger-close/partner-ledger-close-report.json`
- Generated: `2026-06-16T10:51:04.120Z`
- Source file: `САУЛЕ 2024 окт-2025 окт.xlsx`
- `commit`: false
- Rows: 27
- Match statuses:
  - unmatched: 14
  - medium: 3
  - high: 7
  - duplicate_candidates: 3
- Commit allowed rows: 10
- External people: 31

Meaning:

- This report is a dry-run/plan, not an applied import.
- It likely informed later `import-saule-ledger`, but the `partner-ledger-close` report itself did not commit.

### RBI project enrichment

Dry-run summary:

- `reports/rbi-project-enrichment-dryrun/summary.md`
- Generated: `2026-07-02T11:58:39.031Z`
- Source dir: `C:/Users/UserPC/AppData/Local/Temp/Rar$DRa114884.41954.rartemp`
- Source rows parsed: 467
- Exact matches: 228
- Probable matches: 50
- Project conflicts: 66
- Not found in system: 123
- People mapped: 833
- Team additions proposed: 268
- Already in project teams: 384
- Unmatched people names: 0
- External/GPH people: 12

Commit results:

- `reports/rbi-project-enrichment-dryrun/commit-results.json`
- Committed projects: 141
- Added members: 80
- Source rows committed into project updates: 221
- Skipped: 0

People add results:

- `reports/rbi-project-enrichment-dryrun/people-add-results.json`
- `committed`: true
- Planned employee records: 51
- Inserted: 51
- Skipped: 0

Not imported / left for review:

- 66 project conflicts from dry-run.
- 123 source rows not found in system.
- Review artifacts:
  - `needs-review.csv`
  - `matches.csv`
  - `people-review.csv/json`

Reason:

- Script only commits clean exact/probable matches without conflicts/unmatched people.
- Ambiguous project matches and not-found clients require manual review.

### Kenzhekulov project analysis

Report:

- `reports/kenzhekulov-projects/summary.txt`
- Source: `Проекты Кенжекулов.xlsx`
- Project rows: 52
- High matches: 3
- Medium matches: 4
- Low matches: 21
- Not found: 24
- Already completed/closed among found: 7
- Unmatched employees listed in report:
  - Акмолдир
  - Анара (ГПХ)
  - Василий
  - Дмитрий
  - Лебеков Ермек
  - Сауле (ГПХ)

Applied import status:

- Unknown from inspected files. Report appears analytical, not a commit report.

### Timesheet duplicate cleanup

Exact duplicates:

- `reports/timesheet-duplicate-cleanup/2026-06-08T06-36-32-370Z-execute.json`
- Mode: execute
- Total rows at time: 14870
- Duplicate groups: 117
- Delete candidates: 119
- Kept count: 117

Manual/import overlay cleanup:

- `2026-06-08T08-16-32-047Z-manual-import-overlays-execute.json`
  - candidateCount/groups: 49
  - byDate: 2026-06-02 -> 1, 2026-05-04 -> 31, 2026-06-01 -> 17
- `2026-06-08T08-19-27-367Z-manual-import-overlays-execute.json`
  - candidateCount/groups: 7
  - byDate: 2026-06-01 -> 4, 2026-05-04 -> 3
- `2026-06-08T08-21-58-044Z-manual-import-overlays-execute.json`
  - candidateCount/groups: 1
  - byDate: 2026-06-01 -> 1

Later dry-runs show zero overlay groups in some reports.

### Tinay timesheet fix

Reports:

- `reports/tinay-timesheet-fix/2026-06-09T08-31-51-777Z-dry-run.json`
- `reports/tinay-timesheet-fix/2026-06-09T08-32-04-288Z-commit.json`

Commit report:

- Mode: `commit`
- Rows in report: 24

Exact semantic of every update was not fully inspected in this handoff; report indicates a targeted Tinay timesheet correction was applied.

## 10. Все принятые решения и причины

### Keep one projects table + JSON notes

Decision:

- Use Supabase `projects` as primary project table and keep rich fields in `notes` JSON.

Reason:

- Production data already appears in that shape.
- Import scripts and UI components are built around `notes`.
- It avoids high-risk schema rewrite during active project recovery.

Tradeoff:

- Type safety is weak.
- Migrations and generated types are partially out of sync.
- Many business fields are not queryable/indexed cleanly.

### Store files in Seafile, not Supabase Storage

Decision:

- New/migrated project files should use Seafile metadata with `storage: 'seafile'`, `isSeafile: true`, `publicUrl/url: seafile://...`.

Reason:

- Supabase bandwidth/storage quota was exceeded.
- Seafile is the intended external storage.
- Seafile token must stay server-side.

### Do not expose Seafile direct paths for download

Decision:

- UI asks backend for temporary download URL through `/api/seafile/download-url`.

Reason:

- `seafile://` is metadata, not browser-downloadable.
- Server can enforce access and use server-side token.

### Split Seafile read and write permissions

Decision:

- Project participants can read project files.
- Only privileged roles can write/delete/upload.

Reason:

- User requirement: partners/participants need downloads.
- Write access is more sensitive and should stay restricted to admin/management/procurement.

### ASCII/safe stored filenames in Seafile

Decision:

- Original display name is preserved in metadata.
- Stored name is sanitized/unique ASCII-ish in Seafile.

Reason:

- Previous issues with Cyrillic filenames/headers.
- Avoid Seafile/header/filesystem encoding failures.

### Direct upload link for large files

Decision:

- `api/seafile/upload-link.mjs` returns an upload URL/form so browser can upload directly to Seafile.

Reason:

- Avoid serverless/body size `413` for large files.

### App company catalog with aliases

Decision:

- Maintain canonical companies in `src/types/companies.ts`, normalize old variants/aliases.

Reason:

- User explicitly required "our companies" to be single source for procurement and filtering.
- Legacy project data contains inconsistent company names.

### Company access by `user_company_access`

Decision:

- Store user allowed company IDs in `user_company_access`.
- Enrich auth user on login/localStorage restore.
- Filter projects client-side by matching company names/aliases.

Reason:

- Need practical access-by-company without immediate full DB RLS rewrite.

Tradeoff:

- Security is not fully server-side for project list reads.
- Needs future RLS/API hardening.

### Password reset production URL guard

Decision:

- `api/request-password-reset.mjs` rejects local origins and falls back to `https://rbbb.vercel.app`.

Reason:

- Existing bug: recovery links pointed to localhost.

### Keep legacy employee password temporarily

Decision:

- Login still supports `employees.password`.
- Supabase Auth session is attempted, but legacy login can continue if password exists.

Reason:

- Full Auth migration not complete.
- Avoid locking out current users.

## 11. Что пробовали сделать, но не получилось

- `npm run typecheck` was run and failed. No fixes were attempted in this handoff request.
- `rg` failed in this Windows environment with: "Указанному файлу не сопоставлено ни одно приложение для выполнения данной операции". Fallback was PowerShell `Select-String`.
- Production/network checks were not rerun in this handoff request because network is restricted.
- Full Google Sheets/Drive source inventory could not be established from local files; exact Drive IDs/URLs are unknown.
- `project_evaluations` exists in migration but not in generated Supabase types, so its live/applied status is unresolved.
- Some output/file content displayed mojibake in shell due encoding; counts and paths were still usable.

## 12. Известные ошибки, временные решения, заглушки и технический долг

### TypeScript/typecheck

`npm run typecheck` fails.

Observed error classes:

- `Employee` mismatch: `company_id` vs `companyId`, nullable email/password, `full_name` missing from frontend type.
- `Project` mismatch: generated Supabase project status/fields vs ProjectV3/workflow fields.
- `ProjectStage` now requires `amountWithoutVAT`, `vatAmount`, `amountWithVAT`, but some UI creates simpler stages.
- `ProjectFinances` lacks `vatRate` used by procurement edit UI.
- `Bonuses.tsx` uses `hiddenFromEmployee` not typed in team bonus objects.
- `ProjectWorkspace.tsx` expects `tasks` from `useProjects`, but hook does not expose it.
- `project_data` table is used in diagnostics but absent from generated Supabase types.
- `roleAccess.ts` has a `never` type error.
- Many `TS6133` unused imports/vars due strict/noUnused settings.

### Schema/model drift

- Migrations, generated Supabase types and frontend business types are not aligned.
- Real project data uses `notes` JSON heavily.
- Older migrations include normalized schema and demo data patterns not obviously matching current production.

### RLS/security

- Several migrations use open RLS policies (`USING(true)`) and rely on frontend filtering.
- `timesheet_entries` RLS is open.
- `project_files` select/insert RLS is open/TODO.
- Company project filtering is client-side, not hard server-side.
- Seafile file access has new server-side checks, but general project data access remains a future hardening area.

### Auth

- Legacy employee password is stored in `employees.password`.
- Supabase Auth migration is incomplete.
- Strict JWT mode exists in server-file auth tests, but production readiness for fully rejecting legacy headers across all endpoints is unknown.

### Seafile/files

- Old Supabase Storage objects were not deleted.
- Only 5 referenced files were migrated in the executed migration.
- `api/seafile/signed-upload.mjs` exists but was not fully inspected/integrated in this handoff.
- Stored Seafile names are sanitized, so display names and stored names differ.

### Email

- SMTP password can be stored in `email_settings.password` when table exists.
- Fallback can store encrypted email settings inside `app_settings.companies` envelope.
- Exact production env values not inspected/reproduced.

### Imports/reports

- Many import reports are untracked and represent real operations. They should not be deleted without review.
- RBI has committed subset but still has unresolved conflicts/not-found rows.
- Kenzhekulov analysis appears not committed.

### Generated artifacts

- `playwright-report/index.html` and `test-results/.last-run.json` are untracked generated artifacts.
- `supabase/.temp/cli-latest` is untracked local tool state.
- `HANDOFF_SESSION_2.md` appeared during final verification; purpose/content unknown.

## 13. Что сейчас работает, что частично работает и что не работает

### Works / confirmed

- Targeted Seafile/server file auth tests pass: 14/14.
- Seafile access helper supports:
  - 401 without authenticated user;
  - role-based read/write;
  - project membership read;
  - team member cannot write;
  - procurement can write.
- ContractEditor can resolve Seafile links through download-url API for contract/amendment files.
- Supabase-to-Seafile migration executed for 5 files with 0 errors.
- Timesheet duplicate cleanup reports show applied cleanups.
- Saule ledger import report shows commit=true.
- RBI partial enrichment commit and people-add commit reports exist.

### Partially works / likely usable but needs QA

- Project/company filtering:
  - implemented client-side;
  - depends on project company name normalization;
  - needs role-by-role manual QA, especially Gulshat/MAK scenario.
- Audit periods editor:
  - UI supports period/team operations;
  - persistence depends on parent save path;
  - needs regression testing across pages.
- Timesheets:
  - core data layer exists;
  - approval routing by partner/deputy is implemented in code comments/helpers;
  - visibility rules for employees need manual QA.
- Bonus summary:
  - calculation exists and UI is rich;
  - typecheck has bonus-related errors.
- Email/password reset:
  - endpoints and frontend service exist;
  - needs production SMTP/env verification.
- Procurement contracts/files:
  - multiple files and Seafile metadata supported;
  - upload/download should be QA-tested with Cyrillic, large files, partner read-only access.

### Not working / currently red

- `npm run typecheck` fails.
- Full build status was not rerun in this handoff; because typecheck fails, build may also fail depending on Vite/tsconfig behavior.
- `rg` command is broken in this shell environment.
- Full production access checks were not rerun in this handoff.
- Google Sheets/Drive source trace is incomplete/unknown.

## 14. Все незавершенные задачи

- Resolve TypeScript errors enough for `npm run typecheck` and `npm run build` to pass.
- Decide source of truth for project schema:
  - continue with JSON `notes`, or
  - plan a controlled normalized migration.
- Harden server-side access/RLS for projects, timesheets and files.
- Finish/QA company access:
  - verify Gulshat sees only `ТОО МАК`;
  - verify company aliases in real project list;
  - ensure procurement creation uses admin company catalog only.
- Finish/QA periods:
  - create/delete/rename period;
  - period-specific team;
  - participant removal;
  - no team smearing across periods;
  - period-specific partner in timesheet/project access.
- Finish/QA filters and exports:
  - our company, partner, year/quarter/month, deadlines, periods, missing contract/amount/partner/leader, overdue, status, search, download filtered list, short/detailed.
- QA role matrix:
  - CEO/admin;
  - deputy;
  - company director;
  - procurement;
  - partner;
  - project leader/team;
  - employee;
  - HR.
- QA timesheet flows:
  - employee entry;
  - admin work/no project;
  - project search includes accessible projects;
  - employee cannot see others approvals;
  - partner/deputy approval;
  - approved hours feed bonuses.
- QA Seafile:
  - partner/project participant download;
  - nonparticipant denial;
  - team member read-only;
  - procurement/admin upload/delete;
  - Cyrillic filenames;
  - files over serverless limit through upload-link;
  - old migrated files;
  - amendment file links.
- Decide whether to delete old Supabase Storage objects after complete verification.
- Finish password recovery production verification:
  - SMTP settings save/load/test;
  - reset link origin;
  - Supabase Auth user creation for legacy employees.
- Review unresolved imports:
  - RBI conflicts/not-found rows;
  - Kenzhekulov unmatched projects/employees;
  - any remaining timesheet import overlays.
- Decide whether to track or ignore generated reports/test artifacts.
- Commit coherent groups of changes after tests.

## 15. Команды запуска, сборки, тестирования и развёртывания

From `package.json`:

```bash
npm run dev
npm run dev:server
npm run build
npm run preview
npm run start
npm run typecheck
npm run lint
npm run test
npm run test:unit
npm run audit:auth-readiness
npm run test:access
npm run test:routes
```

Script meanings:

- `npm run dev`: Vite dev server.
- `npm run dev:server`: local Express/API server via `node server.js`.
- `npm run build`: Vite production build.
- `npm run preview`: Vite preview.
- `npm run start`: `npm run build && node server.js`.
- `npm run typecheck`: `tsc -p tsconfig.app.json --noEmit`.
- `npm run lint`: ESLint.
- `npm run test`: Playwright.
- `npm run test:unit`: Vitest.
- `npm run test:access`: Playwright access tests.
- `npm run test:routes`: node route tests.

Commands run in current handoff context:

```bash
npm.cmd run typecheck
```

Result: failed.

```bash
node --test tests\seafile-access.test.mjs tests\server-file-auth.test.mjs
```

Result: passed, 14/14.

Deployment:

- Vercel config uses `npm run build`.
- Prior session used Vercel CLI for production deploy, but this handoff request did not deploy.
- Production URL from session: `https://rbbb.vercel.app`.

Useful import/migration commands from scripts:

```bash
node scripts/migrate-supabase-storage-to-seafile.mjs --dry-run
node scripts/migrate-supabase-storage-to-seafile.mjs --execute
node scripts/import-saule-ledger.mjs
node scripts/import-saule-ledger.mjs --commit
node scripts/dryrun-rbi-project-enrichment.mjs
node scripts/dryrun-rbi-project-enrichment.mjs --commit
node scripts/cleanup-timesheet-exact-duplicates.mjs
node scripts/cleanup-timesheet-manual-import-overlays.mjs
```

Use these carefully: some write to production Supabase when env points there.

## 16. Переменные окружения - только названия

Supabase:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_SERVICE_ROLE`
- `REQUIRE_SUPABASE_JWT`

Seafile:

- `SEAFILE_URL`
- `VITE_SEAFILE_BASE_URL`
- `VITE_SEAFILE_URL`
- `SEAFILE_USERNAME`
- `SEAFILE_PASSWORD`
- `SEAFILE_TOKEN`
- `VITE_SEAFILE_TOKEN`
- `SEAFILE_REPO_ID`
- `VITE_SEAFILE_REPO_ID`

SMTP/mail:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_FROM_NAME`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_SECURE`
- `MAIL_USER`
- `MAIL_PASSWORD`
- `MAIL_FROM`
- `MAIL_FROM_NAME`

Public app URL / recovery:

- `PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `VITE_PUBLIC_APP_URL`
- `VITE_APP_URL`
- `APP_URL`
- `SITE_URL`
- `VERCEL_URL`

Build metadata:

- `VERCEL_GIT_COMMIT_SHA`

Note: Some source files contain hard-coded public Supabase config values. Values are intentionally not reproduced here.

## 17. Текущий git branch, последний commit и git status

Branch:

- `main`

Tracking:

- `main...origin/main`

Last commit:

- `6fc7200 (HEAD -> main, origin/main, origin/HEAD) fix(project-workspace): restore isCompleted flag`

Last commit touched:

- `src/pages/ProjectWorkspace.tsx`
- 8 lines changed.

Git status before creating this handoff file:

- 44 tracked files modified.
- Many untracked files/directories.
- Working tree dirty.
- Git warning observed: `unable to access 'C:\Users\UserPC/.config/git/ignore': Permission denied`.

After this file is created, `HANDOFF_SESSION_1.md` is also expected to appear as untracked unless staged later.

Final verification also shows untracked `HANDOFF_SESSION_2.md`. It appeared during the handoff work and is not attributed to this agent.

## 18. Полное описание незакоммиченных изменений

### High-level diff size

`git diff --stat` for tracked files showed:

- 44 tracked files changed.
- 3174 insertions.
- 1261 deletions.

Largest/important tracked changes by area:

- `src/components/projects/CEOSummaryTable.tsx`: major CEO/bonus summary work.
- `src/components/projects/ContractEditor.tsx`: major contract/files/Seafile link handling work.
- `src/types/companies.ts`: canonical companies and aliases.
- `src/lib/supabaseDataStore.ts`: data facade, file upload/download, project CRUD, fallback logic.
- `src/pages/Settings.tsx`: settings/company/email-related changes.
- `src/pages/SMTPSettings.tsx`: large deletions/changes, likely moved logic into new `EmailSettingsPanel`.
- `src/lib/appSettings.ts`: settings envelope and company normalization.
- `src/lib/userCompanyAccess.ts`: user-to-company access.
- `src/contexts/AuthContext.tsx`: legacy/auth/company access/impersonation.
- `src/types/roles.ts`: role normalization/permission model.
- `src/types/project-v3.ts`: project/finance/type changes.
- `tests/server-file-auth.test.mjs`: file auth expectations changed.

### Uncommitted feature clusters

Seafile:

- New server helpers and endpoints.
- Server-side role/project/task access checks.
- Seafile upload/download/list/delete flow.
- Direct upload-link for large files.
- Filename decode/sanitize/unique naming.
- Contract/amendment download link resolution.
- Targeted tests.

Email/password recovery:

- Server-side SMTP config loader/saver.
- Admin-only email settings endpoint.
- Mail sender role gate.
- Password reset endpoint with production URL guard.
- Frontend email service and pages.
- Email settings panel.
- Untracked migration for `email_settings`.

Company access:

- Canonical company catalog.
- Alias normalization.
- User company access table/helpers.
- Auth enrichment with allowed companies.
- Project filtering by allowed companies.
- Settings UI changes for company assignment.

Project periods/contracts/files:

- Audit periods editor and helper.
- Contract data normalizer/deduper.
- Project file manager changes.
- Contract editor changes.
- Project workspace/command center/projects pages changes.

Timesheets/imports:

- `timesheet_entries` data layer already present.
- Scripts and reports for duplicate cleanup, Tinay fix, ledger approval/assignment.

Reports/import artifacts:

- Many generated reports are untracked but semantically important.
- They document applied and dry-run database operations.

### Files likely generated/local and candidates for .gitignore review

- `playwright-report/index.html`
- `test-results/.last-run.json`
- `supabase/.temp/cli-latest`
- `HANDOFF_SESSION_2.md` (purpose/content unknown; not created by this agent)
- possibly `.claude/settings.local.json`

Do not delete them automatically; decide with user/team.

## 19. Рекомендуемый порядок продолжения работы

1. Freeze and commit a documentation-only checkpoint if desired, or at least do not mix this handoff with code fixes.
2. Review `git status --short --untracked-files=all` and split changes into coherent commits:
   - Seafile server access/tests;
   - email/password recovery;
   - companies/access;
   - project periods/contracts/files;
   - import scripts/reports.
3. First stabilize build/type layer:
   - fix generated Supabase type drift or adjust app types;
   - resolve `Employee`, `Project`, `ProjectV3`, `ProjectStage`, `ProjectFinances`, `roleAccess` errors;
   - get `npm run typecheck` passing.
4. Re-run:
   - `node --test tests\seafile-access.test.mjs tests\server-file-auth.test.mjs`;
   - `npm run typecheck`;
   - `npm run build`.
5. QA Seafile in local/dev:
   - admin/procurement upload/delete;
   - partner/team member download;
   - nonparticipant denial;
   - Cyrillic filename;
   - large upload via upload-link.
6. QA role access matrix and route access.
7. QA company access with a real restricted user, especially MAK-only scenario.
8. QA timesheets end-to-end:
   - employee entry;
   - project search;
   - partner/deputy approval;
   - employee privacy;
   - bonus hours.
9. QA project periods:
   - period-specific team and partner;
   - no accidental project-team propagation;
   - period access for timesheets/files if required.
10. Review import backlog:
   - RBI `needs-review.csv`;
   - Kenzhekulov summary;
   - any unresolved timesheet reports.
11. Only after build/tests/QA, deploy production.
12. After production verification, decide whether old Supabase Storage files can be deleted.

## 20. Вопросы, которые остались без ответа

- Какой источник истины окончательно выбрать для проектов: JSON `notes` или нормализованные таблицы?
- Нужно ли переносить `auditPeriods`, `team`, `contract`, `files`, `finances` из `notes` в отдельные таблицы?
- Должны ли partners/deputy видеть бонусные суммы или только hours/progress? Текущие permissions частично противоречат исходному требованию по deputy.
- Какие точные роли должны иметь write доступ к файлам: должен ли partner уметь загружать файлы или только читать?
- Нужно ли разрешать project leader загружать work files, отличая их от contract files?
- Какой лимит файла нужен в Seafile production: текущий `MAX_SEAFILE_FILE_SIZE` = 200 MB.
- Когда можно удалить старые Supabase Storage objects?
- Какие Google Drive/Sheets источники использовались для timesheet/imports, и где их IDs/папки?
- Что делать с 123 RBI not-found rows и 66 conflicts?
- Нужно ли импортировать/создавать Kenzhekulov not-found projects?
- Кто владелец canonical company catalog и какие компании должны быть активны?
- Как должна работать пустая запись `user_company_access`: полный доступ или нулевой доступ? Сейчас нет записи = полный доступ.
- Нужно ли server-side RLS для company access до production rollout?
- Какой password/auth migration plan: оставить legacy passwords или полностью перейти на Supabase Auth?
- Нужно ли хранить SMTP password в отдельной `email_settings` таблице или только в encrypted app_settings envelope/env?
- Нужно ли коммитить `.agents`/`.claude` skills в репозиторий или держать локально?
- Нужно ли коммитить generated reports как audit trail или вынести их в docs/archive?
- Должен ли `project_evaluations` реально существовать и использоваться, если generated Supabase types его не содержат?
- Какая production env конфигурация сейчас реально установлена на Vercel? Значения не проверялись в этом handoff.
- Нужно ли добавить automated Playwright сценарии для CEO/deputy/partner/employee/procurement вместо ручной QA?
