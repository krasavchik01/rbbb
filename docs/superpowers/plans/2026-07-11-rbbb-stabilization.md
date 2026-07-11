# RBBB Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрепить каноническую модель projects/notes, устранить вторые источники команд и бонусов и получить зелёные typecheck, build и тесты без записи в live-БД.

**Architecture:** Ввести typed adapter на границе `projects.notes`, оставить `src/hooks/useSupabaseData.ts` единственным продуктовым project repository и перевести team/period/finance helpers на adapter. Старые hooks становятся facade или удаляются, расчёты получают только approved hours, а generated Supabase types приводятся в соответствие уже существующим таблицам без применения миграций.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 4, Supabase JS 2.49, Playwright 1.56, Node.js 22.

---

## Safety rules for every task

- Работать только в `codex/rbbb-recovery-2026-07-11` поверх recovery commit `50e783b` и design commit `6c70b0b`.
- Не запускать import/cleanup/approval scripts с `--commit`, `--execute` или другим write-флагом.
- Не применять Supabase migrations и не вызывать DB `insert`, `update`, `upsert`, `delete` из audit-команд.
- Не записывать строки в `bonuses`.
- Не ослаблять `tsconfig.app.json` и не добавлять `@ts-ignore`/`@ts-nocheck`.
- Перед каждым commit запускать тесты изменённого модуля и `git diff --check`.

## File responsibility map

- Create `src/types/project-domain.ts` — канонические notes/team/finance типы.
- Create `src/lib/projectNotes.ts` — parse/read/merge/serialize adapter для `projects.notes`.
- Create `src/lib/projectNotes.test.ts` — защита неизвестных keys, markers и invalid JSON.
- Modify `src/lib/projectTeam.ts` — чтение команды только через notes adapter.
- Modify `src/lib/auditPeriods.ts` — period team только из `auditPeriods[].team`.
- Modify `src/lib/supabaseDataStore.ts` — DB row mapper и безопасный notes writer.
- Modify `src/hooks/useSupabaseData.ts` — один canonical project hook.
- Replace `src/hooks/useProjects.ts` — совместимый re-export без чтения `project_team`.
- Delete `src/lib/dataStore.ts` and `src/hooks/useDataStore.ts` — удалить вторую project/timesheet/bonus модель.
- Modify `src/pages/ProjectWorkspace.tsx` and `src/pages/DatabaseTest.tsx` — использовать canonical hooks.
- Modify `src/lib/timesheets.ts` and tests — pure approved aggregation.
- Modify `src/lib/bonusCalculation.ts` and add tests — только preliminary draft из notes.
- Modify `src/integrations/supabase/types.ts` — типы существующих `notifications` и `project_data`.
- Modify listed UI/type files — исправить реальные contract/type mismatches.
- Create `scripts/audit-rbbb-live-state.mjs` and `tests/live-audit-readonly.test.mjs` — повторяемый SELECT-only audit.

### Task 1: Canonical project notes types and adapter

**Files:**
- Create: `src/types/project-domain.ts`
- Create: `src/lib/projectNotes.ts`
- Create: `src/lib/projectNotes.test.ts`

- [ ] **Step 1: Write failing adapter tests**

```ts
// src/lib/projectNotes.test.ts
import { describe, expect, it } from 'vitest';
import {
  InvalidProjectNotesError,
  getProjectNotes,
  mergeProjectNotes,
  parseProjectNotes,
  serializeProjectNotes,
} from './projectNotes';

describe('projectNotes', () => {
  it('parses string, object and empty notes', () => {
    expect(parseProjectNotes('{"team":[]}')).toMatchObject({ ok: true, value: { team: [] } });
    expect(parseProjectNotes({ finances: { bonusPercent: 10 } })).toMatchObject({
      ok: true,
      value: { finances: { bonusPercent: 10 } },
    });
    expect(parseProjectNotes(null)).toMatchObject({ ok: true, value: {} });
  });

  it('reports invalid JSON and refuses a write merge', () => {
    const parsed = parseProjectNotes('{broken');
    expect(parsed.ok).toBe(false);
    expect(() => mergeProjectNotes('{broken', { team: [] })).toThrow(InvalidProjectNotesError);
  });

  it('preserves unknown metadata and nested finance fields', () => {
    const raw = JSON.stringify({
      rbiEnrichment: { marker: 'auto:rbi-project-enrichment-2026-07-02' },
      contract: { number: 'A-1' },
      finances: { bonusPercent: 10, customLedgerField: 'keep' },
      team: [{ userId: 'old', role: 'assistant_1' }],
    });
    const next = mergeProjectNotes(raw, {
      finances: { teamBonuses: { u1: { role: 'assistant_1', percent: 2, amount: 100 } } },
      team: [{ userId: 'u1', userName: 'User', role: 'assistant_1', bonusPercent: 2 }],
    });

    expect(next.rbiEnrichment).toEqual({ marker: 'auto:rbi-project-enrichment-2026-07-02' });
    expect(next.contract).toEqual({ number: 'A-1' });
    expect(next.finances?.bonusPercent).toBe(10);
    expect(next.finances?.customLedgerField).toBe('keep');
    expect(next.team?.[0].userId).toBe('u1');
    expect(JSON.parse(serializeProjectNotes(next))).toEqual(next);
  });

  it('reads notes from a raw or canonical project without trusting top-level team', () => {
    expect(getProjectNotes({ team: [{ userId: 'wrong' }], notes: '{"team":[{"userId":"right"}]}' }).team?.[0].userId).toBe('right');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npm run test:unit -- src/lib/projectNotes.test.ts`

Expected: FAIL because `./projectNotes` does not exist.

- [ ] **Step 3: Add canonical domain types**

