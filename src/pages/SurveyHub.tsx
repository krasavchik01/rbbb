/**
 * Единая страница «Опрос и команды» с табами:
 *   - «Заполнить опрос»  — форма опроса для текущего сотрудника (ProjectSurvey)
 *   - «Результаты»       — все ответы сотрудников (ProjectSurveyResults) — privileged
 *   - «Импорт таймщитов» — bulk-импорт XLSX (ImportTimesheet) — privileged
 *
 * Один URL `/survey`, табы через ?tab=fill|results|import.
 * Старые URL /project-survey, /project-survey-results, /import-timesheet
 * перенаправляют сюда с подставленным табом.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClipboardCheck, BarChart3, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ProjectSurvey from '@/pages/ProjectSurvey';
// ImportTimesheet тянет xlsx (~425 KB) — грузим только при открытии таба «Импорт».
const ImportTimesheet = lazy(() => import('@/pages/ImportTimesheet'));
const ProjectSurveyResults = lazy(() => import('@/pages/ProjectSurveyResults'));

const TAB_KEYS = ['fill', 'results', 'import'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function SurveyHub() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as TabKey) || 'fill';
  const [tab, setTab] = useState<TabKey>(TAB_KEYS.includes(initial) ? initial : 'fill');

  const isPrivileged = user && ['ceo', 'deputy_director', 'admin', 'partner', 'hr'].includes(user.role);

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
            <ClipboardCheck className="w-6 h-6 text-primary" /> Опрос и команды
          </CardTitle>
          <CardDescription>
            Опрос «кто в каком проекте», результаты по сотрудникам и bulk-импорт таймщитов — в одном месте.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="fill" className="gap-2">
                <ClipboardCheck className="w-3 h-3" /> Заполнить опрос
              </TabsTrigger>
              {isPrivileged && (
                <TabsTrigger value="results" className="gap-2">
                  <BarChart3 className="w-3 h-3" /> Результаты
                </TabsTrigger>
              )}
              {isPrivileged && (
                <TabsTrigger value="import" className="gap-2">
                  <FileSpreadsheet className="w-3 h-3" /> Импорт таймщитов
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="fill" className="mt-4">
              <ProjectSurvey />
            </TabsContent>
            {isPrivileged && (
              <TabsContent value="results" className="mt-4">
                <Suspense fallback={<div className="p-6 text-muted-foreground">Загрузка результатов…</div>}>
                  <ProjectSurveyResults />
                </Suspense>
              </TabsContent>
            )}
            {isPrivileged && (
              <TabsContent value="import" className="mt-4">
                <Suspense fallback={<div className="p-6 text-muted-foreground">Загрузка импорта…</div>}>
                  <ImportTimesheet />
                </Suspense>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
