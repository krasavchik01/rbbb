/**
 * Стадии проекта — единое визуальное представление поверх 15+ разных
 * статусов, которые накопились в системе. Используется в ProjectVitals
 * для «стрипы» с подсветкой текущего шага.
 *
 * Маппинг: 4 нормальных шага + special «отменён».
 */

export type StageKey = 'draft' | 'launch' | 'in_progress' | 'closing' | 'closed';

export interface Stage {
  key: StageKey;
  label: string;
  /** Tailwind background для активного шага */
  tone: string;
  /** Tailwind text для номера/иконки */
  text: string;
}

export const STAGES: Stage[] = [
  { key: 'draft',       label: 'Создан',     tone: 'bg-slate-500',   text: 'text-slate-700' },
  { key: 'launch',      label: 'Запуск',     tone: 'bg-purple-500',  text: 'text-purple-700' },
  { key: 'in_progress', label: 'В работе',   tone: 'bg-blue-500',    text: 'text-blue-700' },
  { key: 'closing',     label: 'Завершение', tone: 'bg-amber-500',   text: 'text-amber-700' },
  { key: 'closed',      label: 'Закрыт',     tone: 'bg-emerald-500', text: 'text-emerald-700' },
];

const STATUS_TO_STAGE: Record<string, StageKey> = {
  // Создан / на одобрении
  draft: 'draft',
  new: 'draft',
  pre_approval: 'draft',
  pending_approval: 'draft',
  Черновик: 'draft',

  // Запуск / назначения
  partner_assigned: 'launch',
  pm_assigned: 'launch',
  team_assembled: 'launch',
  planning: 'launch',
  approved: 'launch',

  // В работе
  in_progress: 'in_progress',
  active: 'in_progress',
  'В работе': 'in_progress',

  // Завершение
  qa_review: 'closing',
  client_signoff: 'closing',
  ready_to_complete: 'closing',
  pending_payment_approval: 'closing',

  // Закрыт
  completed: 'closed',
  closed: 'closed',
  archived: 'closed',
  Завершён: 'closed',
};

export function getProjectStage(status: string | undefined | null): StageKey | 'cancelled' | null {
  if (!status) return null;
  if (status === 'cancelled') return 'cancelled';
  return STATUS_TO_STAGE[status] || 'in_progress';
}

export function getStageIndex(stage: StageKey | 'cancelled' | null): number {
  if (!stage || stage === 'cancelled') return -1;
  return STAGES.findIndex((s) => s.key === stage);
}
