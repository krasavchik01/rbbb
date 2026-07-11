import { describe, expect, it } from 'vitest';
import { getProjectTeam } from './projectTeam';

describe('getProjectTeam', () => {
  it('reads only projects.notes.team', () => {
    const team = getProjectTeam({
      team: [{ userId: 'top-level' }],
      notes: JSON.stringify({
        team: [{ userId: 'notes', role: 'assistant_1', bonusPercent: 2 }],
      }),
    });

    expect(team.map((member) => member.userId)).toEqual(['notes']);
  });
});
