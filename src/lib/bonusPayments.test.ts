import { describe, expect, it } from 'vitest';
import {
  bonusPaymentKey,
  buildBonusPaymentIndex,
  getBonusPaymentState,
  summarizeBonusPaymentRegistry,
  type BonusPaymentRow,
} from './bonusPayments';

function row(patch: Partial<BonusPaymentRow> = {}): BonusPaymentRow {
  return {
    id: 'payment-1',
    project_id: 'project-1',
    employee_id: 'employee-1',
    bonus_amount: 100,
    kpi_percentage: 10,
    status: 'approved',
    payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...patch,
  };
}

describe('bonus payment registry', () => {
  it('returns an empty state for an empty registry', () => {
    const index = buildBonusPaymentIndex([]);

    expect(index.totalRows).toBe(0);
    expect(index.unmatchedRows).toBe(0);
    expect(getBonusPaymentState(index, 'project-1', 'employee-1')).toEqual({
      registered: false,
      paid: false,
      paymentDate: null,
      amount: 0,
      rowCount: 0,
    });
  });

  it('registers an approved row without calling it paid', () => {
    const index = buildBonusPaymentIndex([row()]);

    expect(index.byKey.has(bonusPaymentKey('project-1', 'employee-1'))).toBe(true);
    expect(getBonusPaymentState(index, 'project-1', 'employee-1')).toEqual({
      registered: true,
      paid: false,
      paymentDate: null,
      amount: 100,
      rowCount: 1,
    });
  });

  it('uses payment_date as the proof of payment', () => {
    const index = buildBonusPaymentIndex([
      row({ payment_date: '2026-07-10', bonus_amount: 125 }),
    ]);

    expect(getBonusPaymentState(index, 'project-1', 'employee-1')).toMatchObject({
      registered: true,
      paid: true,
      paymentDate: '2026-07-10',
      amount: 125,
    });
  });

  it('aggregates installments and keeps the latest payment date', () => {
    const index = buildBonusPaymentIndex([
      row({ id: 'payment-1', bonus_amount: 40, payment_date: '2026-07-02' }),
      row({ id: 'payment-2', bonus_amount: 60, payment_date: '2026-07-11' }),
    ]);

    expect(getBonusPaymentState(index, 'project-1', 'employee-1')).toEqual({
      registered: true,
      paid: true,
      paymentDate: '2026-07-11',
      amount: 100,
      rowCount: 2,
    });
  });

  it('counts rows without a complete project and employee key', () => {
    const index = buildBonusPaymentIndex([
      row({ id: 'missing-project', project_id: null }),
      row({ id: 'missing-employee', employee_id: null }),
    ]);

    expect(index.totalRows).toBe(2);
    expect(index.unmatchedRows).toBe(2);
    expect(index.byKey.size).toBe(0);
  });

  it('does not treat a pending registry row as approved', () => {
    const index = buildBonusPaymentIndex([row({ status: 'pending' })]);

    expect(getBonusPaymentState(index, 'project-1', 'employee-1')).toMatchObject({
      registered: false,
      paid: false,
      rowCount: 1,
    });
  });

  it('separates draft registry rows, approved-to-pay rows and actual payments', () => {
    const summary = summarizeBonusPaymentRegistry([
      row({ id: 'pending', status: 'pending', bonus_amount: 25 }),
      row({ id: 'approved', status: 'approved', bonus_amount: 40 }),
      row({ id: 'paid', status: 'approved', bonus_amount: 60, payment_date: '2026-07-15' }),
    ]);

    expect(summary.pendingAmount).toBe(25);
    expect(summary.approvedUnpaidAmount).toBe(40);
    expect(summary.paidAmount).toBe(60);
    expect(summary.byKey.get(bonusPaymentKey('project-1', 'employee-1'))).toMatchObject({
      pendingAmount: 25,
      approvedUnpaidAmount: 40,
      paidAmount: 60,
      latestPaymentDate: '2026-07-15',
    });
  });

  it('can scope CEO totals to projects visible in the command center', () => {
    const summary = summarizeBonusPaymentRegistry(
      [
        row({ id: 'visible', project_id: 'project-1', bonus_amount: 100 }),
        row({ id: 'hidden', project_id: 'project-2', bonus_amount: 900 }),
      ],
      new Set(['project-1']),
    );

    expect(summary.approvedUnpaidAmount).toBe(100);
    expect(summary.totalRows).toBe(2);
    expect(summary.unmatchedRows).toBe(0);
    expect(summary.outOfScopeRows).toBe(1);
  });
});
