import { normalizeProjectName } from './timesheetImport';

export type TimesheetUiStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export const ADMIN_WORK_LABEL = 'Административная работа';

export interface TimesheetUiProjectLike {
  name?: string | null;
  title?: string | null;
}

export interface TimesheetUiEntryLike {
  id: string;
  employeeId: string;
  projectId?: string | null;
  projectName?: string | null;
  date: string;
  hours?: number | null;
  status?: TimesheetUiStatus | string;
}

export interface TimesheetDraftKey {
  employeeId: string;
  projectId?: string | null;
  projectName?: string | null;
  date: string;
}

export function projectDisplayName(project: TimesheetUiProjectLike | null | undefined): string {
  const name = typeof project?.name === 'string' ? project.name.trim() : '';
  if (name) return name;
  const title = typeof project?.title === 'string' ? project.title.trim() : '';
  return title;
}

/**
 * Показывает имя проекта из справочника, если он уже загружен, иначе сохраняет
 * snapshot `project_name` из самой строки таймщита. Это важно для импортов:
 * при первом рендере список projects ещё может быть пустым, но сотрудник всё
 * равно должен видеть название проекта из загруженного файла, а не «Без проекта».
 */
export function resolveTimesheetProjectName(
  entryProjectName: string | null | undefined,
  project: TimesheetUiProjectLike | null | undefined,
): string {
  const fromProject = projectDisplayName(project);
  if (fromProject) return fromProject;
  const fromEntry = typeof entryProjectName === 'string' ? entryProjectName.trim() : '';
  if (fromEntry) return fromEntry;
  return ADMIN_WORK_LABEL;
}

function projectBucket(projectId?: string | null, projectName?: string | null): string {
  if (projectId) return `id:${projectId}`;
  const normalizedName = normalizeProjectName(projectName || '');
  if (normalizedName) return `name:${normalizedName}`;
  return 'admin';
}

/**
 * Ищет уже существующие часы по той же паре сотрудник × дата × проект.
 * Блокируем создание дубля, потому что типовой пользовательский сценарий:
 * импорт уже добавил 8 часов, сотрудник не увидел/не понял проект и нажал
 * «Добавить» ещё раз — в календаре стало 16 часов вместо 8.
 */
export function findBlockingTimesheetDuplicates(
  entries: TimesheetUiEntryLike[],
  draft: TimesheetDraftKey,
  excludeId?: string | null,
): TimesheetUiEntryLike[] {
  const bucket = projectBucket(draft.projectId, draft.projectName);
  return entries.filter((entry) => {
    if (excludeId && entry.id === excludeId) return false;
    if (entry.employeeId !== draft.employeeId) return false;
    if (entry.date !== draft.date) return false;
    if (entry.status === 'rejected') return false;
    return projectBucket(entry.projectId, entry.projectName) === bucket;
  });
}
