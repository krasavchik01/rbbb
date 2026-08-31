import test from 'node:test';
import assert from 'node:assert/strict';
import { planOneCProjectChanges } from '../api/1c/sync.mjs';
import {
  findOneCRecordLocations,
  hashSharedSecret,
  inferOneCAccountingScope,
  isOneCNoopBatch,
  matchOneCRecord,
  mergeOneCRecordsIntoNotes,
  normalizeOneCPayload,
  oneCCounterpartyScopeKey,
  removeOneCRecordsFromNotes,
  runWithConcurrency,
  secureSecretMatches,
} from '../api/_1c-sync-utils.mjs';

const project = {
  id: 'project-1',
  name: 'ТОО Клиент',
  notes: {
    companyId: 'mak',
    contract: { number: '№ 24/10-49/ДОУ' },
    client: { name: 'ТОО Клиент', bin: '123456789012' },
  },
};

test('1C accounting direction separates supplier expenses without guessing unknown counterparties', () => {
  const [outgoingPayment, incomingPayment, unknownInvoice] = normalizeOneCPayload({ records: [
    { type: 'payment', id: 'pay-out', date: '2026-08-31', amount: 10_000, direction: 'Исходящий', counterpartyBin: '111111111111' },
    { type: 'payment', id: 'pay-in', date: '2026-08-31', amount: 20_000, direction: 'Входящий', counterpartyBin: '222222222222' },
    { type: 'invoice', id: 'invoice-unknown', date: '2026-08-31', amount: 30_000, counterpartyName: 'ТОО Неизвестный' },
  ] }).records;

  assert.equal(inferOneCAccountingScope(outgoingPayment), 'supplier');
  assert.equal(inferOneCAccountingScope(incomingPayment), 'project');
  assert.equal(inferOneCAccountingScope(unknownInvoice, { project: null, reason: 'contract_not_found' }), 'review');
  assert.equal(oneCCounterpartyScopeKey(outgoingPayment, 'MAK'), 'MAK\u0000organization:unknown\u0000bin:111111111111');
});

test('1C connection check accepts only an explicit empty non-snapshot batch', () => {
  assert.equal(isOneCNoopBatch({
    source: '1С Бухгалтерия для Казахстана / MAK_290424',
    fullSnapshot: false,
    records: [],
  }), true);

  assert.equal(isOneCNoopBatch({}), false);
  assert.equal(isOneCNoopBatch({ fullSnapshot: false, records: [] }), false);
  assert.equal(isOneCNoopBatch({ source: '1C', fullSnapshot: true, records: [] }), false);
  assert.equal(isOneCNoopBatch({ source: '1C', fullSnapshot: false, records: [{}] }), false);
  assert.equal(normalizeOneCPayload({ records: [{}] }).records.length, 0);
});

test('1C payload accepts Russian accounting field names', () => {
  const payload = normalizeOneCPayload({
    ИнформационнаяБаза: 'Бухгалтерия RB',
    records: [{
      ВидДокумента: 'Платежное поручение',
      УИД: 'payment-guid',
      Номер: '000101',
      Дата: '18.08.2026',
      Сумма: '1 250 000,00',
      НомерДоговора: '№ 24/10-49/ДОУ',
      БИНКонтрагента: '123456789012',
      ВидОплаты: 'Предоплата',
    }],
  });

  assert.equal(payload.source, 'Бухгалтерия RB');
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].kind, 'payment');
  assert.equal(payload.records[0].amount, 1_250_000);
  assert.equal(payload.records[0].date, '2026-08-18');
  assert.equal(payload.records[0].paymentKind, 'advance');
});

test('1C payload accepts separate document collections from a custom HTTP service', () => {
  const payload = normalizeOneCPayload({
    Счета: [{ УИД: 'invoice-1', Номер: 'СЧ-1', Дата: '2026-08-18', Сумма: 100_000, НомерДоговора: 'A-1' }],
    Оплаты: [{ УИД: 'payment-1', Номер: 'ПП-1', Дата: '2026-08-19', Сумма: 50_000, НомерДоговора: 'A-1' }],
  });
  assert.deepEqual(payload.records.map((item) => item.kind), ['invoice', 'payment']);
});

