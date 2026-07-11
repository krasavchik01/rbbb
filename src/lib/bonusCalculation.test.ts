import { describe, expect, it } from 'vitest';
import { computeProjectBonus } from './bonusCalculation';

describe('computeProjectBonus', () => {
  it('uses notes finance drafts and labels technical defaults as preliminary', () => {
    const result = computeProjectBonus({
      id: 'p1',
      notes: {
        team: [{ userId: 'u1', userName: 'User', role: 'assistant_1', bonusPercent: 2 }],
        finances: {
          amountWithoutVAT: 1_000_000,
          preExpensePercent: 30,
          bonusPercent: 10,
          teamBonuses: {
            u1: { role: 'assistant_1', percent: 2, amount: 1200, manuallyAdjusted: true },
          },
        },
      },
    }, undefined, { approvedHoursByEmployee: new Map([['u1', 12]]) });

    expect(result.calculationKind).toBe('preliminary');
    expect(result.formulaVersion).toBe('technical-defaults-v1');
    expect(result.members[0].approvedHours).toBe(12);
    expect(result.members[0].finalAmount).toBe(1200);
  });
});
