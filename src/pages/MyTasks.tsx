import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listMyTasks, listAllTasks, updateTaskStatus, type AiTask } from '@/lib/aiTasks';
import {
  CheckCircle2, Clock, XCircle, AlertCircle, Play, ListChecks, Loader2, RefreshCw, Bot,
} from 'lucide-react';

const PRIORITY_TONE: Record<AiTask['priority'], string> = {
  low:    'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high:   'bg-amber-100 text-amber-700 border-amber-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_TONE: Record<AiTask['status'], { tone: string; label: string; icon: any }> = {
  pending:     { tone: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Ждёт',        icon: AlertCircle },
  in_progress: { tone: 'bg-blue-100 text-blue-700 border-blue-200',    label: 'В работе',    icon: Play },
  done:        { tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Готово', icon: CheckCircle2 },
  cancelled:   { tone: 'bg-red-100 text-red-700 border-red-200',       label: 'Отменена',    icon: XCircle },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function relativeDue(iso: string | null): { text: string; tone: string } | null {
  if (!iso) return null;
  const due = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.round((due - now) / 86_400_000);
  if (days < 0) return { text: `просрочено на ${-days} дн.`, tone: 'text-red-600 font-medium' };
  if (days === 0) return { text: 'сегодня', tone: 'text-amber-600 font-medium' };
  if (days <= 3) return { text: `через ${days} дн.`, tone: 'text-amber-600' };
  return { text: `до ${formatDate(iso)}`, tone: 'text-muted-foreground' };
}

export default function MyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isPrivileged = user && ['ceo', 'deputy_director', 'partner', 'hr', 'admin'].includes(user.role);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = tab === 'all' && isPrivileged ? await listAllTasks() : await listMyTasks(user.id);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [user, tab, isPrivileged]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling каждые 60 секунд — простая замена Realtime для MVP
  useEffect(() => {
    if (!user) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user, load]);

  if (!user) return <div className="p-6 text-muted-foreground">Войдите.</div>;

  const handleChangeStatus = async (task: AiTask, next: AiTask['status']) => {
    setBusyId(task.id);
    try {
      const updated = await updateTaskStatus(task.id, next);
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        toast({ title: 'Статус обновлён', description: STATUS_TONE[next].label });
      } else {
        toast({ title: 'Не удалось обновить', variant: 'destructive' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
    for (const t of tasks) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [tasks]);

  // Сортировка: pending+in_progress первыми, потом по приоритету, потом по дедлайну
  const sorted = useMemo(() => {
    const order = { pending: 0, in_progress: 1, done: 2, cancelled: 3 };
    const prio = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...tasks].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority];
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
  }, [tasks]);

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-primary" />
            Мои задачи от AI
          </CardTitle>
          <CardDescription>
            Задачи, созданные через AI-ассистента «RB». Поменяй статус, когда начнёшь или закончишь.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'mine' | 'all')}>
            <TabsList>
              <TabsTrigger value="mine">Мои</TabsTrigger>
              {isPrivileged && <TabsTrigger value="all">Все (админ)</TabsTrigger>}
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
          <div className="ml-auto flex gap-2 text-xs">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">⏳ {counts.pending} ждёт</Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">▶ {counts.in_progress} в работе</Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">✓ {counts.done}</Badge>
          </div>
        </CardContent>
      </Card>

      {loading && tasks.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Загружаем…
          </CardContent>
        </Card>
      )}

      {!loading && sorted.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            <Bot className="w-6 h-6 mx-auto mb-2 opacity-50" />
            {tab === 'mine' ? 'У тебя пока нет задач от AI.' : 'Задач от AI пока нет.'}
          </CardContent>
        </Card>
      )}

      {sorted.map((task) => {
        const status = STATUS_TONE[task.status];
        const StatusIcon = status.icon;
        const due = relativeDue(task.due_date);
        return (
          <Card key={task.id} className={task.status === 'done' || task.status === 'cancelled' ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {task.title}
                    <Badge variant="outline" className={`text-xs ${PRIORITY_TONE[task.priority]}`}>
                      {task.priority}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${status.tone}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span>от: <b className="text-foreground">{task.created_by_name || task.created_by}</b></span>
                    {tab === 'all' && (
                      <span>кому: <b className="text-foreground">{task.assigned_to_name || task.assigned_to}</b></span>
                    )}
                    <span><Clock className="w-3 h-3 inline mr-1" /> {formatDate(task.created_at)}</span>
                    {due && <span className={due.tone}>дедлайн: {due.text}</span>}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {task.description && (
              <CardContent className="pt-0">
                <div className="text-sm text-foreground/80 whitespace-pre-wrap">{task.description}</div>
              </CardContent>
            )}
            {(task.status === 'pending' || task.status === 'in_progress') && (
              <CardContent className="pt-0 pb-3 flex flex-wrap gap-2">
                {task.status === 'pending' && (
                  <Button size="sm" variant="outline" disabled={busyId === task.id} onClick={() => handleChangeStatus(task, 'in_progress')}>
                    <Play className="w-3 h-3 mr-1" /> Взять в работу
                  </Button>
                )}
                <Button size="sm" disabled={busyId === task.id} onClick={() => handleChangeStatus(task, 'done')}>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Готово
                </Button>
                <Button size="sm" variant="ghost" disabled={busyId === task.id} onClick={() => handleChangeStatus(task, 'cancelled')}>
                  <XCircle className="w-3 h-3 mr-1" /> Отменить
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
