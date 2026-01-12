/**
 * Типы данных для структуры компаний группы
 */

export interface Company {
  id: string;
  name: string;
  fullName: string;
  inn: string; // ИИН/БИН
  address?: string;
  phone?: string;
  email?: string;
  directorId?: string; // ID генерального директора (для HR)
  directorName?: string; // ФИО генерального директора
  parentCompanyId?: string; // ID родительской компании (для дочерних)
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

// Дефолтный список компаний (используется как fallback и для инициализации)
export const DEFAULT_COMPANIES: Company[] = [
  {
    id: 'mak',
    name: 'ТОО МАК',
    fullName: 'Товарищество с ограниченной ответственностью "МАК"',
    inn: '000000000000',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'aplus',
    name: 'A+Partners',
    fullName: 'A+Partners Group',
    inn: '000000000001',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'rb-academy',
    name: 'RB Academy',
    fullName: 'RB Academy',
    inn: '000000000002',
    parentCompanyId: 'aplus',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'rb-partners',
    name: 'RB Partners',
    fullName: 'RB Partners',
    inn: '000000000003',
    parentCompanyId: 'aplus',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'it-audit',
    name: 'IT Audit',
    fullName: 'IT Audit',
    inn: '000000000004',
    parentCompanyId: 'aplus',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'parkerrussell',
    name: 'PARKERRUSSELL',
    fullName: 'PARKERRUSSELL',
    inn: '000000000005',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'andersonkz',
    name: 'Andersonkz',
    fullName: 'Andersonkz',
    inn: '000000000006',
    isActive: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Совместимость: COMPANIES теперь ссылается на DEFAULT_COMPANIES
// В будущем используйте getAppSettings().companies для получения актуального списка
export const COMPANIES = DEFAULT_COMPANIES;

// Получить компанию по ID
export const getCompanyById = (id: string): Company | undefined => {
  return COMPANIES.find(c => c.id === id);
};

// Получить все активные компании
export const getActiveCompanies = (): Company[] => {
  return COMPANIES.filter(c => c.isActive);
};

// Получить родительскую компанию
export const getParentCompany = (companyId: string): Company | undefined => {
  const company = getCompanyById(companyId);
  if (company?.parentCompanyId) {
    return getCompanyById(company.parentCompanyId);
  }
  return undefined;
};

// Получить дочерние компании
export const getChildCompanies = (parentId: string): Company[] => {
  return COMPANIES.filter(c => c.parentCompanyId === parentId);
};


