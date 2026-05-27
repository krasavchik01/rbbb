/**
 * Утилиты для работы с командой проекта (notes.team[]).
 *
 * Команда живёт в notes (JSON-блоб). Партнёр определяется как участник
 * с role='partner'. Используется в:
 *   - ProjectVitals (отображение)
 *   - getProjectPartnerId (для timesheets/approval)
 *   - AssignPartners (массовое назначение)
 *
 * Структура TeamMember (как сохраняет ProjectApproval):
 *   { userId, userName, role, bonusPercent, assignedAt, assignedBy }
 */

import { PROJECT_ROLES } from '@/types/roles';

export interface TeamMember {
  userId: string;
  userName: string;
  role: string;
  bonusPercent: number;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Извлекает team[] из проекта (с фронтового вида или из raw notes).
 */
export function getProjectTeam(project: any): TeamMember[] {
  if (!project) return [];
  if (Array.isArray(project.team)) return project.team;
  const raw = project.notes;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.team) ? parsed.team : [];
    } catch {
      return [];
    }
  }
  if (raw && Array.isArray(raw.team)) return raw.team;
  return [];
}

/**
 * Найти партнёра в команде (один, не больше).
 */
export function findPartner(team: TeamMember[]): TeamMember | null {
  return team.find((m) => m?.role === 'partner') || null;
}

/**
 * Заменить или добавить партнёра в team[]. Возвращает новый массив.
 *
 * Логика:
 *   - если в team уже есть партнёр — заменяем его (один проект = один партнёр);
 *   - если нет — добавляем; bonusPercent берётся из роли (25% по умолчанию).
 */
export function withPartnerSet(
  team: TeamMember[],
  partnerId: string,
  partnerName: string,
  by: string,
): TeamMember[] {
  const partnerRoleSpec = PROJECT_ROLES.find((r) => r.role === 'partner');
  const newPartner: TeamMember = {
    userId: partnerId,
    userName: partnerName,
    role: 'partner',
    bonusPercent: partnerRoleSpec?.bonusPercent ?? 25,
    assignedAt: new Date().toISOString(),
    assignedBy: by,
  };
  const without = team.filter((m) => m?.role !== 'partner');
  return [...without, newPartner];
}

/**
 * Удалить партнёра из team[]. Возвращает новый массив.
 */
export function withPartnerRemoved(team: TeamMember[]): TeamMember[] {
  return team.filter((m) => m?.role !== 'partner');
}
