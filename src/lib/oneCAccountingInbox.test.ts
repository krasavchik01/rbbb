import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '@/lib/api';
import {
  filterOneCAccountingInbox,
  isMissingOneCInboxTable,
  loadOneCAccountingInbox,
  normalizeOneCAccountingInboxRecord,
  summarizeOneCAccountingInbox,
} from './oneCAccountingInbox';

vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));

const apiGetMock = vi.mocked(apiGet);

describe('oneCAccountingInbox', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  const invoice = normalizeOneCAccountingInboxRecord({
    id: 'record-1',
    source: 'MAK_290424',
    kind: 'invoice',
    external_id: 'invoice-guid',
    document_number: 'СЧ-77',
    document_date: '2026-08-20',
    amount: '1 250 000,50',
    currency: 'KZT',
    contract_number: '№ 24/10-49/ДОУ',
    organization_name: 'ТОО МАК',
    counterparty_name: 'АО Клиент',
    counterparty_bin: '123456789012',
    match_status: 'unmatched',
    match_reason: 'contract_not_found',
    match_candidates: ['project-a'],
  });

  const payment = normalizeOneCAccountingInboxRecord({
    id: 'record-2',
    kind: 'Оплата',
    number: 'ПП-15',
    date: '2026-08-21T10:00:00Z',
    amount: 300_000,
    currency: 'KZT',
    contractNumber: 'А-15',
    customerName: 'ТОО Другой клиент',
    reason: 'missing_contract',
  });

  it('normalizes expected snake_case columns and tolerant aliases', () => {
    expect(invoice).toMatchObject({
      kind: 'invoice',
      documentNumber: 'СЧ-77',
      amount: 1_250_000.5,
      contractNumber: '№ 24/10-49/ДОУ',
      counterpartyName: 'АО Клиент',
      matchReason: 'contract_not_found',
    });
    expect(payment).toMatchObject({ kind: 'payment', documentNumber: 'ПП-15', contractNumber: 'А-15' });
  });

  it('reads business fields from normalized_record while keeping table metadata authoritative', () => {
    const record = normalizeOneCAccountingInboxRecord({
      id: 'inbox-row-id',
      source: 'MAK_290424',
      kind: 'invoice',
      external_id: 'stale-external-id',
      amount: 1,
      match_status: 'unmatched',
      match_reason: 'ambiguous_contract',
      match_candidates: ['project-1', 'project-2'],
      last_seen_at: '2026-08-21T14:20:21.000Z',
      normalized_record: {
        kind: 'payment',
        externalId: 'payment-guid-44',
        number: 'ПП-44',
        date: '2026-08-20',
        amount: 700_000,
        currency: 'KZT',
        contractNumber: 'Д-44',
        organizationName: 'ТОО МАК',
        organizationBin: '123456789012',
        counterpartyName: 'ТОО Клиент',
        counterpartyBin: '210987654321',
      },
    });

    expect(record).toMatchObject({
      id: 'inbox-row-id',
      source: 'MAK_290424',
      kind: 'payment',
      externalId: 'payment-guid-44',
      documentNumber: 'ПП-44',
      documentDate: '2026-08-20',
      amount: 700_000,
      contractNumber: 'Д-44',
      organizationName: 'ТОО МАК',
      counterpartyName: 'ТОО Клиент',
      matchStatus: 'unmatched',
      matchReason: 'ambiguous_contract',
      lastSeenAt: '2026-08-21T14:20:21.000Z',
    });
  });

  it('filters by counterparty, BIN, contract and document number', () => {
    const records = [invoice, payment].filter(Boolean) as NonNullable<typeof invoice>[];
    expect(filterOneCAccountingInbox(records, 'Клиент')).toHaveLength(2);
    expect(filterOneCAccountingInbox(records, '123456789012')).toEqual([invoice]);
    expect(filterOneCAccountingInbox(records, '24/10-49')).toEqual([invoice]);
    expect(filterOneCAccountingInbox(records, 'ПП-15')).toEqual([payment]);
  });

  it('builds KPI totals by type, currency and unmatched reason', () => {
    const records = [invoice, payment].filter(Boolean) as NonNullable<typeof invoice>[];
    const summary = summarizeOneCAccountingInbox(records);
    expect(summary.count).toBe(2);
    expect(summary.amountsByCurrency.KZT).toBe(1_550_000.5);
    expect(summary.byKind.invoice.count).toBe(1);
    expect(summary.byKind.payment.amountsByCurrency.KZT).toBe(300_000);
    expect(summary.byReason.contract_not_found.count).toBe(1);
    expect(summary.byReason.missing_contract.count).toBe(1);
  });

  it('recognizes a not-yet-migrated table without hiding other accounting data', () => {
    expect(isMissingOneCInboxTable({ code: '42P01', message: 'relation does not exist' })).toBe(true);
    expect(isMissingOneCInboxTable({ code: 'PGRST205', message: "Could not find 'one_c_accounting_records' in schema cache" })).toBe(true);
    expect(isMissingOneCInboxTable({ code: '42501', message: 'permission denied' })).toBe(false);
  });

  it('loads the inbox from the protected API using a stable id cursor', async () => {
    apiGetMock
      .mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          records: [{ id: '0001', normalized_record: { kind: 'invoice', number: 'СЧ-1' } }],
          nextCursor: '0001',
          hasMore: true,
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          records: [{ id: '0002', normalized_record: { kind: 'payment', number: 'ПП-2' } }],
          nextCursor: null,
          hasMore: false,
        },
      });

    const result = await loadOneCAccountingInbox();

    expect(apiGetMock).toHaveBeenNthCalledWith(1, '/api/1c/sync?resource=inbox&limit=500');
    expect(apiGetMock).toHaveBeenNthCalledWith(2, '/api/1c/sync?resource=inbox&limit=500&cursor=0001');
    expect(result).toMatchObject({ available: true, truncated: false });
    expect(result.records.map((record) => record.id)).toEqual(['0001', '0002']);
  });

  it('caps automatic pagination at 10,000 rows and reports a partial registry', async () => {
    let pageNumber = 0;
    apiGetMock.mockImplementation(async () => {
      const offset = pageNumber * 500;
      pageNumber += 1;
      return {
        status: 200,
        data: {
          success: true,
          records: Array.from({ length: 500 }, (_, index) => ({
            id: String(offset + index + 1).padStart(5, '0'),
            normalized_record: { kind: 'invoice', number: `СЧ-${offset + index + 1}` },
          })),
          nextCursor: String(offset + 500).padStart(5, '0'),
          hasMore: true,
        },
      };
    });

    const result = await loadOneCAccountingInbox();

    expect(apiGetMock).toHaveBeenCalledTimes(20);
    expect(result.records).toHaveLength(10_000);
    expect(result.truncated).toBe(true);
  });

  it('keeps a missing inbox endpoint graceful and rejects a broken cursor', async () => {
    apiGetMock.mockResolvedValueOnce({ status: 404, error: 'Not found' });
    await expect(loadOneCAccountingInbox()).resolves.toEqual({
      available: false,
      records: [],
      truncated: false,
    });

    apiGetMock.mockResolvedValueOnce({
      status: 200,
      data: { success: true, records: [{ id: 'broken' }], hasMore: true, nextCursor: null },
    });
    await expect(loadOneCAccountingInbox()).rejects.toThrow('курсор');
  });
});