test('1C records are matched by normalized contract number and client BIN', () => {
  const [record] = normalizeOneCPayload({ records: [{
    type: 'invoice',
    id: 'invoice-guid',
    number: 'СЧ-1',
    date: '2026-08-18',
    amount: 500_000,
    contractNumber: '24 10 49 ДОУ',
    counterpartyBin: '123456789012',
  }] }).records;
  const match = matchOneCRecord(record, [project]);
  assert.equal(match.project.id, 'project-1');
  assert.equal(match.reason, 'contract_and_identity');
});

test('1C does not match a unique contract when the client identity contradicts the project', () => {
  const [record] = normalizeOneCPayload({ records: [{
    type: 'invoice',
    id: 'wrong-client-invoice',
    number: 'СЧ-2',
    date: '2026-08-18',
    amount: 500_000,
    contractNumber: '24/10-49/ДОУ',
    counterpartyBin: '999999999999',
    counterpartyName: 'ТОО Совсем другой клиент',
  }] }).records;

  const match = matchOneCRecord(record, [project]);
  assert.equal(match.project, null);
  assert.equal(match.reason, 'contract_identity_mismatch');
  assert.deepEqual(match.candidates, ['project-1']);
});

test('1C recognizes RB A+Partners as the canonical MAK company while matching', () => {
  const [record] = normalizeOneCPayload({ records: [{
    type: 'invoice',
    id: 'mak-alias-invoice',
    number: 'СЧ-3',
    date: '2026-08-18',
    amount: 500_000,
    contractNumber: '24/10-49/ДОУ',
    organizationName: 'RB A+Partners',
    counterpartyBin: '123456789012',
  }] }).records;

  const match = matchOneCRecord(record, [project]);
  assert.equal(match.project?.id, 'project-1');
  assert.equal(match.reason, 'contract_and_identity');
});

test('matching client BIN takes precedence over harmless spelling differences in the client name', () => {
  const [record] = normalizeOneCPayload({ records: [{
    type: 'invoice',
    id: 'same-bin-different-label',
    number: 'СЧ-4',
    date: '2026-08-18',
    amount: 500_000,
    contractNumber: '24/10-49/ДОУ',
    organizationName: 'Полное юридическое название MAK A+ Partners',
    counterpartyBin: '123456789012',
    counterpartyName: 'ТОО Клиент (филиал Алматы)',
  }] }).records;

  const match = matchOneCRecord(record, [project]);
  assert.equal(match.project?.id, 'project-1');
  assert.equal(match.reason, 'contract_and_identity');
});

test('1C upsert is idempotent and keeps ESF as a required accounting step', () => {
  const records = normalizeOneCPayload({ records: [
    { type: 'ЭСФ', id: 'esf-guid', number: 'ЭСФ-1', date: '2026-08-18', dueDate: '2026-08-20', amount: 500_000, contractNumber: 'A-1', status: 'Зарегистрирован' },
    { type: 'Оплата', id: 'pay-guid', number: 'ПП-1', date: '2026-08-18', amount: 200_000, contractNumber: 'A-1' },
  ] }).records;
  const once = mergeOneCRecordsIntoNotes({}, records, '1C Test', '2026-08-18T10:00:00.000Z');
  const twice = mergeOneCRecordsIntoNotes(once, records, '1C Test', '2026-08-18T11:00:00.000Z');

  assert.equal(twice.accounting.version, 2);
  assert.equal(twice.accounting.documents.length, 1);
  assert.equal(twice.accounting.payments.length, 1);
  assert.equal(twice.accounting.documents[0].status, 'registered');
  assert.equal(twice.accounting.requirements.esf, true);
  assert.equal(twice.accounting.sync.sourceDatabase, '1C Test');
});

test('1C cancellation tombstones survive normalization with a zero amount', () => {
  const payload = normalizeOneCPayload({ records: [
    { type: 'Счет', id: 'invoice-cancelled', number: 'СЧ-0', date: '2026-08-19', amount: 0, status: 'cancelled', contractNumber: 'A-1' },
    { type: 'Оплата', id: 'payment-cancelled', number: 'ПП-0', date: '2026-08-19', amount: 0, status: 'cancelled', contractNumber: 'A-1' },
    { type: 'Оплата', id: 'payment-zero-active', number: 'ПП-1', date: '2026-08-19', amount: 0, status: 'issued', contractNumber: 'A-1' },
  ] });

  assert.deepEqual(payload.records.map(({ externalId, status }) => ({ externalId, status })), [
    { externalId: 'invoice-cancelled', status: 'cancelled' },
    { externalId: 'payment-cancelled', status: 'cancelled' },
  ]);
});

