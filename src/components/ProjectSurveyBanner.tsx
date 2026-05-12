import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  getResponseForUser,
  getSurveyConfig,
  type SurveyConfig,
  type SurveyResponse,
} from '@/lib/projectSurvey';
import { ClipboardList, X } from 'lucide-react';

const DISMISS_KEY = 'rb_project_survey_banner_dismissed_until';

export function ProjectSurveyBanner() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [response, setResponse] = useState<SurveyResponse | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() =>
    Number(localStorage.getItem(DISMISS_KEY) || '0'),
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [cfg, resp] = await Promise.all([getSurveyConfig(), getResponseForUser(user.id)]);
      if (!active) return;
      setConfig(cfg);
      setResponse(resp);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || !config) return null;
  if (!config.enabled) return null;
  if (['deputy_director', 'ceo', 'admin'].includes(user.role)) return null;
  if (response?.status === 'submitted') return null;
  if (snoozedUntil > Date.now()) return null;

  const handleSnooze = () => {
    const until = Date.now() + 6 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setSnoozedUntil(until);
  };

  const hasDraft = response?.status === 'draft';

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex flex-wrap items-center gap-3">
      <ClipboardList className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <div className="text-sm font-semibold">
          {hasDraft
            ? 'Вы начали проходить опрос — завершите его'
            : 'Заполните, пожалуйста, опрос по проектам'}
        </div>
        <div className="text-xs text-muted-foreground">
          {config.description?.slice(0, 140) ||
            'Отметьте, в каких проектах вы участвовали, период и часы — это сразу попадёт в таймщиты.'}
          {config.deadline && (
            <> · Срок: <b>{new Date(config.deadline).toLocaleDateString('ru')}</b></>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button asChild size="sm">
          <Link to="/project-survey">{hasDraft ? 'Продолжить' : 'Пройти опрос'}</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={handleSnooze} title="Скрыть на 6 часов">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
