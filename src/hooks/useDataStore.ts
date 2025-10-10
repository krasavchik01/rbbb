/**
 * React Hook для работы с гибридным хранилищем данных
 */

import { useState, useEffect, useCallback } from 'react';
import { dataStore, Employee, Project, Timesheet, Bonus } from '@/lib/dataStore';
import { initializeDefaultTemplates, Template } from '@/lib/defaultTemplates';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataStore.getEmployees();
      setEmployees(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки сотрудников');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const createEmployee = useCallback(async (employee: Omit<Employee, 'id' | 'createdAt'>) => {
    try {
      const newEmployee = await dataStore.createEmployee(employee);
      setEmployees(prev => [newEmployee, ...prev]);
      return newEmployee;
    } catch (err: any) {
      setError(err.message || 'Ошибка создания сотрудника');
      throw err;
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    try {
      const updated = await dataStore.updateEmployee(id, updates);
      if (updated) {
        setEmployees(prev => prev.map(e => e.id === id ? updated : e));
      }
      return updated;
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления сотрудника');
      throw err;
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    try {
      await dataStore.deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления сотрудника');
      throw err;
    }
  }, []);

  return {
    employees,
    loading,
    error,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refresh: loadEmployees,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataStore.getProjects();
      setProjects(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки проектов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newProject = await dataStore.createProject(project);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err: any) {
      setError(err.message || 'Ошибка создания проекта');
      throw err;
    }
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      const updated = await dataStore.updateProject(id, updates);
      if (updated) {
        setProjects(prev => prev.map(p => p.id === id ? updated : p));
      }
      return updated;
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления проекта');
      throw err;
    }
  }, []);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    refresh: loadProjects,
  };
}

export function useTimesheets() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTimesheets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataStore.getTimesheets();
      setTimesheets(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки таймшитов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimesheets();
  }, [loadTimesheets]);

  const createTimesheet = useCallback(async (timesheet: Omit<Timesheet, 'id' | 'createdAt'>) => {
    try {
      const newTimesheet = await dataStore.createTimesheet(timesheet);
      setTimesheets(prev => [newTimesheet, ...prev]);
      return newTimesheet;
    } catch (err: any) {
      setError(err.message || 'Ошибка создания таймшита');
      throw err;
    }
  }, []);

  return {
    timesheets,
    loading,
    error,
    createTimesheet,
    refresh: loadTimesheets,
  };
}

export function useBonuses() {
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBonuses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataStore.getBonuses();
      setBonuses(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки бонусов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBonuses();
  }, [loadBonuses]);

  const createBonus = useCallback(async (bonus: Omit<Bonus, 'id' | 'createdAt'>) => {
    try {
      const newBonus = await dataStore.createBonus(bonus);
      setBonuses(prev => [newBonus, ...prev]);
      return newBonus;
    } catch (err: any) {
      setError(err.message || 'Ошибка создания бонуса');
      throw err;
    }
  }, []);

  return {
    bonuses,
    loading,
    error,
    createBonus,
    refresh: loadBonuses,
  };
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(() => {
    try {
      setLoading(true);
      const loadedTemplates = initializeDefaultTemplates();
      setTemplates(loadedTemplates);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const createTemplate = useCallback(async (template: Omit<Template, 'id' | 'createdAt'>) => {
    try {
      const newTemplate: Template = {
        ...template,
        id: `template-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const existingTemplates = JSON.parse(localStorage.getItem('templates') || '[]');
      const updatedTemplates = [newTemplate, ...existingTemplates];
      localStorage.setItem('templates', JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
      return newTemplate;
    } catch (err: any) {
      setError(err.message || 'Ошибка создания шаблона');
      throw err;
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, updates: Partial<Template>) => {
    try {
      const existingTemplates = JSON.parse(localStorage.getItem('templates') || '[]');
      const updatedTemplates = existingTemplates.map((t: Template) =>
        t.id === id ? { ...t, ...updates } : t
      );
      localStorage.setItem('templates', JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
      return updatedTemplates.find((t: Template) => t.id === id);
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления шаблона');
      throw err;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const existingTemplates = JSON.parse(localStorage.getItem('templates') || '[]');
      const updatedTemplates = existingTemplates.filter((t: Template) => t.id !== id);
      localStorage.setItem('templates', JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
      return true;
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления шаблона');
      throw err;
    }
  }, []);

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refresh: loadTemplates,
  };
}
