import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import {
  listCampaigns,
  listSubmissions,
  type Campaign,
  type Submission,
} from '@/lib/surveyEngine';
import { aggregateProjects, type ProjectAggregate } from '@/lib/surveyAggregator';
import { ROLE_LABELS } from '@/types/roles';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

type FilterKey = 'all' | 'high' | 'has_close' | 'has_team' | 'no_team';

export default function SurveyApproval() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { projects, updateProject, refresh: refreshProjects } = useProjects();
  const { employees } = useEmployees();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set()); // в рамках сессии

  const reload = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([listCampaigns(), listSubmissions()]);
    setCampaigns(c);
    setSubmissions(s);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  if (!user) return null;
  if (!['deputy_director', 'ceo', 'admin', 'partner'].includes(user.role)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            Утверждение предложений доступно зам.директору, CEO, партнёру и админу.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const filteredSubmissions = useMemo(() => {
    if (campaignFilter === 'all') return submissions;
    return submissions.filter((s) => s.campaignId === campaignFilter);
  }, [submissions, campaignFilter]);

  const aggregates = useMemo(
    () =>
      aggregateProjects({
        campaigns,
        submissions: filteredSubmissions,
        employees: employees.map((e) => ({ id: e.id, name: e.name })),
      }),
    [campaigns, filteredSubmissions, employees],
  );

  const visible = useMemo(() => {
    let list = aggregates;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => a.projectName.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'high':
        list = list.filter((a) => a.confidence === 'high');
        break;
      case 'has_close':
        list = list.filter(
          (a) => a.proposedStatus === 'completed' || a.proposedStatus === 'cancelled',
        );
        break;
      case 'has_team':
        list = list.filter((a) => a.proposedTeam.length > 0);
        break;
      case 'no_team':
        list = list.filter((a) => a.proposedTeam.length === 0);
        break;
    }
    list = list.filter((a) => !approvedIds.has(a.projectId));
    return list;
  }, [aggregates, search, filter, approvedIds]);

  const applyOne = async (a: ProjectAggregate): Promise<boolean> => {
    const project = projects.find((p) => p.id === a.projectId);
    if (!project) {
      toast({ title: 'Проект не найден', description: a.projectName, variant: 'destructive' });
      return false;
    }
    const team = a.proposedTeam.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      role: m.role,
      bonusPercent: 0,
      assignedAt: new Date().toISOString(),
      assignedBy: user.id,
    }));
    const updates: any = { team, teamIds: team.map((t) => t.userId) };
    if (a.proposedStatus === 'completed') {
      updates.status = 'completed';
      updates.completionPercent = 100;
      updates.completedAt = new Date().toISOString();
    } else if (a.proposedStatus === 'cancelled') {
      updates.status = 'cancelled';
    } else if (a.proposedStatus === 'in_progress') {
      updates.status = 'in_progress';
    }
    if (a.avgPercent !== null && a.proposedStatus !== 'completed' && a.proposedStatus !== 'cancelled') {
      updates.completionPercent = a.avgPercent;
    }
    try {
      await updateProject(project.id, updates);
      return true;
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err?.message, variant: 'destructive' });
      return false;
    }
  };

  const approveOne = async (a: ProjectAggregate) => {
    setBusy(true);
    try {
      const ok = await applyOne(a);
      if (ok) {
        setApprovedIds((s) => new Set(s).add(a.projectId));
        toast({ title: 'Принято', description: a.projectName });
        await refreshProjects();
      }
    } finally {
      setBusy(false);
    }
  };

  const dismissOne = (a: ProjectAggregate) => {
    setApprovedIds((s) => new Set(s).add(a.projectId));
    toast({ title: 'Отложено', description: `${a.projectName} — повторно появится после перезагрузки.` });
  };

  const approveSelected = async () => {
    const targets = visible.filter((a) => selected[a.projectId]);
    if (targets.length === 0) {
      toast({ title: 'Ничего не выбрано' });
      return;
    }
    setBusy(true);
    try {
      let ok = 0;
      for (const a of targets) {
        if (await applyOne(a)) {
          ok += 1;
          setApprovedIds((s) => new Set(s).add(a.projectId));
        }
      }
      await refreshProjects();
      setSelected({});
      toast({ title: `Принято ${ok} из ${targets.length}` });
    } finally {
      setBusy(false);
    }
  };

  const toggleSelectAll = () => {
    if (visible.every((a) => selected[a.projectId])) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      visible.forEach((a) => (next[a.projectId] = true));
      setSelected(next);
    }
  };

  const submittedCount = submissions.filter((s) => s.status === 'submitted').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Предложения по проектам
          </CardTitle>
          <CardDescription>
            Система собирает ответы со всех ваших опросов и формирует предложения по командам и
            статусам проектов. Вам остаётся подтвердить — массово или по одному.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по проекту…"
                className="pl-8"
              />
            </div>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все кампании</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все предложения</SelectItem>
                <SelectItem value="high">Только высокая уверенность</SelectItem>
                <SelectItem value="has_close">Только «закрыть»</SelectItem>
                <SelectItem value="has_team">Только с командой</SelectItem>
                <SelectItem value="no_team">Только без команды</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="w-4 h-4 mr-1" /> Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Отправлено ответов</CardDescription>
            <CardTitle className="text-3xl">{submittedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Кампаний всего</CardDescription>
            <CardTitle className="text-3xl">{campaigns.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Проектов с фактами</CardDescription>
            <CardTitle className="text-3xl">{aggregates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription>На утверждение</CardDescription>
            <CardTitle className="text-3xl">{visible.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Нет предложений по выбранным фильтрам. Запустите кампанию или поменяйте фильтры.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <div className="flex-1 text-sm">
                Отмеченные галочками будут применены к карточкам проектов: команды записываются,
                статусы меняются.
              </div>
              <Button size="sm" variant="outline" onClick={toggleSelectAll}>
                {visible.every((a) => selected[a.projectId]) ? 'Снять выделение' : 'Выбрать все'}
              </Button>
              <Button size="sm" onClick={approveSelected} disabled={busy}>
                <CheckCheck className="w-4 h-4 mr-2" /> Принять выделенные
              </Button>
            </CardContent>
          </Card>

          {visible.map((a) => (
            <AggCard
              key={a.projectId}
              agg={a}
              selected={!!selected[a.projectId]}
              onToggle={() => setSelected((s) => ({ ...s, [a.projectId]: !s[a.projectId] }))}
              onApprove={() => approveOne(a)}
              onDismiss={() => dismissOne(a)}
              busy={busy}
              projectStatus={projects.find((p) => p.id === a.projectId)?.status || '—'}
            />
          ))}
        </>
      )}
    </div>
  );
}

