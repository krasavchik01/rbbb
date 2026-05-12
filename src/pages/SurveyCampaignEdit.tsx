import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  type Campaign,
  type CampaignAudience,
  type CampaignScope,
  type Question,
  type QuestionType,
  getCampaign,
  saveCampaign,
} from '@/lib/surveyEngine';
import { ROLE_LABELS, UserRole } from '@/types/roles';
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, Save, Play } from 'lucide-react';

const QUESTION_TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'role',         label: 'Роль на проекте',  hint: 'Селект из ролей системы' },
  { value: 'year',         label: 'Год работы',       hint: 'Кнопки годов или дата' },
  { value: 'status_vote',  label: 'Статус проекта',   hint: 'Идёт / завершён / отменён' },
  { value: 'percent',      label: 'Процент готовности', hint: '0–100' },
  { value: 'employees',    label: 'Команда',          hint: 'Мультивыбор сотрудников' },
  { value: 'text',         label: 'Текст',            hint: 'Свободный комментарий' },
  { value: 'choice',       label: 'Один из вариантов', hint: 'Radio с вашими опциями' },
  { value: 'date',         label: 'Дата',             hint: 'Календарь' },
];

const SCOPE_OPTIONS: { value: CampaignScope; label: string; hint: string }[] = [
  {
    value: 'project_picker',
    label: 'По проектам (пользователь добавляет сам)',
    hint: 'Сотрудник через поиск добавляет проекты, на которые отвечает',
  },
  {
    value: 'my_projects',
    label: 'По моим проектам (автоматически)',
    hint: 'Система подставит проекты пользователя из текущих команд',
  },
  {
    value: 'general',
    label: 'Общий опрос (без привязки к проекту)',
    hint: 'Один набор вопросов без проектов',
  },
];

