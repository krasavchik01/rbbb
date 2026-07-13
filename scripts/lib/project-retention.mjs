export const RETAINED_COMPANIES = [
  'ТОО МАК',
  'ТОО RB Partners IT Audit',
  'ТОО МКФ',
  'ТОО Academy',
  'ЧК Rusell',
];

export function normalizeCompany(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9+]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasConsortiumMarker(normalized) {
  return normalized.includes('consortium')
    || normalized.includes('консор')
    || normalized.includes('концор');
}

function hasRetainedCompanyMarker(normalized) {
  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.includes('мак')
    || tokens.includes('мкф')
    || normalized.includes('rb partners it audit')
    || normalized.includes('it audit')
    || normalized.includes('academy')
    || normalized.includes('rusell')
    || normalized.includes('russell')
    || normalized.includes('a+partners')
    || normalized.includes('a+ partners')
    || normalized === 'чк';
}

function hasRetiredCompanyMarker(normalized) {
  return normalized.includes('anderson')
    || normalized.includes('андерсон')
    || normalized.includes('parker')
    || normalized.includes('паркер');
}

export function classifyProjectCompany(value) {
  const normalized = normalizeCompany(value);
  if (!normalized) return { action: 'keep', reason: 'missing_company' };
  if (hasConsortiumMarker(normalized)) return { action: 'keep', reason: 'consortium' };
  if (hasRetainedCompanyMarker(normalized)) return { action: 'keep', reason: 'retained_company' };
  if (hasRetiredCompanyMarker(normalized)) return { action: 'delete', reason: 'retired_company' };
  return { action: 'keep', reason: 'unrecognized_company' };
}

export function parseProjectNotes(rawNotes) {
  if (rawNotes && typeof rawNotes === 'object') return rawNotes;
  try {
    return JSON.parse(rawNotes || '{}');
  } catch {
    return {};
  }
}

export function projectCompanyValue(project) {
  const notes = parseProjectNotes(project?.notes);
  return project?.companyName
    || project?.ourCompany
    || project?.company
    || notes?.companyName
    || notes?.ourCompany
    || notes?.company
    || '';
}

export function classifyProject(project) {
  const company = projectCompanyValue(project);
  return {
    ...classifyProjectCompany(company),
    company: company || null,
  };
}
