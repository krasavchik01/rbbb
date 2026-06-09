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

export interface AuditProjectGroup {
  key: string;
  displayName: string;
  canonical: any;
  duplicates: any[];
  periods: AuditPeriod[];
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
  return Array.isArray(raw) ? raw.filter((period) => period?.id && period?.name) : [];
}

export function validateAuditPeriodInput(
  input: Pick<AuditPeriodInput, 'name' | 'type' | 'startDate' | 'endDate'>,
): string[] {
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
  const partner = getProjectTeam(project).find((member: any) => member?.role === 'partner');
  return partner?.userId || partner?.id || null;
}

export function getEffectivePartnerId(project: any, auditPeriodId?: string | null): string | null {
  if (auditPeriodId) {
    const period = getAuditPeriods(project).find((candidate) => candidate.id === auditPeriodId);
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
  return String(
    project?.companyName ||
      project?.company ||
      project?.notes?.companyName ||
      project?.notes?.ourCompany ||
      '',
  )
    .trim()
    .toLowerCase();
}

export function groupProjectsByAuditRoot(projects: any[]): AuditProjectGroup[] {
  const map = new Map<string, AuditProjectGroup>();

  for (const project of projects || []) {
    const displayName = cleanAuditProjectName(
      project?.name || project?.notes?.name || project?.clientName || '',
    );
    const key = `${getCompanyKey(project)}__${displayName.toLowerCase()}`;
    const existingPeriods = getAuditPeriods(project);
    const current = map.get(key);

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
