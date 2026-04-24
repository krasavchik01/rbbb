// Управление доступом пользователей к компаниям
// Хранится в Supabase таблице user_company_access

import { supabase } from '@/integrations/supabase/client';

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
    const { error } = await supabase
      .from('user_company_access')
      .upsert(
        { user_id: userId, company_ids: companyIds },
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
  return name
    .toLowerCase()
    .replace(/^(тоо|чк|ип|ао|ооо|ллп|llp|lp|ltd|inc)\s+/i, '')
    .replace(/["""«»]/g, '')
    .trim();
}

// Проверяет, совпадает ли название компании проекта с разрешёнными
export function projectMatchesAllowedCompanies(
  project: any,
  allowedNames: string[]
): boolean {
  // notes может быть строкой (raw Supabase) или объектом (после маппинга)
  let notes = project.notes;
  if (typeof notes === 'string') {
    try { notes = JSON.parse(notes); } catch { notes = null; }
  }

  // Извлекаем название компании из проекта (разные поля)
  const rawName: string =
    notes?.companyName ||
    notes?.ourCompany ||
    notes?.company ||
    notes?.client?.name ||
    project.client?.name ||
    project.clientName ||
    project.companyName ||
    project.ourCompany ||
    project.company ||
    project.client ||
    '';

  if (!rawName || typeof rawName !== 'string') return false;

  const normalized = normalizeCompanyName(rawName);
  return allowedNames.some(allowed => {
    const normalizedAllowed = normalizeCompanyName(allowed);
    return normalized.includes(normalizedAllowed) || normalizedAllowed.includes(normalized);
  });
}
