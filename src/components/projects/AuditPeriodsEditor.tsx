import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AUDIT_PERIOD_STATUS_LABELS,
  AUDIT_PERIOD_TYPE_LABELS,
  buildAuditPeriod,
  getAuditPeriods,
  validateAuditPeriodInput,
  type AuditPeriod,
  type AuditPeriodType,
} from '@/lib/auditPeriods';

interface AuditPeriodsEditorProps {
  project: any;
  employees: any[];
  currentUserId?: string;
  canEdit: boolean;
  onSave: (periods: AuditPeriod[]) => Promise<void>;
}

const DEFAULT_TYPE: AuditPeriodType = 'year';

const ruTypeLabel: Record<AuditPeriodType, string> = {
  six_months: '6 месяцев',
  nine_months: '9 месяцев',
  year: 'Год',
  custom: 'Произвольный',
};

export function AuditPeriodsEditor({
  project,
  employees,
  currentUserId,
  canEdit,
  onSave,
}: AuditPeriodsEditorProps) {
  const initialPeriods = useMemo(() => getAuditPeriods(project), [project]);
  const partners = useMemo(
    () => employees.filter((employee: any) => employee?.role === 'partner'),
    [employees],
  );

  const [periods, setPeriods] = useState<AuditPeriod[]>(initialPeriods);
  const [draft, setDraft] = useState({
    name: '',
    type: DEFAULT_TYPE,
    startDate: '',
    endDate: '',
    partnerId: '',
    deadline: '',
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setPeriods(initialPeriods);
  }, [initialPeriods]);

  const addPeriod = async () => {
    const validation = validateAuditPeriodInput(draft);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }

    const partner = partners.find((candidate: any) => candidate.id === draft.partnerId);
    const next = [
      ...periods,
      buildAuditPeriod({
        ...draft,
        partnerId: draft.partnerId || undefined,
        partnerName: partner?.name || partner?.full_name,
        deadline: draft.deadline || undefined,
        createdBy: currentUserId,
      }),
    ];

    setBusy(true);
    try {
      await onSave(next);
      setPeriods(next);
      setDraft({ name: '', type: DEFAULT_TYPE, startDate: '', endDate: '', partnerId: '', deadline: '' });
      setErrors([]);
    } finally {
      setBusy(false);
    }
  };

  const updatePartner = async (periodId: string, partnerId: string) => {
    const partner = partners.find((candidate: any) => candidate.id === partnerId);
    const next = periods.map((period) =>
      period.id === periodId
        ? {
            ...period,
            partnerId,
            partnerName: partner?.name || partner?.full_name,
            updatedAt: new Date().toISOString(),
          }
        : period,
    );

    setBusy(true);
    try {
      await onSave(next);
      setPeriods(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {periods.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Периоды еще не добавлены.
          </Card>
        ) : (
          periods.map((period) => (
            <Card key={period.id} className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{period.name}</h3>
                    <Badge variant="outline">{ruTypeLabel[period.type] || AUDIT_PERIOD_TYPE_LABELS[period.type]}</Badge>
                    <Badge variant="secondary">{AUDIT_PERIOD_STATUS_LABELS[period.status]}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {period.startDate} - {period.endDate}
                    </span>
                    {period.deadline && <span>Дедлайн: {period.deadline}</span>}
                  </div>
                </div>
                <div className="w-full md:w-64">
                  <Label className="text-xs">Партнер периода</Label>
                  <Select
                    value={period.partnerId || ''}
                    onValueChange={(value) => updatePartner(period.id, value)}
                    disabled={!canEdit || busy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Не назначен" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((partner: any) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name || partner.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {canEdit && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" />
            Добавить период
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Название</Label>
              <Input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Например: 2024 год"
              />
            </div>
            <div>
              <Label className="text-xs">Тип</Label>
              <Select
                value={draft.type}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as AuditPeriodType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="six_months">6 месяцев</SelectItem>
                  <SelectItem value="nine_months">9 месяцев</SelectItem>
                  <SelectItem value="year">Год</SelectItem>
                  <SelectItem value="custom">Произвольный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Партнер</Label>
              <Select
                value={draft.partnerId}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, partnerId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите партнера" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner: any) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name || partner.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Начало</Label>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Конец</Label>
              <Input
                type="date"
                value={draft.endDate}
                onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Дедлайн</Label>
              <Input
                type="date"
                value={draft.deadline}
                onChange={(event) => setDraft((prev) => ({ ...prev, deadline: event.target.value }))}
              />
            </div>
          </div>
          {errors.length > 0 && (
            <div className="text-xs text-red-600">{errors.join(', ')}</div>
          )}
          <Button onClick={addPeriod} disabled={busy} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Сохранить период
          </Button>
        </Card>
      )}
    </div>
  );
}
