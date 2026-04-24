import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/lib/appSettings';
import {
  projectMatchesAllowedCompanies,
  normalizeCompanyName,
} from '@/lib/userCompanyAccess';

/**
 * Фильтрует массив проектов по allowedCompanyIds текущего пользователя.
 * Если у пользователя нет ограничений (allowedCompanyIds === null) — возвращает все проекты.
 */
export function useFilteredProjects<T>(projects: T[]): T[] {
  const { user } = useAuth();
  const [appSettings] = useAppSettings();

  return useMemo(() => {
    // Нет ограничений — видит всё
    if (!user?.allowedCompanyIds || user.allowedCompanyIds.length === 0) {
      return projects;
    }

    // Получаем имена разрешённых компаний по их ID
    const companies = appSettings.companies || [];
    const allowedNames = user.allowedCompanyIds
      .map((id) => companies.find((c: any) => c.id === id)?.name)
      .filter(Boolean) as string[];

    if (allowedNames.length === 0) return projects;

    return projects.filter((p) => projectMatchesAllowedCompanies(p, allowedNames));
  }, [projects, user?.allowedCompanyIds, appSettings.companies]);
}