function AggCard({
  agg,
  selected,
  onToggle,
  onApprove,
  onDismiss,
  busy,
  projectStatus,
}: {
  agg: ProjectAggregate;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDismiss: () => void;
  busy: boolean;
  projectStatus: string;
}) {
  const statusLabel: Record<NonNullable<ProjectAggregate['proposedStatus']>, { label: string; tone: string }> = {
    in_progress: { label: 'Оставить активным',          tone: 'bg-blue-100 text-blue-700' },
    completed:   { label: 'Закрыть как «Завершён»',     tone: 'bg-green-100 text-green-700' },
    cancelled:   { label: 'Закрыть как «Отменён»',      tone: 'bg-red-100 text-red-700' },
  };
  const confidenceLabel = {
    high:   { label: 'высокая уверенность',  tone: 'bg-emerald-100 text-emerald-700' },
    medium: { label: 'средняя уверенность',  tone: 'bg-amber-100 text-amber-700' },
    low:    { label: 'мало данных',           tone: 'bg-slate-100 text-slate-600' },
  }[agg.confidence];

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-1" />
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold">{agg.projectName || '(без названия)'}</div>
            <div className="text-xs text-muted-foreground">
              В системе: {projectStatus} • Опрошено: {agg.respondentsCount} • Подтвердили участие:{' '}
              {agg.participantsCount}
              {agg.avgPercent !== null && (
                <> • Средняя готовность: <b className="text-foreground">{agg.avgPercent}%</b></>
              )}
            </div>
          </div>
          {agg.proposedStatus && (
            <Badge className={statusLabel[agg.proposedStatus].tone + ' hover:' + statusLabel[agg.proposedStatus].tone}>
              {statusLabel[agg.proposedStatus].label}
            </Badge>
          )}
          <Badge variant="outline" className={confidenceLabel.tone}>
            {confidenceLabel.label}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded border p-2">
            <div className="text-muted-foreground">Ещё идёт</div>
            <div className="text-base font-semibold">{agg.statusVotes.in_progress}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-muted-foreground">Завершён</div>
            <div className="text-base font-semibold">{agg.statusVotes.completed}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-muted-foreground">Отменён</div>
            <div className="text-base font-semibold">{agg.statusVotes.cancelled}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-muted-foreground">Не указали</div>
            <div className="text-base font-semibold">{agg.statusVotes.unknown}</div>
          </div>
        </div>

        {agg.proposedTeam.length > 0 ? (
          <div className="rounded border p-2">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> Предлагаемая команда ({agg.proposedTeam.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {agg.proposedTeam.map((m) => (
                <div key={m.userId} className="text-xs rounded-md border px-2 py-1 bg-muted/40">
                  <span className="font-medium">{m.userName}</span>
                  <span className="text-muted-foreground"> — {ROLE_LABELS[m.role]}</span>
                  {(m.periodFrom || m.periodTo) && (
                    <span className="text-muted-foreground">
                      {' '}({m.periodFrom?.slice(0, 10) || '…'} —{' '}
                      {m.periodTo?.slice(0, 10) || 'сейчас'})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" /> Никто не подтвердил участие в команде.
          </div>
        )}

        {agg.facts.length > 0 && (
          <details className="rounded border p-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Откуда данные ({agg.facts.length} фактов)
            </summary>
            <ul className="mt-2 space-y-1">
              {agg.facts.map((f, i) => (
                <li key={i}>
                  <b>{f.userName}</b>{' '}
                  <span className="text-muted-foreground">({f.campaignTitle})</span>
                  {f.statusVote && <> · статус: {f.statusVote}</>}
                  {f.percent !== undefined && <> · {f.percent}%</>}
                  {f.roleOnProject && <> · роль: {ROLE_LABELS[f.roleOnProject]}</>}
                  {f.year && <> · {f.year}</>}
                  {f.comment && <> · «{f.comment}»</>}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
            <X className="w-4 h-4 mr-1" /> Отложить
          </Button>
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Принять
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
