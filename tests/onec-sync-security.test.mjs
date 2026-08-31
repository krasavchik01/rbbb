import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRequestUser, normalizeEmployeeRole } from '../api/_email-utils.mjs';
import {
  ingestPayload,
  requireAccountingUser,
  saveSyncState,
  updateProjectNotes,
} from '../api/1c/sync.mjs';

const migrationUrl = new URL(
  '../supabase/migrations/20260821110000_create_one_c_accounting_records.sql',
  import.meta.url,
);
const counterpartyScopeMigrationUrl = new URL(
  '../supabase/migrations/20260831113000_split_one_c_projects_and_suppliers.sql',
  import.meta.url,
);
const syncUrl = new URL('../api/1c/sync.mjs', import.meta.url);
const vercelUrl = new URL('../vercel.json', import.meta.url);

test('1C durable tables are service-only and project deletion invalidates a match', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.one_c_accounting_records/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.one_c_sync_batches/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.one_c_accounting_state/i);
  assert.match(sql, /is_active BOOLEAN NOT NULL DEFAULT true/i);
  assert.match(sql, /updated_project_ids JSONB NOT NULL DEFAULT '\[\]'::jsonb/i);
  assert.match(sql, /full_snapshot BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(sql, /snapshot_since DATE/i);
  assert.match(sql, /snapshot_captured_at TIMESTAMPTZ/i);
  assert.match(sql, /one_c_sync_batches_snapshot_guard_idx/i);
  assert.match(sql, /CHECK \(status IN \('processing', 'skipped', 'success', 'error'\)\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.one_c_sync_source_gates/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.reserve_one_c_sync_batch/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /active_lease_token/i);
  assert.match(sql, /latest_snapshot_captured_at >= v_capture/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.release_one_c_sync_source_lease/i);
  assert.match(sql, /v_capture > v_now \+ INTERVAL '5 minutes'/i);
  assert.match(sql, /USING ERRCODE = '22007'/i);
  assert.match(sql, /companies(?:::\w+)? -> 'oneCAccounting'/i);
  assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/i);
  assert.match(sql, /UNIQUE \(source, run_id, batch_index\)/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.one_c_accounting_records FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.one_c_sync_batches FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.one_c_accounting_state FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.one_c_sync_source_gates FROM PUBLIC, anon, authenticated/i);
  assert.doesNotMatch(sql, /GRANT SELECT ON TABLE public\.one_c_accounting_records TO authenticated/i);
  for (const statement of sql.match(/GRANT[\s\S]*?;/gi) || []) {
    assert.match(statement, /TO service_role\s*;/i);
    assert.doesNotMatch(statement, /TO (?:anon|authenticated|PUBLIC)\b/i);
  }
  assert.match(sql, /NEW\.match_status := 'unmatched'/i);
  assert.match(sql, /NEW\.match_reason := 'project_deleted'/i);
  assert.match(sql, /OLD\.match_status = 'matched'[\s\S]*NEW\.match_status = 'matched'/i);
  assert.match(sql, /WHERE project_id IS NULL\s+AND match_status = 'matched'/i);
});

test('1C source lease outlives the explicitly bounded serverless handler', async () => {
  const source = await readFile(syncUrl, 'utf8');
  const config = JSON.parse(await readFile(vercelUrl, 'utf8'));
  assert.equal(config.functions?.['api/1c/sync.mjs']?.maxDuration, 300);
  assert.match(source, /const ONE_C_SOURCE_LEASE_SECONDS = 30 \* 60/);
  assert.ok(30 * 60 > config.functions['api/1c/sync.mjs'].maxDuration);
});

test('1C supplier classification is durable and remains service-only', async () => {
  const sql = await readFile(counterpartyScopeMigrationUrl, 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS auto_scope TEXT NOT NULL DEFAULT 'review'/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS manual_scope TEXT/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.one_c_counterparty_scopes/i);
  assert.match(sql, /scope IN \('project', 'supplier', 'other'\)/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.one_c_counterparty_scopes FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT ALL ON TABLE public\.one_c_counterparty_scopes TO service_role/i);
  assert.doesNotMatch(sql, /GRANT SELECT ON TABLE public\.one_c_counterparty_scopes TO authenticated/i);
});

test('source-gate migration seeds only proven successful imports, including successful NULL rollout barriers', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(
    sql,
    /WITH ranked AS \([\s\S]*?FROM public\.one_c_sync_batches\s+WHERE status = 'success'[\s\S]*?\)\s*INSERT INTO public\.one_c_sync_source_gates/i,
  );

  const rows = [
    {
      run_id: 'older-success', status: 'success',
      snapshot_captured_at: '2026-08-21T10:00:00.000Z',
      completed_at: '2026-08-21T10:01:00.000Z',
    },
    {
      run_id: 'newer-failed', status: 'error',
      snapshot_captured_at: '2026-08-21T11:00:00.000Z',
      completed_at: '2026-08-21T11:01:00.000Z',
    },
    {
      run_id: 'successful-rollout-null', status: 'success',
      snapshot_captured_at: null,
      completed_at: '2026-08-21T10:30:00.000Z',
    },
  ];
  const seeded = rows
    .filter((row) => row.status === 'success')
    .sort((left, right) => String(right.snapshot_captured_at || right.completed_at)
      .localeCompare(String(left.snapshot_captured_at || left.completed_at)))[0];
  assert.equal(seeded.run_id, 'successful-rollout-null');
  assert.notEqual(seeded.run_id, 'newer-failed');
});

