/**
 * Роли пользователей в системе
 */

// Обновленные роли с учетом новой структуры
export type UserRole = 
  | 'ceo'                    // Генеральный директор (главный босс)
  | 'deputy_director'        // Заместитель генерального директора
  | 'company_director'       // Директор компании (для HR, информационно)
  | 'procurement'            // Отдел закупок
  | 'partner'                // Партнер (руководитель проекта)
  | 'project_leader'         // Руководитель проекта
  | 'manager_1'             // Менеджер 1
  | 'manager_2'             // Менеджер 2
  | 'manager_3'             // Менеджер 3
  | 'supervisor_3'           // Супервайзер 3
  | 'supervisor_2'           // Супервайзер 2
  | 'supervisor_1'           // Супервайзер 1
  | 'tax_specialist_1'       // Налоговик 1
  | 'tax_specialist_2'       // Налоговик 2
  | 'assistant_3'            // Ассистент 3
  | 'assistant_2'            // Ассистент 2
  | 'assistant_1'            // Ассистент 1
  | 'contractor'             // ГПХ (подрядчик)
  | 'academy'                // Сотрудник академии (обучение)
  | 'hr'                     // HR специалист
  | 'accountant'             // Бухгалтер
  | 'admin_staff'            // Административный персонал
  | 'admin';                 // Администратор системы

// Названия ролей на русском
const USER_ROLES: UserRole[] = [
  'ceo',
  'deputy_director',
  'company_director',
  'procurement',
  'partner',
  'project_leader',
  'manager_1',
  'manager_2',
  'manager_3',
  'supervisor_3',
  'supervisor_2',
  'supervisor_1',
  'tax_specialist_1',
  'tax_specialist_2',
  'assistant_3',
  'assistant_2',
  'assistant_1',
  'contractor',
  'academy',
  'hr',
  'accountant',
  'admin_staff',
  'admin',
];

export function isUserRole(value: string | null | undefined): value is UserRole {
  return !!value && USER_ROLES.includes(value as UserRole);
}

function normalizeLevel(level: string | null | undefined): '1' | '2' | '3' {
  if (level === '2' || level === '3') {
    return level;
  }
  return '1';
}

export function normalizeUserRole(
  role: string | null | undefined,
  level?: string | null,
  fallback: UserRole = 'assistant_1'
): UserRole {
  if (isUserRole(role)) {
    return role;
  }

  const normalizedLevel = normalizeLevel(level);

  switch (role) {
    case 'assistant':
      return `assistant_${normalizedLevel}` as UserRole;
    case 'manager':
      return `manager_${normalizedLevel}` as UserRole;
    case 'supervisor':
      return `supervisor_${normalizedLevel}` as UserRole;
    case 'tax_specialist':
      return `tax_specialist_${normalizedLevel}` as UserRole;
    case 'project_manager':
      return 'project_leader';
    case 'employee':
      return 'assistant_1';
    case 'it_admin':
      return 'admin';
    default:
      return fallback;
  }
}

export function getDbRoleForUserRole(role: UserRole): string {
  switch (role) {
    case 'assistant_1':
    case 'assistant_2':
    case 'assistant_3':
      return 'assistant';
    case 'supervisor_1':
    case 'supervisor_2':
    case 'supervisor_3':
    case 'manager_1':
    case 'manager_2':
    case 'manager_3':
      return 'manager';
    case 'tax_specialist_1':
    case 'tax_specialist_2':
      return 'tax_specialist';
    case 'accountant':
    case 'contractor':
      return 'employee';
    case 'project_leader':
      return 'project_manager';
    default:
      return role;
  }
}

export function getLevelForUserRole(role: UserRole): '1' | '2' | '3' {
  if (role.includes('_2')) {
    return '2';
  }
  if (role.includes('_3')) {
    return '3';
  }
  return '1';
}

