/**
 * Централизованное хранилище данных с localStorage
 */

import { Employee } from '@/types';

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
  }

}

// Экспортируем единственный экземпляр
export const dataStore = new DataStore();

