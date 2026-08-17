import { describe, expect, it } from 'vitest';
import { projectForAccountingWorkspace } from '@/lib/accountingAccess';

describe('accounting workspace data boundary', () => {
  it('keeps contract and accounting data but removes every bonus field', () => {
    const project = projectForAccountingWorkspace({
      id: 'project-1',
      name: 'Client',
      notes: {
        contract: { number: '12', amountWithoutVAT: 1_000_000 },
        accounting: { payments: [{ id: 'p1', amount: 200_000 }] },
        finances: {
          currency: 'KZT',
          bonusPercent: 10,
          totalBonusAmount: 100_000,
          teamBonuses: [{ userId: 'u1', amount: 100_000 }],
        },
      },
    } as any) as any;

    expect(project.notes.contract.number).toBe('12');
    expect(project.notes.accounting.payments[0].amount).toBe(200_000);
    expect(project.notes.finances.currency).toBe('KZT');
    expect(project.notes.finances.bonusPercent).toBeUndefined();
    expect(project.notes.finances.totalBonusAmount).toBeUndefined();
    expect(project.notes.finances.teamBonuses).toBeUndefined();
  });
});