test('1C inbox is exposed only through the protected bounded API path', async () => {
  const source = await readFile(syncUrl, 'utf8');
  assert.match(source, /requireAccountingUser\(req, supabase\)/);
  assert.match(source, /req\.query\?\.resource/);
  assert.match(source, /\.eq\('match_status', 'unmatched'\)/);
  assert.match(source, /\.is\('project_id', null\)/);
  assert.match(source, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(source, /\.limit\(limit \+ 1\)/);
  assert.match(source, /resolveAccountingRoles\(envelope\.projectAccess\)/);
  assert.ok(
    source.indexOf('if (await isExternalOneCRequest(req, supabase))')
      < source.indexOf('const { user } = await requireAccountingUser(req, supabase)'),
    '1C shared-key POST must remain independent from interactive JWT accounting auth',
  );
});

test('1C health reads never overwrite sync health and successful writes clear the full error state', async () => {
  const source = await readFile(syncUrl, 'utf8');
  assert.match(
    source,
    /if \(req\.method === 'POST' && supabase && authenticated[\s\S]*?recordFailure\(supabase, error\)/,
  );
  assert.doesNotMatch(
    source,
    /if \(supabase && authenticated[\s\S]{0,160}?recordFailure\(supabase\)/,
  );
  assert.match(source, /lastError:\s*''[\s\S]{0,100}?lastErrorAt:\s*null[\s\S]{0,100}?lastErrorCode:\s*''/);
});

test('1C schema rollout failure is stored as a safe actionable state, not a false connection loss', async () => {
  const source = await readFile(syncUrl, 'utf8');
  assert.match(source, /error\.code = 'ONEC_SCHEMA_NOT_READY'/);
  assert.match(source, /code:\s*'schema_not_ready'/);
  assert.match(source, /HUB ожидает обновления базы\. Данные последнего успешного обмена сохранены и не повреждены\./);
  assert.doesNotMatch(source, /lastError:\s*'Ошибка связи с 1С/);
});

test('1C inbox persistence follows successful project note updates', async () => {
  const source = await readFile(syncUrl, 'utf8');
  const futureGuard = source.indexOf("new Error('Момент снимка 1С слишком далеко в будущем')");
  const reservation = source.indexOf('const reservation = await reserveOneCSyncBatch', futureGuard);
  const inboxReadiness = source.indexOf('await ensureOneCInboxReady(supabase);', reservation);
  const projectRead = source.indexOf(".from('projects')", inboxReadiness);
  const removalUpdate = source.indexOf('const removalResults = await runWithConcurrency(');
  const additionUpdate = source.indexOf('const additionResults = await runWithConcurrency(', removalUpdate);
  const inboxWrite = source.indexOf('const inbox = await persistOneCInbox', additionUpdate);
  assert.ok(reservation >= 0);
  assert.ok(futureGuard >= 0 && futureGuard < reservation, 'future watermark validation must precede reservation');
  assert.ok(inboxReadiness > reservation && inboxReadiness < projectRead, 'durable inbox must be ready before project mutations');
  assert.ok(removalUpdate > reservation, 'durable processing reservation must precede project mutations');
  assert.ok(additionUpdate > removalUpdate, 'old project cleanup must complete before the new project merge');
  assert.ok(inboxWrite > additionUpdate, 'durable match must be published only after both note phases');
});

function projectCasSupabase(initialProject) {
  const project = structuredClone(initialProject);
  const casLog = [];
  return {
    project,
    casLog,
    from(table) {
      assert.equal(table, 'projects');
      let updateValue = null;
      let expectedId = null;
      let expectedMode = null;
      let expectedUpdatedAt;
      const query = {
        update(value) { updateValue = structuredClone(value); return query; },
        eq(column, value) {
          if (column === 'id') expectedId = value;
          if (column === 'updated_at') {
            expectedMode = 'eq';
            expectedUpdatedAt = value;
          }
          return query;
        },
        is(column, value) {
          if (column === 'updated_at') {
            expectedMode = 'is';
            expectedUpdatedAt = value;
          }
          return query;
        },
        select() {
          if (!updateValue) return query;
          casLog.push({ expectedMode, expectedUpdatedAt, nextUpdatedAt: updateValue.updated_at });
          const matchesId = String(expectedId) === String(project.id);
          const matchesVersion = expectedMode === 'is'
            ? project.updated_at === null && expectedUpdatedAt === null
            : expectedMode === 'eq' && project.updated_at === expectedUpdatedAt;
          if (!matchesId || !matchesVersion) return Promise.resolve({ data: [], error: null });
          project.notes = updateValue.notes;
          project.updated_at = updateValue.updated_at;
          return Promise.resolve({ data: [{ id: project.id }], error: null });
        },
        async maybeSingle() { return { data: structuredClone(project), error: null }; },
      };
      return query;
    },
  };
}

test('sequential 1C project mutations mint distinct CAS tokens and reject a stale external writer', async () => {
  const originalToken = '2026-08-21T10:00:00.000Z';
  const supabase = projectCasSupabase({ id: 'project-1', notes: {}, updated_at: originalToken });
  const record = (externalId) => ({
    kind: 'invoice', externalId, number: externalId, date: '2026-08-20', amount: 100,
    status: 'issued', requireEsf: false,
  });
  const sharedBatchTime = '2026-08-21T10:01:00.000Z';

  await updateProjectNotes(
    supabase, 'project-1', [record('invoice-a')], 'MAK', sharedBatchTime,
    structuredClone(supabase.project),
  );
  const firstToken = supabase.project.updated_at;
  await updateProjectNotes(
    supabase, 'project-1', [record('invoice-b')], 'MAK', sharedBatchTime,
  );
  const secondToken = supabase.project.updated_at;

  assert.ok(Date.parse(firstToken) > Date.parse(originalToken));
  assert.ok(Date.parse(secondToken) > Date.parse(firstToken));
  assert.notEqual(firstToken, sharedBatchTime);
  assert.notEqual(secondToken, sharedBatchTime);

  const { data: staleRows } = await supabase
    .from('projects')
    .update({ notes: { stale: true }, updated_at: '2026-08-21T10:02:00.000Z' })
    .eq('id', 'project-1')
    .eq('updated_at', originalToken)
    .select('id');
  assert.deepEqual(staleRows, []);
  assert.equal(supabase.project.notes.stale, undefined);
  assert.equal(supabase.project.notes.accounting.documents.length, 2);
});

test('1C project CAS guards a NULL updated_at with IS NULL before writing a fresh token', async () => {
  const supabase = projectCasSupabase({ id: 'project-null', notes: {}, updated_at: null });
  await updateProjectNotes(
    supabase,
    'project-null',
    [{
      kind: 'invoice', externalId: 'invoice-null', number: 'N-1',
      date: '2026-08-20', amount: 100, status: 'issued', requireEsf: false,
    }],
    'MAK',
    '2026-08-21T10:01:00.000Z',
    structuredClone(supabase.project),
  );
  assert.equal(supabase.casLog[0]?.expectedMode, 'is');
  assert.equal(supabase.casLog[0]?.expectedUpdatedAt, null);
  assert.ok(Number.isFinite(Date.parse(supabase.project.updated_at)));
});

test('employee database roles and levels normalize to projectAccess keys', async () => {
  assert.equal(normalizeEmployeeRole('assistant', '3'), 'assistant_3');
  assert.equal(normalizeEmployeeRole('manager', '2'), 'manager_2');
  assert.equal(normalizeEmployeeRole('supervisor', '3'), 'supervisor_3');
  assert.equal(normalizeEmployeeRole('tax_specialist', '2'), 'tax_specialist_2');
  assert.equal(normalizeEmployeeRole('project_manager', '1'), 'project_leader');
  assert.equal(normalizeEmployeeRole('designer', '1'), 'admin_assistant');

  const supabase = {
    auth: {
      async getUser() {
        return { data: { user: { id: 'auth-1', email: 'manager@example.invalid' } } };
      },
    },
    from(table) {
      assert.equal(table, 'employees');
      return {
        select() { return this; },
        ilike() { return this; },
        async maybeSingle() {
          return {
            data: {
              id: 'employee-1', email: 'manager@example.invalid', role: 'manager', level: '2',
            },
          };
        },
      };
    },
  };
  const user = await getRequestUser(
    { headers: { authorization: 'Bearer valid-token' } },
    supabase,
  );
  assert.equal(user.role, 'manager_2');
  assert.equal(user.level, '2');
  assert.equal(user.authMethod, 'jwt');
});

function accountingAuthSupabase({ authUser = null, employee, accounting = ['accountant', 'ceo', 'admin'] }) {
  return {
    auth: { getUser: async () => ({ data: { user: authUser } }) },
    from(table) {
      if (table === 'employees') {
        return {
          select() { return this; },
          ilike() { return this; },
          eq() { return this; },
          async maybeSingle() { return { data: employee || null }; },
        };
      }
      if (table === 'app_settings') {
        return {
          select() { return this; },
          limit() { return this; },
          async maybeSingle() {
            return {
              data: {
                id: 'settings-1',
                companies: {
                  __suiteASettings: 1,
                  companies: [],
                  projectAccess: { accounting },
                },
              },
              error: null,
            };
          },
        };
      }
      if (table === 'one_c_accounting_state') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: null,
              error: { code: 'PGRST205', message: "Could not find the table 'public.one_c_accounting_state'" },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

test('service-role accounting reads reject spoofed legacy UUID headers', async () => {
  const supabase = accountingAuthSupabase({
    employee: { id: 'admin-id', email: 'admin@example.invalid', role: 'admin', level: '1' },
  });
  await assert.rejects(
    requireAccountingUser(
      { headers: { 'x-suite-user-id': 'admin-id' } },
      supabase,
    ),
    (error) => error.statusCode === 401,
  );
});

test('JWT accounting access uses normalized role and still blocks designer/admin assistant', async () => {
  const manager = await requireAccountingUser(
    { headers: { authorization: 'Bearer manager-token' } },
    accountingAuthSupabase({
      authUser: { id: 'auth-manager', email: 'manager@example.invalid' },
      employee: { id: 'manager-id', email: 'manager@example.invalid', role: 'manager', level: '2' },
      accounting: ['manager_2'],
    }),
  );
  assert.equal(manager.user.role, 'manager_2');
  assert.equal(manager.user.level, '2');

  await assert.rejects(
    requireAccountingUser(
      { headers: { authorization: 'Bearer designer-token' } },
      accountingAuthSupabase({
        authUser: { id: 'auth-designer', email: 'designer@example.invalid' },
        employee: { id: 'designer-id', email: 'designer@example.invalid', role: 'designer', level: '1' },
        accounting: ['admin_assistant'],
      }),
    ),
    (error) => error.statusCode === 403,
  );
});

function allRejectedSupabase(batchError = null, initialBatchRows = [], inboxError = null) {
  const calls = [];
  const batchRows = structuredClone(initialBatchRows);
  const settings = {
    id: 'settings-1',
    updated_at: '2026-08-21T00:00:00.000Z',
    companies: { __suiteASettings: 1, companies: [] },
  };
  let activeLease = null;
  let latestCapture = initialBatchRows
    .filter((row) => row.snapshot_captured_at)
    .sort((left, right) => String(right.snapshot_captured_at).localeCompare(String(left.snapshot_captured_at)))[0]
    || null;
  let hasVersionedSnapshot = initialBatchRows.some((row) => Boolean(row.snapshot_captured_at));
  return {
    calls,
    async rpc(name, args) {
      calls.push({ operation: 'rpc', name, args });
      if (name === 'release_one_c_sync_source_lease') {
        if (activeLease?.token === args.p_lease_token) activeLease = null;
        return { data: true, error: null };
      }
      assert.equal(name, 'reserve_one_c_sync_batch');
      const row = structuredClone(args.p_batch);
      const incomingCapture = String(row.snapshot_captured_at || '');
      let decision = 'accepted';
      let reason = '';
      if (row.source_snapshot_versioned !== true && hasVersionedSnapshot) {
        decision = 'skipped';
        reason = 'upgrade_required';
      } else if (latestCapture
        && String(latestCapture.snapshot_captured_at) >= incomingCapture
        && (String(latestCapture.snapshot_captured_at) > incomingCapture
          || latestCapture.run_id !== row.run_id)) {
        decision = 'skipped';
        reason = 'newer_snapshot_exists';
      } else if (activeLease && activeLease.token !== args.p_lease_token) {
        decision = 'busy';
        reason = 'source_busy';
      } else {
        activeLease = { token: args.p_lease_token, runId: row.run_id };
        if (!latestCapture || incomingCapture > String(latestCapture.snapshot_captured_at)) {
          latestCapture = { run_id: row.run_id, snapshot_captured_at: incomingCapture };
        }
        hasVersionedSnapshot ||= row.source_snapshot_versioned === true;
      }
      const audit = {
        ...row,
        status: decision === 'accepted' ? 'processing' : decision === 'skipped' ? 'skipped' : 'error',
        error_message: reason,
      };
      const index = batchRows.findIndex((candidate) => candidate.source === row.source
        && candidate.run_id === row.run_id && candidate.batch_index === row.batch_index);
      if (index >= 0) batchRows[index] = audit;
      else batchRows.push(audit);
      calls.push({ operation: 'atomic_reservation', value: audit, decision });
      return { data: [{ decision, reason }], error: null };
    },
    from(table) {
      calls.push({ operation: 'from', table });
      if (table === 'app_settings') {
        return {
          select() {
            return {
              limit() {
                return {
                  async maybeSingle() {
                    return { data: settings, error: null };
                  },
                };
              },
            };
          },
          update(value) {
            calls.push({ operation: 'settings_update', value });
            let matches = true;
            const query = {
              eq(column, expected) {
                if (column === 'id') matches = matches && settings.id === expected;
                if (column === 'updated_at') matches = matches && settings.updated_at === expected;
                return query;
              },
              is(column, expected) {
                if (column === 'updated_at') matches = matches && settings.updated_at === expected;
                return query;
              },
              async select() {
                if (!matches) return { data: [], error: null };
                settings.companies = value.companies;
                settings.updated_at = '2026-08-21T00:00:01.000Z';
                return { data: [{ id: settings.id, updated_at: settings.updated_at }], error: null };
              },
            };
            return query;
          },
        };
      }
      if (table === 'one_c_accounting_state') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: null,
              error: { code: 'PGRST205', message: "Could not find the table 'public.one_c_accounting_state'" },
            };
          },
        };
      }
      if (table === 'one_c_sync_batches') {
        const filters = {};
        let selectedColumns = '';
        const query = {
          async upsert(value) {
            calls.push({ operation: 'batch_upsert', value });
            const currentBatchError = typeof batchError === 'function'
              ? batchError(value)
              : batchError;
            const index = batchRows.findIndex((row) => row.source === value.source
              && row.run_id === value.run_id && row.batch_index === value.batch_index);
            if (!currentBatchError) {
              if (index >= 0) batchRows[index] = structuredClone(value);
              else batchRows.push(structuredClone(value));
            }
            return { error: currentBatchError };
          },
          select(columns = '') { selectedColumns = columns; return query; },
          eq(column, value) { filters[column] = value; return query; },
          neq(column, value) { filters[`neq:${column}`] = value; return query; },
          is(column, value) { filters[`is:${column}`] = value; return query; },
          gte(column, value) { filters[`gte:${column}`] = value; return query; },
          gt(column, value) { filters[`gt:${column}`] = value; return query; },
          limit() { return query; },
          order() { return query; },
          then(resolve, reject) {
            const currentBatchError = typeof batchError === 'function'
              ? batchError(selectedColumns.includes('snapshot_captured_at')
                ? { snapshot_captured_at: true }
                : {})
              : batchError;
            const data = batchRows.filter((row) => Object.entries(filters)
              .every(([key, value]) => {
                if (key.startsWith('neq:')) return row[key.slice(4)] !== value;
                if (key.startsWith('is:')) return row[key.slice(3)] === value;
                if (key.startsWith('gte:')) return String(row[key.slice(4)] || '') >= String(value || '');
                if (key.startsWith('gt:')) return String(row[key.slice(3)] || '') > String(value || '');
                return row[key] === value;
              }));
            return Promise.resolve({ data, error: currentBatchError }).then(resolve, reject);
          },
        };
        return query;
      }
      if (table === 'one_c_accounting_records') {
        const query = {
          select() { return query; }, eq() { return query; }, in() { return query; }, lt() { return query; },
          gte() { return query; }, gt() { return query; }, order() { return query; }, limit() { return query; },
          async upsert(value) {
            calls.push({ operation: 'inbox_upsert', value });
            return { error: null };
          },
          then(resolve, reject) { return Promise.resolve({ data: [], error: inboxError }).then(resolve, reject); },
        };
        return query;
      }
      if (table === 'one_c_counterparty_scopes') {
        const query = {
          select() { return query; },
          eq() { return query; },
          then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
        };
        return query;
      }
      if (table === 'projects') {
        return {
          select() { return this; },
          then(resolve, reject) {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          },
        };
      }
      throw new Error(`Unexpected table read: ${table}`);
    },
  };
}

test('1C sync state retries an app_settings CAS conflict without losing fresh settings or history', async () => {
  const settings = {
    id: 'settings-1',
    updated_at: 'version-1',
    companies: {
      __suiteASettings: 1,
      companies: [{ id: 'company-1' }],
      projectAccess: { accounting: ['accountant'] },
      oneCAccounting: {
        secretHash: 'old-secret',
        history: [{ runId: 'old-run' }],
      },
    },
  };
  let casAttempts = 0;
  const supabase = {
    from(table) {
      if (table === 'one_c_accounting_state') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: null,
              error: { code: 'PGRST205', message: "Could not find the table 'public.one_c_accounting_state'" },
            };
          },
        };
      }
      assert.equal(table, 'app_settings');
      return {
        select() {
          return {
            limit() {
              return {
                async maybeSingle() {
                  return { data: structuredClone(settings), error: null };
                },
              };
            },
          };
        },
        update(value) {
          let expectedId;
          let expectedUpdatedAt;
          const query = {
            eq(column, expected) {
              if (column === 'id') expectedId = expected;
              if (column === 'updated_at') expectedUpdatedAt = expected;
              return query;
            },
            is(column, expected) {
              if (column === 'updated_at') expectedUpdatedAt = expected;
              return query;
            },
            async select() {
              casAttempts += 1;
              if (casAttempts === 1) {
                settings.updated_at = 'version-2';
                settings.companies.projectAccess = { accounting: ['accountant', 'ceo'] };
                settings.companies.oneCAccounting = {
                  ...settings.companies.oneCAccounting,
                  secretHash: 'rotated-secret',
                  history: [
                    { runId: 'parallel-run' },
                    ...settings.companies.oneCAccounting.history,
                  ],
                };
              }
              if (expectedId !== settings.id || expectedUpdatedAt !== settings.updated_at) {
                return { data: [], error: null };
              }
              settings.companies = structuredClone(value.companies);
              settings.updated_at = `version-${casAttempts + 1}`;
              return { data: [{ id: settings.id, updated_at: settings.updated_at }], error: null };
            },
          };
          return query;
        },
      };
    },
  };

  const saved = await saveSyncState(supabase, (current) => ({
    ...current,
    lastSuccessAt: '2026-08-21T12:00:00.000Z',
    history: [{ runId: 'current-run' }, ...(current.history || [])],
  }));

  assert.equal(casAttempts, 2);
  assert.deepEqual(settings.companies.projectAccess, { accounting: ['accountant', 'ceo'] });
  assert.equal(settings.companies.oneCAccounting.secretHash, 'rotated-secret');
  assert.deepEqual(
    settings.companies.oneCAccounting.history.map((entry) => entry.runId),
    ['current-run', 'parallel-run', 'old-run'],
  );
  assert.equal(saved.lastSuccessAt, '2026-08-21T12:00:00.000Z');
});

