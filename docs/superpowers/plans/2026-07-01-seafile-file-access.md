# Seafile File Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Seafile project files downloadable by authorized project participants while keeping upload/delete restricted to leadership and procurement roles.

**Architecture:** Keep authorization in `api/_seafile-access.mjs` and pass an explicit access mode from each Vercel API handler. Frontend contract links that point to `seafile://` must resolve through `/api/seafile/download-url` before opening.

**Tech Stack:** Vercel Node API handlers, Supabase service-role lookups, React/TypeScript frontend, Node test runner.

---

### Task 1: Add Focused Authorization Tests

**Files:**
- Modify: `tests/server-file-auth.test.mjs`

- [ ] Add tests that import `api/_seafile-access.mjs` through a fake Supabase admin client and verify:
  - project participant can pass `read` access by `notes.team`;
  - project participant is denied `write` access;
  - privileged procurement/admin role can pass `write`.

- [ ] Run: `node --test tests/server-file-auth.test.mjs`
Expected: new tests fail before the authorization split and pass after implementation.

### Task 2: Split Seafile Access Into Read And Write

**Files:**
- Modify: `api/_seafile-access.mjs`
- Modify: `api/seafile/download-url.mjs`
- Modify: `api/seafile/list.mjs`
- Modify: `api/seafile/file.mjs`
- Modify: `api/seafile/upload-link.mjs`
- Modify: `api/seafile/upload.mjs`

- [ ] Add `READ` and `WRITE` modes to `assertCanAccessSeafileOwner` and `assertCanAccessSeafilePath`.
- [ ] Keep read access for full roles and project/task participants.
- [ ] Restrict write access to `admin`, `ceo`, `deputy_director`, `company_director`, and `procurement`.
- [ ] Wire handlers:
  - `download-url` and `list`: `{ mode: 'read' }`
  - `file`, `upload-link`, `upload`: `{ mode: 'write' }`

### Task 3: Fix Contract Seafile Links

**Files:**
- Modify: `src/components/projects/ContractEditor.tsx`

- [ ] Add a small click handler that detects Seafile URLs or storage paths and calls `supabaseDataStore.getSeafileDownloadUrl`.
- [ ] Replace direct `<a href="seafile://...">` links for contract files and amendment files with buttons/anchors that open the resolved temporary URL.
- [ ] Leave non-Seafile HTTP links unchanged.

### Task 4: Verify

**Files:**
- Read only: existing test and typecheck output

- [ ] Run: `node --test tests/server-file-auth.test.mjs`
Expected: all tests pass.
- [ ] Run a narrow syntax/build check if available for touched files.
- [ ] Note that `npm run typecheck` is already red from unrelated baseline errors and do not expand scope to fix them.
