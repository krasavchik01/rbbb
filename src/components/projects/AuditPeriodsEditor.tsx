import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Copy, GripVertical, Plus, Users, X } from 'lucide-react';
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

const PERIOD_TEAM_ROLES = [
  { key: 'partner', label: 'Партнер' },
  { key: 'project_leader', label: 'Руководитель' },
  { key: 'supervisor_3', label: 'Супервайзер 3' },
  { key: 'supervisor_2', label: 'Супервайзер 2' },
  { key: 'supervisor_1', label: 'Супервайзер 1' },
  { key: 'tax_specialist_1', label: 'Налоговик 1' },
  { key: 'tax_specialist_2', label: 'Налоговик 2' },
  { key: 'assistant_3', label: 'Ассистент 3' },
  { key: 'assistant_2', label: 'Ассистент 2' },
  { key: 'assistant_1', label: 'Ассистент 1' },
];

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
    () => [...employees].sort((a: any, b: any) => (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')),
    [employees],
  );
  const sortedEmployees = partners;
  const projectTeam = useMemo(() => {
    const team = project?.team || project?.notes?.team || [];
    return Array.isArray(team) ? team : [];
  }, [project]);

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
  const [draggedMember, setDraggedMember] = useState<{ fromPeriodId: string; member: any } | null>(null);

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

  const saveNextPeriods = async (next: AuditPeriod[]) => {
    setBusy(true);
    try {
      await onSave(next);
      setPeriods(next);
    } finally {
      setBusy(false);
    }
  };

  const employeeLabel = (employee: any): string => employee?.name || employee?.full_name || employee?.email || 'Сотрудник';
  const memberLabel = (member: any): string => member?.userName || member?.name || member?.employeeName || employeeLabel(sortedEmployees.find((employee: any) => employee.id === (member?.userId || member?.employeeId || member?.id)));
  const memberId = (member: any): string => member?.userId || member?.employeeId || member?.id || '';

  const addMemberToPeriod = async (periodId: string, employeeId: string, role: string) => {
    const employee = sortedEmployees.find((candidate: any) => candidate.id === employeeId);
    if (!employee) return;

    const next = periods.map((period) => {
      if (period.id !== periodId) return period;
      const team = Array.isArray(period.team) ? period.team : [];
      const withoutSameSlot = team.filter((member: any) => member.role !== role);
      return {
        ...period,
        team: [
          ...withoutSameSlot,
          {
            userId: employee.id,
            userName: employeeLabel(employee),
            userEmail: employee.email,
            role,
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });

    await saveNextPeriods(next);
  };

  const removeMemberFromPeriod = async (periodId: string, role: string, userId: string, memberIndex: number) => {
    const next = periods.map((period) =>
      period.id === periodId
        ? {
            ...period,
            team: (period.team || []).filter((member: any, index: number) => {
              if (member.role !== role) return true;
              const currentId = memberId(member);
              if (userId && currentId) return currentId !== userId;
              return index !== memberIndex;
            }),
            updatedAt: new Date().toISOString(),
          }
        : period,
    );
    await saveNextPeriods(next);
  };

  const copyProjectTeamToPeriod = async (periodId: string) => {
    const next = periods.map((period) =>
      period.id === periodId
        ? { ...period, team: projectTeam, updatedAt: new Date().toISOString() }
        : period,
    );
    await saveNextPeriods(next);
  };

  const moveDraggedMember = async (toPeriodId: string, role: string) => {
    if (!draggedMember || !canEdit) return;
    const movingMember = { ...draggedMember.member, role };
    const movingId = memberId(movingMember);
    const next = periods.map((period) => {
      const team = Array.isArray(period.team) ? period.team : [];
      if (period.id === draggedMember.fromPeriodId && period.id !== toPeriodId) {
        return {
          ...period,
          team: team.filter((member: any) => !(member.role === draggedMember.member.role && memberId(member) === movingId)),
          updatedAt: new Date().toISOString(),
        };
      }
      if (period.id === toPeriodId) {
        return {
          ...period,
          team: [
            ...team.filter((member: any) => member.role !== role),
            movingMember,
          ],
          updatedAt: new Date().toISOString(),
        };
      }
      return period;
    });

    setDraggedMember(null);
    await saveNextPeriods(next);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Общая команда проекта</div>
            <div className="text-xs text-muted-foreground">
              Это пул людей проекта. Перетащите человека в нужный период и роль.
            </div>
          </div>
          <Badge variant="outline">{projectTeam.length} человек</Badge>
        </div>
        {projectTeam.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Общая команда проекта еще не назначена.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projectTeam.map((member: any, index: number) => (
              <div
                key={`${memberId(member) || memberLabel(member)}-${index}`}
                draggable={canEdit}
                onDragStart={() => setDraggedMember({ fromPeriodId: '__project__', member })}
                onDragEnd={() => setDraggedMember(null)}
                className="flex cursor-grab items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium leading-tight">{memberLabel(member)}</div>
                  <div className="text-[11px] text-muted-foreground">{member.role || 'role'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-3">
        {periods.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Периоды еще не добавлены.
          </Card>
        ) : (
          periods.map((period) => (
            <Card
              key={period.id}
              className="p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedMember) void moveDraggedMember(period.id, draggedMember.member.role || 'assistant_1');
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{period.name}</h3>
                    <Badge variant="outline">{ruTypeLabel[period.type] || AUDIT_PERIOD_TYPE_LABELS[period.type]}</Badge>
                    <Badge variant="secondary">{AUDIT_PERIOD_STATUS_LABELS[period.status]}</Badge>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {(period.team || []).length} в команде
                    </Badge>
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

              <div className="mt-4 rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="text-sm font-semibold">Команда периода</div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={busy || projectTeam.length === 0}
                        onClick={() => copyProjectTeamToPeriod(period.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Команда проекта
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-5">
                  {PERIOD_TEAM_ROLES.map((role) => {
                    const members = (period.team || []).filter((member: any) => member.role === role.key);
                    return (
                      <div
                        key={role.key}
                        className="min-h-[112px] bg-background p-3"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          void moveDraggedMember(period.id, role.key);
                        }}
                      >
                        <div className="mb-2 text-xs font-semibold text-muted-foreground">{role.label}</div>
                        {members.length === 0 && (
                          <div className="mb-2 rounded-md border border-dashed px-2 py-2 text-xs text-muted-foreground">
                            Пусто
                          </div>
                        )}
                        <div className="space-y-2">
                          {members.map((member: any, index: number) => {
                            const id = memberId(member);
                            const originalIndex = (period.team || []).findIndex((candidate: any) => candidate === member);
                            return (
                              <div
                                key={`${role.key}-${id || memberLabel(member)}-${index}`}
                                draggable={canEdit}
                                onDragStart={() => setDraggedMember({ fromPeriodId: period.id, member })}
                                onDragEnd={() => setDraggedMember(null)}
                                className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-2 text-sm"
                              >
                                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1 truncate font-medium">{memberLabel(member)}</div>
                                {canEdit && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 shrink-0 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => removeMemberFromPeriod(period.id, role.key, id, originalIndex)}
                                  >
                                    <X className="mr-1 h-3.5 w-3.5" />
                                    Убрать
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {canEdit && (
                          <Select
                            disabled={busy}
                            value=""
                            onValueChange={(employeeId) => addMemberToPeriod(period.id, employeeId, role.key)}
                          >
                            <SelectTrigger className="mt-2 h-8 text-xs">
                              <SelectValue placeholder="Добавить" />
                            </SelectTrigger>
                            <SelectContent>
                              {sortedEmployees.map((employee: any) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employeeLabel(employee)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
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
