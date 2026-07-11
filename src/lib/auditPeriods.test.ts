import { describe, expect, it } from 'vitest';
import { getAuditPeriods, projectToAuditPeriod } from './auditPeriods';

describe('audit period team ownership', () => {
  it('reads explicit periods from notes and keeps an explicit empty team', () => {
    const periods = getAuditPeriods({
      notes: { auditPeriods: [{ id: 'p1', name: '2025', team: [] }] },
    });

    expect(periods[0].team).toEqual([]);
  });

  it('does not copy the project team into a synthetic period', () => {
    const period = projectToAuditPeriod({
      id: 'project-1',
      name: 'Audit 2025',
      notes: { team: [{ userId: 'u1', role: 'partner' }] },
    });

    expect(period.team).toEqual([]);
    expect(period.teamSource).toBe('empty');
  });
});
