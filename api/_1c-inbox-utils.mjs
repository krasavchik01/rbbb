import crypto from 'crypto';
import { normalizeOneCRecord } from './_1c-sync-utils.mjs';

const DEFAULT_ACCOUNTING_ROLES = ['accountant', 'ceo', 'admin'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_INBOX_LIMIT = 500;

const KIND_KEYS = ['kind', 'type', 'documentType', 'ВидДокумента', 'ТипДокумента'];
const IDENTITY_KEYS = ['externalId', 'id', 'ref', 'guid', 'Ссылка', 'УИД', 'UUID', 'number', 'documentNumber', 'Номер', 'НомерДокумента'];
const DATE_KEYS = ['date', 'issueDate', 'documentDate', 'Дата', 'ДатаДокумента'];
const AMOUNT_KEYS = ['amount', 'sum', 'Сумма', 'СуммаДокумента', 'СуммаОплаты'];

function text(value) {
  return String(value ?? '').trim();
}

function normalizeSnapshotCapturedAt(value) {
  const supplied = text(value);
  const parsed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/i
    .test(supplied)
    ? new Date(supplied)
    : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
}

function first(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && text(value)) return value;
  }
  return '';
}

function identity(value) {
  return text(value)
    .toLocaleLowerCase('ru')
    .replace(/[«»"'`]/g, '')
    .replace(/\b(тоо|ао|чк|llp|ltd|group|компания)\b/giu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function recognizedKind(value) {
  const key = identity(value);
  if (['invoice', 'счет', 'счетнаоплату', 'счетнаоплатуклиенту', 'счетнаоплатупокупателю', 'сф', 'schet'].includes(key)) return true;
  if (['avr', 'авр', 'акт', 'актвыполненныхработ', 'реализацияуслуг', 'реализациятоваровиуслуг'].includes(key)) return true;
  if (['esf', 'эсф', 'электронныйсчетфактура', 'электроннаясчетфактура', 'счетфактура'].includes(key)) return true;
  return ['payment', 'оплата', 'платеж', 'платежноепоручение', 'банковскаявыписка', 'поступлениенарасчетныйсчет'].includes(key);
}

function validDate(value) {
  const raw = text(value);
  if (!raw) return false;
  if (/^(\d{4})-(\d{2})-(\d{2})/.test(raw)) return true;
  if (/^(\d{2})[./-](\d{2})[./-](\d{4})/.test(raw)) return true;
  return !Number.isNaN(new Date(raw).getTime());
}

function positiveMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  const parsed = Number(text(value)
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0;
}

function rawRows(body) {
  if (Array.isArray(body)) return body.map((raw) => ({ raw, forcedKind: '' }));
  if (Array.isArray(body?.records)) return body.records.map((raw) => ({ raw, forcedKind: '' }));
  if (Array.isArray(body?.data)) return body.data.map((raw) => ({ raw, forcedKind: '' }));

  return [
    ...(Array.isArray(body?.invoices || body?.Счета) ? (body.invoices || body.Счета) : []).map((raw) => ({ raw, forcedKind: 'invoice' })),
    ...(Array.isArray(body?.avrs || body?.АВР) ? (body.avrs || body.АВР) : []).map((raw) => ({ raw, forcedKind: 'avr' })),
    ...(Array.isArray(body?.esfs || body?.ЭСФ) ? (body.esfs || body.ЭСФ) : []).map((raw) => ({ raw, forcedKind: 'esf' })),
    ...(Array.isArray(body?.payments || body?.Оплаты) ? (body.payments || body.Оплаты) : []).map((raw) => ({ raw, forcedKind: 'payment' })),
  ];
}

function candidateRow(raw, forcedKind) {
  if (!forcedKind || !raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  return { ...raw, kind: raw.kind || forcedKind };
}

function rejectionReason(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'invalid_shape';
  if (!recognizedKind(first(raw, KIND_KEYS))) return 'unsupported_kind';
  if (!first(raw, IDENTITY_KEYS)) return 'missing_identity';
  if (!validDate(first(raw, DATE_KEYS))) return 'invalid_date';
  if (!positiveMoney(first(raw, AMOUNT_KEYS))) return 'non_positive_amount';
  return 'invalid_record';
}

export function analyzeOneCPayload(body, limit = 1000) {
  const rows = rawRows(body);
  const rejectedReasons = {};
  let valid = 0;

  rows.forEach(({ raw, forcedKind }, index) => {
    const candidate = candidateRow(raw, forcedKind);
    if (normalizeOneCRecord(candidate, index)) {
      valid += 1;
      return;
    }
    const reason = rejectionReason(candidate);
    rejectedReasons[reason] = (rejectedReasons[reason] || 0) + 1;
  });

  const accepted = Math.min(valid, Math.max(0, Number(limit) || 0));
  if (valid > accepted) rejectedReasons.payload_limit = valid - accepted;
  return {
    rawReceived: rows.length,
    accepted,
    rejected: rows.length - accepted,
    rejectedReasons,
  };
}

export function resolveAccountingRoles(projectAccess) {
  const configured = projectAccess && typeof projectAccess === 'object' && !Array.isArray(projectAccess)
    ? projectAccess.accounting
    : undefined;
  const roles = Array.isArray(configured) ? configured : DEFAULT_ACCOUNTING_ROLES;
  return Array.from(new Set(roles
    .map((role) => text(role).toLowerCase())
    .filter((role) => role && role !== 'admin_assistant')));
}

export function normalizeOneCInboxQuery(query = {}) {
  const requested = Number.parseInt(text(query.limit), 10);
  const limit = Number.isFinite(requested)
    ? Math.min(MAX_INBOX_LIMIT, Math.max(1, requested))
    : 200;
  const cursor = text(query.cursor);
  if (cursor && !UUID_PATTERN.test(cursor)) {
    const error = new Error('Неверный курсор реестра 1С');
    error.statusCode = 400;
    throw error;
  }
  return { cursor, limit };
}

export function normalizeOneCBatchContext(body, source, createId = () => crypto.randomUUID()) {
  const suppliedRunId = text(body?.runId || body?.run_id || body?.syncRunId || body?.ИдентификаторЗапуска).slice(0, 200);
  const suppliedIndex = Number(body?.batchIndex ?? body?.batch_index ?? body?.НомерПакета);
  const suppliedCount = Number(body?.batchCount ?? body?.batch_count ?? body?.КоличествоПакетов);
  const validIndex = Number.isInteger(suppliedIndex) && suppliedIndex >= 0 && suppliedIndex <= 100_000;
  const validCount = Number.isInteger(suppliedCount)
    && suppliedCount >= 1
    && suppliedCount <= 100_001
    && validIndex
    && suppliedCount >= suppliedIndex;
  const suppliedSnapshotSince = text(body?.snapshotSince || body?.snapshot_since || body?.ДатаНачалаСнимка);
  const snapshotDate = /^\d{4}-\d{2}-\d{2}$/.test(suppliedSnapshotSince)
    ? new Date(`${suppliedSnapshotSince}T00:00:00.000Z`)
    : null;
  const snapshotSince = snapshotDate && !Number.isNaN(snapshotDate.getTime())
    && snapshotDate.toISOString().slice(0, 10) === suppliedSnapshotSince
    ? suppliedSnapshotSince
    : null;
  const suppliedSnapshotCapturedAt = text(
    body?.snapshotCapturedAt
      || body?.snapshot_captured_at
      || body?.МоментСнимка,
  );
  const snapshotCapturedAt = normalizeSnapshotCapturedAt(suppliedSnapshotCapturedAt);

  // Legacy extensions do not identify a multi-request run. Treat every request as
  // its own unambiguous batch rather than guessing and merging concurrent runs.
  if (!suppliedRunId || !validIndex || !validCount) {
    return {
      source: text(source) || '1C',
      runId: `legacy-${createId()}`,
      batchIndex: 0,
      batchCount: 1,
      fullSnapshot: false,
      snapshotSince: null,
      snapshotCapturedAt: null,
      legacy: true,
    };
  }
  return {
    source: text(source) || '1C',
    runId: suppliedRunId,
    batchIndex: suppliedIndex,
    batchCount: suppliedCount,
    fullSnapshot: body?.fullSnapshot === true,
    snapshotSince,
    snapshotCapturedAt,
    legacy: false,
  };
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source && typeof source === 'object' ? source : {})) {
    const count = Number(value);
    if (Number.isFinite(count)) target[key] = (target[key] || 0) + count;
  }
}

export function aggregateOneCSyncBatches(rows) {
  const batches = Array.isArray(rows) ? rows : [];
  if (batches.length === 0) return null;
  const ordered = [...batches].sort((left, right) => Number(left.batch_index) - Number(right.batch_index));
  const firstRow = ordered[0];
  const result = {
    source: text(firstRow.source),
    runId: text(firstRow.run_id),
    batchCount: ordered.length,
    expectedBatchCount: Math.max(...ordered.map((row) => Number(row.batch_count) || 1)),
    rawReceived: 0,
    accepted: 0,
    rejectedCount: 0,
    rejectedReasons: {},
    matched: 0,
    unmatchedCount: 0,
    unmatchedSummary: {},
    updatedProjects: 0,
    fullSnapshot: ordered.every((row) => row.full_snapshot === true),
    snapshotSince: null,
    snapshotCapturedAt: null,
    status: ordered.some((row) => row.status === 'error')
      ? 'error'
      : ordered.some((row) => row.status === 'processing')
        ? 'processing'
        : ordered.some((row) => row.status === 'skipped')
          ? 'skipped'
          : 'success',
    startedAt: null,
    completedAt: null,
  };
  const indexes = new Set();
  const updatedProjectIds = new Set();
  let legacyUpdatedProjects = 0;
  const snapshotValues = new Set();
  const snapshotCapturedValues = new Set();
  for (const row of ordered) {
    indexes.add(Number(row.batch_index));
    result.rawReceived += Number(row.raw_count) || 0;
    result.accepted += Number(row.accepted_count) || 0;
    result.rejectedCount += Number(row.rejected_count) || 0;
    result.matched += Number(row.matched_count) || 0;
    result.unmatchedCount += Number(row.unmatched_count) || 0;
    if (Array.isArray(row.updated_project_ids) && row.updated_project_ids.length > 0) {
      row.updated_project_ids.map(String).filter(Boolean).forEach((id) => updatedProjectIds.add(id));
    } else {
      // Rows written before updated_project_ids was introduced are backfilled
      // by PostgreSQL with an empty JSON array. Preserve their numeric count.
      legacyUpdatedProjects += Number(row.updated_projects) || 0;
    }
    // Empty is a real conflicting value here. A mixed run in which even one
    // batch omitted snapshotSince must never be treated as a complete snapshot.
    snapshotValues.add(text(row.snapshot_since));
    // Missing timestamps are deliberately kept as a conflicting sentinel:
    // legacy/mixed packets may be imported, but can never authorize cleanup.
    snapshotCapturedValues.add(normalizeSnapshotCapturedAt(row.snapshot_captured_at) || '');
    mergeCounts(result.rejectedReasons, row.rejected_reasons);
    mergeCounts(result.unmatchedSummary, row.unmatched_reasons);
    const startedAt = text(row.started_at);
    const completedAt = text(row.completed_at);
    if (startedAt && (!result.startedAt || startedAt < result.startedAt)) result.startedAt = startedAt;
    if (completedAt && (!result.completedAt || completedAt > result.completedAt)) result.completedAt = completedAt;
  }
  result.updatedProjects = updatedProjectIds.size + legacyUpdatedProjects;
  const [onlySnapshotSince = ''] = [...snapshotValues];
  result.snapshotSince = snapshotValues.size === 1 && onlySnapshotSince
    ? onlySnapshotSince
    : null;
  const [onlySnapshotCapturedAt = ''] = [...snapshotCapturedValues];
  result.snapshotCapturedAt = snapshotCapturedValues.size === 1 && onlySnapshotCapturedAt
    ? onlySnapshotCapturedAt
    : null;
  const zeroBasedComplete = Array.from(
    { length: result.expectedBatchCount },
    (_, index) => index,
  ).every((index) => indexes.has(index));
  const oneBasedComplete = Array.from(
    { length: result.expectedBatchCount },
    (_, index) => index + 1,
  ).every((index) => indexes.has(index));
  result.complete = indexes.size === result.expectedBatchCount
    && ordered.every((row) => Number(row.batch_count) === result.expectedBatchCount)
    && ordered.every((row) => row.status === 'success')
    && (zeroBasedComplete || oneBasedComplete);
  return result;
}

export function buildOneCInboxRows(matches, source, syncedAt) {
  const rowsByKey = new Map();
  for (const item of matches || []) {
    const record = item?.record;
    if (!record?.kind || !record?.externalId) continue;
    const match = item?.match || {};
    const row = {
      source: text(source) || '1C',
      kind: record.kind,
      external_id: record.externalId,
      normalized_record: record,
      project_id: match.project?.id || null,
      match_status: match.project ? 'matched' : 'unmatched',
      match_reason: text(match.reason),
      match_candidates: Array.isArray(match.candidates) ? match.candidates.map(String).slice(0, 50) : [],
      auto_scope: text(match.autoScope) || (match.project ? 'project' : 'review'),
      manual_scope: text(match.manualScope) || null,
      synced_at: syncedAt,
      last_seen_at: syncedAt,
      is_active: true,
      updated_at: syncedAt,
    };
    rowsByKey.set(`${row.source}\u0000${row.kind}\u0000${row.external_id}`, row);
  }
  return [...rowsByKey.values()];
}

export function isMissingOneCInboxTable(error) {
  const code = text(error?.code).toUpperCase();
  const message = text(error?.message).toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || (message.includes('one_c_accounting_records') && (
      message.includes('does not exist')
      || message.includes('could not find the table')
      || message.includes('schema cache')
    ));
}

export function isMissingOneCSyncBatchTable(error) {
  const code = text(error?.code).toUpperCase();
  const message = text(error?.message).toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || (message.includes('one_c_sync_batches') && (
      message.includes('does not exist')
      || message.includes('could not find the table')
      || message.includes('schema cache')
    ));
}

export function isMissingOneCSnapshotCapturedAtColumn(error) {
  const code = text(error?.code).toUpperCase();
  const message = text(error?.message).toLowerCase();
  return (code === '42703' || code === 'PGRST204' || message.includes('schema cache'))
    && message.includes('snapshot_captured_at');
}
