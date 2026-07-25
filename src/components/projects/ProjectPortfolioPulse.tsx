import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ProjectPortfolioPulseProps {
  summary: {
    total: number;
    attention: number;
    closed: number;
    overdue: number;
    soon: number;
    noDeadline: number;
    approvedHours: number;
    pendingHours: number;
    hoursLoading?: boolean;
    hoursError?: boolean;
  };
  onApplyView: (view: 'all' | 'attention' | 'closed' | 'overdue' | 'next_30' | 'no_deadline' | 'waiting_hours') => void;
}

export function ProjectPortfolioPulse({ summary, onApplyView }: ProjectPortfolioPulseProps) {
  const active = Math.max(summary.total - summary.closed, 0);
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-label="CEO portfolio pulse">
      <PulseCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Риски портфеля"
        value={`${summary.attention} / ${summary.total}`}
        detail={`Просрочены: ${summary.overdue}; 30 дней: ${summary.soon}; без срока: ${summary.noDeadline}`}
        tone={summary.attention > 0 ? 'warn' : 'default'}
        action="Показать риски"
        onClick={() => onApplyView(summary.overdue > 0 ? 'overdue' : 'attention')}
      />
      <PulseCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="Доставка"
        value={`${active} активных`}
        detail={`Закрыты: ${summary.closed}; всего проектов: ${summary.total}`}
        action="Закрытые"
        onClick={() => onApplyView('closed')}
      />
      <PulseCard
        icon={<Timer className="h-4 w-4" />}
        title="Таймшиты"
        value={summary.hoursLoading ? 'Загрузка…' : summary.hoursError ? 'Нет данных' : `${summary.approvedHours.toFixed(1)} ч`}
        detail={summary.hoursLoading ? 'Собираем утверждённые часы' : summary.hoursError ? 'Часы не загрузились — нули не используются' : `Ждут подтверждения: ${summary.pendingHours.toFixed(1)} ч`}
        tone={summary.hoursError || summary.pendingHours > 0 ? 'warn' : 'default'}
        action={summary.hoursLoading || summary.hoursError ? 'Показать портфель' : 'Ждущие часы'}
        onClick={() => onApplyView(summary.hoursLoading || summary.hoursError ? 'all' : 'waiting_hours')}
      />
    </div>
  );
}

function PulseCard({
  icon,
  title,
  value,
  detail,
  tone = 'default',
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  tone?: 'default' | 'warn';
  action: string;
  onClick: () => void;
}) {
  return (
    <Card className={tone === 'warn' ? 'border-amber-200 bg-amber-50/60 p-4 dark:bg-amber-950/20' : 'p-4'}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      <Button type="button" variant="link" className="mt-2 h-auto p-0 text-xs" onClick={onClick}>{action}</Button>
    </Card>
  );
}
