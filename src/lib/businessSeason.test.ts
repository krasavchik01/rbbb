import { describe, expect, it } from 'vitest';
import {
  BUSINESS_SEASON_NO_DATE,
  businessSeasonEndYear,
  countProjectBusinessSeasons,
  projectBusinessSeasonDates,
  projectBusinessSeasonValue,
  projectBusinessSeasonValueFromProject,
} from './businessSeason';

describe('project business-season partition', () => {
  it('uses October through September boundaries', () => {
    expect(businessSeasonEndYear('2025-09-30')).toBe(2025);
    expect(businessSeasonEndYear('2025-10-01')).toBe(2026);
  });

  it('assigns a long project only to the season of its deadline', () => {
    expect(projectBusinessSeasonValue({
      startDate: '2023-09-22',
      deadline: '2029-10-17',
    })).toBe('season:2030');
  });

  it('falls back from deadline to end date, then start date, then no date', () => {
    expect(projectBusinessSeasonValue({ deadline: '', endDate: '2025-09-30', startDate: '2022-01-01' })).toBe('season:2025');
    expect(projectBusinessSeasonValue({ deadline: 'not-a-date', startDate: '2024-10-01' })).toBe('season:2025');
    expect(projectBusinessSeasonValue({})).toBe(BUSINESS_SEASON_NO_DATE);
  });

  it('counts every project exactly once and ignores audit-period dates', () => {
    const rows = [
      { startDate: '2023-09-22', deadline: '2029-10-17', auditPeriods: [{ deadline: '2017-01-01' }] },
      { startDate: '2025-10-01', deadline: '' },
      { startDate: '', deadline: '', auditPeriods: [{ deadline: '2024-01-01' }] },
    ];
    const counts = countProjectBusinessSeasons(rows, (row) => row);

    expect(counts).toEqual(new Map([
      ['season:2030', 1],
      ['season:2026', 1],
      [BUSINESS_SEASON_NO_DATE, 1],
    ]));
    expect([...counts.values()].reduce((total, count) => total + count, 0)).toBe(rows.length);
  });

  it('reads only explicit project dates and never falls back to metadata or audit periods', () => {
    const project = {
      created_at: '2026-07-12T00:00:00.000Z',
      notes: JSON.stringify({
        auditPeriods: [{ startDate: '2017-01-01', deadline: '2017-12-31' }],
      }),
    };

    expect(projectBusinessSeasonDates(project)).toEqual({ deadline: '', startDate: '' });
    expect(projectBusinessSeasonValueFromProject(project)).toBe(BUSINESS_SEASON_NO_DATE);
  });
});
