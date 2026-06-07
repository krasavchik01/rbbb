type AnyRecord = Record<string, any>;

export type DashboardMetricsInput = {
  user?: AnyRecord | null;
  projects?: AnyRecord[];
  employees?: AnyRecord[];
  tasks?: AnyRecord[];
  attendance?: AnyRecord[];
  timesheets?: AnyRecord[];
  today?: string;
};

export type DashboardMetrics = ReturnType<typeof buildDashboardMetrics>;

const ROLE_LABELS: Record<string, string> = {
  partner: 'Партнёры',
  manager: 'Менеджеры',
  manager_1: 'Менеджеры',
  manager_2: 'Менеджеры',
  manager_3: 'Менеджеры',
  senior_auditor: 'Старшие аудиторы',
  assistant: 'Ассистенты',
  assistant_1: 'Ассистенты',
  assistant_2: 'Ассистенты',
  assistant_3: 'Ассистенты',
  tax_specialist: 'Налоговики',
  hr: 'HR',
  procurement: 'Закупки',
  admin: 'Админы',
  admin_staff: 'Админы',
  ceo: 'CEO',
  deputy_director: 'Зам. директора',
};

function parseNotes(project: AnyRecord): AnyRecord {
  const notes = project?.notes;
  if (!notes) return {};
  if (typeof notes === 'object') return notes;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function yyyyMmDd(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function projectStatus(project: AnyRecord): string {
  return String(project?.status || parseNotes(project)?.status || '').toLowerCase();
}

function notesStatus(project: AnyRecord): string {
  return String(parseNotes(project)?.status || '').toLowerCase();
}

function projectTeam(project: AnyRecord): AnyRecord[] {
  const notes = parseNotes(project);
  const team = project?.team || notes?.team || [];
  return Array.isArray(team) ? team : [];
}

function isCompleted(project: AnyRecord): boolean {
  const status = projectStatus(project);
  return ['completed', 'closed', 'завершён', 'завершен'].includes(status);
}

function isPendingApproval(project: AnyRecord): boolean {
  if (isCompleted(project)) return false;
  const ns = notesStatus(project);
  return ns === 'new' || ns === 'pending_approval' || ns === 'pending';
}

function isWithoutTeam(project: AnyRecord): boolean {
  if (isCompleted(project) || isPendingApproval(project)) return false;
  const ns = notesStatus(project);
  const status = projectStatus(project);
  if (ns && !['approved', 'active', 'in_progress'].includes(ns)) return false;
  return ['approved', 'active', 'in_progress', ''].includes(status) && projectTeam(project).length === 0;
}

function deadlineOf(project: AnyRecord): string | null {
  const notes = parseNotes(project);
  return project?.contract?.serviceEndDate || project?.deadline || notes?.contract?.serviceEndDate || notes?.deadline || null;
}

function isActiveWork(project: AnyRecord): boolean {
  if (isCompleted(project) || isPendingApproval(project) || isWithoutTeam(project)) return false;
  const status = projectStatus(project);
  const ns = notesStatus(project);
  return ['in_progress', 'active', 'в работе', 'активный'].includes(status) || ['in_progress', 'active'].includes(ns);
}

function isOverdue(project: AnyRecord, today: string): boolean {
  if (isCompleted(project)) return false;
  const deadline = yyyyMmDd(deadlineOf(project));
  return !!deadline && deadline < today;
}

function attendanceEmployeeId(row: AnyRecord): string | null {
  return row?.employeeId || row?.employee_id || row?.userId || row?.user_id || null;
}

function attendanceKind(row: AnyRecord): 'office' | 'remote' | 'other' {
  const raw = String(row?.status || row?.location_type || '').toLowerCase();
  if (raw.includes('office') || raw.includes('офис') || raw === 'in_office') return 'office';
  if (raw.includes('remote') || raw.includes('удален') || raw.includes('удалён')) return 'remote';
  return 'other';
}

function employeeId(employee: AnyRecord): string | null {
  return employee?.id || employee?.user_id || employee?.userId || null;
}

function teamMemberId(member: AnyRecord): string | null {
  return member?.userId || member?.user_id || member?.employeeId || member?.employee_id || member?.employee?.id || member?.id || null;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role || 'Без роли';
}

export function buildDashboardMetrics(input: DashboardMetricsInput) {
  const projects = input.projects || [];
  const employees = input.employees || [];
  const tasks = input.tasks || [];
  const timesheets = input.timesheets || [];
  const today = input.today || new Date().toISOString().slice(0, 10);

  const activeProjects = projects.filter(isActiveWork);
  const pendingApproval = projects.filter(isPendingApproval);
  const withoutTeam = projects.filter(isWithoutTeam);
  const overdueProjects = projects.filter((p) => isOverdue(p, today));
  const blockedTasks = tasks.filter((t) => String(t?.status || '').toLowerCase() === 'blocked');

  const todayAttendanceRows = (input.attendance || []).filter((row) => yyyyMmDd(row?.rawDate || row?.date || row?.created_at) === today);
  const checkedInIds = new Set(todayAttendanceRows.map(attendanceEmployeeId).filter(Boolean));
  const inOffice = todayAttendanceRows.filter((row) => attendanceKind(row) === 'office').length;
  const remote = todayAttendanceRows.filter((row) => attendanceKind(row) === 'remote').length;

  const submittedRows = timesheets.filter((row) => String(row?.status || '').toLowerCase() === 'submitted');
  const approvedRows = timesheets.filter((row) => String(row?.status || '').toLowerCase() === 'approved');
  const rejectedRows = timesheets.filter((row) => String(row?.status || '').toLowerCase() === 'rejected');
  const submittedProjectIds = new Set(submittedRows.map((row) => row?.project_id || row?.projectId).filter(Boolean));

  const assignedToActive = new Map<string, number>();
  for (const project of activeProjects) {
    for (const member of projectTeam(project)) {
      const id = teamMemberId(member);
      if (!id) continue;
      assignedToActive.set(id, (assignedToActive.get(id) || 0) + 1);
    }
  }

  const byRole = new Map<string, { role: string; label: string; total: number; checkedInToday: number; assignedToActiveProjects: number }>();
  for (const employee of employees) {
    const role = String(employee?.role || 'unknown');
    const id = employeeId(employee);
    const cur = byRole.get(role) || { role, label: roleLabel(role), total: 0, checkedInToday: 0, assignedToActiveProjects: 0 };
    cur.total += 1;
    if (id && checkedInIds.has(id)) cur.checkedInToday += 1;
    if (id) cur.assignedToActiveProjects += assignedToActive.get(id) || 0;
    byRole.set(role, cur);
  }

  const submittedHours = submittedRows.reduce((sum, row) => sum + safeNumber(row?.hours), 0);
  const approvedHours = approvedRows.reduce((sum, row) => sum + safeNumber(row?.hours), 0);
  const rejectedHours = rejectedRows.reduce((sum, row) => sum + safeNumber(row?.hours), 0);

  const actions = {
    projectApprovals: pendingApproval.length,
    projectsWithoutTeam: withoutTeam.length,
    pendingTimesheetRows: submittedRows.length,
    overdueProjects: overdueProjects.length,
    blockedTasks: blockedTasks.length,
    total: pendingApproval.length + withoutTeam.length + submittedRows.length + overdueProjects.length + blockedTasks.length,
  };

  return {
    actions,
    projects: {
      total: projects.length,
      active: activeProjects.length,
      completed: projects.filter(isCompleted).length,
      pendingApproval: pendingApproval.length,
      withoutTeam: withoutTeam.length,
      overdue: overdueProjects.length,
    },
    attendanceToday: {
      totalEmployees: employees.length,
      checkedIn: checkedInIds.size,
      inOffice,
      remote,
      missing: Math.max(0, employees.length - checkedInIds.size),
    },
    timesheets: {
      submittedRows: submittedRows.length,
      submittedHours,
      approvedRows: approvedRows.length,
      approvedHours,
      rejectedRows: rejectedRows.length,
      rejectedHours,
      projectsWithSubmittedHours: submittedProjectIds.size,
    },
    teamByRole: Array.from(byRole.values()),
  };
}
