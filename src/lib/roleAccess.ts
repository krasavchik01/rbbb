import { USER_ROLES, type UserRole } from '@/types/roles';

export const ROLE_GROUPS = {
  all: USER_ROLES,
  admin: ['admin'],
  executive: ['ceo', 'admin'],
  management: ['ceo', 'deputy_director', 'admin'],
  hrManagement: ['hr', 'ceo', 'deputy_director', 'admin'],
  procurement: ['procurement'],
  procurementAdmin: ['procurement', 'admin'],
  ai: ['ceo', 'deputy_director', 'admin', 'partner', 'hr'],
} satisfies Record<string, readonly UserRole[]>;

export const ROUTE_ACCESS = {
  '/projects': ROLE_GROUPS.all,
  '/timesheets': ROLE_GROUPS.all,
  '/attendance': ROLE_GROUPS.all,
  '/notifications': ROLE_GROUPS.all,
  '/hr': ROLE_GROUPS.hrManagement,
  '/employees': ROLE_GROUPS.hrManagement,
  '/analytics': ROLE_GROUPS.executive,
  '/assign-partners': ROLE_GROUPS.management,
  '/bonuses': ROLE_GROUPS.executive,
  '/settings': ROLE_GROUPS.all,
  '/user-management': ROLE_GROUPS.admin,
  '/create-project-procurement': ROLE_GROUPS.procurementAdmin,
  '/project-approval': ROLE_GROUPS.management,
  '/tenders': ROLE_GROUPS.procurement,
  '/diagnostics': ROLE_GROUPS.admin,
  '/database-test': ROLE_GROUPS.admin,
  '/smtp-settings': ROLE_GROUPS.admin,
  '/role-management': ROLE_GROUPS.admin,
  '/settings-diagnostics': ROLE_GROUPS.admin,
  '/ai': ROLE_GROUPS.ai,
} satisfies Record<string, readonly UserRole[]>;

export function roleCanAccessRoute(role: UserRole, path: keyof typeof ROUTE_ACCESS): boolean {
  return ROUTE_ACCESS[path].includes(role);
}
