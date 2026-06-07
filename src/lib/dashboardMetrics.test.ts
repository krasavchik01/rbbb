import { describe, expect, it } from 'vitest';
import { buildDashboardMetrics } from './dashboardMetrics';

describe('buildDashboardMetrics', () => {
  const today = '2026-06-07';
  const user = { id: 'director-1', role: 'ceo' };
  const employees = [
    { id: 'partner-1', name: 'Partner One', role: 'partner' },
    { id: 'manager-1', name: 'Manager One', role: 'manager_1' },
    { id: 'assistant-1', name: 'Assistant One', role: 'assistant' },
    { id: 'hr-1', name: 'HR One', role: 'hr' },
  ];
  const projects = [
    { id: 'p-new', name: 'Needs approval', status: 'active', notes: { status: 'pending_approval' }, deadline: '2026-06-20' },
    { id: 'p-team', name: 'Needs team', status: 'active', notes: { status: 'approved', team: [] }, deadline: '2026-06-20' },
    { id: 'p-overdue', name: 'Overdue active', status: 'in_progress', notes: { status: 'approved', team: [{ userId: 'partner-1', role: 'partner' }] }, deadline: '2026-06-01' },
    { id: 'p-done', name: 'Done', status: 'completed', notes: { status: 'approved', team: [] }, deadline: '2026-05-01' },
  ];
  const tasks = [
    { id: 't-blocked', status: 'blocked', project_id: 'p-overdue', assignees: ['assistant-1'] },
    { id: 't-progress', status: 'in_progress', project_id: 'p-overdue', assignees: ['manager-1'] },
    { id: 't-done', status: 'done', project_id: 'p-done', assignees: ['assistant-1'] },
  ];
  const attendance = [
    { employeeId: 'partner-1', date: today, status: 'in_office' },
    { employee_id: 'manager-1', date: today, location_type: 'remote' },
    { employeeId: 'assistant-1', date: '2026-06-06', status: 'in_office' },
  ];
  const timesheets = [
    { id: 'ts1', status: 'submitted', hours: 2, project_id: 'p-overdue', employee_id: 'assistant-1', work_date: today },
    { id: 'ts2', status: 'submitted', hours: 3.5, project_id: 'p-team', employee_id: 'manager-1', work_date: today },
    { id: 'ts3', status: 'approved', hours: 8, project_id: 'p-done', employee_id: 'partner-1', work_date: today },
  ];

  it('builds an action-first director overview from real project, attendance, task, and timesheet data', () => {
    const metrics = buildDashboardMetrics({ user, projects, employees, tasks, attendance, timesheets, today });

    expect(metrics.actions).toMatchObject({
      projectApprovals: 1,
      projectsWithoutTeam: 1,
      pendingTimesheetRows: 2,
      overdueProjects: 1,
      blockedTasks: 1,
    });
    expect(metrics.actions.total).toBe(6);

    expect(metrics.projects).toMatchObject({
      total: 4,
      active: 1,
      completed: 1,
      pendingApproval: 1,
      withoutTeam: 1,
      overdue: 1,
    });

    expect(metrics.attendanceToday).toMatchObject({
      totalEmployees: 4,
      checkedIn: 2,
      inOffice: 1,
      remote: 1,
      missing: 2,
    });

    const dashboardMappedAttendance = buildDashboardMetrics({
      user,
      projects: [],
      employees,
      attendance: [
        { employeeId: 'partner-1', date: new Date(`${today}T00:00:00Z`).toDateString(), rawDate: today, status: 'in_office' },
      ],
      today,
    });
    expect(dashboardMappedAttendance.attendanceToday.checkedIn).toBe(1);

    expect(metrics.timesheets).toMatchObject({
      submittedRows: 2,
      submittedHours: 5.5,
      approvedRows: 1,
      approvedHours: 8,
      projectsWithSubmittedHours: 2,
    });

    expect(metrics.teamByRole).toEqual([
      { role: 'partner', label: 'Партнёры', total: 1, checkedInToday: 1, assignedToActiveProjects: 1 },
      { role: 'manager_1', label: 'Менеджеры', total: 1, checkedInToday: 1, assignedToActiveProjects: 0 },
      { role: 'assistant', label: 'Ассистенты', total: 1, checkedInToday: 0, assignedToActiveProjects: 0 },
      { role: 'hr', label: 'HR', total: 1, checkedInToday: 0, assignedToActiveProjects: 0 },
    ]);
  });
});
