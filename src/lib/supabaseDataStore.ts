/**
 * Унифицированное хранилище данных с Supabase интеграцией
 * Стратегия: Supabase как основное хранилище, localStorage как fallback
 */

import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { mapWorkflowStatusToSupabaseStatus } from '@/lib/projectWorkflow';
import { apiDelete, apiGet, apiPost, apiPostFormData } from '@/lib/api';
import { dedupeProjectFiles } from '@/lib/contractData';
import {
  getProjectNotes,
  mergeProjectNotes,
  parseProjectNotes,
  serializeProjectNotes,
} from '@/lib/projectNotes';
import type {
  CanonicalProjectFinances,
  CanonicalProjectNotes,
  CanonicalTeamMember,
} from '@/types/project-domain';

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

export type EmployeeCreateInput = Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'password'> & {
  password?: string | null;
};

export interface BulkDeleteResult {
  deletedIds: string[];
  failedIds: string[];
}

export type ProjectUiStatus =
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'draft'
  | 'approval'
  | 'approved'
  | 'cancelled'
  | 'В работе'
  | 'На проверке'
  | 'Черновик'
  | 'Завершён'
  | 'Приостановлен';

export interface Project extends Omit<SupabaseProject, 'notes' | 'status'> {
  status: ProjectUiStatus;
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
  companyName?: string;
  company?: string;
  currency?: string;
  files?: any[];
  team: CanonicalTeamMember[];
  tasks: any[];
  contract?: any;
  client?: any;
  finances?: CanonicalProjectFinances;
  updated_at: string | null;
  notes: CanonicalProjectNotes;
  notesParseError?: string;
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

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function uniqueIdChunks(ids: Iterable<string>, size = 50): string[][] {
  const unique = Array.from(new Set(Array.from(ids, (id) => String(id).trim()).filter(Boolean)));
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += size) chunks.push(unique.slice(index, index + size));
  return chunks;
}

export function mapSupabaseProjectRow(proj: SupabaseProject): Project {
  const parsed = parseProjectNotes(proj.notes);
  const notes = parsed.ok ? parsed.value : {};
  const contract = recordValue(notes.contract);
  const client = recordValue(notes.client);
  const finances = notes.finances;
  const notesStatus = typeof notes.status === 'string' ? notes.status : undefined;
  const status: ProjectUiStatus = notesStatus
    ? notesStatus as ProjectUiStatus
    : proj.status === 'completed'
      ? 'completed'
      : 'В работе';
  const notesName = typeof notes.name === 'string' ? notes.name : undefined;
  const clientName = typeof notes.clientName === 'string'
    ? notes.clientName
    : typeof client.name === 'string' ? client.name : undefined;
  const companyName = typeof notes.companyName === 'string'
    ? notes.companyName
    : typeof notes.ourCompany === 'string' ? notes.ourCompany : undefined;

  return {
    ...proj,
    status,
    notes,
    ...(parsed.ok ? {} : { notesParseError: parsed.error }),
    name: notesName || proj.name || clientName || 'Без названия',
    clientName,
    contractNumber: typeof notes.contractNumber === 'string'
      ? notes.contractNumber
      : typeof contract.number === 'string' ? contract.number : undefined,
    contractDate: typeof notes.contractDate === 'string'
      ? notes.contractDate
      : typeof contract.date === 'string' ? contract.date : undefined,
    amountWithoutVAT: Number(finances?.amountWithoutVAT)
      || Number(contract.amountWithoutVAT)
      || Number(notes.amountWithoutVAT)
      || Number(notes.amount)
      || 0,
    ourCompany: typeof notes.ourCompany === 'string' ? notes.ourCompany : companyName,
    companyName,
    company: companyName,
    currency: typeof contract.currency === 'string'
      ? contract.currency
      : typeof notes.currency === 'string' ? notes.currency : 'KZT',
    completionPercent: typeof notes.completionPercent === 'number'
      ? notes.completionPercent
      : proj.kpi_percentage || 0,
    completion: typeof notes.completionPercent === 'number'
      ? notes.completionPercent
      : typeof notes.completion === 'number' ? notes.completion : proj.kpi_percentage || 0,
    team: Array.isArray(notes.team) ? notes.team : [],
    tasks: Array.isArray(notes.tasks) ? notes.tasks : [],
    files: Array.isArray(notes.files) ? notes.files : undefined,
    finances,
    contract: Object.keys(contract).length > 0 ? contract : undefined,
    client: Object.keys(client).length > 0 ? client : undefined,
  };
}

