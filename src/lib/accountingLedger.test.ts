import { describe, expect, it } from 'vitest';
import {
  addAccountingPayment,
  accountingDeadlineUrgency,
  calculateAccountingProject,
  normalizeAccountingLedger,
  upsertAccountingDocument,
  type AccountingDocument,
} from '@/lib/accountingLedger';

function project(accounting: unknown, amount = 1_000_000) {
  return {
    id: 'project-1',
    currency: 'KZT',
    contract: { number: 'A-1', amountWithoutVAT: amount, currency: 'KZT' },
    notes: { contract: { number: 'A-1', amountWithoutVAT: amount }, accounting },
  };
}

function invoice(overrides: Partial<AccountingDocument> = {}): AccountingDocument {
  return {
    id: 'invoice-1',
    type: 'invoice',
    number: 'СФ-1',
    issueDate: '2026-08-01',
    dueDate: '2026-08-10',
    amount: 800_000,
    status: 'sent',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('accounting ledger', () => {
  it('classifies accounting deadlines into clear urgency bands', () => {
    expect(accountingDeadlineUrgency('2026-08-16', '2026-08-17')).toEqual({ days: -1, urgency: 'overdue' });
    expect(accountingDeadlineUrgency('2026-08-17', '2026-08-17')).toEqual({ days: 0, urgency: 'today' });
    expect(accountingDeadlineUrgency('2026-08-24', '2026-08-17')).toEqual({ days: 7, urgency: 'week' });
    expect(accountingDeadlineUrgency('2026-09-16', '2026-08-17')).toEqual({ days: 30, urgency: 'month' });
    expect(accountingDeadlineUrgency('', '2026-08-17')).toEqual({ days: null, urgency: 'missing' });
  });

  it('normalizes malformed legacy values without allowing negative money', () => {
    const ledger = normalizeAccountingLedger({
      documents: [{ id: 'i', type: 'invoice', amount: '-100', status: 'unknown' }],
      payments: [{ id: 'p', amount: '-25' }, { id: 'p2', amount: '50 000', date: '2026-08-01' }],
    });
    expect(ledger.documents[0].amount).toBe(0);
    expect(ledger.documents[0].status).toBe('draft');
    expect(ledger.payments).toHaveLength(1);
    expect(ledger.payments[0].amount).toBe(50_000);
  });

  it('calculates partial payment, receivable and overdue status from source rows', () => {
    const value = project({
      version: 1,
      documents: [invoice()],
      payments: [{
        id: 'payment-1',
        date: '2026-08-05',
        amount: 300_000,
        kind: 'advance',
        createdAt: '2026-08-05T00:00:00.000Z',
      }],
    });
    const summary = calculateAccountingProject(value, '2026-08-17');
    expect(summary.invoiceAmount).toBe(800_000);
    expect(summary.paidAmount).toBe(300_000);
    expect(summary.receivableAmount).toBe(500_000);
    expect(summary.contractBalanceAmount).toBe(700_000);
    expect(summary.overdueAmount).toBe(500_000);
    expect(summary.status).toBe('overdue');
    expect(summary.nextActionLabel).toBe('Получить просроченную оплату');
    expect(summary.nextActionDeadline).toBe('2026-08-10');
    expect(summary.daysUntilNextAction).toBe(-7);
    expect(summary.deadlineUrgency).toBe('overdue');
  });

  it('requires an AVR after invoices are fully paid and closes only after signature', () => {
    const paidLedger = addAccountingPayment(
      upsertAccountingDocument(normalizeAccountingLedger({}), invoice()),
      {
        id: 'payment-1',
        date: '2026-08-05',
        amount: 800_000,
        kind: 'final',
        createdAt: '2026-08-05T00:00:00.000Z',
      },
    );
    expect(calculateAccountingProject(project(paidLedger), '2026-08-06').status).toBe('needs_avr');

    const withSentAvr = upsertAccountingDocument(paidLedger, invoice({
      id: 'avr-1',
      type: 'avr',
      number: 'АВР-1',
      status: 'sent',
    }));
    expect(calculateAccountingProject(project(withSentAvr), '2026-08-06').status).toBe('awaiting_signature');

    const withSignedAvr = upsertAccountingDocument(withSentAvr, {
      ...withSentAvr.documents.find((item) => item.id === 'avr-1')!,
      status: 'signed',
    });
    expect(calculateAccountingProject(project(withSignedAvr), '2026-08-06').status).toBe('complete');
  });

  it('keeps currencies separate at project level', () => {
    const value = project({ version: 1, documents: [invoice({ amount: 15_000 })], payments: [] }, 15_000);
    value.contract.currency = 'USD';
    const summary = calculateAccountingProject(value);
    expect(summary.currency).toBe('USD');
    expect(summary.invoiceAmount).toBe(15_000);
  });
});
