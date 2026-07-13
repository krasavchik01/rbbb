import { describe, expect, it } from 'vitest';
import { planEmployeeBulkDeletion } from './employeeBulkActions';

const employees = [
  { id: 'ceo-1', name: 'CEO', role: 'ceo' },
  { id: 'admin-1', name: 'Admin', role: 'admin' },
  { id: 'employee-1', name: 'One', role: 'assistant_1' },
  { id: 'employee-2', name: 'Two', role: 'manager_1' },
];

describe('planEmployeeBulkDeletion', () => {
  it('blocks the current user but keeps other selected employees', () => {
    const plan = planEmployeeBulkDeletion(employees, ['admin-1', 'employee-1'], 'admin-1');
    expect(plan.allowedIds).toEqual(['employee-1']);
    expect(plan.blocked).toEqual([{ id: 'admin-1', reason: 'current_user' }]);
  });

  it('blocks deleting every remaining CEO/admin', () => {
    const plan = planEmployeeBulkDeletion(employees, ['ceo-1', 'admin-1'], 'employee-1');
    expect(plan.allowedIds).toEqual([]);
    expect(plan.blocked.map((item) => item.reason)).toEqual(['last_privileged_user', 'last_privileged_user']);
  });

  it('allows deleting one privileged user when another remains', () => {
    const plan = planEmployeeBulkDeletion(employees, ['ceo-1'], 'employee-1');
    expect(plan.allowedIds).toEqual(['ceo-1']);
    expect(plan.blocked).toEqual([]);
  });
});
