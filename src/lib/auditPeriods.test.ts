import { describe, expect, it } from 'vitest';
import {
  AUDIT_PERIOD_TYPE_LABELS,
  buildAuditPeriod,
  getDisplayAuditPeriods,
  getAuditPeriods,
  getEffectivePartnerId,
  groupProjectsByAuditRoot,
  validateAuditPeriodInput,
} from './auditPeriods';

describe('auditPeriods', () => {
  it('reads audit periods from project notes', () => {
    const project = {
      notes: {
        auditPeriods: [
          {
            id: 'ap-1',
            name: '2024 year',
            type: 'year',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          },
        ],
      },
    };

    expect(getAuditPeriods(project)).toHaveLength(1);
    expect(getAuditPeriods(project)[0].name).toBe('2024 year');
  });

  it('validates required dates and date order', () => {
    expect(validateAuditPeriodInput({ name: '', type: 'year', startDate: '', endDate: '' })).toEqual([
      'Period name is required',
      'Start date is required',
      'End date is required',
    ]);

    expect(validateAuditPeriodInput({
      name: 'Bad dates',
      type: 'year',
      startDate: '2024-12-31',
      endDate: '2024-01-01',
    })).toContain('End date must be on or after start date');
  });

  it('builds a stable period object with metadata', () => {
    const period = buildAuditPeriod({
      name: '9 months 2024',
      type: 'nine_months',
      startDate: '2024-01-01',
      endDate: '2024-09-30',
      partnerId: 'partner-1',
      partnerName: 'Partner One',
      createdBy: 'user-1',
    });

    expect(period.id).toMatch(/^ap_/);
    expect(period.type).toBe('nine_months');
    expect(period.year).toBe(2024);
    expect(period.status).toBe('planned');
    expect(AUDIT_PERIOD_TYPE_LABELS[period.type]).toBe('9 months');
  });

  it('uses period partner before project partner', () => {
    const project = {
      notes: {
        team: [{ role: 'partner', userId: 'project-partner' }],
        auditPeriods: [{
          id: 'ap-1',
          name: '2024',
          type: 'year',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          partnerId: 'period-partner',
        }],
      },
    };

    expect(getEffectivePartnerId(project, 'ap-1')).toBe('period-partner');
    expect(getEffectivePartnerId(project)).toBe('project-partner');
  });

  it('falls back to null when no project or period partner exists', () => {
    expect(getEffectivePartnerId({ notes: { team: [] } }, 'missing')).toBeNull();
  });

  it('groups duplicate-like imported projects by cleaned root name and company', () => {
    const rows = groupProjectsByAuditRoot([
      { id: 'p1', name: 'TOO Oil Construction Company (за период 2022-2024)', companyName: 'MAK' },
      { id: 'p2', name: 'TOO Oil Construction Company (за период 2022-2024)', companyName: 'MAK' },
      { id: 'p3', name: 'Another Project', companyName: 'MAK' },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].duplicates).toHaveLength(2);
    expect(rows[0].displayName).toBe('TOO Oil Construction Company');
  });

  it('builds visible period rows from grouped duplicate projects', () => {
    const rows = groupProjectsByAuditRoot([
      {
        id: 'p1',
        name: 'TOO Oil Construction Company (за период 2022-2024)',
        companyName: 'MAK',
        deadline: '2025-02-15',
        status: 'in_progress',
        notes: {
          team: [{ role: 'partner', userId: 'partner-1', userName: 'Partner One' }],
        },
      },
      {
        id: 'p2',
        name: 'TOO Oil Construction Company (за период 2025)',
        companyName: 'MAK',
        deadline: '2026-02-20',
        notes: {
          team: [{ role: 'partner', userId: 'partner-2', userName: 'Partner Two' }],
        },
      },
    ]);

    const periods = getDisplayAuditPeriods(rows[0]);

    expect(periods).toHaveLength(2);
    expect(periods.map((period) => period.name)).toEqual(['2022-2024', '2025']);
    expect(periods.map((period) => period.partnerName)).toEqual(['Partner One', 'Partner Two']);
    expect(periods[0].deadline).toBe('2025-02-15');
  });
});
