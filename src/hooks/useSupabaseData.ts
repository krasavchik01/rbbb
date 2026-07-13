/**
 * Хуки для работы с Supabase данными
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabaseDataStore,
  type Company,
  type Employee,
  type EmployeeCreateInput,
  type Project,
} from '@/lib/supabaseDataStore';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/lib/appSettings';
import { projectMatchesAllowedCompanies } from '@/lib/userCompanyAccess';
import { findCompanyByAnyValue } from '@/types/companies';
import { getProjectNotes } from '@/lib/projectNotes';

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

  const createEmployee = useCallback(async (employee: EmployeeCreateInput) => {
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

  const deleteEmployees = useCallback(async (ids: Iterable<string>) => {
    try {
      const result = await supabaseDataStore.deleteEmployees(ids);
      if (result.deletedIds.length > 0) {
        const deleted = new Set(result.deletedIds);
        setEmployees((prev) => prev.filter((employee) => !deleted.has(String(employee.id))));
      }
      return result;
    } catch (err: any) {
      console.error('❌ useEmployees: Bulk delete failed:', err);
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
    deleteEmployees,
    refresh: loadEmployees,
  };
}

function getProjectTeamMembers(project: any): any[] {
  return getProjectNotes(project).team || [];
}

function normalizeIdentity(value: any): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePersonName(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ә]/g, 'а')
    .replace(/[ғ]/g, 'г')
    .replace(/[қ]/g, 'к')
    .replace(/[ң]/g, 'н')
    .replace(/[ө]/g, 'о')
    .replace(/[ұү]/g, 'у')
    .replace(/[і]/g, 'и')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .trim();
}

function personMatchKey(value: any): string {
  const tokens = normalizePersonName(value)
    .split(' ')
    .filter((token) => token.length >= 2)
    .filter((token) => !/(ович|евич|улы|ұлы|кызы|қызы)$/u.test(token));
  if (tokens.length >= 2) {
    return tokens.slice(0, 2).sort().join(' ');
  }
  return tokens.join(' ');
}

function teamMemberIdentity(member: any) {
  const employee = member?.employee || member?.profile || member?.user || {};
  return {
    id: member?.userId || member?.user_id || member?.employeeId || member?.employee_id || employee?.id || member?.id || '',
    email: member?.userEmail || member?.user_email || member?.employeeEmail || member?.employee_email || employee?.email || member?.email || '',
    name: member?.userName || member?.user_name || member?.employeeName || member?.employee_name || employee?.name || employee?.full_name || member?.name || '',
  };
}

function projectHasTeamMember(project: any, user?: { id?: string | null; email?: string | null; name?: string | null } | null): boolean {
  if (!user?.id && !user?.email && !user?.name) return false;
  const userId = normalizeIdentity(user.id);
  const userEmail = normalizeIdentity(user.email);
  const userName = normalizeIdentity(user.name);
  const userNameKey = personMatchKey(user.name);

  return getProjectTeamMembers(project).some((member: any) => {
    const identity = teamMemberIdentity(member);
    const memberId = normalizeIdentity(identity.id);
    const memberEmail = normalizeIdentity(identity.email);
    const memberName = normalizeIdentity(identity.name);
    const memberNameKey = personMatchKey(identity.name);
    return (
      (userId && memberId === userId) ||
      (userEmail && memberEmail === userEmail) ||
      (userName && memberName === userName) ||
      (userNameKey && memberNameKey && userNameKey === memberNameKey)
    );
  });
}

// Хук для проектов
export function useProjects() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [appSettings] = useAppSettings();

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseDataStore.getProjects();
      setAllProjects(data);
      console.log('✅ useProjects: Loaded', data.length, 'projects');
    } catch (err: any) {
      console.error('❌ useProjects: Error loading projects:', err);
      setError(err.message || 'Ошибка загрузки проектов');
    } finally {
      setLoading(false);
    }
  }, []);

  // Фильтрация по allowedCompanyIds пользователя
  const projects = useMemo(() => {
    if (user?.allowedCompanyIds && user.allowedCompanyIds.length > 0) {
      const companies = appSettings.companies || [];
      const allowedNames = user.allowedCompanyIds
        .flatMap((id: string) => {
          const company = findCompanyByAnyValue(id, companies as any);
          return [id, company?.id, company?.name, company?.fullName].filter(Boolean);
        })
        .filter(Boolean) as string[];

      if (allowedNames.length === 0) return allProjects;
      return allProjects.filter((p) => projectMatchesAllowedCompanies(p, allowedNames));
    }

    const canViewAllProjects = user && ['ceo', 'admin', 'deputy_director', 'procurement'].includes(user.role);
    if (canViewAllProjects) return allProjects;

    return allProjects.filter((p) => projectHasTeamMember(p, user));
  }, [allProjects, user?.allowedCompanyIds, user?.id, user?.role, appSettings.companies]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (project: any) => {
    try {
      const newProject = await supabaseDataStore.createProject(project);
      setAllProjects(prev => [newProject, ...prev]);
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
        setAllProjects(prev => prev.map(p => p.id === id ? updated : p));
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
        setAllProjects(prev => prev.filter(p => p.id !== id));
      }
      return success;
    } catch (err: any) {
      console.error('❌ useProjects: Error deleting project:', err);
      throw err;
    }
  }, []);

  const deleteProjects = useCallback(async (ids: Iterable<string>) => {
    try {
      const result = await supabaseDataStore.deleteProjects(ids);
      if (result.deletedIds.length > 0) {
        const deleted = new Set(result.deletedIds);
        setAllProjects((prev) => prev.filter((project) => !deleted.has(String(project.id))));
      }
      return result;
    } catch (err: any) {
      console.error('❌ useProjects: Bulk delete failed:', err);
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
    deleteProjects,
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

