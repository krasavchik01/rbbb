import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  audienceMatches,
  listCampaigns,
  listSubmissions,
  type Campaign,
  type Submission,
} from '@/lib/surveyEngine';
import { CheckCircle2, ClipboardList } from 'lucide-react';

export default function MySurveys() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([listCampaigns(), listSubmissions()]);
      setCampaigns(c);
      setSubs(s);
      setLoading(false);
    })();
  }, []);

  if (!user) return null;

  const mySubs = new Map(subs.filter((s) => s.userId === user.id).map((s) => [s.campaignId, s]));
  const visible = campaigns.filter(
    (c) =>
      audienceMatches(c.audience, user) &&
      (c.status === 'active' || mySubs.get(c.id)?.status === 'submitted'),
  );

  const pending = visible.filter((c) => mySubs.get(c.id)?.status !== 'submitted');
  const done = visible.filter((c) => mySubs.get(c.id)?.status === 'submitted');

  if (loading) return <div className="p-6 text-muted-foreground">Загрузка…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Мои опросы
          </CardTitle>
          <CardDescription>
            Здесь все опросы, в которых вас просят поучаствовать.
          </CardDescription>
        </CardHeader>
      </Card>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Требуется ответ ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Сейчас нет открытых опросов для вас.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pending.map((c) => {
              const sub = mySubs.get(c.id);
              return (
                <Card key={c.id} className="hover:border-primary/40 transition">
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold">{c.title}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {c.description}
                        </div>
                      )}
                      {c.deadline && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Срок: {new Date(c.deadline).toLocaleDateString('ru')}
                        </div>
                      )}
                    </div>
                    {sub?.status === 'draft' && <Badge variant="secondary">Черновик</Badge>}
                    <Button asChild>
                      <Link to={`/surveys/${c.id}/take`}>
                        {sub ? 'Продолжить' : 'Пройти'}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Отправленные ({done.length})
          </h3>
          <div className="space-y-2">
            {done.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Отправлено
                  </Badge>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{c.title}</div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/surveys/${c.id}/take`}>Посмотреть</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
