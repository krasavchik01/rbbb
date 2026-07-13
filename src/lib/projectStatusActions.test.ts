import { describe, expect, it } from 'vitest';
import { buildProjectStatusUpdate, projectStatusOptionsForRole } from './projectStatusActions';

describe('project status actions', () => {
  it('allows deputy director to send a project to bonuses but not finalize it', () => {
    const values = projectStatusOptionsForRole('deputy_director').map((item) => item.value);
    expect(values).toContain('pending_payment_approval');
    expect(values).toContain('ready_to_complete');
    expect(values).not.toContain('completed');
  });

  it('keeps final completion available to CEO/admin', () => {
    expect(projectStatusOptionsForRole('ceo').map((item) => item.value)).toContain('completed');
    expect(projectStatusOptionsForRole('admin').map((item) => item.value)).toContain('completed');
  });

  it('records who sent the project to bonus readiness', () => {
    const update = buildProjectStatusUpdate({
      project: { notes: { statusHistory: [] } },
      nextStatus: 'pending_payment_approval',
      actor: { id: 'deputy-1', name: 'Заместитель', role: 'deputy_director' },
      at: '2026-07-13T10:30:00.000Z',
    });
    expect(update.status).toBe('pending_payment_approval');
    expect(update.notes.status).toBe('pending_payment_approval');
    expect(update.notes.submittedForPaymentApprovalBy).toBe('deputy-1');
    expect(update.notes.statusHistory.at(-1)).toMatchObject({
      status: 'pending_payment_approval',
      by: 'deputy-1',
    });
  });
});
