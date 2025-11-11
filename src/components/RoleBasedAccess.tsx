import { ReactNode } from 'react';

interface RoleBasedAccessProps {
  children: ReactNode;
  allowedRoles: string[];
  userRole: string;
  fallback?: ReactNode;
}

export function RoleBasedAccess({ children, allowedRoles, userRole, fallback = null }: RoleBasedAccessProps) {
  const hasAccess = allowedRoles?.includes(userRole) || allowedRoles?.includes('*');
  
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Предопределенные роли доступа
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'ceo': ['*'], // Полный доступ
  'partner': ['analytics', 'projects', 'employees', 'hr', 'dashboard'],
  'manager_1': ['projects', 'employees', 'timesheets', 'dashboard'],
  'manager_2': ['projects', 'employees', 'timesheets', 'dashboard'],
  'manager_3': ['projects', 'employees', 'timesheets', 'dashboard'],
  'hr': ['employees', 'hr', 'analytics', 'dashboard'],
  'employee': ['dashboard', 'timesheets'],
  'it': ['projects', 'employees', 'dashboard'],
  'auditor': ['projects', 'dashboard'],
  'accountant': ['projects', 'bonuses', 'dashboard'],
};

export function hasPermission(userRole: string, requiredPermission: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes('*') || permissions.includes(requiredPermission);
}