import crypto from 'crypto';
import {
  getRequestUser,
  getSupabaseAdmin,
  parseBody,
  setCors,
} from '../_email-utils.mjs';
import {
  hashSharedSecret,
  isOneCNoopBatch,
  findOneCRecordLocations,
  matchOneCRecord,
  mergeOneCRecordsIntoNotes,
  normalizeOneCPayload,
  removeOneCRecordsFromNotes,
  runWithConcurrency,
  secureSecretMatches,
} from '../_1c-sync-utils.mjs';
import {
  aggregateOneCSyncBatches,
  analyzeOneCPayload,
  buildOneCInboxRows,
  isMissingOneCInboxTable,
  isMissingOneCSnapshotCapturedAtColumn,
  isMissingOneCSyncBatchTable,
  normalizeOneCBatchContext,
  normalizeOneCInboxQuery,
  resolveAccountingRoles,
} from '../_1c-inbox-utils.mjs';

const MAX_HISTORY = 30;
const PROJECT_UPDATE_CONCURRENCY = 8;
const INBOX_UPSERT_BATCH_SIZE = 250;
const SETTINGS_UPDATE_ATTEMPTS = 5;
const SYNC_STATE_ID = 'default';
const MAX_SNAPSHOT_FUTURE_SKEW_MS = 5 * 60 * 1000;
// Vercel cannot keep this handler alive for 30 minutes. A lease therefore
// cannot expire while its owning request is still capable of mutating data.
const ONE_C_SOURCE_LEASE_SECONDS = 30 * 60;
const ONE_C_RUN_COLUMNS = 'source,run_id,batch_index,batch_count,raw_count,accepted_count,rejected_count,rejected_reasons,matched_count,unmatched_count,unmatched_reasons,updated_projects,updated_project_ids,full_snapshot,snapshot_since,snapshot_captured_at,status,started_at,completed_at';
const LEGACY_ONE_C_RUN_COLUMNS = 'source,run_id,batch_index,batch_count,raw_count,accepted_count,rejected_count,rejected_reasons,matched_count,unmatched_count,unmatched_reasons,updated_projects,updated_project_ids,full_snapshot,snapshot_since,status,started_at,completed_at';

function header(req, name) {
  return String(req.headers?.[name.toLowerCase()] || req.headers?.[name] || '').trim();
}

function settingsEnvelope(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.__suiteASettings === 1) {
    return { ...raw, companies: Array.isArray(raw.companies) ? raw.companies : [] };
  }
  return { __suiteASettings: 1, companies: Array.isArray(raw) ? raw : [] };
}

async function loadSettings(supabase) {
  const { data, error } = await supabase.from('app_settings').select('id,companies,updated_at').limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('app_settings row not found');
  return { row: data, envelope: settingsEnvelope(data.companies) };
}

