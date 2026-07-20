# Project Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the project summary the single place to assign people, manage teams, status, bulk operations and audit business seasons.

**Architecture:** Project-specific facts remain in `projects.notes`: team, audit periods, finances and status history. Employees are stored once in `employees`; a newly entered GPH person is created or reused there and then assigned to the exact team role that initiated the action. Partner templates are stored in application settings and copied into a project as an independent team snapshot.

**Tech Stack:** React, TypeScript, Supabase, existing `ProjectCommandCenter`, Playwright.

---

### Task 1: Define compatible summary models

**Files:**
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Modify: `src/lib/auditPeriods.ts`
- Test: `tests/demo-bulk-administration.spec.ts`

- [ ] Add a GPH assignment context containing a project, optional audit period and target role.
- [ ] Represent a business season by an October-to-September date range and derive it from a period/project service range, never from years mentioned only in project text.
- [ ] Add an audit period type selector for 6 months, 9 months, annual and custom periods.

### Task 2: Persist GPH people and assign them to the selected role

**Files:**
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Test: `tests/demo-bulk-administration.spec.ts`

- [ ] In the GPH dialog require full name and payment amount.
- [ ] Reuse an employee having the same normalised full name, otherwise create an external GPH employee with a generated non-login e-mail.
- [ ] Save the financial contractor record, then assign that employee to the role/period from which “Добавить ГПХ” was selected.
- [ ] Assert that one project mutation contains the employee identity, role and contractor name.

### Task 3: Partner templates and bulk partner assignment

**Files:**
- Modify: `src/lib/appSettings.ts`
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Test: `tests/demo-bulk-administration.spec.ts`

- [ ] Store templates as partner id/name plus a canonical team list in the application-settings envelope.
- [ ] Allow a partner selection for selected projects and copy the selected partner template into every selected project without changing contracts, files or timesheets.
- [ ] When adding a partner on one project, offer applying the stored template; when no template exists, allow saving the project team as that partner's template.

### Task 4: Business seasons and date filtering

**Files:**
- Modify: `src/lib/auditPeriods.ts`
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Test: `tests/demo-bulk-administration.spec.ts`

- [ ] Show each project’s business season in the period/deadline column.
- [ ] Add filters for business season, project period type, exact start/end dates and existing deadline conditions.
- [ ] Ensure a project with a historical company name or year in its title is assigned only from its actual service/period dates.

### Task 5: Validate and release

**Files:**
- Test: `tests/demo-bulk-administration.spec.ts`

- [ ] Run role-scoped Playwright cases for deputy director and CEO.
- [ ] Run `npm run typecheck` and `npm run build`.
- [ ] Commit only relevant source/tests, push the recovery branch and deploy production.
