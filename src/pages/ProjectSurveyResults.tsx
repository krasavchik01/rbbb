import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects, useEmployees } from '@/hooks/useSupabaseData';
import {
  approveProposal,
  clearAllResponses,
  deleteResponse,
  exportResponsesAsJson,
  getAllProposals,
  getAllResponses,
  getSurveyConfig,
  markProposalApplied,
  regenerateProposals,
  rejectProposal,
  setSurveyConfig,
  startSurvey,
  stopSurvey,
  type SurveyConfig,
  type SurveyProposal,
  type SurveyResponse,
} from '@/lib/projectSurvey';
import { ROLE_LABELS } from '@/types/roles';
import {
  CheckCircle2,
  CheckCheck,
  ClipboardList,
  Download,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';

const PROPOSED_STATUS_LABEL: Record<NonNullable<SurveyProposal['proposedStatus']>, { label: string; tone: string }> = {
  in_progress: { label: 'Оставить активным',         tone: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Закрыть как «Завершён»',    tone: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Закрыть как «Отменён»',     tone: 'bg-red-100 text-red-700' },
};

const CONFIDENCE_LABEL: Record<SurveyProposal['confidence'], { label: string; tone: string }> = {
  high:   { label: 'высокая уверенность',  tone: 'bg-emerald-100 text-emerald-700' },
  medium: { label: 'средняя уверенность',  tone: 'bg-amber-100 text-amber-700' },
  low:    { label: 'мало данных',           tone: 'bg-slate-100 text-slate-600' },
};

export default function ProjectSurveyResults() {
  const { user } = useAuth();
  const { projects, updateProject, refresh: refreshProjects } = useProjects();
  const { employees } = useEmployees();
  const { toast } = useToast();

  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [proposals, setProposals] = useState<SurveyProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [deadline, setDeadline] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const reload = async () => {
    setLoading(true);
    const [cfg, r, p] = await Promise.all([getSurveyConfig(), getAllResponses(), getAllProposals()]);
    setConfig(cfg);
    setResponses(r);
    setProposals(p);
    setDeadline(cfg.deadline?.slice(0, 10) || '');
    setTitle(cfg.title);
    setDescription(cfg.description || '');
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const submitted = useMemo(() => responses.filter((r) => r.status === 'submitted'), [responses]);
  const drafts = useMemo(() => responses.filter((r) => r.status === 'draft'), [responses]);
  const respondedUserIds = useMemo(() => new Set(submitted.map((r) => r.userId)), [submitted]);
  const pendingEmployees = useMemo(
    () => employees.filter((e) => !respondedUserIds.has(e.id)),
    [employees, respondedUserIds],
  );

  const pendingProposals = useMemo(() => proposals.filter((p) => p.status === 'pending'), [proposals]);
  const reviewedProposals = useMemo(() => proposals.filter((p) => p.status !== 'pending'), [proposals]);

  if (!user) return null;

  const isPrivileged = ['deputy_director', 'ceo', 'admin', 'partner'].includes(user.role);
  if (!isPrivileged) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            Результаты опроса доступны только заместителю директора, CEO, партнёру и администратору.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSaveConfig = async () => {
    setBusy(true);
    try {
      const next = await setSurveyConfig({
        title: title.trim() || config?.title,
        description: description.trim(),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      setConfig(next);
      toast({ title: 'Настройки опроса сохранены' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    setBusy(true);
    try {
      const next = enabled
        ? await startSurvey({ id: user.id, name: user.name }, deadline ? new Date(deadline).toISOString() : undefined)
        : await stopSurvey();
      setConfig(next);
      toast({
        title: enabled ? 'Опрос запущен' : 'Опрос остановлен',
        description: enabled
          ? 'Сотрудники увидят баннер и смогут пройти опрос.'
          : 'Сотрудники больше не смогут отправлять ответы, уже отправленные сохранены.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    const json = await exportResponsesAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-survey-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetAll = async () => {
    await clearAllResponses();
    await reload();
    toast({ title: 'Все ответы и предложения удалены' });
  };

  const handleResetOne = async (userId: string) => {
    await deleteResponse(userId);
    await reload();
    toast({ title: 'Ответ сброшен — пользователь сможет пройти опрос заново' });
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const next = await regenerateProposals();
      setProposals(next);
      toast({
        title: 'Предложения пересчитаны',
        description: `${next.filter((p) => p.status === 'pending').length} ожидают утверждения.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const applyProposalToProject = async (p: SurveyProposal): Promise<boolean> => {
    const project = projects.find((x) => x.id === p.projectId);
    if (!project) {
      toast({
        title: 'Проект не найден',
        description: `${p.projectName}: возможно, удалён из системы.`,
        variant: 'destructive',
      });
      return false;
    }
    const team = p.proposedTeam.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      role: m.role,
      bonusPercent: m.bonusPercent || 0,
      assignedAt: new Date().toISOString(),
      assignedBy: user.id,
    }));
    const updates: any = { team, teamIds: team.map((t) => t.userId) };
    if (p.proposedStatus === 'completed') {
      updates.status = 'completed';
      updates.completionPercent = 100;
      updates.completedAt = new Date().toISOString();
    } else if (p.proposedStatus === 'cancelled') {
      updates.status = 'cancelled';
    } else if (p.proposedStatus === 'in_progress') {
      updates.status = 'in_progress';
    }
    try {
      await updateProject(project.id, updates);
      return true;
    } catch (err: any) {
      toast({ title: 'Ошибка', description: err?.message, variant: 'destructive' });
      return false;
    }
  };

  const handleApprove = async (p: SurveyProposal) => {
    setBusy(true);
    try {
      const applied = await applyProposalToProject(p);
      const approved = await approveProposal(p, { id: user.id, name: user.name });
      if (applied) await markProposalApplied(approved);
      await reload();
      await refreshProjects();
      toast({
        title: 'Предложение принято',
        description: `${p.projectName}: команда (${p.proposedTeam.length}) и статус обновлены.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (p: SurveyProposal) => {
    setBusy(true);
    try {
      await rejectProposal(p, { id: user.id, name: user.name });
      await reload();
      toast({ title: 'Предложение отклонено' });
    } finally {
      setBusy(false);
    }
  };

  const handleApproveSelected = async () => {
    const targets = pendingProposals.filter((p) => selected[p.projectId]);
    if (targets.length === 0) {
      toast({ title: 'Ничего не выбрано', description: 'Отметьте предложения галочками.' });
      return;
    }
    setBusy(true);
    try {
      let ok = 0;
      for (const p of targets) {
        const applied = await applyProposalToProject(p);
        const approved = await approveProposal(p, { id: user.id, name: user.name });
        if (applied) {
          await markProposalApplied(approved);
          ok += 1;
        }
      }
      await reload();
      await refreshProjects();
      setSelected({});
      toast({
        title: `Принято ${ok} из ${targets.length}`,
        description: 'Команды и статусы обновлены в проектах.',
      });
    } finally {
      setBusy(false);
    }
  };

  const projectStatusFromSystem = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    return p?.status || '—';
  };

  const toggleSelect = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const toggleSelectAll = () => {
    if (Object.keys(selected).length === pendingProposals.length && pendingProposals.every((p) => selected[p.projectId])) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      pendingProposals.forEach((p) => (next[p.projectId] = true));
      setSelected(next);
    }
  };

  if (loading || !config) {
    return <div className="p-6 text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Опрос по проектам — управление и автоматическое распределение
          </CardTitle>
          <CardDescription>
            Запустите опрос, сотрудники ответят, а система сама сформирует предложения по командам и
            закрытию проектов. Вам остаётся только подтвердить — массово или по одному.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={config.enabled} onCheckedChange={handleToggleEnabled} disabled={busy} />
              <Label className="text-sm font-medium">
                {config.enabled ? 'Опрос идёт' : 'Опрос остановлен'}
              </Label>
            </div>
            {config.startedAt && (
              <span className="text-xs text-muted-foreground">
                Запущен {new Date(config.startedAt).toLocaleString('ru')}
                {config.startedByName ? ` — ${config.startedByName}` : ''}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={reload} disabled={busy}>
                <RefreshCw className="w-4 h-4 mr-2" /> Обновить
              </Button>
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={busy}>
                <Sparkles className="w-4 h-4 mr-2" /> Пересчитать предложения
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" /> Экспорт JSON
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Сбросить
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Заголовок опроса</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Срок прохождения (необязательно)</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Описание (видят сотрудники)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <Button onClick={handleSaveConfig} size="sm" disabled={busy}>
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Отправили</CardDescription>
            <CardTitle className="text-3xl">{submitted.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>В черновике</CardDescription>
            <CardTitle className="text-3xl">{drafts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Не ответили</CardDescription>
            <CardTitle className="text-3xl">{pendingEmployees.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription>На утверждение</CardDescription>
            <CardTitle className="text-3xl">{pendingProposals.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals">
            На утверждение ({pendingProposals.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">История ({reviewedProposals.length})</TabsTrigger>
          <TabsTrigger value="users">По сотрудникам</TabsTrigger>
          <TabsTrigger value="pending">Не ответили ({pendingEmployees.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-3 mt-4">
          {pendingProposals.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Нет предложений на утверждение. Они появятся после того, как сотрудники отправят
                свои ответы.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <div className="flex-1 text-sm">
                    Система автоматически распределила команды и статус по ответам сотрудников.
                    Подтвердите массово или по одному.
                  </div>
                  <Button size="sm" variant="outline" onClick={toggleSelectAll}>
                    {pendingProposals.every((p) => selected[p.projectId])
                      ? 'Снять выделение'
                      : 'Выбрать все'}
                  </Button>
                  <Button size="sm" onClick={handleApproveSelected} disabled={busy}>
                    <CheckCheck className="w-4 h-4 mr-2" /> Принять выделенные
                  </Button>
                </CardContent>
              </Card>

              {pendingProposals.map((p) => {
                const statusLabel = p.proposedStatus ? PROPOSED_STATUS_LABEL[p.proposedStatus] : null;
                const confidence = CONFIDENCE_LABEL[p.confidence];
                return (
                  <Card key={p.projectId} className="border-primary/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <Checkbox
                          checked={!!selected[p.projectId]}
                          onCheckedChange={() => toggleSelect(p.projectId)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-[200px]">
                          <div className="font-semibold">{p.projectName}</div>
                          <div className="text-xs text-muted-foreground">
                            В системе: {projectStatusFromSystem(p.projectId)} • Опрошено:{' '}
                            {p.respondentsCount} • Подтвердили участие: {p.participantsCount}
                          </div>
                        </div>
                        {statusLabel && (
                          <Badge className={statusLabel.tone + ' hover:' + statusLabel.tone}>
                            {statusLabel.label}
                          </Badge>
                        )}
                        <Badge variant="outline" className={confidence.tone}>
                          {confidence.label}
                        </Badge>
                      </div>

                      <div className="grid sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Ещё идёт</div>
                          <div className="text-base font-semibold">{p.statusVotes.in_progress}</div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Завершён</div>
                          <div className="text-base font-semibold">{p.statusVotes.completed}</div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Отменён</div>
                          <div className="text-base font-semibold">{p.statusVotes.cancelled}</div>
                        </div>
                        <div className="rounded border p-2">
                          <div className="text-muted-foreground">Не знаю</div>
                          <div className="text-base font-semibold">{p.statusVotes.unknown}</div>
                        </div>
                      </div>

                      {p.proposedTeam.length > 0 ? (
                        <div className="rounded border p-2">
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Предлагаемая команда (
                            {p.proposedTeam.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.proposedTeam.map((m) => (
                              <div
                                key={m.userId}
                                className="text-xs rounded-md border px-2 py-1 bg-muted/40"
                              >
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
                          <AlertTriangle className="w-3 h-3" /> Никто не подтвердил участие — команда
                          будет очищена при принятии.
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleReject(p)} disabled={busy}>
                          <X className="w-4 h-4 mr-2" /> Отклонить
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(p)} disabled={busy}>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Принять
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-2 mt-4">
          {reviewedProposals.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Ещё ничего не утверждено и не отклонено.
              </CardContent>
            </Card>
          ) : (
            reviewedProposals.map((p) => (
              <Card key={p.projectId}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{p.projectName}</div>
                    <div className="text-xs text-muted-foreground">
                      Команда: {p.proposedTeam.length} •{' '}
                      {p.proposedStatus ? PROPOSED_STATUS_LABEL[p.proposedStatus].label : '—'} •{' '}
                      {p.reviewedByName} • {p.reviewedAt && new Date(p.reviewedAt).toLocaleString('ru')}
                    </div>
                  </div>
                  <Badge variant={p.status === 'approved' ? 'default' : 'destructive'}>
                    {p.status === 'approved' ? 'Принято' : 'Отклонено'}
                  </Badge>
                  {p.appliedAt && (
                    <Badge variant="outline" className="text-xs">
                      Применено к проекту
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-2 mt-4">
          {responses.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Ответов пока нет.
              </CardContent>
            </Card>
          ) : (
            responses.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{r.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {ROLE_LABELS[r.userRole]} • Проектов отмечено:{' '}
                      {r.answers.filter((a) => a.participated).length} из {r.answers.length}
                    </div>
                  </div>
                  <Badge variant={r.status === 'submitted' ? 'default' : 'secondary'}>
                    {r.status === 'submitted' ? 'Отправлено' : 'Черновик'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.submittedAt
                      ? new Date(r.submittedAt).toLocaleString('ru')
                      : new Date(r.updatedAt).toLocaleString('ru')}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => handleResetOne(r.userId)} disabled={busy}>
                    <Trash2 className="w-4 h-4 mr-1" /> Сбросить
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-2 mt-4">
          {pendingEmployees.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Все сотрудники прошли опрос.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2">
                  {pendingEmployees.map((e) => (
                    <Badge key={e.id} variant="outline" className="text-xs">
                      {e.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить все ответы и предложения?</AlertDialogTitle>
            <AlertDialogDescription>
              Это сбросит все черновики, отправленные ответы и сгенерированные предложения.
              Принятые ранее изменения в карточках проектов останутся как есть.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await handleResetAll();
                setConfirmReset(false);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
