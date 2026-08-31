import { apiGet, apiPost } from '@/lib/api';

export type OneCAccountingInboxKind = 'invoice' | 'avr' | 'esf' | 'payment' | 'unknown';
export type OneCAccountingScope = 'project' | 'supplier' | 'other' | 'review';

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
  reference: string;
  accountingDirection: string;
  operationType: string;
  autoScope: OneCAccountingScope;
  manualScope: OneCAccountingScope | '';
  accountingScope: OneCAccountingScope;
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

export interface OneCAccountingFixInstruction {
  documentTitle: string;
  path: string;
  field: string;
  reason: string;
  action: string;
  currentValues: string[];
}

interface OneCAccountingInboxApiResponse {
  success?: boolean;
  records?: unknown[];
  nextCursor?: string | null;
  hasMore?: boolean;
  truncated?: boolean;
  error?: string;
}

interface OneCAccountingScopeResponse {
  success?: boolean;
  scope?: OneCAccountingScope;
  updated?: number;
  error?: string;
}

export const ONE_C_INBOX_KIND_LABELS: Record<OneCAccountingInboxKind, string> = {
  invoice: 'Счета',
  avr: 'АВР',
  esf: 'ЭСФ',
  payment: 'Оплаты',
  unknown: 'Другое',
};

export const ONE_C_ACCOUNTING_SCOPE_LABELS: Record<OneCAccountingScope, string> = {
  project: 'Клиенты и проекты',
  supplier: 'Поставщики и расходы',
  other: 'Прочие операции',
  review: 'Нужно определить',
};

const ONE_C_DOCUMENT_GUIDANCE: Record<OneCAccountingInboxKind, { title: string; path: string; field: string }> = {
  invoice: {
    title: 'Счёт на оплату покупателю',
    path: '1С → Продажа → Счета на оплату покупателям',
    field: 'Договор контрагента',
  },
  avr: {
    title: 'Реализация товаров и услуг (АВР)',
    path: '1С → Продажа → Реализация товаров и услуг',
    field: 'Договор контрагента',
  },
  esf: {
    title: 'Электронный счёт-фактура (ЭСФ)',
    path: '1С → Продажа → Электронные счета-фактуры',
    field: 'Договор поставки / номер договора',
  },
  payment: {
    title: 'Платёжное поручение входящее',
    path: '1С → Банк и касса → Платёжные поручения входящие',
    field: 'Расшифровка платежа → Договор контрагента',
  },
  unknown: {
    title: 'Документ 1С',
    path: '1С → откройте документ по номеру и дате',
    field: 'Организация, Контрагент и Договор',
  },
};

function present(value: string, emptyLabel = 'не указано'): string {
  return text(value) || emptyLabel;
}

