// Упрощенные типы для проектов, совместимые с текущей базой данных

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

export type Priority = 'low' | 'med' | 'high' | 'critical';

export type AppRole = 
  | 'leadership' 
  | 'deputy_director' 
  | 'partner' 
  | 'pm'
  | 'procurement' 
  | 'hr' 
  | 'employee';

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
  email?: string;
  role: string;
  level: string;
  whatsapp?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  deadline?: string;
  start_date?: string;
  manager_id?: string;
  partner_id?: string;
  pm_id?: string;
  company_id?: string;
  description?: string;
  notes?: string;
  kpi_percentage?: number;
  completion_percentage?: number;
  tasks?: Task[];
  team?: ProjectTeamMember[];
}

export interface Task {
  id: string;
  project_id?: string;
  title: string;
  description?: string;
  assignees?: string[];
  reporter?: string;
  priority: Priority;
  status: TaskStatus;
  due_at?: string;
  estimate_h?: number;
  spent_h?: number;
  labels?: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectTeamMember {
  id: string;
  project_id: string;
  employee_id: string;
  role_on_project: string;
  created_at: string;
  employee?: Employee;
}

// Константы
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