import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  audienceMatches,
  listCampaigns,
  listSubmissions,
  type Campaign,
  type Submission,
} from '@/lib/surveyEngine';
import { ClipboardList, X } from 'lucide-react';

const DISMISS_KEY = 'rb_survey_banner_dismissed_until';

export function ProjectSurveyBanner() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() =>
    Number(localStorage.getItem(DISMISS_KEY) || '0'),
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [c, s] = await Promise.all([listCampaigns(), listSubmissions()]);
      if (!active) return;
      setCampaigns(c);
      setSubs(s);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;
  if (snoozedUntil > Date.now()) return null;

  const mineSubmitted = new Set(
    subs.filter((s) => s.userId === user.id && s.status === 'submitted').map((s) => s.campaignId),
  );

  const pending = campaigns.filter(
    (c) =>
      c.status === 'active' &&
      audienceMatches(c.audience, user) &&
      !mineSubmitted.has(c.id),
  );

  if (pending.length === 0) return null;

  const first = pending[0];
  const handleSnooze = () => {
    const until = Date.now() + 6 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setSnoozedUntil(until);
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex flex-wrap items-center gap-3">
      <ClipboardList className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <div className="text-sm font-semibold">
          {pending.length === 1
            ? `Заполните опрос: «${first.title}»`
            : `У вас ${pending.length} незакрытых опроса`}
        </div>
        <div className="text-xs text-muted-foreground">
          {first.description?.slice(0, 140) ||
            'Откройте «Мои опросы» и пройдите. Это не займёт много времени.'}
          {first.deadline && (
            <> · Срок: <b>{new Date(first.deadline).toLocaleDateString('ru')}</b></>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button asChild size="sm">
          <Link to={pending.length === 1 ? `/surveys/${first.id}/take` : '/my-surveys'}>
            {pending.length === 1 ? 'Пройти' : 'Открыть мои опросы'}
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={handleSnooze} title="Скрыть на 6 часов">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
