import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];
type Project = Database['public']['Tables']['projects']['Row'] & {
  company?: Company;
  partner?: Employee;
  pm?: Employee;
  team?: Array<{
    id: string;
    employee: Employee;
    role_on_project: string;
  }>;
  tasks?: Task[];
  completion_percentage?: number;
};
type Task = Database['public']['Tables']['tasks']['Row'] & {
  project?: Project;
  reporter_employee?: Employee;
  assignee_employees?: Employee[];
};
type ProjectTeamMember = Database['public']['Tables']['project_team']['Row'];

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка данных
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем компании
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .eq('active', true)
        .order('name');

      if (companiesError) throw companiesError;

      // Загружаем сотрудников
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (employeesError) throw employeesError;

      // Загружаем проекты
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Загружаем задачи
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Используем базовые данные для демонстрации
      setCompanies(companiesData || []);
      setEmployees(employeesData || []);
      setProjects(projectsData || []);
      setTasks(tasksData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  // Создание проекта
  const createProject = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error creating project:', err);
      throw err;
    }
  };

  // Обновление проекта
  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error updating project:', err);
      throw err;
    }
  };

  // Создание задачи
  const createTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error creating task:', err);
      throw err;
    }
  };

  // Обновление задачи
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error updating task:', err);
      throw err;
    }
  };

  // Массовое обновление задач
  const bulkUpdateTasks = async (taskIds: string[], updates: Partial<Task>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .in('id', taskIds)
        .select();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error bulk updating tasks:', err);
      throw err;
    }
  };

  // Добавление участника в команду проекта
  const addTeamMember = async (projectId: string, employeeId: string, role: string) => {
    try {
      const { data, error } = await supabase
        .from('project_team')
        .insert([{
          project_id: projectId,
          employee_id: employeeId,
          role_on_project: role
        }])
        .select()
        .single();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error adding team member:', err);
      throw err;
    }
  };

  // Создание стартовых задач для проекта
  const createStarterTasks = async (projectId: string) => {
    const starterTasks = [
      {
        project_id: projectId,
        title: 'Бриф клиента',
        description: 'Сбор и анализ требований клиента',
        priority: 'high' as const,
        status: 'todo' as const,
        estimate_h: 8,
        spent_h: 0,
        assignees: [],
        labels: ['планирование'],
        checklist: [],
        attachments: [],
        comments: []
      },
      {
        project_id: projectId,
        title: 'План проекта',
        description: 'Разработка детального плана выполнения проекта',
        priority: 'high' as const,
        status: 'todo' as const,
        estimate_h: 16,
        spent_h: 0,
        assignees: [],
        labels: ['планирование'],
        checklist: [],
        attachments: [],
        comments: []
      },
      {
        project_id: projectId,
        title: 'Матрица рисков',
        description: 'Идентификация и анализ проектных рисков',
        priority: 'med' as const,
        status: 'todo' as const,
        estimate_h: 4,
        spent_h: 0,
        assignees: [],
        labels: ['планирование', 'риски'],
        checklist: [],
        attachments: [],
        comments: []
      }
    ];

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(starterTasks)
        .select();

      if (error) throw error;

      await fetchData(); // Перезагружаем данные
      return data;
    } catch (err) {
      console.error('Error creating starter tasks:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    projects,
    tasks,
    employees,
    companies,
    loading,
    error,
    fetchData,
    createProject,
    updateProject,
    createTask,
    updateTask,
    bulkUpdateTasks,
    addTeamMember,
    createStarterTasks
  };
}