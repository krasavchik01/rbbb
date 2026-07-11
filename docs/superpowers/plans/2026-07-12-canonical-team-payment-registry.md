# Canonical Team and Payment Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `projects.notes.team` the only persisted team source and make the `bonuses` table the only source of final payment status without creating any payments.

**Architecture:** Keep `project.team` only as the existing UI projection produced from notes. Add a focused SELECT-only payment reader/index, remove legacy Seafile table lookups, and change `/bonuses` so draft calculations remain editable while final payment state is read from the registry.

**Tech Stack:** React 18, TypeScript, Supabase JS, Vitest, Node test runner, Playwright.

---

### Task 1: Final payment index

**Files:**
- Create: `src/lib/bonusPayments.ts`
- Create: `src/lib/bonusPayments.test.ts`
- Modify: `tests/reconciliation-readonly.test.mjs`

- [ ] **Step 1: Write failing unit tests**

Cover an empty registry, an approved row, a row with `payment_date`, duplicate rows for one project/employee pair, and rows with missing keys. Assert that the latest payment date wins and that unmatched rows are counted but not indexed.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:unit -- src/lib/bonusPayments.test.ts`

Expected: FAIL because `bonusPayments.ts` does not exist.

- [ ] **Step 3: Implement the read-only module**

Export `loadBonusPayments`, `buildBonusPaymentIndex`, `bonusPaymentKey`, `getBonusPaymentState`, and the payment row/state types. The loader must contain only:

```ts
supabase.from('bonuses').select('*').order('created_at', { ascending: true })
```

The state for a pair must expose `registered`, `paid`, `paymentDate`, `amount`, and `rowCount`.

- [ ] **Step 4: Add the mutation safety guard**

Extend `tests/reconciliation-readonly.test.mjs` to read `src/lib/bonusPayments.ts` and reject `.insert(`, `.update(`, `.upsert(`, `.delete(`, and `.rpc(`.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:unit -- src/lib/bonusPayments.test.ts && npm run test:node`

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bonusPayments.ts src/lib/bonusPayments.test.ts tests/reconciliation-readonly.test.mjs
git commit -m "feat(finance): add read-only payment registry"
```

### Task 2: Canonical Seafile team access

**Files:**
- Modify: `api/_seafile-access.mjs:254-281`
- Modify: `tests/seafile-access.test.mjs`

- [ ] **Step 1: Strengthen the regression test**

Assert that the source of `api/_seafile-access.mjs` does not contain `project_team` or `project_participants`, while the existing notes-team access test still passes.

- [ ] **Step 2: Run the focused Node test and verify failure**

Run: `node --test tests/seafile-access.test.mjs`

Expected: FAIL because the legacy query is still present.

- [ ] **Step 3: Remove the legacy table query**

Delete the `project_team` lookup from `userCanAccessProject`. Keep direct owner checks and `notesContainUser(parseNotes(project.notes), user)`.

- [ ] **Step 4: Run the focused Node test**

Run: `node --test tests/seafile-access.test.mjs`

Expected: all Seafile access tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/_seafile-access.mjs tests/seafile-access.test.mjs
git commit -m "fix(files): use notes team for project access"
```

### Task 3: Safe bonus draft UI

**Files:**
- Modify: `src/pages/Bonuses.tsx`
- Modify: `src/components/projects/CEOSummaryTable.tsx`
- Create: `tests/bonus-payment-source.test.mjs`

- [ ] **Step 1: Write static regression tests**

Assert that `Bonuses.tsx` imports `loadBonusPayments`, does not create `paidAt`, and does not expose `markPaid`/`unmarkPaid` actions. Assert that the CEO summary no longer labels calculated draft totals as paid.

- [ ] **Step 2: Run the focused Node test and verify failure**

Run: `node --test tests/bonus-payment-source.test.mjs`

Expected: FAIL on the current notes-based payment code.

- [ ] **Step 3: Load and index final payment rows**

In `Bonuses.tsx`, add state for rows, loading, and error. Load once through `loadBonusPayments`, build the index with `useMemo`, and leave an empty table distinct from a failed load.

- [ ] **Step 4: Derive statuses from the registry**

For every team bonus, use `getBonusPaymentState(index, project.id, userId)`. Set `paidAt` only from `paymentDate`; set `status='paid'` only when `paid` is true, `status='approved'` only when a final row is registered, otherwise keep the item pending as a draft.

- [ ] **Step 5: Remove false payment mutations**

Delete `markBonusPaid` and `unmarkBonusPaid`, remove the corresponding buttons, and omit `markPaid`/`unmarkPaid` from `ceoTableActions`. Keep amount, visibility, team, and close-project draft actions.

- [ ] **Step 6: Add an explicit registry banner**

Above the financial tables show one of three states: loading, load error, or `Финальный реестр: N строк; выплаты подтверждаются только таблицей bonuses`. When the registry is empty, explicitly say that no final payouts are registered.

- [ ] **Step 7: Correct CEO summary wording**

Rename the draft KPI and help text so calculated totals are described as planned/preliminary rather than paid. Remove payment buttons from the component interface and rendered rows.

- [ ] **Step 8: Run focused and type checks**

Run: `node --test tests/bonus-payment-source.test.mjs && npm run typecheck && npm run test:unit`

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Bonuses.tsx src/components/projects/CEOSummaryTable.tsx tests/bonus-payment-source.test.mjs
git commit -m "fix(finance): separate bonus drafts from payments"
```

### Task 4: Full verification

**Files:**
- Modify only if a verification failure exposes a regression in the files above.

- [ ] **Step 1: Run static and compilation gates**

Run: `npm run typecheck && npm run lint && npm run build`

Expected: typecheck/build pass and ESLint reports zero errors.

- [ ] **Step 2: Run automated tests**

Run: `npm run test:unit && npm run test:node`

Expected: all tests pass.

- [ ] **Step 3: Run role access matrix**

Run: `npx playwright test tests/access/role-page-access.spec.ts --project=chromium --reporter=dot`

Expected: 568 tests pass.

- [ ] **Step 4: Confirm live safety**

Run: `npm run audit:live`

Expected: the audit remains SELECT-only and reports no write attempt. `bonuses`, `project_team`, and `project_participants` remain unchanged.

- [ ] **Step 5: Record the final state**

Run: `git status --short && git log --oneline -8`

Expected: only user-owned ignored/untracked tool directories remain; all implementation changes are committed.
