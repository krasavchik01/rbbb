/**
 * Гибридное хранилище данных (localStorage + Supabase)
 * 
 * Стратегия:
 * 1. Все данные сначала сохраняются в localStorage (быстро, всегда работает)
 * 2. Затем синхронизируются с Supabase (если доступен)
 * 3. При ошибке Supabase - продолжаем работать с localStorage
 */

import { supabase } from '@/integrations/supabase/client';

// Типы данных
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  avatar?: string;
  companyId?: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  name: string;
  clientName?: string;
  clientWebsite?: string;
  clientActivity?: string;
  clientCity?: string;
  contractNumber?: string;
  contractDate?: string;
  contractSubject?: string;
  contractContacts?: string;
  serviceTerm?: string;
  amountWithoutVAT?: number;
  ourCompany?: string;
  status: 'draft' | 'approval' | 'in_progress' | 'completed' | 'cancelled';
  teamIds?: string[];
  createdBy?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  projectId: string;
  date: string;
  hours: number;
  description?: string;
  createdAt?: string;
}

export interface Bonus {
  id: string;
  employeeId: string;
  projectId: string;
  amount: number;
  percentage?: number;
  type?: string;
  createdAt?: string;
}

// Ключи для localStorage
const STORAGE_KEYS = {
  EMPLOYEES: 'rb_employees',
  PROJECTS: 'rb_projects',
  TIMESHEETS: 'rb_timesheets',
  BONUSES: 'rb_bonuses',
  SYNC_STATUS: 'rb_sync_status',
};

// Класс для работы с данными
class DataStore {
  private useSupabase: boolean = false;
  
  constructor() {
    this.checkSupabaseAvailability();
  }

  // Проверка доступности Supabase
  private async checkSupabaseAvailability() {
    try {
      const { error } = await supabase.from('employees').select('count').limit(1);
      this.useSupabase = !error;
      console.log('Supabase доступен:', this.useSupabase);
    } catch (err) {
      this.useSupabase = false;
      console.log('Supabase недоступен, используем localStorage');
    }
  }

