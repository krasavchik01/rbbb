import { getProjectNotes } from '@/lib/projectNotes';
import type {
  CanonicalProjectNotes,
  CanonicalTeamMember,
  TeamBonusDraft,
} from '@/types/project-domain';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function canonicalTeamMemberId(member: any): string {
  return text(member?.userId || member?.employeeId || member?.id);
}

export function canonicalTeamMemberRole(member: any): string {
  return text(member?.role || member?.projectRole || member?.slotKey || 'employee').toLowerCase();
}

function canonicalTeamMemberName(member: any): string {
  return text(member?.userName || member?.employeeName || member?.name);
}

export function dedupeCanonicalTeamMembers(teams: any[][]): CanonicalTeamMember[] {
  const seen = new Set<string>();
  const result: CanonicalTeamMember[] = [];

  for (const team of teams) {
    for (const member of Array.isArray(team) ? team : []) {
      if (!member || typeof member !== 'object') continue;
      const id = canonicalTeamMemberId(member);
      const name = canonicalTeamMemberName(member);
      const role = canonicalTeamMemberRole(member);
      if (!id && !name) continue;
      const key = `${(id || name).toLowerCase()}::${role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...member } as CanonicalTeamMember);
    }
  }

  return result;
}

export function hasCanonicalProjectTeam(project: any): boolean {
  const notes = getProjectNotes(project);
  return notes.teamSource === 'canonical' || Boolean(notes.teamUnifiedAt);
}

export function isSettledBonus(bonus: TeamBonusDraft | undefined): boolean {
  if (!bonus) return false;
  const status = text((bonus as any).paymentStatus || (bonus as any).status).toLowerCase();
  return Boolean(bonus.paidAt)
    || Boolean(bonus.paidByName)
    || Boolean((bonus as any).approvedAt)
    || Boolean((bonus as any).paymentApprovedAt)
    || Boolean((bonus as any).paymentId)
    || Boolean((bonus as any).registryId)
    || Boolean((bonus as any).bonusPaymentId)
    || Boolean((bonus as any).paymentRegistryId)
    || (bonus as any).paid === true
    || ['approved', 'paid', 'payment_approved'].includes(status);
}

export function isProtectedDetachedBonus(bonus: TeamBonusDraft | undefined): boolean {
  return bonus?.manuallyAdjusted === true || isSettledBonus(bonus);
}

/**
 * Until a legacy project is edited in the unified UI, its visible team is the
 * union of the common team and archived audit-period teams. Once the canonical
 * marker is saved, notes.team becomes the only editable source of truth while
 * auditPeriods remain untouched as a frozen archive.
 */
export function effectiveProjectTeam(project: any): CanonicalTeamMember[] {
  const notes = getProjectNotes(project);
  const notesTeam = Array.isArray(notes.team) ? notes.team : [];
  const directTeam = Array.isArray(project?.team) ? project.team : [];
  if (hasCanonicalProjectTeam(project)) {
    // The persisted marker makes notes.team authoritative. This also protects
    // recalculation callers that accidentally pass an archived coverage union
    // through the transient top-level `team` field.
    return dedupeCanonicalTeamMembers([
      Array.isArray(notes.team) ? notesTeam : directTeam,
    ]);
  }

  const commonTeam = dedupeCanonicalTeamMembers([notesTeam, directTeam]);
  const archivedTeams = (Array.isArray(notes.auditPeriods) ? notes.auditPeriods : [])
    .map((period: any) => (
      period && typeof period === 'object' && Array.isArray(period.team)
        ? period.team
        : []
    ));

  return dedupeCanonicalTeamMembers([
    commonTeam,
    ...archivedTeams,
  ]);
}

/**
 * Includes bonus-only legacy employees so recalculation cannot silently delete
 * their manual amounts before the payment registry has been reconciled.
 */
export function financeParticipants(project: any): CanonicalTeamMember[] {
  const notes = getProjectNotes(project);
  const team = effectiveProjectTeam(project);
  const finances = {
    ...(notes.finances || {}),
    ...(project?.finances || {}),
    teamBonuses: {
      ...(notes.finances?.teamBonuses || {}),
      ...(project?.finances?.teamBonuses || {}),
    },
  };
  const teamBonuses = (
    finances?.teamBonuses && typeof finances.teamBonuses === 'object'
      ? finances.teamBonuses
      : {}
  ) as Record<string, TeamBonusDraft>;
  const knownIds = new Set(team.map(canonicalTeamMemberId).filter(Boolean));
  const bonusOnlyMembers = Object.entries(teamBonuses)
    .filter(([employeeId, bonus]) => (
      employeeId
      && !knownIds.has(employeeId)
      && isProtectedDetachedBonus(bonus)
    ))
    .map(([employeeId, bonus]) => ({
      userId: employeeId,
      userName: text((bonus as any)?.employeeName) || 'Сотрудник из сохранённого расчёта',
      role: text(bonus?.role) || 'employee',
      bonusPercent: Number(bonus?.percent || 0),
      legacyBonusOnly: true,
    } as CanonicalTeamMember));

  return dedupeCanonicalTeamMembers([team, bonusOnlyMembers]);
}

export function canonicalTeamMarkerPatch(
  project: any,
  nextTeam: CanonicalTeamMember[],
  changedAt = new Date().toISOString(),
): Partial<CanonicalProjectNotes> {
  const notes = getProjectNotes(project);
  return {
    team: dedupeCanonicalTeamMembers([nextTeam]),
    teamSource: 'canonical',
    teamUnifiedAt: notes.teamUnifiedAt || changedAt,
  };
}

export function projectForFinanceCalculation(project: any): any {
  const notes = getProjectNotes(project);
  const team = financeParticipants(project);
  return {
    ...project,
    team,
    notes: {
      ...notes,
      team,
    },
  };
}
