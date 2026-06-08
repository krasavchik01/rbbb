# Project Roadmap and CEO Dashboard Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Сделать проектный процесс Suite-A/RBBB простым, визуальным и управляемым: закупки создают проект, замдир назначает команду, команда работает и ведёт часы, проект закрывается, а CEO видит всю воронку стадий и узкие места.

**Architecture:** Ввести единый слой стадий проекта поверх существующих `status` и `notes.status`, чтобы не ломать текущие сценарии. На главном `Dashboard.tsx` для CEO/замдиректора добавить визуальную дорожную карту/воронку стадий с живыми счётчиками и быстрыми переходами. В `Projects-simple.tsx` и карточке проекта показывать понятный следующий шаг.

**Tech Stack:** React, TypeScript, Supabase data hooks, Tailwind/ui Card/Button/Badge, существующие маршруты `/project-approval`, `/assign-partners`, `/projects`, `/timesheet-approval`, `/bonuses`.

---

## Product Roadmap: стадии проекта

### Стадия 1 — “Создан закупками”

**Смысл:** отдел закупок внёс новый проект.

**Кто видит:** закупки, замдиректор, CEO.

**Что должно быть видно:**
- сколько проектов добавлено закупками;
- сколько ждут первичного решения руководства;
- кнопка: `Открыть на утверждение`.

**Технический признак:**
- `project.status !== completed/closed`;
- `notes.status === 'new' || notes.status === 'pending_approval'`.

**Следующий шаг:** замдиректор/CEO утверждает проект и отправляет на назначение команды.

---

### Стадия 2 — “Ждёт назначения команды”

**Смысл:** проект уже принят, но замдиректор ещё не назначил партнёра/PM/команду.

**Кто видит:** замдиректор, CEO.

**Что должно быть видно:**
- сколько проектов не назначено замдиректором;
- возраст ожидания: сколько дней проект без команды;
- кнопка: `Назначить команду`.

**Технический признак:**
- `project.status !== completed/closed`;
- `notes.status === 'approved'` или аналогичный approved-сигнал;
- `team.length === 0`.

**Следующий шаг:** замдиректор назначает команду. После назначения проект переходит в `in_progress`, участники получают уведомления.

---

### Стадия 3 — “Команда назначена / проект в работе”

**Смысл:** команда есть, сотрудники работают и должны вносить часы.

**Кто видит:** CEO, замдиректор, партнёр/PM, участники команды.

**Что должно быть видно:**
- сколько проектов в работе;
- сколько проектов с командой, но без часов;
- сколько часов уже внесено/ждёт апрува;
- кнопка: `Открыть проекты в работе`.

**Технический признак:**
- `status === 'in_progress' || status === 'active'`;
- `team.length > 0`.

**Следующий шаг:** команда ведёт задачи и таймшиты, партнёр/ответственный утверждает часы.

---

### Стадия 4 — “Готов к закрытию”

**Смысл:** работа завершена, но проект ещё не зафиксирован финансово/административно.

**Кто видит:** партнёр, CEO, замдиректор.

**Что должно быть видно:**
- сколько проектов ждут закрытия;
- кто ответственный за финальное действие;
- есть ли неподтверждённые часы;
- кнопка: `Проверить закрытие`.

**Технический признак:**
- `status === 'ready_for_closure'` или `notes.status === 'ready_for_closure'`;
- либо существующий поток из `Bonuses.tsx`, где проект ожидает CEO approval.

**Следующий шаг:** партнёр/CEO утверждает закрытие и бонусы.

---

### Стадия 5 — “Закрыт и зафиксирован”

**Смысл:** проект завершён, часы/бонусы/финансы зафиксированы.

**Кто видит:** CEO, замдиректор, финансы/HR при наличии прав.

**Что должно быть видно:**
- сколько проектов закрыто;
- сумма выручки/бонусов;
- архив/история действий.

**Технический признак:**
- `status === 'completed' || status === 'closed'`.

**Следующий шаг:** нет активного действия; проект уходит в историю и аналитику.

---

## CEO Dashboard: что нужно показать генеральному директору

### Верхний блок: “Воронка проектов”

Показывать 5 карточек в одну линию/сетку:

1. **Добавлено закупками**
   - число проектов на первичном утверждении;
   - маршрут: `/project-approval`.

2. **Не назначено замдиром**
   - число проектов без команды;
   - маршрут: `/assign-partners`.

3. **В работе**
   - число проектов с командой и активным статусом;
   - маршрут: `/projects?stage=in_progress`.

4. **Ждёт закрытия**
   - число проектов ready-for-closure;
   - маршрут: `/bonuses` или `/projects?stage=ready_for_closure`.

5. **Закрыто**
   - число завершённых проектов;
   - маршрут: `/projects?stage=completed`.

### Подпись под блоком

`Закупки → Замдиректор → Команда → Закрытие → CEO фиксация`

### Цветовая логика

