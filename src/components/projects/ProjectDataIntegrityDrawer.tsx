import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ProjectCommandCenterModel } from '@/lib/projectCommandCenterModel';

interface ProjectDataIntegrityDrawerProps {
  model: ProjectCommandCenterModel;
  canRepair: boolean;
}

export function ProjectDataIntegrityDrawer({ model, canRepair }: ProjectDataIntegrityDrawerProps) {
  const critical = model.warnings.filter((warning) => warning.severity === 'critical');
  const attention = model.warnings.filter((warning) => warning.severity !== 'critical');
  const previewLines = [
    `Проект: ${model.projectName}`,
    `Изменений без подтверждения: 0`,
    `Проверяемые поля: компания, предмет, вид услуги, даты, сумма, файл, stage ↔ period`,
    `Команды периодов и таймшиты: не изменяются`,
  ];

  return (
    <Card className="border-dashed p-4" aria-label="Проверка целостности данных проекта">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {model.warnings.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
            Целостность исторических данных
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Это read-only проверка. Массовые исправления запрещены без preview и подтверждения.
          </div>
        </div>
        <Badge variant={model.warnings.length > 0 ? 'secondary' : 'outline'}>
          {model.warnings.length > 0 ? `${model.warnings.length} сигнал(а)` : 'Данные связаны'}
        </Badge>
      </div>

      {model.warnings.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {critical.length > 0 && <WarningGroup title="Критично" items={critical.map((item) => item.label)} />}
          {attention.length > 0 && <WarningGroup title="Проверить" items={attention.map((item) => item.label)} />}
        </div>
      )}

      <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
        {previewLines.map((line) => <div key={line}>{line}</div>)}
      </div>

      {canRepair && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled title="Будет включено после отдельного preview/approval flow">
            Preview repair
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled>
            Bulk fix disabled until explicit approval
          </Button>
        </div>
      )}
    </Card>
  );
}

function WarningGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