test('dedicated 1C state CAS keeps secret and history independent from blind app_settings writers', async () => {
  const settings = {
    id: 'settings-1',
    updated_at: 'settings-version-1',
    companies: {
      __suiteASettings: 1,
      companies: [{ id: 'company-1' }],
      projectAccess: { accounting: ['accountant'] },
      oneCAccounting: {
        secretHash: 'legacy-gap-secret',
        pushConfiguredAt: '2026-08-21T10:30:00.000Z',
        history: [{ runId: 'legacy-gap-run' }],
      },
    },
  };
  const dedicated = {
    id: 'default',
    revision: 0,
    updated_at: '2026-08-21T10:00:00.000Z',
    state: {
      secretHash: 'dedicated-secret',
      pushConfiguredAt: '2026-08-21T10:00:00.000Z',
      history: [{ runId: 'base-run' }],
    },
  };
  let casAttempts = 0;
  const seenSecrets = [];
  const supabase = {
    from(table) {
      if (table === 'app_settings') {
        return {
          select() { return this; },
          limit() { return this; },
          async maybeSingle() { return { data: structuredClone(settings), error: null }; },
        };
      }
      assert.equal(table, 'one_c_accounting_state');
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: structuredClone(dedicated), error: null }; },
        update(value) {
          let expectedRevision;
          const query = {
            eq(column, expected) {
              if (column === 'revision') expectedRevision = expected;
              return query;
            },
            async select() {
              casAttempts += 1;
              if (casAttempts === 1) {
                dedicated.revision = 1;
                dedicated.state = {
                  ...dedicated.state,
                  secretHash: 'rotated-secret',
                  pushConfiguredAt: '2026-08-21T11:00:00.000Z',
                  history: [{ runId: 'parallel-run' }, ...dedicated.state.history],
                };
              }
              if (expectedRevision !== dedicated.revision) return { data: [], error: null };
              dedicated.state = structuredClone(value.state);
              dedicated.revision = value.revision;
              dedicated.updated_at = value.updated_at;
              return { data: [{ id: dedicated.id, revision: dedicated.revision }], error: null };
            },
          };
          return query;
        },
      };
    },
  };

  const saved = await saveSyncState(supabase, (current) => {
    seenSecrets.push(current.secretHash);
    return {
      ...current,
      lastSuccessAt: '2026-08-21T12:00:00.000Z',
      history: [{ runId: 'current-run' }, ...(current.history || [])],
    };
  });

  assert.equal(casAttempts, 2);
  assert.deepEqual(seenSecrets, ['legacy-gap-secret', 'rotated-secret']);
  assert.equal(dedicated.state.secretHash, 'rotated-secret');
  assert.deepEqual(
    dedicated.state.history.map((entry) => entry.runId),
    ['current-run', 'parallel-run', 'base-run'],
  );
  assert.deepEqual(settings.companies.projectAccess, { accounting: ['accountant'] });
  assert.equal(settings.companies.oneCAccounting.secretHash, 'legacy-gap-secret');
  assert.equal(saved.lastSuccessAt, '2026-08-21T12:00:00.000Z');
});

