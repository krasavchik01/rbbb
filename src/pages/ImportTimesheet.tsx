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
  type ParsedRow,
  type EmployeeAggregate,
  type ProjectAggregate,
} from '@/lib/timesheetImport';
import {
  bulkInsert,
  makeImportBatchId,
  type TimesheetEntryDraft,
} from '@/lib/timesheets';
import { supabase } from '@/integrations/supabase/client';
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
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [includeUnmatched, setIncludeUnmatched] = useState(false);
  // 0-часовые проекты — это календарные маркеры («начало аудита», «выпуск
  // письма»). По умолчанию не считаем их за участие, чтобы не зачислить
  // людей в команды проектов, по которым они реально не работали.
  const [includeZeroHours, setIncludeZeroHours] = useState(false);
  // userId → сводка по уже существующим записям этой пачки (для бейджа
  // «уже загружен из этого файла — будет перезаписан»).
  const [existingBatch, setExistingBatch] = useState<
    Map<string, { rows: number; hours: number; approved: number }>
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
    setExistingBatch(new Map());
    setImportBatchId(null);
    try {
      const buf = await file.arrayBuffer();
      const r = parseTimesheetFile(buf, projectList, employeeList);
      setResult(r);
      // По умолчанию выбираем всех сотрудников с найденным user_id
      setSelectedEmployees(new Set(r.employees.filter((e) => e.matchedUserId).map((e) => e.employee)));

      // Идемпотентность: считаем хэш файла и проверяем, есть ли уже записи
      // этой пачки в БД. Повторный импорт удалит и перезапишет (см. handleImport).
      const batchId = await makeImportBatchId(file);
      setImportBatchId(batchId);

      const matchedUserIds = r.employees.map((e) => e.matchedUserId).filter(Boolean) as string[];
      if (matchedUserIds.length > 0) {
        const { data: existing } = await supabase
          .from('timesheet_entries')
          .select('employee_id, hours, status')
          .eq('import_batch_id', batchId)
          .eq('source', 'import');
        if (existing && existing.length > 0) {
          const map = new Map<string, { rows: number; hours: number; approved: number }>();
          for (const row of existing) {
            const cur = map.get(row.employee_id) || { rows: 0, hours: 0, approved: 0 };
            cur.rows += 1;
            cur.hours += Number(row.hours) || 0;
            if (row.status === 'approved') cur.approved += 1;
            map.set(row.employee_id, cur);
          }
          setExistingBatch(map);
        }
      }

      const dup = existingBatch.size;
      toast({
        title: 'Файл прочитан',
        description: `Строк: ${r.rows.length}, сотрудников: ${r.employees.length}` +
          (dup > 0 ? ` · ${dup} уже из этого файла (будут перезаписаны)` : ''),
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
    const all = result.employees.filter((e) => e.matchedUserId).map((e) => e.employee);
    if (all.every((k) => selectedEmployees.has(k))) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(all));
    }
  };

  /**
   * Превращаем ParsedRow → TimesheetEntryDraft. Одна строка xlsx = одна запись.
   * Фильтры:
   *  - kind='absence' — пропускаем (это дни отпуска/больничного, не таймщит)
   *  - effectiveProject пустой — пропускаем (это «голая» админка без проекта)
   *  - hours=0 — пропускаем, если includeZeroHours=false
   *  - проект не найден в системе и includeUnmatched=false — пропускаем
   *  - нет isoDate — пропускаем (некорректная дата)
   */
  const buildRowDrafts = (
    emp: EmployeeAggregate,
    rows: ParsedRow[],
    projectIdByName: Map<string, string>,
  ): TimesheetEntryDraft[] => {
    const drafts: TimesheetEntryDraft[] = [];
    for (const r of rows) {
      if (r.employee !== emp.employee) continue;
      if (r.kind === 'absence') continue;
      if (!r.effectiveProject) continue;
      if (!r.isoDate) continue;
      if (!includeZeroHours && (!r.hours || r.hours === 0)) continue;

      const nameKey = normalizeProjectName(r.effectiveProject) || r.effectiveProject.toLowerCase();
      const matchedProjectId =
        r.preMatchFromNotes?.id && !r.preMatchFromNotes.id.startsWith('self:')
          ? r.preMatchFromNotes.id
          : projectIdByName.get(nameKey) || null;

      if (!matchedProjectId && !includeUnmatched) continue;

      drafts.push({
        employeeId: emp.matchedUserId!,
        employeeName: emp.matchedUserName || emp.employee,
        projectId: matchedProjectId,
        projectName: r.effectiveProject,
        workDate: r.isoDate,
        hours: r.hours,
        section: r.section || undefined,
        position: r.position || undefined,
        location: r.location || undefined,
        city: r.city || undefined,
        managerRaw: r.manager || undefined,
        partnerRaw: r.partner || undefined,
        notes: r.notes || undefined,
        source: 'import',
        status: 'submitted',
        createdBy: user?.id,
      });
    }
    return drafts;
  };

  const handleImport = async () => {
    if (!result || !user || !importBatchId) return;
    const targets = result.employees.filter((e) => selectedEmployees.has(e.employee) && e.matchedUserId);
    if (targets.length === 0) {
      toast({ title: 'Никого не выбрано', description: 'Отметьте сотрудников с найденными user_id.', variant: 'destructive' });
      return;
    }

    // Map: nameKey → projectId — для быстрого матчинга строк на ID.
    const projectIdByName = new Map<string, string>();
    for (const emp of result.employees) {
      for (const pg of emp.projects) {
        if (!pg.matchedProjectId) continue;
        const key = normalizeProjectName(pg.projectName) || pg.projectName.toLowerCase();
        projectIdByName.set(key, pg.matchedProjectId);
      }
    }

    // Считаем общее число строк для прогресса
    const allDrafts: TimesheetEntryDraft[] = [];
    for (const emp of targets) {
      allDrafts.push(...buildRowDrafts(emp, result.rows, projectIdByName));
    }
    if (allDrafts.length === 0) {
      toast({
        title: 'Нечего импортировать',
        description: 'Все строки выбранных сотрудников отфильтрованы (проверьте чекбоксы «включать unmatched / 0 часов»).',
        variant: 'destructive',
      });
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: allDrafts.length });

    try {
      // 1) Удаляем старые записи этой пачки ТОЛЬКО для выбранных сотрудников.
      //    Если импортёр запускает повторно тот же файл и снимает галочку с
      //    одного сотрудника, его старые записи остаются (не теряем работу).
      const selectedUserIds = targets.map((e) => e.matchedUserId!);
      const { error: delErr } = await supabase
        .from('timesheet_entries')
        .delete()
        .eq('import_batch_id', importBatchId)
        .eq('source', 'import')
        .in('employee_id', selectedUserIds);
      if (delErr) {
        toast({ title: 'Ошибка удаления старой пачки', description: delErr.message, variant: 'destructive' });
        return;
      }

      // 2) Вставляем построчно. Делим на чанки по 500 — Supabase REST имеет
      //    ограничение на размер payload, и большой xlsx (5000+ строк) лучше не пихать одним INSERT.
      const CHUNK = 500;
      let inserted = 0;
      for (let i = 0; i < allDrafts.length; i += CHUNK) {
        const chunk = allDrafts.slice(i, i + CHUNK).map((d) => ({ ...d, importBatchId }));
        const n = await bulkInsert(chunk);
        inserted += n;
        setProgress({ done: Math.min(i + CHUNK, allDrafts.length), total: allDrafts.length });
      }

      toast({
        title: `Импортировано ${inserted} строк`,
        description:
          `${targets.length} сотрудник(ов) · ${inserted} зап. · ` +
          'Записи ожидают подтверждения партнёра проекта (или зам.директора, если партнёр не указан).',
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
            и загрузите сюда. Каждая строка файла (день × секция) сохраняется отдельно — партнёр
            проекта увидит детализацию и подтвердит часы.
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
            <li>• «Отсутствие (Отпуск, больничный)» — считаю как дни без проекта (не идут в таймщит)</li>
            <li>• Партнёр в файле сохраняется как <code>partner_raw</code>, апрувит партнёр из карточки проекта (расхождения будут видны)</li>
            <li>• Повторный импорт того же файла перезаписывает свою пачку (по хэшу) — задвоения не будет</li>
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
                  Включать проекты, которых нет в системе (project_id будет пустым → апрув у зам.дир)
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={includeZeroHours} onCheckedChange={(v) => setIncludeZeroHours(!!v)} />
                  Включать строки с 0 часов (маркеры событий)
                </label>
                <Button size="sm" variant="outline" onClick={toggleAll} className="ml-auto">
                  {result.employees.filter((e) => e.matchedUserId).every((e) => selectedEmployees.has(e.employee))
                    ? 'Снять выделение'
                    : 'Выбрать всех найденных'}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {result.employees.map((emp) => {
            const checked = selectedEmployees.has(emp.employee);
            const matched = !!emp.matchedUserId;
            const exist = matched ? existingBatch.get(emp.matchedUserId!) : null;
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
                        {exist && (
                          <Badge
                            variant="outline"
                            className={
                              exist.approved > 0
                                ? 'text-xs bg-red-50 text-red-700 border-red-200'
                                : 'text-xs bg-violet-50 text-violet-700 border-violet-200'
                            }
                            title={`Из этого файла: ${exist.rows} зап., ${exist.hours} ч.${exist.approved > 0 ? `, ${exist.approved} уже подтверждены партнёром — перезапись их удалит!` : ''}`}
                          >
                            {exist.approved > 0
                              ? `${exist.approved} уже подтверждены — потеряются!`
                              : `уже из этого файла (${exist.rows} зап.) — будет перезаписано`}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span><Clock className="w-3 h-3 inline mr-1" /> {emp.totalProjectHours} ч. по проектам</span>
                        {emp.adminHours > 0 && <span>+ {emp.adminHours} ч. админ (без проекта — не идут в таймщит)</span>}
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
                Импорт: <b>{progress.done}</b> / {progress.total} строк
              </div>
            )}
            <Button size="lg" onClick={handleImport} disabled={busy || selectedEmployees.size === 0} className="shadow-xl px-8">
              <Sparkles className="w-4 h-4 mr-2" />
              {busy && progress
                ? `Импортирую… ${progress.done}/${progress.total}`
                : `Импортировать (${selectedEmployees.size} сотр.)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
