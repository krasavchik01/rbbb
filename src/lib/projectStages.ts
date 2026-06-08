export type ProjectStage =
  | 'procurement_added'
  | 'awaiting_team'
  | 'in_progress'
  | 'ready_for_closure'
  | 'completed'
  | 'other';

export type ProjectStageMetric = {
  stage: ProjectStage;
  title: string;
  shortTitle: string;
  count: number;
  hint: string;
  route: string;
  tone: 'amber' | 'orange' | 'blue' | 'violet' | 'green' | 'slate';
};

export function parseProjectNotes(project: any): any {
  const notes = project?.notes;
  if (!notes) return {};
  if (typeof notes === 'object') return notes;
  if (typeof notes !== 'string') return {};

  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getProjectTeam(project: any): any[] {
  const notes = parseProjectNotes(project);
  const team = project?.team || notes?.team || [];
  return Array.isArray(team) ? team : [];
}

export function getProjectStage(project: any): ProjectStage {
  const notes = parseProjectNotes(project);
  const status = String(project?.status || '').toLowerCase();
  const notesStatus = String(notes?.status || '').toLowerCase();
  const team = getProjectTeam(project);

  if (['completed', 'closed', 'завершён', 'завершен'].includes(status) || ['completed', 'closed'].includes(notesStatus)) {
    return 'completed';
  }

  if (['ready_for_closure', 'pending_closure', 'closure_pending'].includes(status) || ['ready_for_closure', 'pending_closure', 'closure_pending'].includes(notesStatus)) {
    return 'ready_for_closure';
  }

  if (['new', 'pending_approval', 'pending', 'draft'].includes(notesStatus) || ['new', 'pending_approval', 'pending'].includes(status)) {
    return 'procurement_added';
  }

  if ((['approved', 'assigned_to_deputy'].includes(notesStatus) || ['approved'].includes(status)) && team.length === 0) {
    return 'awaiting_team';
  }

  if (team.length === 0 && !['completed', 'closed'].includes(status)) {
    return 'awaiting_team';
  }

  if (['in_progress', 'active', 'в работе', 'активный'].includes(status) || team.length > 0) {
    return 'in_progress';
  }

  return 'other';
}

export function buildProjectStageMetrics(projects: any[] = []): ProjectStageMetric[] {
  const counts: Record<ProjectStage, number> = {
    procurement_added: 0,
    awaiting_team: 0,
    in_progress: 0,
    ready_for_closure: 0,
    completed: 0,
    other: 0,
  };

  for (const project of projects || []) {
    counts[getProjectStage(project)] += 1;
  }

  return [
    {
      stage: 'procurement_added',
      title: 'Добавлено закупками',
      shortTitle: 'Закупки',
      count: counts.procurement_added,
      hint: 'ждёт решения CEO/замдира',
      route: '/project-approval',
      tone: 'amber',
    },
    {
      stage: 'awaiting_team',
      title: 'Не назначено замдиром',
      shortTitle: 'Без команды',
      count: counts.awaiting_team,
      hint: 'нужно назначить партнёра/PM/команду',
      route: '/assign-partners',
      tone: 'orange',
    },
    {
      stage: 'in_progress',
      title: 'В работе',
      shortTitle: 'В работе',
      count: counts.in_progress,
      hint: 'команда работает и ведёт часы',
      route: '/projects?stage=in_progress',
      tone: 'blue',
    },
    {
      stage: 'ready_for_closure',
      title: 'Ждёт закрытия',
      shortTitle: 'Закрытие',
      count: counts.ready_for_closure,
      hint: 'проверить часы, финансы и бонусы',
      route: '/bonuses',
      tone: 'violet',
    },
    {
      stage: 'completed',
      title: 'Закрыто',
      shortTitle: 'Закрыто',
      count: counts.completed,
      hint: 'зафиксировано в истории',
      route: '/projects?stage=completed',
      tone: 'green',
    },
  ];
}

export function getProjectStageLabel(stage: ProjectStage): string {
  switch (stage) {
    case 'procurement_added': return 'Добавлено закупками';
    case 'awaiting_team': return 'Не назначено замдиром';
    case 'in_progress': return 'В работе';
    case 'ready_for_closure': return 'Ждёт закрытия';
    case 'completed': return 'Закрыто';
    default: return 'Прочее';
  }
}