test('all-rejected nonempty batches return success and write counts without raw rows', async () => {
  const supabase = allRejectedSupabase();
  const status = await ingestPayload(supabase, {
    source: 'MAK',
    runId: 'run-rejected',
    batchIndex: 0,
    batchCount: 1,
    records: [
      { type: 'payment', id: 'zero', date: '2026-08-21', amount: 0 },
      { type: 'payment', id: 'negative', date: '2026-08-21', amount: -10 },
    ],
  });

  assert.equal(status.rawReceived, 2);
  assert.equal(status.accepted, 0);
  assert.equal(status.rejectedCount, 2);
  assert.equal(status.matched, 0);
  assert.equal(supabase.calls.some((call) => call.table === 'projects'), false);
  assert.equal(supabase.calls.some((call) => call.table === 'one_c_accounting_records'), false);
  const audit = supabase.calls.filter((call) => call.operation === 'batch_upsert').at(-1)?.value;
  assert.equal(audit.status, 'success');
  assert.equal(audit.raw_count, 2);
  assert.equal(audit.accepted_count, 0);
  assert.equal(audit.rejected_count, 2);
});

test('stale batch is reserved then skipped before any project or inbox read/write', async () => {
  const newerReservation = {
    source: 'MAK', run_id: 'newer-run', batch_index: 1, batch_count: 2,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 0, unmatched_count: 0, unmatched_reasons: {},
    updated_projects: 0, updated_project_ids: [], full_snapshot: true,
    snapshot_since: '2024-01-01', snapshot_captured_at: '2026-08-21T10:10:00.000Z',
    status: 'processing', error_message: '',
    started_at: '2026-08-21T10:10:01.000Z', completed_at: '2026-08-21T10:10:01.000Z',
  };
  const supabase = allRejectedSupabase(null, [newerReservation]);
  const status = await ingestPayload(supabase, {
    source: 'MAK', runId: 'older-run', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01',
    snapshotCapturedAt: '2026-08-21T10:00:00Z',
    records: [{
      type: 'invoice', id: 'would-reactivate', date: '2026-08-20', amount: 100,
      contractNumber: 'D-1', counterpartyBin: '123456789012',
    }],
  });

  assert.equal(supabase.calls.some((call) => call.table === 'projects'), false);
  assert.equal(supabase.calls.some((call) => call.table === 'one_c_accounting_records'), false);
  assert.deepEqual(
    supabase.calls.filter((call) => call.operation === 'atomic_reservation').map((call) => call.decision),
    ['skipped'],
  );
  assert.equal(status.history[0]?.skipped, true);
  assert.equal(status.history[0]?.skipReason, 'newer_snapshot_exists');
  assert.equal(status.history[0]?.updatedProjects, 0);
  assert.equal(status.history[0]?.inboxUpserted, 0);
});