```ts
// src/types/project-domain.ts
import type { UserRole } from '@/types/roles';

export type UnknownRecord = Record<string, unknown>;

export interface CanonicalTeamMember extends UnknownRecord {
  userId: string;
  userName?: string;
  role: UserRole | string;
  bonusPercent: number;
  assignedAt?: string;
  assignedBy?: string;
}

export interface CanonicalAuditPeriod extends UnknownRecord {
  id: string;
  name: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  partnerId?: string;
  partnerName?: string;
  status?: string;
  team?: CanonicalTeamMember[];
  teamSource?: 'period' | 'empty';
}

export interface TeamBonusDraft extends UnknownRecord {
  role: UserRole | string;
  percent: number;
  amount: number;
  manuallyAdjusted?: boolean;
  hiddenFromEmployee?: boolean;
  paidAt?: string | null;
  paidByName?: string | null;
  history?: Array<UnknownRecord>;
}

export interface CanonicalProjectFinances extends UnknownRecord {
  amountWithoutVAT?: number;
  preExpensePercent?: number;
  preExpenseAmount?: number;
  contractors?: Array<UnknownRecord & { amount?: number }>;
  totalContractorsAmount?: number;
  bonusBase?: number;
  bonusPercent?: number;
  totalBonusAmount?: number;
  distribution?: Record<string, number>;
  teamBonuses?: Record<string, TeamBonusDraft>;
  totalPaidBonuses?: number;
  totalCosts?: number;
  grossProfit?: number;
  profitMargin?: number;
}

export interface CanonicalProjectNotes extends UnknownRecord {
  name?: string;
  status?: string;
  completionPercent?: number;
  team?: CanonicalTeamMember[];
  auditPeriods?: CanonicalAuditPeriod[];
  finances?: CanonicalProjectFinances;
  contract?: UnknownRecord;
  client?: UnknownRecord;
  files?: unknown[];
  tasks?: unknown[];
}

export type ProjectNotesParseResult =
  | { ok: true; value: CanonicalProjectNotes; raw: unknown }
  | { ok: false; error: string; raw: unknown };
```

- [ ] **Step 4: Implement the adapter**

```ts
// src/lib/projectNotes.ts
import type {
  CanonicalProjectFinances,
  CanonicalProjectNotes,
  ProjectNotesParseResult,
} from '@/types/project-domain';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export class InvalidProjectNotesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectNotesError';
  }
}

export function parseProjectNotes(raw: unknown): ProjectNotesParseResult {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: {}, raw };
  if (isRecord(raw)) return { ok: true, value: raw as CanonicalProjectNotes, raw };
  if (typeof raw !== 'string') return { ok: false, error: `Unsupported notes type: ${typeof raw}`, raw };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed)
      ? { ok: true, value: parsed as CanonicalProjectNotes, raw }
      : { ok: false, error: 'Project notes JSON must contain an object', raw };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), raw };
  }
}

export function getProjectNotes(project: { notes?: unknown } | null | undefined): CanonicalProjectNotes {
  const result = parseProjectNotes(project?.notes);
  return result.ok ? result.value : {};
}

export function mergeProjectNotes(raw: unknown, patch: Partial<CanonicalProjectNotes>): CanonicalProjectNotes {
  const parsed = parseProjectNotes(raw);
  if (!parsed.ok) throw new InvalidProjectNotesError(parsed.error);
  const oldFinances = isRecord(parsed.value.finances) ? parsed.value.finances : {};
  const patchFinances = isRecord(patch.finances) ? patch.finances : undefined;
  const finances = patchFinances
    ? ({ ...oldFinances, ...patchFinances } as CanonicalProjectFinances)
    : parsed.value.finances;
  return {
    ...parsed.value,
    ...patch,
    ...(finances ? { finances } : {}),
  };
}

export function serializeProjectNotes(notes: CanonicalProjectNotes): string {
  return JSON.stringify(notes);
}
```

- [ ] **Step 5: Run adapter tests and typecheck the new files**

Run: `npm run test:unit -- src/lib/projectNotes.test.ts`

Expected: PASS, 4 tests.

Run: `npx tsc -p tsconfig.app.json --noEmit --pretty false 2>&1 | Select-String 'projectNotes|project-domain'`

Expected: no output for the new files.

- [ ] **Step 6: Commit**

```bash
git add src/types/project-domain.ts src/lib/projectNotes.ts src/lib/projectNotes.test.ts
git commit -m "feat(projects): add canonical notes adapter"
```

### Task 2: Make project team and period team obey notes ownership

**Files:**
- Modify: `src/lib/projectTeam.ts`
- Modify: `src/lib/auditPeriods.ts`
- Modify: `src/pages/ProjectCommandCenter.tsx`
- Modify: `src/pages/Projects-simple.tsx`
- Create: `src/lib/projectTeam.test.ts`
- Create: `src/lib/auditPeriods.test.ts`

- [ ] **Step 1: Write failing ownership tests**

```ts
// src/lib/projectTeam.test.ts
import { describe, expect, it } from 'vitest';
import { getProjectTeam } from './projectTeam';

describe('getProjectTeam', () => {
  it('reads only projects.notes.team', () => {
    expect(getProjectTeam({
      team: [{ userId: 'top-level' }],
      notes: JSON.stringify({ team: [{ userId: 'notes', role: 'assistant_1', bonusPercent: 2 }] }),
    }).map((member) => member.userId)).toEqual(['notes']);
  });
});
```

```ts
// src/lib/auditPeriods.test.ts
import { describe, expect, it } from 'vitest';
import { getAuditPeriods, projectToAuditPeriod } from './auditPeriods';

describe('audit period team ownership', () => {
  it('reads explicit periods from notes and keeps an explicit empty team', () => {
    const periods = getAuditPeriods({ notes: { auditPeriods: [{ id: 'p1', name: '2025', team: [] }] } });
    expect(periods[0].team).toEqual([]);
  });

  it('does not copy the project team into a synthetic period', () => {
    const period = projectToAuditPeriod({
      id: 'project-1',
      name: 'Audit 2025',
      notes: { team: [{ userId: 'u1', role: 'partner' }] },
    });
    expect(period.team).toEqual([]);
    expect(period.teamSource).toBe('empty');
  });
});
```

- [ ] **Step 2: Run tests and verify they expose legacy fallback behavior**

Run: `npm run test:unit -- src/lib/projectTeam.test.ts src/lib/auditPeriods.test.ts`

Expected: FAIL because `getProjectTeam` trusts top-level team and synthetic periods copy project team.

- [ ] **Step 3: Route team reads through the adapter**

Replace the local `TeamMember` interface and `getProjectTeam` body in `src/lib/projectTeam.ts` with:

```ts
import type { CanonicalTeamMember } from '@/types/project-domain';
import { getProjectNotes } from '@/lib/projectNotes';

export type TeamMember = CanonicalTeamMember;

export function getProjectTeam(project: { notes?: unknown } | null | undefined): TeamMember[] {
  const team = getProjectNotes(project).team;
  return Array.isArray(team) ? team : [];
}
```

Keep `withPartnerSet`, `withPartnerRemoved` and `addApprovedEntriesToProjectTeams`; change their arrays to `CanonicalTeamMember[]` and keep updates targeting `{ team: newTeam }`, because `supabaseDataStore.updateProject` will merge this into notes in Task 3.

