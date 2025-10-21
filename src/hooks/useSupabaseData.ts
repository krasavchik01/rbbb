/**
 * Хуки для работы с Supabase данными
 */

import { useState, useEffect, useCallback } from 'react';
import { supabaseDataStore, Employee, Project, Company } from '@/lib/supabaseDataStore';

// Хук для сотрудников
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseDataStore.getEmployees();
      setEmployees(data);
      console.log('✅ useEmployees: Loaded', data.length, 'employees');
    } catch (err: any) {
      console.error('❌ useEmployees: Error loading employees:', err);
      setError(err.message || 'Ошибка загрузки сотрудников');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const createEmployee = useCallback(async (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newEmployee = await supabaseDataStore.createEmployee(employee);
      setEmployees(prev => [...prev, newEmployee]);
      return newEmployee;
    } catch (err: any) {
      console.error('❌ useEmployees: Error creating employee:', err);
      throw err;
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    try {
      const updated = await supabaseDataStore.updateEmployee(id, updates);
      if (updated) {
        setEmployees(prev => prev.map(e => e.id === id ? updated : e));
      }
      return updated;
    } catch (err: any) {
      console.error('❌ useEmployees: Error updating employee:', err);
      throw err;
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    try {
      const success = await supabaseDataStore.deleteEmployee(id);
      if (success) {
        setEmployees(prev => prev.filter(e => e.id !== id));
      }
      return success;
    } catch (err: any) {
      console.error('❌ useEmployees: Error deleting employee:', err);
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

// Хук для проектов
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseDataStore.getProjects();
      setProjects(data);
      console.log('✅ useProjects: Loaded', data.length, 'projects');
    } catch (err: any) {
      console.error('❌ useProjects: Error loading projects:', err);
      setError(err.message || 'Ошибка загрузки проектов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (project: any) => {
    try {
      const newProject = await supabaseDataStore.createProject(project);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err: any) {
      console.error('❌ useProjects: Error creating project:', err);
      throw err;
    }
  }, []);

  const updateProject = useCallback(async (id: string, updates: any) => {
    try {
      const updated = await supabaseDataStore.updateProject(id, updates);
      if (updated) {
        setProjects(prev => prev.map(p => p.id === id ? updated : p));
      }
      return updated;
    } catch (err: any) {
      console.error('❌ useProjects: Error updating project:', err);
      throw err;
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      const success = await supabaseDataStore.deleteProject(id);
      if (success) {
        setProjects(prev => prev.filter(p => p.id !== id));
      }
      return success;
    } catch (err: any) {
      console.error('❌ useProjects: Error deleting project:', err);
      throw err;
    }
  }, []);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: loadProjects,
  };
}

// Хук для компаний
export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseDataStore.getCompanies();
      setCompanies(data);
      console.log('✅ useCompanies: Loaded', data.length, 'companies');
    } catch (err: any) {
      console.error('❌ useCompanies: Error loading companies:', err);
      setError(err.message || 'Ошибка загрузки компаний');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  return {
    companies,
    loading,
    error,
    refresh: loadCompanies,
  };
}

