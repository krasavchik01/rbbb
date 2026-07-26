import { describe, expect, it } from 'vitest';
import { buildBonusLedger, calculateExecutiveBonusFinances } from '@/lib/bonusLedger';
import type { BonusPaymentRow } from '@/lib/bonusPayments';

function project({
  id,
  currency = 'KZT',
  pool,
  bonuses,
}: {
  id: string;
  currency?: string;
  pool: number;
  bonuses: Record<string, { amount: number; percent: number; role: string }>;
}) {
  const team = Object.entries(bonuses).map(([userId, bonus]) => ({
    userId,
    userName: userId,
    role: bonus.role,
    bonusPercent: bonus.percent,
  }));
  const teamBonuses = Object.fromEntries(Object.entries(bonuses).map(([employeeId, bonus]) => [
    employeeId,
    { ...bonus, manuallyAdjusted: true },
  ]));
  const finances = {
    amountWithoutVAT: Math.max(pool * 20, pool),
    bonusPercent: 10,
    bonusPoolOverrideAmount: pool,
    bonusPoolManuallyAdjusted: true,
    teamBonuses,
  };
  return {
    id,
    name: `Проект ${id}`,
    currency,
    contract: { amountWithoutVAT: finances.amountWithoutVAT, currency },
    team,
    finances,
    notes: { name: `Проект ${id}`, team, finances },
  };
}

function payment(
  id: string,
  projectId: string | null,
  employeeId: string | null,
  amount: number,
  status: BonusPaymentRow['status'],
  paymentDate: string | null = null,
): BonusPaymentRow {
  return {
    id,
    project_id: projectId,
    employee_id: employeeId,
    bonus_amount: amount,
    kpi_percentage: 100,
    status,
    payment_date: paymentDate,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };
}

describe('executive bonus ledger', () => {
  it('keeps an explicitly supplied team in the shared command-centre calculation', () => {
    const value: any = project({
      id: 'team-override',
      pool: 1_000,
      bonuses: { e1: { amount: 500, percent: 50, role: 'partner' } },
    });
    value.notes.teamSource = 'canonical';

    const finances = calculateExecutiveBonusFinances(value, [
      { userId: 'e2', userName: 'Новый участник', role: 'manager_1', bonusPercent: 10 },
    ]);

    expect(finances.teamBonuses.e2).toBeTruthy();
  });

  it('reconciles draft allocation against paid, approved and unregistered amounts', () => {
    const projects = [project({
      id: 'p1',
      pool: 1_500,
      bonuses: {
        e1: { amount: 1_000, percent: 50, role: 'partner' },
        e2: { amount: 500, percent: 25, role: 'manager_1' },
      },
    })];
    const ledger = buildBonusLedger({
      projects,
      employees: [{ id: 'e1', name: 'Первый' }, { id: 'e2', name: 'Второй' }],
      payments: [
        payment('b1', 'p1', 'e1', 700, 'approved', '2026-07-10T00:00:00.000Z'),
        payment('b2', 'p1', 'e1', 100, 'approved'),
      ],
    });

    expect(ledger.currencyTotals.KZT.plannedAmount).toBe(1_500);
    expect(ledger.currencyTotals.KZT.paidAmount).toBe(700);
    expect(ledger.currencyTotals.KZT.approvedAmount).toBe(100);
    expect(ledger.currencyTotals.KZT.unregisteredAmount).toBe(700);
    expect(ledger.currencyTotals.KZT.plannedAmount + ledger.currencyTotals.KZT.overRegisteredAmount)
      .toBe(ledger.currencyTotals.KZT.linkedRegistryAmount + ledger.currencyTotals.KZT.unregisteredAmount);
  });

  it('keeps project-level over-allocation visible instead of cancelling it against another project', () => {
    const ledger = buildBonusLedger({
      projects: [
        project({ id: 'over', pool: 100, bonuses: { e1: { amount: 150, percent: 150, role: 'partner' } } }),
        project({ id: 'under', pool: 200, bonuses: { e1: { amount: 50, percent: 25, role: 'partner' } } }),
      ],
      employees: [{ id: 'e1', name: 'Сотрудник' }],
      payments: [],
    });

    expect(ledger.currencyTotals.KZT.overAllocatedPoolAmount).toBe(50);
    expect(ledger.currencyTotals.KZT.unallocatedPoolAmount).toBe(150);
  });

  it('does not add USD drafts to KZT and treats the currency-less payment registry as KZT', () => {
    const ledger = buildBonusLedger({
      projects: [project({ id: 'usd', currency: 'USD', pool: 1_000, bonuses: { e1: { amount: 500, percent: 50, role: 'partner' } } })],
      employees: [{ id: 'e1', name: 'Сотрудник' }],
      payments: [payment('b1', 'usd', 'e1', 200, 'approved')],
    });

    expect(ledger.currencyTotals.USD.plannedAmount).toBe(500);
    expect(ledger.currencyTotals.USD.unregisteredAmount).toBe(500);
    expect(ledger.currencyTotals.KZT.approvedAmount).toBe(200);
    expect(ledger.currencyTotals.KZT.overRegisteredAmount).toBe(200);
  });

  it('keeps unmatched registry rows in their exact pending, approved and paid buckets', () => {
    const projects = [project({
      id: 'p1',
      pool: 1_000,
      bonuses: { e1: { amount: 500, percent: 50, role: 'partner' } },
    })];
    const ledger = buildBonusLedger({
      projects,
      employees: [{ id: 'e1', name: 'Сотрудник' }],
      payments: [
        payment('pending', 'p1', null, 100, 'pending'),
        payment('approved', 'p1', null, 200, 'approved'),
        payment('paid', 'p1', null, 300, 'approved', '2026-07-15T00:00:00.000Z'),
      ],
    });

    expect(ledger.currencyTotals.KZT.registryPendingAmount).toBe(100);
    expect(ledger.currencyTotals.KZT.approvedAmount).toBe(200);
    expect(ledger.currencyTotals.KZT.paidAmount).toBe(300);
    expect(ledger.currencyTotals.KZT.unlinkedRegistryAmount).toBe(600);
    expect(ledger.currencyTotals.KZT.registeredAmount).toBe(600);
    expect(ledger.totals.unlinkedPaymentRows).toBe(3);
  });
});
