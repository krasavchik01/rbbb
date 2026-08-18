import { USER_ROLES, type UserRole } from '@/types/roles';

export const ROLE_GROUPS = {
  all: USER_ROLES,
  operational: USER_ROLES.filter((role) => role !== 'accountant'),
  admin: ['admin'],
  userOperations: ['admin', 'admin_assistant'],
  executive: ['ceo', 'admin'],
  // The actual accounting permission is managed dynamically by projectAccess.accounting.
  accounting: USER_ROLES,
  accountingDefault: ['accountant', 'ceo', 'admin'],
  management: ['ceo', 'deputy_director', 'admin'],
  hrManagement: ['hr', 'ceo', 'deputy_director', 'admin'],
  procurement: ['procurement'],
  procurementAdmin: ['procurement', 'admin'],
  ai: ['ceo', 'deputy_director', 'admin', 'partner', 'hr'],
} satisfies Record<string, readonly UserRole[]>;

export const ROUTE_ACCESS = {
  '/projects': ROLE_GROUPS.operational,
  '/timesheets': ROLE_GROUPS.operational,
  '/attendance': ROLE_GROUPS.operational,
  '/notifications': ROLE_GROUPS.all,
  '/hr': ROLE_GROUPS.hrManagement,
  '/employees': ROLE_GROUPS.hrManagement,
  '/analytics': ROLE_GROUPS.executive,
  '/assign-partners': ROLE_GROUPS.management,
  '/bonuses': ROLE_GROUPS.executive,
  '/accounting': ROLE_GROUPS.accountingDefault,
  '/settings': ROLE_GROUPS.operational,
  '/user-management': ROLE_GROUPS.userOperations,
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
  const allowedRoles: readonly UserRole[] = ROUTE_ACCESS[path];
  return allowedRoles.includes(role);
}

export function homeRouteForRole(role: UserRole | null | undefined): '/accounting' | '/projects' {
  return role === 'accountant' ? '/accounting' : '/projects';
}
