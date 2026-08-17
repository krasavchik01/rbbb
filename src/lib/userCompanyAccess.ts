// Управление доступом пользователей к компаниям
// Хранится в Supabase таблице user_company_access

import { supabase } from '@/integrations/supabase/client';
import {
  findCompanyByAnyValue,
  normalizeCompanyId,
  normalizeCompanyKey,
  projectCompanyCandidates,
  projectCompanyName,
  resolveProjectCompany,
} from '@/types/companies';

export interface UserCompanyAccessMap {
  [userId: string]: string[]; // массив ID компаний из appSettings.companies
}

// Загрузить всю карту доступа из Supabase
export async function getUserCompanyAccessMap(): Promise<UserCompanyAccessMap> {
  try {
    const { data, error } = await supabase
      .from('user_company_access')
      .select('user_id, company_ids');

    if (error) {
      console.error('Error loading user_company_access:', error);
      return {};
    }

    const map: UserCompanyAccessMap = {};
    for (const row of data || []) {
      map[row.user_id] = row.company_ids || [];
    }
    return map;
  } catch (e) {
    console.error('Error loading user_company_access:', e);
    return {};
  }
}

// Получить разрешённые компании для конкретного пользователя
// null = без ограничений (видит всё)
export async function getUserAllowedCompanyIds(userId: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from('user_company_access')
      .select('company_ids')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading company access for user:', userId, error);
      return null;
    }

    // Нет записи = без ограничений
    if (!data) return null;
    return data.company_ids || [];
  } catch (e) {
    console.error('Error loading company access:', e);
    return null;
  }
}

// Установить разрешённые компании для пользователя (upsert)
export async function setUserAllowedCompanyIds(userId: string, companyIds: string[]): Promise<void> {
  try {
    const normalizedCompanyIds = Array.from(new Set((companyIds || []).map(normalizeCompanyId).filter(Boolean)));
    const { error } = await supabase
      .from('user_company_access')
      .upsert(
        { user_id: userId, company_ids: normalizedCompanyIds },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving company access:', error);
    }
  } catch (e) {
    console.error('Error saving company access:', e);
  }
}

// Удалить ограничение (пользователь видит всё)
export async function removeUserCompanyAccess(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_company_access')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing company access:', error);
    }
  } catch (e) {
    console.error('Error removing company access:', e);
  }
}

// Нормализация названия компании (убирает ТОО, ЧК, ИП, LLP и т.д.)
export function normalizeCompanyName(name: string): string {
  const canonical = findCompanyByAnyValue(name);
  const source = canonical?.name || name;
  return normalizeCompanyKey(source)
    .replace(/^(тоо|too|чк|ип|ао|ao|ооо|llp|lp|ltd|inc)_+/i, '')
    .trim();
}

// Проверяет, совпадает ли название компании проекта с разрешёнными
export function projectMatchesAllowedCompanies(
  project: any,
  allowedNames: string[]
): boolean {
  const company = resolveProjectCompany(project);
  const rawName = company?.name || projectCompanyName(project, undefined, '');
  if (!rawName) return false;
  const normalized = normalizeCompanyName(rawName);
  return allowedNames.some(allowed => {
    const normalizedAllowed = normalizeCompanyName(allowed);
    return normalized.includes(normalizedAllowed) || normalizedAllowed.includes(normalized);
  });
}

/**
 * Определяет именно отсутствие «нашей компании». Клиент и название проекта
 * намеренно не участвуют: они не являются исполнителем и не должны скрывать
 * запись из очереди назначения компании.
 */
export function projectHasMissingCompanyIdentity(project: any): boolean {
  return projectCompanyCandidates(project).length === 0;
}

export function legacyProjectCompanyLabel(project: any): string | null {
  return resolveProjectCompany(project)?.name || null;
}

/**
 * Проверяет видимость проекта в компании пользователя. Руководящие роли могут
 * дополнительно видеть записи без назначенной компании, чтобы разобрать их и
 * назначить исполнителя, но не получают доступ к чужим назначенным компаниям.
 */
export function projectIsVisibleWithinCompanyScope(
  project: any,
  allowedCompanyNames: string[],
  role?: string | null,
): boolean {
  if (projectMatchesAllowedCompanies(project, allowedCompanyNames)) return true;

  const canTriageUnassignedCompany = ['ceo', 'admin', 'deputy_director'].includes(role || '');
  return canTriageUnassignedCompany && projectHasMissingCompanyIdentity(project);
}
