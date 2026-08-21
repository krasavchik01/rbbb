import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashSharedSecret,
  isOneCNoopBatch,
  matchOneCRecord,
  mergeOneCRecordsIntoNotes,
  normalizeOneCPayload,
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

test('1C shared secret comparison rejects empty and different values', () => {
  assert.equal(secureSecretMatches('same-secret', 'same-secret'), true);
  assert.equal(secureSecretMatches('', ''), false);
  assert.equal(secureSecretMatches('wrong', 'same-secret'), false);
  assert.equal(secureSecretMatches(hashSharedSecret('same-secret'), hashSharedSecret('same-secret')), true);
});
