import crypto from 'node:crypto';

const KAZAKH_FOLD = new Map([
  ['ә', 'а'], ['ғ', 'г'], ['қ', 'к'], ['ң', 'н'], ['ө', 'о'],
  ['ұ', 'у'], ['ү', 'у'], ['һ', 'х'], ['і', 'и'],
]);

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .split('')
    .map((char) => KAZAKH_FOLD.get(char) || char)
    .join('')
    .replace(/[«»"“”„'`]/g, ' ')
    .replace(/[\\/_(),:;\[\]{}|+=!?@#$%^&*~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sourceKey(file, sheet, row) {
  return `${normalizeText(file)}::${normalizeText(sheet)}::${Number(row)}`;
}

export function rowFingerprint({ employeeId, workDate, hours, projectName, notes }) {
  const numericHours = Number(hours);
  const normalizedHours = Number.isFinite(numericHours) ? numericHours.toFixed(4) : '';
  const value = [
    String(employeeId || '').trim(),
    String(workDate || '').slice(0, 10),
    normalizedHours,
    normalizeText(projectName),
    normalizeText(notes),
  ].join('::');
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function classifyRbiRow(result) {
  const matchConflict = result?.matchType === 'conflict';
  const teamConflict = Array.isArray(result?.conflicts) && result.conflicts.length > 0;
  let status = 'confirmed_applied';
  if (result?.matchType === 'not_found') status = 'create_candidate';
  else if (matchConflict) status = 'needs_project_match';
  else if (teamConflict) status = 'team_conflict';
  else if (Array.isArray(result?.externalPeople) && result.externalPeople.length > 0) status = 'external_person';
  return { status, matchConflict, teamConflict };
}

export function summarizeRbiReview(results) {
  const matchConflicts = results.filter((row) => row?.matchType === 'conflict').length;
  const teamConflicts = results.filter((row) => Array.isArray(row?.conflicts) && row.conflicts.length > 0).length;
  const overlap = results.filter(
    (row) => row?.matchType === 'conflict' && Array.isArray(row?.conflicts) && row.conflicts.length > 0,
  ).length;
  const notFound = results.filter((row) => row?.matchType === 'not_found').length;
  const additionalTeamConflicts = teamConflicts - overlap;
  const uniqueReviewRows = matchConflicts + additionalTeamConflicts + notFound;
  return { matchConflicts, teamConflicts, overlap, additionalTeamConflicts, notFound, uniqueReviewRows };
}

function tokens(value) {
  return normalizeText(value).split(' ').filter((token) => token.length >= 2);
}

const CLIENT_STOPWORDS = new Set([
  'тоо', 'ао', 'чк', 'ооо', 'ип', 'llp', 'ltd', 'limited', 'company', 'компания',
]);

function clientTokens(value) {
  return tokens(value).filter((token) => !CLIENT_STOPWORDS.has(token));
}

function projectDisplayName(project) {
  const notes = project?.notes && typeof project.notes === 'object' ? project.notes : {};
  return notes.name || notes.clientName || project?.name || '';
}

function extractYears(values) {
  return [...String(values || '').matchAll(/20\d{2}/g)].map((match) => Number(match[0]));
}

export function scoreProject(entry, project) {
  const clientNorm = normalizeText(entry?.clientName);
  const sourceClientTokens = clientTokens(entry?.clientName);
  const displayName = projectDisplayName(project);
  const projectNorm = normalizeText(displayName);
  const projectTokens = tokens(displayName);
  const auditNorm = normalizeText(entry?.auditType);

  let score = 0;
  if (sourceClientTokens.length > 0) {
    const projectTokenSet = new Set(projectTokens);
    const directHits = sourceClientTokens.filter((token) => projectTokenSet.has(token) || projectNorm.includes(token));
    if (directHits.length === 0) return 0;
    if (sourceClientTokens.length >= 3 && directHits.length === 1) score -= 45;
  } else {
    return 0;
  }

  if (clientNorm && projectNorm === clientNorm) score += 120;
  if (clientNorm && (projectNorm.includes(clientNorm) || clientNorm.includes(projectNorm))) score += 85;

  const tokenHits = sourceClientTokens.filter((token) => projectTokens.includes(token) || projectNorm.includes(token)).length;
  score += Math.round((tokenHits / sourceClientTokens.length) * 50);

  const entryYears = extractYears([
    entry?.auditType,
    entry?.auditPeriod,
    entry?.reportDate,
    ...(entry?.starts || []),
    ...(entry?.ends || []),
  ].join(' '));
  const notes = project?.notes && typeof project.notes === 'object' ? project.notes : {};
  const projectYears = extractYears([
    project?.name,
    notes.name,
    notes.clientName,
    notes.contract?.subject,
    notes.contract?.serviceStartDate,
    notes.contract?.serviceEndDate,
  ].join(' '));
  if (entryYears.length > 0 && projectYears.length > 0) {
    if (entryYears.some((year) => projectYears.includes(year))) score += 35;
    else score -= 45;
  }

  if (auditNorm.includes('аудит') && projectNorm.includes('аудит')) score += 12;
  if (auditNorm.includes('фо') && /фо|финансов|кфо|офо/.test(projectNorm)) score += 12;
  if (auditNorm.includes('согласован') && projectNorm.includes('согласован')) score += 14;
  if (auditNorm.includes('спец') && /спец|специаль/.test(projectNorm)) score += 14;
  return score;
}

export function classifyProjectCandidates(candidates) {
  const [best, second] = candidates || [];
  if (!best || Number(best.score) < 65) return 'not_found';
  if (Number(best.score) >= 105 && (!second || Number(best.score) - Number(second.score) >= 12)) return 'exact';
  if (Number(best.score) >= 82 && (!second || Number(best.score) - Number(second.score) >= 10)) return 'probable';
  return 'conflict';
}

export function parseExcelDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value).trim())) {
    const serial = Number(value);
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      return new Date(epoch + serial * 86400000).toISOString().slice(0, 10);
    }
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null;
}

export function parseHours(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value > 0 && value <= 24 ? value : null;
  const text = String(value).trim();
  const timeRange = text.match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  if (timeRange) {
    const start = Number(timeRange[1]) + Number(timeRange[2]) / 60;
    const end = Number(timeRange[3]) + Number(timeRange[4]) / 60;
    const difference = end - start;
    return difference > 0 && difference <= 24 ? difference : null;
  }
  const numeric = Number(text.replace(',', '.'));
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 24 ? numeric : null;
}

export function classifyKenzhekulovEvidence({ partnerMatch, nameMatch }) {
  return partnerMatch && nameMatch ? 'confirmed_applied' : 'insufficient_evidence';
}
