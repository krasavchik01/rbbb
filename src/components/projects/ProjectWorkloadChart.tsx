import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface WorkloadItem {
  name: string;
  approvedHours: number;
  pendingHours: number;
  activeProjects: number;
}

interface ProjectWorkloadChartProps {
  items: WorkloadItem[];
  loading?: boolean;
  error?: string | null;
}

export function ProjectWorkloadChart({ items, loading = false, error = null }: ProjectWorkloadChartProps) {
  const maxHours = Math.max(1, ...items.map((item) => item.approvedHours + item.pendingHours));
  return (
    <Card className="p-4" aria-label="Загрузка команды по таймшитам">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Загрузка команды</div>
          <div className="text-xs text-muted-foreground">Утверждённые и ожидающие часы + активные проекты</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />утверждено</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />ждёт</span>
          <Badge variant="outline">топ {items.length || 0}</Badge>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {loading ? (
          <div role="status" aria-live="polite" className="py-6 text-center text-sm text-muted-foreground">Загружаем часы сотрудников…</div>
        ) : error ? (
          <div role="alert" className="py-6 text-center text-sm font-medium text-red-700 dark:text-red-300">Нагрузка не показана: таймшиты не загрузились.</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Нет таймшитов для выбранного среза.</div>
        ) : items.map((item) => {
          const total = item.approvedHours + item.pendingHours;
          const approvedWidth = item.approvedHours > 0 ? Math.min(100, (item.approvedHours / maxHours) * 100) : 0;
          const pendingWidth = item.pendingHours > 0 ? Math.min(100 - approvedWidth, (item.pendingHours / maxHours) * 100) : 0;
          return (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{item.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{total.toFixed(1)} ч · {item.activeProjects} проект(а)</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-label={`${item.name}: утверждено ${item.approvedHours.toFixed(1)} часа, ждёт ${item.pendingHours.toFixed(1)} часа`}>
                {item.approvedHours > 0 && <div className="bg-primary" style={{ width: `${approvedWidth}%` }} />}
                {item.pendingHours > 0 && <div className="bg-amber-400" style={{ width: `${pendingWidth}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
