import { describe, expect, it } from 'vitest';
import { calculateProjectFinances } from './project-v3';

describe('calculateProjectFinances', () => {
  it('keeps an explicit zero bonus percent', () => {
    const finances = calculateProjectFinances({
      contract: { amountWithoutVAT: 1_000_000 },
      finances: { bonusPercent: 0, preExpensePercent: 0 },
      team: [],
    } as any);

    expect(finances.bonusPercent).toBe(0);
    expect(finances.totalBonusAmount).toBe(0);
  });

  it('never creates a negative bonus pool when expenses exceed the contract', () => {
    const finances = calculateProjectFinances({
      contract: { amountWithoutVAT: 100_000 },
      finances: {
        bonusPercent: 10,
        preExpensePercent: 30,
        contractors: [{ id: 'gph', name: 'ГПХ', amount: 120_000 }],
      },
      team: [{ userId: 'employee-1', role: 'assistant_1' }],
    } as any);

    expect(finances.bonusBase).toBe(0);
    expect(finances.totalBonusAmount).toBe(0);
    expect(finances.totalPaidBonuses).toBe(0);
    expect(finances.grossProfit).toBeLessThan(0);
  });

  it('keeps a manual CEO pool in tenge instead of replacing it with the formula', () => {
    const finances = calculateProjectFinances({
      contract: { amountWithoutVAT: 1_000_000 },
      finances: {
        bonusPercent: 10,
        preExpensePercent: 0,
        bonusPoolOverrideAmount: 175_000,
        bonusPoolManuallyAdjusted: true,
        bonusPoolHistory: [{ type: 'pool_amount_change', at: '2026-07-26T00:00:00.000Z' }],
      },
      team: [{ userId: 'employee-1', role: 'assistant_1', bonusPercent: 2 }],
    } as any);

    expect(finances.totalBonusAmount).toBe(175_000);
    expect(finances.bonusPercent).toBe(10);
    expect(finances.bonusPoolOverrideAmount).toBe(175_000);
    expect(finances.bonusPoolManuallyAdjusted).toBe(true);
    expect(finances.teamBonuses['employee-1'].amount).toBe(3_500);
    expect(finances.bonusPoolHistory).toHaveLength(1);
  });

  it('returns to the percentage formula when the manual pool flag is cleared', () => {
    const finances = calculateProjectFinances({
      contract: { amountWithoutVAT: 1_000_000 },
      finances: {
        bonusPercent: 12,
        preExpensePercent: 0,
        bonusPoolOverrideAmount: 175_000,
        bonusPoolManuallyAdjusted: false,
      },
      team: [],
    } as any);

    expect(finances.totalBonusAmount).toBe(120_000);
    expect(finances.bonusPercent).toBe(12);
    expect(finances.bonusPoolOverrideAmount).toBeNull();
    expect(finances.bonusPoolManuallyAdjusted).toBe(false);
  });

  it('normalizes missing role percentages, string manual amounts and multiple roles', () => {
    const automatic = calculateProjectFinances({
      contract: { amountWithoutVAT: 1_000_000 },
      finances: { bonusPercent: 10, preExpensePercent: 0 },
      team: [
        { userId: 'employee-1', role: 'assistant_1', bonusPercent: 2 },
        { userId: 'employee-1', role: 'supervisor_1', bonusPercent: 6 },
        { userId: 'employee-2', role: 'assistant_2' },
      ],
    } as any);
    expect(automatic.teamBonuses['employee-1'].percent).toBe(8);
    expect(automatic.teamBonuses['employee-1'].amount).toBe(8_000);
    expect(automatic.teamBonuses['employee-2'].amount).toBe(0);

    const manual = calculateProjectFinances({
      contract: { amountWithoutVAT: 1_000_000 },
      finances: {
        bonusPercent: 10,
        preExpensePercent: 0,
        teamBonuses: {
          'employee-1': { role: 'assistant_1', percent: 0, amount: '125000', manuallyAdjusted: true },
        },
      },
      team: [{ userId: 'employee-1', role: 'assistant_1', bonusPercent: 2 }],
    } as any);
    expect(manual.totalPaidBonuses).toBe(125_000);
  });
});