test('cancelled 1C payment removes the imported payment and is not re-added', () => {
  const [active] = normalizeOneCPayload({ records: [{
    type: 'Оплата', id: 'pay-to-cancel', number: 'ПП-2', date: '2026-08-19', amount: 150_000, status: 'issued', contractNumber: 'A-1',
  }] }).records;
  const [cancelled] = normalizeOneCPayload({ records: [{
    type: 'Оплата', id: 'pay-to-cancel', number: 'ПП-2', date: '2026-08-19', amount: 0, status: 'cancelled', contractNumber: 'A-1',
  }] }).records;
  const withPayment = mergeOneCRecordsIntoNotes({ accounting: { payments: [
    { id: 'manual-payment', source: 'manual', amount: 25_000 },
  ] } }, [active], '1C Test', '2026-08-19T10:00:00.000Z');
  const afterCancellation = mergeOneCRecordsIntoNotes(
    withPayment,
    [cancelled],
    '1C Test',
    '2026-08-19T11:00:00.000Z',
  );

  assert.deepEqual(afterCancellation.accounting.payments, [
    { id: 'manual-payment', source: 'manual', amount: 25_000 },
  ]);
});

test('cancelled payment stays linked by its prior 1C external ID when the agreement was cleared', () => {
  const projectWithPayment = {
    id: 'project-with-old-payment',
    notes: {
      accounting: {
        payments: [{
          id: '1c:payment:pay-with-cleared-contract',
          source: '1c',
          externalId: 'pay-with-cleared-contract',
          amount: 175_000,
        }],
      },
    },
  };
  const [cancelled] = normalizeOneCPayload({ records: [{
    type: 'Оплата',
    id: 'pay-with-cleared-contract',
    number: 'ПП-4',
    date: '2026-08-19',
    amount: 0,
    status: 'cancelled',
  }] }).records;

  const match = matchOneCRecord(cancelled, [projectWithPayment]);
  assert.equal(match.project?.id, 'project-with-old-payment');
  assert.equal(match.reason, 'existing_1c_record');
});

test('cancelled 1C document remains in the ledger with cancelled status', () => {
  const records = normalizeOneCPayload({ records: [{
    type: 'АВР', id: 'avr-cancelled', number: 'АВР-3', date: '2026-08-19', amount: 500_000, status: 'cancelled', contractNumber: 'A-1',
  }] }).records;
  const notes = mergeOneCRecordsIntoNotes({}, records, '1C Test', '2026-08-19T12:00:00.000Z');

  assert.equal(notes.accounting.documents.length, 1);
  assert.equal(notes.accounting.documents[0].status, 'cancelled');
});

test('stable 1C payment allocation replaces legacy row-number IDs without touching manual or another database', () => {
  const paymentDocumentId = '91a2c4f4-0cbe-4d6f-8efa-a09383a1e701';
  const [record] = normalizeOneCPayload({ records: [{
    type: 'Оплата',
    id: `${paymentDocumentId}|contracta|123456789012`,
    paymentDocumentId,
    number: 'ПП-7',
    date: '2026-08-20',
    amount: 350_000,
    contractNumber: 'Contract A',
  }] }).records;
  const notes = mergeOneCRecordsIntoNotes({ accounting: { payments: [
    { id: 'legacy-1', source: '1c', sourceDatabase: 'MAK', externalId: `${paymentDocumentId}-1`, amount: 100_000 },
    { id: 'legacy-2', source: '1c', sourceDatabase: 'MAK', externalId: `${paymentDocumentId}-2`, amount: 250_000 },
    { id: 'manual', source: 'manual', amount: 10_000 },
    { id: 'other-db', source: '1c', sourceDatabase: 'OTHER', externalId: `${paymentDocumentId}-1`, amount: 99_000 },
  ] } }, [record], 'MAK', '2026-08-20T12:00:00.000Z');

  assert.equal(record.paymentDocumentId, paymentDocumentId);
  assert.deepEqual(notes.accounting.payments.map(({ id, amount }) => ({ id, amount })), [
    { id: 'manual', amount: 10_000 },
    { id: 'other-db', amount: 99_000 },
    { id: `1c:payment:${record.externalId}`, amount: 350_000 },
  ]);
});

