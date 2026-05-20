import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects, useEmployees } from '@/hooks/useSupabaseData';
import {
  parseTimesheetFile,
  normalizeProjectName,
  type ParseResult,
  type EmployeeAggregate,
  type ProjectAggregate,
} from '@/lib/timesheetImport';
import {
  submitResponse,
  getAllResponses,
  type SurveyProjectAnswer,
  type SurveyResponse,
} from '@/lib/projectSurvey';
import { normalizeUserRole } from '@/types/roles';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User as UserIcon,
  FolderOpen,
  Clock,
  Calendar,
  Users,
  Sparkles,
} from 'lucide-react';

const SCORE_TONE: Record<ProjectAggregate['matchScore'], { tone: string; label: string; icon: any }> = {
  high:   { tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Найден точно',  icon: CheckCircle2 },
  medium: { tone: 'bg-amber-100 text-amber-700 border-amber-200',       label: 'Похож',          icon: AlertTriangle },
  none:   { tone: 'bg-red-100 text-red-700 border-red-200',             label: 'Не найден',      icon: XCircle },
};

export default function ImportTimesheet() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const { employees } = useEmployees();
  const { toast } = useToast();

  const [fileName, setFileName] = useState<string>('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [includeUnmatched, setIncludeUnmatched] = useState(false);
  // 0-часовые проекты — это календарные маркеры («начало аудита», «выпуск
  // письма»). По умолчанию не считаем их за участие, чтобы не зачислить
  // людей в команды проектов, по которым они реально не работали.
  const [includeZeroHours, setIncludeZeroHours] = useState(false);
  // userId → краткая сводка по уже существующему ответу (для бейджа «уже загружен»)
  const [existingResponses, setExistingResponses] = useState<
    Map<string, { hours: number; projects: number; updatedAt: string }>
  >(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectList = useMemo(
    () => (projects as any[]).map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );
  const employeeList = useMemo(
    () => (employees as any[]).map((e) => ({ id: e.id, name: e.name, role: e.role })),
    [employees],
  );

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const r = parseTimesheetFile(buf, projectList, employeeList);
      setResult(r);
      // По умолчанию выбираем всех сотрудников с найденным user_id
      setSelectedEmployees(new Set(r.employees.filter((e) => e.matchedUserId).map((e) => e.employee)));

      // Идемпотентность: подтягиваем уже сохранённые ответы и помечаем,
      // у кого из найденных в файле сотрудников импорт ПЕРЕЗАПИШЕТ существующий
      // ответ (UNIQUE user_id на уровне БД, см. migration 20260512000000).
      const matchedUserIds = new Set(r.employees.map((e) => e.matchedUserId).filter(Boolean) as string[]);
      const map = new Map<string, { hours: number; projects: number; updatedAt: string }>();
      if (matchedUserIds.size > 0) {
        try {
          const all = await getAllResponses();
          for (const resp of all) {
            if (!matchedUserIds.has(resp.userId)) continue;
            const hours = resp.answers.reduce((s, a) => s + (a.totalHours || 0), 0);
            map.set(resp.userId, {
              hours,
              projects: resp.answers.filter((a) => a.participated).length,
              updatedAt: resp.updatedAt,
            });
          }
        } catch {
          // не критично — просто не покажем бейдж
        }
      }
      setExistingResponses(map);

      toast({
        title: 'Файл прочитан',
        description: `Строк: ${r.rows.length}, сотрудников: ${r.employees.length}` +
          (map.size > 0 ? ` · ${map.size} уже загружены ранее (будут перезаписаны)` : ''),
      });
    } catch (err: any) {
      toast({ title: 'Ошибка чтения файла', description: err?.message || String(err), variant: 'destructive' });
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleEmployee = (key: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    const all = result.employees.map((e) => e.employee);
    if (all.every((k) => selectedEmployees.has(k))) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(all));
    }
  };

  const buildAnswers = (emp: EmployeeAggregate): SurveyProjectAnswer[] => {
    return emp.projects
      .filter((pg) => includeUnmatched || pg.matchScore !== 'none')
      .filter((pg) => includeZeroHours || pg.totalHours > 0)
      .map((pg) => {
        const projectId =
          pg.matchedProjectId ||
          `unmatched:${(normalizeProjectName(pg.projectName) || pg.projectName.toLowerCase()).slice(0, 60)}`;
        const projectName = pg.matchedProjectName || pg.projectName;
        const commentBits: string[] = [`Импорт таймщита (${pg.rowsCount} стр.)`];
        if (pg.sections.length > 0) commentBits.push(`Секции: ${pg.sections.slice(0, 3).join('; ')}${pg.sections.length > 3 ? '…' : ''}`);
        if (pg.managers.length > 0) commentBits.push(`Руководитель: ${pg.managers.join(', ')}`);
        if (pg.partners.length > 0) commentBits.push(`Партнёр: ${pg.partners.join(', ')}`);
        return {
          projectId,
          projectName,
          participated: true,
          roleOnProject: normalizeUserRole(pg.position || emp.matchedUserRole || null),
          periodFrom: pg.periodFrom || undefined,
          periodTo: pg.periodTo || undefined,
          totalHours: pg.totalHours || undefined,
          statusVote: 'in_progress',
          comment: commentBits.join(' · '),
        };
      });
  };

  const handleImport = async () => {
    if (!result || !user) return;
    const targets = result.employees.filter((e) => selectedEmployees.has(e.employee) && e.matchedUserId);
    if (targets.length === 0) {
      toast({ title: 'Никого не выбрано', description: 'Отметьте сотрудников с найденными user_id.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: targets.length });
    let okCount = 0;
    let errCount = 0;
    try {
      for (let idx = 0; idx < targets.length; idx++) {
        const emp = targets[idx];
        const answers = buildAnswers(emp);
        if (answers.length === 0) {
          errCount += 1;
          setProgress({ done: idx + 1, total: targets.length });
          continue;
        }
        try {
          const resp: SurveyResponse = {
            id: `srv_import_${emp.matchedUserId}_${Date.now()}`,
            userId: emp.matchedUserId!,
            userName: emp.matchedUserName || emp.employee,
            userRole: normalizeUserRole(emp.matchedUserRole || null),
            answers,
            status: 'submitted',
            updatedAt: new Date().toISOString(),
          };
          await submitResponse(resp);
          okCount += 1;
        } catch {
          errCount += 1;
        }
        setProgress({ done: idx + 1, total: targets.length });
      }
      toast({
        title: `Импортировано ${okCount} сотрудник(ов)`,
        description: errCount > 0 ? `${errCount} с ошибкой` : 'Данные появятся в «Опрос: результаты» и во вкладке «Кто-где-когда».',
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (!user) return <div className="p-6 text-muted-foreground">Войдите.</div>;

  const isPrivileged = ['ceo', 'deputy_director', 'admin', 'partner', 'hr'].includes(user.role);
  if (!isPrivileged) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            Импорт таймщитов доступен зам.директору, CEO, партнёру, HR и админу. Свой таймщит вы можете
            заполнить через обычный опрос.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const stats = result
    ? {
        empTotal: result.employees.length,
        empMatched: result.employees.filter((e) => e.matchedUserId).length,
        projTotal: result.employees.reduce((s, e) => s + e.projects.length, 0),
        projMatched: result.employees.reduce(
          (s, e) => s + e.projects.filter((p) => p.matchScore !== 'none').length,
          0,
        ),
        hoursTotal: result.employees.reduce((s, e) => s + e.totalProjectHours, 0),
      }
    : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="w-6 h-6 text-primary" /> Импорт таймщитов из Excel
          </CardTitle>
          <CardDescription className="mt-2">
            Скачайте таймщит сотрудника из Google Sheets как <b>.xlsx</b> (Файл → Скачать → Microsoft Excel)
            и загрузите сюда. Система сама распознает колонки <i>Сотрудник, Дата, Проект, Должность,
            Категория Секция, Часы, Локация, Руководитель, Партнер, Примечание</i>, сопоставит проекты
            с теми, что в системе, и сгруппирует по сотрудник × проект.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <Upload className="w-4 h-4 mr-2" /> Выбрать файл (.xlsx / .xls / .csv)
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground">
                Загружено: <b className="text-foreground">{fileName}</b>
              </span>
            )}
          </div>
          <ul className="text-xs text-muted-foreground mt-3 space-y-1">
            <li>• Строки «<span className="font-mono">---Административная работа---</span>» — смотрю «Примечание», если там виден реальный проект, использую его</li>
            <li>• «Отсутствие (Отпуск, больничный)» — считаю как дни без проекта</li>
            <li>• Руководитель и партнёр собираются <b>отдельно по каждому проекту</b> (они могут отличаться)</li>
            <li>• Можно загружать таймщит на любого сотрудника — система привяжет по ФИО</li>
          </ul>
        </CardContent>
      </Card>

      {result && stats && (
        <>
          {result.warnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3 text-sm space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
                    <span>{w}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardHeader className="pb-2"><CardDescription>Строк</CardDescription><CardTitle className="text-2xl">{result.rows.length}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Сотрудников</CardDescription><CardTitle className="text-2xl">{stats.empMatched}<span className="text-sm text-muted-foreground"> / {stats.empTotal}</span></CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Проектов</CardDescription><CardTitle className="text-2xl">{stats.projMatched}<span className="text-sm text-muted-foreground"> / {stats.projTotal}</span></CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Часов всего</CardDescription><CardTitle className="text-2xl">{stats.hoursTotal}</CardTitle></CardHeader></Card>
            <Card className="bg-primary/5"><CardHeader className="pb-2"><CardDescription>Выбрано к импорту</CardDescription><CardTitle className="text-2xl">{selectedEmployees.size}</CardTitle></CardHeader></Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-base">Сотрудники в файле</CardTitle>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={includeUnmatched} onCheckedChange={(v) => setIncludeUnmatched(!!v)} />
                  Включать проекты, которых нет в системе (импортировать как есть)
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={includeZeroHours} onCheckedChange={(v) => setIncludeZeroHours(!!v)} />
                  Включать проекты с 0 часов (маркеры событий)
                </label>
                <Button size="sm" variant="outline" onClick={toggleAll} className="ml-auto">
                  {result.employees.length > 0 && result.employees.every((e) => selectedEmployees.has(e.employee))
                    ? 'Снять выделение'
                    : 'Выбрать всех найденных'}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {result.employees.map((emp) => {
            const checked = selectedEmployees.has(emp.employee);
            const matched = !!emp.matchedUserId;
            return (
              <Card
                key={emp.employee}
                className={`${!matched ? 'border-dashed opacity-80' : ''} ${checked ? 'border-primary/40' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <Checkbox
                      checked={checked}
                      disabled={!matched}
                      onCheckedChange={() => toggleEmployee(emp.employee)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        {emp.employee}
                        {matched ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> сотрудник найден
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            <XCircle className="w-3 h-3 mr-1" /> в системе нет — будет пропущен
                          </Badge>
                        )}
                        {matched && existingResponses.has(emp.matchedUserId!) && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-violet-50 text-violet-700 border-violet-200"
                            title={`Прошлая загрузка: ${existingResponses.get(emp.matchedUserId!)!.hours} ч., ${existingResponses.get(emp.matchedUserId!)!.projects} проект(ов), ${new Date(existingResponses.get(emp.matchedUserId!)!.updatedAt).toLocaleString('ru')}`}
                          >
                            уже загружен — будет перезаписан
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span><Clock className="w-3 h-3 inline mr-1" /> {emp.totalProjectHours} ч. по проектам</span>
                        {emp.adminHours > 0 && <span>+ {emp.adminHours} ч. админ</span>}
                        {emp.absenceDays > 0 && <span>отсутствие: {emp.absenceDays} дн.</span>}
                        <span>{emp.projects.length} проект(ов)</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {emp.projects.map((pg, i) => {
                    const tone = SCORE_TONE[pg.matchScore];
                    const Icon = tone.icon;
                    return (
                      <div key={i} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <FolderOpen className="w-4 h-4 shrink-0 text-muted-foreground" />
                              <span className="font-medium truncate">{pg.projectName}</span>
                              <Badge variant="outline" className={`text-xs border ${tone.tone}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {tone.label}
                              </Badge>
                              {pg.fromNotes && (
                                <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200">
                                  из примечания
                                </Badge>
                              )}
                              {pg.totalHours === 0 && (
                                <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200" title="Только календарные маркеры (начало аудита / выпуск письма), часов нет">
                                  0 ч.
                                </Badge>
                              )}
                            </div>
                            {pg.matchedProjectId && pg.matchedProjectName !== pg.projectName && (
                              <div className="text-xs text-muted-foreground mt-1 pl-6">
                                → в системе: <b>{pg.matchedProjectName}</b>
                              </div>
                            )}
                          </div>
                          <div className="text-right text-sm font-mono shrink-0">
                            <div className="font-bold">{pg.totalHours} ч.</div>
                            <div className="text-xs text-muted-foreground">
                              {pg.uniqueDays > 0
                                ? `за ${pg.uniqueDays} дн.${pg.rowsCount > pg.uniqueDays ? ` (${pg.rowsCount} зап.)` : ''}`
                                : `${pg.rowsCount} зап.`}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-6">
                          {(pg.periodFrom || pg.periodTo) && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {pg.periodFrom || '—'} → {pg.periodTo || '—'}
                            </span>
                          )}
                          {pg.position && <span>должность: {pg.position}</span>}
                          {pg.managers.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> рук.: {pg.managers.join(', ')}
                            </span>
                          )}
                          {pg.partners.length > 0 && <span>партнёр: {pg.partners.join(', ')}</span>}
                          {pg.locations.length > 0 && <span>{pg.locations.join(', ')}{pg.cities.length > 0 ? ` • ${pg.cities.join(', ')}` : ''}</span>}
                        </div>

                        {pg.sections.length > 0 && (
                          <details className="mt-2 pl-6">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Секции аудита ({pg.sections.length})
                            </summary>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {pg.sections.map((s, j) => (
                                <span key={j} className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded">{s}</span>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          <div className="sticky bottom-4 z-10 flex justify-end items-center gap-3">
            {progress && (
              <div className="bg-background border rounded-md px-3 py-2 text-sm shadow-lg">
                Импорт: <b>{progress.done}</b> / {progress.total}
              </div>
            )}
            <Button size="lg" onClick={handleImport} disabled={busy || selectedEmployees.size === 0} className="shadow-xl px-8">
              <Sparkles className="w-4 h-4 mr-2" />
              {busy && progress ? `Импортирую… ${progress.done}/${progress.total}` : `Импортировать выбранных (${selectedEmployees.size})`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
