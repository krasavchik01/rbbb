import { isUserRole, USER_ROLES, type UserRole } from '@/types/roles';

export const PROJECT_VISIBILITY_SECTIONS = [
  {
    key: 'team',
    label: 'Команда',
    description: 'ФИО, роли и полный состав проекта.',
  },
  {
    key: 'hours',
    label: 'Таймшиты',
    description: 'Утверждённые часы и часы, которые ждут проверки.',
  },
  {
    key: 'contractMoney',
    label: 'Финансы договора',
    description: 'Сумма договора, расходы и грязный доход.',
  },
  {
    key: 'bonuses',
    label: 'Бонусы',
    description: 'Бонусный пул, точные суммы сотрудников и реестр выплат.',
  },
] as const;

export type ProjectVisibilitySection = (typeof PROJECT_VISIBILITY_SECTIONS)[number]['key'];

export type ProjectAccessControl = Record<ProjectVisibilitySection, UserRole[]>;

export const BONUS_VISIBILITY_ROLES: readonly UserRole[] = ['ceo', 'admin'];

export const DEFAULT_PROJECT_ACCESS_CONTROL: ProjectAccessControl = {
  team: [...USER_ROLES],
  hours: [...USER_ROLES],
  contractMoney: ['ceo', 'admin', 'deputy_director', 'procurement'],
  bonuses: ['ceo', 'admin'],
};

function normalizeRoles(
  value: unknown,
  fallback: UserRole[],
  allowedRoles: readonly UserRole[] = USER_ROLES,
): UserRole[] {
  if (!Array.isArray(value)) return [...fallback];
  const roles = value.filter((role): role is UserRole => (
    typeof role === 'string' && isUserRole(role) && allowedRoles.includes(role)
  ));
  return Array.from(new Set(roles));
}

export function normalizeProjectAccessControl(value: unknown): ProjectAccessControl {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<ProjectVisibilitySection, unknown>>
    : {};

  return {
    team: normalizeRoles(source.team, DEFAULT_PROJECT_ACCESS_CONTROL.team),
    hours: normalizeRoles(source.hours, DEFAULT_PROJECT_ACCESS_CONTROL.hours),
    contractMoney: normalizeRoles(
      source.contractMoney,
      DEFAULT_PROJECT_ACCESS_CONTROL.contractMoney,
    ),
    bonuses: normalizeRoles(
      source.bonuses,
      DEFAULT_PROJECT_ACCESS_CONTROL.bonuses,
      BONUS_VISIBILITY_ROLES,
    ),
  };
}

export function canRoleViewProjectSection(
  access: ProjectAccessControl | null | undefined,
  role: string | null | undefined,
  section: ProjectVisibilitySection,
): boolean {
  if (!isUserRole(role)) return false;
  if (section === 'bonuses' && !BONUS_VISIBILITY_ROLES.includes(role)) return false;
  const normalized = normalizeProjectAccessControl(access);
  return normalized[section].includes(role);
}

export function setProjectRoleVisibility(
  access: ProjectAccessControl,
  role: UserRole,
  section: ProjectVisibilitySection,
  visible: boolean,
): ProjectAccessControl {
  const normalized = normalizeProjectAccessControl(access);
  if (section === 'bonuses' && !BONUS_VISIBILITY_ROLES.includes(role)) return normalized;
  const roles = normalized[section];
  return {
    ...normalized,
    [section]: visible
      ? Array.from(new Set([...roles, role]))
      : roles.filter((item) => item !== role),
  };
}