class SupabaseDataStore {
  private isOnline: boolean = false;

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

  async getEmployees(): Promise<Employee[]> {
    const online = this.isOnline || await this.checkConnection();
    if (online) {
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
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);

    console.log('📦 Loaded', employees.length, 'employees from localStorage');
    return employees;
  }

  async createEmployee(employee: EmployeeCreateInput): Promise<Employee> {
    const newEmployee: Employee = {
      ...employee,
      password: employee.password ?? null,
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
              email: newEmployee.email!,
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
          .eq('email', newEmployee.email!);

        // 3. Создаем новую запись в таблице employees
        const { data, error } = await supabase
          .from('employees')
          .insert([{
            name: newEmployee.name,
            email: newEmployee.email,
            password: employee.password || null,
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

  async deleteEmployees(ids: Iterable<string>): Promise<BulkDeleteResult> {
    const idChunks = uniqueIdChunks(ids);
    const requestedIds = idChunks.flat();
    if (requestedIds.length === 0) return { deletedIds: [], failedIds: [] };

    if (this.isOnline) {
      const failed = new Set<string>();
      for (const chunk of idChunks) {
        const { error } = await supabase.from('employees').delete().in('id', chunk);
        if (error) {
          console.error('❌ Bulk employee delete failed:', error);
          chunk.forEach((id) => failed.add(id));
        }
      }

      const remaining = new Set<string>();
      for (const chunk of idChunks) {
        const { data, error } = await supabase.from('employees').select('id').in('id', chunk);
        if (error) {
          chunk.forEach((id) => failed.add(id));
          continue;
        }
        (data || []).forEach((row) => remaining.add(String(row.id)));
      }
      remaining.forEach((id) => failed.add(id));
      const deletedIds = requestedIds.filter((id) => !failed.has(id));
      const localEmployees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES)
        .filter((employee) => !deletedIds.includes(String(employee.id)));
      this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, localEmployees);
      return { deletedIds, failedIds: requestedIds.filter((id) => failed.has(id)) };
    }

    const requested = new Set(requestedIds);
    const employees = this.getFromLocalStorage<Employee>(STORAGE_KEYS.EMPLOYEES);
    const existing = new Set(employees.map((employee) => String(employee.id)));
    const deletedIds = requestedIds.filter((id) => existing.has(id));
    this.saveToLocalStorage(STORAGE_KEYS.EMPLOYEES, employees.filter((employee) => !requested.has(String(employee.id))));
    return { deletedIds, failedIds: requestedIds.filter((id) => !existing.has(id)) };
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
        status: mapWorkflowStatusToSupabaseStatus(project.status || project.notes?.status || 'pending_approval'),
        kpi_percentage: project.completion || 0,
        notes: JSON.stringify({ ...project, updated_at: new Date().toISOString() }),
      };

      const { data, error } = await supabase.from('projects').insert(sbPayload).select().single();
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
        const existingNotes = getProjectNotes({ notes: currentProject.notes });
        const { notes: updateNotes, ...noteFields } = updates || {};
        const notesPatch: Partial<CanonicalProjectNotes> = updateNotes && typeof updateNotes === 'object'
          ? updateNotes
          : {};
        const nextWorkflowStatus = updates.status
          || notesPatch.status
          || existingNotes.status
          || currentProject.status
          || 'active';
        const nextCompletion = updates.completionPercent
          ?? updates.completion
          ?? existingNotes.completionPercent
          ?? currentProject.kpi_percentage
          ?? 0;
        const mergedNotes = mergeProjectNotes(currentProject.notes, {
          ...noteFields,
          ...notesPatch,
          status: String(nextWorkflowStatus),
          completionPercent: Number(nextCompletion),
          updated_at: new Date().toISOString(),
        });

        const supabaseStatus = mapWorkflowStatusToSupabaseStatus(nextWorkflowStatus);
        const serializedNotes = serializeProjectNotes(mergedNotes);
        const nextName = updates.name
          || updates.client?.name
          || (typeof existingNotes.name === 'string' ? existingNotes.name : undefined)
          || currentProject.name
          || 'Без названия';
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            notes: serializedNotes,
            name: nextName,
            status: supabaseStatus,
            kpi_percentage: Number(nextCompletion),
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (!updateError) {
          return this.mapSupabaseProject({
            ...currentProject,
            name: nextName,
            notes: serializedNotes,
            status: supabaseStatus,
            kpi_percentage: Number(nextCompletion),
            updated_at: new Date().toISOString()
          } as SupabaseProject);
        }
      }

      throw new Error('Could not update project');
    } catch (err) {
      console.error('❌ Error updating project:', err);
      throw err;
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    try {
      const relatedTables = ['project_files', 'project_amendments', 'project_data'] as const;
      for (const table of relatedTables) {
        const { error } = await supabase.from(table as any).delete().eq('project_id', id);
        if (error) {
          console.warn(`Could not clean ${table} for project ${id}:`, error);
        }
      }

      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;

      const { data: stillExists, error: verifyError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (verifyError) throw verifyError;
      if (stillExists) {
        throw new Error('Project was not deleted. Check database delete permissions.');
      }

      return true;
    } catch (err) {
      console.error('❌ Error deleting project:', err);
      throw err;
    }
  }

  async deleteProjects(ids: Iterable<string>): Promise<BulkDeleteResult> {
    const idChunks = uniqueIdChunks(ids);
    const requestedIds = idChunks.flat();
    if (requestedIds.length === 0) return { deletedIds: [], failedIds: [] };

    const failed = new Set<string>();
    for (const chunk of idChunks) {
      try {
        for (const table of ['project_files', 'project_amendments', 'project_data'] as const) {
          const { error } = await supabase.from(table as any).delete().in('project_id', chunk);
          if (error && error.code !== '42P01' && error.code !== '42703') {
            console.warn(`Could not bulk clean ${table}:`, error);
          }
        }
        const { error } = await supabase.from('projects').delete().in('id', chunk);
        if (error) throw error;
      } catch (error) {
        console.error('❌ Bulk project delete failed:', error);
        chunk.forEach((id) => failed.add(id));
      }
    }

    for (const chunk of idChunks) {
      const { data, error } = await supabase.from('projects').select('id').in('id', chunk);
      if (error) {
        chunk.forEach((id) => failed.add(id));
        continue;
      }
      (data || []).forEach((row) => failed.add(String(row.id)));
    }

    const deletedIds = requestedIds.filter((id) => !failed.has(id));
    const projects = this.getFromLocalStorage<Project>(STORAGE_KEYS.PROJECTS)
      .filter((project) => !deletedIds.includes(String(project.id)));
    this.saveToLocalStorage(STORAGE_KEYS.PROJECTS, projects);
    return { deletedIds, failedIds: requestedIds.filter((id) => failed.has(id)) };
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
    return mapSupabaseProjectRow(proj);
  }


  // === PROJECT FILES ===

  private async uploadFileDirectToSeafile(params: {
    projectId?: string;
    taskId?: string;
    file: File;
    category?: string;
    uploadedBy: string;
  }): Promise<any> {
    const { projectId, taskId, file, category = 'other', uploadedBy } = params;
    const linkResponse = await apiPost<{
      uploadUrl: string;
      form: {
        fileField?: string;
        fileName?: string;
        storedName?: string;
        parentDir?: string;
        relativePath?: string;
        replace?: string;
      };
      file: any;
    }>('/api/seafile/upload-link', {
      projectId,
      taskId,
      category,
      uploadedBy,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size || 0,
    });

    if (linkResponse.error || !linkResponse.data?.uploadUrl || !linkResponse.data?.file) {
      throw new Error(linkResponse.error || 'Could not create Seafile upload link');
    }

    const form = linkResponse.data.form || {};
    const fallbackRelativePath = taskId ? `tasks/${taskId}` : projectId || '';
    const formData = new FormData();
    formData.append(form.fileField || 'file', file, form.fileName || form.storedName || file.name);
    formData.append('parent_dir', form.parentDir || '/');
    formData.append('relative_path', form.relativePath || fallbackRelativePath);
    formData.append('replace', form.replace || '0');

    const uploadResponse = await fetch(linkResponse.data.uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const details = await uploadResponse.text().catch(() => '');
      throw new Error(`Seafile direct upload failed: HTTP ${uploadResponse.status}${details ? ` ${details}` : ''}`);
    }

    return linkResponse.data.file;
  }

  /**
 * Загружает файл на локальный сервер (NAS) и сохраняет метаданные в Supabase
 */
  async uploadProjectFile(
    projectId: string,
    file: File,
    category: 'contract' | 'scan' | 'document' | 'screenshot' | 'other' = 'other',
    uploadedBy: string
  ): Promise<{ id: string; storagePath: string; publicUrl: string; file?: any }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('category', category);
      formData.append('uploadedBy', uploadedBy);

      console.log(`📤 Загрузка файла ${file.name} в Seafile через backend proxy, папка: /${projectId}...`);
      let fileRecord: any;
      try {
        fileRecord = await this.uploadFileDirectToSeafile({
          projectId,
          file,
          category,
          uploadedBy,
        });
      } catch (directError) {
        console.warn('Direct Seafile upload unavailable, falling back to upload proxy:', directError);
      }

      if (!fileRecord) {
      try {
        const uploadResponse = await apiPostFormData<{ file: any }>('/api/seafile/upload', formData);
        if (uploadResponse.error || !uploadResponse.data?.file) {
          throw new Error(uploadResponse.error || 'Пустой ответ сервера Seafile upload proxy');
        }
        fileRecord = uploadResponse.data.file;
      } catch (proxyError) {
        console.error('Seafile upload proxy failed:', proxyError);
        throw proxyError;
        /*
        const bucketName = category === 'contract'
          ? 'contracts'
          : category === 'document'
            ? 'documents'
            : 'project-files';
        const safeFileName = safeStorageFileName(file);
        const storagePath = `${projectId}/${Date.now()}-${safeFileName}`;

        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (storageError) {
          throw storageError;
        }

        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);

        fileRecord = {
          id: `file_${Date.now()}`,
          name: file.name,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size || 0,
          storagePath,
          publicUrl: publicUrlData.publicUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy,
          category,
        };
        */
      }
      }
      const storagePath = fileRecord.storagePath || fileRecord.path || fileRecord.filePath || '';
      const publicUrl = fileRecord.publicUrl || fileRecord.url || (storagePath ? `seafile://${storagePath}` : '');
      const normalizedFileRecord = {
        ...fileRecord,
        id: fileRecord.id || `file_${Date.now()}`,
        projectId,
        fileName: fileRecord.fileName || fileRecord.name || file.name,
        name: fileRecord.name || fileRecord.fileName || file.name,
        fileType: fileRecord.fileType || fileRecord.type || file.type || 'application/octet-stream',
        fileSize: fileRecord.fileSize || fileRecord.size || file.size || 0,
        storagePath,
        uploadedBy,
        uploadedAt: fileRecord.uploadedAt || fileRecord.createdAt || new Date().toISOString(),
        category,
        publicUrl,
        url: publicUrl,
      };

      const project = await this.getProject(projectId);
      const existingNotes = (project as any)?.notes || {};
      const existingFiles = existingNotes.files || [];
      const fileKey = normalizedFileRecord.id || normalizedFileRecord.storagePath || normalizedFileRecord.publicUrl;
      const updatedFiles = dedupeProjectFiles([
        ...existingFiles.filter((item: any) => {
          const itemKey = item?.id || item?.storagePath || item?.publicUrl || item?.url;
          return !fileKey || itemKey !== fileKey;
        }),
        normalizedFileRecord,
      ]);

      // Если это договор (contract), пропишем псевдо-ссылку еще и в contractScanUrl 
      // для обратной совместимости со старыми компонентами
      let updatedContract = existingNotes.contract;
      if (category === 'contract') {
        updatedContract = {
          ...existingNotes.contract,
          contractScanUrl: publicUrl
        };
      }

      try {
        await this.updateProject(projectId, {
          ...existingNotes,
          files: updatedFiles,
          ...(category === 'contract' ? { contract: updatedContract } : {})
        } as any);
      } catch (metadataError) {
        console.warn('Could not sync uploaded file metadata to project notes:', metadataError);
      }

      return {
        id: normalizedFileRecord.id,
        storagePath,
        publicUrl,
        file: normalizedFileRecord
      };
    } catch (error) {
      console.error('❌ Ошибка в uploadProjectFile (Seafile):', error);
      throw error;
    }
  }

