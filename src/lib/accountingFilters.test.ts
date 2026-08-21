import { describe, expect, it } from 'vitest';
import { calculateAccountingProject } from '@/lib/accountingLedger';
import {
  DEFAULT_ACCOUNTING_FILTERS,
  countActiveAccountingFilters,
  filterAndSortAccountingRows,
  type AccountingFilterableRow,
  type AccountingFilterValues,
} from '@/lib/accountingFilters';

function row(overrides: Record<string, unknown> = {}): AccountingFilterableRow {
  const project = {
    id: String(overrides.id || 'project'),
    name: String(overrides.clientName || 'Клиент'),
    status: overrides.projectClosed ? 'completed' : 'in_progress',
    notes: {
      contract: {
        number: overrides.contractNumber ?? 'Д-1',
        amountWithoutVAT: overrides.contractAmount ?? 1_000_000,
        currency: 'KZT',
        serviceEndDate: overrides.serviceEndDate,
      },
      accounting: {
        documents: overrides.documents ?? [],
        payments: overrides.payments ?? [],
        requirements: overrides.requirements ?? {},
        sync: overrides.sync,
      },
    },
  };
  return {
    clientName: String(overrides.clientName || 'Клиент'),
    companyName: String(overrides.companyName || 'ТОО МАК'),
    contractNumber: String(overrides.contractNumber ?? 'Д-1'),
    leaderName: String(overrides.leaderName || 'Руководитель'),
    contractFileCount: Number(overrides.contractFileCount ?? 1),
    summary: calculateAccountingProject(project, '2026-08-22'),
  };
}

function filters(overrides: Partial<AccountingFilterValues>): AccountingFilterValues {
  return { ...DEFAULT_ACCOUNTING_FILTERS, ...overrides };
}

