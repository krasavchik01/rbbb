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

import { PROJECT_ROLES, normalizeUserRole } from '@/types/roles';
import { supabaseDataStore } from '@/lib/supabaseDataStore';
export { getEffectivePartnerId } from '@/lib/auditPeriods';

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

/**
 * Авто-добавление в команду проекта при апруве партнёром его часов.
 *
 * Сценарий: ассистент пишет в /timesheets часы по проекту X. Партнёр
 * проекта X получает их в /timesheet-approval, утверждает. Раньше после
 * этого ассистент ОФИЦИАЛЬНО в команде не значился — его не было в
 * notes.team[], и бонусы по нему не считались.
 *
 * Теперь: при апруве — добавляем сотрудника в notes.team[] проекта
 * с ролью из normalizeUserRole(employee.role, employee.level) и
 * bonusPercent из PROJECT_ROLES. Если он уже там — пропускаем (никого
 * не вытесняем). Partner-роль НЕ перезаписываем (она устанавливается
 * через /assign-partners).
 *
 * @param entries — апрувленные строки {employeeId, projectId}. Дубли ОК.
 * @param employees — список сотрудников из useEmployees (role/level там).
 * @param approverId — кто апрувил (для assignedBy)
 * @returns счёт сколько новых членов команды добавлено
 */
export async function addApprovedEntriesToProjectTeams(
  entries: Array<{ employeeId: string; projectId: string | null }>,
  employees: Array<{ id: string; name?: string; role?: string; level?: string }>,
  approverId: string,
): Promise<{ added: number; affectedProjects: number }> {
  // Уникальные пары employee × project (нам не интересны дубли в апруве).
  const pairs = new Set<string>();
  const validPairs: Array<{ employeeId: string; projectId: string }> = [];
  for (const e of entries) {
    if (!e.projectId || !e.employeeId) continue;
    const key = `${e.projectId}|${e.employeeId}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    validPairs.push({ employeeId: e.employeeId, projectId: e.projectId });
  }
  if (validPairs.length === 0) return { added: 0, affectedProjects: 0 };

  // Группируем по проекту
  const byProject = new Map<string, string[]>();
  for (const p of validPairs) {
    const arr = byProject.get(p.projectId) || [];
    arr.push(p.employeeId);
    byProject.set(p.projectId, arr);
  }

  const empById = new Map(employees.map((e) => [e.id, e]));
  let added = 0;
  let affectedProjects = 0;

  for (const [projectId, employeeIds] of byProject) {
    const project = await supabaseDataStore.getProject(projectId);
    if (!project) continue;
    const currentTeam = getProjectTeam(project);
    const currentMemberIds = new Set(currentTeam.map((m) => m.userId));
    const toAdd: TeamMember[] = [];
    for (const empId of employeeIds) {
      if (currentMemberIds.has(empId)) continue; // уже в команде
      const emp = empById.get(empId);
      if (!emp || !emp.role) continue;
      const projectRole = normalizeUserRole(emp.role, emp.level);
      if (projectRole === 'partner') continue; // partner ставится через /assign-partners
      const spec = PROJECT_ROLES.find((r) => r.role === projectRole);
      toAdd.push({
        userId: empId,
        userName: emp.name || empId,
        role: projectRole,
        bonusPercent: spec?.bonusPercent ?? 0,
        assignedAt: new Date().toISOString(),
        assignedBy: approverId,
      });
    }
    if (toAdd.length === 0) continue;
    const newTeam = [...currentTeam, ...toAdd];
    try {
      await supabaseDataStore.updateProject(projectId, { team: newTeam });
      added += toAdd.length;
      affectedProjects += 1;
    } catch (err) {
      console.error('[addApprovedEntriesToProjectTeams] failed for', projectId, err);
    }
  }
  return { added, affectedProjects };
}