function syncState(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stateTimestamp(value) {
  const state = syncState(value);
  return Math.max(
    0,
    ...[
      state.lastSyncAt,
      state.lastSuccessAt,
      state.lastErrorAt,
      state.pushConfiguredAt,
      ...(Array.isArray(state.history) ? state.history.slice(0, 1).map((entry) => entry?.at) : []),
    ].map((candidate) => Date.parse(String(candidate || '')) || 0),
  );
}

function isMissingSyncStateTable(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || (message.includes('one_c_accounting_state') && (
      message.includes('does not exist')
      || message.includes('could not find the table')
      || message.includes('schema cache')
    ));
}

async function loadDedicatedSyncState(supabase) {
  const { data, error } = await supabase
    .from('one_c_accounting_state')
    .select('id,state,revision,updated_at')
    .eq('id', SYNC_STATE_ID)
    .maybeSingle();
  if (error) {
    if (isMissingSyncStateTable(error)) return { available: false, row: null };
    throw error;
  }
  return { available: true, row: data || null };
}

async function loadSyncStateContext(supabase) {
  const [{ row, envelope }, dedicated] = await Promise.all([
    loadSettings(supabase),
    loadDedicatedSyncState(supabase),
  ]);
  const legacyState = syncState(envelope.oneCAccounting);
  if (!dedicated.available || !dedicated.row) {
    return { settingsRow: row, envelope, dedicated, state: legacyState };
  }
  const dedicatedState = syncState(dedicated.row.state);
  // Revision 0 is the migration snapshot. During a migration-before-deploy
  // rollout, the old API may still write a newer legacy state in the gap, so
  // adopt it once. After the first dedicated write (revision > 0), the
  // singleton is authoritative and blind app_settings writers are ignored.
  const state = Number(dedicated.row.revision || 0) === 0
    && stateTimestamp(legacyState) > stateTimestamp(dedicatedState)
    ? legacyState
    : dedicatedState;
  return { settingsRow: row, envelope, dedicated, state };
}

async function loadSyncState(supabase) {
  const { state } = await loadSyncStateContext(supabase);
  return state;
}

export async function saveSyncState(supabase, updateState) {
  for (let attempt = 0; attempt < SETTINGS_UPDATE_ATTEMPTS; attempt += 1) {
    const context = await loadSyncStateContext(supabase);
    const currentState = context.state;
    const nextState = typeof updateState === 'function'
      ? updateState(currentState)
      : { ...currentState, ...(updateState || {}) };

    if (context.dedicated.available) {
      if (!context.dedicated.row) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('one_c_accounting_state')
          .insert({ id: SYNC_STATE_ID, state: nextState, revision: 1 })
          .select('id,revision');
        if (!insertError && Array.isArray(insertedRows) && insertedRows.length > 0) return nextState;
        if (insertError?.code === '23505') continue;
        if (insertError) throw insertError;
        continue;
      }

      const revision = Number(context.dedicated.row.revision || 0);
      const { data: updatedRows, error } = await supabase
        .from('one_c_accounting_state')
        .update({
          state: nextState,
          revision: revision + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', SYNC_STATE_ID)
        .eq('revision', revision)
        .select('id,revision');
      if (error) throw error;
      if (Array.isArray(updatedRows) && updatedRows.length > 0) return nextState;
      continue;
    }

    const nextCompanies = { ...context.envelope, oneCAccounting: nextState };

    let query = supabase
      .from('app_settings')
      .update({ companies: nextCompanies })
      .eq('id', context.settingsRow.id);
    query = context.settingsRow.updated_at == null
      ? query.is('updated_at', null)
      : query.eq('updated_at', context.settingsRow.updated_at);
    const { data: updatedRows, error } = await query.select('id,updated_at');
    if (error) throw error;
    if (Array.isArray(updatedRows) && updatedRows.length > 0) return nextState;
  }

  throw new Error('app_settings changed repeatedly during 1C sync');
}

function publicStatus(state = {}, latestRun = null) {
  const pullEnabled = Boolean(process.env.ONEC_SYNC_URL);
  const pushEnabled = Boolean(process.env.ONEC_SYNC_SECRET || state.secretHash);
  return {
    configured: pullEnabled || pushEnabled,
    pullEnabled,
    pushEnabled,
    mode: pullEnabled && pushEnabled ? 'pull_and_push' : pullEnabled ? 'pull' : pushEnabled ? 'push' : 'disabled',
    lastSyncAt: state.lastSyncAt || null,
    lastSuccessAt: state.lastSuccessAt || null,
    lastErrorAt: state.lastErrorAt || null,
    lastError: state.lastError || '',
    lastErrorCode: state.lastErrorCode || '',
    source: state.source || '',
    rawReceived: Number(state.rawReceived || state.received || 0),
    received: Number(state.received || 0),
    accepted: Number(state.accepted || state.received || 0),
    rejectedCount: Number(state.rejectedCount || 0),
    rejectedReasons: state.rejectedReasons && typeof state.rejectedReasons === 'object' ? state.rejectedReasons : {},
    matched: Number(state.matched || 0),
    unmatchedCount: Number(state.unmatchedCount || 0),
    unmatchedSummary: state.unmatchedSummary && typeof state.unmatchedSummary === 'object' ? state.unmatchedSummary : {},
    updatedProjects: Number(state.updatedProjects || 0),
    inboxUpserted: Number(state.inboxUpserted || 0),
    unmatched: [],
    history: Array.isArray(state.history) ? state.history.slice(0, 10) : [],
    latestRun,
  };
}

async function persistOneCInbox(supabase, matches, source, syncedAt) {
  const rows = buildOneCInboxRows(matches, source, syncedAt);
  for (let offset = 0; offset < rows.length; offset += INBOX_UPSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INBOX_UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('one_c_accounting_records')
      .upsert(batch, { onConflict: 'source,kind,external_id' });
    if (!error) continue;
    if (isMissingOneCInboxTable(error)) {
      console.warn('1C accounting inbox is not available yet; apply the database migration');
      return { available: false, upserted: 0, uniqueRecords: rows.length };
    }
    throw error;
  }
  return { available: true, upserted: rows.length, uniqueRecords: rows.length };
}

async function ensureOneCInboxReady(supabase) {
  const { error } = await supabase
    .from('one_c_accounting_records')
    .select('id')
    .limit(1);
  if (!error) return;
  if (isMissingOneCInboxTable(error)) {
    const unavailable = new Error(
      'Подробный реестр 1С ещё не установлен в базе HUB. Примените обновление базы и повторите полный обмен.',
    );
    unavailable.statusCode = 503;
    unavailable.code = 'ONEC_SCHEMA_NOT_READY';
    throw unavailable;
  }
  throw error;
}

function oneCInboxKey(kind, externalId) {
  return `${String(kind || '')}\u0000${String(externalId || '')}`;
}

async function loadPreviousOneCInbox(supabase, records, source) {
  const externalIds = Array.from(new Set((records || []).map((record) => record.externalId).filter(Boolean)));
  const rowsByKey = new Map();
  const projectIdsByPaymentDocumentId = new Map();
  for (let offset = 0; offset < externalIds.length; offset += INBOX_UPSERT_BATCH_SIZE) {
    const batch = externalIds.slice(offset, offset + INBOX_UPSERT_BATCH_SIZE);
    const { data, error } = await supabase
      .from('one_c_accounting_records')
      .select('source,kind,external_id,normalized_record,project_id,match_status,last_seen_at')
      .eq('source', source)
      .in('external_id', batch);
    if (error) {
      if (isMissingOneCInboxTable(error)) {
        return { available: false, rowsByKey: new Map(), projectIdsByPaymentDocumentId: new Map() };
      }
      throw error;
    }
    for (const row of data || []) {
      rowsByKey.set(oneCInboxKey(row.kind, row.external_id), row);
    }
  }

  const paymentDocumentIds = Array.from(new Set((records || [])
    .filter((record) => record.kind === 'payment' && record.paymentDocumentId)
    .map((record) => record.paymentDocumentId)));
  for (let offset = 0; offset < paymentDocumentIds.length; offset += INBOX_UPSERT_BATCH_SIZE) {
    const batch = paymentDocumentIds.slice(offset, offset + INBOX_UPSERT_BATCH_SIZE);
    const { data, error } = await supabase
      .from('one_c_accounting_records')
      .select('source,kind,external_id,normalized_record,project_id,match_status,last_seen_at')
      .eq('source', source)
      .eq('kind', 'payment')
      .in('normalized_record->>paymentDocumentId', batch);
    if (error) {
      if (isMissingOneCInboxTable(error)) {
        return { available: false, rowsByKey: new Map(), projectIdsByPaymentDocumentId: new Map() };
      }
      throw error;
    }
    for (const row of data || []) {
      const paymentDocumentId = String(row?.normalized_record?.paymentDocumentId || '');
      if (!paymentDocumentId || row.match_status !== 'matched' || !row.project_id) continue;
      const projectIds = projectIdsByPaymentDocumentId.get(paymentDocumentId) || new Set();
      projectIds.add(String(row.project_id));
      projectIdsByPaymentDocumentId.set(paymentDocumentId, projectIds);
    }
  }
  return { available: true, rowsByKey, projectIdsByPaymentDocumentId };
}

export function planOneCProjectChanges(records, projects, source, previousInbox = {}) {
  const additions = new Map();
  const removals = new Map();
  const matches = [];
  const rowsByKey = previousInbox.rowsByKey instanceof Map ? previousInbox.rowsByKey : new Map();
  const paymentProjects = previousInbox.projectIdsByPaymentDocumentId instanceof Map
    ? previousInbox.projectIdsByPaymentDocumentId
    : new Map();

  for (const record of records || []) {
    const previous = rowsByKey.get(oneCInboxKey(record.kind, record.externalId));
    const priorPaymentProjectIds = record.paymentDocumentId
      ? paymentProjects.get(record.paymentDocumentId) || new Set()
      : new Set();
    const preferredProjectId = previous?.match_status === 'matched' && previous.project_id
      ? previous.project_id
      : priorPaymentProjectIds.size === 1
        ? [...priorPaymentProjectIds][0]
        : null;
    const match = matchOneCRecord(record, projects || [], {
      source,
      preferredProjectId: record.status === 'cancelled' ? preferredProjectId : null,
    });
    matches.push({ record, match });

    const targetProjectId = match.project ? String(match.project.id) : '';
    const locationProjectIds = new Set(
      findOneCRecordLocations(record, projects || [], source)
        .map(({ project }) => String(project.id)),
    );
    if (previous?.project_id) locationProjectIds.add(String(previous.project_id));
    if (record.status === 'cancelled') {
      for (const projectId of priorPaymentProjectIds) locationProjectIds.add(String(projectId));
    }

    const cancelledPayment = record.kind === 'payment' && record.status === 'cancelled';
    for (const locationProjectId of locationProjectIds) {
      if (cancelledPayment || (targetProjectId && locationProjectId !== targetProjectId)) {
        removals.set(locationProjectId, [...(removals.get(locationProjectId) || []), record]);
      }
    }
    if (targetProjectId && !cancelledPayment) {
      additions.set(targetProjectId, [...(additions.get(targetProjectId) || []), record]);
    }
  }

  return { additions, removals, matches };
}

function oneCSyncBatchRow(context, counters, status, errorMessage, startedAt) {
  const completedAt = status === 'processing' ? startedAt : new Date().toISOString();
  return {
    source: context.source,
    run_id: context.runId,
    batch_index: context.batchIndex,
    batch_count: context.batchCount,
    raw_count: Number(counters.rawReceived || 0),
    accepted_count: Number(counters.accepted || 0),
    rejected_count: Number(counters.rejected || 0),
    rejected_reasons: counters.rejectedReasons && typeof counters.rejectedReasons === 'object'
      ? counters.rejectedReasons
      : {},
    matched_count: Number(counters.matched || 0),
    unmatched_count: Number(counters.unmatched || 0),
    unmatched_reasons: counters.unmatchedSummary && typeof counters.unmatchedSummary === 'object'
      ? counters.unmatchedSummary
      : {},
    updated_projects: Number(counters.updatedProjects || 0),
    updated_project_ids: Array.from(counters.updatedProjectIds instanceof Set
      ? counters.updatedProjectIds
      : counters.updatedProjectIds || []).map(String),
    full_snapshot: context.fullSnapshot === true,
    snapshot_since: context.snapshotSince || null,
    snapshot_captured_at: context.snapshotCapturedAt || null,
    status,
    error_message: String(errorMessage || '').slice(0, 2000),
    started_at: startedAt,
    completed_at: completedAt,
    updated_at: completedAt,
  };
}

async function persistOneCSyncBatch(supabase, context, counters, status, errorMessage, startedAt) {
  const row = oneCSyncBatchRow(context, counters, status, errorMessage, startedAt);
  let { error } = await supabase
    .from('one_c_sync_batches')
    .upsert(row, { onConflict: 'source,run_id,batch_index' });
  if (error && isMissingOneCSnapshotCapturedAtColumn(error)) {
    // During a rolling deploy keep the audit trail, but omit the new proof.
    // Such a legacy row remains importable and can never authorize cleanup.
    const legacyRow = { ...row };
    delete legacyRow.snapshot_captured_at;
    ({ error } = await supabase
      .from('one_c_sync_batches')
      .upsert(legacyRow, { onConflict: 'source,run_id,batch_index' }));
  }
  if (error) {
    if (isMissingOneCSyncBatchTable(error)) {
      console.warn('1C sync batch audit is not available yet; apply the database migration');
      return { available: false, row: null };
    }
    const errorDescription = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
    if (status === 'processing'
      && String(error?.code || '').toUpperCase() === '23514'
      && /one_c_sync_batches.*status|status.*check/i.test(errorDescription)) {
      console.warn('1C sync batch reservation is not available yet; apply the database migration');
      return { available: false, row: null };
    }
    throw error;
  }
  return { available: true, row };
}

function isMissingOneCAtomicGate(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return code === '42883'
    || code === 'PGRST202'
    || (message.includes('reserve_one_c_sync_batch') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ));
}

async function reserveOneCSyncBatch(supabase, context, counters, startedAt) {
  const unavailable = () => {
    const error = new Error('Атомарная блокировка обмена 1С ещё не установлена; примените миграцию и повторите');
    error.statusCode = 503;
    error.code = 'ONEC_SCHEMA_NOT_READY';
    return error;
  };
  if (typeof supabase.rpc !== 'function') throw unavailable();
  const leaseToken = crypto.randomUUID();
  const row = {
    ...oneCSyncBatchRow(context, counters, 'processing', '', startedAt),
    source_snapshot_versioned: context.sourceSnapshotVersioned === true,
  };
  const { data, error } = await supabase.rpc('reserve_one_c_sync_batch', {
    p_batch: row,
    p_lease_token: leaseToken,
    p_lease_seconds: ONE_C_SOURCE_LEASE_SECONDS,
  });
  if (error) {
    if (String(error?.code || '').toUpperCase() === '22007') {
      const invalidCapture = new Error('Момент снимка 1С слишком далеко в будущем');
      invalidCapture.statusCode = 400;
      invalidCapture.skipAudit = true;
      throw invalidCapture;
    }
    if (isMissingOneCAtomicGate(error)
      || isMissingOneCSyncBatchTable(error)
      || isMissingOneCSnapshotCapturedAtColumn(error)) {
      throw unavailable();
    }
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : data;
  const decision = String(result?.decision || '').toLowerCase();
  if (!['accepted', 'skipped', 'busy'].includes(decision)) {
    throw new Error('1C atomic source gate returned an invalid decision');
  }
  return {
    available: true,
    atomic: true,
    decision,
    reason: String(result?.reason || ''),
    leaseToken: decision === 'accepted' ? leaseToken : '',
  };
}

async function releaseOneCSourceLease(supabase, source, leaseToken) {
  if (!leaseToken || typeof supabase.rpc !== 'function') return;
  const { error } = await supabase.rpc('release_one_c_sync_source_lease', {
    p_source: source,
    p_lease_token: leaseToken,
  });
  if (error && !isMissingOneCAtomicGate(error)) throw error;
}

async function loadOneCRun(supabase, source, runId) {
  let { data: rows, error } = await supabase
    .from('one_c_sync_batches')
    .select(ONE_C_RUN_COLUMNS)
    .eq('source', source)
    .eq('run_id', runId)
    .order('batch_index', { ascending: true });
  if (error && isMissingOneCSnapshotCapturedAtColumn(error)) {
    ({ data: rows, error } = await supabase
      .from('one_c_sync_batches')
      .select(LEGACY_ONE_C_RUN_COLUMNS)
      .eq('source', source)
      .eq('run_id', runId)
      .order('batch_index', { ascending: true }));
  }
  if (error) {
    if (isMissingOneCSyncBatchTable(error)) return { available: false, rows: [], summary: null };
    throw error;
  }
  return { available: true, rows: rows || [], summary: aggregateOneCSyncBatches(rows) };
}

async function hasNewerOneCSnapshot(supabase, source, runId, snapshotCapturedAt) {
  const { data, error } = await supabase
    .from('one_c_sync_batches')
    .select('run_id,snapshot_captured_at')
    .eq('source', source)
    .neq('run_id', runId)
    // Equal timestamps are ambiguous because 1C Date has one-second precision.
    // Fail closed when two different runs were captured in the same second.
    .gte('snapshot_captured_at', snapshotCapturedAt)
    .limit(1);
  if (error) {
    if (isMissingOneCSyncBatchTable(error) || isMissingOneCSnapshotCapturedAtColumn(error)) {
      return { available: false, newer: false };
    }
    throw error;
  }
  if (Array.isArray(data) && data.length > 0) return { available: true, newer: true };

  // Rollout barrier: a request handled by the pre-watermark schema has NULL
  // capture time. Its non-null completed_at is at least its started_at, so this
  // single comparison covers either server timestamp crossing our source
  // capture. Ancient legacy rows remain harmless for later snapshots.
  const { data: legacyData, error: legacyError } = await supabase
    .from('one_c_sync_batches')
    .select('run_id,completed_at')
    .eq('source', source)
    .neq('run_id', runId)
    .is('snapshot_captured_at', null)
    .gte('completed_at', snapshotCapturedAt)
    .limit(1);
  if (legacyError) {
    if (isMissingOneCSyncBatchTable(legacyError)
      || isMissingOneCSnapshotCapturedAtColumn(legacyError)) {
      return { available: false, newer: false };
    }
    throw legacyError;
  }
  return { available: true, newer: Array.isArray(legacyData) && legacyData.length > 0 };
}

async function loadLatestOneCRun(supabase) {
  const { data: latest, error: latestError } = await supabase
    .from('one_c_sync_batches')
    .select('source,run_id,completed_at')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) {
    if (isMissingOneCSyncBatchTable(latestError)) return null;
    throw latestError;
  }
  if (!latest?.source || !latest?.run_id) return null;

  const run = await loadOneCRun(supabase, latest.source, latest.run_id);
  return run.summary;
}

async function loadOneCInboxPage(supabase, query) {
  const { cursor, limit } = normalizeOneCInboxQuery(query);
  let request = supabase
    .from('one_c_accounting_records')
    .select('id,source,kind,external_id,normalized_record,match_status,match_reason,match_candidates,synced_at,first_seen_at,last_seen_at')
    .eq('match_status', 'unmatched')
    .is('project_id', null)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(limit + 1);
  if (cursor) request = request.gt('id', cursor);
  const { data, error } = await request;
  if (error) {
    if (isMissingOneCInboxTable(error)) {
      return { available: false, records: [], nextCursor: null, hasMore: false, truncated: false };
    }
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  const hasMore = rows.length > limit;
  const records = rows.slice(0, limit);
  return {
    available: true,
    records,
    nextCursor: hasMore && records.length ? records[records.length - 1].id : null,
    hasMore,
    // `hasMore` means normal cursor pagination, not data loss. The client marks
    // the registry as truncated only if its explicit 10k safety cap is reached.
    truncated: false,
  };
}

export async function requireAccountingUser(req, supabase) {
  const user = await getRequestUser(req, supabase);
  if (!user) {
    const error = new Error('Нет доступа к синхронизации 1С');
    error.statusCode = 403;
    throw error;
  }
  // Unlike legacy low-risk endpoints, accounting data is served through a
  // service-role client and therefore must never trust a caller-supplied UUID.
  if (user.authMethod !== 'jwt') {
    const error = new Error('Для доступа к бухгалтерии нужна актуальная сессия');
    error.statusCode = 401;
    throw error;
  }
  const { envelope } = await loadSettings(supabase);
  const role = String(user.role || '').trim().toLowerCase();
  const allowed = new Set(resolveAccountingRoles(envelope.projectAccess));
  if (role === 'admin_assistant' || !allowed.has(role)) {
    const error = new Error('Нет доступа к синхронизации 1С');
    error.statusCode = 403;
    throw error;
  }
  return { user: { ...user, role }, envelope };
}

async function isExternalOneCRequest(req, supabase) {
  const received = header(req, 'x-hub-1c-key') || header(req, 'x-onec-key');
  if (secureSecretMatches(received, process.env.ONEC_SYNC_SECRET || '')) return true;
  if (!received) return false;
  const state = await loadSyncState(supabase);
  return secureSecretMatches(hashSharedSecret(received), state.secretHash || '');
}

function parseProjectNotes(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function itemWasSyncedBefore(item, cutoff) {
  const syncedAt = Date.parse(String(item?.syncedAt || '')) || 0;
  return syncedAt < Date.parse(cutoff);
}

export function removeStaleOneCRecordsFromNotes(
  rawNotes,
  rows,
  source,
  cutoff,
  syncedAt = new Date().toISOString(),
) {
  const notes = parseProjectNotes(rawNotes);
  const current = notes.accounting && typeof notes.accounting === 'object' && !Array.isArray(notes.accounting)
    ? notes.accounting
    : null;
  if (!current || !cutoff) return { notes, changed: false };

  const keys = new Set((rows || []).map((row) => oneCInboxKey(
    row?.kind || row?.normalized_record?.kind,
    row?.external_id || row?.normalized_record?.externalId,
  )));
  const exactStaleItem = (item, kind) => item?.source === '1c'
    && String(item?.sourceDatabase || '') === String(source || '')
    && keys.has(oneCInboxKey(kind, item?.externalId))
    && itemWasSyncedBefore(item, cutoff);
  const existingDocuments = Array.isArray(current.documents) ? current.documents : [];
  const existingPayments = Array.isArray(current.payments) ? current.payments : [];
  const documents = existingDocuments.filter((item) => !exactStaleItem(item, item?.type));
  const payments = existingPayments.filter((item) => !exactStaleItem(item, 'payment'));
  const changed = documents.length !== existingDocuments.length || payments.length !== existingPayments.length;
  if (!changed) return { notes, changed: false };
  return {
    changed: true,
    notes: {
      ...notes,
      accounting: {
        ...current,
        documents,
        payments,
        sync: { source: '1c', sourceDatabase: source, lastSyncedAt: syncedAt },
        updatedAt: syncedAt,
        updatedBy: '1С',
      },
    },
  };
}

export function nextProjectMutationTimestamp(currentUpdatedAt, requestedAt = new Date().toISOString()) {
  const currentMs = Date.parse(String(currentUpdatedAt || ''));
  const requestedMs = Date.parse(String(requestedAt || ''));
  const nextMs = Math.max(
    Date.now(),
    Number.isFinite(requestedMs) ? requestedMs : 0,
    Number.isFinite(currentMs) ? currentMs + 1 : 0,
  );
  return new Date(nextMs).toISOString();
}

export async function updateProjectNotes(
  supabase,
  projectId,
  records,
  source,
  syncedAt,
  initialProject = null,
  operation = 'merge',
  reconcileBefore = null,
) {
  let current = initialProject;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!current) {
      const { data, error: readError } = await supabase
        .from('projects')
        .select('id,notes,updated_at')
        .eq('id', projectId)
        .maybeSingle();
      if (readError) throw readError;
      current = data;
    }
    if (!current) throw new Error(`Project ${projectId} not found`);

    const mutation = operation === 'remove'
      ? removeOneCRecordsFromNotes(current.notes, records, source, syncedAt)
      : operation === 'reconcile'
        ? removeStaleOneCRecordsFromNotes(current.notes, records, source, reconcileBefore, syncedAt)
        : { notes: mergeOneCRecordsIntoNotes(current.notes, records, source, syncedAt), changed: true };
    if (!mutation.changed) return false;
    // `syncedAt` is shared by every mutation in a batch and therefore cannot
    // serve as a CAS version. Mint a strictly newer token for each successful
    // write, including multiple writes in the same millisecond.
    const nextUpdatedAt = nextProjectMutationTimestamp(current.updated_at, syncedAt);
    let query = supabase
      .from('projects')
      .update({ notes: mutation.notes, updated_at: nextUpdatedAt })
      .eq('id', projectId);
    query = current.updated_at == null
      ? query.is('updated_at', null)
      : query.eq('updated_at', current.updated_at);
    const { data: rows, error: updateError } = await query.select('id');
    if (updateError) throw updateError;
    if (Array.isArray(rows) && rows.length > 0) return true;
    current = null;
  }
  throw new Error(`Project ${projectId} changed during 1C sync`);
}

async function loadStaleOneCInboxRows(supabase, source, cutoff, snapshotSince) {
  const rows = [];
  let cursor = null;
  while (true) {
    let query = supabase
      .from('one_c_accounting_records')
      .select('id,source,kind,external_id,normalized_record,project_id,last_seen_at')
      .eq('source', source)
      .eq('is_active', true)
      .lt('last_seen_at', cutoff)
      .gte('normalized_record->>date', snapshotSince)
      .order('id', { ascending: true })
      .limit(500);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) {
      if (isMissingOneCInboxTable(error)) return { available: false, rows: [] };
      throw error;
    }
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < 500) break;
    cursor = page[page.length - 1]?.id || null;
    if (!cursor) break;
  }
  return { available: true, rows };
}