export function buildOneCAccountingFixInstruction(
  record: OneCAccountingInboxRecord,
): OneCAccountingFixInstruction {
  const guide = ONE_C_DOCUMENT_GUIDANCE[record.kind] || ONE_C_DOCUMENT_GUIDANCE.unknown;
  const number = record.documentNumber ? `№ ${record.documentNumber}` : 'без номера';
  const date = record.documentDate ? ` от ${record.documentDate}` : '';
  const contract = present(record.contractNumber);
  const organization = `${present(record.organizationName)}${record.organizationBin ? `, БИН ${record.organizationBin}` : ''}`;
  const counterparty = `${present(record.counterpartyName)}${record.counterpartyBin ? `, БИН ${record.counterpartyBin}` : ''}`;
  const commonIdentityAction = `Откройте ${guide.title.toLocaleLowerCase('ru')} ${number}${date}. Проверьте поля «Организация», «Контрагент» и «${guide.field}».`;

  let reason = 'HUB не смог определить проект для этой записи.';
  let action = `${commonIdentityAction} Номер договора в 1С должен полностью совпадать с номером договора проекта в HUB.`;
  if (record.matchReason === 'missing_contract') {
    reason = `В 1С не заполнено поле «${guide.field}».`;
    action = `Откройте ${guide.title.toLocaleLowerCase('ru')} ${number}${date} и выберите договор в поле «${guide.field}». После записи документа повторите обмен.`;
  } else if (record.matchReason === 'contract_not_found') {
    reason = `В 1С указан договор «${contract}», но проекта с таким номером договора в HUB нет.`;
    action = `${commonIdentityAction} Сверьте номер с подписанным договором: если ошибка в 1С — выберите правильный договор; если номер в 1С верный — передайте администратору HUB номер проекта для исправления карточки договора.`;
  } else if (record.matchReason === 'contract_identity_mismatch') {
    reason = `Номер договора «${contract}» найден в HUB, но организация или контрагент в 1С не совпадают с проектом.`;
    action = `${commonIdentityAction} Исправьте выбранную организацию/контрагента либо их БИН в карточках 1С и повторите обмен.`;
  } else if (record.matchReason === 'ambiguous_contract') {
    reason = `Номер договора «${contract}» найден сразу в нескольких проектах HUB.`;
    action = `${commonIdentityAction} Убедитесь, что выбраны точные организация и контрагент и в их карточках заполнены БИН. Если реквизиты верны, администратор HUB должен сделать номера договоров проектов уникальными.`;
  } else if (record.matchReason === 'ambiguous_existing_record') {
    reason = 'Эта запись 1С уже обнаружена сразу в нескольких проектах HUB.';
    action = `${commonIdentityAction} Сообщите администратору HUB номер документа: нужно удалить его дубликат из неверного проекта, затем повторить обмен.`;
  } else if (record.matchReason === 'project_deleted') {
    reason = 'Проект, к которому раньше была привязана запись, удалён из HUB.';
    action = `${commonIdentityAction} Проверьте реквизиты договора. Если они верны, передайте администратору HUB просьбу восстановить или заново создать проект.`;
  }

  return {
    documentTitle: `${guide.title} ${number}${date}`,
    path: guide.path,
    field: guide.field,
    reason,
    action,
    currentValues: [
      `Договор: ${contract}`,
      `Организация: ${organization}`,
      `Контрагент: ${counterparty}`,
    ],
  };
}

export function buildOneCAccountantMessage(
  record: OneCAccountingInboxRecord,
  candidateProjects: readonly string[] = [],
): string {
  const instruction = buildOneCAccountingFixInstruction(record);
  return [
    'Нужно исправить запись в 1С',
    `Документ: ${instruction.documentTitle}`,
    `Где открыть: ${instruction.path}`,
    `Сейчас в 1С: ${instruction.currentValues.join('; ')}`,
    `Почему не принят HUB: ${instruction.reason}`,
    `Что сделать: ${instruction.action}`,
    candidateProjects.length > 0 ? `Найденные проекты HUB: ${candidateProjects.join('; ')}` : '',
    record.externalId ? `Технический ID 1С: ${record.externalId}` : '',
  ].filter(Boolean).join('\n');
}

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

function accountingScope(value: unknown, fallback: OneCAccountingScope = 'review'): OneCAccountingScope {
  const normalized = text(value).toLocaleLowerCase('ru');
  return ['project', 'supplier', 'other', 'review'].includes(normalized)
    ? normalized as OneCAccountingScope
    : fallback;
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
    reference: text(businessField(['reference', 'purpose', 'paymentPurpose'])),
    accountingDirection: text(businessField(['accountingDirection', 'accounting_direction', 'direction'])),
    operationType: text(businessField(['operationType', 'operation_type', 'operation'])),
    autoScope: accountingScope(first(metadata, ['auto_scope', 'autoScope'])),
    manualScope: text(first(metadata, ['manual_scope', 'manualScope']))
      ? accountingScope(first(metadata, ['manual_scope', 'manualScope']))
      : '',
    accountingScope: accountingScope(
      first(metadata, ['manual_scope', 'manualScope']) || first(metadata, ['auto_scope', 'autoScope']),
    ),
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
    record.reference,
    record.operationType,
  ].some((value) => searchKey(value).includes(needle)));
}

export async function classifyOneCCounterparty(
  recordId: string,
  scope: OneCAccountingScope,
): Promise<{ scope: OneCAccountingScope; updated: number }> {
  const { data, error } = await apiPost<OneCAccountingScopeResponse>('/api/1c/sync', {
    action: 'classify_counterparty',
    recordId,
    scope,
  });
  if (error || !data || data.success === false) {
    throw new Error(error || data?.error || 'Не удалось сохранить вид контрагента');
  }
  return {
    scope: accountingScope(data.scope, scope),
    updated: Number(data.updated || 0),
  };
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
