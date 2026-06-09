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

function getProjectName(project: any): string {
  return String(project?.name || project?.notes?.name || project?.clientName || '');
}

function getProjectDeadline(project: any): string | undefined {
  return (
    project?.contract?.serviceEndDate ||
    project?.notes?.contract?.serviceEndDate ||
    project?.deadline ||
    project?.due_date ||
    project?.notes?.deadline ||
    undefined
  );
}

function getProjectStartDate(project: any): string | undefined {
  return (
    project?.contract?.serviceStartDate ||
    project?.notes?.contract?.serviceStartDate ||
    project?.start_date ||
    project?.notes?.startDate ||
    undefined
  );
}

function getProjectStatus(project: any): AuditPeriodStatus {
  const raw = String(project?.notes?.status || project?.status || '').toLowerCase();
  if (raw.includes('completed') || raw.includes('closed')) return 'completed';
  if (raw.includes('ready')) return 'ready_for_review';
  if (raw.includes('progress') || raw.includes('active') || raw.includes('работ')) return 'in_progress';
  return 'planned';
}

function getProjectPartner(project: any): { id?: string; name?: string } {
  const partner = getProjectTeam(project).find((member: any) => member?.role === 'partner');
  return {
    id: partner?.userId || partner?.id,
    name: partner?.userName || partner?.name || partner?.employee?.name,
  };
}

export function extractAuditPeriodLabel(projectOrName: any): string {
  const name = typeof projectOrName === 'string' ? projectOrName : getProjectName(projectOrName);
  const range = name.match(/(\d{4})\s*[-–]\s*(\d{4})/u);
  if (range) return `${range[1]}-${range[2]}`;

  const singleYear = name.match(/\b(20\d{2})\b/u);
  if (singleYear) return singleYear[1];

  if (/6\s*(мес|m|month)/iu.test(name)) return '6 месяцев';
  if (/9\s*(мес|m|month)/iu.test(name)) return '9 месяцев';

  const notesPeriod = typeof projectOrName === 'object' ? projectOrName?.notes?.period : undefined;
  if (notesPeriod === '6m') return '6 месяцев';
  if (notesPeriod === '9m') return '9 месяцев';
  if (notesPeriod === '1y') return 'Год';

  return 'Период';
}

function inferPeriodType(label: string): AuditPeriodType {
  const lower = label.toLowerCase();
  if (lower.includes('6')) return 'six_months';
  if (lower.includes('9')) return 'nine_months';
  if (/^\d{4}$/.test(label) || /^\d{4}[-–]\d{4}$/.test(label)) return 'year';
  return 'custom';
}

function inferPeriodDates(project: any, label: string): { startDate: string; endDate: string; year?: number } {
  const range = label.match(/^(\d{4})[-–](\d{4})$/u);
  if (range) {
    return {
      startDate: `${range[1]}-01-01`,
      endDate: `${range[2]}-12-31`,
      year: Number(range[1]),
    };
  }

  const yearOnly = label.match(/^(20\d{2})$/u);
  if (yearOnly) {
    return {
      startDate: `${yearOnly[1]}-01-01`,
      endDate: `${yearOnly[1]}-12-31`,
      year: Number(yearOnly[1]),
    };
  }

  const fallbackStart = getProjectStartDate(project) || '';
  const fallbackEnd = getProjectDeadline(project) || fallbackStart;
  const year = fallbackStart ? new Date(fallbackStart).getFullYear() : undefined;
  return {
    startDate: fallbackStart,
    endDate: fallbackEnd || '',
    year: Number.isFinite(year) ? year : undefined,
  };
}

export function projectToAuditPeriod(project: any, index = 0): AuditPeriod {
  const label = extractAuditPeriodLabel(project);
  const partner = getProjectPartner(project);
  const dates = inferPeriodDates(project, label);
  const now = project?.updated_at || project?.created_at || new Date().toISOString();
  const sourceProjectId = project?.id || project?.notes?.id || `project_${index}`;

  return {
    id: `source_${sourceProjectId}`,
    name: label,
    type: inferPeriodType(label),
    startDate: dates.startDate,
    endDate: dates.endDate,
    year: dates.year,
    partnerId: partner.id,
    partnerName: partner.name,
    status: getProjectStatus(project),
    deadline: getProjectDeadline(project),
    taskIds: [],
    documentIds: [],
    sourceProjectId,
    createdBy: project?.createdBy || project?.notes?.createdBy || 'system',
    createdAt: project?.created_at || now,
    updatedAt: now,
  };
}

export function getDisplayAuditPeriods(group: AuditProjectGroup): AuditPeriod[] {
  const explicit = group.periods || [];
  const synthetic = (group.duplicates || []).map((project, index) => projectToAuditPeriod(project, index));
  const byId = new Map<string, AuditPeriod>();

  for (const period of [...explicit, ...synthetic]) {
    byId.set(period.id, period);
  }

  return Array.from(byId.values());
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