  /**
 * Получает список файлов проекта
 */
  // Кеш: какие проекты уже проверены в Seafile (в рамках сессии)
  private _seafileSyncedIds = new Set<string>();

  async getProjectFiles(projectId: string): Promise<any[]> {
    try {
      const project = await this.getProject(projectId);
      let files = project?.notes?.files || [];

      // Синхронизация из Seafile — только если files пуст И ещё не проверяли этот проект
      if ((!files || files.length === 0) && !this._seafileSyncedIds.has(projectId)) {
        this._seafileSyncedIds.add(projectId);
        let synced = await this.syncProjectFilesFromSeafile(projectId);
        if (synced.length === 0) {
          const notesId = (project as any)?.notes?.id || (project as any)?.id;
          if (notesId && notesId !== projectId) {
            synced = await this.syncProjectFilesFromSeafile(notesId, projectId);
          }
        }
        if (synced.length > 0) {
          files = synced;
        }
      }

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

      // Пересчитываем publicUrl на лету
      const mappedFiles = files.map((file: any) => ({
        ...file,
        publicUrl: file.isSeafile
          ? `seafile://${file.storagePath}`
          : file.publicUrl || file.storagePath
      }));

      return [...parsedOldFiles, ...mappedFiles];
    } catch (error) {
      console.error('❌ Ошибка при получении файлов:', error);
      return [];
    }
  }