test('empty malformed batches remain HTTP 400 and do not write audit rows', async () => {
  const supabase = allRejectedSupabase();
  await assert.rejects(
    ingestPayload(supabase, { records: [] }),
    (error) => error.statusCode === 400,
  );
  assert.equal(supabase.calls.length, 0);
});

test('a far-future source watermark is rejected before reservation or data access', async () => {
  const supabase = allRejectedSupabase();
  await assert.rejects(
    ingestPayload(supabase, {
      source: 'MAK', runId: 'future-run', batchIndex: 0, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2099-01-01T00:00:00Z', records: [],
    }),
    (error) => error.statusCode === 400 && /будущем/i.test(error.message),
  );
  assert.equal(supabase.calls.length, 0);
});

test('versioned imports fail closed before project or inbox writes when atomic gate is unavailable', async () => {
  const supabase = allRejectedSupabase();
  supabase.rpc = async () => ({
    data: null,
    error: { code: 'PGRST202', message: 'Could not find reserve_one_c_sync_batch in the schema cache' },
  });
  await assert.rejects(
    ingestPayload(supabase, {
      source: 'MAK', runId: 'migration-gap', batchIndex: 0, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: new Date(Date.now() - 60_000).toISOString(),
      records: [{
        type: 'invoice', id: 'unsafe-write', date: '2026-08-20', amount: 100,
        contractNumber: 'D-1', counterpartyBin: '123456789012',
      }],
    }),
    (error) => error.statusCode === 503,
  );
  assert.equal(supabase.calls.some((call) => call.table === 'projects'), false);
  assert.equal(supabase.calls.some((call) => call.table === 'one_c_accounting_records'), false);
});