describe('accounting filters', () => {
  it('combines company, inclusive amount range and text search', () => {
    const rows = [
      row({ clientName: 'Альфа', companyName: 'ТОО МАК', contractAmount: 1_000_000 }),
      row({ clientName: 'Бета', companyName: 'ТОО МКФ', contractAmount: 2_000_000 }),
      row({ clientName: 'Альфа Плюс', companyName: 'ТОО МАК', contractAmount: 3_000_000 }),
    ];
    expect(filterAndSortAccountingRows(rows, filters({
      query: 'альфа',
      company: 'ТОО МАК',
      amountMin: 1_000_000,
      amountMax: 1_000_000,
    })).map((item) => item.clientName)).toEqual(['Альфа']);
  });

  it('distinguishes unpaid, partial, paid and overpaid projects', () => {
    const invoice = [{ id: 'i', type: 'invoice', amount: 100, status: 'issued', createdAt: '2026-08-01' }];
    const rows = [
      row({ clientName: 'Нет оплаты', documents: invoice }),
      row({ clientName: 'Частично', documents: invoice, payments: [{ id: 'p1', amount: 40, date: '2026-08-02', kind: 'interim', createdAt: '2026-08-02' }] }),
      row({ clientName: 'Оплачено', documents: invoice, payments: [{ id: 'p2', amount: 100, date: '2026-08-02', kind: 'final', createdAt: '2026-08-02' }] }),
      row({ clientName: 'Переплата', documents: invoice, payments: [{ id: 'p3', amount: 120, date: '2026-08-02', kind: 'final', createdAt: '2026-08-02' }] }),
    ];
    expect(filterAndSortAccountingRows(rows, filters({ payment: 'unpaid' })).map((item) => item.clientName)).toEqual(['Нет оплаты']);
    expect(filterAndSortAccountingRows(rows, filters({ payment: 'partial' })).map((item) => item.clientName)).toEqual(['Частично']);
    expect(filterAndSortAccountingRows(rows, filters({ payment: 'paid' })).map((item) => item.clientName)).toEqual(['Оплачено']);
    expect(filterAndSortAccountingRows(rows, filters({ payment: 'overpaid' })).map((item) => item.clientName)).toEqual(['Переплата']);
  });

  it('filters contract and document readiness truthfully', () => {
    const rows = [
      row({ clientName: 'Без файла', contractFileCount: 0 }),
      row({ clientName: 'Без счёта' }),
      row({
        clientName: 'АВР не подписан',
        documents: [
          { id: 'i', type: 'invoice', amount: 100, status: 'issued', createdAt: '2026-08-01' },
          { id: 'a', type: 'avr', amount: 100, status: 'sent', createdAt: '2026-08-02' },
        ],
      }),
      row({
        clientName: 'Документы готовы, но есть долг',
        requirements: { esf: true },
        documents: [
          { id: 'i-ready', type: 'invoice', amount: 100, status: 'issued', createdAt: '2026-08-01' },
          { id: 'a-ready', type: 'avr', amount: 100, status: 'signed', createdAt: '2026-08-02' },
          { id: 'e-ready', type: 'esf', amount: 100, status: 'registered', createdAt: '2026-08-03' },
        ],
      }),
    ];
    expect(filterAndSortAccountingRows(rows, filters({ contract: 'missing_file' })).map((item) => item.clientName)).toEqual(['Без файла']);
    expect(filterAndSortAccountingRows(rows, filters({ document: 'invoice_missing' })).map((item) => item.clientName)).toEqual(['Без счёта', 'Без файла']);
    expect(filterAndSortAccountingRows(rows, filters({ document: 'avr_unsigned' })).map((item) => item.clientName)).toEqual(['АВР не подписан']);
    expect(filterAndSortAccountingRows(rows, filters({ document: 'complete' })).map((item) => item.clientName)).toEqual(['Документы готовы, но есть долг']);
  });

  it('sorts by debt and counts every non-default filter', () => {
    const invoice = (amount: number) => [{ id: `i-${amount}`, type: 'invoice', amount, status: 'issued', createdAt: '2026-08-01' }];
    const rows = [row({ clientName: 'Малый долг', documents: invoice(100) }), row({ clientName: 'Большой долг', documents: invoice(500) })];
    expect(filterAndSortAccountingRows(rows, filters({ sort: 'debt_desc' })).map((item) => item.clientName)).toEqual(['Большой долг', 'Малый долг']);
    expect(countActiveAccountingFilters(filters({ query: 'а', payment: 'debt', amountMin: 1, sort: 'client' }))).toBe(4);
  });

  it('distinguishes 1C, manual HUB and mixed projects without hiding mixed records', () => {
    const oneCDocument = { id: 'i-1c', type: 'invoice', amount: 100, status: 'issued', createdAt: '2026-08-01', source: '1c' };
    const hubDocument = { id: 'i-hub', type: 'invoice', amount: 100, status: 'issued', createdAt: '2026-08-01', source: 'manual' };
    const rows = [
      row({ clientName: 'Только 1С', documents: [oneCDocument], sync: { source: '1c' } }),
      row({ clientName: 'Только HUB', documents: [hubDocument] }),
      row({ clientName: 'Смешанный', documents: [oneCDocument, hubDocument], sync: { source: '1c' } }),
    ];

    expect(filterAndSortAccountingRows(rows, filters({ source: 'has_1c', sort: 'client' })).map((item) => item.clientName)).toEqual(['Смешанный', 'Только 1С']);
    expect(filterAndSortAccountingRows(rows, filters({ source: 'has_hub', sort: 'client' })).map((item) => item.clientName)).toEqual(['Смешанный', 'Только HUB']);
    expect(filterAndSortAccountingRows(rows, filters({ source: 'mixed', sort: 'client' })).map((item) => item.clientName)).toEqual(['Смешанный']);
  });

  it('combines project state, deadline and closed-with-debt shortcut', () => {
    const invoice = [{ id: 'invoice', type: 'invoice', amount: 100, status: 'issued', dueDate: '2026-08-01', createdAt: '2026-08-01' }];
    const rows = [
      row({ clientName: 'Закрыт с долгом', projectClosed: true, documents: invoice, serviceEndDate: '2026-08-01' }),
      row({ clientName: 'Открыт с долгом', documents: invoice, serviceEndDate: '2026-08-01' }),
      row({ clientName: 'Открыт без срока' }),
    ];

    expect(filterAndSortAccountingRows(rows, filters({ projectState: 'closed', quick: 'closed_debt' })).map((item) => item.clientName)).toEqual(['Закрыт с долгом']);
    expect(filterAndSortAccountingRows(rows, filters({ projectState: 'open', deadline: 'overdue' })).map((item) => item.clientName)).toEqual(['Открыт с долгом']);
    expect(filterAndSortAccountingRows(rows, filters({ deadline: 'missing' })).map((item) => item.clientName)).toEqual(['Открыт без срока']);
  });
});
