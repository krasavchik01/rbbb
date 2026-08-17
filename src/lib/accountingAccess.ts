import type { Project } from '@/lib/supabaseDataStore';

const HIDDEN_ACCOUNTING_KEYS = new Set([
  'grossprofit',
  'netprofit',
  'payout',
  'payouts',
]);

function isHiddenKey(key: string): boolean {
  const normalized = key.replace(/[_\s-]/g, '').toLowerCase();
  return normalized.includes('bonus')
    || normalized.includes('бонус')
    || HIDDEN_ACCOUNTING_KEYS.has(normalized);
}

function removeExecutiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeExecutiveFields);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isHiddenKey(key))
      .map(([key, nested]) => [key, removeExecutiveFields(nested)]),
  );
}

/**
 * UI boundary for the accountant role. Even if a project row contains legacy
 * executive fields in notes.finances, accountant screens never receive them.
 */
export function projectForAccountingWorkspace(project: Project): Project {
  return removeExecutiveFields(project) as Project;
}

