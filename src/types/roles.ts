export type UserRole = 'admin' | 'partner' | 'manager' | 'employee';

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Role {
  id: UserRole;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  
  // Projects
  VIEW_PROJECTS: 'view_projects',
  CREATE_PROJECTS: 'create_projects',
  EDIT_PROJECTS: 'edit_projects',
  DELETE_PROJECTS: 'delete_projects',
  MANAGE_PROJECTS: 'manage_projects',
  
  // Employees
  VIEW_EMPLOYEES: 'view_employees',
  CREATE_EMPLOYEES: 'create_employees',
  EDIT_EMPLOYEES: 'edit_employees',
  DELETE_EMPLOYEES: 'delete_employees',
  MANAGE_EMPLOYEES: 'manage_employees',
  
  // HR
  VIEW_HR: 'view_hr',
  MANAGE_HR: 'manage_hr',
  
  // Timesheets
  VIEW_TIMESHEETS: 'view_timesheets',
  CREATE_TIMESHEETS: 'create_timesheets',
  EDIT_TIMESHEETS: 'edit_timesheets',
  APPROVE_TIMESHEETS: 'approve_timesheets',
  
  // Bonuses
  VIEW_BONUSES: 'view_bonuses',
  CREATE_BONUSES: 'create_bonuses',
  EDIT_BONUSES: 'edit_bonuses',
  APPROVE_BONUSES: 'approve_bonuses',
  
  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_ANALYTICS: 'export_analytics',
  
  // Calendar
  VIEW_CALENDAR: 'view_calendar',
  CREATE_EVENTS: 'create_events',
  EDIT_EVENTS: 'edit_events',
  DELETE_EVENTS: 'delete_events',
  
  // Notifications
  VIEW_NOTIFICATIONS: 'view_notifications',
  MANAGE_NOTIFICATIONS: 'manage_notifications',
  
  // User Management
  VIEW_USER_MANAGEMENT: 'view_user_management',
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  
  // Settings
  VIEW_SETTINGS: 'view_settings',
  MANAGE_SETTINGS: 'manage_settings',
} as const;

export const ROLES: Record<UserRole, Role> = {
  admin: {
    id: 'admin',
    name: 'Администратор',
    description: 'Полный доступ ко всем функциям системы',
    color: 'bg-red-500',
    permissions: Object.values(PERMISSIONS),
  },
  partner: {
    id: 'partner',
    name: 'Партнер',
    description: 'Управление проектами и сотрудниками',
    color: 'bg-purple-500',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_PROJECTS,
      PERMISSIONS.CREATE_PROJECTS,
      PERMISSIONS.EDIT_PROJECTS,
      PERMISSIONS.DELETE_PROJECTS,
      PERMISSIONS.MANAGE_PROJECTS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.CREATE_EMPLOYEES,
      PERMISSIONS.EDIT_EMPLOYEES,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.VIEW_HR,
      PERMISSIONS.MANAGE_HR,
      PERMISSIONS.VIEW_TIMESHEETS,
      PERMISSIONS.APPROVE_TIMESHEETS,
      PERMISSIONS.VIEW_BONUSES,
      PERMISSIONS.CREATE_BONUSES,
      PERMISSIONS.EDIT_BONUSES,
      PERMISSIONS.APPROVE_BONUSES,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.EXPORT_ANALYTICS,
      PERMISSIONS.VIEW_CALENDAR,
      PERMISSIONS.CREATE_EVENTS,
      PERMISSIONS.EDIT_EVENTS,
      PERMISSIONS.DELETE_EVENTS,
      PERMISSIONS.VIEW_NOTIFICATIONS,
      PERMISSIONS.VIEW_SETTINGS,
    ],
  },
  manager: {
    id: 'manager',
    name: 'Менеджер',
    description: 'Управление проектами и командой',
    color: 'bg-blue-500',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_PROJECTS,
      PERMISSIONS.CREATE_PROJECTS,
      PERMISSIONS.EDIT_PROJECTS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.VIEW_HR,
      PERMISSIONS.VIEW_TIMESHEETS,
      PERMISSIONS.APPROVE_TIMESHEETS,
      PERMISSIONS.VIEW_BONUSES,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_CALENDAR,
      PERMISSIONS.CREATE_EVENTS,
      PERMISSIONS.EDIT_EVENTS,
      PERMISSIONS.VIEW_NOTIFICATIONS,
    ],
  },
  employee: {
    id: 'employee',
    name: 'Сотрудник',
    description: 'Базовый доступ к системе',
    color: 'bg-green-500',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_PROJECTS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.VIEW_TIMESHEETS,
      PERMISSIONS.CREATE_TIMESHEETS,
      PERMISSIONS.EDIT_TIMESHEETS,
      PERMISSIONS.VIEW_BONUSES,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_CALENDAR,
      PERMISSIONS.CREATE_EVENTS,
      PERMISSIONS.VIEW_NOTIFICATIONS,
    ],
  },
};

export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  return ROLES[userRole]?.permissions.includes(permission) || false;
};

export const getRoleInfo = (role: UserRole): Role => {
  return ROLES[role];
};

export const getAllRoles = (): Role[] => {
  return Object.values(ROLES);
};



