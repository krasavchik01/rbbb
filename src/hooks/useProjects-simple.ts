import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Company, Employee, Project, Task, ProjectTeamMember } from '@/types/project-simple';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Демо данные
  const demoCompanies: Company[] = [
    { id: '1', name: 'RB Partners IT Audit', brand_color: '#3B82F6', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '2', name: 'Russell Bedford A+ Partners', brand_color: '#10B981', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '3', name: 'Parker Russell', brand_color: '#8B5CF6', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '4', name: 'Fin Consulting', brand_color: '#F59E0B', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '5', name: 'Andersonkz', brand_color: '#EF4444', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' }
  ];

  const demoEmployees: Employee[] = [
    { id: '1', name: 'Иван Петров', email: 'ivan@rb.ru', role: 'partner', level: '3', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '2', name: 'Мария Сидорова', email: 'maria@rb.ru', role: 'manager_1', level: '2', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '3', name: 'Алексей Козлов', email: 'alex@rb.ru', role: 'assistant', level: '1', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '4', name: 'Елена Новикова', email: 'elena@rb.ru', role: 'tax_specialist', level: '2', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: '5', name: 'Дмитрий Волков', email: 'dmitry@rb.ru', role: 'it_auditor', level: '2', created_at: '2024-01-01', updated_at: '2024-01-01' }
  ];

  const demoProjects: Project[] = [
    { 
      id: '1', 
      name: 'Аудит налогов ПАО "Газпром"', 
      status: 'in_progress',
      created_at: '2024-01-15',
      updated_at: '2024-01-20',
      deadline: '2024-03-01',
      start_date: '2024-01-15',
      manager_id: '2',
      partner_id: '1',
      completion_percentage: 65
    },
    { 
      id: '2', 
      name: 'IT-аудит безопасности Сбербанк', 
      status: 'qa_review',
      created_at: '2024-01-10',
      updated_at: '2024-01-25',
      deadline: '2024-02-15',
      start_date: '2024-01-10',
      manager_id: '2',
      partner_id: '1',
      completion_percentage: 85
    },
    { 
      id: '3', 
      name: 'Due Diligence ВТБ', 
      status: 'draft',
      created_at: '2024-01-20',
      updated_at: '2024-01-20',
      deadline: '2024-04-01',
      manager_id: '5',
      completion_percentage: 10
    },
    { 
      id: '4', 
      name: 'Аудит ФНО Альфа-Банк', 
      status: 'in_progress',
      created_at: '2024-01-12',
      updated_at: '2024-01-22',
      deadline: '2024-03-15',
      start_date: '2024-01-12',
      manager_id: '3',
      partner_id: '1',
      completion_percentage: 45
    }
  ];

  const demoTasks: Task[] = [
    {
      id: '1',
      project_id: '1',
      title: 'Анализ баланса',
      description: 'Проверка статей баланса на соответствие',
      assignees: ['3'],
      reporter: '2',
      priority: 'high',
      status: 'in_progress',
      estimate_h: 16,
      spent_h: 10,
      created_at: '2024-01-16',
      updated_at: '2024-01-20'
    },
    {
      id: '2',
      project_id: '1',
      title: 'Проверка документооборота',
      description: 'Анализ первичных документов',
      assignees: ['4'],
      reporter: '2',
      priority: 'med',
      status: 'done',
      estimate_h: 8,
      spent_h: 8,
      created_at: '2024-01-16',
      updated_at: '2024-01-18'
    },
    {
      id: '3',
      project_id: '2',
      title: 'Расчет налогов',
      description: 'Проверка корректности расчета налоговых обязательств',
      assignees: ['4'],
      reporter: '2',
      priority: 'high',
      status: 'in_review',
      estimate_h: 12,
      spent_h: 12,
      created_at: '2024-01-11',
      updated_at: '2024-01-24'
    }
  ];

  // Загрузка данных
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Используем демо данные для избежания проблем с базой
      setCompanies(demoCompanies);
      setEmployees(demoEmployees);
      setProjects(demoProjects);
      setTasks(demoTasks);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  // Создание проекта
  const createProject = async (projectData: Partial<Project>) => {
    try {
      const newProject = {
        id: String(Date.now()),
        ...projectData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Project;

      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      console.error('Error creating project:', err);
      throw err;
    }
  };

  // Обновление проекта
  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      setProjects(prev => prev.map(project => 
        project.id === projectId 
          ? { ...project, ...updates, updated_at: new Date().toISOString() }
          : project
      ));
    } catch (err) {
      console.error('Error updating project:', err);
      throw err;
    }
  };

  // Создание задачи
  const createTask = async (taskData: Partial<Task>) => {
    try {
      const newTask = {
        id: String(Date.now()),
        ...taskData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Task;

      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      console.error('Error creating task:', err);
      throw err;
    }
  };

  // Обновление задачи
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, ...updates, updated_at: new Date().toISOString() }
          : task
      ));
    } catch (err) {
      console.error('Error updating task:', err);
      throw err;
    }
  };

  // Массовое обновление задач
  const bulkUpdateTasks = async (taskIds: string[], updates: Partial<Task>) => {
    try {
      setTasks(prev => prev.map(task => 
        taskIds.includes(task.id)
          ? { ...task, ...updates, updated_at: new Date().toISOString() }
          : task
      ));
    } catch (err) {
      console.error('Error bulk updating tasks:', err);
      throw err;
    }
  };

  // Добавление участника в команду проекта
  const addTeamMember = async (projectId: string, employeeId: string, role: string) => {
    try {
      const newMember: ProjectTeamMember = {
        id: String(Date.now()),
        project_id: projectId,
        employee_id: employeeId,
        role_on_project: role,
        created_at: new Date().toISOString()
      };

      // Здесь можно добавить логику обновления команды проекта
      return newMember;
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
        labels: ['планирование']
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
        labels: ['планирование']
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
        labels: ['планирование', 'риски']
      }
    ];

    try {
      const newTasks = starterTasks.map((task, index) => ({
        ...task,
        id: String(Date.now() + index),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as Task[];

      setTasks(prev => [...newTasks, ...prev]);
      return newTasks;
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