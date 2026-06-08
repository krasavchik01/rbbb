import { describe, expect, it } from 'vitest';
import {
  ADMIN_WORK_LABEL,
  findBlockingTimesheetDuplicates,
  resolveTimesheetProjectName,
} from './timesheetUi';

describe('resolveTimesheetProjectName', () => {
  it('keeps imported project_name visible while projects dictionary is not loaded yet', () => {
    expect(resolveTimesheetProjectName('АО ШалкияЦинк ЛТД Аудит ФО', null)).toBe('АО ШалкияЦинк ЛТД Аудит ФО');
  });

  it('uses dictionary project name when available', () => {
    expect(resolveTimesheetProjectName('old snapshot', { name: 'Actual project name' })).toBe('Actual project name');
  });

  it('falls back to admin label only when both names are empty', () => {
    expect(resolveTimesheetProjectName('', null)).toBe(ADMIN_WORK_LABEL);
  });
});

describe('findBlockingTimesheetDuplicates', () => {
  const entries = [
    {
      id: 'imported-1',
      employeeId: 'u1',
      projectId: 'p1',
      projectName: 'ТОО Karaton Operating',
      date: '2026-05-12',
      hours: 8,
      status: 'submitted',
    },
    {
      id: 'other-project',
      employeeId: 'u1',
      projectId: 'p2',
      projectName: 'АО BAPY Mining',
      date: '2026-05-12',
      hours: 4,
      status: 'draft',
    },
  ];

  it('blocks manual duplicate for same employee/date/project after import', () => {
    const dup = findBlockingTimesheetDuplicates(entries, {
      employeeId: 'u1',
      projectId: 'p1',
      projectName: 'ТОО Karaton Operating',
      date: '2026-05-12',
    });

    expect(dup.map((e) => e.id)).toEqual(['imported-1']);
  });

  it('allows another project on the same day', () => {
    const dup = findBlockingTimesheetDuplicates(entries, {
      employeeId: 'u1',
      projectId: 'p3',
      projectName: 'Новый проект',
      date: '2026-05-12',
    });

    expect(dup).toHaveLength(0);
  });

  it('ignores the record being edited and rejected records', () => {
    const dup = findBlockingTimesheetDuplicates([
      ...entries,
      { ...entries[0], id: 'rejected-1', status: 'rejected' },
    ], {
      employeeId: 'u1',
      projectId: 'p1',
      projectName: 'ТОО Karaton Operating',
      date: '2026-05-12',
    }, 'imported-1');

    expect(dup).toHaveLength(0);
  });
});