export async function reconcileCompleteOneCRun(supabase, batch, syncedAt = new Date().toISOString()) {
  if (batch?.legacy || batch?.fullSnapshot !== true || !batch?.snapshotSince
    || !batch?.snapshotCapturedAt) {
    return { reconciled: false, reason: 'not_full_run', touchedProjectIds: new Set(), inactivated: 0 };
  }
  const run = await loadOneCRun(supabase, batch.source, batch.runId);
  if (!run.available) {
    return { reconciled: false, reason: 'audit_unavailable', touchedProjectIds: new Set(), inactivated: 0 };
  }
  const summary = run.summary;
  // A rejected source row means the durable ledger is not a faithful complete
  // snapshot. Keep accepted imports, but fail closed and never infer deletion.
  if (summary?.rejectedCount > 0) {
    return { reconciled: false, reason: 'run_rejected_records', touchedProjectIds: new Set(), inactivated: 0 };
  }
  if (!summary?.complete || summary.status !== 'success' || !summary.fullSnapshot
    || summary.snapshotSince !== batch.snapshotSince
    || summary.snapshotCapturedAt !== batch.snapshotCapturedAt
    || !summary.startedAt) {
    return { reconciled: false, reason: 'run_incomplete', touchedProjectIds: new Set(), inactivated: 0 };
  }

  // Capture time describes the source snapshot, unlike request arrival time.
  // A single newer batch (even from an incomplete run) proves this snapshot is
  // stale and therefore must not infer deletions from the durable inbox.
  const newerSnapshot = await hasNewerOneCSnapshot(
    supabase,
    batch.source,
    batch.runId,
    batch.snapshotCapturedAt,
  );
  if (!newerSnapshot.available) {
    return { reconciled: false, reason: 'snapshot_guard_unavailable', touchedProjectIds: new Set(), inactivated: 0 };
  }
  if (newerSnapshot.newer) {
    return { reconciled: false, reason: 'newer_snapshot_exists', touchedProjectIds: new Set(), inactivated: 0 };
  }

  const cutoff = summary.startedAt;
  const stale = await loadStaleOneCInboxRows(
    supabase,
    batch.source,
    cutoff,
    batch.snapshotSince,
  );
  if (!stale.available || stale.rows.length === 0) {
    return {
      reconciled: stale.available,
      reason: stale.available ? 'nothing_stale' : 'inbox_unavailable',
      touchedProjectIds: new Set(),
      inactivated: 0,
    };
  }

  const rowsByProject = new Map();
  for (const row of stale.rows) {
    if (!row.project_id) continue;
    const projectId = String(row.project_id);
    rowsByProject.set(projectId, [...(rowsByProject.get(projectId) || []), row]);
  }
  const entries = [...rowsByProject.entries()];
  const results = await runWithConcurrency(
    entries,
    PROJECT_UPDATE_CONCURRENCY,
    ([projectId, rows]) => updateProjectNotes(
      supabase,
      projectId,
      rows,
      batch.source,
      syncedAt,
      null,
      'reconcile',
      cutoff,
    ),
  );
  const touchedProjectIds = new Set();
  entries.forEach(([projectId], index) => {
    if (results[index]) touchedProjectIds.add(projectId);
  });

  for (let offset = 0; offset < stale.rows.length; offset += INBOX_UPSERT_BATCH_SIZE) {
    const ids = stale.rows.slice(offset, offset + INBOX_UPSERT_BATCH_SIZE).map((row) => row.id);
    const { error } = await supabase
      .from('one_c_accounting_records')
      .update({ is_active: false, updated_at: syncedAt })
      .in('id', ids)
      .eq('source', batch.source)
      .eq('is_active', true)
      .lt('last_seen_at', cutoff);
    if (error) throw error;
  }
  return {
    reconciled: true,
    reason: 'complete_snapshot',
    touchedProjectIds,
    inactivated: stale.rows.length,
  };
}