- Жёлтый: ждёт решения.
- Оранжевый/красный: есть задержка или нет команды.
- Синий: в работе.
- Фиолетовый: ждёт закрытия.
- Зелёный: закрыто.

### Быстрые управленческие сигналы

Под воронкой добавить короткий блок:

- `X проектов без команды больше 2 дней`;
- `Y проектов в работе без часов за последние 7 дней`;
- `Z проектов ждут закрытия`;
- `N часов ждёт утверждения`.

---

## Implementation Tasks

### Task 1: Create shared project stage helper

**Objective:** Вынести определение стадии в одно место, чтобы Dashboard/Projects/ProjectWorkspace считали одинаково.

**Files:**
- Create: `src/lib/projectStages.ts`
- Test: `src/lib/projectStages.test.ts`

**Steps:**
1. Add `parseProjectNotes(project)` helper that safely handles object/string/null notes.
2. Add `getProjectTeam(project)` helper that reads `project.team || notes.team || []`.
3. Add `getProjectStage(project)` returning one of:
   - `procurement_added`
   - `awaiting_team`
   - `in_progress`
   - `ready_for_closure`
   - `completed`
   - `other`
4. Add `buildProjectStageMetrics(projects)` returning counts and lists per stage.
5. Cover legacy cases with tests:
   - `notes.status = new` → procurement_added;
   - `notes.status = approved`, empty team → awaiting_team;
   - `status = in_progress`, team exists → in_progress;
   - `status = completed` → completed;
   - stringified notes parses correctly.

**Verification:**
- Run: `npm run test:unit -- projectStages`
- Expected: all new tests pass.

---

### Task 2: Add CEO roadmap widget to Dashboard

**Objective:** На главном экране CEO/замдиректора показать визуальную дорожную карту стадий.

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Optional create: `src/components/dashboard/ProjectRoadmapWidget.tsx`

**Steps:**
1. Import `buildProjectStageMetrics`.
2. Compute `projectStageMetrics` from `projects`.
3. Add widget above current “Что требует внимания”, because это главный управленческий экран.
4. Each stage card shows:
   - title;
   - count;
   - human hint;
   - route button/click.
5. For CEO/замдир/admin only.
6. Keep existing operational cards; do not remove current metrics.

**Verification:**
- Run: `npm run build`.
- Browser: login as CEO/deputy and confirm widget appears above operational center.

---

### Task 3: Add stage filter support to Projects page

**Objective:** При клике из CEO воронки открывать список проектов нужной стадии.

**Files:**
- Modify: `src/pages/Projects-simple.tsx`

**Steps:**
1. Add URL state `stage` similar to existing `q/year/company` filters.
2. Use `getProjectStage(project)` in filtering.
3. Add visible chip/filter text: `Стадия: Не назначено замдиром` with clear button.
4. Do not break existing filters/search/virtualized grid.

**Verification:**
- Browser: open `/projects?stage=awaiting_team`, confirm only projects without team show.
- Browser: clear stage filter, confirm all projects return.

---

### Task 4: Show “next action” on project cards

**Objective:** Чтобы пользователь не думал, что делать дальше.

**Files:**
- Modify: `src/pages/Projects-simple.tsx`
- Potentially modify card rendering section only.

**Next actions:**
- procurement_added → `Ожидает утверждения руководством`;
- awaiting_team → `Назначить команду`;
- in_progress → `Вести работу и часы`;
- ready_for_closure → `Проверить закрытие`;
- completed → `Закрыт`.

**Verification:**
- Browser: visually confirm cards show next action labels.

---

### Task 5: Build, test, deploy safely

**Objective:** Выпустить только после проверки.

**Commands:**
```bash
cd "$HOME/Desktop/РАЗРАБОТКА/RBBB/rbbb"
npm run test:unit
npm run test:routes
npm run test:access
npm run build
git diff
git add src/lib/projectStages.ts src/lib/projectStages.test.ts src/pages/Dashboard.tsx src/pages/Projects-simple.tsx docs/plans/2026-06-08-project-roadmap-and-ceo-dashboard.md
git commit -m "feat(projects): add CEO project roadmap"
git push
```

**Production verification:**
1. Check Vercel deployment is READY.
2. Open `https://rbbb.vercel.app/`.
3. Confirm Dashboard loads with no console errors.
4. Confirm roadmap widget counts render.
5. Confirm clicking stage cards routes to the right project list.

---

## Acceptance Criteria

- CEO sees one visual project roadmap from procurement to closure.
- CEO can answer immediately:
  - сколько проектов добавили закупки;
  - сколько не назначено замдиректором;
  - сколько в работе;
  - сколько ждёт закрытия;
  - сколько закрыто.
- Замдиректор sees the same funnel and can jump directly to `Назначить команду`.
- Existing dashboard metrics continue working.
- Existing project/team/timesheet/closure flows are not broken.
- Build and tests pass before production deployment.
