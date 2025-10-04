export interface Company {
  id: string;
  code: string;
  displayName: string;
  fullName: string;
}

export interface Department {
  id: string;
  name: string;
  color: string;
}

export interface ProjectRole {
  id: string;
  name: string;
  level?: number;
}

export interface ProjectType {
  id: string;
  name: string;
  category: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  avatar: string;
  company: Company;
  department: Department;
  role: string;
  kpi: number;
  bonuses: string;
  engagement: number;
  projects: Array<{
    name: string;
    role: string;
  }>;
  location: string;
  hireDate: string;
  status: 'active' | 'vacation' | 'trial' | 'terminated';
  documents?: Array<{
    type: 'resume' | 'certificate' | 'other';
    name: string;
    url: string;
  }>;
  hrNotes?: string;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  status: 'active' | 'progress' | 'completed';
  company: Company;
  team: Array<{
    employee: Employee;
    role: ProjectRole;
  }>;
  amount: string;
  startDate: string;
  deadline: string;
  kpi: number;
  progress: number;
  tasks: {
    completed: number;
    total: number;
  };
}

export const COMPANIES: Company[] = [
  { id: '1', code: 'rb-it', displayName: 'RB IT Audit', fullName: 'RB Partners IT Audit' },
  { id: '2', code: 'rb-a+', displayName: 'RB A+', fullName: 'Russell Bedford A+ Partners' },
  { id: '3', code: 'parker', displayName: 'Parker', fullName: 'Parker Russell' },
  { id: '4', code: 'anderson', displayName: 'Anderson', fullName: 'Andersonkz' },
  { id: '5', code: 'finco', displayName: 'FinCo', fullName: 'Fin Consulting' }
];

export const DEPARTMENTS: Department[] = [
  { id: '1', name: 'Генеральный директор', color: 'text-purple-400' },
  { id: '2', name: 'Партнёры', color: 'text-blue-400' },
  { id: '3', name: 'Руководители проектов', color: 'text-green-400' },
  { id: '4', name: 'ИТ', color: 'text-cyan-400' },
  { id: '5', name: 'Аудиторы', color: 'text-orange-400' },
  { id: '6', name: 'Налоговики', color: 'text-red-400' },
  { id: '7', name: 'Оценщики', color: 'text-yellow-400' },
  { id: '8', name: 'Академия', color: 'text-pink-400' },
  { id: '9', name: 'Закупки', color: 'text-indigo-400' },
  { id: '10', name: 'Юридический отдел', color: 'text-emerald-400' },
  { id: '11', name: 'Кадровый отдел (HR)', color: 'text-violet-400' }
];

export const PROJECT_ROLES: ProjectRole[] = [
  { id: '1', name: 'Партнёр проекта' },
  { id: '2', name: 'Руководитель проекта' },
  { id: '3', name: 'Супервайзер 1', level: 1 },
  { id: '4', name: 'Супервайзер 2', level: 2 },
  { id: '5', name: 'Супервайзер 3', level: 3 },
  { id: '6', name: 'Ассистент 1', level: 1 },
  { id: '7', name: 'Ассистент 2', level: 2 },
  { id: '8', name: 'Ассистент 3', level: 3 },
  { id: '9', name: 'Налоговик 1', level: 1 },
  { id: '10', name: 'Налоговик 2', level: 2 },
  { id: '11', name: 'Дизайнер' },
  { id: '12', name: 'ИТ-аудитор' },
  { id: '13', name: 'Финансовый аналитик' },
  { id: '14', name: 'Юрист' }
];

export const PROJECT_TYPES: ProjectType[] = [
  { id: '1', name: 'Аудит ИТ', category: 'Аудит' },
  { id: '2', name: 'Аудит безопасности', category: 'Аудит' },
  { id: '3', name: 'Внедрение МСФО', category: 'Консалтинг' },
  { id: '4', name: 'Построение BI', category: 'ИТ' },
  { id: '5', name: 'Консалтинг', category: 'Консалтинг' },
  { id: '6', name: 'Автоматизация процессов', category: 'ИТ' },
  { id: '7', name: 'Обслуживание ИБ', category: 'ИТ' },
  { id: '8', name: 'Оценка стоимости', category: 'Оценка' },
  { id: '9', name: 'Due Diligence', category: 'Консалтинг' },
  { id: '10', name: 'Подготовка тендерной документации', category: 'Юридические' },
  { id: '11', name: 'Аутсорсинг бизнес-процессов', category: 'Консалтинг' }
];