- [ ] **Step 4: Remove period fallback and automatic spreading**

In `src/lib/auditPeriods.ts`, import `getProjectNotes` and `CanonicalTeamMember`, then use:

```ts
function parseNotes(project: { notes?: unknown } | null | undefined) {
  return getProjectNotes(project);
}

export function getAuditPeriods(project: { notes?: unknown }): AuditPeriod[] {
  const raw = parseNotes(project).auditPeriods || [];
  return Array.isArray(raw) ? raw.filter((period) => period?.id && period?.name) as AuditPeriod[] : [];
}

function getProjectTeam(project: { notes?: unknown }): CanonicalTeamMember[] {
  return parseNotes(project).team || [];
}
```

In `projectToAuditPeriod`, replace copied project team fields with:

```ts
team: [],
teamSource: 'empty',
```

Change `AuditPeriod.team` to `CanonicalTeamMember[]` and `teamSource` to `'period' | 'empty'`. Existing UI that displays project coverage must calculate it separately and must not persist the coverage view into a period.

In the period row inside `src/pages/ProjectCommandCenter.tsx`, remove the legacy project-team source branch and use:

```tsx
const teamSource = period.teamSource;
const periodHasOwnTeam = teamSource === 'period';
// badge
<Badge variant={periodHasOwnTeam ? 'default' : 'outline'} className="text-[11px]">
  {periodHasOwnTeam ? 'своя команда периода' : 'не распределено'}
</Badge>
```

- [ ] **Step 5: Run tests**

Run: `npm run test:unit -- src/lib/projectTeam.test.ts src/lib/auditPeriods.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/projectTeam.ts src/lib/projectTeam.test.ts src/lib/auditPeriods.ts src/lib/auditPeriods.test.ts
git commit -m "refactor(projects): enforce notes team ownership"
```

### Task 3: Safe project mapper/writer and one project hook

**Files:**
- Modify: `src/lib/supabaseDataStore.ts`
- Modify: `src/hooks/useSupabaseData.ts`
- Replace: `src/hooks/useProjects.ts`
- Modify: `src/pages/ProjectWorkspace.tsx`
- Modify: `src/pages/DatabaseTest.tsx`
- Delete: `src/hooks/useDataStore.ts`
- Delete: `src/lib/dataStore.ts`

- [ ] **Step 1: Export a testable DB-row mapper**

Move the pure mapping part out of the class and export it from `src/lib/supabaseDataStore.ts`:

```ts
import type { CanonicalProjectNotes, CanonicalTeamMember, CanonicalProjectFinances } from '@/types/project-domain';
import { getProjectNotes, mergeProjectNotes, parseProjectNotes, serializeProjectNotes } from '@/lib/projectNotes';

type SupabaseProjectRow = Database['public']['Tables']['projects']['Row'];

export type ProjectUiStatus =
  | 'active' | 'in_progress' | 'completed' | 'draft' | 'approval' | 'approved' | 'cancelled'
  | 'В работе' | 'На проверке' | 'Черновик' | 'Завершён' | 'Приостановлен';

export interface Project extends Omit<SupabaseProjectRow, 'notes' | 'status'> {
  status: ProjectUiStatus;
  notes: CanonicalProjectNotes;
  notesParseError?: string;
  clientName?: string;
  companyName?: string;
  company?: string;
  ourCompany?: string;
  currency?: string;
  amountWithoutVAT?: number;
  completionPercent?: number;
  completion?: number;
  team: CanonicalTeamMember[];
  tasks: unknown[];
  files?: unknown[];
  contract?: Record<string, unknown>;
  client?: Record<string, unknown>;
  finances?: CanonicalProjectFinances;
}

export function mapSupabaseProjectRow(proj: SupabaseProjectRow): Project {
  const parsed = parseProjectNotes(proj.notes);
  const notes = parsed.ok ? parsed.value : {};
  const notesStatus = typeof notes.status === 'string' ? notes.status : undefined;
  const status: ProjectUiStatus = notesStatus as ProjectUiStatus
    || (proj.status === 'completed' ? 'completed' : proj.status === 'in_progress' ? 'В работе' : 'В работе');
  return {
    ...proj,
    status,
    notes,
    ...(parsed.ok ? {} : { notesParseError: parsed.error }),
    name: typeof notes.name === 'string' ? notes.name : proj.name,
    clientName: typeof notes.clientName === 'string' ? notes.clientName : undefined,
    companyName: typeof notes.companyName === 'string' ? notes.companyName : undefined,
    ourCompany: typeof notes.ourCompany === 'string' ? notes.ourCompany : undefined,
    team: notes.team || [],
    tasks: notes.tasks || [],
    files: notes.files,
    finances: notes.finances,
    contract: notes.contract,
    client: notes.client,
    completionPercent: typeof notes.completionPercent === 'number' ? notes.completionPercent : proj.kpi_percentage || 0,
    completion: typeof notes.completionPercent === 'number' ? notes.completionPercent : proj.kpi_percentage || 0,
  };
}
```

Make the class method call `mapSupabaseProjectRow(proj)` and remove the random debug logging.

- [ ] **Step 2: Add mapper/writer regression tests**

Append to `src/lib/projectNotes.test.ts`:

```ts
import { mapSupabaseProjectRow } from './supabaseDataStore';

it('maps DB rows from notes and exposes invalid notes without inventing a team', () => {
  const mapped = mapSupabaseProjectRow({
    id: 'p1', name: 'DB name', notes: '{broken', status: 'active', start_date: '2026-01-01',
    deadline: '2026-12-31', partner_id: null, manager_id: null, kpi_percentage: 0,
    created_at: null, updated_at: null,
  });
  expect(mapped.team).toEqual([]);
  expect(mapped.notesParseError).toBeTruthy();
});
```

Run: `npm run test:unit -- src/lib/projectNotes.test.ts`

Expected: PASS after exporting the mapper.

- [ ] **Step 3: Make `updateProject` merge and protect notes**

Replace the current `JSON.parse`/spread section in `updateProject` with:

```ts
const existingNotes = getProjectNotes({ notes: currentProject.notes });
const notesPatch: Partial<CanonicalProjectNotes> = updates.notes && typeof updates.notes === 'object'
  ? updates.notes
  : {};
const mergedNotes = mergeProjectNotes(currentProject.notes, {
  ...updates,
  ...notesPatch,
  status: updates.status || notesPatch.status || existingNotes.status || currentProject.status || 'active',
  completionPercent: updates.completionPercent ?? updates.completion ?? existingNotes.completionPercent ?? currentProject.kpi_percentage ?? 0,
  updated_at: new Date().toISOString(),
});
const nextWorkflowStatus = String(mergedNotes.status || currentProject.status || 'active');
const nextCompletion = Number(mergedNotes.completionPercent || 0);
```

