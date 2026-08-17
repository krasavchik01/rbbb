/**
 * Company catalog for "Наша компания".
 * These records are the canonical values used in project creation, filtering,
 * project access settings and legacy project normalization.
 */

export interface Company {
  id: string;
  name: string;
  fullName: string;
  inn: string;
  address?: string;
  phone?: string;
  email?: string;
  directorId?: string;
  directorName?: string;
  parentCompanyId?: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

const now = () => new Date().toISOString();

export const DEFAULT_COMPANIES: Company[] = [
  {
    id: 'mak',
    name: 'ТОО МАК',
    fullName: 'Товарищество с ограниченной ответственностью "МАК"',
    inn: '000000000000',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'rb-partners-it-audit',
    name: 'ТОО RB Partners IT Audit',
    fullName: 'IT Audit',
    inn: '000000000004',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'mkf',
    name: 'ТОО МКФ',
    fullName: 'ТОО МКФ',
    inn: '1',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'academy',
    name: 'ТОО Academy',
    fullName: 'ТОО Academy',
    inn: '2',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'rusell',
    name: 'ЧК Rusell',
    fullName: 'ЧК Rusell',
    inn: '3',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'anderson-qazaqstan',
    name: 'ТОО Anderson Qazaqstan',
    fullName: 'ТОО Anderson Qazaqstan',
    inn: '5',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'anderson-consulting',
    name: 'ТОО Anderson Consulting',
    fullName: 'ТОО Anderson Consulting',
    inn: '6',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'anderson-aifc-branch',
    name: 'Филиал Branch of Anderson Qazaqstan LLP in the AIFC',
    fullName: 'Филиал Branch of Anderson Qazaqstan LLP in the AIFC',
    inn: '7',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'parker-kazakhstan',
    name: 'ТОО Parker Казахстан',
    fullName: 'ТОО Parker Казахстан',
    inn: '9',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'parker-consulting-appraisal',
    name: 'ТОО Parker Consulting & Appraisal',
    fullName: 'ТОО Parker Consulting & Appraisal',
    inn: '8',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'parker-kaz-ltd',
    name: 'ЧК Parker KAZ Ltd',
    fullName: 'ЧК Parker KAZ Ltd',
    inn: '10',
    isActive: true,
    created_at: now(),
    updated_at: now(),
  },
];

const COMPANY_ID_ALIASES: Record<string, string> = {
  mak: 'mak',
  'comp-rb-a': 'mak',
  too_mak: 'mak',
  'тоо_мак': 'mak',
  'тоомак': 'mak',

  aplus: 'mak',
  'a+partners': 'mak',
  'a_partners': 'mak',
  'rb a+partners': 'mak',
  'rb_a+partners': 'mak',
  'rb a partners': 'mak',
  'rb_a_partners': 'mak',
  'rb aplus': 'mak',
  rb_aplus: 'mak',
  'rb-academy': 'academy',
  rb_academy: 'academy',
  'rb academy': 'academy',
  academy: 'academy',
  'тоо_academy': 'academy',

  'rb-partners': 'rb-partners-it-audit',
  rb_partners: 'rb-partners-it-audit',
  'rb partners': 'rb-partners-it-audit',
  'it-audit': 'rb-partners-it-audit',
  it_audit: 'rb-partners-it-audit',
  'it audit': 'rb-partners-it-audit',
  'rb partners it audit': 'rb-partners-it-audit',
  'тоо_rb_partners_it_audit': 'rb-partners-it-audit',

  mkf: 'mkf',
  'мкф': 'mkf',
  'тоо_мкф': 'mkf',

  russell: 'rusell',
  rusell: 'rusell',
  'чк_rusell': 'rusell',
  'чк_russell': 'rusell',

  andersonkz: 'anderson-qazaqstan',
  anderson: 'anderson-qazaqstan',
  'anderson kz': 'anderson-qazaqstan',
  'anderson qazaqstan': 'anderson-qazaqstan',
  'тоо_anderson_qazaqstan': 'anderson-qazaqstan',

  'anderson-consulting': 'anderson-consulting',
  'anderson consulting': 'anderson-consulting',
  'anderson consulutung': 'anderson-consulting',
  'anderson consulung': 'anderson-consulting',
  'тоо_anderson_consulting': 'anderson-consulting',

  'anderson-aifc-branch': 'anderson-aifc-branch',
  'branch of anderson qazaqstan llp in the aifc': 'anderson-aifc-branch',
  'филиал branch of anderson qazaqstan llp in the aifc': 'anderson-aifc-branch',

  parkerrussell: 'parker-kaz-ltd',
  'parker russell': 'parker-kaz-ltd',
  'parker-kaz-ltd': 'parker-kaz-ltd',
  'parker kaz ltd': 'parker-kaz-ltd',
  'чк_parker_kaz_ltd': 'parker-kaz-ltd',

  'parker-kazakhstan': 'parker-kazakhstan',
  'parker kazakhstan': 'parker-kazakhstan',
  'parker казахстан': 'parker-kazakhstan',
  'тоо_parker_казахстан': 'parker-kazakhstan',

  'parker-consulting-appraisal': 'parker-consulting-appraisal',
  'parker consulting appraisal': 'parker-consulting-appraisal',
  'parker consulting & appraisal': 'parker-consulting-appraisal',
  'тоо_parker_consulting_appraisal': 'parker-consulting-appraisal',
};

export function normalizeCompanyKey(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[()]/g, ' ')
    .replace(/[^\p{L}\p{N}+]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function aliasCandidates(value: unknown): string[] {
  const raw = String(value || '').trim();
  const key = normalizeCompanyKey(raw);
  const noLegalPrefix = key.replace(/^(тоо|too|чк|ип|ao|ао|ооо|llp|ltd|lp)_+/, '');
  return Array.from(new Set([raw.toLowerCase(), key, noLegalPrefix].filter(Boolean)));
}

export function normalizeCompanyId(value: unknown): string {
  for (const candidate of aliasCandidates(value)) {
    if (COMPANY_ID_ALIASES[candidate]) return COMPANY_ID_ALIASES[candidate];
  }
  return String(value || '');
}

export function findCompanyByAnyValue(value: unknown, companies: Company[] = DEFAULT_COMPANIES): Company | undefined {
  const normalizedId = normalizeCompanyId(value);
  if (normalizedId) {
    const byId = companies.find((company) => company.id === normalizedId);
    if (byId) return byId;
  }

  const keys = aliasCandidates(value);
  return companies.find((company) => {
    const companyKeys = [
      company.id,
      company.name,
      company.fullName,
      company.inn,
    ].flatMap(aliasCandidates);
    return keys.some((key) => companyKeys.includes(key));
  });
}

function projectNotes(project: any): Record<string, any> {
  const raw = project?.notes;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function companyValueCandidates(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [value];
  const record = value as Record<string, unknown>;
  return [record.id, record.companyId, record.name, record.companyName, record.fullName, record.inn];
}

/**
 * Returns only "our company" values in one authoritative order. Client fields
 * are intentionally excluded: the customer must never become the executor.
 */
export function projectCompanyCandidates(project: any): unknown[] {
  const notes = projectNotes(project);
  return [
    notes.companyId,
    project?.companyId,
    notes.ourCompany,
    project?.ourCompany,
    notes.companyName,
    project?.companyName,
    notes.company,
    project?.company,
  ].flatMap(companyValueCandidates).filter((value) => String(value ?? '').trim());
}

function projectCompanyDisplayCandidates(project: any): unknown[] {
  const notes = projectNotes(project);
  return [
    notes.ourCompany,
    project?.ourCompany,
    notes.companyName,
    project?.companyName,
    notes.company,
    project?.company,
    notes.companyId,
    project?.companyId,
  ].flatMap(companyValueCandidates).filter((value) => String(value ?? '').trim());
}

/** The single canonical project-company resolver used by every HUB screen. */
export function resolveProjectCompany(
  project: any,
  companies: Company[] = DEFAULT_COMPANIES,
): Company | undefined {
  const catalog = normalizeCompanies(companies);
  for (const candidate of projectCompanyCandidates(project)) {
    const company = findCompanyByAnyValue(candidate, catalog);
    if (company) return company;
  }
  return undefined;
}

export function projectCompanyId(
  project: any,
  companies: Company[] = DEFAULT_COMPANIES,
): string {
  return resolveProjectCompany(project, companies)?.id || '';
}

export function projectCompanyName(
  project: any,
  companies: Company[] = DEFAULT_COMPANIES,
  fallback = 'Компания не указана',
): string {
  const canonical = resolveProjectCompany(project, companies);
  if (canonical) return canonical.name;
  const raw = projectCompanyDisplayCandidates(project)[0];
  return String(raw ?? '').trim() || fallback;
}

export function normalizeCompany(company: Company): Company {
  const canonicalId = [company.id, company.name, company.fullName, company.inn]
    .map(normalizeCompanyId)
    .find((id) => DEFAULT_COMPANIES.some((item) => item.id === id));
  const canonical = DEFAULT_COMPANIES.find((item) => item.id === canonicalId);
  if (!canonical) return company;

  return {
    ...canonical,
    isActive: company.isActive !== false,
    address: company.address || canonical.address,
    phone: company.phone || canonical.phone,
    email: company.email || canonical.email,
    directorId: company.directorId || canonical.directorId,
    directorName: company.directorName || canonical.directorName,
    updated_at: company.updated_at || canonical.updated_at,
  };
}

export function normalizeCompanies(companies: Company[] = DEFAULT_COMPANIES): Company[] {
  const byId = new Map(DEFAULT_COMPANIES.map((company) => [company.id, company]));
  const custom: Company[] = [];

  for (const company of companies || []) {
    if (!company) continue;
    const normalized = normalizeCompany(company);
    if (DEFAULT_COMPANIES.some((item) => item.id === normalized.id)) {
      byId.set(normalized.id, {
        ...byId.get(normalized.id),
        ...normalized,
        name: DEFAULT_COMPANIES.find((item) => item.id === normalized.id)?.name || normalized.name,
        fullName: DEFAULT_COMPANIES.find((item) => item.id === normalized.id)?.fullName || normalized.fullName,
      } as Company);
    } else {
      custom.push(company);
    }
  }

  const canonical = DEFAULT_COMPANIES.map((company) => byId.get(company.id) || company);
  return [...canonical, ...custom.filter((company) => company.isActive !== false)];
}

export const COMPANIES = DEFAULT_COMPANIES;

export const getCompanyById = (id: string): Company | undefined => {
  return findCompanyByAnyValue(id, DEFAULT_COMPANIES);
};

export const getActiveCompanies = (): Company[] => {
  return normalizeCompanies(DEFAULT_COMPANIES).filter((company) => company.isActive);
};

export const getParentCompany = (companyId: string): Company | undefined => {
  const company = getCompanyById(companyId);
  if (company?.parentCompanyId) {
    return getCompanyById(company.parentCompanyId);
  }
  return undefined;
};

export const getChildCompanies = (parentId: string): Company[] => {
  const normalizedParentId = normalizeCompanyId(parentId);
  return normalizeCompanies(DEFAULT_COMPANIES).filter((company) => company.parentCompanyId === normalizedParentId);
};
