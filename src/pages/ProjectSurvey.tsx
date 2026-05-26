import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useSupabaseData';
import {
  getResponseForUser,
  getSurveyConfig,
  submitResponse,
  type SurveyConfig,
  type SurveyProjectAnswer,
  type SurveyResponse,
} from '@/lib/projectSurvey';
import { bulkInsert, type TimesheetEntryDraft } from '@/lib/timesheets';
import { supabase } from '@/integrations/supabase/client';
import { PROJECT_ROLES, ROLE_LABELS, UserRole } from '@/types/roles';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/types/project-v3';
import { CheckCircle2, ClipboardList, Send, Search, X, Plus, Trash2, Users, Building2, Clock, Sparkles } from 'lucide-react';

const STATUS_TONE: Partial<Record<ProjectStatus, string>> = {
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  planning: 'bg-purple-100 text-purple-700 border-purple-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
  ready_to_complete: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '';
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 7) return `${d} дн. назад`;
  if (d < 30) return `${Math.floor(d / 7)} нед. назад`;
  if (d < 365) return `${Math.floor(d / 30)} мес. назад`;
  return `${Math.floor(d / 365)} г. назад`;
}

// Активные статусы — для них «вы в команде» = автоподтверждение без вопросов
const ACTIVE_STATUSES = new Set(['in_progress', 'planning', 'approved', 'new', 'pending_approval', 'ready_to_complete']);

interface ManualAnswer {
  projectId: string;
  projectName: string;
  roleOnProject?: UserRole;
  periodFrom?: string;
  periodTo?: string;
  totalHours?: number;
  comment?: string;
}

function buildAnswerFromSystem(p: { id: string; name: string; myRole?: UserRole; status?: string }): SurveyProjectAnswer {
  return {
    projectId: p.id,
    projectName: p.name,
    participated: true,
    roleOnProject: p.myRole,
    statusVote: 'in_progress',
  };
}

function buildAnswerFromManual(m: ManualAnswer): SurveyProjectAnswer {
  return {
    projectId: m.projectId,
    projectName: m.projectName,
    participated: true,
    roleOnProject: m.roleOnProject,
    periodFrom: m.periodFrom,
    periodTo: m.periodTo,
    totalHours: m.totalHours,
    comment: m.comment,
    statusVote: 'in_progress',
  };
}

/**
 * Сохраняет ручные ответы опроса в timesheet_entries (source='survey').
 * Идемпотентно: повторный сабмит опроса для тех же projectId удаляет
 * предыдущие survey-записи этого юзера по этим проектам и создаёт новые.
 * Это позволяет править ответ опроса без задвоения часов.
 *
 * Записи идут со status='submitted' — партнёр проекта (или зам.дир, если
 * партнёра нет) увидит их в своём списке на утверждение.
 */
async function appendTimesheetsForManual(
  user: { id: string; name: string },
  items: ManualAnswer[],
): Promise<number> {
  const withHours = items.filter((m) => m.totalHours && m.totalHours > 0 && m.projectId);
  if (withHours.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];

  // 1) Удаляем существующие survey-записи этого юзера по этим проектам.
  //    (project_id хранится как TEXT — проекты, которых нет в системе, имеют
  //    синтетический id вида 'unmatched:...' из ProjectSurvey, такие тоже подойдут.)
  const projectIds = withHours.map((m) => m.projectId).filter((id) => !id.startsWith('unmatched:'));
  if (projectIds.length > 0) {
    await supabase
      .from('timesheet_entries')
      .delete()
      .eq('employee_id', user.id)
      .eq('source', 'survey')
      .in('project_id', projectIds);
  }

  // 2) Готовим новые drafts. Одна запись на проект (без построчной детализации —
  //    в опросе нет дней/секций, только totalHours за период).
  const drafts: TimesheetEntryDraft[] = withHours.map((m) => ({
    employeeId: user.id,
    employeeName: user.name,
    projectId: m.projectId.startsWith('unmatched:') ? null : m.projectId,
    projectName: m.projectName,
    workDate: m.periodFrom || today,
    hours: m.totalHours!,
    position: m.roleOnProject ? ROLE_LABELS[m.roleOnProject] : undefined,
    notes: [
      `Период по опросу: ${m.periodFrom || '—'} → ${m.periodTo || 'сейчас'}`,
      m.comment || null,
    ].filter(Boolean).join(' · ') || undefined,
    source: 'survey',
    status: 'submitted',
    createdBy: user.id,
  }));

  return bulkInsert(drafts);
}