  /**
 * Получить временную прямую ссылку на скачивание файла из Seafile.
 * Важно: токен Seafile хранится только на сервере; frontend ходит в наш proxy.
 */
  async getSeafileDownloadUrl(storagePath: string): Promise<string> {
    if (!storagePath) return '';

    try {
      const response = await apiGet<{ url: string }>(`/api/seafile/download-url?path=${encodeURIComponent(storagePath)}`);
      if (response.error || !response.data?.url) {
        throw new Error(response.error || 'Пустой ответ сервера Seafile proxy');
      }
      return response.data.url;
    } catch (e) {
      console.error('Ошибка в getSeafileDownloadUrl:', e);
      return '';
    }
  }

  /**
   * Получить список файлов из Seafile для папки проекта и синхронизировать с notes.files
   */
  async syncProjectFilesFromSeafile(projectId: string, supabaseUUID?: string): Promise<any[]> {
    try {
      const listResponse = await apiGet<{ entries: any[] }>(`/api/seafile/list?path=${encodeURIComponent(`/${projectId}`)}`);
      if (listResponse.error || !listResponse.data?.entries) return [];

      const entries = listResponse.data.entries;
      const seafileFiles = entries
        .filter((e: any) => e.type === 'file')
        .map((e: any) => ({
          id: `sf_${e.id || Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileName: e.name,
          name: e.name,
          fileType: e.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          fileSize: e.size || 0,
          storagePath: `/${projectId}/${e.name}`,
          category: e.name.toLowerCase().match(/договор|contract|dogovor/) ? 'contract' : 'document',
          uploadedBy: 'seafile',
          uploadedAt: e.mtime ? new Date(e.mtime * 1000).toISOString() : new Date().toISOString(),
          isSeafile: true,
          publicUrl: `seafile:///${projectId}/${e.name}`,
        }));

      if (seafileFiles.length === 0) return [];

      // Синхронизируем: обновляем notes.files в Supabase
      const saveId = supabaseUUID || projectId;
      const project = await this.getProject(saveId);
      const existingNotes = (project as any)?.notes || {};
      const existingFiles: any[] = existingNotes.files || [];

      // Мержим: оставляем существующие + добавляем из Seafile которых нет
      const existingPaths = new Set(existingFiles.map((f: any) => f.storagePath || f.fileName));
      const newFiles = seafileFiles.filter(sf => !existingPaths.has(sf.storagePath) && !existingPaths.has(sf.fileName));

      if (newFiles.length > 0) {
        const mergedFiles = [...existingFiles, ...newFiles];
        try {
          await this.updateProject(saveId, { files: mergedFiles });
        } catch (e) {
          console.error('Error syncing files to notes:', e);
        }
        return mergedFiles;
      }

      return existingFiles.length > 0 ? existingFiles : seafileFiles;
    } catch (e) {
      console.error('Error listing Seafile dir:', e);
      return [];
    }
  }

