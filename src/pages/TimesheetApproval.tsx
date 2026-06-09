/**
 * Утверждение таймщитов — экран партнёра проекта.
 *
 * Кто и что видит:
 *  - partner          → только записи по проектам, где project.partner_id = user.id;
 *  - deputy_director  → всё + отдельный таб «Без партнёра» (записи проектов без
 *                       partner_id и записи без projectId — админ-работа);
 *  - ceo / admin      → то же что зам.дир.
 *  - hr               → только просмотр: видит все бакеты как зам.дир, но без
 *                       кнопок утвердить/отклонить (не в цепочке апрува).
 *
 * Гранулярность апрува — гибрид: партнёр раскрывает строки сотрудника
 * (день/секция/часы/локация/заметки), снимает галочки с проблемных,
 * жмёт «Утвердить выбранные» одной кнопкой. Отклонить — с обязательным
 * комментарием в Dialog.
 *
 * После approve часы попадают в Bonuses (PR 3 — переключим).
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import {
  approveEntries,
  getProjectPartnerId,
  listTimesheets,
  rejectEntries,
  type TimesheetEntry,
  type TimesheetStatus,
} from '@/lib/timesheets';
import { addApprovedEntriesToProjectTeams } from '@/lib/projectTeam';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  XCircle,
  RefreshCw,
  User as UserIcon,
  Calendar,
  MapPin,
  FolderOpen,
  Inbox,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type BucketKind = 'partner' | 'no_partner' | 'no_project';

// Группировка: bucket → projectId|null → employeeId → entries[]
interface ProjectGroup {
  projectId: string | null;
  projectName: string;          // snapshot из первой entry
  systemPartnerName?: string;   // если есть partner_id у проекта
  systemPartnerId?: string;
  byEmployee: Map<string, TimesheetEntry[]>;
  totalHours: number;
  totalRows: number;
}

interface Buckets {
  partner: Map<string, ProjectGroup>;     // мои проекты (где я partner)
  no_partner: Map<string, ProjectGroup>;  // проекты без partner_id (только для deputy/ceo/admin)
  no_project: Map<string, ProjectGroup>;  // entries без project_id (key = 'no_project')
}

function emptyBuckets(): Buckets {
  return {
    partner: new Map(),
    no_partner: new Map(),
    no_project: new Map(),
  };
}

function bucketFor(entry: TimesheetEntry, partnerIdByProject: Map<string, string | null>): BucketKind {
  if (!entry.projectId) return 'no_project';
  const pid = partnerIdByProject.get(entry.projectId);
  return pid ? 'partner' : 'no_partner';
}

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: 'Черновики',
  submitted: 'На утверждение',
  approved: 'Утверждённые',
  rejected: 'Отклонённые',
};

const TEAM_SYNC_INLINE_LIMIT = 25;

function isReviewedStatus(status: TimesheetStatus): status is 'approved' | 'rejected' {
  return status === 'approved' || status === 'rejected';
}

export default function TimesheetApproval() {
  const { user } = useAuth();
  const { projects = [] } = useProjects();
  const { employees = [] } = useEmployees();
  const { toast } = useToast();

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusTab, setStatusTab] = useState<TimesheetStatus>('submitted');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bucketTab, setBucketTab] = useState<BucketKind>('partner');
  // employeeId → entryId → selected
  const [selected, setSelected] = useState<Record<string, Record<string, boolean>>>({});
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({});
  const [openEmployees, setOpenEmployees] = useState<Record<string, boolean>>({});
  const [rejectDialog, setRejectDialog] = useState<{ key: string; ids: string[]; reason: string } | null>(null);
  const [approveDialog, setApproveDialog] = useState<{ key: string; ids: string[]; comment: string } | null>(null);

  const isPartner = user?.role === 'partner';
  const isAdminLike = !!user && ['deputy_director', 'ceo', 'admin'].includes(user.role);
  const isHR = user?.role === 'hr';
  // HR смотрит весь список как зам.дир (три бакета, все статусы), но не утверждает.
  const canSeeAllBuckets = isAdminLike || isHR;
  const canApprove = isPartner || isAdminLike;
  const isPrivileged = canApprove || isHR;

  // Map: projectId → partnerId (или null если у проекта partner не задан).
  // ВАЖНО: в этой системе partner_id-колонка не используется, партнёр живёт
  // в notes.team[] с role='partner' — извлекаем через getProjectPartnerId.
  const partnerIdByProject = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of projects as any[]) {
      m.set(p.id, getProjectPartnerId(p));
    }
    return m;
  }, [projects]);

  const projectInfoById = useMemo(() => {
    const m = new Map<string, { name: string; partnerId?: string }>();
    for (const p of projects as any[]) {
      const pid = getProjectPartnerId(p);
      m.set(p.id, { name: p.name, partnerId: pid || undefined });
    }
    return m;
  }, [projects]);

  const employeeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees as any[]) m.set(e.id, e.name);
    return m;
  }, [employees]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Партнёр — загружаем только записи по его проектам через filter partnerId.
      // Зам.дир/ceo/admin — все записи, потом сами раскладываем по бакетам.
      const filter = isPartner
        ? { partnerId: user.id, status: statusTab, workDateFrom: dateFrom || undefined, workDateTo: dateTo || undefined }
        : { status: statusTab, workDateFrom: dateFrom || undefined, workDateTo: dateTo || undefined };
      const rows = await listTimesheets(filter);
      setEntries(rows);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, [user, isPartner, statusTab, dateFrom, dateTo]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Раскладываем загруженные entries по бакетам.
  const buckets: Buckets = useMemo(() => {
    const b = emptyBuckets();
    for (const e of entries) {
      const kind = bucketFor(e, partnerIdByProject);
      // Партнёру показываем только записи его проектов (фильтр уже на сервере),
      // но защитимся: записи без projectId / без партнёра у партнёра не показываем.
      if (isPartner && kind !== 'partner') continue;

      const bucket = b[kind];
      const key = e.projectId || '__no_project__';
      let group = bucket.get(key);
      if (!group) {
        const sysProject = e.projectId ? projectInfoById.get(e.projectId) : undefined;
        const sysPartnerId = sysProject?.partnerId;
        group = {
          projectId: e.projectId,
          projectName: sysProject?.name || e.projectName,
          systemPartnerId: sysPartnerId,
          systemPartnerName: sysPartnerId ? employeeNameById.get(sysPartnerId) : undefined,
          byEmployee: new Map(),
          totalHours: 0,
          totalRows: 0,
        };
        bucket.set(key, group);
      }
      const empEntries = group.byEmployee.get(e.employeeId) || [];
      empEntries.push(e);
      group.byEmployee.set(e.employeeId, empEntries);
      group.totalHours += e.hours;
      group.totalRows += 1;
    }
    return b;
  }, [entries, partnerIdByProject, projectInfoById, employeeNameById, isPartner]);

  if (!user) return <div className="p-6 text-muted-foreground">Войдите.</div>;
  if (!isPrivileged) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            Утверждение таймщитов доступно партнёру, зам.директору, CEO и админу.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Селект-хелперы
  const isEntrySelected = (employeeId: string, entryId: string) =>
    !!selected[employeeId]?.[entryId];

  const toggleEntry = (employeeId: string, entryId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const cur = { ...(next[employeeId] || {}) };
      if (cur[entryId]) delete cur[entryId];
      else cur[entryId] = true;
      next[employeeId] = cur;
      return next;
    });
  };

  const setAllForEmployee = (employeeId: string, entryIds: string[], value: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      const cur: Record<string, boolean> = {};
      if (value) for (const id of entryIds) cur[id] = true;
      next[employeeId] = cur;
      return next;
    });
  };

  const selectedIdsForEmployee = (employeeId: string): string[] =>
    Object.keys(selected[employeeId] || {});

  const openApproveDialog = (key: string, ids: string[]) => {
    if (ids.length === 0) {
      toast({ title: 'Ничего не выбрано', description: 'Отметьте хотя бы одну запись.' });
      return;
    }
    setApproveDialog({ key, ids, comment: '' });
  };

  const applyReviewedEntriesLocally = (
    ids: string[],
    nextStatus: 'approved' | 'rejected',
    reviewerNotes?: string,
  ) => {
    const idSet = new Set(ids);
    const reviewedAt = new Date().toISOString();
    setEntries((current) => {
      if (statusTab === 'submitted') {
        return current.filter((entry) => !idSet.has(entry.id));
      }
      if (isReviewedStatus(statusTab) && statusTab === nextStatus) {
        return current.map((entry) =>
          idSet.has(entry.id)
            ? {
                ...entry,
                status: nextStatus,
                reviewedBy: user.id,
                reviewedByName: user.name,
                reviewedAt,
                reviewerNotes,
              }
            : entry,
        );
      }
      return current;
    });
    setSelected({});
  };

  const submitApprove = async () => {
    if (!approveDialog) return;
    if (!canApprove) {
      toast({ title: 'Нет прав', description: 'У вас нет прав утверждать тайм-щиты.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const n = await approveEntries(
        approveDialog.ids,
        { id: user.id, name: user.name },
        approveDialog.comment.trim() || undefined,
      );
      if (n === 0) {
        toast({ title: 'Не утверждено', description: 'Supabase не обновил ни одной записи. Проверьте права или выбранные записи.', variant: 'destructive' });
        return;
      }

      // Авто-добавление в команду проекта: если сотрудник подал часы по
      // проекту X и партнёр их утвердил — он официально становится участником
      // проекта (попадает в notes.team[]). Для больших bulk-апрувов не держим
      // пользователя на спиннере: статус уже записан в БД, а синхронизацию
      // команды делаем в фоне.
      const approvedIdSet = new Set(approveDialog.ids);
      const approvedEntries = entries
        .filter((e) => approvedIdSet.has(e.id))
        .map((e) => ({ employeeId: e.employeeId, projectId: e.projectId }));
      const comment = approveDialog.comment.trim() || undefined;

      const syncTeams = () => addApprovedEntriesToProjectTeams(
        approvedEntries,
        employees as any[],
        user.id,
      );

      let teamSuffix = '';
      let teamDescription = '';
      if (approvedEntries.length > 0 && approvedEntries.length <= TEAM_SYNC_INLINE_LIMIT) {
        const teamResult = await syncTeams();
        teamSuffix = teamResult.added > 0
          ? ` · +${teamResult.added} в командах ${teamResult.affectedProjects} проектов`
          : '';
        teamDescription = teamResult.added > 0
          ? ` Авто-добавили ${teamResult.added} участник${teamResult.added === 1 ? 'а' : 'ов'} в команды проектов.`
          : '';
      } else if (approvedEntries.length > TEAM_SYNC_INLINE_LIMIT) {
        void syncTeams()
          .then((teamResult) => {
            if (teamResult.added > 0) {
              toast({
                title: `Команды проектов обновлены: +${teamResult.added}`,
                description: `Затронуто проектов: ${teamResult.affectedProjects}.`,
              });
            }
          })
          .catch((error) => {
            console.error('[TimesheetApproval] background team sync failed', error);
            toast({
              title: 'Часы утверждены, но команда проекта не обновилась',
              description: error?.message || 'Повторите обновление или назначьте участника вручную.',
              variant: 'destructive',
            });
          });
      }

      toast({
        title: `Утверждено: ${n}${teamSuffix}`,
        description: 'Часы пойдут в расчёт бонуса.' + teamDescription,
      });
      applyReviewedEntriesLocally(approveDialog.ids, 'approved', comment);
      setApproveDialog(null);
    } catch (error: any) {
      console.error('[TimesheetApproval] approve failed', error);
      toast({ title: 'Ошибка утверждения', description: error?.message || 'Не удалось утвердить часы.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const openRejectDialog = (key: string, ids: string[]) => {
    if (ids.length === 0) {
      toast({ title: 'Ничего не выбрано', description: 'Отметьте записи, которые отклоняете.' });
      return;
    }
    setRejectDialog({ key, ids, reason: '' });
  };

  const submitReject = async () => {
    if (!rejectDialog) return;
    if (!canApprove) {
      toast({ title: 'Нет прав', description: 'У вас нет прав отклонять тайм-щиты.', variant: 'destructive' });
      return;
    }
    const reason = rejectDialog.reason.trim();
    if (!reason) {
      toast({ title: 'Нужна причина', description: 'Сотрудник увидит её и поправит запись.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const n = await rejectEntries(rejectDialog.ids, { id: user.id, name: user.name }, reason);
      if (n === 0) {
        toast({ title: 'Не отклонено', description: 'Supabase не обновил ни одной записи. Проверьте права или выбранные записи.', variant: 'destructive' });
        return;
      }
      toast({ title: `Отклонено: ${n}`, description: 'Сотрудник увидит причину и сможет поправить.' });
      applyReviewedEntriesLocally(rejectDialog.ids, 'rejected', reason);
      setRejectDialog(null);
    } catch (error: any) {
      console.error('[TimesheetApproval] reject failed', error);
      toast({ title: 'Ошибка отклонения', description: error?.message || 'Не удалось отклонить часы.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Подсчёт счётчиков для табов бакетов
  const bucketCount = (kind: BucketKind) => {
    let n = 0;
    for (const g of buckets[kind].values()) n += g.totalRows;
    return n;
  };

  const activeBucketGroups = useMemo(
    () => Array.from(buckets[bucketTab].values()).sort((a, b) => b.totalHours - a.totalHours),
    [buckets, bucketTab],
  );

  // Все id записей в одном проекте — для кнопки «Утвердить весь проект».
  const allEntryIdsInGroup = (group: ProjectGroup): string[] => {
    const ids: string[] = [];
    for (const empEntries of group.byEmployee.values()) {
      for (const e of empEntries) ids.push(e.id);
    }
    return ids;
  };

  // Все id во всех проектах текущего бакета — для «Утвердить всё показанное».
  const allEntryIdsInBucket = useMemo((): string[] => {
    const ids: string[] = [];
    for (const g of activeBucketGroups) {
      for (const empEntries of g.byEmployee.values()) {
        for (const e of empEntries) ids.push(e.id);
      }
    }
    return ids;
  }, [activeBucketGroups]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-24">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="w-6 h-6 text-primary" /> Утверждение таймщитов
          </CardTitle>
          <CardDescription>
            {isPartner
              ? 'Здесь показаны таймщиты сотрудников по проектам, где вы партнёр. Подтверждённые часы пойдут в расчёт бонуса.'
              : isHR
                ? 'Просмотр таймщитов и статусов апрува по всем проектам. Утверждение и отклонение делают партнёры и зам.директор.'
                : 'Записи по всем проектам — с фильтром «Без партнёра», где требуется ваше решение как зам.директора.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as TimesheetStatus)}>
              <TabsList>
                <TabsTrigger value="submitted">{STATUS_LABEL.submitted}</TabsTrigger>
                <TabsTrigger value="approved">{STATUS_LABEL.approved}</TabsTrigger>
                <TabsTrigger value="rejected">{STATUS_LABEL.rejected}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">с</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-[150px] bg-muted/40 border-0 text-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">по</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-[150px] bg-muted/40 border-0 text-sm"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Сбросить даты
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="ml-auto">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Обновить
            </Button>
            {canApprove && statusTab === 'submitted' && allEntryIdsInBucket.length > 0 && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={busy}
                onClick={() => openApproveDialog(`__bulk_${bucketTab}`, allEntryIdsInBucket)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Утвердить всё показанное ({allEntryIdsInBucket.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Бакеты (для зам.дир/ceo/admin/hr — три, для partner только один) */}
      {canSeeAllBuckets && (
        <Tabs value={bucketTab} onValueChange={(v) => setBucketTab(v as BucketKind)}>
          <TabsList>
            <TabsTrigger value="partner" className="gap-2">
              С партнёром
              {bucketCount('partner') > 0 && (
                <Badge variant="secondary" className="text-xs">{bucketCount('partner')}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="no_partner" className="gap-2">
              Без партнёра в системе
              {bucketCount('no_partner') > 0 && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                  {bucketCount('no_partner')}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="no_project" className="gap-2">
              Без проекта / админ
              {bucketCount('no_project') > 0 && (
                <Badge variant="secondary" className="text-xs">{bucketCount('no_project')}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Загрузка…</CardContent></Card>
      ) : activeBucketGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7 text-muted-foreground/60" />
            </div>
            <p className="font-medium">Записей нет</p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusTab === 'submitted'
                ? 'Здесь будут появляться таймщиты, ждущие вашего подтверждения.'
                : `Нет ${STATUS_LABEL[statusTab].toLowerCase()} в этой категории.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        activeBucketGroups.map((group) => {
          const projKey = group.projectId || '__no_project__';
          // На admin/CEO экране могут быть тысячи строк. По умолчанию держим
          // большие группы свернутыми, чтобы список не зависал от огромного DOM.
          const isOpen = openProjects[projKey] ?? activeBucketGroups.length <= 5;
          return (
            <Card key={projKey}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpenProjects((p) => ({ ...p, [projKey]: !isOpen }))}>
                <div className="flex items-start gap-3 flex-wrap">
                  {isOpen ? <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />}
                  <FolderOpen className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{group.projectName}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {group.byEmployee.size} сотр. · {group.totalRows} зап. · {group.totalHours.toFixed(1)} ч.
                      {group.systemPartnerName && (
                        <> · Партнёр: <b className="text-foreground">{group.systemPartnerName}</b></>
                      )}
                    </CardDescription>
                  </div>
                  {bucketTab === 'no_partner' && (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" /> в системе нет партнёра — апрув у зам.дир
                    </Badge>
                  )}
                  {canApprove && statusTab === 'submitted' && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        openApproveDialog(`__project_${projKey}`, allEntryIdsInGroup(group));
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Утвердить весь проект ({group.totalRows})
                    </Button>
                  )}
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="space-y-3">
                  {Array.from(group.byEmployee.entries())
                    .sort((a, b) => (employeeNameById.get(a[0]) || '').localeCompare(employeeNameById.get(b[0]) || '', 'ru'))
                    .map(([employeeId, empEntries]) => {
                      const empKey = `${projKey}__${employeeId}`;
                      const empOpen = openEmployees[empKey] ?? true;
                      const empName = employeeNameById.get(employeeId) || empEntries[0]?.employeeName || 'Неизвестный';
                      const totalH = empEntries.reduce((s, e) => s + e.hours, 0);
                      const days = new Set(empEntries.map((e) => e.workDate)).size;
                      const sections = Array.from(new Set(empEntries.map((e) => e.section).filter(Boolean) as string[]));
                      const entryIds = empEntries.map((e) => e.id);
                      const selectedIds = selectedIdsForEmployee(employeeId).filter((id) => entryIds.includes(id));
                      const allChecked = selectedIds.length === entryIds.length && entryIds.length > 0;
                      const someChecked = selectedIds.length > 0 && !allChecked;
                      // Расхождение partner_raw в xlsx vs system
                      const distinctPartnersRaw = Array.from(
                        new Set(empEntries.map((e) => e.partnerRaw).filter(Boolean) as string[]),
                      );
                      const partnerMismatch =
                        group.systemPartnerName &&
                        distinctPartnersRaw.length > 0 &&
                        !distinctPartnersRaw.some(
                          (p) => p.toLowerCase().trim() === group.systemPartnerName!.toLowerCase().trim(),
                        );

                      return (
                        <div key={empKey} className="rounded-lg border bg-card">
                          <div
                            className="p-3 flex items-start gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
                            onClick={() => setOpenEmployees((p) => ({ ...p, [empKey]: !empOpen }))}
                          >
                            {empOpen ? <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground" />}
                            <UserIcon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium flex flex-wrap items-center gap-2">
                                {empName}
                                {partnerMismatch && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    в файле: {distinctPartnersRaw.join(', ')} · в системе: {group.systemPartnerName}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                <span><Clock className="w-3 h-3 inline mr-1" />{totalH.toFixed(1)} ч.</span>
                                <span>{days} дн.</span>
                                <span>{empEntries.length} зап.</span>
                                {sections.length > 0 && (
                                  <span className="truncate">секции: {sections.slice(0, 3).join(', ')}{sections.length > 3 ? `, +${sections.length - 3}` : ''}</span>
                                )}
                              </div>
                            </div>
                            {canApprove ? (
                              <Badge variant="outline" className="text-xs shrink-0" title="Выбрано записей">
                                {selectedIds.length} / {entryIds.length}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {entryIds.length} зап.
                              </Badge>
                            )}
                          </div>

                          {empOpen && (
                            <div className="border-t">
                              {canApprove && statusTab === 'submitted' && (
                                <div className="p-2 flex flex-wrap items-center gap-2 border-b bg-muted/20">
                                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox
                                      checked={allChecked || (someChecked ? 'indeterminate' : false)}
                                      onCheckedChange={(v) => setAllForEmployee(employeeId, entryIds, !!v)}
                                    />
                                    Выделить все
                                  </label>
                                  <div className="ml-auto flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700"
                                      disabled={busy || selectedIds.length === 0}
                                      onClick={() => openApproveDialog(empKey, selectedIds)}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" /> Утвердить выбранные ({selectedIds.length})
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-red-200 text-red-700 hover:bg-red-50"
                                      disabled={busy || selectedIds.length === 0}
                                      onClick={() => openRejectDialog(empKey, selectedIds)}
                                    >
                                      <XCircle className="w-4 h-4 mr-1" /> Отклонить
                                    </Button>
                                  </div>
                                </div>
                              )}

                              <div className="divide-y">
                                {empEntries
                                  .slice()
                                  .sort((a, b) => a.workDate.localeCompare(b.workDate))
                                  .map((e) => {
                                    const checked = isEntrySelected(employeeId, e.id);
                                    return (
                                      <div
                                        key={e.id}
                                        className={`p-3 flex items-start gap-3 text-sm ${checked ? 'bg-primary/5' : ''}`}
                                      >
                                        {canApprove && statusTab === 'submitted' && (
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleEntry(employeeId, e.id)}
                                            className="mt-0.5"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0 grid sm:grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 items-baseline">
                                          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(e.workDate), 'dd MMM', { locale: ru })}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              {e.section && (
                                                <span className="px-1.5 py-0.5 rounded bg-muted/70 text-xs">{e.section}</span>
                                              )}
                                              {e.position && (
                                                <span className="text-xs text-muted-foreground">{e.position}</span>
                                              )}
                                              {(e.location || e.city) && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                  <MapPin className="w-3 h-3" />
                                                  {[e.location, e.city].filter(Boolean).join(' · ')}
                                                </span>
                                              )}
                                              {e.source !== 'import' && (
                                                <Badge variant="outline" className="text-[10px] py-0">
                                                  {e.source === 'survey' ? 'из опроса' : 'вручную'}
                                                </Badge>
                                              )}
                                            </div>
                                            {(e.managerRaw || e.partnerRaw) && (
                                              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                                {e.managerRaw && (
                                                  <span>Рук.: <span className="text-foreground/80">{e.managerRaw}</span></span>
                                                )}
                                                {e.partnerRaw && (
                                                  <span>Партнёр (по файлу): <span className="text-foreground/80">{e.partnerRaw}</span></span>
                                                )}
                                              </div>
                                            )}
                                            {e.notes && (
                                              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{e.notes}</div>
                                            )}
                                            {e.reviewerNotes && statusTab === 'rejected' && (
                                              <div className="text-xs text-red-700 bg-red-50 rounded mt-1 px-2 py-1 whitespace-pre-wrap break-words">
                                                <b>Причина отказа:</b> {e.reviewerNotes}
                                                {e.reviewedByName && <span className="ml-1 opacity-70">— {e.reviewedByName}</span>}
                                              </div>
                                            )}
                                            {e.reviewerNotes && statusTab === 'approved' && (
                                              <div className="text-xs text-emerald-800 bg-emerald-50 rounded mt-1 px-2 py-1 whitespace-pre-wrap break-words">
                                                <b>Коммент партнёра:</b> {e.reviewerNotes}
                                                {e.reviewedByName && <span className="ml-1 opacity-70">— {e.reviewedByName}</span>}
                                              </div>
                                            )}
                                          </div>
                                          <span className="font-mono text-sm font-semibold whitespace-nowrap text-right">
                                            {e.hours.toFixed(1)} ч.
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </CardContent>
              )}
            </Card>
          );
        })
      )}

      {/* Диалог утверждения — опциональный коммент партнёра */}
      <Dialog open={!!approveDialog} onOpenChange={(v) => !v && setApproveDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Утвердить записи
            </DialogTitle>
            <DialogDescription>
              Будет утверждено <b>{approveDialog?.ids.length || 0}</b> зап. Часы пойдут в расчёт бонуса.
              Коммент необязательный — но если что-то заметили (например «согласовано после устной правки»),
              впишите сюда — останется в истории и сотрудник увидит.
            </DialogDescription>
          </DialogHeader>
          {(approveDialog?.ids.length || 0) >= 50 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Вы утверждаете <b>{approveDialog?.ids.length}</b> записей за один раз.
                Убедитесь, что часы вам знакомы — после апрува они уйдут в расчёт бонуса.
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Коммент партнёра (опционально)</Label>
            <Textarea
              rows={3}
              value={approveDialog?.comment || ''}
              onChange={(e) =>
                setApproveDialog((d) => (d ? { ...d, comment: e.target.value } : d))
              }
              placeholder="Например: «ОК, по проекту X тратили больше из-за дополнительных процедур»"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Отмена</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitApprove} disabled={busy}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Утвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог отклонения с обязательной причиной */}
      <Dialog open={!!rejectDialog} onOpenChange={(v) => !v && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отклонить записи</DialogTitle>
            <DialogDescription>
              Будет отклонено <b>{rejectDialog?.ids.length || 0}</b> записи. Сотрудник увидит причину и сможет поправить.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Причина (обязательно)</Label>
            <Textarea
              rows={3}
              value={rejectDialog?.reason || ''}
              onChange={(e) =>
                setRejectDialog((d) => (d ? { ...d, reason: e.target.value } : d))
              }
              placeholder="Например: «Часы не совпадают с тем, что я знаю по проекту — уточни даты»"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Отмена</Button>
            <Button variant="destructive" onClick={submitReject} disabled={busy}>
              <XCircle className="w-4 h-4 mr-2" /> Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
