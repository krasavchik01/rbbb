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
  | 'hr'                     // HR специалист
  | 'accountant'             // Бухгалтер
  | 'admin';                 // Администратор системы

// Названия ролей на русском
export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: 'Генеральный директор (CEO)',
  deputy_director: 'Заместитель генерального директора',
  company_director: 'Директор компании',
  procurement: 'Отдел закупок',
  partner: 'Партнер',
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
  hr: 'HR специалист',
  accountant: 'Бухгалтер',
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
    bonusPercent: 29,
    description: 'Руководитель проекта, отвечает за планирование и результат'
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
  VIEW_OWN_BONUS: ['partner'],
  VIEW_ALL_BONUSES: ['ceo'],
  
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
  VIEW_CONTRACT: ['partner', 'manager_1', 'manager_2', 'manager_3', 'supervisor_3', 'supervisor_2', 'supervisor_1', 'tax_specialist_1', 'tax_specialist_2', 'assistant_3', 'assistant_2', 'assistant_1'],
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