  /**
 * Загружает файл задачи в Seafile (папка /tasks/{taskId}/)
 * Возвращает метаданные файла для сохранения в task.checklist
 */
  async uploadTaskFile(
    taskId: string,
    file: File,
    uploadedBy: string
  ): Promise<{ id: string; name: string; size: number; storagePath: string; uploadedAt: string; uploadedBy: string }> {
    try {
      const directFile = await this.uploadFileDirectToSeafile({
        taskId,
        file,
        uploadedBy,
      });
      if (directFile) return directFile;
    } catch (directError) {
      console.warn('Direct task Seafile upload unavailable, falling back to upload proxy:', directError);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', taskId);
    formData.append('uploadedBy', uploadedBy);

    const uploadResponse = await apiPostFormData<{ file: { id: string; name: string; size: number; storagePath: string; uploadedAt: string; uploadedBy: string } }>(
      '/api/seafile/upload',
      formData
    );
    if (uploadResponse.error || !uploadResponse.data?.file) {
      throw new Error(uploadResponse.error || 'Пустой ответ сервера Seafile upload proxy');
    }

    return uploadResponse.data.file;
  }

  /**
 * Удаляет файл задачи из Seafile (только физическое удаление)
 */
  async deleteTaskFileFromSeafile(storagePath: string): Promise<void> {
    if (!storagePath) return;
    try {
      const response = await apiDelete(`/api/seafile/file?path=${encodeURIComponent(storagePath)}`);
      if (response.error) {
        console.warn('Не удалось удалить файл задачи из Seafile:', response.error);
      }
    } catch (e) {
      console.warn('Не удалось удалить файл задачи из Seafile:', e);
    }
  }

  /**
 * Удаляет файл проекта (из БД и с хранилища)
 */
  async deleteProjectFile(fileId: string, _uploadedBy: string, projectId?: string): Promise<boolean> {
    try {
      if (!projectId) return false;

      const project = await this.getProject(projectId);
      const files = project?.notes?.files || [];
      const file = files.find((f: any) => f.id === fileId);

      if (file) {
        // 1. Физическое удаление
        try {
          if (file.isSeafile && file.storagePath) {
            await apiDelete(`/api/seafile/file?path=${encodeURIComponent(file.storagePath)}`);
          } else if (!fileId.startsWith('old_contract_') && this.fileApiUrl && file.storagePath) {
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
      const fallback = {
        id: `amend_${Date.now()}`,
        project_id: projectId,
        projectId,
        number: amendment.number,
        date: amendment.date,
        description: amendment.description,
        file_url: amendment.fileUrl || null,
        fileUrl: amendment.fileUrl || undefined,
        created_by: createdBy,
        createdBy,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const project = await this.getProject(projectId);
      const existingNotes = (project as any)?.notes || {};
      const existingAmendments = existingNotes.amendments || existingNotes.contract?.amendments || [];
      const updatedAmendments = [
        fallback,
        ...existingAmendments.filter((item: any) => String(item?.id) !== fallback.id),
      ];
      await this.updateProject(projectId, {
        ...existingNotes,
        amendments: updatedAmendments,
        contract: {
          ...(existingNotes.contract || {}),
          amendments: updatedAmendments,
        },
      } as any);
      return fallback;
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
      if (data && data.length > 0) return data;
    } catch (error) {
      console.error('❌ Error getting project amendments:', error);
    }

    try {
      const project = await this.getProject(projectId);
      const notes = (project as any)?.notes || {};
      return notes.amendments || notes.contract?.amendments || [];
    } catch (fallbackError) {
      console.error('❌ Error getting project amendments fallback:', fallbackError);
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
      return false;
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
      const { data, error } = await supabase.rpc('create_work_papers_from_template' as any, {
        p_project_id: projectId,
        p_methodology_id: methodologyId
      });

      if (error) {
        if (error.code === 'PGRST116' || (error as any).status === 404 || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.log('ℹ️ create_work_papers_from_template function does not exist yet. Migration needs to be applied.');
          return 0;
        }
        throw error;
      }

      const createdCount: number = typeof data === 'number' ? data : 0;

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

      return createdCount as number;
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



