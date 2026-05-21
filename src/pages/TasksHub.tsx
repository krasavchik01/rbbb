/**
 * Единая страница «Задачи» с табами:
 *   - «Все»     — обычные задачи системы (старый компонент Tasks)
 *   - «Мои»     — мои AI-задачи (новый компонент MyTasks)
 *   - «От AI»   — только задачи, созданные через AI-чат (создаются админами)
 *
 * Цель — собрать всё «что мне нужно сделать» в одно место вместо двух пунктов
 * sidebar. См. user-feedback session 2026-05-21.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { countPendingForUser } from '@/lib/aiTasks';
import Tasks from '@/pages/Tasks';
import MyTasks from '@/pages/MyTasks';

const TAB_KEYS = ['all', 'mine'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function TasksHub() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as TabKey) || 'mine';
  const [tab, setTab] = useState<TabKey>(TAB_KEYS.includes(initial) ? initial : 'mine');
  const [aiPending, setAiPending] = useState(0);

  useEffect(() => {
    if (!user) return;
    const tick = () => countPendingForUser(user.id).then(setAiPending).catch(() => {});
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (tab !== params.get('tab')) {
      const next = new URLSearchParams(params);
      next.set('tab', tab);
      setParams(next, { replace: true });
    }
  }, [tab]);

  if (!user) return <div className="p-6 text-muted-foreground">Войдите.</div>;

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" /> Задачи
          </CardTitle>
          <CardDescription>
            Всё что мне нужно сделать — в одном месте. От AI, от руководителей, от меня самого.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="mine" className="gap-2">
                <User className="w-3 h-3" /> Мои AI-задачи
                {aiPending > 0 && <Badge variant="destructive" className="ml-1 text-xs h-5 px-1.5">{aiPending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <CheckSquare className="w-3 h-3" /> Все задачи системы
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mine" className="mt-4">
              <MyTasks />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <Tasks />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
