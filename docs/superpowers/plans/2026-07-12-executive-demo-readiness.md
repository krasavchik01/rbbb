# Executive Demo Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and improve every role-facing page and the executive project flow without allowing test traffic to mutate production.

**Architecture:** Build one reusable Playwright fixture layer that intercepts Supabase and application APIs with coherent business data. Run a complete role/page surface audit plus deeper project, price, team, file, timesheet, and bonus scenarios; then generate a committed readiness report from deterministic results.

**Tech Stack:** React 18, TypeScript, Supabase JS, Playwright, Vitest, Node test runner, Vite.

---

### Task 1: Production-safe demo fixtures

**Files:**
- Create: `tests/helpers/demo-fixtures.ts`
- Create: `tests/demo-fixtures-safety.spec.ts`

- [ ] **Step 1: Write the failing safety test**

The test imports `installDemoNetwork`, opens `/projects`, and asserts:

```ts
expect(network.unhandledRequests).toEqual([]);
expect(network.productionMutations).toEqual([]);
expect(network.requests.length).toBeGreaterThan(0);
```

Run: `npx playwright test tests/demo-fixtures-safety.spec.ts --project=chromium --reporter=line`

Expected: FAIL because `demo-fixtures.ts` does not exist.

- [ ] **Step 2: Define coherent fixtures**

Export:

```ts
export const DEMO_PROJECT_ID = 'demo-project-001';
export const DEMO_EMPLOYEE_IDS = { ceo: 'demo-ceo', partner: 'demo-partner', manager: 'demo-manager', assistant: 'demo-assistant' };
export const demoProject = {
  id: DEMO_PROJECT_ID,
  name: 'АО Демонстрационный клиент — аудит 2026',
  status: 'active',
  notes: JSON.stringify({
    status: 'В работе',
    contract: { number: 'DEMO-2026-001', currency: 'KZT', amountWithoutVAT: 48_000_000, amountWithVAT: 53_760_000 },
    team: [
      { userId: DEMO_EMPLOYEE_IDS.partner, userName: 'Демо Партнёр', role: 'partner' },
      { userId: DEMO_EMPLOYEE_IDS.manager, userName: 'Демо Менеджер', role: 'manager_1' },
      { userId: DEMO_EMPLOYEE_IDS.assistant, userName: 'Демо Ассистент', role: 'assistant_1' },
    ],
    auditPeriods: [{ id: 'period-2026', name: '2026', team: [] }],
    finances: { bonusPercent: 10, teamBonuses: {} },
  }),
};
```

Add realistic employees, approved/submitted timesheets, tasks, notifications, attendance, settings, and Seafile metadata.

- [ ] **Step 3: Intercept every external request**

`installDemoNetwork(page)` must register handlers before the first navigation:

```ts
await page.route('**://*.supabase.co/**', route => fulfillSupabase(route, fixtures, journal));
await page.route('**/api/**', route => fulfillApplicationApi(route, fixtures, journal));
```

Record method, URL, request body, and whether the request is a mutation. Never call `route.continue()` for these domains.

- [ ] **Step 4: Add role login helper**

Export `loginAsDemoRole(page, role)` that installs routes, opens `/`, writes a `user` object to localStorage, and returns the request journal.

- [ ] **Step 5: Run safety test**

Run: `npx playwright test tests/demo-fixtures-safety.spec.ts --project=chromium --reporter=line`

