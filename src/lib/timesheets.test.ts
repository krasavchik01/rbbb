import { describe, expect, it } from 'vitest';
import {
  BULK_REVIEW_CHUNK_SIZE,
  aggregateHoursByPair,
  aggregateProjectHours,
  buildTimesheetHoursSnapshot,
  chunkReviewIds,
} from './timesheets';

describe('timesheet review helpers', () => {
  it('chunks bulk review ids to avoid oversized Supabase IN requests', () => {
    const ids = Array.from({ length: BULK_REVIEW_CHUNK_SIZE * 2 + 7 }, (_, index) => `id-${index}`);

    const chunks = chunkReviewIds(ids);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(BULK_REVIEW_CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(BULK_REVIEW_CHUNK_SIZE);
    expect(chunks[2]).toHaveLength(7);
    expect(chunks.flat()).toEqual(ids);
  });

  it('returns no chunks for an empty review batch', () => {
    expect(chunkReviewIds([])).toEqual([]);
  });

  it('counts only the requested timesheet status', () => {
    const rows = [
      { employee_id: 'u1', project_id: 'p1', hours: 4, status: 'approved' as const },
      { employee_id: 'u1', project_id: 'p1', hours: 8, status: 'submitted' as const },
      { employee_id: 'u1', project_id: 'p1', hours: 2, status: 'rejected' as const },
    ];

    expect(aggregateHoursByPair(rows, 'approved').get('u1__p1')).toBe(4);
    expect(aggregateProjectHours(rows).get('p1')).toEqual({ approved: 4, pending: 8 });
  });

  it('builds one consistent CEO snapshot for projects and employees', () => {
    const rows = [
      { employee_id: 'u1', project_id: 'p1', hours: 4, status: 'approved' as const },
      { employee_id: 'u1', project_id: 'p1', hours: 3, status: 'approved' as const },
      { employee_id: 'u2', project_id: 'p1', hours: 2, status: 'submitted' as const },
      { employee_id: 'u2', project_id: 'p2', hours: 5, status: 'rejected' as const },
    ];

    const snapshot = buildTimesheetHoursSnapshot(rows);

    expect(snapshot.complete).toBe(true);
    expect(snapshot.rowCount).toBe(4);
    expect(snapshot.approvedByEmployeeProject.get('u1__p1')).toBe(7);
    expect(snapshot.pendingByEmployeeProject.get('u2__p1')).toBe(2);
    expect(snapshot.byProject.get('p1')).toEqual({ approved: 7, pending: 2 });
    expect(snapshot.byProject.has('p2')).toBe(false);
  });
});