Use `serializeProjectNotes(mergedNotes)` in both the Supabase payload and the returned mapped row. `mergeProjectNotes` throws `InvalidProjectNotesError` before `.update(...)`, so invalid raw notes cannot be replaced with `{}`.

Define employee creation input without the current nullable-password intersection:

```ts
export type EmployeeCreateInput = Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'password'> & {
  password?: string | null;
};
```

Use these signatures:

```ts
// src/lib/supabaseDataStore.ts
async createEmployee(employee: EmployeeCreateInput): Promise<Employee>

// src/hooks/useSupabaseData.ts
import type { EmployeeCreateInput } from '@/lib/supabaseDataStore';
const createEmployee = useCallback(async (employee: EmployeeCreateInput) => {
  const newEmployee = await supabaseDataStore.createEmployee(employee);
  setEmployees((previous) => [...previous, newEmployee]);
  return newEmployee;
}, []);
```

- [ ] **Step 4: Turn the alternate project hook into a facade**

Replace all of `src/hooks/useProjects.ts` with:

```ts
export { useProjects } from '@/hooks/useSupabaseData';
```

This removes every read/write of `project_team` from the hook while preserving imports used by Dashboard, HR, UserManagement and widgets.

- [ ] **Step 5: Remove the legacy hybrid store**

In `src/pages/ProjectWorkspace.tsx` use:

```ts
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { useTasks } from '@/hooks/useTasks';

const { projects } = useProjects();
const { tasks: allTasks } = useTasks();
```

In `src/pages/DatabaseTest.tsx` import `useEmployees` and `useProjects` from `@/hooks/useSupabaseData`. Supply DB-compatible employee values:

```ts
await createEmployee({
  name: newEmpName,
  email: newEmpEmail,
  role: 'assistant',
  level: '1',
  password: null,
  whatsapp: null,
  department: 'Тестовый',
});
```

Then delete `src/hooks/useDataStore.ts` and `src/lib/dataStore.ts`; `rg -n '@/hooks/useDataStore|@/lib/dataStore' src` must return no matches.

- [ ] **Step 6: Run focused tests and typecheck inventory**

Run: `npm run test:unit -- src/lib/projectNotes.test.ts src/lib/projectTeam.test.ts src/lib/auditPeriods.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: FAIL only in the explicitly covered Tasks 4–7; there must be no error in deleted legacy store files, `useProjects.ts`, `projectNotes.ts` or `project-domain.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabaseDataStore.ts src/hooks/useSupabaseData.ts src/hooks/useProjects.ts src/pages/ProjectWorkspace.tsx src/pages/DatabaseTest.tsx src/hooks/useDataStore.ts src/lib/dataStore.ts
git commit -m "refactor(projects): consolidate project data access"
```

### Task 4: Approved-hours aggregation and preliminary bonus contract

**Files:**
- Modify: `src/lib/timesheets.ts`
- Modify: `src/lib/timesheets.test.ts`
- Modify: `src/lib/bonusCalculation.ts`
- Create: `src/lib/bonusCalculation.test.ts`
- Modify: `src/pages/Bonuses.tsx`
- Modify: `src/components/projects/CEOSummaryTable.tsx`

- [ ] **Step 1: Write failing pure aggregation tests**

Append to `src/lib/timesheets.test.ts`:

```ts
import { aggregateHoursByPair, aggregateProjectHours } from './timesheets';

it('counts only the requested timesheet status', () => {
  const rows = [
    { employee_id: 'u1', project_id: 'p1', hours: 4, status: 'approved' as const },
    { employee_id: 'u1', project_id: 'p1', hours: 8, status: 'submitted' as const },
    { employee_id: 'u1', project_id: 'p1', hours: 2, status: 'rejected' as const },
  ];
  expect(aggregateHoursByPair(rows, 'approved').get('u1__p1')).toBe(4);
  expect(aggregateProjectHours(rows).get('p1')).toEqual({ approved: 4, pending: 8 });
});
```

Run: `npm run test:unit -- src/lib/timesheets.test.ts`

Expected: FAIL because the pure helpers are not exported.

- [ ] **Step 2: Implement pure status-aware aggregation**

```ts
export interface HoursSourceRow {
  employee_id: string | null;
  project_id: string | null;
  hours: number | null;
  status: TimesheetStatus;
}

export function aggregateHoursByPair(
  rows: readonly HoursSourceRow[],
  status: TimesheetStatus,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== status || !row.employee_id || !row.project_id) continue;
    const key = `${row.employee_id}__${row.project_id}`;
    result.set(key, (result.get(key) || 0) + (Number(row.hours) || 0));
  }
  return result;
}

export function aggregateProjectHours(rows: readonly HoursSourceRow[]): Map<string, ProjectHoursTotals> {
  const result = new Map<string, ProjectHoursTotals>();
  for (const row of rows) {
    if (!row.project_id || (row.status !== 'approved' && row.status !== 'submitted')) continue;
    const current = result.get(row.project_id) || { approved: 0, pending: 0 };
    if (row.status === 'approved') current.approved += Number(row.hours) || 0;
    if (row.status === 'submitted') current.pending += Number(row.hours) || 0;
    result.set(row.project_id, current);
  }
  return result;
}
```

Select `status` in `hoursIndexByStatus`, delegate to `aggregateHoursByPair`, and delegate `allProjectsHoursTotals` to `aggregateProjectHours`.

- [ ] **Step 3: Write preliminary bonus tests**

```ts
// src/lib/bonusCalculation.test.ts
import { describe, expect, it } from 'vitest';
import { computeProjectBonus } from './bonusCalculation';