Expected: PASS and zero production mutations.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/demo-fixtures.ts tests/demo-fixtures-safety.spec.ts
git commit -m "test(demo): add production-safe business fixtures"
```

### Task 2: Every role and every page

**Files:**
- Create: `tests/demo-role-page-elements.spec.ts`
- Create: `scripts/demo-readiness/catalog.mjs`
- Test: `tests/access/role-page-access.spec.ts`

- [ ] **Step 1: Define the page catalog**

`catalog.mjs` exports active route metadata with expected heading fragments:

```js
export const PAGE_CATALOG = {
  '/projects': { title: 'Свод', headings: ['Проекты'] },
  '/timesheets': { title: 'Таймшиты', headings: ['Тайм'] },
  '/attendance': { title: 'Посещаемость', headings: ['Посещаемость'] },
  '/notifications': { title: 'Уведомления', headings: ['Уведомления'] },
  '/bonuses': { title: 'Бонусы', headings: ['Бонусы'] },
};
```

Include every route in `ROUTE_ACCESS`; admin diagnostic pages remain catalogued but are labelled technical.

- [ ] **Step 2: Write the role/page test**

For every `USER_ROLES × ROUTE_ACCESS` combination, use `loginAsDemoRole`. For allowed routes assert URL, expected heading, no login/404/Vite overlay, no visible `NaN`/`undefined`, and no unnamed visible buttons or internal links with unknown targets. For denied routes assert redirect to `/projects`.

- [ ] **Step 3: Verify sidebar visibility**

For every role, compare visible sidebar links to the role-filtered `SECTIONS` contract. The test must explicitly verify `Свод`, `Таймшиты`, `Посещаемость`, `Уведомления`, and `Настройки` for all roles, plus restricted groups.

- [ ] **Step 4: Run and collect the first defect list**

Run: `npx playwright test tests/demo-role-page-elements.spec.ts --project=chromium --reporter=line`

Expected: either PASS or a finite defect list with exact role, route, locator, and visible text.

- [ ] **Step 5: Commit the audit harness**

```bash
git add tests/demo-role-page-elements.spec.ts scripts/demo-readiness/catalog.mjs
git commit -m "test(demo): audit every role and page surface"
```

### Task 3: Executive project flow

**Files:**
- Create: `tests/demo-executive-project-flow.spec.ts`
- Create: `tests/demo-file-access.spec.ts`

- [ ] **Step 1: Test project summary and price**

As CEO, open `/projects`, find `АО Демонстрационный клиент — аудит 2026`, and assert the visible amount `48 000 000`, currency `₸`, team count, approved hours, and project status. Open the project and assert the same contract and amount.

- [ ] **Step 2: Test procurement form**

As procurement, open `/create-project-procurement` and assert unique labelled controls for client, contract subject, company, project type, amount without VAT, currency, start/end date, and files. Fill them against the mock network and assert the outgoing project payload preserves the amount and selected company.

- [ ] **Step 3: Test team assignment**

As CEO/deputy, open the project management surface, assert partner/manager/assistant names, add a role through a mocked update, and verify the update body contains `notes.team` rather than legacy table data. As assistant, assert management controls are absent.

- [ ] **Step 4: Test file lifecycle**

Mock `/api/seafile/list`, upload, download-url, and delete. Assert filename, file type, size, source, and modified date are visible. Assert team member read, procurement/admin write, and unrelated employee denial.

- [ ] **Step 5: Test timesheets and bonuses**

Assert approved and submitted hours are visibly separated. On `/bonuses`, assert the draft banner, amount, approved-hours evidence, empty final registry message, and absence of payment buttons.

- [ ] **Step 6: Run focused scenarios**

Run: `npx playwright test tests/demo-executive-project-flow.spec.ts tests/demo-file-access.spec.ts --project=chromium --reporter=line`

Expected: all scenarios pass after product fixes.

- [ ] **Step 7: Commit**

```bash
git add tests/demo-executive-project-flow.spec.ts tests/demo-file-access.spec.ts
git commit -m "test(demo): cover executive project flow"
```

### Task 4: Fix product defects from the audit

**Files:**
- Modify only the exact product files named by failing tests, expected primarily:
  - `src/pages/Projects-simple.tsx`
  - `src/pages/ProjectWorkspace.tsx`
  - `src/pages/CreateProjectProcurement.tsx`
  - `src/components/projects/CEOSummaryTable.tsx`
  - `src/components/projects/ProjectFileManager.tsx`
  - `src/pages/Timesheets.tsx`
  - `src/pages/Bonuses.tsx`
  - `src/components/AppSidebar.tsx`

- [ ] **Step 1: Group failures by root cause**

Create a short defect table in `reports/demo-readiness/defects.md` with `ID`, `role`, `route`, `symptom`, `root cause`, `fix`, and `test`.

- [ ] **Step 2: Fix blocking project data presentation**

Ensure price uses `notes.contract.amountWithoutVAT`/canonical project amount, team uses the canonical projection from `notes.team`, and missing values have explicit labels. Re-run the exact failing project tests.

- [ ] **Step 3: Fix blocking interactions and permissions**

Ensure buttons have accessible names, unauthorized controls are absent, dialogs validate required fields, and mocked mutations carry canonical data. Re-run the exact role/page tests.

- [ ] **Step 4: Fix files and summaries**

Ensure file metadata and access states are clear, and executive summaries distinguish calculated, approved, and paid values. Re-run file/bonus tests.

- [ ] **Step 5: Commit each root-cause group**

Use focused commits such as:

```bash
git commit -m "fix(projects): make price and team explicit"
git commit -m "fix(files): clarify project file states"
git commit -m "fix(ui): align role-specific summaries"
```

### Task 5: Deterministic readiness report

**Files:**
- Create: `scripts/demo-readiness/build-report.mjs`
- Create: `reports/demo-readiness/README.md`
- Create: `reports/demo-readiness/demo-readiness.json`
- Modify: `package.json`

- [ ] **Step 1: Add report input/output contract**

The script consumes Playwright JSON output and the page catalog, then writes totals for roles, pages, combinations, key scenarios, failures, and skipped external checks.

- [ ] **Step 2: Add package command**

```json
"audit:demo": "playwright test tests/demo-*.spec.ts --project=chromium --reporter=json > reports/demo-readiness/playwright.json && node scripts/demo-readiness/build-report.mjs"
```

Use a PowerShell-compatible wrapper script if direct redirection is not portable.

- [ ] **Step 3: Generate Markdown summary**

The README must separate `Доказано автоматикой`, `Подтверждено live read-only`, `Требует ручного решения`, and `Не выполнялось без разрешения`.

- [ ] **Step 4: Run and commit the report**

Run: `npm run audit:demo`

Expected: zero failed demo tests and committed JSON/Markdown evidence.

### Task 6: Final gates

**Files:**
- Modify only if a gate exposes a regression in the files above.

- [ ] **Step 1: Static and build gates**

Run: `npm run typecheck && npm run lint && npm run build`

Expected: typecheck/build pass; ESLint has zero errors.

- [ ] **Step 2: Unit and Node tests**

Run: `npm run test:unit && npm run test:node`

Expected: all pass.

- [ ] **Step 3: Role and demo Playwright suites**

Run:

```bash
npx playwright test tests/access/role-page-access.spec.ts tests/demo-*.spec.ts --project=chromium --reporter=dot
```

Expected: all combinations and scenarios pass.

- [ ] **Step 4: Read-only live audit**

Run: `npm run audit:live`

Expected: unchanged counts unless an external actor changed live data; no mutation path.

- [ ] **Step 5: Final repository state**

Run: `git status --short && git log --oneline -12`

Expected: implementation and reports committed; only user/tool-generated ignored directories remain.
