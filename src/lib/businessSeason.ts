export const BUSINESS_SEASON_NO_DATE = 'no_date' as const;

export type BusinessSeasonValue = `season:${number}` | typeof BUSINESS_SEASON_NO_DATE;

export type ProjectBusinessSeasonDates = {
  deadline?: unknown;
  endDate?: unknown;
  startDate?: unknown;
};

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function projectNotes(project: any): Record<string, any> {
  if (project?.notes && typeof project.notes === 'object') return project.notes;
  if (typeof project?.notes !== 'string' || !project.notes.trim()) return {};
  try {
    const parsed = JSON.parse(project.notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Reads only explicit operational dates; created/updated timestamps and audit periods are excluded. */
export function projectBusinessSeasonDates(project: any): ProjectBusinessSeasonDates {
  const notes = projectNotes(project);
  const contract = project?.contract && typeof project.contract === 'object' ? project.contract : {};
  const noteContract = notes?.contract && typeof notes.contract === 'object' ? notes.contract : {};

  return {
    deadline: firstText(
      contract.serviceEndDate,
      noteContract.serviceEndDate,
      contract.endDate,
      noteContract.endDate,
      project?.deadline,
      project?.due_date,
      project?.end_date,
      project?.endDate,
      notes.deadline,
      notes.dueDate,
      notes.serviceTerm,
      notes.endDate,
      notes.end_date,
    ),
    startDate: firstText(
      contract.serviceStartDate,
      noteContract.serviceStartDate,
      contract.startDate,
      noteContract.startDate,
      project?.startDate,
      project?.start_date,
      notes.startDate,
      notes.start_date,
    ),
  };
}

function parseCalendarDate(value: unknown): Date | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const ruMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : ruMatch
      ? new Date(Number(ruMatch[3]), Number(ruMatch[2]) - 1, Number(ruMatch[1]))
      : new Date(text);

  return Number.isFinite(date.getTime()) ? date : null;
}

export function businessSeasonEndYear(value: unknown): number | null {
  const date = parseCalendarDate(value);
  if (!date) return null;
  return date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
}

/**
 * Assigns exactly one operational business season to a project.
 * Project deadline/end date wins; the start date is used only as a fallback.
 * Historical audit periods are intentionally outside this contract.
 */
export function projectBusinessSeasonValue(dates: ProjectBusinessSeasonDates): BusinessSeasonValue {
  for (const value of [dates.deadline, dates.endDate, dates.startDate]) {
    const year = businessSeasonEndYear(value);
    if (year !== null) return `season:${year}`;
  }
  return BUSINESS_SEASON_NO_DATE;
}

export function projectBusinessSeasonValueFromProject(project: any): BusinessSeasonValue {
  return projectBusinessSeasonValue(projectBusinessSeasonDates(project));
}

export function countProjectBusinessSeasons<T>(
  rows: readonly T[],
  selectDates: (row: T) => ProjectBusinessSeasonDates,
): Map<BusinessSeasonValue, number> {
  const counts = new Map<BusinessSeasonValue, number>();
  for (const row of rows) {
    const season = projectBusinessSeasonValue(selectDates(row));
    counts.set(season, (counts.get(season) || 0) + 1);
  }
  return counts;
}