  // Получить данные из localStorage
  private getFromLocalStorage<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Ошибка чтения localStorage:', err);
      return [];
    }
  }

  // Сохранить данные в localStorage
  private saveToLocalStorage<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('Ошибка записи в localStorage:', err);
    }
  }

  // === EMPLOYEES ===
  
  async getEmployees(): Promise<Employee[]> {
    // Сначала пытаемся получить из Supabase
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          // Сохраняем в localStorage как кеш
          this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, data);
          return data;
        }
      } catch (err) {
        console.error('Ошибка Supabase, используем localStorage:', err);
      }
    }
    
    // Fallback на localStorage
    return this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'createdAt'>): Promise<Employee> {
    const newEmployee: Employee = {
      ...employee,
      id: `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    // Сохраняем в localStorage
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    employees.unshift(newEmployee);
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);

    // Пытаемся сохранить в Supabase
    if (this.useSupabase) {
      try {
        await supabase.from('employees').insert([newEmployee]);
      } catch (err) {
        console.error('Ошибка сохранения в Supabase:', err);
      }
    }

    return newEmployee;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    // Обновляем в localStorage
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    const index = employees.findIndex(e => e.id === id);
    
    if (index === -1) return null;

    employees[index] = { ...employees[index], ...updates };
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);

    // Пытаемся обновить в Supabase
    if (this.useSupabase) {
      try {
        await supabase
          .from('employees')
          .update(updates)
          .eq('id', id);
      } catch (err) {
        console.error('Ошибка обновления в Supabase:', err);
      }
    }

    return employees[index];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    // Удаляем из localStorage
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    const filtered = employees.filter(e => e.id !== id);
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, filtered);

    // Пытаемся удалить из Supabase
    if (this.useSupabase) {
      try {
        await supabase.from('employees').delete().eq('id', id);
      } catch (err) {
        console.error('Ошибка удаления из Supabase:', err);
      }
    }

    return true;
  }

  // === PROJECTS ===
  
  async getProjects(): Promise<Project[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, data);
          return data;
        }
      } catch (err) {
        console.error('Ошибка Supabase:', err);
      }
    }
    
    return this.getFromLocalStorage<Project>(STORAGE_KEYS.PROJECTS);
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const newProject: Project = {
      ...project,
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const projects = this.getFromLocalStorage<Project>(STORAGE_KEYS.PROJECTS);
    projects.unshift(newProject);
    this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, projects);

    if (this.useSupabase) {
      try {
        await supabase.from('projects').insert([newProject]);
      } catch (err) {
        console.error('Ошибка сохранения проекта в Supabase:', err);
      }
    }

    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const projects = this.getFromLocalStorage<Project>(STORAGE_KEYS.PROJECTS);
    const index = projects.findIndex(p => p.id === id);
    
    if (index === -1) return null;

    projects[index] = { 
      ...projects[index], 
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, projects);

    if (this.useSupabase) {
      try {
        await supabase
          .from('projects')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err) {
        console.error('Ошибка обновления проекта в Supabase:', err);
      }
    }

    return projects[index];
  }

  // === TIMESHEETS ===
  
  async getTimesheets(): Promise<Timesheet[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('timesheets')
          .select('*')
          .order('date', { ascending: false });
        
        if (!error && data) {
          this.saveToLocalStorage(STORAGE_KEYS.TIMESHEETS, data);
          return data;
        }
      } catch (err) {
        console.error('Ошибка Supabase:', err);
      }
    }
    
    return this.getFromLocalStorage<Timesheet>(STORAGE_KEYS.TIMESHEETS);
  }

  async createTimesheet(timesheet: Omit<Timesheet, 'id' | 'createdAt'>): Promise<Timesheet> {
    const newTimesheet: Timesheet = {
      ...timesheet,
      id: `ts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const timesheets = this.getFromLocalStorage<Timesheet>(STORAGE_KEYS.TIMESHEETS);
    timesheets.unshift(newTimesheet);
    this.saveToLocalStorage(STORAGE_KEYS.TIMESHEETS, timesheets);

    if (this.useSupabase) {
      try {
        await supabase.from('timesheets').insert([newTimesheet]);
      } catch (err) {
        console.error('Ошибка сохранения timesheet в Supabase:', err);
      }
    }

    return newTimesheet;
  }

  // === BONUSES ===
  
  async getBonuses(): Promise<Bonus[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase
          .from('bonuses')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          this.saveToLocalStorage(STORAGE_KEYS.BONUSES, data);
          return data;
        }
      } catch (err) {
        console.error('Ошибка Supabase:', err);
      }
    }
    
    return this.getFromLocalStorage<Bonus>(STORAGE_KEYS.BONUSES);
  }

  async createBonus(bonus: Omit<Bonus, 'id' | 'createdAt'>): Promise<Bonus> {
    const newBonus: Bonus = {
      ...bonus,
      id: `bonus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    const bonuses = this.getFromLocalStorage<Bonus>(STORAGE_KEYS.BONUSES);
    bonuses.unshift(newBonus);
    this.saveToLocalStorage(STORAGE_KEYS.BONUSES, bonuses);

    if (this.useSupabase) {
      try {
        await supabase.from('bonuses').insert([newBonus]);
      } catch (err) {
        console.error('Ошибка сохранения bonus в Supabase:', err);
      }
    }

    return newBonus;
  }

  // Очистка всех демо-данных
  clearAllDemoData(): void {
    const keysToKeep = ['rb_user_role', 'rb_theme'];
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    console.log('Все демо-данные удалены из localStorage');
  }
}

// Экспортируем единый экземпляр
export const dataStore = new DataStore();

// АВТООЧИСТКА ДЕМО-ДАННЫХ ПРИ ЗАГРУЗКЕ
// Проверяем, нужно ли очистить данные
if (!localStorage.getItem('rb_data_cleared_v2')) {
  dataStore.clearAllDemoData();
  localStorage.setItem('rb_data_cleared_v2', 'true');
  console.log('🧹 Демо-данные очищены автоматически');
}