export async function ingestPayload(supabase, body) {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const payload = normalizeOneCPayload(body);
  const diagnostics = analyzeOneCPayload(body);
  const batch = normalizeOneCBatchContext(body, payload.source);
  if (batch.snapshotCapturedAt
    && Date.parse(batch.snapshotCapturedAt) > startedAt + MAX_SNAPSHOT_FUTURE_SKEW_MS) {
    const error = new Error('Момент снимка 1С слишком далеко в будущем');
    error.statusCode = 400;
    throw error;
  }
  const validEmptySnapshot = diagnostics.rawReceived === 0
    && !batch.legacy
    && batch.fullSnapshot
    && Boolean(batch.snapshotSince)
    && Boolean(batch.snapshotCapturedAt);
  if (diagnostics.rawReceived === 0 && !validEmptySnapshot) {
    const error = new Error('Пакет 1С не содержит корректных записей');
    error.statusCode = 400;
    throw error;
  }
  const counters = {
    rawReceived: diagnostics.rawReceived,
    accepted: diagnostics.accepted,
    rejected: diagnostics.rejected,
    rejectedReasons: diagnostics.rejectedReasons,
    matched: 0,
    unmatched: 0,
    unmatchedSummary: {},
    updatedProjects: 0,
    updatedProjectIds: new Set(),
    inboxUpserted: 0,
  };
  let auditWritten = false;
  let inboxAvailable = true;
  let sourceLeaseToken = '';

  try {
    // Reserve the source watermark before touching projects or the durable
    // inbox. Concurrent older snapshots can now see this row even while the
    // current batch is still matching and writing its records.
    // Legacy/incremental requests have no source capture watermark. They still
    // participate in the same exclusive source lease using their server start
    // time, but their original audit metadata remains non-snapshot and can
    // never authorize cleanup.
    const reservationContext = batch.snapshotCapturedAt
      ? { ...batch, sourceSnapshotVersioned: true }
      : { ...batch, snapshotCapturedAt: startedAtIso, sourceSnapshotVersioned: false };
    const reservation = await reserveOneCSyncBatch(
      supabase,
      reservationContext,
      counters,
      startedAtIso,
    );
    sourceLeaseToken = reservation.leaseToken || '';
    if (reservation.decision === 'busy') {
      auditWritten = true;
      const error = new Error('Другой пакет 1С для этой базы ещё обрабатывается; повторите отправку');
      error.statusCode = 503;
      error.code = 'ONEC_SYNC_BUSY';
      throw error;
    }
    if (reservation.decision === 'skipped') {
      const skippedAt = new Date().toISOString();
      const skipReason = reservation.reason || 'newer_snapshot_exists';
      // The atomic RPC already committed the explicit skipped ledger row.
      // A secondary status/history failure must not overwrite it as an error.
      auditWritten = true;
      const skippedSummary = {
        at: skippedAt,
        source: payload.source,
        runId: batch.runId,
        batchIndex: batch.batchIndex,
        batchCount: batch.batchCount,
        rawReceived: counters.rawReceived,
        received: 0,
        accepted: 0,
        rejected: counters.rejected,
        rejectedReasons: counters.rejectedReasons,
        matched: 0,
        unmatched: 0,
        updatedProjects: 0,
        inboxUpserted: 0,
        reconciled: false,
        inactivated: 0,
        skipped: true,
        skipReason,
      };
      const state = await saveSyncState(supabase, (previous) => ({
        ...previous,
        version: 1,
        lastSyncAt: skippedAt,
        source: payload.source,
        history: [
          skippedSummary,
          ...(Array.isArray(previous.history) ? previous.history : []),
        ].slice(0, MAX_HISTORY),
      }));
      console.info('1C accounting batch skipped as stale', JSON.stringify(skippedSummary));
      return publicStatus(state);
    }

    // The detailed register is part of a successful accounting exchange. Verify
    // it before changing project data so HUB never reports unmatched totals that
    // cannot be opened and resolved by the accountant. A packet containing only
    // rejected source rows does not need an inbox because it has no records to show.
    if (payload.records.length > 0) await ensureOneCInboxReady(supabase);

    const syncedAt = new Date().toISOString();
    if (payload.records.length > 0) {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id,name,notes,status,updated_at');
      if (projectsError) throw projectsError;

      const previousInbox = await loadPreviousOneCInbox(supabase, payload.records, payload.source);
      const { additions, removals, matches } = planOneCProjectChanges(
        payload.records,
        projects || [],
        payload.source,
        previousInbox,
      );
      for (const { record, match } of matches) {
        if (!match.project) {
          counters.unmatched += 1;
          const key = `${record.kind}:${match.reason}`;
          counters.unmatchedSummary[key] = (counters.unmatchedSummary[key] || 0) + 1;
          continue;
        }
        counters.matched += 1;
      }

      const projectsById = new Map((projects || []).map((project) => [String(project.id), project]));
      const touchedProjects = new Set();
      const removalEntries = [...removals.entries()];
      const removalResults = await runWithConcurrency(
        removalEntries,
        PROJECT_UPDATE_CONCURRENCY,
        ([projectId, records]) => updateProjectNotes(
          supabase,
          projectId,
          records,
          payload.source,
          syncedAt,
          projectsById.get(projectId),
          'remove',
        ),
      );
      removalEntries.forEach(([projectId], index) => {
        if (removalResults[index]) touchedProjects.add(projectId);
      });

      const additionEntries = [...additions.entries()];
      const additionResults = await runWithConcurrency(
        additionEntries,
        PROJECT_UPDATE_CONCURRENCY,
        ([projectId, records]) => updateProjectNotes(
          supabase,
          projectId,
          records,
          payload.source,
          syncedAt,
          // A removal in this batch changed the project timestamp, so force a
          // fresh read instead of retrying once with the now-stale snapshot.
          removals.has(projectId) ? null : projectsById.get(projectId),
          'merge',
        ),
      );
      additionEntries.forEach(([projectId], index) => {
        if (additionResults[index]) touchedProjects.add(projectId);
      });
      counters.updatedProjectIds = touchedProjects;
      counters.updatedProjects = touchedProjects.size;

      // A durable rematch is published only after the old project was cleaned
      // and the new project note (if any) committed successfully.
      const inbox = await persistOneCInbox(supabase, matches, payload.source, syncedAt);
      inboxAvailable = inbox.available;
      counters.inboxUpserted = inbox.upserted;
    } else if (diagnostics.rawReceived > 0) {
      console.warn('1C accounting batch contains only rejected records', JSON.stringify(diagnostics));
    }

    // Publish the successful current batch first. Reconciliation is allowed only
    // after the durable ledger proves that every batch of this full run arrived.
    const successfulAudit = await persistOneCSyncBatch(
      supabase,
      batch,
      counters,
      'success',
      '',
      startedAtIso,
    );
    const reconciliation = reservation.available && successfulAudit.available
      ? await reconcileCompleteOneCRun(supabase, batch, syncedAt)
      : {
        reconciled: false,
        reason: 'reservation_unavailable',
        touchedProjectIds: new Set(),
        inactivated: 0,
      };
    for (const projectId of reconciliation.touchedProjectIds) {
      counters.updatedProjectIds.add(projectId);
    }
    counters.updatedProjects = counters.updatedProjectIds.size;
    // The final upsert includes project IDs touched by snapshot reconciliation.
    await persistOneCSyncBatch(supabase, batch, counters, 'success', '', startedAtIso);

    const summary = {
      at: syncedAt,
      source: payload.source,
      runId: batch.runId,
      batchIndex: batch.batchIndex,
      batchCount: batch.batchCount,
      rawReceived: counters.rawReceived,
      received: payload.records.length,
      accepted: counters.accepted,
      rejected: counters.rejected,
      rejectedReasons: counters.rejectedReasons,
      matched: counters.matched,
      unmatched: counters.unmatched,
      updatedProjects: counters.updatedProjects,
      inboxUpserted: counters.inboxUpserted,
      reconciled: reconciliation.reconciled,
      inactivated: reconciliation.inactivated,
    };
    const state = await saveSyncState(supabase, (previous) => ({
      ...previous,
      version: 1,
      lastSyncAt: syncedAt,
      lastSuccessAt: syncedAt,
      lastError: '',
      lastErrorAt: null,
      lastErrorCode: '',
      source: payload.source,
      rawReceived: summary.rawReceived,
      received: summary.received,
      accepted: summary.accepted,
      rejectedCount: summary.rejected,
      rejectedReasons: summary.rejectedReasons,
      matched: summary.matched,
      unmatchedCount: summary.unmatched,
      updatedProjects: summary.updatedProjects,
      inboxUpserted: summary.inboxUpserted,
      unmatchedSummary: counters.unmatchedSummary,
      unmatched: [],
      history: [summary, ...(Array.isArray(previous.history) ? previous.history : [])].slice(0, MAX_HISTORY),
    }));
    auditWritten = true;
    console.info('1C accounting batch processed', JSON.stringify({
      runId: batch.runId,
      batchIndex: batch.batchIndex,
      batchCount: batch.batchCount,
      rawReceived: summary.rawReceived,
      received: summary.received,
      accepted: summary.accepted,
      rejected: summary.rejected,
      rejectedReasons: summary.rejectedReasons,
      matched: summary.matched,
      unmatched: summary.unmatched,
      updatedProjects: summary.updatedProjects,
      inboxAvailable,
      inboxUpserted: summary.inboxUpserted,
      reconciled: summary.reconciled,
      inactivated: summary.inactivated,
      durationMs: Date.now() - startedAt,
    }));
    return publicStatus(state);
  } catch (error) {
    if (!auditWritten && !error?.skipAudit) {
      try {
        await persistOneCSyncBatch(supabase, batch, counters, 'error', error?.message, startedAtIso);
      } catch (auditError) {
        console.error('Failed to persist 1C batch error audit:', auditError);
      }
    }
    throw error;
  } finally {
    if (sourceLeaseToken) {
      try {
        await releaseOneCSourceLease(supabase, batch.source, sourceLeaseToken);
      } catch (releaseError) {
        console.error('Failed to release 1C source lease:', releaseError);
      }
    }
  }
}

