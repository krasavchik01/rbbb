# Project Audit Periods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one-project-many-periods behavior so duplicate audit projects can be shown as a single project with partner-managed audit periods inside it.

**Architecture:** Store `auditPeriods` in project `notes` for the first release, matching existing project metadata storage and avoiding a risky database migration. Add a focused domain helper for parsing, creating, validating, grouping duplicate-like projects, and resolving period-level partners; then wire it into project workspace and project summary UI.

**Tech Stack:** React 18, TypeScript, Vite, Supabase client, shadcn/Radix UI components, Vitest.

---

## File Structure

- Create `src/lib/auditPeriods.ts`: domain types and pure helpers for audit period parsing, validation, creation, project grouping, and effective partner resolution.
- Create `src/lib/auditPeriods.test.ts`: unit tests for the helper.
- Create `src/components/projects/AuditPeriodsEditor.tsx`: project workspace UI for listing, adding, and editing periods.
- Modify `src/pages/ProjectWorkspace.tsx`: add the `Периоды` tab and save period updates through `supabaseDataStore.updateProject`.
- Modify `src/pages/Projects-simple.tsx`: group duplicate-like projects into one displayed row and show nested periods in the summary table.
- Modify `src/lib/projectTeam.ts`: expose period-aware partner lookup without breaking existing project partner behavior.
- Modify `src/lib/timesheets.ts`: add period-aware partner helper and optional future `auditPeriodId` support in memory/types only; do not require a DB migration in this pass.
- Modify `src/types/project-v3.ts`: add `AuditPeriod` compatibility fields to project model.

## Task 1: Audit Period Domain Helper

**Files:**
- Create: `src/lib/auditPeriods.ts`
- Create: `src/lib/auditPeriods.test.ts`

- [ ] **Step 1: Write failing tests for parsing, validation, grouping, and partner fallback**

Create `src/lib/auditPeriods.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AUDIT_PERIOD_TYPE_LABELS,
  buildAuditPeriod,
  getAuditPeriods,
  getEffectivePartnerId,
  groupProjectsByAuditRoot,
  validateAuditPeriodInput,
} from './auditPeriods';

describe('auditPeriods', () => {
  it('reads audit periods from project notes', () => {
    const project = {
      notes: {
        auditPeriods: [
          { id: 'ap-1', name: '2024 year', type: 'year', startDate: '2024-01-01', endDate: '2024-12-31' },
        ],
      },
    };

    expect(getAuditPeriods(project)).toHaveLength(1);
    expect(getAuditPeriods(project)[0].name).toBe('2024 year');
  });

  it('validates required dates and date order', () => {
    expect(validateAuditPeriodInput({ name: '', type: 'year', startDate: '', endDate: '' })).toEqual([
      'Period name is required',
      'Start date is required',
      'End date is required',
    ]);

    expect(validateAuditPeriodInput({
      name: 'Bad dates',
      type: 'year',
      startDate: '2024-12-31',
      endDate: '2024-01-01',
    })).toContain('End date must be on or after start date');
  });

  it('builds a stable period object with metadata', () => {
    const period = buildAuditPeriod({
      name: '9 months 2024',
      type: 'nine_months',
      startDate: '2024-01-01',
      endDate: '2024-09-30',
      partnerId: 'partner-1',
      partnerName: 'Partner One',
      createdBy: 'user-1',
    });

    expect(period.id).toMatch(/^ap_/);
    expect(period.type).toBe('nine_months');
    expect(period.year).toBe(2024);
    expect(period.status).toBe('planned');
    expect(AUDIT_PERIOD_TYPE_LABELS[period.type]).toBe('9 months');
  });

  it('uses period partner before project partner', () => {
    const project = {
      notes: {
        team: [{ role: 'partner', userId: 'project-partner' }],
        auditPeriods: [{ id: 'ap-1', name: '2024', type: 'year', startDate: '2024-01-01', endDate: '2024-12-31', partnerId: 'period-partner' }],
      },
    };

    expect(getEffectivePartnerId(project, 'ap-1')).toBe('period-partner');
    expect(getEffectivePartnerId(project)).toBe('project-partner');
  });

  it('groups duplicate-like imported projects by cleaned root name and company', () => {
    const rows = groupProjectsByAuditRoot([
      { id: 'p1', name: 'TOO Oil Construction Company (за период 2022-2024)', companyName: 'MAK' },
      { id: 'p2', name: 'TOO Oil Construction Company (за период 2022-2024)', companyName: 'MAK' },
      { id: 'p3', name: 'Another Project', companyName: 'MAK' },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].duplicates).toHaveLength(2);
    expect(rows[0].displayName).toBe('TOO Oil Construction Company');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm.cmd run test:unit -- src/lib/auditPeriods.test.ts
```

