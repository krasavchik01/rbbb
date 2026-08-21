import { apiGet } from '@/lib/api';

export type OneCAccountingInboxKind = 'invoice' | 'avr' | 'esf' | 'payment' | 'unknown';

export interface OneCAccountingInboxRecord {
  id: string;
  source: string;
  kind: OneCAccountingInboxKind;
  externalId: string;
  documentNumber: string;
  documentDate: string;
  amount: number;
  currency: string;
  contractNumber: string;
  organizationName: string;
  organizationBin: string;
  counterpartyName: string;
  counterpartyBin: string;
  matchStatus: string;
  matchReason: string;
  matchCandidates: string[];
  syncedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface OneCAccountingInboxGroupSummary {
  count: number;
  amountsByCurrency: Record<string, number>;
}

export interface OneCAccountingInboxSummary extends OneCAccountingInboxGroupSummary {
  byKind: Record<OneCAccountingInboxKind, OneCAccountingInboxGroupSummary>;
  byReason: Record<string, OneCAccountingInboxGroupSummary>;
}

export interface OneCAccountingInboxLoadResult {
  available: boolean;
  records: OneCAccountingInboxRecord[];
  truncated: boolean;
}

interface OneCAccountingInboxApiResponse {
  success?: boolean;
  records?: unknown[];
  nextCursor?: string | null;
  hasMore?: boolean;
  truncated?: boolean;
  error?: string;
}

export const ONE_C_INBOX_KIND_LABELS: Record<OneCAccountingInboxKind, string> = {
  invoice: 'Счета',
  avr: 'АВР',
  esf: 'ЭСФ',
  payment: 'Оплаты',
  unknown: 'Другое',
};

const EMPTY_KINDS: Record<OneCAccountingInboxKind, OneCAccountingInboxGroupSummary> = {
  invoice: { count: 0, amountsByCurrency: {} },
  avr: { count: 0, amountsByCurrency: {} },
  esf: { count: 0, amountsByCurrency: {} },
  payment: { count: 0, amountsByCurrency: {} },
  unknown: { count: 0, amountsByCurrency: {} },
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function first(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && text(value)) return value;
  }
  return '';
}

function numeric(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = text(value)
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function kind(value: unknown): OneCAccountingInboxKind {
  const normalized = text(value).toLocaleLowerCase('ru').replace(/[^a-zа-яё]/g, '');
  if (['invoice', 'счет', 'счетнаоплату'].includes(normalized)) return 'invoice';
  if (['avr', 'авр', 'акт'].includes(normalized)) return 'avr';
  if (['esf', 'эсф', 'счетфактура'].includes(normalized)) return 'esf';
  if (['payment', 'оплата', 'платеж'].includes(normalized)) return 'payment';
  return 'unknown';
}

function candidates(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return candidates(parsed);
  } catch {
    return [raw];
  }
}

export function normalizeOneCAccountingInboxRecord(
  value: unknown,
  index = 0,
): OneCAccountingInboxRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  const nested = metadata.normalized_record && typeof metadata.normalized_record === 'object' && !Array.isArray(metadata.normalized_record)
    ? metadata.normalized_record as Record<string, unknown>
    : metadata.normalizedRecord && typeof metadata.normalizedRecord === 'object' && !Array.isArray(metadata.normalizedRecord)
      ? metadata.normalizedRecord as Record<string, unknown>
      : {};
  // The JSON document is the durable business payload. Mirrored table columns are
  // only fallbacks: camelCase JSON keys must also win over stale snake_case columns.
  const businessField = (keys: string[]): unknown => {
    const nestedValue = first(nested, keys);
    return text(nestedValue) ? nestedValue : first(metadata, keys);
  };
  const externalId = text(businessField(['external_id', 'externalId', 'id_1c']));
  const documentNumber = text(businessField(['document_number', 'documentNumber', 'number']));
  const id = text(first(metadata, ['id'])) || externalId || `onec-inbox-${index}`;
  return {
    id,
    source: text(first(metadata, ['source', 'source_database', 'sourceDatabase'])) || text(first(nested, ['source'])) || '1С',
    kind: kind(businessField(['kind', 'document_type', 'documentType', 'type'])),
    externalId,
    documentNumber,
    documentDate: text(businessField(['document_date', 'documentDate', 'date'])).slice(0, 10),
    amount: numeric(businessField(['amount', 'sum'])),
    currency: text(businessField(['currency'])) || 'KZT',
    contractNumber: text(businessField(['contract_number', 'contractNumber', 'agreement_number'])),
    organizationName: text(businessField(['organization_name', 'organizationName', 'company_name', 'companyName'])),
    organizationBin: text(businessField(['organization_bin', 'organizationBin', 'company_bin', 'companyBin'])),
    counterpartyName: text(businessField(['counterparty_name', 'counterpartyName', 'customer_name', 'customerName'])),
    counterpartyBin: text(businessField(['counterparty_bin', 'counterpartyBin', 'customer_bin', 'customerBin'])),
    matchStatus: text(first(metadata, ['match_status', 'matchStatus'])) || 'unmatched',
    matchReason: text(first(metadata, ['match_reason', 'matchReason', 'reason'])) || 'unknown',
    matchCandidates: candidates(first(metadata, ['match_candidates', 'matchCandidates', 'candidates'])),
    syncedAt: text(first(metadata, ['synced_at', 'syncedAt'])),
    firstSeenAt: text(first(metadata, ['first_seen_at', 'firstSeenAt'])),
    lastSeenAt: text(first(metadata, ['last_seen_at', 'lastSeenAt'])),
  };
}

