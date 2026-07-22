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
}

export function ProjectWorkloadChart({ items }: ProjectWorkloadChartProps) {
  const maxHours = Math.max(1, ...items.map((item) => item.approvedHours + item.pendingHours));
  return (
    <Card className="p-4" aria-label="Загрузка команды по таймшитам">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Загрузка команды</div>
          <div className="text-xs text-muted-foreground">Утверждённые и ожидающие часы + активные проекты</div>
        </div>
        <Badge variant="outline">top {items.length || 0}</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Нет таймшитов для выбранного среза.</div>}
        {items.map((item) => {
          const total = item.approvedHours + item.pendingHours;
          const approvedWidth = Math.max(4, Math.round((item.approvedHours / maxHours) * 100));
          const pendingWidth = Math.max(0, Math.round((item.pendingHours / maxHours) * 100));
          return (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{item.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{total.toFixed(1)} ч · {item.activeProjects} проект(а)</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" title={`${item.name}: approved ${item.approvedHours}, pending ${item.pendingHours}`}>
                <div className="bg-primary" style={{ width: `${approvedWidth}%` }} />
                {item.pendingHours > 0 && <div className="bg-amber-400" style={{ width: `${pendingWidth}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
