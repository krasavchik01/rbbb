/**
 * ProjectVitals — единый «прибор-щиток» проекта.
 *
 * Зачем: и в списке (Projects-simple), и в шапке проекта (ProjectWorkspace),
 * и на дашборде должен говорить одним языком — стадия, задачи, команда, часы.
 * Иконки + цвет несут смысл без подписей.
 *
 * Варианты:
 *  - 'compact'  — для карточки в списке (стрипа стадии + одна строка задач/часов)
 *  - 'expanded' — для шапки проекта (всё + команда + бар прогресса задач)
 *
 * Источники данных снаружи: tasks (если есть) и hours (approved/pending).
 * Если их не передали — соответствующие блоки не показываем (не блокируем рендер).
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Ban,
  Users,
  Briefcase,
} from 'lucide-react';
import { STAGES, getProjectStage, getStageIndex, type StageKey } from '@/lib/projectStage';
import type { ProjectHoursTotals } from '@/lib/timesheets';

interface Props {
  project: any;
  tasks?: any[];           // массив задач этого проекта (если знаем); статус как в Task
  hours?: ProjectHoursTotals;
  variant?: 'compact' | 'expanded';
}

const ROLE_LABEL: Record<string, string> = {
  partner: 'Партнёр',
  manager_1: 'PM', manager_2: 'PM', manager_3: 'PM',
  supervisor_1: 'Супер', supervisor_2: 'Супер', supervisor_3: 'Супер',
  senior_assistant: 'Ст. ассистент',
  assistant_1: 'Ассистент', assistant_2: 'Ассистент', assistant_3: 'Ассистент',
  tax_specialist_1: 'Налог', tax_specialist_2: 'Налог',
};

function initials(name?: string): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2);
}

function StageStrip({ stage }: { stage: StageKey | 'cancelled' | null }) {
  if (stage === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Ban className="w-4 h-4 text-red-600" />
        <span className="font-medium text-red-700">Отменён</span>
      </div>
    );
  }
  const idx = getStageIndex(stage);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STAGES.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        const future = i > idx;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white transition-colors ${
                done ? 'bg-emerald-500' : active ? s.tone : 'bg-slate-200 text-slate-500'
              }`}
              title={s.label}
            >
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap ${
              active ? `font-semibold ${s.text}` : future ? 'text-muted-foreground' : 'text-foreground'
            }`}>
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <span className={`w-3 h-px ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TaskStats {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
}

function computeTaskStats(tasks?: any[]): TaskStats | null {
  if (!Array.isArray(tasks)) return null;
  const now = Date.now();
  let done = 0, inProgress = 0, overdue = 0;
  for (const t of tasks) {
    const s = t.status;
    if (s === 'done' || s === 'completed') done++;
    else if (s === 'in_progress' || s === 'in_review') inProgress++;
    if (t.due_at && s !== 'done' && s !== 'completed' && new Date(t.due_at).getTime() < now) overdue++;
  }
  return { total: tasks.length, done, inProgress, overdue };
}

function TasksLine({ stats, expanded }: { stats: TaskStats; expanded: boolean }) {
  if (stats.total === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ListTodo className="w-3.5 h-3.5" />
        <span>Задач нет</span>
      </div>
    );
  }
  const allDone = stats.done === stats.total;
  const pct = Math.round((stats.done / stats.total) * 100);

  if (allDone) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span>Все {stats.total} задач выполнены</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="flex items-center gap-1 font-medium">
          <ListTodo className="w-3.5 h-3.5 text-slate-500" />
          {stats.total} задач
        </span>
        {stats.inProgress > 0 && (
          <span className="flex items-center gap-1 text-blue-700">
            <Clock className="w-3 h-3" /> {stats.inProgress} в работе
          </span>
        )}
        {stats.overdue > 0 && (
          <span className="flex items-center gap-1 text-red-700 font-medium">
            <AlertTriangle className="w-3 h-3" /> {stats.overdue} просрочено
          </span>
        )}
        {stats.done > 0 && (
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> {stats.done} готово
          </span>
        )}
      </div>
      {expanded && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function HoursLine({ h }: { h: ProjectHoursTotals }) {
  if (h.approved === 0 && h.pending === 0) return null;
  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <span className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-emerald-600" />
        <b className="text-foreground">{h.approved}ч</b>
        <span className="text-muted-foreground">утв.</span>
      </span>
      {h.pending > 0 && (
        <span className="flex items-center gap-1 text-amber-700" title="Часы, отправленные сотрудниками, но ещё не подтверждённые партнёром">
          <AlertTriangle className="w-3 h-3" />
          <span>+{h.pending}ч ждут партнёра</span>
        </span>
      )}
    </div>
  );
}

function TeamLine({ team }: { team: any[] }) {
  if (!Array.isArray(team) || team.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        <span>Команда не назначена</span>
      </div>
    );
  }
  const partner = team.find((m) => m.role === 'partner');
  const pm = team.find((m) => ['manager_1', 'manager_2', 'manager_3'].includes(m.role));
  const others = team.filter((m) => m !== partner && m !== pm);
  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      {partner && (
        <span className="flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-violet-600" />
          <span className="text-muted-foreground">Партнёр:</span>
          <b className="text-foreground">{partner.userName || partner.name || '—'}</b>
        </span>
      )}
      {pm && (
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-muted-foreground">PM:</span>
          <b className="text-foreground">{pm.userName || pm.name || '—'}</b>
        </span>
      )}
      {others.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1.5">
            {others.slice(0, 4).map((m, i) => (
              <Avatar key={i} className="w-5 h-5 border border-background">
                <AvatarFallback className="text-[9px]">
                  {initials(m.userName || m.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {others.length > 4 && (
            <span className="text-muted-foreground">+{others.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectVitals({ project, tasks, hours, variant = 'compact' }: Props) {
  const stage = useMemo(() => getProjectStage(project?.status), [project?.status]);
  const taskStats = useMemo(() => computeTaskStats(tasks), [tasks]);
  const team = project?.team || project?.notes?.team || [];
  const expanded = variant === 'expanded';

  return (
    <div className={`space-y-${expanded ? '3' : '2'}`}>
      <StageStrip stage={stage} />

      {/* Задачи и часы — в одной строке для compact, в две для expanded */}
      <div className={expanded ? 'space-y-2' : 'flex flex-wrap gap-x-4 gap-y-1.5'}>
        {taskStats && <TasksLine stats={taskStats} expanded={expanded} />}
        {hours && <HoursLine h={hours} />}
      </div>

      {expanded && team && <TeamLine team={team} />}
    </div>
  );
}
