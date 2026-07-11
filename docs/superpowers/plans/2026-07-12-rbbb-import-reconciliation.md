# RBBB Import Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить воспроизводимый read-only JSON/XLSX реестр сверки RBI, Кенжекулова и трёх спорных timesheet-файлов без изменений live-БД.

**Architecture:** Pure-модуль нормализации и fingerprint отделён от live-сборщика. Сборщик читает локальные отчёты/Excel и Supabase только через paginated `SELECT`, сохраняет timestamped JSON. Отдельный renderer на `@oai/artifact-tool` превращает JSON в форматированный Excel для ручных решений.

**Tech Stack:** Node.js ESM, `node:test`, Supabase JS, `xlsx` только для чтения исходных книг, `@oai/artifact-tool` для создания и проверки итогового XLSX.

---

### Task 1: Correct the review population in the written design

**Files:**
- Modify: `docs/superpowers/specs/2026-07-11-rbbb-import-reconciliation-design.md`

- [ ] **Step 1: Record the non-overlapping RBI populations**

Add the verified counts:

```markdown
RBI review population contains 246 unique source rows:

- 66 project match conflicts;
- 72 team conflicts, 15 of which overlap project match conflicts;
- 57 additional exact/probable rows blocked only by team conflict;
- 123 not-found rows.
```

Rename workbook sheets to `RBI Match Conflicts`, `RBI Team Conflicts`, and `RBI Not Found`. Keep the exact automated assertions 66, 72, and 123.

- [ ] **Step 2: Self-check and commit**

Run:

```powershell
rg -n "66|72|123|246|RBI Match Conflicts|RBI Team Conflicts" docs/superpowers/specs/2026-07-11-rbbb-import-reconciliation-design.md
git diff --check
```

Expected: all four counts and all three sheet names are present; `git diff --check` exits 0.

Commit:

```powershell
git add docs/superpowers/specs/2026-07-11-rbbb-import-reconciliation-design.md docs/superpowers/plans/2026-07-12-rbbb-import-reconciliation.md
git commit -m "docs: plan RBBB import reconciliation"
```

### Task 2: Build and test deterministic reconciliation primitives

**Files:**
- Create: `scripts/reconciliation/core.mjs`
- Create: `tests/reconciliation-core.test.mjs`

- [ ] **Step 1: Write failing tests**

Create tests for Unicode normalization, stable source keys, fingerprints, RBI counts, and final status priority:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyRbiRow,
  normalizeText,
  rowFingerprint,
  sourceKey,
  summarizeRbiReview,
} from '../scripts/reconciliation/core.mjs';

test('normalizes quotes, Kazakh letters and whitespace without mojibake', () => {
  assert.equal(normalizeText(' ТОО «Қыран»  '), 'тоо кыран');
});

test('builds stable source identity', () => {
  assert.equal(sourceKey('1 кв Проекты 2024_RBI.xlsx', 'Проекты 1 кв 2024', 19),
    '1 кв проекты 2024 rbi.xlsx::проекты 1 кв 2024::19');
});

test('fingerprint is stable across numeric hour formatting', () => {
  const base = { employeeId: 'e1', workDate: '2026-01-02', hours: 8, projectName: 'ТОО «FinQ»', notes: '' };
  assert.equal(rowFingerprint(base), rowFingerprint({ ...base, hours: '8.00' }));
});

test('keeps match and team conflicts visible as independent flags', () => {
  assert.deepEqual(classifyRbiRow({ matchType: 'conflict', conflicts: ['partner differs'] }), {
    status: 'needs_project_match', matchConflict: true, teamConflict: true,
  });
});

