import test from 'node:test';
import assert from 'node:assert/strict';
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
} from '../api/_1c-inbox-utils.mjs';

test('1C inbox diagnostics distinguish accepted and rejected raw records', () => {
  const diagnostics = analyzeOneCPayload({ records: [
    { type: 'invoice', id: 'ok-1', date: '2026-08-21', amount: 100 },
    { type: 'unknown', id: 'bad-kind', date: '2026-08-21', amount: 100 },
    { type: 'invoice', date: '2026-08-21', amount: 100 },
    { type: 'invoice', id: 'bad-date', date: '', amount: 100 },
    { type: 'invoice', id: 'zero', date: '2026-08-21', amount: 0 },
    null,
  ] });

  assert.deepEqual(diagnostics, {
    rawReceived: 6,
    accepted: 1,
    rejected: 5,
    rejectedReasons: {
      unsupported_kind: 1,
      missing_identity: 1,
      invalid_date: 1,
      non_positive_amount: 1,
      invalid_shape: 1,
    },
  });
});

test('1C inbox rows preserve unmatched diagnostics and deduplicate source keys', () => {
  const record = {
    kind: 'payment',
    externalId: 'payment-1',
    number: '1',
    date: '2026-08-21',
    amount: 500,
    updatedAt: '2026-08-21T10:00:00.000Z',
  };
  const rows = buildOneCInboxRows([
    { record, match: { project: null, reason: 'ambiguous_contract', candidates: ['p1', 'p2'] } },
    { record: { ...record, amount: 600 }, match: { project: { id: 'p2' }, reason: 'contract_and_identity' } },
  ], 'MAK', '2026-08-21T11:00:00.000Z');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].normalized_record.amount, 600);
  assert.equal(rows[0].project_id, 'p2');
  assert.equal(rows[0].match_status, 'matched');
  assert.equal(rows[0].match_reason, 'contract_and_identity');
  assert.equal(rows[0].is_active, true);
});

