/**
 * Централизованное хранилище данных с localStorage
 */

import { Employee } from '@/types';
import { ProjectTemplate } from '@/types/methodology';

// Типы данных
export interface Project {
  id: string;
  name: string;
  status: 'В работе' | 'На проверке' | 'Черновик' | 'Завершён' | 'Приостановлен';
  completion: number;
  team: string[]; // массив ID сотрудников
  deadline: string;
  company: string;
  description?: string;
  budget?: number;
  created_at: string;
  updated_at: string;
}

export interface Timesheet {
  id: string;
  employee_id: string;
  project_id: string;
  date: string;
  hours: number;
  description: string;
  status: 'Черновик' | 'На утверждении' | 'Утверждено' | 'Отклонено';
  created_at: string;
}

export interface Bonus {
  id: string;
  employee_id: string;
  amount: number;
  type: 'Проект' | 'KPI' | 'Годовой' | 'Разовый';
  description: string;
  date: string;
  status: 'Ожидает' | 'Одобрен' | 'Выплачен' | 'Отклонён';
  created_at: string;
}

export interface Vacation {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: 'Оплачиваемый' | 'Без сохранения' | 'Больничный' | 'Отгул';
  status: 'Ожидает' | 'Одобрен' | 'Отклонён';
  days: number;
  reason?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}

// Ключи для localStorage
const STORAGE_KEYS = {
  PROJECTS: 'rb_projects',
  EMPLOYEES: 'rb_employees',
  TIMESHEETS: 'rb_timesheets',
  BONUSES: 'rb_bonuses',
  VACATIONS: 'rb_vacations',
  NOTIFICATIONS: 'rb_notifications',
  TEMPLATES: 'rb_templates',
};

