import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  audienceLabel,
  campaignFromTemplate,
  deleteCampaign,
  listCampaigns,
  listSubmissions,
  saveCampaign,
  type Campaign,
  type Submission,
} from '@/lib/surveyEngine';
import {
  ClipboardList,
  Play,
  Square,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

const STATUS_BADGE: Record<Campaign['status'], { label: string; tone: string }> = {
  draft:  { label: 'Черновик', tone: 'bg-slate-100 text-slate-700' },
  active: { label: 'Идёт',     tone: 'bg-green-100 text-green-700' },
  closed: { label: 'Закрыт',   tone: 'bg-zinc-100 text-zinc-700' },
};

const TEMPLATE_HINT: Record<NonNullable<Campaign['template']>, string> = {
  where_worked:   'Сотрудники находят свои проекты и указывают роль, год, статус.',
  project_status: 'Партнёры/PM указывают % готовности и реальный статус по своим проектам.',
  confirm_team:   'Партнёры подтверждают состав команды на своих проектах.',
  custom:         'Пустая кампания — добавьте вопросы вручную.',
};

export default function SurveyCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);

  const reload = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([listCampaigns(), listSubmissions()]);
    setCampaigns(c);
    setSubs(s);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  if (!user) return null;
  const isPrivileged = ['deputy_director', 'ceo', 'admin', 'partner'].includes(user.role);
  if (!isPrivileged) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            Управление опросами доступно только зам.директору, CEO, партнёру и администратору.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const create = async (template: NonNullable<Campaign['template']>) => {
    const c = campaignFromTemplate(template, { id: user.id, name: user.name });
    await saveCampaign(c);
    toast({ title: 'Создана кампания', description: c.title });
    await reload();
  };

  const toggleStatus = async (c: Campaign) => {
    const next: Campaign =
      c.status === 'active'
        ? { ...c, status: 'closed', closedAt: new Date().toISOString() }
        : { ...c, status: 'active', startedAt: c.startedAt || new Date().toISOString() };
    await saveCampaign(next);
    toast({
      title: next.status === 'active' ? 'Опрос запущен' : 'Опрос закрыт',
      description: c.title,
    });
    await reload();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await deleteCampaign(confirmDelete.id);
    toast({ title: 'Кампания удалена' });
    setConfirmDelete(null);
    await reload();
  };

  const submittedByCampaign = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subs) {
      if (s.status !== 'submitted') continue;
      m.set(s.campaignId, (m.get(s.campaignId) || 0) + 1);
    }
    return m;
  }, [subs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Опросы
          </CardTitle>
          <CardDescription>
            Запускайте опросы по сотрудникам и собирайте данные о проектах. Каждая кампания
            формирует факты, которые автоматически складываются в предложения по проектам — вы их
            утверждаете на странице «Предложения по проектам».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => create('where_worked')}>
              <Plus className="w-4 h-4 mr-2" /> «Где работал»
            </Button>
            <Button onClick={() => create('project_status')} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> «Статус моих проектов»
            </Button>
            <Button onClick={() => create('confirm_team')} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> «Подтверди команду»
            </Button>
            <Button onClick={() => create('custom')} variant="ghost">
              <Plus className="w-4 h-4 mr-2" /> Пустая
            </Button>
            <Button asChild variant="secondary" className="ml-auto">
              <Link to="/survey-approval">
                <Sparkles className="w-4 h-4 mr-2" /> Предложения по проектам
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Пока нет ни одной кампании. Создайте из шаблона сверху.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const submittedCount = submittedByCampaign.get(c.id) || 0;
            const tone = STATUS_BADGE[c.status];
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <Link to={`/surveys/${c.id}`} className="font-semibold hover:underline">
                          {c.title || 'Без названия'}
                        </Link>
                        <Badge className={tone.tone + ' hover:' + tone.tone}>{tone.label}</Badge>
                        {c.template && c.template !== 'custom' && (
                          <Badge variant="outline" className="text-xs">
                            шаблон: {c.template}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.description?.slice(0, 140) || (c.template ? TEMPLATE_HINT[c.template] : '')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                        <span>{c.questions.length} вопрос(ов)</span>
                        <span>{audienceLabel(c.audience)}</span>
                        <span>Отправили: <b className="text-foreground">{submittedCount}</b></span>
                        {c.deadline && (
                          <span>Срок: {new Date(c.deadline).toLocaleDateString('ru')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={c.status === 'active' ? 'outline' : 'default'}
                        onClick={() => toggleStatus(c)}
                      >
                        {c.status === 'active' ? (
                          <>
                            <Square className="w-4 h-4 mr-1" /> Закрыть
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" /> Запустить
                          </>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/surveys/${c.id}`}>
                          <Pencil className="w-4 h-4 mr-1" /> Редактировать
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">…</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem asChild>
                            <Link to={`/surveys/${c.id}/results`}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Результаты
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirmDelete(c)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить кампанию?</AlertDialogTitle>
            <AlertDialogDescription>
              Все ответы по этой кампании будут удалены. Утверждённые ранее изменения в карточках
              проектов останутся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