test('cancelled stable payment removes every allocation of that 1C payment document only', () => {
  const paymentDocumentId = '91a2c4f4-0cbe-4d6f-8efa-a09383a1e702';
  const [cancelled] = normalizeOneCPayload({ records: [{
    type: 'Оплата',
    id: `${paymentDocumentId}||`,
    paymentDocumentId,
    number: 'ПП-8',
    date: '2026-08-20',
    amount: 0,
    status: 'cancelled',
  }] }).records;
  const notes = mergeOneCRecordsIntoNotes({ accounting: { payments: [
    { source: '1c', sourceDatabase: 'MAK', externalId: `${paymentDocumentId}|a|bin`, paymentDocumentId, amount: 100_000 },
    { source: '1c', sourceDatabase: 'MAK', externalId: `${paymentDocumentId}|b|bin`, paymentDocumentId, amount: 200_000 },
    { source: '1c', sourceDatabase: 'MAK', externalId: `${paymentDocumentId}-3`, amount: 50_000 },
    { id: 'manual', source: 'manual', amount: 25_000 },
    { id: 'other-db', source: '1c', sourceDatabase: 'OTHER', externalId: `${paymentDocumentId}|a|bin`, paymentDocumentId, amount: 75_000 },
  ] } }, [cancelled], 'MAK', '2026-08-20T13:00:00.000Z');

  assert.deepEqual(notes.accounting.payments.map((item) => item.id), ['manual', 'other-db']);
});

test('1C rematch removes an imported record from project A before it is merged into project B', () => {
  const source = 'MAK';
  const [record] = normalizeOneCPayload({ records: [{
    type: 'Счет', id: 'invoice-rematch', number: 'СЧ-9', date: '2026-08-20', amount: 420_000,
    contractNumber: 'B-2', counterpartyBin: '222222222222',
  }] }).records;
  const projectA = {
    id: 'project-a',
    notes: { contract: { number: 'A-1' }, accounting: { documents: [{
      id: '1c:invoice:invoice-rematch', source: '1c', sourceDatabase: source,
      externalId: 'invoice-rematch', type: 'invoice', amount: 420_000,
    }] } },
  };
  const projectB = {
    id: 'project-b',
    notes: { contract: { number: 'B-2' }, client: { bin: '222222222222' } },
  };

  const match = matchOneCRecord(record, [projectA, projectB], { source });
  assert.equal(match.project?.id, 'project-b');
  assert.deepEqual(findOneCRecordLocations(record, [projectA, projectB], source).map(({ project }) => project.id), ['project-a']);

  const removed = removeOneCRecordsFromNotes(projectA.notes, [record], source, '2026-08-20T14:00:00.000Z');
  const added = mergeOneCRecordsIntoNotes(projectB.notes, [record], source, '2026-08-20T14:00:00.000Z');
  assert.equal(removed.changed, true);
  assert.equal(removed.notes.accounting.documents.length, 0);
  assert.equal(added.accounting.documents.length, 1);
  assert.equal(added.accounting.documents[0].externalId, 'invoice-rematch');
});

test('durable inbox project makes a repeated cancellation deterministic after a rematch', () => {
  const source = 'MAK';
  const projectA = { id: 'project-a', notes: {} };
  const projectB = { id: 'project-b', notes: {} };
  const [cancelled] = normalizeOneCPayload({ records: [{
    type: 'Оплата', id: 'payment-after-rematch', number: 'ПП-10', date: '2026-08-20',
    amount: 0, status: 'cancelled',
  }] }).records;

  const match = matchOneCRecord(cancelled, [projectA, projectB], {
    source,
    preferredProjectId: 'project-b',
  });
  assert.equal(match.project?.id, 'project-b');
  assert.equal(match.reason, 'durable_inbox_match');
});

