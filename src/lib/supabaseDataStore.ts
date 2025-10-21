/**
 * Унифицированное хранилище данных с Supabase интеграцией
 * Стратегия: Supabase как основное хранилище, localStorage как fallback
 */

import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

// Типы из Supabase
type SupabaseEmployee = Database['public']['Tables']['employees']['Row'];
type SupabaseProject = Database['public']['Tables']['projects']['Row'];
type SupabaseTimesheet = Database['public']['Tables']['timesheets']['Row'];
type SupabaseBonus = Database['public']['Tables']['bonuses']['Row'];
type SupabaseCompany = Database['public']['Tables']['companies']['Row'];

// Типы приложения (расширенные)
export interface Employee extends Omit<SupabaseEmployee, 'role' | 'level'> {
  role: string;
  level: string;
  department?: string;
  position?: string;
  avatar?: string;
  companyId?: string;
  phone?: string;
}

export interface Project extends Omit<SupabaseProject, 'status'> {
  status: 'draft' | 'approval' | 'in_progress' | 'completed' | 'cancelled';
  clientName?: string;
  clientWebsite?: string;
  contractNumber?: string;
  contractDate?: string;
  amountWithoutVAT?: number;
  ourCompany?: string;
  teamIds?: string[];
  createdBy?: string;
  createdByName?: string;
  approvedBy?: string;
  approvalDate?: string;
}

export interface Timesheet extends SupabaseTimesheet {
  employeeName?: string;
  projectName?: string;
}

export interface Bonus extends SupabaseBonus {
  employeeName?: string;
  projectName?: string;
}

export interface Company extends SupabaseCompany {
  projects?: number;
  employees?: number;
}

// Ключи для localStorage (fallback)
const STORAGE_KEYS = {
  EMPLOYEES: 'rb_employees',
  PROJECTS: 'rb_projects_v3',
  TIMESHEETS: 'rb_timesheets',
  BONUSES: 'rb_bonuses',
  COMPANIES: 'rb_companies',
  SYNC_STATUS: 'rb_sync_status',
};

class SupabaseDataStore {
  private isOnline: boolean = false;
  private syncInProgress: boolean = false;

  constructor() {
    this.checkConnection();
  }

