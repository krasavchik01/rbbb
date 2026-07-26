import { describe, expect, it } from 'vitest';
import { calculateProjectFinances } from '@/types/project-v3';
import {
  canonicalTeamMarkerPatch,
  effectiveProjectTeam,
  financeParticipants,
} from './projectLegacyCompatibility';

const member = (userId: string, role: string, bonusPercent = 10) => ({
  userId,
  userName: userId,
  role,
  bonusPercent,
});

describe('project legacy compatibility', () => {
  it('reads legacy period-only employees until the unified team is materialized', () => {
    const project = {
      notes: {
        team: [member('common', 'partner', 29)],
        auditPeriods: [{
          id: 'legacy-period',
          name: '2024',
          team: [member('legacy', 'manager_1', 24)],
        }],
      },
    };

    expect(effectiveProjectTeam(project).map((item) => item.userId)).toEqual(['common', 'legacy']);

    const marker = canonicalTeamMarkerPatch(project, [member('common', 'partner', 29)]);
    const unifiedProject = {
      ...project,
      team: [member('legacy', 'manager_1', 24)],
      notes: {
        ...project.notes,
        ...marker,
      },
    };

    expect(effectiveProjectTeam(unifiedProject).map((item) => item.userId)).toEqual(['common']);
    expect(unifiedProject.notes.auditPeriods).toBe(project.notes.auditPeriods);
    expect(unifiedProject.notes.auditPeriods?.[0]?.team?.[0]?.userId).toBe('legacy');
  });

  it('recovers a team from a partially imported archive entry without id or name', () => {
    const project = {
      notes: {
        auditPeriods: [{
          team: [member('partial-import', 'assistant_2', 4)],
        }],
      },
    };

    expect(effectiveProjectTeam(project).map((item) => item.userId)).toEqual(['partial-import']);
  });

  it('keeps manual bonuses for period-only and bonus-only employees during recalculation', () => {
    const project = {
      contract: { amountWithoutVAT: 10_000_000 },
      finances: {},
      notes: {
        team: [member('common', 'partner', 29)],
        auditPeriods: [{
          id: 'legacy-period',
          name: '2024',
          team: [member('legacy', 'manager_1', 24)],
        }],
        finances: {
          bonusPercent: 10,
          teamBonuses: {
            legacy: {
              role: 'manager_1',
              percent: 20,
              amount: 350_000,
              manuallyAdjusted: true,
            },
            registry_only: {
              role: 'assistant_1',
              percent: 5,
              amount: 75_000,
              manuallyAdjusted: true,
            },
          },
        },
      },
    };

    expect(financeParticipants(project).map((item) => item.userId)).toEqual([
      'common',
      'legacy',
      'registry_only',
    ]);

    const finances = calculateProjectFinances(project as any);
    expect(finances.teamBonuses.legacy.amount).toBe(350_000);
    expect(finances.teamBonuses.registry_only.amount).toBe(75_000);
  });

  it('drops detached formula-only bonuses but preserves paid amounts exactly', () => {
    const project = {
      contract: { amountWithoutVAT: 10_000_000 },
      notes: {
        teamSource: 'canonical',
        team: [member('common', 'partner', 29)],
        finances: {
          bonusPercent: 10,
          teamBonuses: {
            formula_only: {
              role: 'assistant_1',
              percent: 2,
              amount: 14_000,
              manuallyAdjusted: false,
            },
            paid_detached: {
              role: 'manager_1',
              percent: 7,
              amount: 123_456,
              manuallyAdjusted: false,
              paidAt: '2026-07-01T10:00:00.000Z',
            },
          },
        },
      },
    };

    expect(financeParticipants(project).map((item) => item.userId)).toEqual([
      'common',
      'paid_detached',
    ]);

    const finances = calculateProjectFinances(project as any);
    expect(finances.teamBonuses.formula_only).toBeUndefined();
    expect(finances.teamBonuses.paid_detached.amount).toBe(123_456);
  });
});
