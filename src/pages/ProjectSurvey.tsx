import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useSupabaseData';
import {
  getResponseForUser,
  getSurveyConfig,
  saveResponse,
  submitResponse,
  type SurveyConfig,
  type SurveyProjectAnswer,
  type SurveyProjectStatusVote,
  type SurveyResponse,
} from '@/lib/projectSurvey';
import { PROJECT_ROLES, ROLE_LABELS, UserRole } from '@/types/roles';
import { CheckCircle2, ClipboardList, Save, Send, Search, X, Plus, Trash2 } from 'lucide-react';

const STATUS_OPTIONS: { value: SurveyProjectStatusVote; label: string }[] = [
  { value: 'in_progress', label: 'Ещё в работе' },
  { value: 'completed',   label: 'Фактически завершён' },
  { value: 'cancelled',   label: 'Отменён / отказ' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_QUICK = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

function newAnswer(projectId: string, projectName: string): SurveyProjectAnswer {
  return {
    projectId,
    projectName,
    participated: true,
    statusVote: 'in_progress',
  };
}

export default function ProjectSurvey() {
  const { user } = useAuth();
  const { projects, loading } = useProjects();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [existingResponse, setExistingResponse] = useState<SurveyResponse | null>(null);
  const [myAnswers, setMyAnswers] = useState<SurveyProjectAnswer[]>([]);
  const [busy, setBusy] = useState(false);

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
      if (existing) {
        setExistingResponse(existing);
        setMyAnswers(existing.answers);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // Закрывать выпадашку при клике вне
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const alreadyAddedIds = useMemo(() => new Set(myAnswers.map((a) => a.projectId)), [myAnswers]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return projects
      .filter((p) => {
        if (alreadyAddedIds.has(p.id)) return false;
        const name = (p.name || '').toLowerCase();
        const client = ((p as any).clientName || (p as any).client?.name || '').toLowerCase();
        return name.includes(q) || client.includes(q);
      })
      .slice(0, 12);
  }, [projects, query, alreadyAddedIds]);

  const addProject = (project: { id: string; name: string }) => {
    if (alreadyAddedIds.has(project.id)) return;
    setMyAnswers((prev) => [newAnswer(project.id, project.name), ...prev]);
    setQuery('');
    setShowSuggest(false);
  };

  const updateAnswer = (projectId: string, patch: Partial<SurveyProjectAnswer>) => {
    setMyAnswers((prev) => prev.map((a) => (a.projectId === projectId ? { ...a, ...patch } : a)));
  };

  const removeAnswer = (projectId: string) => {
    setMyAnswers((prev) => prev.filter((a) => a.projectId !== projectId));
  };

  const applyYear = (projectId: string, year: number) => {
    updateAnswer(projectId, {
      periodFrom: `${year}-01-01`,
      periodTo: `${year}-12-31`,
    });
  };

  const buildResponse = (status: 'draft' | 'submitted'): SurveyResponse => {
    return {
      id: existingResponse?.id || `srv_${user!.id}_${Date.now()}`,
      userId: user!.id,
      userName: user!.name,
      userRole: user!.role,
      answers: myAnswers.map((a) => ({ ...a, participated: true })),
      status,
      updatedAt: new Date().toISOString(),
      submittedAt: existingResponse?.submittedAt,
    };
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const next = await saveResponse(buildResponse('draft'));
      setExistingResponse(next);
      toast({ title: 'Черновик сохранён', description: 'Можно вернуться и дополнить позже.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (myAnswers.length === 0) {
      const ok = window.confirm(
        'Вы не добавили ни одного проекта. Отправить ответ как «я не участвовал ни в одном проекте»?',
      );
      if (!ok) return;
    }
    // Валидация — нужны роль и год хотя бы
    const missing = myAnswers.filter((a) => !a.roleOnProject || !a.periodFrom);
    if (missing.length > 0) {
      const ok = window.confirm(
        `У ${missing.length} проектов не указаны роль или период. Всё равно отправить?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const next = await submitResponse(buildResponse('submitted'));
      setExistingResponse(next);
      toast({
        title: 'Спасибо!',
        description: 'Ответ отправлен. Система передаст его зам.директору на утверждение.',
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
            Опрос по участию в проектах сейчас не запущен. Обратитесь к заместителю директора, если
            считаете, что должны были его пройти.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate('/')}>На дашборд</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> {config.title}
              </CardTitle>
              <CardDescription className="mt-2">
                Вспомните по памяти проекты, в которых вы участвовали. Начните печатать название
                клиента или проекта — система найдёт его в базе. Не нужно листать сотни проектов.
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {existingResponse?.status === 'submitted' ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Отправлено
                </Badge>
              ) : existingResponse?.status === 'draft' ? (
                <Badge variant="secondary">Черновик</Badge>
              ) : null}
              {config.deadline && (
                <span className="text-xs text-muted-foreground">
                  Срок: {new Date(config.deadline).toLocaleDateString('ru')}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Label className="text-sm font-medium mb-2 block">
            Найти и добавить проект
          </Label>
          <div ref={searchBoxRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggest(true);
                }}
                onFocus={() => setShowSuggest(true)}
                placeholder="Начните печатать — например, «Рома», «КазМунай», «ТОО Свет»…"
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
                  <div className="p-3 text-sm text-muted-foreground">
                    Ничего не нашлось. Попробуйте другие буквы — название клиента или проекта.
                  </div>
                ) : (
                  suggestions.map((p) => {
                    const clientName = (p as any).clientName || (p as any).client?.name || '';
                    return (
                      <button
                        key={p.id}
                        onClick={() => addProject({ id: p.id, name: p.name })}
                        className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 flex items-start gap-2"
                      >
                        <Plus className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          {clientName && (
                            <div className="text-xs text-muted-foreground truncate">
                              Клиент: {clientName}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Подсказка: достаточно 2-3 первых букв. Можно искать по названию клиента.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Мои проекты ({myAnswers.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={busy}>
                <Save className="w-4 h-4 mr-1" /> Черновик
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={busy}>
                <Send className="w-4 h-4 mr-1" /> Отправить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {myAnswers.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Пока пусто. Найдите и добавьте сверху проект, в котором вы участвовали.
            </div>
          ) : (
            <div className="space-y-3">
              {myAnswers.map((a) => (
                <div key={a.projectId} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">{a.projectName}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAnswer(a.projectId)}
                      title="Убрать из моего списка"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Моя роль на проекте</Label>
                      <Select
                        value={a.roleOnProject || ''}
                        onValueChange={(v) =>
                          updateAnswer(a.projectId, { roleOnProject: v as UserRole })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите роль…" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_ROLES.map((r) => (
                            <SelectItem key={r.role} value={r.role}>
                              {ROLE_LABELS[r.role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Что с проектом сейчас?</Label>
                      <RadioGroup
                        value={a.statusVote}
                        onValueChange={(v) =>
                          updateAnswer(a.projectId, { statusVote: v as SurveyProjectStatusVote })
                        }
                        className="flex flex-wrap gap-2 mt-1"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-accent/40 text-xs"
                          >
                            <RadioGroupItem value={opt.value} />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">В каком году вы это сдавали?</Label>
                    <div className="flex flex-wrap gap-2 mt-1 items-center">
                      {YEAR_QUICK.map((y) => {
                        const active = a.periodFrom?.startsWith(String(y));
                        return (
                          <button
                            key={y}
                            onClick={() => applyYear(a.projectId, y)}
                            className={
                              'px-3 py-1.5 rounded-md border text-xs ' +
                              (active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:bg-accent')
                            }
                          >
                            {y}
                          </button>
                        );
                      })}
                      <span className="text-xs text-muted-foreground">или точные даты:</span>
                      <Input
                        type="date"
                        value={a.periodFrom || ''}
                        onChange={(e) => updateAnswer(a.projectId, { periodFrom: e.target.value })}
                        className="w-auto"
                      />
                      <span className="text-xs text-muted-foreground">—</span>
                      <Input
                        type="date"
                        value={a.periodTo || ''}
                        onChange={(e) => updateAnswer(a.projectId, { periodTo: e.target.value })}
                        className="w-auto"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Комментарий (необязательно)</Label>
                    <Textarea
                      value={a.comment || ''}
                      onChange={(e) => updateAnswer(a.projectId, { comment: e.target.value })}
                      placeholder="Например: подключился в августе, отчёт сдан, осталось подписание"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {myAnswers.length > 0 && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
            <Save className="w-4 h-4 mr-2" /> Сохранить черновик
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            <Send className="w-4 h-4 mr-2" /> Отправить опрос
          </Button>
        </div>
      )}
    </div>
  );
}
