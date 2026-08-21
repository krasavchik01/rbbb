import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reconcileCompleteOneCRun,
  removeStaleOneCRecordsFromNotes,
} from '../api/1c/sync.mjs';
import { isOneCNoopBatch } from '../api/_1c-sync-utils.mjs';

function clone(value) {
  return structuredClone(value);
}

function columnValue(row, column) {
  if (column === 'normalized_record->>date') return row?.normalized_record?.date;
  return row?.[column];
}

function filtered(rows, filters) {
  return rows.filter((row) => filters.every(({ operation, column, value }) => {
    const current = columnValue(row, column);
    if (operation === 'eq') return current === value;
    if (operation === 'lt') return String(current || '') < String(value || '');
    if (operation === 'gte') return String(current || '') >= String(value || '');
    if (operation === 'gt') return String(current || '') > String(value || '');
    if (operation === 'neq') return current !== value;
    if (operation === 'is') return current === value;
    if (operation === 'in') return value.includes(current);
    return true;
  }));
}

function selectQuery(rows) {
  const filters = [];
  let limit = Number.POSITIVE_INFINITY;
  let orderColumn = null;
  let ascending = true;
  const query = {
    eq(column, value) { filters.push({ operation: 'eq', column, value }); return query; },
    lt(column, value) { filters.push({ operation: 'lt', column, value }); return query; },
    gte(column, value) { filters.push({ operation: 'gte', column, value }); return query; },
    gt(column, value) { filters.push({ operation: 'gt', column, value }); return query; },
    neq(column, value) { filters.push({ operation: 'neq', column, value }); return query; },
    is(column, value) { filters.push({ operation: 'is', column, value }); return query; },
    order(column, options = {}) {
      orderColumn = column;
      ascending = options.ascending !== false;
      return query;
    },
    limit(value) { limit = value; return query; },
    then(resolve, reject) {
      let data = filtered(rows, filters);
      if (orderColumn) {
        data = [...data].sort((left, right) => {
          const comparison = String(columnValue(left, orderColumn) || '')
            .localeCompare(String(columnValue(right, orderColumn) || ''));
          return ascending ? comparison : -comparison;
        });
      }
      data = data.slice(0, limit).map(clone);
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

function reconciliationSupabase({ batches, inbox, projects }) {
  return {
    from(table) {
      if (table === 'one_c_sync_batches') {
        return { select() { return selectQuery(batches); } };
      }
      if (table === 'one_c_accounting_records') {
        return {
          select() { return selectQuery(inbox); },
          update(value) {
            const filters = [];
            const query = {
              in(column, values) { filters.push({ operation: 'in', column, value: values }); return query; },
              eq(column, expected) { filters.push({ operation: 'eq', column, value: expected }); return query; },
              lt(column, expected) { filters.push({ operation: 'lt', column, value: expected }); return query; },
              then(resolve, reject) {
                for (const row of filtered(inbox, filters)) Object.assign(row, clone(value));
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              },
            };
            return query;
          },
        };
      }
      if (table === 'projects') {
        return {
          select() {
            let id;
            return {
              eq(_column, value) { id = value; return this; },
              async maybeSingle() {
                return { data: clone(projects.find((project) => project.id === id) || null), error: null };
              },
            };
          },
          update(value) {
            const filters = [];
            return {
              eq(column, expected) { filters.push({ column, expected }); return this; },
              async select() {
                const project = projects.find((candidate) => filters.every(
                  ({ column, expected }) => candidate[column] === expected,
                ));
                if (!project) return { data: [], error: null };
                Object.assign(project, clone(value));
                return { data: [{ id: project.id }], error: null };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test('only a metadata-free non-snapshot empty request is a 1C probe', () => {
  assert.equal(isOneCNoopBatch({ source: 'MAK', fullSnapshot: false, records: [] }), true);
  assert.equal(isOneCNoopBatch({
    source: 'MAK', fullSnapshot: false, snapshotCapturedAt: '2026-08-21T10:00:00Z', records: [],
  }), false);
  assert.equal(isOneCNoopBatch({
    source: 'MAK', fullSnapshot: false, runId: 'run-1', batchIndex: 1, batchCount: 1, records: [],
  }), false);
  assert.equal(isOneCNoopBatch({
    source: 'MAK', fullSnapshot: true, snapshotSince: '2024-01-01',
    runId: 'run-1', batchIndex: 1, batchCount: 1, records: [],
  }), false);
});

test('stale-note cleanup is exact by source, database, identity, and run cutoff', () => {
  const notes = {
    accounting: {
      documents: [
        { source: '1c', sourceDatabase: 'MAK', type: 'invoice', externalId: 'gone', syncedAt: '2026-08-21T09:00:00.000Z' },
        { source: 'manual', sourceDatabase: 'MAK', type: 'invoice', externalId: 'gone', syncedAt: '2026-08-21T09:00:00.000Z' },
        { source: '1c', sourceDatabase: 'OTHER', type: 'invoice', externalId: 'gone', syncedAt: '2026-08-21T09:00:00.000Z' },
        { source: '1c', sourceDatabase: 'MAK', type: 'invoice', externalId: 'gone', syncedAt: '2026-08-21T10:00:01.000Z' },
      ],
      payments: [],
    },
  };
  const result = removeStaleOneCRecordsFromNotes(
    notes,
    [{ kind: 'invoice', external_id: 'gone' }],
    'MAK',
    '2026-08-21T10:00:00.000Z',
    '2026-08-21T11:00:00.000Z',
  );

  assert.equal(result.changed, true);
  assert.equal(result.notes.accounting.documents.length, 3);
  assert.deepEqual(
    result.notes.accounting.documents.map(({ source, sourceDatabase, syncedAt }) => ({ source, sourceDatabase, syncedAt })),
    [
      { source: 'manual', sourceDatabase: 'MAK', syncedAt: '2026-08-21T09:00:00.000Z' },
      { source: '1c', sourceDatabase: 'OTHER', syncedAt: '2026-08-21T09:00:00.000Z' },
      { source: '1c', sourceDatabase: 'MAK', syncedAt: '2026-08-21T10:00:01.000Z' },
    ],
  );
});

test('complete full run inactivates only missing in-window rows and CAS-cleans matched projects', async () => {
  const batches = [{
    source: 'MAK', run_id: 'full-run', batch_index: 1, batch_count: 1,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {},
    updated_projects: 1, updated_project_ids: ['p1'], full_snapshot: true,
    snapshot_since: '2024-01-01', status: 'success',
    snapshot_captured_at: '2026-08-21T09:55:00.000Z',
    started_at: '2026-08-21T10:00:00.000Z', completed_at: '2026-08-21T10:00:05.000Z',
  }];
  const inbox = [
    { id: 'a', source: 'MAK', kind: 'invoice', external_id: 'gone', normalized_record: { date: '2025-01-02' }, project_id: 'p1', last_seen_at: '2026-08-21T09:00:00.000Z', is_active: true },
    { id: 'b', source: 'MAK', kind: 'avr', external_id: 'unmatched-gone', normalized_record: { date: '2025-01-03' }, project_id: null, last_seen_at: '2026-08-21T09:00:00.000Z', is_active: true },
    { id: 'c', source: 'MAK', kind: 'invoice', external_id: 'fresh', normalized_record: { date: '2025-01-04' }, project_id: 'p1', last_seen_at: '2026-08-21T10:00:01.000Z', is_active: true },
    { id: 'd', source: 'MAK', kind: 'invoice', external_id: 'before-window', normalized_record: { date: '2023-12-31' }, project_id: 'p1', last_seen_at: '2026-08-21T09:00:00.000Z', is_active: true },
    { id: 'e', source: 'OTHER', kind: 'invoice', external_id: 'gone', normalized_record: { date: '2025-01-02' }, project_id: 'p1', last_seen_at: '2026-08-21T09:00:00.000Z', is_active: true },
  ];
  const projects = [{
    id: 'p1', updated_at: 'project-v1',
    notes: {
      accounting: {
        documents: [
          { source: '1c', sourceDatabase: 'MAK', type: 'invoice', externalId: 'gone', syncedAt: '2026-08-21T09:00:00.000Z' },
          { source: '1c', sourceDatabase: 'MAK', type: 'invoice', externalId: 'fresh', syncedAt: '2026-08-21T10:00:01.000Z' },
          { source: '1c', sourceDatabase: 'MAK', type: 'invoice', externalId: 'before-window', syncedAt: '2026-08-21T09:00:00.000Z' },
          { source: 'manual', sourceDatabase: 'MAK', type: 'invoice', externalId: 'gone', syncedAt: '2026-08-21T09:00:00.000Z' },
        ],
        payments: [],
      },
    },
  }];
  const supabase = reconciliationSupabase({ batches, inbox, projects });

  const result = await reconcileCompleteOneCRun(supabase, {
    source: 'MAK', runId: 'full-run', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01',
    snapshotCapturedAt: '2026-08-21T09:55:00.000Z', legacy: false,
  }, '2026-08-21T11:00:00.000Z');

  assert.equal(result.reconciled, true);
  assert.equal(result.inactivated, 2);
  assert.deepEqual([...result.touchedProjectIds], ['p1']);
  assert.deepEqual(inbox.map(({ id, is_active }) => [id, is_active]), [
    ['a', false], ['b', false], ['c', true], ['d', true], ['e', true],
  ]);
  assert.deepEqual(
    projects[0].notes.accounting.documents.map(({ source, externalId }) => [source, externalId]),
    [['1c', 'fresh'], ['1c', 'before-window'], ['manual', 'gone']],
  );
});

test('legacy, partial, and non-full runs never enter reconciliation', async () => {
  const forbidden = { from() { throw new Error('database must not be read'); } };
  for (const batch of [
    { legacy: true, fullSnapshot: true, snapshotSince: '2024-01-01' },
    { legacy: false, fullSnapshot: false, snapshotSince: '2024-01-01' },
    { legacy: false, fullSnapshot: true, snapshotSince: null },
    { legacy: false, fullSnapshot: true, snapshotSince: '2024-01-01', snapshotCapturedAt: null },
  ]) {
    const result = await reconcileCompleteOneCRun(forbidden, batch);
    assert.equal(result.reconciled, false);
    assert.equal(result.reason, 'not_full_run');
  }
});

test('a full-snapshot flag cannot reconcile until every declared batch is durable', async () => {
  const batches = [{
    source: 'MAK', run_id: 'partial-run', batch_index: 1, batch_count: 2,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {}, updated_projects: 0,
    updated_project_ids: [], full_snapshot: true, snapshot_since: '2024-01-01',
    snapshot_captured_at: '2026-08-21T10:00:00.000Z',
    status: 'success', started_at: '2026-08-21T10:00:00.000Z',
    completed_at: '2026-08-21T10:00:01.000Z',
  }];
  const result = await reconcileCompleteOneCRun(
    reconciliationSupabase({ batches, inbox: [], projects: [] }),
    {
      source: 'MAK', runId: 'partial-run', batchIndex: 1, batchCount: 2,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2026-08-21T10:00:00.000Z', legacy: false,
    },
  );

  assert.equal(result.reconciled, false);
  assert.equal(result.reason, 'run_incomplete');
});

test('a complete full snapshot with rejected records never infers deletions', async () => {
  const batches = [{
    source: 'MAK', run_id: 'rejected-run', batch_index: 1, batch_count: 1,
    raw_count: 2, accepted_count: 1, rejected_count: 1,
    rejected_reasons: { invalid_date: 1 }, matched_count: 1,
    unmatched_count: 0, unmatched_reasons: {}, updated_projects: 1,
    updated_project_ids: ['p1'], full_snapshot: true, snapshot_since: '2024-01-01',
    snapshot_captured_at: '2026-08-21T10:00:00.000Z',
    status: 'success', started_at: '2026-08-21T10:00:00.000Z',
    completed_at: '2026-08-21T10:00:01.000Z',
  }];
  const inbox = [{
    id: 'stale', source: 'MAK', kind: 'invoice', external_id: 'must-stay',
    normalized_record: { date: '2025-01-02' }, project_id: 'p1',
    last_seen_at: '2026-08-21T09:00:00.000Z', is_active: true,
  }];
  const result = await reconcileCompleteOneCRun(
    reconciliationSupabase({ batches, inbox, projects: [] }),
    {
      source: 'MAK', runId: 'rejected-run', batchIndex: 1, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2026-08-21T10:00:00.000Z', legacy: false,
    },
  );

  assert.equal(result.reconciled, false);
  assert.equal(result.reason, 'run_rejected_records');
  assert.equal(inbox[0].is_active, true);
});

test('an older complete run cannot clean up after a newer processing reservation arrived', async () => {
  const batches = [
    {
      source: 'MAK', run_id: 'older-complete', batch_index: 1, batch_count: 1,
      raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
      matched_count: 1, unmatched_count: 0, unmatched_reasons: {}, updated_projects: 1,
      updated_project_ids: ['p1'], full_snapshot: true, snapshot_since: '2024-01-01',
      snapshot_captured_at: '2026-08-21T10:00:00.000Z', status: 'success',
      started_at: '2026-08-21T10:05:00.000Z', completed_at: '2026-08-21T10:06:00.000Z',
    },
    {
      source: 'MAK', run_id: 'newer-partial', batch_index: 1, batch_count: 2,
      raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
      matched_count: 1, unmatched_count: 0, unmatched_reasons: {}, updated_projects: 1,
      updated_project_ids: ['p1'], full_snapshot: true, snapshot_since: '2024-01-01',
      snapshot_captured_at: '2026-08-21T10:10:00.000Z', status: 'processing',
      started_at: '2026-08-21T10:10:00.000Z', completed_at: '2026-08-21T10:11:00.000Z',
    },
  ];
  const inbox = [{
    id: 'stale', source: 'MAK', kind: 'invoice', external_id: 'must-stay',
    normalized_record: { date: '2025-01-02' }, project_id: 'p1',
    last_seen_at: '2026-08-21T09:00:00.000Z', is_active: true,
  }];

  const result = await reconcileCompleteOneCRun(
    reconciliationSupabase({ batches, inbox, projects: [] }),
    {
      source: 'MAK', runId: 'older-complete', batchIndex: 1, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2026-08-21T10:00:00.000Z', legacy: false,
    },
  );

  assert.equal(result.reconciled, false);
  assert.equal(result.reason, 'newer_snapshot_exists');
  assert.equal(inbox[0].is_active, true);

  // 1C timestamps have one-second precision. Two different runs captured in
  // the same second are ambiguous and must also fail closed.
  batches[1].snapshot_captured_at = batches[0].snapshot_captured_at;
  const simultaneous = await reconcileCompleteOneCRun(
    reconciliationSupabase({ batches, inbox, projects: [] }),
    {
      source: 'MAK', runId: 'older-complete', batchIndex: 1, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2026-08-21T10:00:00.000Z', legacy: false,
    },
  );
  assert.equal(simultaneous.reconciled, false);
  assert.equal(simultaneous.reason, 'newer_snapshot_exists');
  assert.equal(inbox[0].is_active, true);
});

test('rollout null-capture row blocks an older snapshot but not a later new snapshot forever', async () => {
  const current = (runId, capturedAt) => ({
    source: 'MAK', run_id: runId, batch_index: 1, batch_count: 1,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {}, updated_projects: 0,
    updated_project_ids: [], full_snapshot: true, snapshot_since: '2024-01-01',
    snapshot_captured_at: capturedAt, status: 'success',
    started_at: capturedAt, completed_at: capturedAt,
  });
  const rolloutRow = {
    source: 'MAK', run_id: 'fallback-no-watermark', batch_index: 1, batch_count: 1,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {}, updated_projects: 0,
    updated_project_ids: [], full_snapshot: true, snapshot_since: '2024-01-01',
    snapshot_captured_at: null, status: 'success',
    started_at: '2026-08-21T10:04:00.000Z', completed_at: '2026-08-21T10:05:00.000Z',
  };

  const blocked = await reconcileCompleteOneCRun(
    reconciliationSupabase({
      batches: [current('older', '2026-08-21T10:00:00.000Z'), rolloutRow],
      inbox: [], projects: [],
    }),
    {
      source: 'MAK', runId: 'older', batchIndex: 1, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2026-08-21T10:00:00.000Z', legacy: false,
    },
  );
  assert.equal(blocked.reconciled, false);
  assert.equal(blocked.reason, 'newer_snapshot_exists');

  const later = await reconcileCompleteOneCRun(
    reconciliationSupabase({
      batches: [current('later', '2026-08-21T11:00:00.000Z'), rolloutRow],
      inbox: [], projects: [],
    }),
    {
      source: 'MAK', runId: 'later', batchIndex: 1, batchCount: 1,
      fullSnapshot: true, snapshotSince: '2024-01-01',
      snapshotCapturedAt: '2026-08-21T11:00:00.000Z', legacy: false,
    },
  );
  assert.equal(later.reconciled, true);
  assert.equal(later.reason, 'nothing_stale');
});

test('complete ledgers with missing or mixed capture timestamps never reconcile', async () => {
  const common = {
    source: 'MAK', run_id: 'capture-proof', batch_count: 2,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {}, updated_projects: 0,
    updated_project_ids: [], full_snapshot: true, snapshot_since: '2024-01-01',
    status: 'success', started_at: '2026-08-21T10:00:00.000Z',
    completed_at: '2026-08-21T10:00:01.000Z',
  };
  for (const captureValues of [
    [null, '2026-08-21T10:00:00.000Z'],
    ['2026-08-21T10:00:00.000Z', '2026-08-21T10:00:01.000Z'],
  ]) {
    const batches = captureValues.map((snapshotCapturedAt, index) => ({
      ...common,
      batch_index: index + 1,
      snapshot_captured_at: snapshotCapturedAt,
    }));
    const result = await reconcileCompleteOneCRun(
      reconciliationSupabase({ batches, inbox: [], projects: [] }),
      {
        source: 'MAK', runId: 'capture-proof', batchIndex: 2, batchCount: 2,
        fullSnapshot: true, snapshotSince: '2024-01-01',
        snapshotCapturedAt: captureValues[1], legacy: false,
      },
    );
    assert.equal(result.reconciled, false);
    assert.equal(result.reason, 'run_incomplete');
  }
});