export function getEmployeeDbRoleForUserRole(role: UserRole): string {
  switch (role) {
    case 'ceo':
      return 'ceo';
    case 'deputy_director':
      return 'deputy_director';
    case 'company_director':
      return 'partner';
    case 'procurement':
      return 'procurement';
    case 'partner':
      return 'partner';
    case 'hr':
      return 'hr';
    case 'admin':
      return 'admin';
    case 'manager_1':
    case 'manager_2':
    case 'manager_3':
      return 'manager';
    case 'supervisor_1':
    case 'supervisor_2':
    case 'supervisor_3':
      return 'supervisor';
    case 'assistant_1':
    case 'assistant_2':
    case 'assistant_3':
      return 'assistant';
    case 'tax_specialist_1':
    case 'tax_specialist_2':
      return 'tax_specialist';
    case 'accountant':
      return 'accountant';
    case 'contractor':
      return 'contractor';
    default:
      return role;
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: 'Генеральный директор (CEO)',
  deputy_director: 'Заместитель генерального директора',
  company_director: 'Директор компании',
  procurement: 'Отдел закупок',
  partner: 'Партнер',
  project_leader: 'Руководитель проекта',
  manager_1: 'Менеджер 1',
  manager_2: 'Менеджер 2',
  manager_3: 'Менеджер 3',
  supervisor_3: 'Супервайзер 3',
  supervisor_2: 'Супервайзер 2',
  supervisor_1: 'Супервайзер 1',
  tax_specialist_1: 'Налоговый специалист 1',
  tax_specialist_2: 'Налоговый специалист 2',
  assistant_3: 'Ассистент 3',
  assistant_2: 'Ассистент 2',
  assistant_1: 'Ассистент 1',
  contractor: 'ГПХ (Подрядчик)',
  academy: 'Сотрудник академии',
  hr: 'HR специалист',
  accountant: 'Бухгалтер',
  admin_staff: 'Административный персонал',
  admin: 'Администратор',
};

// Роли в проекте с процентами бонусов
export interface ProjectRole {
  role: UserRole;
  label: string;
  bonusPercent: number;
  description?: string;
}

export const PROJECT_ROLES: ProjectRole[] = [
  {
    role: 'partner',
    label: 'Партнер',
    bonusPercent: 25,
    description: 'Партнёр, отвечает за клиента и результат'
  },
  {
    role: 'project_leader',
    label: 'Руководитель проекта',
    bonusPercent: 4,
    description: 'Руководитель проекта, координирует команду'
  },
  {
    role: 'manager_1',
    label: 'Менеджер 1',
    bonusPercent: 10,
    description: 'Старший менеджер проекта'
  },
  {
    role: 'manager_2',
    label: 'Менеджер 2',
    bonusPercent: 8,
    description: 'Средний менеджер проекта'
  },
  {
    role: 'manager_3',
    label: 'Менеджер 3',
    bonusPercent: 6,
    description: 'Младший менеджер проекта'
  },
  {
    role: 'supervisor_3',
    label: 'Супервайзер 3',
    bonusPercent: 15,
    description: 'Старший супервайзер'
  },
  {
    role: 'supervisor_2',
    label: 'Супервайзер 2',
    bonusPercent: 10,
    description: 'Средний супервайзер'
  },
  {
    role: 'supervisor_1',
    label: 'Супервайзер 1',
    bonusPercent: 6,
    description: 'Младший супервайзер'
  },
  {
    role: 'tax_specialist_1',
    label: 'Налоговый специалист 1',
    bonusPercent: 3,
    description: 'Старший налоговый специалист'
  },
  {
    role: 'tax_specialist_2',
    label: 'Налоговый специалист 2',
    bonusPercent: 3,
    description: 'Младший налоговый специалист'
  },
  {
    role: 'assistant_3',
    label: 'Ассистент 3',
    bonusPercent: 4,
    description: 'Старший ассистент'
  },
  {
    role: 'assistant_2',
    label: 'Ассистент 2',
    bonusPercent: 4,
    description: 'Средний ассистент'
  },
  {
    role: 'assistant_1',
    label: 'Ассистент 1',
    bonusPercent: 2,
    description: 'Младший ассистент'
  },
  // Академия (обучение, не связано с аудитом)
  {
    role: 'academy',
    label: 'Сотрудник академии',
    bonusPercent: 0,
    description: 'Обучение, повышение квалификации'
  },
  // Административные роли (могут быть назначены на проекты, но не получают бонусы автоматически)
  {
    role: 'admin',
    label: 'Администратор',
    bonusPercent: 0,
    description: 'Системный администратор'
  },
  {
    role: 'ceo',
    label: 'CEO / Генеральный директор',
    bonusPercent: 0,
    description: 'Главный исполнительный директор'
  },
  {
    role: 'deputy_director',
    label: 'Заместитель директора',
    bonusPercent: 0,
    description: 'Заместитель генерального директора'
  },
  {
    role: 'hr',
    label: 'HR / Кадры',
    bonusPercent: 0,
    description: 'Отдел кадров'
  },
  {
    role: 'procurement',
    label: 'Отдел закупок',
    bonusPercent: 0,
    description: 'Отдел закупок и снабжения'
  },
];

export interface TeamMemberSlot {
  key: string;
  label: string;
  roles: UserRole[];
  color: string;
}

export const TEAM_ROLE_SLOTS: TeamMemberSlot[] = [
  { key: 'partner', label: 'Партнер', roles: ['partner'], color: 'bg-blue-100 text-blue-700' },
  { key: 'manager_1', label: 'Менеджер 1', roles: ['manager_1'], color: 'bg-indigo-100 text-indigo-700' },
  { key: 'manager_2', label: 'Менеджер 2', roles: ['manager_2'], color: 'bg-indigo-100 text-indigo-700' },
  { key: 'manager_3', label: 'Менеджер 3', roles: ['manager_3'], color: 'bg-indigo-100 text-indigo-700' },
  { key: 'supervisor_3', label: 'Супервайзер 3', roles: ['supervisor_3'], color: 'bg-amber-100 text-amber-700' },
  { key: 'supervisor_2', label: 'Супервайзер 2', roles: ['supervisor_2'], color: 'bg-amber-100 text-amber-700' },
  { key: 'supervisor_1', label: 'Супервайзер 1', roles: ['supervisor_1'], color: 'bg-amber-100 text-amber-700' },
  { key: 'tax_specialist_1', label: 'Налоговый специалист 1', roles: ['tax_specialist_1'], color: 'bg-emerald-100 text-emerald-700' },
  { key: 'tax_specialist_2', label: 'Налоговый специалист 2', roles: ['tax_specialist_2'], color: 'bg-emerald-100 text-emerald-700' },
  { key: 'assistant_3', label: 'Ассистент 3', roles: ['assistant_3'], color: 'bg-slate-100 text-slate-700' },
  { key: 'assistant_2', label: 'Ассистент 2', roles: ['assistant_2'], color: 'bg-slate-100 text-slate-700' },
  { key: 'assistant_1', label: 'Ассистент 1', roles: ['assistant_1'], color: 'bg-slate-100 text-slate-700' },
  { key: 'gph_1', label: 'ГПХ / Субподряд 1', roles: ['contractor'], color: 'bg-purple-100 text-purple-700' },
  { key: 'gph_2', label: 'ГПХ / Субподряд 2', roles: ['contractor'], color: 'bg-purple-100 text-purple-700' },
];

// Общая сумма процентов = 100%
export const TOTAL_BONUS_PERCENT = PROJECT_ROLES.reduce(
  (sum, role) => sum + role.bonusPercent, 
  0
);

// Разрешения для ролей
export const PERMISSIONS = {
  // Просмотр
  VIEW_ALL_COMPANIES: ['ceo', 'admin'],
  VIEW_COMPANY_DATA: ['ceo', 'deputy_director', 'company_director', 'admin'],
  VIEW_FINANCIAL_DATA: ['ceo', 'admin'],
  // Бонусы скрыты для всех кроме CEO и заместителя директора
  VIEW_BONUSES: ['ceo', 'deputy_director'], // Алиас для совместимости
  VIEW_ALL_BONUSES: ['ceo', 'deputy_director'],
  
  // Проекты
  CREATE_PROJECT: ['procurement', 'admin'],
  APPROVE_PROJECT: ['deputy_director', 'ceo', 'admin'],
  ASSIGN_TEAM: ['deputy_director', 'ceo', 'admin'],
  PLAN_PROJECT: ['partner', 'admin'],
  COMPLETE_PROJECT: ['partner', 'admin'],
  
  // Финансы
  CHANGE_BONUS_MANUALLY: ['ceo'],
  APPROVE_PAYMENTS: ['ceo'],
  VIEW_PROFIT: ['ceo', 'admin'],
  
  // KPI
  RATE_TEAM: ['manager_1', 'manager_2', 'manager_3', 'partner'],
  RATE_MANAGER: ['partner'],
  VIEW_ALL_KPI: ['ceo', 'deputy_director', 'admin'],
  
  // Управление
  MANAGE_USERS: ['ceo', 'hr', 'admin'],
  MANAGE_COMPANIES: ['ceo', 'admin'],
  CHANGE_TEAM: ['deputy_director', 'partner', 'admin'],
  
  // Документы
  UPLOAD_CONTRACT: ['procurement', 'admin'],
  VIEW_CONTRACT: ['partner', 'manager_1', 'manager_2', 'manager_3', 'supervisor_3', 'supervisor_2', 'supervisor_1', 'tax_specialist_1', 'tax_specialist_2', 'assistant_3', 'assistant_2', 'assistant_1', 'academy'],
};

// Проверка разрешения
export const hasPermission = (role: UserRole, permission: keyof typeof PERMISSIONS): boolean => {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(role);
};

// Проверка любого из разрешений
export const hasAnyPermission = (role: UserRole, permissions: (keyof typeof PERMISSIONS)[]): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};