const ALL_ROLES: UserRole[] = Object.keys(ROLE_LABELS) as UserRole[];

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 8);
  return `q_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurveyCampaignEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const c = await getCampaign(id);
      setCampaign(c);
      setLoading(false);
    })();
  }, [id]);

  if (!user) return null;

  if (loading) return <div className="p-6 text-muted-foreground">Загрузка…</div>;
  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Кампания не найдена</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/surveys">
              <ArrowLeft className="w-4 h-4 mr-2" /> К списку кампаний
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const patch = (p: Partial<Campaign>) => setCampaign((c) => (c ? { ...c, ...p } : c));

  const addQuestion = (type: QuestionType) => {
    const q: Question = {
      id: rid(),
      type,
      label: QUESTION_TYPES.find((qt) => qt.value === type)?.label || type,
      required: false,
    };
    patch({ questions: [...campaign.questions, q] });
  };

  const updateQuestion = (qid: string, p: Partial<Question>) => {
    patch({ questions: campaign.questions.map((q) => (q.id === qid ? { ...q, ...p } : q)) });
  };

  const removeQuestion = (qid: string) => {
    patch({ questions: campaign.questions.filter((q) => q.id !== qid) });
  };

  const moveQuestion = (qid: string, dir: -1 | 1) => {
    const qs = [...campaign.questions];
    const idx = qs.findIndex((q) => q.id === qid);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= qs.length) return;
    [qs[idx], qs[newIdx]] = [qs[newIdx], qs[idx]];
    patch({ questions: qs });
  };

  const save = async (statusOverride?: Campaign['status']) => {
    setBusy(true);
    try {
      const next: Campaign = {
        ...campaign,
        status: statusOverride ?? campaign.status,
        startedAt:
          statusOverride === 'active' && !campaign.startedAt
            ? new Date().toISOString()
            : campaign.startedAt,
      };
      await saveCampaign(next);
      setCampaign(next);
      toast({
        title:
          statusOverride === 'active'
            ? 'Кампания запущена'
            : statusOverride === 'closed'
              ? 'Кампания закрыта'
              : 'Сохранено',
      });
    } finally {
      setBusy(false);
    }
  };

  const audienceMode = campaign.audience.mode;
  const audienceRoles = audienceMode === 'roles' ? campaign.audience.roles : [];

  const setAudience = (a: CampaignAudience) => patch({ audience: a });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/surveys">
            <ArrowLeft className="w-4 h-4 mr-1" /> К списку
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save()} disabled={busy}>
            <Save className="w-4 h-4 mr-2" /> Сохранить
          </Button>
          {campaign.status !== 'active' && (
            <Button onClick={() => save('active')} disabled={busy}>
              <Play className="w-4 h-4 mr-2" /> Сохранить и запустить
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры кампании</CardTitle>
          <CardDescription>
            Что увидят сотрудники в опросе и кому он будет доступен.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Название</Label>
            <Input value={campaign.title} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Описание (видят сотрудники)</Label>
            <Textarea
              value={campaign.description || ''}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Как идёт опрос?</Label>
              <Select
                value={campaign.scope}
                onValueChange={(v) => patch({ scope: v as CampaignScope })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div>
                        <div className="font-medium">{o.label}</div>
                        <div className="text-xs text-muted-foreground">{o.hint}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Срок прохождения</Label>
              <Input
                type="date"
                value={campaign.deadline?.slice(0, 10) || ''}
                onChange={(e) =>
                  patch({ deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Аудитория</Label>
            <div className="space-y-2">
              <Select
                value={audienceMode}
                onValueChange={(v) => {
                  if (v === 'all') setAudience({ mode: 'all' });
                  else if (v === 'roles') setAudience({ mode: 'roles', roles: audienceRoles });
                  else if (v === 'users') setAudience({ mode: 'users', userIds: [] });
                }}
              >
                <SelectTrigger className="w-full sm:w-1/2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сотрудники</SelectItem>
                  <SelectItem value="roles">По ролям</SelectItem>
                  <SelectItem value="users" disabled>
                    По отдельным сотрудникам (скоро)
                  </SelectItem>
                </SelectContent>
              </Select>

              {audienceMode === 'roles' && (
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((r) => {
                    const checked = audienceRoles.includes(r);
                    return (
                      <label
                        key={r}
                        className={
                          'text-xs px-2 py-1 rounded-md border cursor-pointer flex items-center gap-1 ' +
                          (checked ? 'bg-primary/10 border-primary' : 'hover:bg-accent')
                        }
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const set = new Set(audienceRoles);
                            if (v) set.add(r);
                            else set.delete(r);
                            setAudience({ mode: 'roles', roles: Array.from(set) });
                          }}
                        />
                        {ROLE_LABELS[r]}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Switch
              checked={campaign.status === 'active'}
              onCheckedChange={(v) => save(v ? 'active' : 'draft')}
              disabled={busy}
            />
            <Label className="text-sm">
              {campaign.status === 'active' ? 'Опрос идёт — сотрудники видят его' : 'Опрос остановлен'}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Вопросы ({campaign.questions.length})</CardTitle>
          <CardDescription>
            {campaign.scope === 'general'
              ? 'Будут заданы один раз каждому сотруднику.'
              : 'Будут заданы для каждого проекта, который пользователь укажет.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <Button
                key={t.value}
                variant="outline"
                size="sm"
                onClick={() => addQuestion(t.value)}
                title={t.hint}
              >
                <Plus className="w-3 h-3 mr-1" /> {t.label}
              </Button>
            ))}
          </div>

          {campaign.questions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
              Вопросов пока нет. Добавьте сверху.
            </div>
          ) : (
            <div className="space-y-2">
              {campaign.questions.map((q, idx) => {
                const typeMeta = QUESTION_TYPES.find((qt) => qt.value === q.type);
                return (
                  <div key={q.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="text-xs text-muted-foreground pt-2 w-6">{idx + 1}.</div>
                      <div className="flex-1 grid sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <Input
                            value={q.label}
                            onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                            placeholder="Текст вопроса"
                          />
                        </div>
                        <div>
                          <Badge variant="outline" className="text-xs">{typeMeta?.label || q.type}</Badge>
                        </div>
                        <div className="sm:col-span-2">
                          <Input
                            value={q.hint || ''}
                            onChange={(e) => updateQuestion(q.id, { hint: e.target.value })}
                            placeholder="Подсказка (необязательно)"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={!!q.required}
                            onCheckedChange={(v) => updateQuestion(q.id, { required: !!v })}
                          />
                          Обязательный
                        </label>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" onClick={() => moveQuestion(q.id, -1)} disabled={idx === 0}>
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveQuestion(q.id, 1)}
                          disabled={idx === campaign.questions.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {q.type === 'choice' && (
                      <div className="pl-8 space-y-1">
                        <Label className="text-xs">Варианты ответа (по одному в строке)</Label>
                        <Textarea
                          value={(q.options || []).map((o) => o.label).join('\n')}
                          onChange={(e) => {
                            const lines = e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            updateQuestion(q.id, {
                              options: lines.map((l, i) => ({ value: `opt_${i}`, label: l })),
                            });
                          }}
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => save()} disabled={busy}>
          <Save className="w-4 h-4 mr-2" /> Сохранить
        </Button>
        {campaign.status !== 'active' ? (
          <Button onClick={() => save('active')} disabled={busy}>
            <Play className="w-4 h-4 mr-2" /> Сохранить и запустить
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate(`/surveys/${campaign.id}/results`)}>
            К результатам →
          </Button>
        )}
      </div>
    </div>
  );
}