function remoteHeaders() {
  const headers = { Accept: 'application/json' };
  if (process.env.ONEC_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.ONEC_BEARER_TOKEN}`;
  } else if (process.env.ONEC_USERNAME || process.env.ONEC_PASSWORD) {
    headers.Authorization = `Basic ${Buffer.from(`${process.env.ONEC_USERNAME || ''}:${process.env.ONEC_PASSWORD || ''}`).toString('base64')}`;
  }
  return headers;
}

async function pullFromOneC() {
  const url = String(process.env.ONEC_SYNC_URL || '').trim();
  if (!url) {
    const error = new Error('В HUB ещё не указан адрес HTTP-сервиса 1С');
    error.statusCode = 503;
    error.code = 'ONEC_PULL_NOT_CONFIGURED';
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      method: String(process.env.ONEC_SYNC_METHOD || 'GET').toUpperCase(),
      headers: remoteHeaders(),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`1С ответила HTTP ${response.status}: ${raw.slice(0, 300)}`);
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('HTTP-сервис 1С вернул не JSON');
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function recordFailure(supabase, error) {
  try {
    const at = new Date().toISOString();
    const errorCode = String(error?.code || '').toUpperCase();
    const failure = errorCode === 'ONEC_SCHEMA_NOT_READY'
      ? {
        code: 'schema_not_ready',
        message: 'HUB ожидает обновления базы. Данные последнего успешного обмена сохранены и не повреждены.',
      }
      : errorCode === 'ONEC_SYNC_BUSY'
        ? {
          code: 'sync_busy',
          message: 'Предыдущий пакет 1С ещё обрабатывается. Повторная отправка будет принята после его завершения.',
        }
        : errorCode === 'ONEC_PULL_NOT_CONFIGURED'
          ? {
            code: 'pull_not_configured',
            message: 'Ручное получение из 1С ещё не настроено. Автоматическая отправка из 1С продолжает работать отдельно.',
          }
          : {
            code: 'sync_failed',
            message: 'Последняя попытка обмена не завершилась. Подробности записаны в защищённом журнале сервера.',
          };
    await saveSyncState(supabase, (previous) => ({
      ...previous,
      lastSyncAt: at,
      lastErrorAt: at,
      lastError: failure.message,
      lastErrorCode: failure.code,
    }));
  } catch (stateError) {
    console.error('Failed to record 1C sync error:', stateError);
  }
}

export default async function handler(req, res) {
  setCors(res, 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hub-1C-Key, X-OneC-Key, X-Suite-User-Id, X-User-Id, X-User-Name, X-User-Role');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ success: false, error: 'Method not allowed' });

  let supabase;
  let authenticated = false;
  try {
    supabase = getSupabaseAdmin();
    if (req.method === 'GET') {
      await requireAccountingUser(req, supabase);
      authenticated = true;
      if (String(req.query?.resource || '').toLowerCase() === 'inbox') {
        const inbox = await loadOneCInboxPage(supabase, req.query);
        return res.status(200).json({ success: true, ...inbox });
      }
      const [latestRun, state] = await Promise.all([
        loadLatestOneCRun(supabase),
        loadSyncState(supabase),
      ]);
      return res.status(200).json({
        success: true,
        status: publicStatus(state, latestRun),
      });
    }

    const body = parseBody(req);
    if (await isExternalOneCRequest(req, supabase)) {
      authenticated = true;
      if (isOneCNoopBatch(body)) {
        return res.status(200).json({ success: true, probe: true, received: 0 });
      }
      const status = await ingestPayload(supabase, body);
      return res.status(200).json({ success: true, status });
    }

    const { user } = await requireAccountingUser(req, supabase);
    authenticated = true;
    if (body?.action === 'rotate_key') {
      if (String(user.role || '') !== 'admin') {
        const accessError = new Error('Только администратор может создать ключ обмена 1С');
        accessError.statusCode = 403;
        throw accessError;
      }
      const secret = crypto.randomBytes(32).toString('base64url');
      const state = await saveSyncState(supabase, (previous) => ({
        ...previous,
        version: 1,
        secretHash: hashSharedSecret(secret),
        pushConfiguredAt: new Date().toISOString(),
      }));
      return res.status(200).json({ success: true, status: publicStatus(state), integrationKey: secret });
    }
    if (body?.action !== 'pull') {
      return res.status(400).json({ success: false, error: 'Для ручного запуска укажите action=pull' });
    }
    const payload = await pullFromOneC();
    const status = await ingestPayload(supabase, payload);
    return res.status(200).json({ success: true, status });
  } catch (error) {
    console.error('1C accounting sync error:', error);
    if (req.method === 'POST' && supabase && authenticated && (!error.statusCode || error.statusCode >= 500)) {
      await recordFailure(supabase, error);
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Ошибка синхронизации с 1С',
    });
  }
}
