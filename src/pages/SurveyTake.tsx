import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import {
  audienceMatches,
  getCampaign,
  getSubmissionForUser,
  saveSubmission,
  submitSubmission,
  type Campaign,
  type Submission,
  type SubmissionItem,
} from '@/lib/surveyEngine';
import { QuestionField, QuestionLabel } from '@/components/surveys/QuestionField';
import { ArrowLeft, CheckCircle2, Plus, Save, Search, Send, Trash2, X } from 'lucide-react';

export default function SurveyTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { employees } = useEmployees();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!id || !user) return;
      const c = await getCampaign(id);
      setCampaign(c);
      if (c) {
        const existing = await getSubmissionForUser(c.id, user.id);
        if (existing) {
          setSubmission(existing);
        } else {
          // черновик-болванка
          const items: SubmissionItem[] =
            c.scope === 'my_projects'
              ? projects
                  .filter((p: any) => {
                    const team = p.team || p.notes?.team || [];
                    return Array.isArray(team) && team.some((m: any) => m?.userId === user.id);
                  })
                  .map((p) => ({ projectId: p.id, projectName: p.name, values: {} }))
              : c.scope === 'general'
                ? [{ values: {} }]
                : [];
          setSubmission({
            id: '',
            campaignId: c.id,
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            status: 'draft',
            items,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, projects.length]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const addedIds = useMemo(
    () => new Set((submission?.items || []).map((i) => i.projectId).filter(Boolean) as string[]),
    [submission],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return projects
      .filter((p) => {
        if (addedIds.has(p.id)) return false;
        const name = (p.name || '').toLowerCase();
        const client = ((p as any).clientName || (p as any).client?.name || '').toLowerCase();
        return name.includes(q) || client.includes(q);
      })
      .slice(0, 12);
  }, [projects, query, addedIds]);

  if (!user) return null;
  if (loading) return <div className="p-6 text-muted-foreground">Загрузка…</div>;
  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Опрос не найден</CardTitle>
        </CardHeader>
      </Card>
    );
  }
  if (campaign.status !== 'active' && submission?.status !== 'submitted') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Опрос недоступен</CardTitle>
          <CardDescription>
            Кампания не запущена. Обратитесь к организатору опроса.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/my-surveys">
              <ArrowLeft className="w-4 h-4 mr-2" /> Мои опросы
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!audienceMatches(campaign.audience, user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Этот опрос не для вашей роли</CardTitle>
          <CardDescription>
            Кампания запущена для других сотрудников. Если считаете это ошибкой — сообщите
            организатору.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!submission) return null;

  const patchItem = (idx: number, p: Partial<SubmissionItem>) => {
    setSubmission((s) => {
      if (!s) return s;
      const items = [...s.items];
      items[idx] = { ...items[idx], ...p };
      return { ...s, items };
    });
  };

  const patchValue = (idx: number, qid: string, value: any) => {
    setSubmission((s) => {
      if (!s) return s;
      const items = [...s.items];
      const cur = items[idx] || { values: {} };
      items[idx] = { ...cur, values: { ...cur.values, [qid]: value } };
      return { ...s, items };
    });
  };

  const addProject = (project: { id: string; name: string }) => {
    if (addedIds.has(project.id)) return;
    setSubmission((s) =>
      s
        ? {
            ...s,
            items: [{ projectId: project.id, projectName: project.name, values: {} }, ...s.items],
          }
        : s,
    );
    setQuery('');
    setShowSuggest(false);
  };

  const removeItem = (idx: number) => {
    setSubmission((s) => (s ? { ...s, items: s.items.filter((_, i) => i !== idx) } : s));
  };

  const handleSave = async () => {
    if (!submission) return;
    setBusy(true);
    try {
      const next = await saveSubmission(submission);
      setSubmission(next);
      toast({ title: 'Черновик сохранён' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!submission) return;
    if (campaign.scope !== 'general' && submission.items.length === 0) {
      const ok = window.confirm(
        'Вы не добавили ни одного проекта. Отправить ответ как «у меня нет таких проектов»?',
      );
      if (!ok) return;
    }
    // обязательные поля
    const missing: string[] = [];
    for (const item of submission.items) {
      for (const q of campaign.questions) {
        if (q.required) {
          const v = item.values?.[q.id];
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
            missing.push(`${item.projectName || 'опрос'} — ${q.label}`);
          }
        }
      }
    }
    if (missing.length > 0) {
      const ok = window.confirm(
        `Не заполнено обязательных полей: ${missing.length}. Всё равно отправить?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const next = await submitSubmission(submission);
      setSubmission(next);
      toast({
        title: 'Опрос отправлен',
        description: 'Спасибо! Зам.директор увидит ваши ответы в предложениях.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/my-surveys">
            <ArrowLeft className="w-4 h-4 mr-1" /> Мои опросы
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{campaign.title}</CardTitle>
              {campaign.description && (
                <CardDescription className="mt-2">{campaign.description}</CardDescription>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {submission.status === 'submitted' ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Отправлено
                </Badge>
              ) : (
                <Badge variant="secondary">Черновик</Badge>
              )}
              {campaign.deadline && (
                <span className="text-xs text-muted-foreground">
                  Срок: {new Date(campaign.deadline).toLocaleDateString('ru')}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        {campaign.scope === 'project_picker' && (
          <CardContent>
            <div ref={boxRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggest(true);
                  }}
                  onFocus={() => setShowSuggest(true)}
                  placeholder="Найти проект — печатайте 2-3 буквы…"
                  className="pl-9 h-11"
                  disabled={projectsLoading}
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
                      Ничего не нашлось. Попробуйте другие буквы.
                    </div>
                  ) : (
                    suggestions.map((p) => {
                      const client =
                        (p as any).clientName || (p as any).client?.name || '';
                      return (
                        <button
                          key={p.id}
                          onClick={() => addProject({ id: p.id, name: p.name })}
                          className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 flex items-start gap-2"
                        >
                          <Plus className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            {client && (
                              <div className="text-xs text-muted-foreground truncate">
                                Клиент: {client}
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
          </CardContent>
        )}
      </Card>

      {campaign.scope === 'general' ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            {campaign.questions.map((q) => (
              <div key={q.id} className="space-y-1">
                <QuestionLabel q={q} />
                <QuestionField
                  question={q}
                  value={submission.items[0]?.values?.[q.id]}
                  onChange={(v) => patchValue(0, q.id, v)}
                  employees={employees}
                />
              </div>
            ))}
            {submission.items.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubmission((s) => (s ? { ...s, items: [{ values: {} }] } : s))}
              >
                Начать
              </Button>
            )}
          </CardContent>
        </Card>
      ) : submission.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {campaign.scope === 'my_projects'
              ? 'У вас нет проектов в команде. Если это ошибка — обратитесь к зам.директору.'
              : 'Пока пусто. Найдите и добавьте сверху ваш проект.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {submission.items.map((item, idx) => (
            <Card key={item.projectId || idx}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{item.projectName || '(без проекта)'}</div>
                  {campaign.scope === 'project_picker' && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} title="Убрать">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {campaign.questions.map((q) => (
                    <div key={q.id} className="space-y-1">
                      <QuestionLabel q={q} />
                      <QuestionField
                        question={q}
                        value={item.values?.[q.id]}
                        onChange={(v) => patchValue(idx, q.id, v)}
                        employees={employees}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleSave} disabled={busy}>
          <Save className="w-4 h-4 mr-2" /> Черновик
        </Button>
        <Button onClick={handleSubmit} disabled={busy}>
          <Send className="w-4 h-4 mr-2" /> Отправить
        </Button>
      </div>
    </div>
  );
}