test('rematch plan cleans A, writes B, and uses notes safely when inbox migration is absent', () => {
  const source = 'MAK';
  const [record] = normalizeOneCPayload({ records: [{
    type: 'Счет', id: 'invoice-plan-rematch', number: 'СЧ-11', date: '2026-08-20', amount: 500_000,
    contractNumber: 'B-11', counterpartyBin: '222222222222',
  }] }).records;
  const projectA = { id: 'project-a', notes: { accounting: { documents: [{
    source: '1c', sourceDatabase: source, type: 'invoice', externalId: record.externalId,
  }] } } };
  const projectB = { id: 'project-b', notes: {
    contract: { number: 'B-11' }, client: { bin: '222222222222' },
  } };

  const plan = planOneCProjectChanges([record], [projectA, projectB], source, {
    available: false,
    rowsByKey: new Map(),
    projectIdsByPaymentDocumentId: new Map(),
  });
  assert.deepEqual([...plan.removals.keys()], ['project-a']);
  assert.deepEqual([...plan.additions.keys()], ['project-b']);
  assert.equal(plan.matches[0].match.project?.id, 'project-b');
});

test('remembered supplier classification detaches records from projects and never creates a project error', () => {
  const source = 'MAK';
  const [record] = normalizeOneCPayload({ records: [{
    type: 'invoice', id: 'internet-1', number: 'INV-1', date: '2026-08-31', amount: 45_000,
    contractNumber: 'B-11', counterpartyBin: '333333333333', organizationBin: '444444444444',
  }] }).records;
  const linkedProject = { id: 'project-b', notes: {
    contract: { number: 'B-11' },
    client: { bin: '333333333333' },
    accounting: { documents: [{ source: '1c', sourceDatabase: source, type: 'invoice', externalId: record.externalId }] },
  } };
  const ruleKey = oneCCounterpartyScopeKey(record, source);
  const plan = planOneCProjectChanges(
    [record],
    [linkedProject],
    source,
    { rowsByKey: new Map(), projectIdsByPaymentDocumentId: new Map() },
    new Map([[ruleKey, 'supplier']]),
  );

  assert.equal(plan.matches[0].match.project, null);
  assert.equal(plan.matches[0].match.accountingScope, 'supplier');
  assert.equal(plan.matches[0].match.reason, 'supplier_expense');
  assert.deepEqual([...plan.removals.keys()], ['project-b']);
  assert.equal(plan.additions.size, 0);
});

test('cancel-after-rematch plan removes duplicate imported payments but keeps durable project B', () => {
  const source = 'MAK';
  const paymentDocumentId = '91a2c4f4-0cbe-4d6f-8efa-a09383a1e703';
  const externalId = `${paymentDocumentId}|contractb|222222222222`;
  const [cancelled] = normalizeOneCPayload({ records: [{
    type: 'Оплата', id: externalId, paymentDocumentId, number: 'ПП-12', date: '2026-08-20',
    amount: 0, status: 'cancelled',
  }] }).records;
  const imported = { source: '1c', sourceDatabase: source, externalId, paymentDocumentId };
  const projectA = { id: 'project-a', notes: { accounting: { payments: [imported] } } };
  const projectB = { id: 'project-b', notes: { accounting: { payments: [imported] } } };
  const plan = planOneCProjectChanges([cancelled], [projectA, projectB], source, {
    rowsByKey: new Map([[
      `payment\u0000${externalId}`,
      { kind: 'payment', external_id: externalId, project_id: 'project-b', match_status: 'matched' },
    ]]),
    projectIdsByPaymentDocumentId: new Map([[paymentDocumentId, new Set(['project-b'])]]),
  });

  assert.equal(plan.matches[0].match.project?.id, 'project-b');
  assert.equal(plan.matches[0].match.reason, 'durable_inbox_match');
  assert.deepEqual([...plan.removals.keys()].sort(), ['project-a', 'project-b']);
  assert.equal(plan.additions.size, 0);
});

test('1C shared secret comparison rejects empty and different values', () => {
  assert.equal(secureSecretMatches('same-secret', 'same-secret'), true);
  assert.equal(secureSecretMatches('', ''), false);
  assert.equal(secureSecretMatches('wrong', 'same-secret'), false);
  assert.equal(secureSecretMatches(hashSharedSecret('same-secret'), hashSharedSecret('same-secret')), true);
});

test('1C project updates use bounded concurrency and preserve result order', async () => {
  let active = 0;
  let maximumActive = 0;
  const results = await runWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 10;
  });

  assert.deepEqual(results, [10, 20, 30, 40, 50, 60]);
  assert.equal(maximumActive, 3);
});