test('summarizes overlapping review populations', () => {
  const rows = [
    { matchType: 'conflict', conflicts: ['x'] },
    { matchType: 'conflict', conflicts: [] },
    { matchType: 'exact', conflicts: ['x'] },
    { matchType: 'not_found', conflicts: [] },
  ];
  assert.deepEqual(summarizeRbiReview(rows), {
    matchConflicts: 2, teamConflicts: 2, overlap: 1, additionalTeamConflicts: 1,
    notFound: 1, uniqueReviewRows: 4,
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/reconciliation-core.test.mjs`

Expected: FAIL because `scripts/reconciliation/core.mjs` does not exist.

- [ ] **Step 3: Implement the pure module**

Export these exact interfaces:

```js
export function normalizeText(value);
export function sourceKey(file, sheet, row);
export function rowFingerprint({ employeeId, workDate, hours, projectName, notes });
export function classifyRbiRow(result);
export function summarizeRbiReview(results);
export function scoreProject(entry, project);
export function classifyProjectCandidates(candidates);
export function parseExcelDate(value);
export function parseHours(value);
```

Use `String.prototype.normalize('NFKC')`, Kazakh-to-Russian character folding, quote/punctuation removal, whitespace collapse, and `node:crypto` SHA-256.

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/reconciliation-core.test.mjs`

Expected: PASS.

Commit:

```powershell
git add scripts/reconciliation/core.mjs tests/reconciliation-core.test.mjs
git commit -m "test(reconciliation): add deterministic evidence primitives"
```

### Task 3: Add a guarded SELECT-only collector

**Files:**
- Create: `scripts/reconciliation/collect-rbbb-reconciliation.mjs`
- Create: `tests/reconciliation-readonly.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the source-level guard**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('reconciliation collector contains no mutation path', () => {
  const source = fs.readFileSync(new URL('../scripts/reconciliation/collect-rbbb-reconciliation.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(', '--commit']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('collector does not invoke legacy import scripts', () => {
  const source = fs.readFileSync(new URL('../scripts/reconciliation/collect-rbbb-reconciliation.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['import-timesheets.mjs', 'close-partner-ledger-projects.mjs', 'dryrun-rbi-project-enrichment.mjs']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
```

- [ ] **Step 2: Run the guard and confirm failure**

Run: `node --test tests/reconciliation-readonly.test.mjs`

Expected: FAIL because the collector does not exist.

- [ ] **Step 3: Implement local evidence loading and live SELECTs**

The collector must:

```js
const SOURCES = {
  rbi: 'reports/rbi-project-enrichment-dryrun/dryrun.json',
  rbiCommit: 'reports/rbi-project-enrichment-dryrun/commit-results.json',
  rbiPeople: 'reports/rbi-project-enrichment-dryrun/people-add-results.json',
  kenzhekulov: 'reports/kenzhekulov-projects/analysis.json',
  reimport: 'tmp/reimport-drafts.json',
};
```

Validate every file and the RBI source summary. Read paginated live rows:

```js
readAll('projects', 'id,name,status,partner_id,manager_id,notes');
readAll('employees', 'id,name,email,role,level');
readAll('timesheet_entries', 'id,employee_id,employee_name,project_id,project_name,work_date,hours,status,source,import_batch_id,notes,reviewer_notes');
```

Only `.from(...).select(...).range(...)` plus filters may be used.

- [ ] **Step 4: Build RBI evidence rows**

For every RBI result, include:

```js
{
  sourceKey, sourceFile, sourceSheet, sourceRow, clientName, auditType, auditPeriod,
  oldMatchType, oldBestProjectId, oldBestProjectName, oldBestScore,
  currentMatchType, currentCandidates, matchConflict, teamConflict,
  existingTeam, proposedTeam, conflicts, externalPeople,
  status, recommendation, decision: '', approvedProjectId: '', reviewComment: '',
}
```

Assert live output populations:

```js
matchConflicts.length === 66;
teamConflicts.length === 72;
notFound.length === 123;
uniqueReviewRows === 246;
```

- [ ] **Step 5: Add the package command and run tests**

Add:

```json
"audit:reconciliation": "node scripts/reconciliation/collect-rbbb-reconciliation.mjs"
```

Run: `npm run test:node`

Expected: all Node tests pass, including both guard tests.

- [ ] **Step 6: Commit**

```powershell
git add scripts/reconciliation/collect-rbbb-reconciliation.mjs tests/reconciliation-readonly.test.mjs package.json
git commit -m "feat(reconciliation): add read-only RBI evidence collector"
```

### Task 4: Reconstruct Kenzhekulov evidence without shared-marker assumptions

**Files:**
- Modify: `scripts/reconciliation/collect-rbbb-reconciliation.mjs`
- Modify: `tests/reconciliation-core.test.mjs`

- [ ] **Step 1: Add fixture tests for source-specific evidence**

Test that a shared marker alone is insufficient and that source partner plus project evidence is required:

```js
test('does not attribute a shared ledger marker to Kenzhekulov by itself', () => {
  assert.equal(classifyKenzhekulovEvidence({ sharedMarker: true, partnerMatch: false, nameMatch: false }), 'insufficient_evidence');
});

test('confirms a row when source partner and live project both match', () => {
  assert.equal(classifyKenzhekulovEvidence({ sharedMarker: true, partnerMatch: true, nameMatch: true }), 'confirmed_applied');
});
```

- [ ] **Step 2: Implement source-specific reconstruction**

For all 52 analysis rows, recompute live candidates and emit:

```js
{
  sourceNo, clientName, auditType, auditYear, proposedTeam,
  historicalMatchProjectId, currentCandidates, evidenceProjectId,
  partnerMatch, sharedCloseMarker, approvedLedgerRows, approvedLedgerHours,
  status, recommendation,
}
```

Explicitly include the five names:

```js
['БОЗОЙ', 'АО КТК', 'Мирбуш', 'ТОО ТИМ', 'ТОО TGAlfarabi']
```

The aggregate 64 projects / 839 rows / 6233.8 hours may appear only in summary as shared-marker scope, never as Kenzhekulov-specific proof.

- [ ] **Step 3: Run tests and commit**

Run:

```powershell
node --test tests/reconciliation-core.test.mjs tests/reconciliation-readonly.test.mjs
npm run audit:reconciliation
```

Expected: tests pass; collector creates a timestamped JSON and reports 52 Kenzhekulov rows.

Commit:

```powershell
git add scripts/reconciliation/core.mjs scripts/reconciliation/collect-rbbb-reconciliation.mjs tests/reconciliation-core.test.mjs
git commit -m "feat(reconciliation): isolate Kenzhekulov ledger evidence"
```

### Task 5: Compare the three timesheet file versions to live batch v3

**Files:**
- Create: `scripts/reconciliation/timesheet-files.mjs`
- Create: `tests/reconciliation-timesheet-files.test.mjs`
- Modify: `scripts/reconciliation/collect-rbbb-reconciliation.mjs`

- [ ] **Step 1: Write parser and comparison tests**

Use a synthetic sheet matrix to verify header discovery, `(1)` filename cleanup, date/hour parsing, and set differences:

```js
test('compares source and live fingerprints without treating names as proof', () => {
  const result = compareFingerprintSets(new Set(['a', 'b']), new Set(['b', 'c']));
  assert.deepEqual(result, { matched: 1, sourceOnly: ['a'], liveOnly: ['c'] });
});
```

- [ ] **Step 2: Implement read-only workbook parsing**

Use `xlsx` only to read existing `.xlsx` files. Scan every sheet for a header row containing employee, date, project, and hours. Emit normalized rows and file metadata for:

```js
[
  ['Аманов Онгар.xlsx', 'tmp/timesheets-raw/Аманов Онгар.xlsx', 'd1dbb59d-113c-4d9a-8a65-06f441bcf0a9'],
  ['Бадамбаева Сауле(1).xlsx', 'tmp/timesheets-raw/Бадамбаева Сауле.xlsx', 'ba3d0a39-e789-4eed-8890-64dca41dbdd9'],
  ['Сартаева Гаухар(1).xlsx', 'tmp/timesheets-raw/Сартаева Гаухар.xlsx', '481df253-c011-46c1-bcda-04ea31690a1f'],
]
```

For root, raw, reimport drafts, and live batch v3 record SHA-256 where applicable, rows, hours, date range, projects, matched fingerprints, source-only fingerprints, and live-only fingerprints.

- [ ] **Step 3: Integrate, test, and commit**

Run:

```powershell
node --test tests/reconciliation-timesheet-files.test.mjs
npm run audit:reconciliation
```

Expected: the JSON clearly distinguishes employee presence from exact file-version coverage.

Commit:

```powershell
git add scripts/reconciliation/timesheet-files.mjs scripts/reconciliation/collect-rbbb-reconciliation.mjs tests/reconciliation-timesheet-files.test.mjs
git commit -m "feat(reconciliation): compare timesheet source versions"
```

### Task 6: Create and visually verify the review workbook

**Files:**
- Create: `scripts/reconciliation/build-rbbb-reconciliation-workbook.mjs`
- Create at runtime: `reports/reconciliation/rbbb-reconciliation-<timestamp>.xlsx`
- Create at runtime: `reports/reconciliation/previews/*.png`

- [ ] **Step 1: Load the spreadsheet runtime instructions**

Use the bundled Node runtime and `@oai/artifact-tool`. Create a junction from a temporary `node_modules` path to the loader-provided dependency directory. Do not add the runtime to `package.json`.

- [ ] **Step 2: Implement the workbook renderer**

The renderer accepts one JSON path and creates:

```text
Summary
RBI Match Conflicts
RBI Team Conflicts
RBI Not Found
Kenzhekulov
Timesheet Files
External People
Data Dictionary
```

Formatting requirements:

- dark teal title/header bands;
- frozen header rows and filters;
- wrapped evidence/candidate columns with capped widths;
- right-aligned counts/hours and explicit number formats;
- decision columns with list validation;
- conditional formatting for status/recommendation/blank decision;
- summary formulas that reference detailed sheets;
- no mutation/import execution controls in the workbook.

- [ ] **Step 3: Inspect formulas and key ranges**

Use artifact-tool inspection:

```js
await workbook.inspect({ kind: 'table', range: 'Summary!A1:H30', include: 'values,formulas' });
await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 300 } });
```

Expected: summary totals are 66, 72, 123, 246; formula error scan returns no results.

- [ ] **Step 4: Render every sheet and perform visual QA**

Render each sheet or its populated range to PNG. Verify title visibility, unclipped headers, readable wrapped evidence, consistent decision highlighting, and no blank/broken sheets. Patch and rerun until all sheets pass.

- [ ] **Step 5: Commit the renderer and final artifacts**

```powershell
git add scripts/reconciliation/build-rbbb-reconciliation-workbook.mjs reports/reconciliation
git commit -m "feat(reconciliation): add detailed import review workbook"
```

### Task 7: Run all gates and publish the evidence summary

**Files:**
- Modify at runtime: `reports/reconciliation/rbbb-reconciliation-<timestamp>.json`
- Modify at runtime: `reports/reconciliation/rbbb-reconciliation-<timestamp>.xlsx`

- [ ] **Step 1: Run all local gates**

```powershell
npm run typecheck
npm run test:unit
npm run test:node
npm run build
npm run test:routes
```

Expected: every command exits 0.

- [ ] **Step 2: Run the final live SELECT-only collection**

Run: `npm run audit:reconciliation`

Expected: a new timestamped JSON with no live mutation and the verified review populations.

- [ ] **Step 3: Build and verify the final workbook from that JSON**

Run the artifact renderer with the newest JSON, repeat formula scan and visual render verification, then retain only support previews needed for QA.

- [ ] **Step 4: Final repository review**

```powershell
git status --short --branch
git diff --check 3980054..HEAD
git log --oneline 3980054..HEAD
```

Expected: only known generated `.agents`, `.claude`, `playwright-report`, `test-results`, and `supabase/.temp` remain outside committed reconciliation outputs.
