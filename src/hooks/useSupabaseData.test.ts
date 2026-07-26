import { describe, expect, it } from 'vitest';
import { projectHasTeamMember } from './useSupabaseData';

describe('project visibility through the effective team', () => {
  it('keeps a project visible to a legacy archive-only employee', () => {
    const project = {
      notes: {
        team: [],
        auditPeriods: [{
          team: [{
            userId: 'legacy-employee',
            userName: 'Legacy Employee',
            role: 'assistant_2',
            bonusPercent: 4,
          }],
        }],
      },
    };

    expect(projectHasTeamMember(project, {
      id: 'legacy-employee',
      email: null,
      name: null,
    })).toBe(true);
  });
});