  // Проверка подключения к Supabase
  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from('employees').select('id').limit(1);
      this.isOnline = !error;
      console.log('🔗 Supabase:', this.isOnline ? 'Подключен' : 'Отключен');
      return this.isOnline;
    } catch (err) {
      this.isOnline = false;
      console.log('🔗 Supabase: Отключен (fallback на localStorage)');
      return false;
    }
  }

  // === GENERIC METHODS ===

  private getFromLocalStorage<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return [];
    }
  }

  private saveToLocalStorage<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }

  // === EMPLOYEES ===

  async getEmployees(): Promise<Employee[]> {
    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) {
          const employees = data.map(emp => this.mapSupabaseEmployee(emp));
          this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
          console.log('✅ Loaded employees from Supabase:', employees.length);
          return employees;
        }
      } catch (err) {
        console.error('❌ Error loading employees from Supabase:', err);
      }
    }

    console.log('📦 Loading employees from localStorage (fallback)');
    return this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    const newEmployee: Employee = {
      ...employee,
      id: `emp_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .insert([{
            name: newEmployee.name,
            email: newEmployee.email,
            role: newEmployee.role as any,
            level: newEmployee.level as any,
            whatsapp: newEmployee.phone || null,
          }])
          .select()
          .single();

        if (!error && data) {
          const mapped = this.mapSupabaseEmployee(data);
          console.log('✅ Created employee in Supabase:', mapped.id);
          
          // Также сохраняем в localStorage
          const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
          employees.push(mapped);
          this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
          
          return mapped;
        }
      } catch (err) {
        console.error('❌ Error creating employee in Supabase:', err);
      }
    }

    // Fallback: только localStorage
    console.log('📦 Creating employee in localStorage (fallback)');
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    employees.push(newEmployee);
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
    return newEmployee;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .update({
            name: updates.name,
            email: updates.email,
            role: updates.role as any,
            level: updates.level as any,
            whatsapp: updates.phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          const mapped = this.mapSupabaseEmployee(data);
          console.log('✅ Updated employee in Supabase:', id);
          
          // Обновляем в localStorage
          const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
          const index = employees.findIndex(e => e.id === id);
          if (index !== -1) {
            employees[index] = mapped;
            this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
          }
          
          return mapped;
        }
      } catch (err) {
        console.error('❌ Error updating employee in Supabase:', err);
      }
    }

    // Fallback: только localStorage
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    const index = employees.findIndex(e => e.id === id);
    if (index === -1) return null;

    employees[index] = {
      ...employees[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
    return employees[index];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    if (this.isOnline) {
      try {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', id);

        if (!error) {
          console.log('✅ Deleted employee from Supabase:', id);
          
          // Удаляем из localStorage
          const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
          const filtered = employees.filter(e => e.id !== id);
          this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, filtered);
          
          return true;
        }
      } catch (err) {
        console.error('❌ Error deleting employee from Supabase:', err);
      }
    }

    // Fallback: только localStorage
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    const filtered = employees.filter(e => e.id !== id);
    if (filtered.length === employees.length) return false;
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, filtered);
    return true;
  }

  // === PROJECTS ===

  async getProjects(): Promise<Project[]> {
    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const projects = data.map(proj => this.mapSupabaseProject(proj));
          this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, projects);
          console.log('✅ Loaded projects from Supabase:', projects.length);
          return projects;
        }
      } catch (err) {
        console.error('❌ Error loading projects from Supabase:', err);
      }
    }

    console.log('📦 Loading projects from localStorage (fallback)');
    return this.getFromLocalStorage<Project>(STORAGE_KEYS.PROJECTS);
  }

  async createProject(project: any): Promise<Project> {
    // Сначала сохраняем в localStorage (всегда работает)
    const projects = this.getFromLocalStorage<any>(STORAGE_KEYS.PROJECTS);
    projects.unshift(project);
    this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, projects);
    console.log('✅ Saved project to localStorage:', project.id);

    // Потом пытаемся сохранить в Supabase
    if (this.isOnline) {
      try {
        // Упрощенная версия для Supabase (только базовые поля)
        const { data, error } = await supabase
          .from('projects')
          .insert([{
            name: project.name || project.client?.name || 'Без названия',
            start_date: project.contract?.serviceStartDate || new Date().toISOString().split('T')[0],
            deadline: project.contract?.serviceEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'active' as any,
            kpi_percentage: 0,
            notes: JSON.stringify(project), // Сохраняем весь объект как JSON
          }])
          .select()
          .single();

        if (!error && data) {
          console.log('✅ Also saved to Supabase:', data.id);
        }
      } catch (err) {
        console.error('⚠️ Could not save to Supabase (not critical):', err);
      }
    }

    return project;
  }

  async updateProject(id: string, updates: any): Promise<Project | null> {
    // Обновляем в localStorage
    const projects = this.getFromLocalStorage<any>(STORAGE_KEYS.PROJECTS);
    const index = projects.findIndex((p: any) => p.id === id);
    if (index === -1) return null;

    projects[index] = {
      ...projects[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, projects);
    console.log('✅ Updated project in localStorage:', id);

    // Пытаемся обновить в Supabase
    if (this.isOnline) {
      try {
        const project = projects[index];
        const { error } = await supabase
          .from('projects')
          .update({
            name: project.name || project.client?.name || 'Без названия',
            notes: JSON.stringify(project),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (!error) {
          console.log('✅ Also updated in Supabase');
        }
      } catch (err) {
        console.error('⚠️ Could not update in Supabase (not critical):', err);
      }
    }

    return projects[index];
  }

  async deleteProject(id: string): Promise<boolean> {
    // Удаляем из localStorage
    const projects = this.getFromLocalStorage<any>(STORAGE_KEYS.PROJECTS);
    const filtered = projects.filter((p: any) => p.id !== id);
    if (filtered.length === projects.length) return false;
    this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, filtered);
    console.log('✅ Deleted project from localStorage:', id);

    // Пытаемся удалить из Supabase
    if (this.isOnline) {
      try {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);

        if (!error) {
          console.log('✅ Also deleted from Supabase');
        }
      } catch (err) {
        console.error('⚠️ Could not delete from Supabase (not critical):', err);
      }
    }

    return true;
  }

  // === COMPANIES ===

  async getCompanies(): Promise<Company[]> {
    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('active', true)
          .order('name', { ascending: true });

        if (!error && data) {
          this.saveToLocalStorage(STORAGE_KEYS.COMPANIES, data);
          console.log('✅ Loaded companies from Supabase:', data.length);
          return data;
        }
      } catch (err) {
        console.error('❌ Error loading companies from Supabase:', err);
      }
    }

    console.log('📦 Loading companies from localStorage (fallback)');
    return this.getFromLocalStorage<Company>(STORAGE_KEYS.COMPANIES);
  }

  // === МАППИНГ ТИПОВ ===

  private mapSupabaseEmployee(emp: SupabaseEmployee): Employee {
    return {
      ...emp,
      role: emp.role as string,
      level: emp.level as string,
      phone: emp.whatsapp || undefined,
    };
  }

  private mapSupabaseProject(proj: SupabaseProject): Project {
    return {
      ...proj,
      status: proj.status === 'completed' ? 'completed' :
              proj.status === 'in_progress' ? 'in_progress' : 'draft',
    };
  }
}

// Экспорт singleton
export const supabaseDataStore = new SupabaseDataStore();