Expected: FAIL because `src/lib/auditPeriods.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/auditPeriods.ts`:

```ts
export type AuditPeriodType = 'six_months' | 'nine_months' | 'year' | 'custom';
export type AuditPeriodStatus = 'planned' | 'in_progress' | 'ready_for_review' | 'completed';

export interface AuditPeriod {
  id: string;
  name: string;
  type: AuditPeriodType;
  startDate: string;
  endDate: string;
  year?: number;
  partnerId?: string;
  partnerName?: string;
  status: AuditPeriodStatus;
  deadline?: string;
  taskIds?: string[];
  documentIds?: string[];
  team?: any[];
  amountWithoutVAT?: number;
  sourceProjectId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const AUDIT_PERIOD_TYPE_LABELS: Record<AuditPeriodType, string> = {
  six_months: '6 months',
  nine_months: '9 months',
  year: 'Year',
  custom: 'Custom',
};

export const AUDIT_PERIOD_STATUS_LABELS: Record<AuditPeriodStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  ready_for_review: 'Ready for review',
  completed: 'Completed',
};

export interface AuditPeriodInput {
  name: string;
  type: AuditPeriodType;
  startDate: string;
  endDate: string;
  partnerId?: string;
  partnerName?: string;
  status?: AuditPeriodStatus;
  deadline?: string;
  amountWithoutVAT?: number;
  sourceProjectId?: string;
  createdBy?: string;
}

function parseNotes(project: any): any {
  const notes = project?.notes;
  if (!notes) return {};
  if (typeof notes === 'object') return notes;
  if (typeof notes !== 'string') return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getAuditPeriods(project: any): AuditPeriod[] {
  const notes = parseNotes(project);
  const raw = project?.auditPeriods || notes?.auditPeriods || [];
  return Array.isArray(raw) ? raw.filter((p) => p?.id && p?.name) : [];
}

export function validateAuditPeriodInput(input: Pick<AuditPeriodInput, 'name' | 'type' | 'startDate' | 'endDate'>): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('Period name is required');
  if (!input.startDate) errors.push('Start date is required');
  if (!input.endDate) errors.push('End date is required');
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (Number.isNaN(start.getTime())) errors.push('Start date is invalid');
    if (Number.isNaN(end.getTime())) errors.push('End date is invalid');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      errors.push('End date must be on or after start date');
    }
  }
  return errors;
}

export function buildAuditPeriod(input: AuditPeriodInput): AuditPeriod {
  const now = new Date().toISOString();
  const startYear = input.startDate ? new Date(input.startDate).getFullYear() : undefined;
  return {
    id: `ap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    year: Number.isFinite(startYear) ? startYear : undefined,
    partnerId: input.partnerId || undefined,
    partnerName: input.partnerName || undefined,
    status: input.status || 'planned',
    deadline: input.deadline || undefined,
    taskIds: [],
    documentIds: [],
    amountWithoutVAT: input.amountWithoutVAT,
    sourceProjectId: input.sourceProjectId,
    createdBy: input.createdBy || 'system',
    createdAt: now,
    updatedAt: now,
  };
}

function getProjectTeam(project: any): any[] {
  const notes = parseNotes(project);
  const team = project?.team || notes?.team || [];
  return Array.isArray(team) ? team : [];
}

export function getProjectPartnerIdFromNotes(project: any): string | null {
  const partner = getProjectTeam(project).find((m: any) => m?.role === 'partner');
  return partner?.userId || partner?.id || null;
}

