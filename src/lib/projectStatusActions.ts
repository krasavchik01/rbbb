import type { UserRole } from '@/types/roles';

export type ManagedProjectStatus =
  | 'approved'
  | 'planning'
  | 'in_progress'
  | 'ready_to_complete'
  | 'pending_payment_approval'
  | 'completed';

export const MANAGED_PROJECT_STATUS_LABELS: Record<ManagedProjectStatus, string> = {
  approved: 'Утверждён',
  planning: 'Планирование',
  in_progress: 'В работе',
  ready_to_complete: 'Готов к закрытию',
  pending_payment_approval: 'Готово к бонусам',
  completed: 'Завершён',
};

const WORKING_STATUSES: ManagedProjectStatus[] = [
  'approved',
  'planning',
  'in_progress',
  'ready_to_complete',
  'pending_payment_approval',
];

export function projectStatusOptionsForRole(role?: UserRole | string | null) {
  if (!role || !['ceo', 'admin', 'admin_assistant', 'deputy_director'].includes(role)) return [];
  const statuses = role === 'deputy_director' || role === 'admin_assistant'
    ? WORKING_STATUSES
    : [...WORKING_STATUSES, 'completed' as const];
  return statuses.map((value) => ({ value, label: MANAGED_PROJECT_STATUS_LABELS[value] }));
}

function readNotes(project: any): Record<string, any> {
  if (project?.notes && typeof project.notes === 'object') return project.notes;
  try {
    return JSON.parse(project?.notes || '{}');
  } catch {
    return {};
  }
}

export function buildProjectStatusUpdate({
  project,
  nextStatus,
  actor,
  at = new Date().toISOString(),
}: {
  project: any;
  nextStatus: ManagedProjectStatus;
  actor: { id: string; name?: string; email?: string; role?: string };
  at?: string;
}) {
  const notes = readNotes(project);
  const previousStatus = notes.status || project?.status || 'new';
  const statusHistory = Array.isArray(notes.statusHistory) ? notes.statusHistory : [];
  const statusMetadata = nextStatus === 'ready_to_complete'
    ? { markedReadyAt: at, markedReadyBy: actor.id }
    : nextStatus === 'pending_payment_approval'
      ? { submittedForPaymentApprovalAt: at, submittedForPaymentApprovalBy: actor.id }
      : nextStatus === 'completed'
        ? { completedAt: at, completedBy: actor.id }
        : {};

  return {
    status: nextStatus,
    ...(nextStatus === 'completed' ? { completion: 100, completionPercent: 100 } : {}),
    notes: {
      ...notes,
      status: nextStatus,
      ...statusMetadata,
      statusHistory: [
        ...statusHistory,
        {
          from: previousStatus,
          status: nextStatus,
          by: actor.id,
          byName: actor.name || actor.email || actor.id,
          role: actor.role || null,
          at,
        },
      ],
    },
  };
}
