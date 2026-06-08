import { describe, expect, it } from 'vitest';
import { buildProjectStageMetrics, getProjectStage, getProjectTeam, parseProjectNotes } from './projectStages';

describe('projectStages', () => {
  it('parses notes from object, JSON string, and invalid values safely', () => {
    expect(parseProjectNotes({ notes: { status: 'approved' } })).toEqual({ status: 'approved' });
    expect(parseProjectNotes({ notes: '{"status":"new"}' })).toEqual({ status: 'new' });
    expect(parseProjectNotes({ notes: 'not-json' })).toEqual({});
    expect(parseProjectNotes({})).toEqual({});
  });

  it('extracts team from project or notes', () => {
    expect(getProjectTeam({ team: [{ userId: 'u1' }] })).toHaveLength(1);
    expect(getProjectTeam({ notes: { team: [{ userId: 'u2' }] } })).toHaveLength(1);
    expect(getProjectTeam({ notes: { team: null } })).toEqual([]);
  });

  it('maps legacy project statuses to the CEO roadmap stages', () => {
    expect(getProjectStage({ status: 'active', notes: { status: 'pending_approval' } })).toBe('procurement_added');
    expect(getProjectStage({ status: 'active', notes: { status: 'approved', team: [] } })).toBe('awaiting_team');
    expect(getProjectStage({ status: 'in_progress', notes: { status: 'approved', team: [{ userId: 'partner-1' }] } })).toBe('in_progress');
    expect(getProjectStage({ status: 'ready_for_closure', notes: { team: [{ userId: 'partner-1' }] } })).toBe('ready_for_closure');
    expect(getProjectStage({ status: 'completed', notes: { status: 'approved', team: [] } })).toBe('completed');
  });

  it('builds stage metrics for the director funnel', () => {
    const metrics = buildProjectStageMetrics([
      { id: 'p1', status: 'active', notes: '{"status":"new"}' },
      { id: 'p2', status: 'active', notes: { status: 'approved', team: [] } },
      { id: 'p3', status: 'in_progress', notes: { team: [{ userId: 'u1' }] } },
      { id: 'p4', status: 'ready_for_closure', notes: { team: [{ userId: 'u1' }] } },
      { id: 'p5', status: 'completed' },
    ]);

    expect(metrics.map((metric) => [metric.stage, metric.count])).toEqual([
      ['procurement_added', 1],
      ['awaiting_team', 1],
      ['in_progress', 1],
      ['ready_for_closure', 1],
      ['completed', 1],
    ]);
  });
});
