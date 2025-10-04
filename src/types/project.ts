// Типы для модуля проектов и задач

export type ProjectStatus = 
  | 'draft' 
  | 'pre_approval' 
  | 'partner_assigned' 
  | 'pm_assigned'
  | 'team_assembled' 
  | 'in_progress' 
  | 'qa_review' 
  | 'client_signoff'
  | 'closed' 
  | 'archived';

export type TaskStatus = 
  | 'backlog' 
  | 'todo' 
  | 'in_progress' 
  | 'in_review' 
  | 'done' 
  | 'blocked';

export type PriorityLevel = 'low' | 'med' | 'high' | 'critical';
export type RiskLevel = 'low' | 'med' | 'high';
export type RiskStatus = 'open' | 'mitigating' | 'closed';
export type EmployeeStatus = 'active' | 'probation' | 'terminated';

export type EmployeeRole = 
  | 'IT' 
  | 'Аудиторы' 
  | 'Налоговики' 
  | 'Оценщики' 
  | 'Академия'
  | 'Закупки' 
  | 'Юридический отдел' 
  | 'HR' 
  | 'Руководство';

export type AppRole = 
  | 'leadership' 
  | 'deputy_director' 
  | 'partner' 
  | 'pm'
  | 'procurement' 
  | 'hr' 
  | 'employee';

export type ProjectTeamRole = 
  | 'PM' 
  | 'Supervisor' 
  | 'Assistant' 
  | 'Auditor' 
  | 'IT'
  | 'Legal' 
  | 'Tax' 
  | 'Designer' 
  | 'Other';

export interface Company {
  id: string;
  name: string;
  brand_color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  name: string;
  full_name?: string;
  company_id?: string;
  roles: EmployeeRole[];
  grade?: string;
  email?: string;
  phone?: string;
  location?: string;
  status: EmployeeStatus;
  hire_date?: string;
  photo_url?: string;
  app_role: AppRole;
  created_at: string;
  updated_at: string;
  company?: Company;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  company_id: string;
  status: ProjectStatus;
  partner_id?: string;
  pm_id?: string;
  start_date?: string;
  due_date?: string;
  risk_level: RiskLevel;
  description?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  company?: Company;
  partner?: Employee;
  pm?: Employee;
  team?: ProjectTeamMember[];
  tasks?: Task[];
  completion_percentage?: number;
}

export interface ProjectTeamMember {
  id: string;
  project_id: string;
  employee_id: string;
  role_on_project: ProjectTeamRole;
  created_at: string;
  employee?: Employee;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  assignees: string[];
  reporter?: string;
  priority: PriorityLevel;
  status: TaskStatus;
  due_at?: string;
  estimate_h?: number;
  spent_h: number;
  labels: string[];
  checklist: ChecklistItem[];
  attachments: any[];
  comments: any[];
  parent_task_id?: string;
  created_at: string;
  updated_at: string;
  project?: Project;
  reporter_employee?: Employee;
  assignee_employees?: Employee[];
}

export interface ChecklistItem {
  item: string;
  required: boolean;
  done: boolean;
}

export interface IssueRisk {
  id: string;
  project_id: string;
  title: string;
  severity: PriorityLevel;
  owner?: string;
  status: RiskStatus;
  due_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  project?: Project;
  owner_employee?: Employee;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string;
  payload: any;
  created_at: string;
  actor?: Employee;
}

// Константы для статусов и переходов
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Черновик',
  pre_approval: 'На согласовании',
  partner_assigned: 'Назначен партнёр',
  pm_assigned: 'Назначен PM',
  team_assembled: 'Команда собрана',
  in_progress: 'В работе',
  qa_review: 'На проверке',
  client_signoff: 'На подписании',
  closed: 'Закрыт',
  archived: 'Архив'
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Бэклог',
  todo: 'К выполнению',
  in_progress: 'В работе',
  in_review: 'На проверке',
  done: 'Выполнено',
  blocked: 'Заблокировано'
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: 'Низкий',
  med: 'Средний',
  high: 'Высокий',
  critical: 'Критический'
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Низкий',
  med: 'Средний',
  high: 'Высокий'
};

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  'IT': 'ИТ',
  'Аудиторы': 'Аудиторы',
  'Налоговики': 'Налоговики',
  'Оценщики': 'Оценщики',
  'Академия': 'Академия',
  'Закупки': 'Закупки',
  'Юридический отдел': 'Юридический отдел',
  'HR': 'Кадровый отдел (HR)',
  'Руководство': 'Руководство'
};

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  leadership: 'Руководство',
  deputy_director: 'Заместитель директора',
  partner: 'Партнёр',
  pm: 'Менеджер проекта',
  procurement: 'Закупки',
  hr: 'HR',
  employee: 'Сотрудник'
};

// Логика переходов workflow
export const WORKFLOW_TRANSITIONS: Record<ProjectStatus, { 
  next: ProjectStatus[], 
  roles: AppRole[],
  requirements?: string[]
}> = {
  draft: {
    next: ['pre_approval'],
    roles: ['procurement'],
    requirements: ['name', 'company_id', 'description']
  },
  pre_approval: {
    next: ['partner_assigned'],
    roles: ['deputy_director'],
    requirements: ['partner_id']
  },
  partner_assigned: {
    next: ['pm_assigned'],
    roles: ['partner'],
    requirements: ['pm_id']
  },
  pm_assigned: {
    next: ['team_assembled'],
    roles: ['partner'],
    requirements: ['team_min_2']
  },
  team_assembled: {
    next: ['in_progress'],
    roles: ['partner'],
    requirements: ['auto_tasks_created']
  },
  in_progress: {
    next: ['qa_review'],
    roles: ['pm'],
    requirements: ['tasks_70_percent_done']
  },
  qa_review: {
    next: ['client_signoff'],
    roles: ['pm'],
    requirements: ['quality_checklist_100']
  },
  client_signoff: {
    next: ['closed'],
    roles: ['partner', 'leadership']
  },
  closed: {
    next: ['archived'],
    roles: ['leadership']
  },
  archived: {
    next: [],
    roles: []
  }
};

// Демо данные компаний
export const DEMO_COMPANIES: Omit<Company, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'RB Partners IT Audit', brand_color: '#3B82F6', active: true },
  { name: 'Russell Bedford A+ Partners', brand_color: '#10B981', active: true },
  { name: 'Parker Russell', brand_color: '#F59E0B', active: true },
  { name: 'Fin Consulting', brand_color: '#EF4444', active: true },
  { name: 'Andersonkz', brand_color: '#8B5CF6', active: true }
];

// Стартовые задачи для новых проектов
export const STARTER_TASKS = [
  {
    title: 'Бриф клиента',
    description: 'Сбор и анализ требований клиента',
    priority: 'high' as PriorityLevel,
    estimate_h: 8
  },
  {
    title: 'План проекта',
    description: 'Разработка детального плана выполнения проекта',
    priority: 'high' as PriorityLevel,
    estimate_h: 16
  },
  {
    title: 'Матрица рисков',
    description: 'Идентификация и анализ проектных рисков',
    priority: 'med' as PriorityLevel,
    estimate_h: 4
  }
];