export function getEffectivePartnerId(project: any, auditPeriodId?: string | null): string | null {
  if (auditPeriodId) {
    const period = getAuditPeriods(project).find((p) => p.id === auditPeriodId);
    if (period?.partnerId) return period.partnerId;
  }
  return getProjectPartnerIdFromNotes(project);
}

export function cleanAuditProjectName(name: string): string {
  return String(name || '')
    .replace(/\s*\(\s*за\s+период\s+[^)]*\)\s*/giu, ' ')
    .replace(/\s*за\s+период\s+\d{4}\s*[-–]\s*\d{4}\s*/giu, ' ')
    .replace(/\s*за\s+период\s+\d{4}\s*/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCompanyKey(project: any): string {
  return String(project?.companyName || project?.company || project?.notes?.companyName || project?.notes?.ourCompany || '').trim().toLowerCase();
}

export interface AuditProjectGroup {
  key: string;
  displayName: string;
  canonical: any;
  duplicates: any[];
  periods: AuditPeriod[];
}

export function groupProjectsByAuditRoot(projects: any[]): AuditProjectGroup[] {
  const map = new Map<string, AuditProjectGroup>();
  for (const project of projects || []) {
    const displayName = cleanAuditProjectName(project?.name || project?.notes?.name || project?.clientName || '');
    const key = `${getCompanyKey(project)}__${displayName.toLowerCase()}`;
    const current = map.get(key);
    const existingPeriods = getAuditPeriods(project);
    if (!current) {
      map.set(key, {
        key,
        displayName,
        canonical: project,
        duplicates: [project],
        periods: existingPeriods,
      });
    } else {
      current.duplicates.push(project);
      current.periods.push(...existingPeriods);
    }
  }
  return Array.from(map.values());
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm.cmd run test:unit -- src/lib/auditPeriods.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auditPeriods.ts src/lib/auditPeriods.test.ts
git commit -m "feat(projects): add audit period helpers"
```

## Task 2: Add Audit Period Types To Project Model

**Files:**
- Modify: `src/types/project-v3.ts`

- [ ] **Step 1: Add compatibility types**

In `src/types/project-v3.ts`, import the helper type near the top:

```ts
import type { AuditPeriod } from '@/lib/auditPeriods';
```

Add this optional field to `ProjectV3` near `stages?: ProjectStage[]`:

```ts
  auditPeriods?: AuditPeriod[];
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm.cmd run typecheck
```

Expected: PASS or only pre-existing unrelated errors. If new import path errors appear, fix the import path.

- [ ] **Step 3: Commit**

```bash
git add src/types/project-v3.ts
git commit -m "feat(projects): type audit periods"
```

## Task 3: Build Audit Periods Editor

**Files:**
- Create: `src/components/projects/AuditPeriodsEditor.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/projects/AuditPeriodsEditor.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Plus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AUDIT_PERIOD_STATUS_LABELS,
  AUDIT_PERIOD_TYPE_LABELS,
  type AuditPeriod,
  type AuditPeriodType,
  buildAuditPeriod,
  validateAuditPeriodInput,
} from '@/lib/auditPeriods';

interface AuditPeriodsEditorProps {
  project: any;
  employees: any[];
  currentUserId?: string;
  canEdit: boolean;
  onSave: (periods: AuditPeriod[]) => Promise<void>;
}

const DEFAULT_TYPE: AuditPeriodType = 'year';

export function AuditPeriodsEditor({ project, employees, currentUserId, canEdit, onSave }: AuditPeriodsEditorProps) {
  const initialPeriods = useMemo(() => {
    const raw = project?.auditPeriods || project?.notes?.auditPeriods || [];
    return Array.isArray(raw) ? raw : [];
  }, [project]);

  const partners = useMemo(() => employees.filter((e: any) => e?.role === 'partner'), [employees]);
  const [periods, setPeriods] = useState<AuditPeriod[]>(initialPeriods);
  const [draft, setDraft] = useState({
    name: '',
    type: DEFAULT_TYPE,
    startDate: '',
    endDate: '',
    partnerId: '',
    deadline: '',
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addPeriod = async () => {
    const validation = validateAuditPeriodInput(draft);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    const partner = partners.find((p: any) => p.id === draft.partnerId);
    const next = [
      ...periods,
      buildAuditPeriod({
        ...draft,
        partnerId: draft.partnerId || undefined,
        partnerName: partner?.name || partner?.full_name,
        deadline: draft.deadline || undefined,
        createdBy: currentUserId,
      }),
    ];
    setBusy(true);
    try {
      await onSave(next);
      setPeriods(next);
      setDraft({ name: '', type: DEFAULT_TYPE, startDate: '', endDate: '', partnerId: '', deadline: '' });
      setErrors([]);
    } finally {
      setBusy(false);
    }
  };

  const updatePartner = async (periodId: string, partnerId: string) => {
    const partner = partners.find((p: any) => p.id === partnerId);
    const next = periods.map((period) =>
      period.id === periodId
        ? { ...period, partnerId, partnerName: partner?.name || partner?.full_name, updatedAt: new Date().toISOString() }
        : period,
    );
    setBusy(true);
    try {
      await onSave(next);
      setPeriods(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {periods.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">Периоды еще не добавлены.</Card>
        ) : (
          periods.map((period) => (
            <Card key={period.id} className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm">{period.name}</h3>
                    <Badge variant="outline">{AUDIT_PERIOD_TYPE_LABELS[period.type]}</Badge>
                    <Badge variant="secondary">{AUDIT_PERIOD_STATUS_LABELS[period.status]}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{period.startDate} - {period.endDate}</span>
                    {period.deadline && <span>Дедлайн: {period.deadline}</span>}
                  </div>
                </div>
                <div className="w-full md:w-64">
                  <Label className="text-xs">Партнер периода</Label>
                  <Select value={period.partnerId || ''} onValueChange={(value) => updatePartner(period.id, value)} disabled={!canEdit || busy}>
                    <SelectTrigger><SelectValue placeholder="Не назначен" /></SelectTrigger>
                    <SelectContent>
                      {partners.map((partner: any) => (
                        <SelectItem key={partner.id} value={partner.id}>{partner.name || partner.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {canEdit && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4" />Добавить период</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Название</Label>
              <Input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Например: 2024 год" />
            </div>
            <div>
              <Label className="text-xs">Тип</Label>
              <Select value={draft.type} onValueChange={(value) => setDraft((p) => ({ ...p, type: value as AuditPeriodType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="six_months">6 месяцев</SelectItem>
                  <SelectItem value="nine_months">9 месяцев</SelectItem>
                  <SelectItem value="year">Год</SelectItem>
                  <SelectItem value="custom">Произвольный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Партнер</Label>
              <Select value={draft.partnerId} onValueChange={(value) => setDraft((p) => ({ ...p, partnerId: value }))}>
                <SelectTrigger><SelectValue placeholder="Выберите партнера" /></SelectTrigger>
                <SelectContent>
                  {partners.map((partner: any) => (
                    <SelectItem key={partner.id} value={partner.id}>{partner.name || partner.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Начало</Label>
              <Input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Конец</Label>
              <Input type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Дедлайн</Label>
              <Input type="date" value={draft.deadline} onChange={(e) => setDraft((p) => ({ ...p, deadline: e.target.value }))} />
            </div>
          </div>
          {errors.length > 0 && <div className="text-xs text-red-600">{errors.join(', ')}</div>}
          <Button onClick={addPeriod} disabled={busy} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />Сохранить период
          </Button>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck and fix unused imports**

Run:

```bash
npm.cmd run typecheck
```

Expected: if TypeScript reports unused `UserRound`, remove it from the import.

- [ ] **Step 3: Commit**

```bash
git add src/components/projects/AuditPeriodsEditor.tsx
git commit -m "feat(projects): add audit periods editor"
```

## Task 4: Wire Periods Tab Into Project Workspace

**Files:**
- Modify: `src/pages/ProjectWorkspace.tsx`

- [ ] **Step 1: Import the editor**

Add near other project component imports:

```ts
import { AuditPeriodsEditor } from "@/components/projects/AuditPeriodsEditor";
import type { AuditPeriod } from "@/lib/auditPeriods";
```

- [ ] **Step 2: Add partner edit permission**

After existing role booleans, add:

```ts
  const canEditAuditPeriods = isPartner || isAdmin || isCEO || isDeputy;
```

- [ ] **Step 3: Add save handler**

Inside `ProjectWorkspace`, before the main return, add:

```ts
  const saveAuditPeriods = async (periods: AuditPeriod[]) => {
    if (!project?.id && !project?.notes?.id && !id) return;
    const projectId = project?.id || project?.notes?.id || id;
    await supabaseDataStore.updateProject(projectId, {
      ...project?.notes,
      auditPeriods: periods,
    });
    setProject((prev: any) => ({
      ...prev,
      auditPeriods: periods,
      notes: { ...(prev?.notes || {}), auditPeriods: periods },
    }));
    toast({ title: 'Периоды обновлены', description: 'Изменения сохранены внутри проекта.' });
  };
```

- [ ] **Step 4: Add tab trigger and content**

Near existing tab triggers at lines around `TabsTrigger value="dashboard"`, add:

```tsx
<TabsTrigger value="periods" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📆 Периоды</TabsTrigger>
```

Before the files tab content, add:

```tsx
<TabsContent value="periods" className="space-y-4 mt-4">
  <AuditPeriodsEditor
    project={project}
    employees={employees || []}
    currentUserId={user?.id}
    canEdit={canEditAuditPeriods}
    onSave={saveAuditPeriods}
  />
</TabsContent>
```

- [ ] **Step 5: Run build**

Run:

```bash
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectWorkspace.tsx
git commit -m "feat(projects): add periods tab"
```

## Task 5: Show One Summary Row For Duplicate-Like Projects

**Files:**
- Modify: `src/pages/Projects-simple.tsx`

- [ ] **Step 1: Import grouping helper**

Add:

```ts
import { groupProjectsByAuditRoot, getAuditPeriods } from "@/lib/auditPeriods";
```

- [ ] **Step 2: Create displayed projects after filtering**

After the filtering effect that sets `filteredProjects`, add:

```ts
  const displayedProjectGroups = useMemo(() => groupProjectsByAuditRoot(filteredProjects), [filteredProjects]);
  const displayedProjects = useMemo(() => displayedProjectGroups.map((group) => ({
    ...group.canonical,
    name: group.displayName || group.canonical.name,
    auditPeriods: group.periods,
    duplicateProjects: group.duplicates,
    duplicateCount: group.duplicates.length,
  })), [displayedProjectGroups]);
```

- [ ] **Step 3: Use displayed projects for the summary table only**

In the `Свод по проектам` table, change:

```tsx
{filteredProjects.map((project) => {
```

to:

```tsx
{displayedProjects.map((project) => {
```

Keep card/grid/CEO summary using `filteredProjects` for this first pass unless the user explicitly wants those views grouped too.

- [ ] **Step 4: Add period badge in the project name cell**

Inside the project-name cell, after the displayed project name, add:

```tsx
{(project.auditPeriods?.length > 0 || project.duplicateCount > 1) && (
  <Badge variant="outline" className="ml-2 text-[10px]">
    {(project.auditPeriods?.length || project.duplicateCount)} период(а)
  </Badge>
)}
```

- [ ] **Step 5: Add nested period rows**

Inside the table row block, directly after the main `<tr>...</tr>` for each project, render:

```tsx
{(project.auditPeriods || []).map((period: any) => (
  <tr key={`${project.id}-${period.id}`} className="bg-muted/20">
    <td />
    <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>
      {period.name} · {period.startDate} - {period.endDate}
    </td>
    <td className="px-3 py-2 text-xs">{period.partnerName || 'Партнер не назначен'}</td>
    <td className="px-3 py-2 text-xs">{period.status || 'planned'}</td>
    <td className="px-3 py-2 text-xs">{period.deadline || '—'}</td>
  </tr>
))}
```

Adjust `colSpan`/columns after inspecting the exact table structure so the row aligns cleanly.

- [ ] **Step 6: Run build**

Run:

```bash
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Projects-simple.tsx
git commit -m "feat(projects): group summary duplicate periods"
```

## Task 6: Period-Aware Partner Lookup

**Files:**
- Modify: `src/lib/projectTeam.ts`
- Modify: `src/lib/timesheets.ts`

- [ ] **Step 1: Re-export helper in project team**

In `src/lib/projectTeam.ts`, add:

```ts
export { getEffectivePartnerId } from '@/lib/auditPeriods';
```

- [ ] **Step 2: Update timesheet type for future period routing**

In `TimesheetEntry`, add:

```ts
  auditPeriodId?: string;
```

In `TimesheetEntryDraft`, add:

```ts
  auditPeriodId?: string;
```

Do not map this to Supabase columns until a migration exists. Keep it as an in-memory compatibility field for future UI work.

- [ ] **Step 3: Update partner helper import and function**

In `src/lib/timesheets.ts`, add:

```ts
import { getEffectivePartnerId } from '@/lib/auditPeriods';
```

Replace the body of `getProjectPartnerId(project: any)` with:

```ts
export function getProjectPartnerId(project: any, auditPeriodId?: string | null): string | null {
  return getEffectivePartnerId(project, auditPeriodId);
}
```

- [ ] **Step 4: Add test coverage if no circular import appears**

Add to `src/lib/auditPeriods.test.ts`:

```ts
it('falls back to null when no project or period partner exists', () => {
  expect(getEffectivePartnerId({ notes: { team: [] } }, 'missing')).toBeNull();
});
```

- [ ] **Step 5: Run unit tests and build**

Run:

```bash
npm.cmd run test:unit -- src/lib/auditPeriods.test.ts
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/projectTeam.ts src/lib/timesheets.ts src/lib/auditPeriods.test.ts
git commit -m "feat(timesheets): support period-aware partner lookup"
```

## Task 7: Verify UI In Browser

**Files:**
- No source files unless verification finds UI bugs.

- [ ] **Step 1: Start dev server**

Run:

```bash
npm.cmd run dev -- --host 127.0.0.1 --port 5174
```

Expected: Vite serves at `http://127.0.0.1:5174/`.

- [ ] **Step 2: Open project page**

Use the in-app Browser at:

```text
http://127.0.0.1:5174/projects
```

Expected: page loads, existing project list still renders.

- [ ] **Step 3: Open any project and test periods**

Open a project, go to `Периоды`, add `2024 год` with dates `2024-01-01` to `2024-12-31`, assign a partner, and save.

Expected: toast confirms save, the new period remains visible after refresh.

- [ ] **Step 4: Check summary table**

Return to `/projects`, open the `Свод` tab.

Expected: duplicate-like rows are grouped in the summary table, and rows with periods show a `период(а)` badge plus nested period rows.

- [ ] **Step 5: Commit any UI fixes**

If fixes are needed:

```bash
git add src/components/projects/AuditPeriodsEditor.tsx src/pages/ProjectWorkspace.tsx src/pages/Projects-simple.tsx
git commit -m "fix(projects): polish audit periods ui"
```

## Task 8: Final Verification

**Files:**
- No source files unless verification finds issues.

- [ ] **Step 1: Run focused tests**

```bash
npm.cmd run test:unit -- src/lib/auditPeriods.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full build**

```bash
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Check git status**

```bash
git status --short
```

Expected: only intentional changes or clean tree, ignoring pre-existing unrelated untracked files noted before implementation.

## Self-Review

- Spec coverage: periods are nested in one project, partners can add/edit periods, summary table can hide visual duplicates, and period-aware partner lookup is introduced without a DB migration.
- Gaps deferred by design: destructive duplicate cleanup and actual `timesheet_entries.audit_period_id` database migration are intentionally out of scope for this first implementation.
- Placeholder scan: no task uses `TBD`, `TODO`, or undefined future functions without providing their signatures.
- Type consistency: `AuditPeriod`, `AuditPeriodType`, `auditPeriods`, `partnerId`, and `getEffectivePartnerId` are named consistently across tasks.