test('accepted records fail before project writes when the detailed 1C registry is unavailable', async () => {
  const supabase = allRejectedSupabase(null, [], {
    code: 'PGRST205',
    message: "Could not find the table 'public.one_c_accounting_records' in the schema cache",
  });
  await assert.rejects(
    ingestPayload(supabase, {
      source: 'MAK', runId: 'inbox-migration-gap', batchIndex: 0, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: new Date(Date.now() - 60_000).toISOString(),
      records: [{
        type: 'payment', id: 'requires-registry', date: '2026-08-20', amount: 100,
        contractNumber: 'D-1', counterpartyBin: '123456789012',
      }],
    }),
    (error) => error.statusCode === 503 && error.code === 'ONEC_SCHEMA_NOT_READY',
  );
  assert.equal(supabase.calls.some((call) => call.table === 'projects'), false);
  assert.equal(supabase.calls.some((call) => call.operation === 'inbox_upsert'), false);
});

test('legacy packets are skipped after the source has a versioned watermark', async () => {
  const supabase = allRejectedSupabase(null, [{
    source: 'MAK', run_id: 'versioned-run', batch_index: 0, batch_count: 1,
    snapshot_captured_at: new Date(Date.now() - 120_000).toISOString(),
    completed_at: new Date(Date.now() - 110_000).toISOString(), status: 'success',
  }]);
  const status = await ingestPayload(supabase, {
    source: 'MAK',
    records: [{
      type: 'invoice', id: 'delayed-legacy', date: '2026-08-20', amount: 100,
      contractNumber: 'D-1', counterpartyBin: '123456789012',
    }],
  });
  assert.equal(status.history[0]?.skipped, true);
  assert.equal(status.history[0]?.skipReason, 'upgrade_required');
  assert.equal(supabase.calls.some((call) => call.table === 'projects'), false);
  assert.equal(supabase.calls.some((call) => call.table === 'one_c_accounting_records'), false);
});