describe('computeProjectBonus', () => {
  it('uses notes finance drafts and labels technical defaults as preliminary', () => {
    const result = computeProjectBonus({
      id: 'p1',
      notes: {
        team: [{ userId: 'u1', userName: 'User', role: 'assistant_1', bonusPercent: 2 }],
        finances: {
          amountWithoutVAT: 1_000_000,
          preExpensePercent: 30,
          bonusPercent: 10,
          teamBonuses: { u1: { role: 'assistant_1', percent: 2, amount: 1200, manuallyAdjusted: true } },
        },
      },
    }, undefined, { approvedHoursByEmployee: new Map([['u1', 12]]) });

    expect(result.calculationKind).toBe('preliminary');
    expect(result.formulaVersion).toBe('technical-defaults-v1');
    expect(result.members[0].approvedHours).toBe(12);
    expect(result.members[0].finalAmount).toBe(1200);
  });
});
```

- [ ] **Step 4: Make the bonus module pure and notes-based**

Add to `BonusComputeMember` and `BonusComputeResult`:

```ts
approvedHours: number;
// BonusComputeResult fields:
calculationKind: 'preliminary';
formulaVersion: 'technical-defaults-v1';
```

Add context and canonical notes reads:

```ts
import { getProjectNotes } from '@/lib/projectNotes';

export interface BonusCalculationContext {
  approvedHoursByEmployee?: ReadonlyMap<string, number>;
}

export function computeProjectBonus(
  project: any,
  settings?: BonusSettings,
  context: BonusCalculationContext = {},
): BonusComputeResult {
  const notes = getProjectNotes(project);
  const finances = notes.finances || {};
  const team = notes.team || [];
  const contract = notes.contract || {};
  const base = Number(contract.amountWithoutVAT) || Number(finances.amountWithoutVAT) || 0;
  const contractorRows = Array.isArray(finances.contractors) ? finances.contractors : [];
  const contractors = contractorRows.reduce((sum, contractor) => sum + (Number(contractor.amount) || 0), 0);
  const overheadPercent = finances.preExpensePercent ?? settings?.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT;
  const bonusPercent = finances.bonusPercent ?? settings?.bonusPercent ?? DEFAULT_BONUS_PERCENT;
  const distribution = {
    ...DEFAULT_DISTRIBUTION,
    ...(settings?.distribution || {}),
    ...(finances.distribution || {}),
  };
  const overhead = base * (overheadPercent / 100);
  const remainder = Math.max(0, base - overhead - contractors);
  const bonusPool = remainder * (bonusPercent / 100);
  const drafts = finances.teamBonuses || {};
  const members: BonusComputeMember[] = [];

  for (const member of team) {
    const role = member.role as UserRole;
    if (!Object.prototype.hasOwnProperty.call(distribution, role)) continue;
    const userId = member.userId;
    const percent = typeof member.bonusPercent === 'number' ? member.bonusPercent : distribution[role] || 0;
    const plannedAmount = bonusPool * (percent / 100);
    const draft = drafts[userId] || { role, percent, amount: plannedAmount };
    const manuallyAdjusted = draft.manuallyAdjusted === true;
    const finalAmount = manuallyAdjusted ? Number(draft.amount) || 0 : plannedAmount;
    members.push({
      userId,
      userName: member.userName || '',
      role,
      bonusPct: bonusPool > 0 ? (finalAmount / bonusPool) * 100 : percent,
      plannedAmount,
      finalAmount,
      manuallyAdjusted,
      hiddenFromEmployee: draft.hiddenFromEmployee === true,
      paidAt: draft.paidAt || null,
      paidByName: draft.paidByName || null,
      history: Array.isArray(draft.history) ? draft.history as BonusComputeMember['history'] : [],
      approvedHours: context.approvedHoursByEmployee?.get(userId) || 0,
    });
  }

  const roleBonuses: Record<string, number> = {};
  const rolePotential: Record<string, number> = {};
  for (const role of BONUS_ROLES) {
    roleBonuses[role.role] = 0;
    rolePotential[role.role] = bonusPool * ((distribution[role.role] || 0) / 100);
  }
  for (const member of members) roleBonuses[member.role] = (roleBonuses[member.role] || 0) + member.finalAmount;
  const totalPaidBonuses = members.reduce((sum, member) => sum + member.finalAmount, 0);
  const totalCosts = totalPaidBonuses + contractors + overhead;
  const grossProfit = base - totalCosts;

  return {
    calculationKind: 'preliminary',
    formulaVersion: 'technical-defaults-v1',
    base, overheadPercent, overhead, contractors, remainder, bonusPercent, bonusPool,
    distribution, roleBonuses, rolePotential, members, totalPaidBonuses, totalCosts,
    grossProfit,
    profitMargin: base > 0 ? (grossProfit / base) * 100 : 0,
  };
}
```

Do not import Supabase and do not access the `bonuses` table in this module.

- [ ] **Step 5: Mark calculation output as preliminary in the two financial views**

Near the bonus-pool title in both `src/pages/Bonuses.tsx` and `src/components/projects/CEOSummaryTable.tsx`, render:

```tsx
<Badge variant="outline">Предварительный расчёт · технические проценты</Badge>
```

Do not add a payment/approve button in this task.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:unit -- src/lib/timesheets.test.ts src/lib/bonusCalculation.test.ts`

Expected: PASS.

```bash
git add src/lib/timesheets.ts src/lib/timesheets.test.ts src/lib/bonusCalculation.ts src/lib/bonusCalculation.test.ts src/pages/Bonuses.tsx src/components/projects/CEOSummaryTable.tsx
git commit -m "refactor(finance): isolate approved hours and bonus drafts"
```

### Task 5: Bring Supabase types and payloads in line with existing schema

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/projectSurvey.ts`
- Modify: `src/hooks/useTasks.ts`
- Modify: `src/lib/roleAccess.ts`

- [ ] **Step 1: Add existing `notifications` and `project_data` tables to generated types**

Insert these table definitions under `public.Tables` without running a migration:

```ts
notifications: {
  Row: { id: string; user_id: string; title: string; message: string; type: string; read: boolean; action_url: string | null; created_at: string; updated_at: string }
  Insert: { id?: string; user_id: string; title: string; message: string; type: string; read?: boolean; action_url?: string | null; created_at?: string; updated_at?: string }
  Update: { id?: string; user_id?: string; title?: string; message?: string; type?: string; read?: boolean; action_url?: string | null; created_at?: string; updated_at?: string }
  Relationships: []
}
project_data: {
  Row: { id: string; project_id: string; template_id: string; template_version: number; passport_data: Json; stages_data: Json; completion_status: Json; history: Json; created_at: string | null; updated_at: string | null; created_by: string | null }
  Insert: { id?: string; project_id: string; template_id: string; template_version?: number; passport_data?: Json; stages_data?: Json; completion_status?: Json; history?: Json; created_at?: string | null; updated_at?: string | null; created_by?: string | null }
  Update: { id?: string; project_id?: string; template_id?: string; template_version?: number; passport_data?: Json; stages_data?: Json; completion_status?: Json; history?: Json; created_at?: string | null; updated_at?: string | null; created_by?: string | null }
  Relationships: []
}
```

Set `Notification` in `src/lib/notifications.ts` from the generated row and narrow only the UI field:

```ts
type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export interface Notification extends Omit<NotificationRow, 'type'> {
  type: 'info' | 'success' | 'warning' | 'error';
}

