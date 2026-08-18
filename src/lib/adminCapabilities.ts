import type { UserRole } from '@/types/roles';

/**
 * Accounts whose credentials or assignment can expose executive, financial,
 * personnel or system-wide data. A helper may see that the account exists,
 * but cannot edit it, reset its password, delete it or grant its role.
 */
export const CRITICAL_ADMIN_ROLES: readonly UserRole[] = [
  'ceo',
  'deputy_director',
  'company_director',
  'procurement',
  'partner',
  'hr',
  'accountant',
  'admin_assistant',
  'admin',
];

export function canManageUsers(role?: UserRole | string | null): boolean {
  return role === 'admin' || role === 'admin_assistant';
}

export function canAssignUserRole(
  actorRole: UserRole | string | null | undefined,
  nextRole: UserRole,
): boolean {
  if (actorRole === 'admin') return true;
  return actorRole === 'admin_assistant' && !CRITICAL_ADMIN_ROLES.includes(nextRole);
}

export function canManageEmployeeAccount(
  actorRole: UserRole | string | null | undefined,
  targetRole: UserRole | string | null | undefined,
): boolean {
  if (actorRole === 'admin') return true;
  if (actorRole !== 'admin_assistant') return false;
  return !CRITICAL_ADMIN_ROLES.includes(targetRole as UserRole);
}

export function canManageCriticalSettings(role?: UserRole | string | null): boolean {
  return role === 'admin';
}
