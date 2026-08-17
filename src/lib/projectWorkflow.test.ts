import { describe, expect, it } from 'vitest';
import { getProjectStatusLabel, getProjectWorkflowStatus, isProjectClosed, mapWorkflowStatusToSupabaseStatus } from './projectWorkflow';

describe('project workflow status', () => {
  it.each([
    { status: 'completed' },
    { status: 'closed' },
    { status: 'Завершён' },
    { status: 'active', notes: { status: 'completed' } },
    { status: 'active', notes: JSON.stringify({ status: 'closed' }) },
  ])('normalizes every closed variant to completed', (project) => {
    expect(getProjectWorkflowStatus(project)).toBe('completed');
    expect(isProjectClosed(project)).toBe(true);
  });

  it('keeps an active project active', () => {
    expect(getProjectWorkflowStatus({ status: 'in_progress' })).toBe('in_progress');
    expect(isProjectClosed({ status: 'in_progress' })).toBe(false);
  });

  it('uses the same closed meaning for labels and database persistence', () => {
    expect(getProjectStatusLabel('closed')).toBe('Завершен');
    expect(mapWorkflowStatusToSupabaseStatus('closed')).toBe('completed');
    expect(mapWorkflowStatusToSupabaseStatus('Закрыт')).toBe('completed');
  });
});