export default function ProjectSurvey() {
  const { user } = useAuth();
  const { projects, loading } = useProjects();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [existingResponse, setExistingResponse] = useState<SurveyResponse | null>(null);
  const [busy, setBusy] = useState(false);

  // Состояние формы (всё локально, никаких черновиков)
  const [systemConfirmed, setSystemConfirmed] = useState<Set<string>>(new Set());
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [manualAnswers, setManualAnswers] = useState<ManualAnswer[]>([]);

  // Поиск
  const [query, setQuery] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [cfg, existing] = await Promise.all([
        getSurveyConfig(),
        user ? getResponseForUser(user.id) : Promise.resolve(null),
      ]);
      if (!active) return;
      setConfig(cfg);
      if (existing) setExistingResponse(existing);
    })();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Активные проекты, где сотрудник уже в team — ВОПРОСОВ НЕТ, только подтверждение
  const mySystemProjects = useMemo(() => {
    if (!user) return [];
    return (projects as any[])
      .filter((p) => {
        if (p.status && !ACTIVE_STATUSES.has(p.status)) return false;
        const team = p.team || [];
        const teamIds = p.teamIds || [];
        return teamIds.includes(user.id) || team.some((m: any) => (m.userId || m.id) === user.id);
      })
      .map((p) => {
        const me = (p.team || []).find((m: any) => (m.userId || m.id) === user.id);
        return {
          id: p.id,
          name: p.name,
          status: (p.status || 'in_progress') as ProjectStatus,
          clientName: p.clientName || p.client?.name || '',
          updatedAt: p.updated_at as string | null,
          myRole: me?.role as UserRole | undefined,
          myAssignedAt: me?.assignedAt as string | undefined,
          team: p.team || [],
        };
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [projects, user]);

  // На первом рендере — все системные проекты подтверждены (один клик — отправить)
  useEffect(() => {
    if (systemInitialized) return;
    if (loading) return;
    setSystemConfirmed(new Set(mySystemProjects.map((p) => p.id)));
    setSystemInitialized(true);
  }, [mySystemProjects, loading, systemInitialized]);

  // Если опрос уже отправлен — восстановим, какие проекты были подтверждены и что добавлено вручную
  useEffect(() => {
    if (!existingResponse) return;
    const systemIds = new Set(mySystemProjects.map((p) => p.id));
    const confirmed = new Set<string>();
    const manual: ManualAnswer[] = [];
    for (const a of existingResponse.answers) {
      if (!a.participated) continue;
      if (systemIds.has(a.projectId)) {
        confirmed.add(a.projectId);
      } else {
        manual.push({
          projectId: a.projectId,
          projectName: a.projectName,
          roleOnProject: a.roleOnProject,
          periodFrom: a.periodFrom,
          periodTo: a.periodTo,
          totalHours: a.totalHours,
          comment: a.comment,
        });
      }
    }
    setSystemConfirmed(confirmed);
    setManualAnswers(manual);
    setSystemInitialized(true);
  }, [existingResponse, mySystemProjects]);

  const manualIds = useMemo(() => new Set(manualAnswers.map((m) => m.projectId)), [manualAnswers]);
  const systemIds = useMemo(() => new Set(mySystemProjects.map((p) => p.id)), [mySystemProjects]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return (projects as any[])
      .filter((p) => {
        if (systemIds.has(p.id) || manualIds.has(p.id)) return false;
        const name = (p.name || '').toLowerCase();
        const client = (p.clientName || p.client?.name || '').toLowerCase();
        return name.includes(q) || client.includes(q);
      })
      .slice(0, 12);
  }, [projects, query, systemIds, manualIds]);

  const toggleSystem = (id: string) => {
    setSystemConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addManual = (p: { id: string; name: string }) => {
    setManualAnswers((prev) => [{ projectId: p.id, projectName: p.name }, ...prev]);
    setQuery('');
    setShowSuggest(false);
  };

  const updateManual = (id: string, patch: Partial<ManualAnswer>) => {
    setManualAnswers((prev) => prev.map((m) => (m.projectId === id ? { ...m, ...patch } : m)));
  };

  const removeManual = (id: string) => {
    setManualAnswers((prev) => prev.filter((m) => m.projectId !== id));
  };

  const handleSubmit = async () => {
    if (!user) return;
    const confirmedSystem = mySystemProjects.filter((p) => systemConfirmed.has(p.id));
    const totalSelected = confirmedSystem.length + manualAnswers.length;

    if (totalSelected === 0) {
      const ok = window.confirm(
        'Вы сняли все галочки и ничего не добавили. Отправить ответ как «я не участвовал ни в одном проекте»?',
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const answers: SurveyProjectAnswer[] = [
        ...confirmedSystem.map((p) => buildAnswerFromSystem(p)),
        ...manualAnswers.map(buildAnswerFromManual),
      ];
      const next = await submitResponse({
        id: existingResponse?.id || `srv_${user.id}_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        answers,
        status: 'submitted',
        updatedAt: new Date().toISOString(),
        submittedAt: existingResponse?.submittedAt,
      });
      setExistingResponse(next);
      const tsCreated = await appendTimesheetsForManual({ id: user.id, name: user.name }, manualAnswers);
      toast({
        title: 'Спасибо!',
        description: tsCreated > 0
          ? `Отправлено. По добавленным проектам создано ${tsCreated} записи таймщита — ждут подтверждения партнёра.`
          : 'Отправлено. Зам.директор увидит ваши данные в результатах опроса.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <div className="p-6 text-muted-foreground">Войдите, чтобы пройти опрос.</div>;
  if (!config) return <div className="p-6 text-muted-foreground">Загрузка…</div>;

  if (!config.enabled && existingResponse?.status !== 'submitted') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Опрос недоступен
          </CardTitle>
          <CardDescription>
            Опрос сейчас не запущен. Обратитесь к заместителю директора.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate('/')}>На дашборд</Button>
        </CardContent>
      </Card>
    );
  }

  const isSubmitted = existingResponse?.status === 'submitted';
  const confirmedCount = mySystemProjects.filter((p) => systemConfirmed.has(p.id)).length;
  const uncheckedCount = mySystemProjects.length - confirmedCount;
  const manualHoursTotal = manualAnswers.reduce((s, m) => s + (m.totalHours || 0), 0);
  const totalToSubmit = confirmedCount + manualAnswers.length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      {/* Заголовок + большая шпаргалка «что делать» */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="w-6 h-6 text-primary" /> {config.title}
              </CardTitle>
              <CardDescription className="mt-2 text-sm">
                {config.description || 'Помогите восстановить реальную картину: подтвердите свои проекты и добавьте те, которых нет в системе. Это займёт 1–2 минуты.'}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isSubmitted && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Отправлено — можно править
                </Badge>
              )}
              {config.deadline && (
                <span className="text-xs text-muted-foreground">
                  Срок: <b>{new Date(config.deadline).toLocaleDateString('ru')}</b>
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 bg-blue-50/50">
              <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>
                Проверить
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Снять галочки с проектов, где вас на самом деле не было.
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-violet-50/50">
              <div className="flex items-center gap-2 text-violet-700 font-semibold text-sm">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">2</span>
                Добавить
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Если работали где-то ещё — найдите и добавьте этот проект.
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-emerald-50/50">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">3</span>
                Отправить
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Один клик — данные уйдут зам.директору на утверждение.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Блок 1 — Системные проекты: только галочки, никаких полей */}
      {mySystemProjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>
                  Ваши проекты в системе
                </CardTitle>
                <CardDescription className="mt-1">
                  По умолчанию все отмечены ✓ — это значит «да, я тут работал». Просто снимите галочку, если на самом деле вы тут <b>не</b> были.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Отмечено {confirmedCount} из {mySystemProjects.length}
                {uncheckedCount > 0 && <span className="ml-1 text-amber-600">• {uncheckedCount} сняли</span>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mySystemProjects.map((p) => {
                const checked = systemConfirmed.has(p.id);
                const others = p.team.filter((m: any) => (m.userId || m.id) !== user.id);
                const tone = STATUS_TONE[p.status] || 'bg-slate-100 text-slate-700 border-slate-200';
                return (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                      checked
                        ? 'bg-primary/5 border-primary/40 shadow-sm'
                        : 'border-dashed bg-muted/30 opacity-70 hover:opacity-100 line-through decoration-from-font'
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleSystem(p.id)} className="mt-1" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{p.name}</div>
                        <Badge variant="outline" className={`text-xs border ${tone}`}>
                          {PROJECT_STATUS_LABELS[p.status] || p.status}
                        </Badge>
                        {p.myRole && (
                          <Badge variant="secondary" className="text-xs">
                            вы: {ROLE_LABELS[p.myRole] || p.myRole}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {p.clientName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {p.clientName}
                          </span>
                        )}
                        {p.updatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> обновлён {relativeTime(p.updatedAt)}
                          </span>
                        )}
                        {p.myAssignedAt && (
                          <span className="flex items-center gap-1">
                            вас добавили {relativeTime(p.myAssignedAt)}
                          </span>
                        )}
                      </div>

                      {others.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>с вами в команде:</span>
                          {others.slice(0, 5).map((m: any, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-muted/60">
                              {m.userName || m.name || '—'}
                              {m.role ? ` (${ROLE_LABELS[m.role as UserRole] || m.role})` : ''}
                            </span>
                          ))}
                          {others.length > 5 && (
                            <span className="text-muted-foreground">+{others.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {mySystemProjects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mb-2">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="font-medium">В системе вас пока не приписали ни к одному активному проекту.</div>
            <div className="text-sm text-muted-foreground mt-1">
              Если вы где-то работали — добавьте проект вручную ниже, чтобы зам.дир увидел.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Блок 2 — Пропущенные проекты: поиск + минимальный набор полей */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center">2</span>
                Работали где-то ещё, чего нет выше?
              </CardTitle>
              <CardDescription className="mt-1">
                Необязательно. Если работали на проекте, которого нет в вашем списке — найдите его и добавьте.
                Можно указать <b>часы за период</b> — они автоматически попадут в ваши таймщиты.
              </CardDescription>
            </div>
            {manualAnswers.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Добавлено: {manualAnswers.length}
                {manualHoursTotal > 0 && <span className="ml-1">• {manualHoursTotal} ч.</span>}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div ref={searchBoxRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                placeholder="Начните печатать — например, «КазМунай», «ТОО Свет»…"
                className="pl-9 h-11 text-base"
                disabled={loading}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showSuggest && query.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-80 overflow-y-auto">
                {suggestions.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Ничего не нашлось.</div>
                ) : (
                  suggestions.map((p) => {
                    const clientName = (p as any).clientName || (p as any).client?.name || '';
                    return (
                      <button
                        key={p.id}
                        onClick={() => addManual({ id: p.id, name: p.name })}
                        className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 flex items-start gap-2"
                      >
                        <Plus className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          {clientName && (
                            <div className="text-xs text-muted-foreground truncate">Клиент: {clientName}</div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {manualAnswers.length > 0 && (
            <div className="mt-4 space-y-3">
              {manualAnswers.map((m) => (
                <div key={m.projectId} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{m.projectName}</div>
                    <Button variant="ghost" size="sm" onClick={() => removeManual(m.projectId)} title="Убрать">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Моя роль</Label>
                      <Select
                        value={m.roleOnProject || ''}
                        onValueChange={(v) => updateManual(m.projectId, { roleOnProject: v as UserRole })}
                      >
                        <SelectTrigger><SelectValue placeholder="Выберите роль…" /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_ROLES.map((r) => (
                            <SelectItem key={r.role} value={r.role}>{ROLE_LABELS[r.role]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Часов всего (для таймщитов)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={m.totalHours ?? ''}
                        onChange={(e) => updateManual(m.projectId, {
                          totalHours: e.target.value === '' ? undefined : Number(e.target.value),
                        })}
                        placeholder="напр., 120"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Период с</Label>
                      <Input
                        type="date"
                        value={m.periodFrom || ''}
                        onChange={(e) => updateManual(m.projectId, { periodFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Период по</Label>
                      <Input
                        type="date"
                        value={m.periodTo || ''}
                        onChange={(e) => updateManual(m.projectId, { periodTo: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Комментарий (необязательно)</Label>
                    <Textarea
                      value={m.comment || ''}
                      onChange={(e) => updateManual(m.projectId, { comment: e.target.value })}
                      rows={2}
                      placeholder="Например: подключился в августе"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Итог перед отправкой */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">3</span>
            Готово к отправке
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {totalToSubmit === 0 ? (
            <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Вы не подтвердили ни одного проекта и ничего не добавили. Это будет отправлено как «я не участвовал ни в одном проекте». Если это не так — вернитесь и проверьте.
            </div>
          ) : (
            <>
              <div>
                Подтверждаете участие в <b>{confirmedCount}</b> проект(ах) из системы
                {manualAnswers.length > 0 && <> и добавляете <b>{manualAnswers.length}</b> новых</>}
                . Всего <b>{totalToSubmit}</b> проект(ов).
              </div>
              {manualHoursTotal > 0 && (
                <div className="text-muted-foreground">
                  В таймщиты добавится <b className="text-foreground">{manualHoursTotal}</b> ч. по добавленным вручную.
                </div>
              )}
              <div className="text-muted-foreground">
                После отправки данные сразу увидит зам.директор и сможет их утвердить.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={busy} className="shadow-xl px-8">
          <Send className="w-4 h-4 mr-2" />
          {isSubmitted ? 'Сохранить изменения' : `Отправить (${totalToSubmit})`}
        </Button>
      </div>
    </div>
  );
}