function addAmount(target: Record<string, number>, currency: string, amount: number): void {
  const key = currency || 'KZT';
  target[key] = (target[key] || 0) + amount;
}

export function summarizeOneCAccountingInbox(
  records: readonly OneCAccountingInboxRecord[],
): OneCAccountingInboxSummary {
  const summary: OneCAccountingInboxSummary = {
    count: 0,
    amountsByCurrency: {},
    byKind: Object.fromEntries(
      Object.entries(EMPTY_KINDS).map(([key]) => [key, { count: 0, amountsByCurrency: {} }]),
    ) as Record<OneCAccountingInboxKind, OneCAccountingInboxGroupSummary>,
    byReason: {},
  };
  for (const record of records) {
    summary.count += 1;
    addAmount(summary.amountsByCurrency, record.currency, record.amount);
    summary.byKind[record.kind].count += 1;
    addAmount(summary.byKind[record.kind].amountsByCurrency, record.currency, record.amount);
    summary.byReason[record.matchReason] ||= { count: 0, amountsByCurrency: {} };
    summary.byReason[record.matchReason].count += 1;
    addAmount(summary.byReason[record.matchReason].amountsByCurrency, record.currency, record.amount);
  }
  return summary;
}

function searchKey(value: unknown): string {
  return text(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
}

export function filterOneCAccountingInbox(
  records: readonly OneCAccountingInboxRecord[],
  query: string,
): OneCAccountingInboxRecord[] {
  const needle = searchKey(query);
  if (!needle) return [...records];
  return records.filter((record) => [
    record.counterpartyName,
    record.counterpartyBin,
    record.contractNumber,
    record.documentNumber,
    record.externalId,
    record.organizationName,
    record.organizationBin,
  ].some((value) => searchKey(value).includes(needle)));
}

export function isMissingOneCInboxTable(error: unknown): boolean {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = text(source.code);
  const message = `${text(source.message)} ${text(source.details)}`.toLocaleLowerCase('ru');
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('one_c_accounting_records') && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('не существует')
    );
}

export async function loadOneCAccountingInbox(): Promise<OneCAccountingInboxLoadResult> {
  const pageSize = 500;
  const maximumRows = 10_000;
  const rawRecords: unknown[] = [];
  let cursor = '';
  let hasMore = true;
  let truncated = false;

  while (hasMore && rawRecords.length < maximumRows) {
    const limit = Math.min(pageSize, maximumRows - rawRecords.length);
    const query = new URLSearchParams({ resource: 'inbox', limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    const { data, error, status } = await apiGet<OneCAccountingInboxApiResponse>(`/api/1c/sync?${query.toString()}`);
    if (error) {
      if (status === 404 || isMissingOneCInboxTable({ message: error })) {
        return { available: false, records: [], truncated: false };
      }
      throw new Error(error);
    }

    if (!data || data.success === false) {
      throw new Error(data?.error || 'Сервер не вернул реестр 1С');
    }

    const page = Array.isArray(data.records) ? data.records : [];
    rawRecords.push(...page);
    truncated ||= Boolean(data.truncated);
    hasMore = Boolean(data.hasMore);
    if (!hasMore) break;
    if (page.length === 0) {
      throw new Error('Сервер 1С вернул пустую страницу с признаком продолжения');
    }

    const nextCursor = text(data.nextCursor);
    if (!nextCursor || nextCursor === cursor) {
      throw new Error('Сервер 1С не вернул курсор следующей страницы');
    }
    cursor = nextCursor;
  }

  truncated ||= hasMore;
  return {
    available: true,
    records: rawRecords
      .slice(0, maximumRows)
      .map(normalizeOneCAccountingInboxRecord)
      .filter((record): record is OneCAccountingInboxRecord => Boolean(record)),
    truncated,
  };
}
