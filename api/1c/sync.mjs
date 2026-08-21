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
  matchOneCRecord,
  mergeOneCRecordsIntoNotes,
  normalizeOneCPayload,
  runWithConcurrency,
  secureSecretMatches,
} from '../_1c-sync-utils.mjs';

const ACCOUNTING_ROLES = new Set(['accountant', 'ceo', 'admin']);
const MAX_HISTORY = 30;
const PROJECT_UPDATE_CONCURRENCY = 8;

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
  const { data, error } = await supabase.from('app_settings').select('id,companies').limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('app_settings row not found');
  return { row: data, envelope: settingsEnvelope(data.companies) };
}

async function saveSyncState(supabase, state) {
  const { row, envelope } = await loadSettings(supabase);
  const { error } = await supabase
    .from('app_settings')
    .update({ companies: { ...envelope, oneCAccounting: state } })
    .eq('id', row.id);
  if (error) throw error;
}

function publicStatus(state = {}) {
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
    source: state.source || '',
    received: Number(state.received || 0),
    matched: Number(state.matched || 0),
    unmatchedCount: Number(state.unmatchedCount || 0),
    unmatchedSummary: state.unmatchedSummary && typeof state.unmatchedSummary === 'object' ? state.unmatchedSummary : {},
    updatedProjects: Number(state.updatedProjects || 0),
    unmatched: [],
    history: Array.isArray(state.history) ? state.history.slice(0, 10) : [],
  };
}

async function requireAccountingUser(req, supabase) {
  const user = await getRequestUser(req, supabase);
  if (!user || !ACCOUNTING_ROLES.has(String(user.role || ''))) {
    const error = new Error('Нет доступа к синхронизации 1С');
    error.statusCode = 403;
    throw error;
  }
  return user;
}

async function isExternalOneCRequest(req, supabase) {
  const received = header(req, 'x-hub-1c-key') || header(req, 'x-onec-key');
  if (secureSecretMatches(received, process.env.ONEC_SYNC_SECRET || '')) return true;
  if (!received) return false;
  const { envelope } = await loadSettings(supabase);
  return secureSecretMatches(hashSharedSecret(received), envelope.oneCAccounting?.secretHash || '');
}

async function updateProjectNotes(supabase, projectId, records, source, syncedAt, initialProject = null) {
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

    const notes = mergeOneCRecordsIntoNotes(current.notes, records, source, syncedAt);
    let query = supabase
      .from('projects')
      .update({ notes, updated_at: syncedAt })
      .eq('id', projectId);
    if (current.updated_at) query = query.eq('updated_at', current.updated_at);
    const { data: rows, error: updateError } = await query.select('id');
    if (updateError) throw updateError;
    if (Array.isArray(rows) && rows.length > 0) return;
    current = null;
  }
  throw new Error(`Project ${projectId} changed during 1C sync`);
}

async function ingestPayload(supabase, body) {
  const startedAt = Date.now();
  const payload = normalizeOneCPayload(body);
  if (payload.records.length === 0) {
    const error = new Error('Пакет 1С не содержит корректных записей');
    error.statusCode = 400;
    throw error;
  }

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id,name,notes,status,updated_at');
  if (projectsError) throw projectsError;

  const grouped = new Map();
  const unmatched = [];
  for (const record of payload.records) {
    const match = matchOneCRecord(record, projects || []);
    if (!match.project) {
      unmatched.push({ kind: record.kind, reason: match.reason });
      continue;
    }
    const projectId = String(match.project.id);
    grouped.set(projectId, [...(grouped.get(projectId) || []), record]);
  }

  const syncedAt = new Date().toISOString();
  const projectsById = new Map((projects || []).map((project) => [String(project.id), project]));
  await runWithConcurrency(
    grouped.entries(),
    PROJECT_UPDATE_CONCURRENCY,
    ([projectId, records]) => updateProjectNotes(
      supabase,
      projectId,
      records,
      payload.source,
      syncedAt,
      projectsById.get(projectId),
    ),
  );

  const { envelope } = await loadSettings(supabase);
  const previous = envelope.oneCAccounting && typeof envelope.oneCAccounting === 'object'
    ? envelope.oneCAccounting
    : {};
  const unmatchedSummary = unmatched.reduce((result, item) => {
    const key = `${item.kind}:${item.reason}`;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const summary = {
    at: syncedAt,
    source: payload.source,
    received: payload.records.length,
    matched: payload.records.length - unmatched.length,
    unmatched: unmatched.length,
    updatedProjects: grouped.size,
  };
  const state = {
    ...previous,
    version: 1,
    lastSyncAt: syncedAt,
    lastSuccessAt: syncedAt,
    lastError: '',
    source: payload.source,
    received: summary.received,
    matched: summary.matched,
    unmatchedCount: unmatched.length,
    updatedProjects: summary.updatedProjects,
    unmatchedSummary,
    unmatched: [],
    history: [summary, ...(Array.isArray(previous.history) ? previous.history : [])].slice(0, MAX_HISTORY),
  };
  await saveSyncState(supabase, state);
  console.info('1C accounting batch processed', JSON.stringify({
    received: summary.received,
    matched: summary.matched,
    unmatched: summary.unmatched,
    updatedProjects: summary.updatedProjects,
    durationMs: Date.now() - startedAt,
  }));
  return publicStatus(state);
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

async function recordFailure(supabase) {
  try {
    const { envelope } = await loadSettings(supabase);
    const previous = envelope.oneCAccounting && typeof envelope.oneCAccounting === 'object'
      ? envelope.oneCAccounting
      : {};
    const at = new Date().toISOString();
    await saveSyncState(supabase, {
      ...previous,
      lastSyncAt: at,
      lastErrorAt: at,
      lastError: 'Ошибка связи с 1С. Подробности записаны в защищённом журнале сервера.',
    });
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
      const { envelope } = await loadSettings(supabase);
      return res.status(200).json({ success: true, status: publicStatus(envelope.oneCAccounting) });
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

    const user = await requireAccountingUser(req, supabase);
    authenticated = true;
    if (body?.action === 'rotate_key') {
      if (String(user.role || '') !== 'admin') {
        const accessError = new Error('Только администратор может создать ключ обмена 1С');
        accessError.statusCode = 403;
        throw accessError;
      }
      const secret = crypto.randomBytes(32).toString('base64url');
      const { envelope } = await loadSettings(supabase);
      const previous = envelope.oneCAccounting && typeof envelope.oneCAccounting === 'object'
        ? envelope.oneCAccounting
        : {};
      const state = {
        ...previous,
        version: 1,
        secretHash: hashSharedSecret(secret),
        pushConfiguredAt: new Date().toISOString(),
      };
      await saveSyncState(supabase, state);
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
    if (supabase && authenticated && (!error.statusCode || error.statusCode >= 500)) await recordFailure(supabase);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Ошибка синхронизации с 1С',
    });
  }
}
