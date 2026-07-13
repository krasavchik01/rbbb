# Deputy Company Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let deputy directors and administrators see and assign companies for projects whose company is missing.

**Architecture:** Keep company visibility logic in `userCompanyAccess`, use it from `useProjects`, and keep assignment UI in `ProjectWorkspace`. The existing Supabase project updater remains the only persistence route.

**Tech Stack:** React, TypeScript, Supabase, Vitest, Playwright.

---

### Task 1: Preserve visibility of projects without companies

**Files:**
- Modify: `src/lib/userCompanyAccess.ts`
- Modify: `src/hooks/useSupabaseData.ts`
- Test: `src/lib/userCompanyAccess.test.ts`

- [ ] Write a failing test for a project with no company identity.
- [ ] Implement the identity predicate and include missing-company projects only for CEO, admin, and deputy director when an allowed-company scope is present.
- [ ] Run the focused Vitest file.

### Task 2: Add the narrow company-assignment control

**Files:**
- Modify: `src/pages/ProjectWorkspace.tsx`
- Test: `tests/demo-bulk-administration.spec.ts`

- [ ] Add a company selector that is available to CEO, admin, and deputy director only.
- [ ] Save company identity with the existing project update method and update local project state after confirmation.
- [ ] Assert deputy visibility and assistant read-only behavior in the demo browser test.

### Task 3: Verify and publish

**Files:**
- Modify: `reports/demo-readiness/README.md` only if deployment evidence changes.

- [ ] Run typecheck, focused unit and browser tests, then the active browser suite.
- [ ] Commit, push, deploy production, and check the published assets and routes.