test('source lease makes a newer parallel run retry instead of interleaving inbox writes', async () => {
  const supabase = allRejectedSupabase();
  const originalFrom = supabase.from.bind(supabase);
  let releaseFirstProjectRead;
  let notifyFirstProjectRead;
  const firstProjectRead = new Promise((resolve) => { notifyFirstProjectRead = resolve; });
  const continueFirstProjectRead = new Promise((resolve) => { releaseFirstProjectRead = resolve; });
  let projectReads = 0;
  supabase.from = (table) => {
    if (table !== 'projects') return originalFrom(table);
    supabase.calls.push({ operation: 'from', table });
    projectReads += 1;
    const currentRead = projectReads;
    return {
      select() { return this; },
      then(resolve, reject) {
        if (currentRead === 1) {
          notifyFirstProjectRead();
          return continueFirstProjectRead
            .then(() => ({ data: [], error: null }))
            .then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
  };

  const baseCapture = Date.now() - 120_000;
  const payload = (runId, capturedAt, id) => ({
    source: 'MAK', runId, batchIndex: 0, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01', snapshotCapturedAt: capturedAt,
    records: [{
      type: 'invoice', id, date: '2026-08-20', amount: 100,
      contractNumber: `D-${id}`, counterpartyBin: '123456789012',
    }],
  });
  const older = payload('older-active', new Date(baseCapture).toISOString(), 'older');
  const newer = payload('newer-retry', new Date(baseCapture + 60_000).toISOString(), 'newer');

  const olderPromise = ingestPayload(supabase, older);
  await firstProjectRead;
  await assert.rejects(ingestPayload(supabase, newer), (error) => error.statusCode === 503);
  assert.equal(projectReads, 1, 'busy newer run must not reach project reads');
  assert.equal(
    supabase.calls.filter((call) => call.operation === 'inbox_upsert').length,
    0,
    'busy newer run must not publish inbox rows',
  );

  releaseFirstProjectRead();
  await olderPromise;
  await ingestPayload(supabase, newer);
  assert.equal(projectReads, 2);
  assert.equal(
    supabase.calls.filter((call) => call.operation === 'inbox_upsert').length,
    2,
    'newer data applies only after the older lease is released',
  );
  const decisions = supabase.calls
    .filter((call) => call.operation === 'atomic_reservation')
    .map((call) => call.decision);
  assert.deepEqual(decisions.slice(0, 3), ['accepted', 'busy', 'accepted']);
});

test('empty identified full snapshot is audited as a successful real run, not rejected as a probe', async () => {
  const supabase = allRejectedSupabase();
  const status = await ingestPayload(supabase, {
    source: 'MAK', runId: 'empty-full-run', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01',
    snapshotCapturedAt: '2026-08-21T10:00:00Z', records: [],
  });

  assert.equal(status.rawReceived, 0);
  assert.equal(status.accepted, 0);
  const audits = supabase.calls.filter((call) => call.operation === 'batch_upsert');
  assert.ok(audits.length >= 1);
  assert.equal(audits.at(-1).value.status, 'success');
  assert.equal(audits.at(-1).value.full_snapshot, true);
  assert.equal(audits.at(-1).value.snapshot_since, '2024-01-01');
  assert.equal(audits.at(-1).value.snapshot_captured_at, '2026-08-21T10:00:00.000Z');
});

test('migration rollout does not fail a completed sync when batch audit table is absent', async () => {
  const supabase = allRejectedSupabase({
    code: 'PGRST205',
    message: "Could not find the table 'public.one_c_sync_batches' in the schema cache",
  });
  const status = await ingestPayload(supabase, {
    source: 'MAK',
    records: [{ type: 'payment', id: 'zero', date: '2026-08-21', amount: 0 }],
  });
  assert.equal(status.rawReceived, 1);
  assert.equal(status.accepted, 0);
  assert.equal(status.rejectedCount, 1);
});

test('migration rollout keeps imports working when sync ledger lacks snapshot capture column', async () => {
  const missingCaptureColumn = (row) => Object.hasOwn(row, 'snapshot_captured_at')
    ? {
      code: 'PGRST204',
      message: "Could not find the 'snapshot_captured_at' column of 'one_c_sync_batches' in the schema cache",
    }
    : null;
  const supabase = allRejectedSupabase(missingCaptureColumn);
  const status = await ingestPayload(supabase, {
    source: 'MAK', runId: 'rollout-old-ledger', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01',
    snapshotCapturedAt: '2026-08-21T10:00:00Z',
    records: [{ type: 'payment', id: 'zero', date: '2026-08-21', amount: 0 }],
  });

  assert.equal(status.rawReceived, 1);
  assert.equal(status.rejectedCount, 1);
  const writes = supabase.calls.filter((call) => call.operation === 'batch_upsert');
  assert.ok(writes.some((call) => Object.hasOwn(call.value, 'snapshot_captured_at')));
  assert.ok(writes.some((call) => !Object.hasOwn(call.value, 'snapshot_captured_at')));
  assert.equal(status.history[0]?.reconciled, false);
});