// Утилиты для работы с localStorage
class DataStore {
  // Generic методы
  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  }

  // Проекты
  getProjects(): Project[] {
    return this.getItem<Project[]>(STORAGE_KEYS.PROJECTS, this.getDefaultProjects());
  }

  saveProjects(projects: Project[]): void {
    this.setItem(STORAGE_KEYS.PROJECTS, projects);
  }

  addProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Project {
    const projects = this.getProjects();
    const newProject: Project = {
      ...project,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.push(newProject);
    this.saveProjects(projects);
    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    projects[index] = {
      ...projects[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveProjects(projects);
    return projects[index];
  }

  deleteProject(id: string): boolean {
    const projects = this.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    if (filtered.length === projects.length) return false;
    this.saveProjects(filtered);
    return true;
  }

  // Сотрудники
  getEmployees(): Employee[] {
    return this.getItem<Employee[]>(STORAGE_KEYS.EMPLOYEES, this.getDefaultEmployees());
  }

  saveEmployees(employees: Employee[]): void {
    this.setItem(STORAGE_KEYS.EMPLOYEES, employees);
  }

  addEmployee(employee: Omit<Employee, 'id'>): Employee {
    const employees = this.getEmployees();
    const newEmployee: Employee = {
      ...employee,
      id: this.generateId(),
    };
    employees.push(newEmployee);
    this.saveEmployees(employees);
    return newEmployee;
  }

  updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
    const employees = this.getEmployees();
    const index = employees.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    employees[index] = { ...employees[index], ...updates };
    this.saveEmployees(employees);
    return employees[index];
  }

  deleteEmployee(id: string): boolean {
    const employees = this.getEmployees();
    const filtered = employees.filter(e => e.id !== id);
    if (filtered.length === employees.length) return false;
    this.saveEmployees(filtered);
    return true;
  }

  // Тайм-шиты
  getTimesheets(): Timesheet[] {
    return this.getItem<Timesheet[]>(STORAGE_KEYS.TIMESHEETS, this.getDefaultTimesheets());
  }

  saveTimesheets(timesheets: Timesheet[]): void {
    this.setItem(STORAGE_KEYS.TIMESHEETS, timesheets);
  }

  addTimesheet(timesheet: Omit<Timesheet, 'id' | 'created_at'>): Timesheet {
    const timesheets = this.getTimesheets();
    const newTimesheet: Timesheet = {
      ...timesheet,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    timesheets.push(newTimesheet);
    this.saveTimesheets(timesheets);
    return newTimesheet;
  }

  updateTimesheet(id: string, updates: Partial<Timesheet>): Timesheet | null {
    const timesheets = this.getTimesheets();
    const index = timesheets.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    timesheets[index] = { ...timesheets[index], ...updates };
    this.saveTimesheets(timesheets);
    return timesheets[index];
  }

  deleteTimesheet(id: string): boolean {
    const timesheets = this.getTimesheets();
    const filtered = timesheets.filter(t => t.id !== id);
    if (filtered.length === timesheets.length) return false;
    this.saveTimesheets(filtered);
    return true;
  }

  // Бонусы
  getBonuses(): Bonus[] {
    return this.getItem<Bonus[]>(STORAGE_KEYS.BONUSES, this.getDefaultBonuses());
  }

  saveBonuses(bonuses: Bonus[]): void {
    this.setItem(STORAGE_KEYS.BONUSES, bonuses);
  }

  addBonus(bonus: Omit<Bonus, 'id' | 'created_at'>): Bonus {
    const bonuses = this.getBonuses();
    const newBonus: Bonus = {
      ...bonus,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    bonuses.push(newBonus);
    this.saveBonuses(bonuses);
    return newBonus;
  }

  updateBonus(id: string, updates: Partial<Bonus>): Bonus | null {
    const bonuses = this.getBonuses();
    const index = bonuses.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    bonuses[index] = { ...bonuses[index], ...updates };
    this.saveBonuses(bonuses);
    return bonuses[index];
  }

  deleteBonus(id: string): boolean {
    const bonuses = this.getBonuses();
    const filtered = bonuses.filter(b => b.id !== id);
    if (filtered.length === bonuses.length) return false;
    this.saveBonuses(filtered);
    return true;
  }

  // Отпуска
  getVacations(): Vacation[] {
    return this.getItem<Vacation[]>(STORAGE_KEYS.VACATIONS, this.getDefaultVacations());
  }

  saveVacations(vacations: Vacation[]): void {
    this.setItem(STORAGE_KEYS.VACATIONS, vacations);
  }

  addVacation(vacation: Omit<Vacation, 'id' | 'created_at'>): Vacation {
    const vacations = this.getVacations();
    const newVacation: Vacation = {
      ...vacation,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    vacations.push(newVacation);
    this.saveVacations(vacations);
    return newVacation;
  }

  updateVacation(id: string, updates: Partial<Vacation>): Vacation | null {
    const vacations = this.getVacations();
    const index = vacations.findIndex(v => v.id === id);
    if (index === -1) return null;
    
    vacations[index] = { ...vacations[index], ...updates };
    this.saveVacations(vacations);
    return vacations[index];
  }

  deleteVacation(id: string): boolean {
    const vacations = this.getVacations();
    const filtered = vacations.filter(v => v.id !== id);
    if (filtered.length === vacations.length) return false;
    this.saveVacations(filtered);
    return true;
  }

  // Уведомления
  getNotifications(): Notification[] {
    return this.getItem<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  }

  saveNotifications(notifications: Notification[]): void {
    this.setItem(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }

  addNotification(notification: Omit<Notification, 'id' | 'created_at'>): Notification {
    const notifications = this.getNotifications();
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      created_at: new Date().toISOString(),
    };
    notifications.unshift(newNotification); // Добавляем в начало
    this.saveNotifications(notifications);
    return newNotification;
  }

  markNotificationAsRead(id: string): boolean {
    const notifications = this.getNotifications();
    const index = notifications.findIndex(n => n.id === id);
    if (index === -1) return false;
    
    notifications[index].read = true;
    this.saveNotifications(notifications);
    return true;
  }

  markAllNotificationsAsRead(userId: string): void {
    const notifications = this.getNotifications();
    notifications.forEach(n => {
      if (n.user_id === userId) {
        n.read = true;
      }
    });
    this.saveNotifications(notifications);
  }

  deleteNotification(id: string): boolean {
    const notifications = this.getNotifications();
    const filtered = notifications.filter(n => n.id !== id);
    if (filtered.length === notifications.length) return false;
    this.saveNotifications(filtered);
    return true;
  }

  // Утилиты
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Данные по умолчанию
  // ВСЕ ДЕМО-ДАННЫЕ УДАЛЕНЫ - используем только реальные данные
  private getDefaultProjects(): Project[] {
    return [];
  }

  private getDefaultEmployees(): Employee[] {
    return [];
  }

  private getDefaultTimesheets(): Timesheet[] {
    return [];
  }

  private getDefaultBonuses(): Bonus[] {
    return [];
  }

  private getDefaultVacations(): Vacation[] {
    return [];
  }

  // Шаблоны проектов (Методологии)
  getTemplates(): ProjectTemplate[] {
    return this.getItem<ProjectTemplate[]>(STORAGE_KEYS.TEMPLATES, this.getDefaultTemplates());
  }

  saveTemplates(templates: ProjectTemplate[]): void {
    this.setItem(STORAGE_KEYS.TEMPLATES, templates);
  }

  addTemplate(template: Omit<ProjectTemplate, 'id' | 'created_at' | 'updated_at' | 'version'>): ProjectTemplate {
    const templates = this.getTemplates();
    const newTemplate: ProjectTemplate = {
      ...template,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    templates.push(newTemplate);
    this.saveTemplates(templates);
    return newTemplate;
  }

  updateTemplate(id: string, updates: Partial<ProjectTemplate>): ProjectTemplate | null {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    templates[index] = {
      ...templates[index],
      ...updates,
      updated_at: new Date().toISOString(),
      version: templates[index].version + 1,
    };
    this.saveTemplates(templates);
    return templates[index];
  }

  deleteTemplate(id: string): boolean {
    const templates = this.getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    if (filtered.length === templates.length) return false;
    this.saveTemplates(filtered);
    return true;
  }

  duplicateTemplate(id: string): ProjectTemplate | null {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === id);
    if (!template) return null;

    const newTemplate: ProjectTemplate = {
      ...template,
      id: this.generateId(),
      name: `${template.name} (Копия)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      usageCount: 0,
    };

    templates.push(newTemplate);
    this.saveTemplates(templates);
    return newTemplate;
  }

  // Очистка всех данных (для тестирования)
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // Сброс к дефолтным данным
  resetToDefaults(): void {
    this.clearAll();
    this.getProjects(); // Инициализирует дефолтные проекты
    this.getEmployees(); // Инициализирует дефолтных сотрудников
    this.getTimesheets(); // Инициализирует дефолтные тайм-шиты
    this.getBonuses(); // Инициализирует дефолтные бонусы
    this.getVacations(); // Инициализирует дефолтные отпуска
    this.getTemplates(); // Инициализирует дефолтные шаблоны
  }

  // Дефолтные шаблоны
  private getDefaultTemplates(): ProjectTemplate[] {
    return [
      {
        id: 'tmpl-1',
        name: 'Аудит финансовой отчетности',
        description: 'Стандартный шаблон для проведения аудита финансовой отчетности по МСФО/РСБУ',
        category: 'Финансовый аудит',
        customFields: [
          {
            id: 'cf-1',
            name: 'client_name',
            label: 'Название клиента',
            type: 'text',
            required: true,
            placeholder: 'ООО "Компания"',
            order: 1
          },
          {
            id: 'cf-2',
            name: 'partner',
            label: 'Партнер по проекту',
            type: 'user',
            required: true,
            order: 2
          },
          {
            id: 'cf-3',
            name: 'total_assets',
            label: 'Всего активов (₽)',
            type: 'number',
            required: false,
            order: 3
          },
          {
            id: 'cf-4',
            name: 'reporting_standard',
            label: 'Стандарт отчетности',
            type: 'select',
            required: true,
            options: ['МСФО', 'РСБУ', 'US GAAP'],
            order: 4
          },
          {
            id: 'cf-5',
            name: 'audit_period',
            label: 'Отчетный период',
            type: 'text',
            required: true,
            placeholder: '2024',
            order: 5
          }
        ],
        stages: [
          {
            id: 'stage-1',
            name: 'Планирование',
            description: 'Этап планирования аудита',
            order: 1,
            color: '#3b82f6',
            elements: [
              {
                id: 'el-1',
                type: 'header',
                title: '1. Предварительная оценка рисков',
                required: false,
                order: 1
              },
              {
                id: 'el-2',
                type: 'question',
                title: 'Оценка существенности',
                question: 'Какой уровень существенности установлен для данного аудита?',
                required: true,
                order: 2
              },
              {
                id: 'el-3',
                type: 'procedure',
                title: 'Анализ бизнеса клиента',
                description: 'Проведите анализ отрасли, рынка и специфики бизнеса клиента',
                required: true,
                order: 3
              },
              {
                id: 'el-4',
                type: 'file',
                title: 'Загрузка письма-обязательства',
                required: true,
                order: 4,
                config: {
                  allowedFileTypes: ['.pdf', '.docx'],
                  maxFileSize: 10
                }
              }
            ]
          },
          {
            id: 'stage-2',
            name: 'Выполнение процедур',
            description: 'Этап выполнения аудиторских процедур',
            order: 2,
            color: '#10b981',
            elements: [
              {
                id: 'el-5',
                type: 'header',
                title: '2. Тестирование СВК',
                required: false,
                order: 1
              },
              {
                id: 'el-6',
                type: 'procedure',
                title: 'Тестирование контрольных процедур',
                description: 'Выполните тесты контролей для ключевых бизнес-процессов',
                required: true,
                order: 2
              },
              {
                id: 'el-7',
                type: 'procedure',
                title: 'Детальное тестирование операций',
                description: 'Проведите детальные тесты для существенных остатков и операций',
                required: true,
                order: 3
              }
            ]
          },
          {
            id: 'stage-3',
            name: 'Завершение и отчетность',
            description: 'Финальный этап и подготовка отчета',
            order: 3,
            color: '#f59e0b',
            elements: [
              {
                id: 'el-8',
                type: 'question',
                title: 'Выявленные искажения',
                question: 'Укажите все выявленные существенные искажения',
                required: true,
                order: 1
              },
              {
                id: 'el-9',
                type: 'file',
                title: 'Итоговый аудиторский отчет',
                required: true,
                order: 2
              },
              {
                id: 'el-10',
                type: 'signature',
                title: 'Утверждение партнером',
                description: 'Требуется утверждение партнера',
                required: true,
                requiredRole: 'partner',
                order: 3
              }
            ]
          }
        ],
        routingSettings: {
          defaultApprovalRole: 'partner',
          notifyOnCreation: true,
          allowedRoles: ['admin', 'partner', 'manager']
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: '1',
        version: 1,
        isActive: true,
        usageCount: 0
      },
      {
        id: 'tmpl-2',
        name: 'Оценка недвижимости',
        description: 'Шаблон для проведения оценки объектов недвижимости',
        category: 'Оценка недвижимости',
        customFields: [
          {
            id: 'cf-10',
            name: 'object_name',
            label: 'Объект оценки',
            type: 'text',
            required: true,
            order: 1
          },
          {
            id: 'cf-11',
            name: 'cadastral_number',
            label: 'Кадастровый номер',
            type: 'text',
            required: true,
            order: 2
          },
          {
            id: 'cf-12',
            name: 'evaluation_purpose',
            label: 'Цель оценки',
            type: 'select',
            required: true,
            options: ['Залог', 'Продажа', 'Страхование', 'Судебное разбирательство'],
            order: 3
          },
          {
            id: 'cf-13',
            name: 'valuation_date',
            label: 'Дата оценки',
            type: 'date',
            required: true,
            order: 4
          }
        ],
        stages: [
          {
            id: 'stage-10',
            name: 'Сбор информации',
            order: 1,
            color: '#3b82f6',
            elements: [
              {
                id: 'el-20',
                type: 'procedure',
                title: 'Осмотр объекта',
                description: 'Проведите осмотр объекта оценки',
                required: true,
                order: 1
              },
              {
                id: 'el-21',
                type: 'file',
                title: 'Фотографии объекта',
                required: true,
                order: 2,
                config: {
                  multipleFiles: true,
                  allowedFileTypes: ['.jpg', '.png'],
                  maxFileSize: 5
                }
              }
            ]
          },
          {
            id: 'stage-11',
            name: 'Расчет стоимости',
            order: 2,
            color: '#10b981',
            elements: [
              {
                id: 'el-22',
                type: 'procedure',
                title: 'Применение подходов к оценке',
                description: 'Примените сравнительный, доходный и затратный подходы',
                required: true,
                order: 1
              }
            ]
          },
          {
            id: 'stage-12',
            name: 'Отчет об оценке',
            order: 3,
            color: '#f59e0b',
            elements: [
              {
                id: 'el-23',
                type: 'file',
                title: 'Итоговый отчет об оценке',
                required: true,
                order: 1
              },
              {
                id: 'el-24',
                type: 'signature',
                title: 'Утверждение руководителем',
                required: true,
                requiredRole: 'manager',
                order: 2
              }
            ]
          }
        ],
        routingSettings: {
          defaultApprovalRole: 'manager',
          notifyOnCreation: true,
          allowedRoles: ['admin', 'manager']
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: '1',
        version: 1,
        isActive: true,
        usageCount: 0
      }
    ];
  }
}

// Экспортируем единственный экземпляр
export const dataStore = new DataStore();