test('1C inbox migration rollout errors are detected narrowly', () => {
  assert.equal(isMissingOneCInboxTable({ code: '42P01' }), true);
  assert.equal(isMissingOneCInboxTable({ code: 'PGRST205' }), true);
  assert.equal(isMissingOneCInboxTable({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingOneCSyncBatchTable({ code: 'PGRST205' }), true);
  assert.equal(isMissingOneCSyncBatchTable({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingOneCSnapshotCapturedAtColumn({
    code: 'PGRST204',
    message: "Could not find the 'snapshot_captured_at' column in the schema cache",
  }), true);
  assert.equal(isMissingOneCSnapshotCapturedAtColumn({
    code: 'PGRST204',
    message: "Could not find the 'unrelated' column in the schema cache",
  }), false);
});

test('all-rejected nonempty 1C batches retain complete aggregate diagnostics', () => {
  const diagnostics = analyzeOneCPayload({ records: [
    { type: 'payment', id: 'zero', date: '2026-08-21', amount: 0 },
    { type: 'payment', id: 'negative', date: '2026-08-21', amount: -15 },
  ] });
  assert.deepEqual(diagnostics, {
    rawReceived: 2,
    accepted: 0,
    rejected: 2,
    rejectedReasons: { non_positive_amount: 2 },
  });
});

test('accounting access follows configured roles and always excludes admin assistant', () => {
  assert.deepEqual(resolveAccountingRoles(undefined), ['accountant', 'ceo', 'admin']);
  assert.deepEqual(
    resolveAccountingRoles({ accounting: ['procurement', 'accountant', 'admin_assistant', 'PROCUREMENT'] }),
    ['procurement', 'accountant'],
  );
  assert.deepEqual(resolveAccountingRoles({ accounting: [] }), []);
});

test('inbox query is bounded to 500 records and validates the stable UUID cursor', () => {
  assert.deepEqual(normalizeOneCInboxQuery({}), { cursor: '', limit: 200 });
  assert.deepEqual(normalizeOneCInboxQuery({ limit: '900' }), { cursor: '', limit: 500 });
  assert.deepEqual(normalizeOneCInboxQuery({ limit: '0' }), { cursor: '', limit: 1 });
  assert.deepEqual(normalizeOneCInboxQuery({
    cursor: '123e4567-e89b-12d3-a456-426614174000',
    limit: '25',
  }), {
    cursor: '123e4567-e89b-12d3-a456-426614174000',
    limit: 25,
  });
  assert.throws(
    () => normalizeOneCInboxQuery({ cursor: 'not-a-uuid' }),
    (error) => error.statusCode === 400,
  );
});

test('batch context keeps explicit run metadata and isolates legacy requests', () => {
  assert.deepEqual(normalizeOneCBatchContext({
    runId: 'run-2026-08-21',
    batchIndex: 14,
    batchCount: 14,
  }, 'MAK', () => 'unused'), {
    source: 'MAK',
    runId: 'run-2026-08-21',
    batchIndex: 14,
    batchCount: 14,
    fullSnapshot: false,
    snapshotSince: null,
    snapshotCapturedAt: null,
    legacy: false,
  });
  assert.deepEqual(normalizeOneCBatchContext({}, 'MAK', () => 'request-1'), {
    source: 'MAK',
    runId: 'legacy-request-1',
    batchIndex: 0,
    batchCount: 1,
    fullSnapshot: false,
    snapshotSince: null,
    snapshotCapturedAt: null,
    legacy: true,
  });
  assert.deepEqual(normalizeOneCBatchContext({
    runId: 'full-run', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01',
    snapshotCapturedAt: '2026-08-21T10:00:00+06:00',
  }, 'MAK'), {
    source: 'MAK', runId: 'full-run', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01',
    snapshotCapturedAt: '2026-08-21T04:00:00.000Z', legacy: false,
  });
  assert.equal(normalizeOneCBatchContext({
    runId: 'bad-date', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-02-31',
  }, 'MAK').snapshotSince, null);
  assert.equal(normalizeOneCBatchContext({
    runId: 'bad-capture', batchIndex: 1, batchCount: 1,
    fullSnapshot: true, snapshotSince: '2024-01-01', snapshotCapturedAt: '2026-08-21 10:00:00',
  }, 'MAK').snapshotCapturedAt, null);
});

test('sync batch aggregation proves raw equals accepted plus rejected for a complete run', () => {
  const result = aggregateOneCSyncBatches([
    {
      source: 'MAK', run_id: 'run-1', batch_index: 0, batch_count: 2,
      raw_count: 250, accepted_count: 240, rejected_count: 10,
      rejected_reasons: { non_positive_amount: 10 }, matched_count: 100,
      unmatched_count: 140, unmatched_reasons: { contract_not_found: 140 },
      updated_projects: 20, updated_project_ids: ['p1', 'p2'], full_snapshot: true,
      snapshot_since: '2024-01-01', status: 'success',
      snapshot_captured_at: '2026-08-21T10:00:00+00:00',
      started_at: '2026-08-21T10:00:00.000Z', completed_at: '2026-08-21T10:00:02.000Z',
    },
    {
      source: 'MAK', run_id: 'run-1', batch_index: 1, batch_count: 2,
      raw_count: 91, accepted_count: 78, rejected_count: 13,
      rejected_reasons: { non_positive_amount: 12, invalid_date: 1 }, matched_count: 29,
      unmatched_count: 49, unmatched_reasons: { contract_not_found: 40, ambiguous_contract: 9 },
      updated_projects: 7, updated_project_ids: ['p2', 'p3'], full_snapshot: true,
      snapshot_since: '2024-01-01', status: 'success',
      snapshot_captured_at: '2026-08-21T10:00:00.000Z',
      started_at: '2026-08-21T10:00:03.000Z', completed_at: '2026-08-21T10:00:05.000Z',
    },
  ]);
  assert.equal(result.complete, true);
  assert.equal(result.rawReceived, 341);
  assert.equal(result.accepted, 318);
  assert.equal(result.rejectedCount, 23);
  assert.equal(result.rawReceived, result.accepted + result.rejectedCount);
  assert.equal(result.matched, 129);
  assert.equal(result.unmatchedCount, 189);
  assert.equal(result.updatedProjects, 3);
  assert.equal(result.fullSnapshot, true);
  assert.equal(result.snapshotSince, '2024-01-01');
  assert.equal(result.snapshotCapturedAt, '2026-08-21T10:00:00.000Z');
  assert.deepEqual(result.rejectedReasons, { non_positive_amount: 22, invalid_date: 1 });
  assert.deepEqual(result.unmatchedSummary, { contract_not_found: 180, ambiguous_contract: 9 });

  assert.equal(aggregateOneCSyncBatches([
    { ...result, source: 'MAK', run_id: 'one-based', batch_index: 1, batch_count: 2 },
    { ...result, source: 'MAK', run_id: 'one-based', batch_index: 2, batch_count: 2 },
  ]).complete, true);
});

test('sync batch aggregation preserves legacy updated project counts backfilled with an empty ID array', () => {
  const result = aggregateOneCSyncBatches([{
    source: 'MAK', run_id: 'legacy-ledger-row', batch_index: 1, batch_count: 1,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {},
    updated_projects: 4, updated_project_ids: [], full_snapshot: false,
    status: 'success', started_at: '2026-08-21T10:00:00.000Z',
    completed_at: '2026-08-21T10:00:01.000Z',
  }]);

  assert.equal(result.updatedProjects, 4);
});

test('sync batch aggregation rejects a mixed snapshot date even when every batch says full snapshot', () => {
  const common = {
    source: 'MAK', run_id: 'mixed-snapshot', batch_count: 2,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {},
    updated_projects: 1, updated_project_ids: ['p1'], full_snapshot: true,
    status: 'success', started_at: '2026-08-21T10:00:00.000Z',
    completed_at: '2026-08-21T10:00:01.000Z',
  };
  const result = aggregateOneCSyncBatches([
    { ...common, batch_index: 1, snapshot_since: null },
    { ...common, batch_index: 2, snapshot_since: '2024-01-01' },
  ]);

  assert.equal(result.complete, true);
  assert.equal(result.fullSnapshot, true);
  assert.equal(result.snapshotSince, null);
});

test('sync batch aggregation requires one nonempty capture timestamp for every batch', () => {
  const common = {
    source: 'MAK', run_id: 'mixed-capture', batch_count: 2,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 1, unmatched_count: 0, unmatched_reasons: {},
    updated_projects: 1, updated_project_ids: ['p1'], full_snapshot: true,
    snapshot_since: '2024-01-01', status: 'success',
    started_at: '2026-08-21T10:00:00.000Z', completed_at: '2026-08-21T10:00:01.000Z',
  };
  const missing = aggregateOneCSyncBatches([
    { ...common, batch_index: 1, snapshot_captured_at: null },
    { ...common, batch_index: 2, snapshot_captured_at: '2026-08-21T09:00:00.000Z' },
  ]);
  const mixed = aggregateOneCSyncBatches([
    { ...common, batch_index: 1, snapshot_captured_at: '2026-08-21T09:00:00.000Z' },
    { ...common, batch_index: 2, snapshot_captured_at: '2026-08-21T09:00:01.000Z' },
  ]);

  assert.equal(missing.snapshotCapturedAt, null);
  assert.equal(mixed.snapshotCapturedAt, null);
});

test('a processing reservation from the current run is never aggregated as complete', () => {
  const result = aggregateOneCSyncBatches([{
    source: 'MAK', run_id: 'in-flight', batch_index: 1, batch_count: 1,
    raw_count: 1, accepted_count: 1, rejected_count: 0, rejected_reasons: {},
    matched_count: 0, unmatched_count: 0, unmatched_reasons: {},
    updated_projects: 0, updated_project_ids: [], full_snapshot: true,
    snapshot_since: '2024-01-01', snapshot_captured_at: '2026-08-21T10:00:00.000Z',
    status: 'processing', started_at: '2026-08-21T10:00:01.000Z',
    completed_at: '2026-08-21T10:00:01.000Z',
  }]);

  assert.equal(result.status, 'processing');
  assert.equal(result.complete, false);
});
