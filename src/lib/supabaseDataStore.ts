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
  status: 'В работе' | 'На проверке' | 'Черновик' | 'Завершён' | 'Приостановлен';
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
  completionPercent?: number;
  completion?: number;
  team?: any[];
  tasks?: any[];
  contract?: any;
  client?: any;
  finances?: any;
  updated_at: string | null;
  notes: any;
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

  // Базовый URL для API файлов (ваш локальный сервер/NAS)
  private get fileApiUrl(): string {
    if (typeof window !== 'undefined') {
      // В разработке Vite на 8080, сервер на 3000
      if (window.location.port === '8080') {
        return `http://${window.location.hostname}:3000/api`;
      }
      return '/api';
    }
    return '/api';
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

  // Инициализация демо-пользователей в системе
  private initializeDemoEmployees(): Employee[] {
    const demoUsers = [
      { id: 'ceo_1', email: 'ceo@rbpartners.com', name: 'Генеральный Директор', role: 'ceo', position: 'Генеральный директор (CEO)', department: 'Руководство' },
      { id: 'deputy_1', email: 'deputy@mak.kz', name: 'Заместитель ген. директора МАК', role: 'deputy_director', position: 'Заместитель генерального директора', department: 'Руководство' },
      { id: 'procurement_1', email: 'procurement@rbpartners.com', name: 'Отдел Закупок', role: 'procurement', position: 'Специалист отдела закупок', department: 'Закупки' },
      { id: 'partner_1', email: 'partner@rbpartners.com', name: 'Партнер Иванов', role: 'partner', position: 'Партнер', department: 'Партнеры' },
      { id: 'manager_1', email: 'manager@rbpartners.com', name: 'Петров П.П.', role: 'manager_1', position: 'Менеджер 1', department: 'Проекты' },
      { id: 'manager_2', email: 'manager2@rbpartners.com', name: 'Менеджер 2 Смирнов', role: 'manager_2', position: 'Менеджер 2', department: 'Проекты' },
      { id: 'manager_3', email: 'manager3@rbpartners.com', name: 'Менеджер 3 Козлов', role: 'manager_3', position: 'Менеджер 3', department: 'Проекты' },
      { id: 'supervisor_1', email: 'supervisor1@rbpartners.com', name: 'Супервайзер 1 Волков', role: 'supervisor_1', position: 'Супервайзер 1', department: 'Аудит' },
      { id: 'supervisor_2', email: 'supervisor2@rbpartners.com', name: 'Супервайзер 2 Новиков', role: 'supervisor_2', position: 'Супервайзер 2', department: 'Аудит' },
      { id: 'supervisor_3', email: 'supervisor@rbpartners.com', name: 'Сидоров С.С.', role: 'supervisor_3', position: 'Супервайзер 3', department: 'Аудит' },
      { id: 'assistant_1', email: 'assistant1@rbpartners.com', name: 'Ассистент 1 Лебедев', role: 'assistant_1', position: 'Ассистент 1', department: 'Аудит' },
      { id: 'assistant_2', email: 'assistant2@rbpartners.com', name: 'Ассистент 2 Соколов', role: 'assistant_2', position: 'Ассистент 2', department: 'Аудит' },
      { id: 'assistant_3', email: 'assistant@rbpartners.com', name: 'Ассистент Кузнецов', role: 'assistant_3', position: 'Ассистент 3', department: 'Аудит' },
      { id: 'tax_1', email: 'tax@rbpartners.com', name: 'Налоговик Орлов', role: 'tax_specialist', position: 'Налоговый специалист', department: 'Налоги' },
      { id: 'admin_1', email: 'admin@rbpartners.com', name: 'Администратор', role: 'admin', position: 'Системный администратор', department: 'IT' },
    ];

    const now = new Date().toISOString();
    return demoUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      level: 'senior' as any,
      department: user.department,
      position: user.position,
      phone: undefined,
      avatar: undefined,
      companyId: undefined,
      created_at: now,
      updated_at: now,
    } as Employee));
  }

  async getEmployees(): Promise<Employee[]> {
    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) {
          let employees = data.map(emp => this.mapSupabaseEmployee(emp));

          // Добавляем демо-пользователей если их нет
          const demoEmployees = this.initializeDemoEmployees();
          const existingIds = new Set(employees.map(e => e.id));
          const missingEmployees = demoEmployees.filter(e => !existingIds.has(e.id));

          if (missingEmployees.length > 0) {
            console.log('🔧 Adding', missingEmployees.length, 'missing demo employees to Supabase list...');
            employees = [...employees, ...missingEmployees];
            console.log('✅ Added missing demo employees. Total:', employees.length);
          }

          this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
          console.log('✅ Loaded employees from Supabase:', employees.length);
          return employees;
        }
      } catch (err) {
        console.error('❌ Error loading employees from Supabase:', err);
      }
    }

    console.log('📦 Loading employees from localStorage (fallback)');
    let employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);

    // Всегда проверяем и добавляем демо-пользователей
    const demoEmployees = this.initializeDemoEmployees();
    const existingIds = new Set(employees.map(e => e.id));
    const missingEmployees = demoEmployees.filter(e => !existingIds.has(e.id));

    if (missingEmployees.length > 0) {
      console.log('🔧 Adding', missingEmployees.length, 'missing demo employees...');
      employees = [...employees, ...missingEmployees];
      this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
      console.log('✅ Added missing demo employees. Total:', employees.length);
    }

    // Также обновляем существующих демо-пользователей если их данные изменились
    const demoIds = new Set(demoEmployees.map(e => e.id));
    employees = employees.map(emp => {
      if (demoIds.has(emp.id)) {
        const demoEmp = demoEmployees.find(e => e.id === emp.id);
        if (demoEmp) {
          // Обновляем данные демо-пользователя
          return {
            ...emp,
            name: demoEmp.name,
            email: demoEmp.email,
            role: demoEmp.role,
            position: demoEmp.position,
            department: demoEmp.department,
            updated_at: new Date().toISOString()
          };
        }
      }
      return emp;
    });

    if (missingEmployees.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
    }

    console.log('📦 Loaded', employees.length, 'employees from localStorage');
    return employees;
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { password?: string }): Promise<Employee> {
    const newEmployee: Employee = {
      ...employee,
      id: `emp_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isOnline) {
      try {
        // 1. Создаем пользователя в Supabase Auth (если передан пароль)
        if (employee.password) {
          try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: newEmployee.email,
              password: employee.password,
              options: {
                data: {
                  name: newEmployee.name,
                  role: newEmployee.role,
                }
              }
            });

            if (authError) {
              // Если пользователь уже существует - это не критично, продолжаем
              if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
                console.log('⚠️ User already exists in Auth, skipping auth creation');
              } else {
                console.error('❌ Error creating auth user:', authError);
                console.error('❌ Auth error details:', JSON.stringify(authError, null, 2));
                // НЕ выбрасываем ошибку, продолжаем создание сотрудника
                console.log('⚠️ Continuing without auth user creation');
              }
            } else {
              console.log('✅ Created auth user:', authData.user?.id);
              console.log('✅ Auth user email confirmed:', authData.user?.email_confirmed_at);
              console.log('✅ Auth user needs confirmation:', authData.user?.email_confirmed_at === null);
            }
          } catch (authErr) {
            console.error('❌ Auth creation failed, continuing:', authErr);
            // Продолжаем создание сотрудника даже если Auth не удался
          }
        }

        // 2. Сначала удаляем старые записи с таким же email (избегаем дублирования)
        await supabase
          .from('employees')
          .delete()
          .eq('email', newEmployee.email);

        // 3. Создаем новую запись в таблице employees
        const { data, error } = await supabase
          .from('employees')
          .insert([{
            name: newEmployee.name,
            email: newEmployee.email,
            role: newEmployee.role as any,
            level: '1' as any, // По умолчанию уровень 1
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
        } else if (error) {
          console.error('❌ Error creating employee record:', error);
          throw new Error(`Ошибка создания записи: ${error.message}`);
        }
      } catch (err: any) {
        console.error('❌ Error creating employee in Supabase:', err);
        throw err;
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
    console.log('🔄 updateEmployee called:', { id, updates });

    if (this.isOnline) {
      try {
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Добавляем только те поля которые переданы
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.role !== undefined) updateData.role = updates.role;
        if (updates.level !== undefined) updateData.level = updates.level;
        if (updates.phone !== undefined) updateData.whatsapp = updates.phone;
        if (updates.department !== undefined) updateData.department = updates.department;
        if (updates.position !== undefined) updateData.position = updates.position;

        console.log('📤 Sending to Supabase:', updateData);

        const { data, error } = await supabase
          .from('employees')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        console.log('📥 Supabase response:', { data, error });

        if (!error && data) {
          const mapped = this.mapSupabaseEmployee(data);
          console.log('✅ Updated employee in Supabase:', id, 'new role:', mapped.role);

          // Обновляем в localStorage
          const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
          const index = employees.findIndex(e => e.id === id);
          if (index !== -1) {
            employees[index] = mapped;
            this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees);
          }

          return mapped;
        } else if (error) {
          console.error('❌ Supabase update error:', error);
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
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(proj => this.mapSupabaseProject(proj));
    } catch (err) {
      console.error('❌ Error loading projects from Supabase:', err);
      return this.getFromLocalStorage<Project>(STORAGE_KEYS.PROJECTS);
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const { data: sbData, error: sbError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (!sbError && sbData) {
        return this.mapSupabaseProject(sbData);
      }

      return null;
    } catch (err) {
      console.error('❌ Error getting project from Supabase:', err);
      return null;
    }
  }

  async createProject(project: any): Promise<Project> {
    try {
      const normalizeDate = (date: any): string => {
        if (!date) return new Date().toISOString().split('T')[0];
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        const parsed = new Date(date);
        return !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      };

      const sbPayload = {
        name: project.name || project.client?.name || 'Без названия',
        start_date: normalizeDate(project.contract?.serviceStartDate),
        deadline: normalizeDate(project.contract?.serviceEndDate),
        status: 'active',
        kpi_percentage: project.completion || 0,
        notes: JSON.stringify({ ...project, updated_at: new Date().toISOString() }),
      };

      const { data, error } = await supabase.from('projects').insert([sbPayload]).select().single();
      if (error) throw error;
      return this.mapSupabaseProject(data);
    } catch (err) {
      console.error('❌ Error creating project in Supabase:', err);
      throw err;
    }
  }

  async updateProject(id: string, updates: any): Promise<Project | null> {
    try {
      const { data: currentProject } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (currentProject) {
        const existingNotes = typeof currentProject.notes === 'string'
          ? JSON.parse(currentProject.notes)
          : currentProject.notes || {};

        const mergedNotes = { ...existingNotes, ...updates, updated_at: new Date().toISOString() };

        const { error: updateError } = await supabase
          .from('projects')
          .update({
            notes: JSON.stringify(mergedNotes),
            name: updates.name || updates.client?.name || existingNotes.name || 'Без названия',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (!updateError) return mergedNotes as Project;
      }

      throw new Error('Could not update project');
    } catch (err) {
      console.error('❌ Error updating project:', err);
      throw err;
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    try {
      await supabase.from('projects').delete().eq('id', id);
      return true;
    } catch (err) {
      console.error('❌ Error deleting project:', err);
      return false;
    }
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
    // Попытка распарсить notes как исходный объект проекта, если он сохранён при вставке
    let notes: any = undefined;
    try {
      const raw: any = (proj as any).notes;
      if (raw) {
        notes = typeof raw === 'string' ? JSON.parse(raw) : raw;

        // Логирование для отладки (только для первых проектов)
        if (import.meta.env.DEV && Math.random() < 0.1) { // 10% проектов
          console.log('🔍 mapSupabaseProject - парсинг notes:', {
            project_id: proj.id,
            project_name: proj.name,
            notes_type: typeof raw,
            notes_finances: notes?.finances,
            notes_finances_amount: notes?.finances?.amountWithoutVAT,
            notes_contract: notes?.contract,
            notes_amountWithoutVAT: notes?.amountWithoutVAT
          });
        }
      }
    } catch (err) {
      console.error('❌ Ошибка парсинга notes:', err, 'для проекта:', proj.id);
    }

    // Маппинг статуса из Supabase в UI
    const mappedStatus = (() => {
      // Пытаемся взять статус из notes, так как он там более точный (русский)
      const notesStatus = notes?.status;
      if (notesStatus && ['В работе', 'На проверке', 'Черновик', 'Завершён', 'Приостановлен'].includes(notesStatus)) {
        return notesStatus;
      }

      // Иначе маппим из enum
      switch (proj.status) {
        case 'in_progress': return 'В работе';
        case 'completed': return 'Завершён';
        case 'active': return 'В работе';
        default: return 'Черновик';
      }
    })();

    // Важно: не сливаем notes на верхний уровень, чтобы избежать дублей
    // Вместо этого возвращаем структуру где notes доступен отдельно
    const mapped: Project = {
      ...proj,
      status: mappedStatus,
      // Извлекаем только нужные поля из notes, без дублирования
      name: notes?.name || proj.name || notes?.client?.name || 'Без названия',
      clientName: notes?.clientName || notes?.client?.name,
      contractNumber: notes?.contractNumber || notes?.contract?.number,
      contractDate: notes?.contractDate || notes?.contract?.date,
      amountWithoutVAT: notes?.finances?.amountWithoutVAT ||
        notes?.contract?.amountWithoutVAT ||
        notes?.amountWithoutVAT ||
        notes?.amount,
      ourCompany: notes?.ourCompany || notes?.companyName,
      companyName: notes?.companyName || notes?.ourCompany,
      currency: notes?.contract?.currency || notes?.currency || 'KZT',
      // Извлекаем процент выполнения из notes или из kpi_percentage
      completionPercent: notes?.completionPercent || proj.kpi_percentage || 0,
      completion: notes?.completionPercent || notes?.completion || proj.kpi_percentage || 0,
      // Извлекаем команду и задачи из notes
      team: notes?.team || [],
      tasks: notes?.tasks || [],
      // Сохраняем notes отдельно для доступа к полным данным
      notes: notes,
      // Маппим contract если он есть в notes
      contract: notes?.contract || (notes?.contractNumber ? {
        number: notes.contractNumber,
        date: notes.contractDate,
        serviceEndDate: notes?.contract?.serviceEndDate || notes.serviceTerm || proj.deadline,
        serviceStartDate: notes?.contract?.serviceStartDate || proj.start_date,
        amountWithoutVAT: notes?.finances?.amountWithoutVAT ||
          notes?.contract?.amountWithoutVAT ||
          notes?.amountWithoutVAT,
        currency: notes?.contract?.currency || notes?.currency || 'KZT',
      } : undefined),
      // Маппим client если есть
      client: notes?.client || (notes?.clientName ? {
        name: notes.clientName,
        website: notes.clientWebsite,
        activity: notes.clientActivity,
        city: notes.clientCity,
        contacts: notes.client?.contacts || [],
      } : undefined),
    } as unknown as Project;

    return mapped;
  }


  // === PROJECT FILES ===

  /**
 * Загружает файл на локальный сервер (NAS) и сохраняет метаданные в Supabase
 */
  async uploadProjectFile(
    projectId: string,
    file: File,
    category: 'contract' | 'scan' | 'document' | 'screenshot' | 'other' = 'other',
    uploadedBy: string
  ): Promise<{ id: string; storagePath: string; publicUrl: string }> {
    try {
      const seafileUrl = import.meta.env.VITE_SEAFILE_URL;
      const seafileToken = import.meta.env.VITE_SEAFILE_TOKEN;
      const repoId = import.meta.env.VITE_SEAFILE_REPO_ID;

      if (!seafileUrl || !seafileToken || !repoId) {
        throw new Error('❌ Не настроены переменные VITE_SEAFILE_URL, VITE_SEAFILE_TOKEN или VITE_SEAFILE_REPO_ID.');
      }

      console.log(`📡 Получение ссылки для загрузки от Seafile...`);
      // Шаг 1: Получаем одноразовую ссылку для загрузки файла
      const uploadLinkRes = await fetch(`${seafileUrl}/api2/repos/${repoId}/upload-link/?p=/`, {
        headers: { 'Authorization': `Token ${seafileToken}` }
      });

      if (!uploadLinkRes.ok) {
        throw new Error(`Ошибка получения ссылки Seafile: ${uploadLinkRes.status}`);
      }

      const uploadUrlRaw = await uploadLinkRes.text();
      let uploadUrl = uploadUrlRaw.replace(/"/g, ''); // Seafile возвращает строку в кавычках

      // Заменяем оригинальный домен Seafile на наш прокси, чтобы избежать CORS
      uploadUrl = uploadUrl.replace(/^https?:\/\/[^/]+/, seafileUrl);

      // Шаг 2: Отправляем сам файл
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parent_dir', '/');
      formData.append('relative_path', projectId); // Создаем подпапку под проект

      console.log(`📤 Загрузка файла ${file.name} в Seafile, папка: /${projectId}...`);
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Token ${seafileToken}` }, // На всякий случай
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error(`Ошибка загрузки файла в Seafile: ${uploadRes.status}`);
      }

      // После успешной загрузки файл лежит по пути: /projectId/file.name
      // Готовим записи для нашей БД (Supabase)
      const storagePath = `/${projectId}/${file.name}`;
      const fileId = `${Date.now()}-${Math.round(Math.random() * 100000)}`;

      // Для фронтенда мы не можем сохранить постоянную ссылку на скачивание,
      // потому что Seafile-ссылки временные. Мы будем генерировать их при скачивании по требованию.
      // Сохраняем просто путь в Seafile и специальный флаг `isSeafile`
      const fileRecord = {
        id: fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storagePath: storagePath,
        category: category,
        uploadedBy: uploadedBy,
        uploadedAt: new Date().toISOString(),
        isSeafile: true,
        publicUrl: `seafile://${storagePath}` // Псевдо-ссылка
      };

      const project = await this.getProject(projectId);
      const existingNotes = (project as any)?.notes || {};
      const existingFiles = existingNotes.files || [];
      const updatedFiles = [...existingFiles, fileRecord];

      // Если это договор (contract), пропишем псевдо-ссылку еще и в contractScanUrl 
      // для обратной совместимости со старыми компонентами
      let updatedContract = existingNotes.contract;
      if (category === 'contract') {
        updatedContract = {
          ...existingNotes.contract,
          contractScanUrl: fileRecord.publicUrl
        };
      }

      await this.updateProject(projectId, {
        ...existingNotes,
        files: updatedFiles,
        ...(category === 'contract' ? { contract: updatedContract } : {})
      } as any);

      return {
        id: fileRecord.id,
        storagePath: fileRecord.storagePath,
        publicUrl: fileRecord.publicUrl
      };
    } catch (error) {
      console.error('❌ Ошибка в uploadProjectFile (Seafile):', error);
      throw error;
    }
  }

  /**
 * Получает список файлов проекта
 */
  async getProjectFiles(projectId: string): Promise<any[]> {
    try {
      const project = await this.getProject(projectId);
      let files = project?.notes?.files || [];

      // Извлекаем старые файлы из contractScanUrl (Supabase Storage)
      const oldContractUrl = project?.contract?.contractScanUrl || project?.notes?.contract?.contractScanUrl;
      const parsedOldFiles = [];
      if (oldContractUrl && oldContractUrl !== 'pending_upload') {
        parsedOldFiles.push({
          id: `old_contract_${projectId}`,
          fileName: 'Договор (старая версия)',
          fileType: 'application/pdf',
          fileSize: 0,
          storagePath: oldContractUrl,
          category: 'contract',
          uploadedBy: 'system',
          uploadedAt: project?.created_at || new Date().toISOString()
        });
      }

      // Пересчитываем publicUrl на лету, чтобы они всегда указывали на Seafile или Supabase
      const mappedFiles = files.map((file: any) => ({
        ...file,
        publicUrl: file.isSeafile
          ? `seafile://${file.storagePath}`
          : file.publicUrl || file.storagePath
      }));

      // Возвращаем объединенный массив
      return [...parsedOldFiles, ...mappedFiles];
    } catch (error) {
      console.error('❌ Ошибка при получении файлов:', error);
      return [];
    }
  }

  /**
 * Получить временную прямую ссылку на скачивание файла из Seafile
 */
  async getSeafileDownloadUrl(storagePath: string): Promise<string> {
    const seafileUrl = import.meta.env.VITE_SEAFILE_URL;
    const seafileToken = import.meta.env.VITE_SEAFILE_TOKEN;
    const repoId = import.meta.env.VITE_SEAFILE_REPO_ID;

    if (!seafileUrl || !seafileToken || !repoId) return '';

    try {
      // storagePath у нас вида /projectId/filename.pdf
      const encodedPath = encodeURIComponent(storagePath);
      const res = await fetch(`${seafileUrl}/api2/repos/${repoId}/file/?p=${encodedPath}`, {
        headers: { 'Authorization': `Token ${seafileToken}` }
      });

      if (!res.ok) throw new Error(`Ошибка получения ссылки из Seafile: ${res.status}`);
      const rawUrl = await res.text();
      return rawUrl.replace(/"/g, ''); // Получаем чистый URL
    } catch (e) {
      console.error('Ошибка в getSeafileDownloadUrl:', e);
      return '';
    }
  }

  /**
 * Удаляет файл проекта (из БД и с хранилища)
 */
  async deleteProjectFile(fileId: string, uploadedBy: string, projectId?: string): Promise<boolean> {
    try {
      if (!projectId) return false;

      const project = await this.getProject(projectId);
      const files = project?.notes?.files || [];
      const file = files.find((f: any) => f.id === fileId);

      if (file) {
        // 1. Физическое удаление
        try {
          if (file.isSeafile) {
            // Удаляем из Seafile API
            const seafileUrl = import.meta.env.VITE_SEAFILE_URL;
            const seafileToken = import.meta.env.VITE_SEAFILE_TOKEN;
            const repoId = import.meta.env.VITE_SEAFILE_REPO_ID;
            if (seafileUrl && seafileToken && repoId) {
              const encodedPath = encodeURIComponent(file.storagePath);
              await fetch(`${seafileUrl}/api2/repos/${repoId}/file/?p=${encodedPath}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${seafileToken}` }
              });
            }
          } else if (!fileId.startsWith('old_contract_') && this.fileApiUrl) {
            // Удаляем со старого локального NAS (легаси поддержка)
            await fetch(`${this.fileApiUrl}/files/${file.storagePath}`, {
              method: 'DELETE'
            });
          }
        } catch (e) {
          console.warn('⚠️ Не удалось удалить файл с сервера (продолжаем удаление метаданных):', e);
        }

        // 2. Удаляем метаданные из Supabase
        const updatedFiles = files.filter((f: any) => f.id !== fileId);

        // 3. Если это был старый контракт, удаляем contractScanUrl
        let updatedContract = project?.notes?.contract;
        if (fileId.startsWith('old_contract_') || file.category === 'contract') {
          updatedContract = {
            ...project?.notes?.contract,
            contractScanUrl: null
          };
        }

        await this.updateProject(projectId, {
          ...project?.notes,
          files: updatedFiles,
          ...(fileId.startsWith('old_contract_') || file.category === 'contract' ? { contract: updatedContract } : {})
        } as any);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Ошибка при удалении файла:', error);
      throw error;
    }
  }

  // === PROJECT AMENDMENTS ===

  /**
   * Создает доп соглашение для проекта
   */
  async createProjectAmendment(
    projectId: string,
    amendment: {
      number: string;
      date: string;
      description: string;
      fileUrl?: string;
    },
    createdBy: string
  ): Promise<any> {
    try {
      const { data, error } = await (supabase as any)
        .from('project_amendments')
        .insert({
          project_id: projectId,
          number: amendment.number,
          date: amendment.date,
          description: amendment.description,
          file_url: amendment.fileUrl || null,
          created_by: createdBy,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error creating project amendment:', error);
      throw error;
    }
  }

  /**
   * Получает список доп соглашений проекта
   */
  async getProjectAmendments(projectId: string): Promise<any[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('project_amendments')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error getting project amendments:', error);
      return [];
    }
  }

  /**
   * Удаляет доп соглашение
   */
  async deleteProjectAmendment(amendmentId: string): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('project_amendments')
        .delete()
        .eq('id', amendmentId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Error deleting project amendment:', error);
      throw error;
    }
  }

  // === WORK PAPERS (Рабочие документы) ===

  /**
   * Получает все рабочие документы проекта
   */
  async getWorkPapers(projectId: string): Promise<any[]> {
    try {
      console.log('🔍 Loading work papers for project:', projectId);
      // Сначала получаем work_papers (без JOIN - таблица work_paper_templates может не существовать)
      const { data: workPapers, error } = await (supabase as any)
        .from('work_papers')
        .select('*')
        .eq('project_id', projectId)
        .order('code', { ascending: true });

      console.log('📦 Work papers loaded:', workPapers?.length || 0, 'items');
      if (error) console.error('❌ Error loading work papers:', error);

      if (error) {
        // Если таблица не существует (404), возвращаем пустой массив
        const errorObj = error as any;
        const isTableNotFound =
          errorObj.code === 'PGRST116' ||
          errorObj.status === 404 ||
          errorObj.statusCode === 404 ||
          errorObj.message?.includes('relation') ||
          errorObj.message?.includes('does not exist') ||
          errorObj.message?.includes('relation "public.work_papers" does not exist') ||
          errorObj.details?.includes('relation') ||
          errorObj.hint?.includes('relation');

        if (isTableNotFound) {
          console.log('ℹ️ Work papers table does not exist yet. Migration may not be applied.');
          return [];
        }
        throw error;
      }

      if (!workPapers || workPapers.length === 0) {
        return [];
      }

      // Получаем уникальные user_id для загрузки профилей
      const userIds = new Set<string>();
      workPapers.forEach((wp: any) => {
        if (wp.assigned_to) userIds.add(wp.assigned_to);
        if (wp.reviewer_id) userIds.add(wp.reviewer_id);
      });

      // Загружаем профили
      const profilesMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', Array.from(userIds));

        if (profiles) {
          profiles.forEach((p: any) => {
            profilesMap.set(p.user_id, {
              id: p.user_id,
              name: p.display_name,
              email: p.email
            });
          });
        }
      }

      // Объединяем данные
      return workPapers.map((wp: any) => ({
        ...wp,
        assigned_user: wp.assigned_to ? profilesMap.get(wp.assigned_to) : null,
        reviewer: wp.reviewer_id ? profilesMap.get(wp.reviewer_id) : null
      }));
    } catch (error: any) {
      // Обрабатываем ошибки 404 (таблица не существует)
      // Проверяем все возможные форматы ошибки
      const isTableNotFound =
        error?.code === 'PGRST116' ||
        error?.status === 404 ||
        error?.statusCode === 404 ||
        error?.message?.includes('relation') ||
        error?.message?.includes('does not exist') ||
        error?.message?.includes('relation "public.work_papers" does not exist') ||
        error?.details?.includes('relation') ||
        error?.hint?.includes('relation') ||
        (typeof error === 'object' && error !== null && 'status' in error && error.status === 404);

      if (isTableNotFound) {
        console.log('ℹ️ Work papers table does not exist yet. Migration may not be applied.');
        return [];
      }
      // Только если это не ошибка отсутствия таблицы, выводим как ошибку
      console.error('❌ Error getting work papers:', error);
      return [];
    }
  }

  /**
   * Получает рабочий документ по ID
   */
  async getWorkPaper(workPaperId: string): Promise<any | null> {
    try {
      const { data: workPaper, error } = await (supabase as any)
        .from('work_papers')
        .select(`
          *,
          template:work_paper_templates(*)
        `)
        .eq('id', workPaperId)
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.status === 404 || error.message?.includes('relation')) {
          console.log('ℹ️ Work papers table does not exist yet.');
          return null;
        }
        throw error;
      }

      if (!workPaper) return null;

      // Загружаем профили для assigned_to и reviewer_id
      const userIds = new Set<string>();
      if (workPaper.assigned_to) userIds.add(workPaper.assigned_to);
      if (workPaper.reviewer_id) userIds.add(workPaper.reviewer_id);

      const profilesMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', Array.from(userIds));

        if (profiles) {
          profiles.forEach((p: any) => {
            profilesMap.set(p.user_id, {
              id: p.user_id,
              name: p.display_name,
              email: p.email
            });
          });
        }
      }

      return {
        ...workPaper,
        assigned_user: workPaper.assigned_to ? profilesMap.get(workPaper.assigned_to) : null,
        reviewer: workPaper.reviewer_id ? profilesMap.get(workPaper.reviewer_id) : null
      };
    } catch (error: any) {
      if (error?.code === 'PGRST116' || error?.status === 404 || error?.message?.includes('relation')) {
        console.log('ℹ️ Work papers table does not exist yet.');
        return null;
      }
      console.error('❌ Error getting work paper:', error);
      return null;
    }
  }

  /**
   * Обновляет рабочий документ
   */
  async updateWorkPaper(
    workPaperId: string,
    updates: {
      data?: Record<string, any>;
      status?: string;
      review_history?: any[];
      started_at?: string;
      completed_at?: string;
      assigned_to?: string;
    }
  ): Promise<any | null> {
    try {
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.data !== undefined) {
        updatePayload.data = updates.data;
      }
      if (updates.status !== undefined) {
        updatePayload.status = updates.status;
      }
      if (updates.review_history !== undefined) {
        updatePayload.review_history = updates.review_history;
      }
      if (updates.started_at !== undefined) {
        updatePayload.started_at = updates.started_at;
      }
      if (updates.completed_at !== undefined) {
        updatePayload.completed_at = updates.completed_at;
      }
      if (updates.assigned_to !== undefined) {
        updatePayload.assigned_to = updates.assigned_to;
      }

      const { data, error } = await (supabase as any)
        .from('work_papers')
        .update(updatePayload)
        .eq('id', workPaperId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.status === 404 || error.message?.includes('relation')) {
          console.log('ℹ️ Work papers table does not exist yet.');
          return null;
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      if (error?.code === 'PGRST116' || error?.status === 404 || error?.message?.includes('relation')) {
        console.log('ℹ️ Work papers table does not exist yet.');
        return null;
      }
      console.error('❌ Error updating work paper:', error);
      throw error;
    }
  }

  /**
   * Создает рабочие документы из шаблона методологии для проекта
   */
  async createWorkPapersFromTemplate(
    projectId: string,
    methodologyId: string,
    teamMembers: Array<{ userId: string; role: string }>
  ): Promise<number> {
    try {
      // Проверяем, существует ли таблица work_papers
      // Если нет, возвращаем 0 (миграция не применена)
      const testQuery = await (supabase as any)
        .from('work_papers')
        .select('id')
        .limit(1);

      if (testQuery.error) {
        if (testQuery.error.code === 'PGRST116' || testQuery.error.status === 404 || testQuery.error.message?.includes('relation')) {
          console.log('ℹ️ Work papers table does not exist yet. Migration needs to be applied.');
          return 0;
        }
      }

      // Вызываем SQL функцию для автоматического создания документов
      const { data, error } = await supabase.rpc('create_work_papers_from_template', {
        p_project_id: projectId,
        p_methodology_id: methodologyId
      });

      if (error) {
        if (error.code === 'PGRST116' || error.status === 404 || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.log('ℹ️ create_work_papers_from_template function does not exist yet. Migration needs to be applied.');
          return 0;
        }
        throw error;
      }

      const createdCount = data || 0;

      // Назначаем исполнителей на основе ролей команды
      if (createdCount > 0 && teamMembers.length > 0) {
        const workPapers = await this.getWorkPapers(projectId);

        for (const wp of workPapers) {
          if (wp.template?.default_assignee_role) {
            // Ищем подходящего члена команды по роли
            const teamMember = teamMembers.find(tm => {
              const role = tm.role.toLowerCase();
              const defaultRole = wp.template.default_assignee_role.toLowerCase();

              // Маппинг ролей
              if (defaultRole === 'assistant') {
                return role.includes('assistant');
              } else if (defaultRole === 'supervisor') {
                return role.includes('supervisor') || role.includes('senior');
              } else if (defaultRole === 'manager') {
                return role.includes('manager') || role === 'pm';
              } else if (defaultRole === 'partner') {
                return role === 'partner';
              } else if (defaultRole === 'tax') {
                return role.includes('tax');
              }
              return false;
            });

            if (teamMember) {
              await this.updateWorkPaper(wp.id, {
                assigned_to: teamMember.userId
              });
            }
          }
        }
      }

      return createdCount;
    } catch (error) {
      console.error('❌ Error creating work papers from template:', error);
      throw error;
    }
  }

  /**
   * Создает отдельный workpaper
   */
  async createWorkPaper(workPaper: {
    project_id: string;
    code: string;
    name: string;
    status: string;
    data?: any;
  }): Promise<any> {
    try {
      console.log('✏️ Creating work paper:', workPaper.code, 'for project:', workPaper.project_id);
      const { data, error } = await (supabase as any)
        .from('work_papers')
        .insert({
          project_id: workPaper.project_id,
          code: workPaper.code,
          name: workPaper.name,
          status: workPaper.status,
          data: workPaper.data || {}
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Work paper created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Error creating work paper:', error);
      throw error;
    }
  }

  /**
   * Удаляет work paper
   */
  async deleteWorkPaper(workPaperId: string): Promise<void> {
    try {
      const { error } = await (supabase as any)
        .from('work_papers')
        .delete()
        .eq('id', workPaperId);

      if (error) throw error;
      console.log('🗑️ Work paper deleted:', workPaperId);
    } catch (error) {
      console.error('❌ Error deleting work paper:', error);
      throw error;
    }
  }

  /**
   * Получает методологии
   */
  async getMethodologies(): Promise<any[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('methodologies')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error getting methodologies:', error);
      return [];
    }
  }

  /**
   * Получает шаблоны методологии
   */
  async getMethodologyTemplates(methodologyId: string): Promise<any[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('work_paper_templates')
        .select(`
          *,
          section:methodology_sections(*)
        `)
        .eq('section.methodology_id', methodologyId)
        .order('section.order_index', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error getting methodology templates:', error);
      return [];
    }
  }
}

// Экспорт singleton
export const supabaseDataStore = new SupabaseDataStore();