function toNotification(row: NotificationRow): Notification {
  return { ...row, type: row.type as Notification['type'] };
}
```

Map query results explicitly:

```ts
return (data || []).map(toNotification); // getNotifications
return data ? toNotification(data) : null; // addNotification
// Realtime callback:
callback(toNotification(payload.new as NotificationRow));
```

- [ ] **Step 2: Serialize survey JSON explicitly**

In `src/lib/projectSurvey.ts` import `Json` and add:

```ts
function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
```

Use `asJson(next.answers)`, `asJson(p.proposedTeam)` and `asJson(p.statusVotes)` in Supabase payloads. This resolves the two TS2769 errors without `as any`.

- [ ] **Step 3: Require a task title on insert**

In `src/hooks/useTasks.ts` add:

```ts
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskCreateInput = Pick<TaskInsert, 'title'> & Partial<Omit<TaskInsert, 'title'>>;
```

Change `createTask(task: Partial<Task>)` to `createTask(task: TaskCreateInput)` and pass `task` directly to `.insert(task)`.

- [ ] **Step 4: Fix route-role inference without widening roles**

Use this exact implementation in `src/lib/roleAccess.ts`:

```ts
export function roleCanAccessRoute(role: UserRole, path: keyof typeof ROUTE_ACCESS): boolean {
  const allowedRoles: readonly UserRole[] = ROUTE_ACCESS[path];
  return allowedRoles.includes(role);
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck`

Expected: no TS2769/TS2352 error in `notifications.ts`, `projectSurvey.ts`, `useTasks.ts`, or `SupabaseDiagnostics.tsx`, and no TS2345 error in `roleAccess.ts`.

```bash
git add src/integrations/supabase/types.ts src/lib/notifications.ts src/lib/projectSurvey.ts src/hooks/useTasks.ts src/lib/roleAccess.ts
git commit -m "fix(types): align existing Supabase tables and payloads"
```

### Task 6: Resolve project, finance, Excel and component contract mismatches

**Files:**
- Modify: `src/types/project-v3.ts`
- Modify: `src/types/project.ts`
- Modify: `src/components/projects/ContractTabEdit.tsx`
- Modify: `src/components/projects/ProjectEditProcurement.tsx`
- Modify: `src/components/projects/ProjectStagesEditor.tsx`
- Modify: `src/pages/CreateProjectProcurement.tsx`
- Modify: `src/lib/excelExport.ts`
- Modify: `src/components/projects/WorkPaperTree.tsx`
- Modify: `src/components/MobileNavigation.tsx`
- Modify: `src/pages/ProjectApproval.tsx`
- Modify: `src/pages/ProjectSurveyResults.tsx`
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/ProjectCommandCenter.tsx`

- [ ] **Step 1: Extend the finance draft shape with fields already written by UI**

In `ProjectFinances` add:

```ts
vatRate?: number;
distribution?: Record<string, number>;
// inside teamBonuses member:
hiddenFromEmployee?: boolean;
paidAt?: string | null;
paidByName?: string | null;
history?: Array<{ type: string; by?: string; byName?: string; at: string; from?: unknown; to?: unknown }>;
```

In `calculateProjectFinances`, type collections explicitly:

```ts
const contractors: Contractor[] = Array.isArray(financesSource.contractors) ? financesSource.contractors : [];
const totalContractorsAmount = contractors.reduce((sum: number, contractor: Contractor) => sum + contractor.amount, 0);
const team: TeamMember[] = Array.isArray(project.team) ? project.team : Array.isArray(notes?.team) ? notes.team : [];
team.forEach((member: TeamMember) => {
  const userId = member.userId;
  if (!userId) return;
  const existingBonus = existingTeamBonuses[userId];
  const calculatedAmount = totalBonusAmount * (member.bonusPercent / 100);
  const amount = existingBonus?.manuallyAdjusted ? existingBonus.amount : calculatedAmount;
  const percent = existingBonus?.manuallyAdjusted
    ? (totalBonusAmount > 0
      ? Number(((amount / totalBonusAmount) * 100).toFixed(2))
      : existingBonus.percent || member.bonusPercent)
    : member.bonusPercent;
  teamBonuses[userId] = {
    ...existingBonus,
    role: member.role,
    percent,
    amount,
    manuallyAdjusted: existingBonus?.manuallyAdjusted || false,
  };
});
```

- [ ] **Step 2: Make project stages complete at creation time**

In `ProjectStagesEditor.addStage` include:

```ts
amountWithoutVAT: 0,
vatAmount: 0,
amountWithVAT: 0,
```

In `CreateProjectProcurement.tsx` use imported types instead of inline state shapes:

```ts
const [projectStages, setProjectStages] = useState<ProjectStage[]>([]);
const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>([]);
```

- [ ] **Step 3: Narrow Select values at component boundaries**

Use the typed callbacks in both `ContractTabEdit.tsx` and `ProjectEditProcurement.tsx`:

```tsx
onValueChange={(value) => setCurrency(value as ProjectCurrency)}
onValueChange={(value) => setProjectType(value as ProjectType)}
```

- [ ] **Step 4: Type all supported Excel amount aliases**

Add to `ProjectExcelRow`:

```ts
'Сумма с НДС'?: number | string;
'Сумма с учетом ндс'?: number | string;
'Сумма с ндс'?: number | string;
'Сумма без учета НДС'?: number | string;
```

Use this explicit precedence at the amount parsing site:

```ts
const amountWithVATRaw =
  (row['Сумма с учетом НДС'] && isValidAmount(row['Сумма с учетом НДС'])) ? row['Сумма с учетом НДС'] :
  (row['Сумма с НДС'] && isValidAmount(row['Сумма с НДС'])) ? row['Сумма с НДС'] :
  (row['Сумма с учетом ндс'] && isValidAmount(row['Сумма с учетом ндс'])) ? row['Сумма с учетом ндс'] :
  (row['Сумма с ндс'] && isValidAmount(row['Сумма с ндс'])) ? row['Сумма с ндс'] :
  null;
const amountWithoutVATRaw =
  (row['Сумма без учета НДС'] && isValidAmount(row['Сумма без учета НДС'])) ? row['Сумма без учета НДС'] :
  (row['Сумма (без НДС)'] && isValidAmount(row['Сумма (без НДС)'])) ? row['Сумма (без НДС)'] :
  (row['Сумма'] && isValidAmount(row['Сумма'])) ? row['Сумма'] :
  null;
```

- [ ] **Step 5: Correct component field ownership**

Apply these exact substitutions:

```ts
// WorkPaperTree.tsx
const sectionName = `Раздел ${sectionCode}`;

// MobileNavigation.tsx, before both filters
const userRole = user?.role || null;
// in filters
return userRole ? item.allowedRoles.includes(userRole) : false;
return userRole ? !item.excludeRoles.includes(userRole) : true;

// AppHeader.tsx and Settings.tsx
employee.companyId // replace employee.company_id

// Bonuses.tsx
employee.name // replace employee.full_name

// ProjectSurveyResults.tsx condition
votes && (votes.partner.length > 0 || votes.leader.length > 0 || votes.teammates.length > 0)
```

- [ ] **Step 6: Preserve structured team bonuses during approval**

In `ProjectApproval.tsx`, keep `finances.teamBonuses` from `calculateProjectFinances`; do not assign `roleBonuses: Record<string, number>` to it. The assignment must remain:

```ts
teamBonuses: finances?.teamBonuses || {},
```

Type `projectTeam` as `TeamMember[]` from `project-v3.ts` and type `teamMembers` as `Partial<Record<UserRole, string>>`.

In the bulk status update in `Projects-simple.tsx`, narrow the database enum before the Supabase call:

```ts
import type { Database } from '@/integrations/supabase/types';

type SupabaseProjectStatus = Database['public']['Enums']['project_status'];
let supabaseStatus: SupabaseProjectStatus = 'active';
if (newStatus === 'archived' || newStatus === 'completed') supabaseStatus = 'completed';
if (newStatus === 'in_progress') supabaseStatus = 'in_progress';
```

- [ ] **Step 7: Let canonical helper return types remove callback implicit-any errors**

In `ProjectCommandCenter.tsx`, type helper signatures:

```ts
function projectTeam(project: { notes?: unknown }): CanonicalTeamMember[]
function periodTeam(period: AuditPeriod): CanonicalTeamMember[]
function uniqueMembersFromTeams(teams: CanonicalTeamMember[][]): CanonicalTeamMember[]
```

Import `CanonicalTeamMember`. Once `row.team` and `row.periods` are typed, callbacks at the former baseline lines 1418, 1505, 2080, 2268 and 2517 infer `CanonicalTeamMember`, `AuditPeriod` and numeric indexes without annotations.

In `ProjectWorkspace.tsx`, `projectTasks` comes from typed `Task[]`; remove explicit `any` from filters:

```ts
const completed = projectTasks.filter((task) => isTaskDoneStatus(task.status)).length;
const inProgress = projectTasks.filter((task) => task.status === 'in_progress').length;
```

- [ ] **Step 8: Run typecheck and commit contract fixes**

Run: `npm run typecheck`

Expected: only TS6133/TS6192 unused declarations listed in Task 7; no TS2322, TS2339, TS2345, TS2353, TS2551, TS2678, TS2739, TS2769, TS7006 or TS7053.

```bash
git add src/types/project-v3.ts src/types/project.ts src/components/projects/ContractTabEdit.tsx src/components/projects/ProjectEditProcurement.tsx src/components/projects/ProjectStagesEditor.tsx src/pages/CreateProjectProcurement.tsx src/lib/excelExport.ts src/components/projects/WorkPaperTree.tsx src/components/MobileNavigation.tsx src/pages/ProjectApproval.tsx src/pages/ProjectSurveyResults.tsx src/components/AppHeader.tsx src/pages/Settings.tsx src/pages/ProjectCommandCenter.tsx src/pages/Projects-simple.tsx src/pages/ProjectWorkspace.tsx
git commit -m "fix(types): align project UI contracts"
```

### Task 7: Remove obsolete imports and dead state exposed by consolidation

**Files:**
- Modify all files listed below.

- [ ] **Step 1: Delete the exact unused bindings from the baseline**

Remove imports, state tuples, local constants and unused callback parameters listed here; do not prefix them with underscores because they are dead code:

```text
src/components/hr/TimesheetAnalyticsTab.tsx: Badge, Label, projectById
src/components/projects/ProjectVitals.tsx: Badge, ROLE_LABEL
src/lib/supabaseDataStore.ts: extensionForUpload and safeStorageFileName if neither has a caller after Seafile review
src/pages/Bonuses.tsx: Checkbox, CheckCircle2, getHoursFor, getPendingHoursFor, getTaskStats,
  getTasksForProject, setDraftBonusPercent, setDraftHidden, tasksOpen, setTasksOpen,
  projectsAwaitingApproval, updateDraftAmount
src/pages/CreateProjectProcurement.tsx: notifyProjectCreated, ProjectFileManager
src/pages/Dashboard.tsx: Progress, Calendar, Zap, navigate
src/pages/Employees.tsx: useProjects, Clock
src/pages/HR.tsx: Clock, Building, leadershipRoles
src/pages/ProjectApproval.tsx: DialogTrigger, DollarSign, UserPlus, TrendingUp, ChevronRight,
  supabase, projectToDelete, addingNewForRole, newEmpName, openRoleDropdown,
  setOpenRoleDropdown, roleSearchQuery, setRoleSearchQuery, mapEmployeeRoleToProjectRole
src/pages/ProjectCommandCenter.tsx: projectFiles, companyFilterKey
src/pages/Projects-simple.tsx: Textarea, ProjectType, ChecklistItem, PriorityLevel, TaskStatus,
  loading, allAppCompanies, createdBy, getDocumentCompletion, idx, currency
src/pages/ProjectWorkspace.tsx: Label, Textarea, Check, Upload, FileText, CheckCircle, Circle,
  ChevronRight, Save, AlertCircle, X, UserPlus, Search, ProjectV3, ChecklistItem, ContractInfo,
  openSlotDropdown, slotSearch, canSeeContracts, showFullDetails, syncSaveProjectData,
  forceSync, tasksByEmployee
src/pages/Settings.tsx: Building2
src/pages/Tasks.tsx: Upload, Download, FileText, formatBytes
src/pages/Tenders.tsx: the fully unused import at baseline line 18, TrendingDown, DollarSign, Edit,
  selectedTender, isAddDialogOpen
src/types/attendance.ts: inS, outS
```

Keep `ProjectStage` and `AdditionalService` imports because Task 6 now uses them for state typing.

- [ ] **Step 2: Verify compiler cleanliness**

Run: `npm run typecheck`

Expected: exit 0 and zero TypeScript errors.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "chore(types): remove obsolete legacy bindings"
```

### Task 8: Add repeatable read-only live audit and run all gates

**Files:**
- Create: `scripts/audit-rbbb-live-state.mjs`
- Create: `tests/live-audit-readonly.test.mjs`
- Modify: `package.json`
- Create at runtime: `reports/live-audit/rbbb-live-audit-<timestamp>.json`

- [ ] **Step 1: Write a source-level read-only guard test**

```js
// tests/live-audit-readonly.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('live audit contains no Supabase mutation calls', () => {
  const source = fs.readFileSync(new URL('../scripts/audit-rbbb-live-state.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
    assert.equal(source.includes(forbidden), false, `forbidden call: ${forbidden}`);
  }
  assert.equal(source.includes('--commit'), false);
});
```

Run: `node --test tests/live-audit-readonly.test.mjs`

Expected: FAIL because the audit script does not exist.

- [ ] **Step 2: Implement the SELECT-only audit**

Create `scripts/audit-rbbb-live-state.mjs` with these operations only:

```js
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase read credentials are missing');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function readAll(table, columns, apply = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns).range(from, from + 999);
    query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function parseNotes(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

const [projects, employees, approved, ledgerTimesheets] = await Promise.all([
  readAll('projects', 'id,name,status,partner_id,manager_id,notes'),
  readAll('employees', 'id,name,email,role,level'),
  readAll('timesheet_entries', 'id,hours,status', (query) => query.eq('status', 'approved')),
  readAll('timesheet_entries', 'id,project_id,status,hours,reviewer_notes',
    (query) => query.eq('reviewer_notes', 'auto:partner-ledger-timesheet-approval-2026-06-09')),
]);

let badNotes = 0;
let rbiProjects = 0;
let rbiMembers = 0;
let ledgerProjects = 0;
let duplicateTeamKeys = 0;
for (const project of projects) {
  const notes = parseNotes(project.notes);
  if (!notes) { badNotes += 1; continue; }
  const team = Array.isArray(notes.team) ? notes.team : [];
  if (notes.rbiEnrichment?.marker === 'auto:rbi-project-enrichment-2026-07-02') rbiProjects += 1;
  if (notes.partnerLedgerClose?.marker === 'auto:partner-ledger-close-2026-06-09') ledgerProjects += 1;
  rbiMembers += team.filter((member) => member?.assignedBy === 'auto:rbi-project-enrichment-2026-07-02').length;
  const seen = new Set();
  for (const member of team) {
    const key = `${member?.userId || member?.employeeId || ''}|${member?.role || ''}`;
    if (key !== '|' && seen.has(key)) duplicateTeamKeys += 1;
    seen.add(key);
  }
}

async function countTable(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? { error: error.message } : { count };
}

const result = {
  observedAt: new Date().toISOString(),
  totals: {
    projects: projects.length,
    employees: employees.length,
    approvedTimesheets: approved.length,
    approvedHours: Number(approved.reduce((sum, row) => sum + (Number(row.hours) || 0), 0).toFixed(1)),
    badProjectNotes: badNotes,
  },
  rbi: { markedProjects: rbiProjects, assignedMembers: rbiMembers, duplicateTeamKeys },
  partnerLedger: {
    markedProjects: ledgerProjects,
    approvedRows: ledgerTimesheets.length,
    approvedHours: Number(ledgerTimesheets.reduce((sum, row) => sum + (Number(row.hours) || 0), 0).toFixed(1)),
  },
  registries: {
    bonuses: await countTable('bonuses'),
    projectTeam: await countTable('project_team'),
    projectParticipants: await countTable('project_participants'),
  },
};

const outDir = path.resolve('reports/live-audit');
await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, `rbbb-live-audit-${result.observedAt.replace(/[:.]/g, '-')}.json`);
await fs.writeFile(out, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ out, ...result }, null, 2));
```

- [ ] **Step 3: Add commands and verify the read-only guard**

Add to `package.json` scripts:

```json
"audit:live": "node scripts/audit-rbbb-live-state.mjs",
"test:node": "node --test tests/*.test.mjs"
```

Run: `node --test tests/live-audit-readonly.test.mjs`

Expected: PASS.

- [ ] **Step 4: Run local quality gates**

Run in order:

```bash
npm run typecheck
npm run test:unit
npm run test:node
npm run build
npm run test:routes
```

Expected: every command exits 0. `npm run build` may create `dist`, which remains untracked.

- [ ] **Step 5: Run the live audit and compare to the saved baseline**

Run: `npm run audit:live`

Expected invariants:

```text
badProjectNotes = 0
rbi.markedProjects = 144
rbi.assignedMembers = 152
rbi.duplicateTeamKeys = 0
registries.bonuses.count = 0
registries.projectTeam.count = 0
registries.projectParticipants.count = 0
```

Projects/employees/timesheet totals may only differ if the report timestamp and evidence show an external live change. This implementation itself contains no mutation call.

- [ ] **Step 6: Run role access smoke test**

Run: `npm run test:access`

Expected: Playwright role-page access spec passes for the configured local test target. If infrastructure is unavailable, record the exact connection error; do not replace this test with a skipped assertion.

- [ ] **Step 7: Commit audit and verification support**

```bash
git add scripts/audit-rbbb-live-state.mjs tests/live-audit-readonly.test.mjs package.json reports/live-audit
git commit -m "test(audit): add read-only RBBB live verification"
```

- [ ] **Step 8: Final phase-one review**

Run:

```bash
git status --short --branch
git log --oneline 6c70b0b..HEAD
git diff --check 6c70b0b..HEAD
```

Expected:

- only `.agents`, `.claude`, `playwright-report`, `test-results`, `dist` and `supabase/.temp` may remain untracked/generated;
- commits are separated by canonical notes, team ownership, repository consolidation, finance, types, cleanup and audit;
- diff check is clean;
- no production deploy has occurred.

## Completion boundary

When all eight tasks pass, mark the stabilization phase complete and start a new brainstorming/spec cycle for import reconciliation. Do not resolve RBI conflicts, create unmatched projects, merge employees, approve timesheets, register payouts or deploy production inside this plan.
