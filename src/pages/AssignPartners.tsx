/**
 * Массовое назначение партнёра по проектам.
 *
 * Зачем: 913 из 981 проектов пришли через xlsx-импорт и не проходили через
 * /project-approval — у них нет партнёра в notes.team[]. Их таймщиты сейчас
 * висят в фолбэке «Без партнёра» у зам.дира.
 *
 * Кто видит: deputy_director / ceo / admin.
 *
 * UX:
 *  - Таблица проектов с фильтрами (без партнёра / с партнёром X / по компании / поиск).
 *  - Чекбоксы построчно + «Выбрать всех (отфильтрованных)».
 *  - Sticky-bar снизу: «Выбрано N» + Select партнёра + «Назначить» / «Снять».
 *  - После применения список обновляется, выбор сбрасывается.
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { supabaseDataStore } from '@/lib/supabaseDataStore';
import {
  findPartner,
  getProjectTeam,
  withPartnerRemoved,
  withPartnerSet,
} from '@/lib/projectTeam';
import {
  Briefcase,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
  Users,
} from 'lucide-react';

type PartnerFilter = 'no_partner' | 'with_partner' | 'all';

export default function AssignPartners() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects = [], refresh: refreshProjects } = useProjects();
  const { employees = [] } = useEmployees();
  const { toast } = useToast();

  const [filter, setFilter] = useState<PartnerFilter>('no_partner');
  const [filterPartnerId, setFilterPartnerId] = useState<string>('any');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPartnerId, setBulkPartnerId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  if (!user) return <div className="p-6 text-muted-foreground">Войдите.</div>;
  if (!['deputy_director', 'ceo', 'admin'].includes(user.role)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            Назначение партнёров доступно зам.директору, CEO и админу.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Список сотрудников-партнёров (role === 'partner')
  const partnerEmployees = useMemo(
    () => (employees as any[]).filter((e) => e.role === 'partner'),
    [employees],
  );

  // Все компании из проектов — для фильтра.
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects as any[]) {
      const c = p.companyName || p.notes?.companyName || p.notes?.ourCompany;
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [projects]);

  // Главная производная: список проектов с метаданными для рендера + фильтрация.
  const enrichedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects as any[])
      .map((p) => {
        const team = getProjectTeam(p);
        const partner = findPartner(team);
        return { project: p, team, partner };
      })
      .filter(({ project, partner }) => {
        if (filter === 'no_partner' && partner) return false;
        if (filter === 'with_partner') {
          if (!partner) return false;
          if (filterPartnerId !== 'any' && partner.userId !== filterPartnerId) return false;
        }
        // «Только мои назначения» — partner.assignedBy записывается в withPartnerSet,
        // поэтому можем точно отделить «что назначила я» от «что назначил коллега».
        if (onlyMine && filter !== 'no_partner') {
          if (!partner || partner.assignedBy !== user.id) return false;
        }
        if (filterCompany !== 'all') {
          const c = project.companyName || project.notes?.companyName || project.notes?.ourCompany;
          if (c !== filterCompany) return false;
        }
        if (q) {
          const name = (project.name || '').toLowerCase();
          const client = (project.clientName || project.client?.name || '').toLowerCase();
          if (!name.includes(q) && !client.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.project.name || '').localeCompare(b.project.name || '', 'ru'),
      );
  }, [projects, filter, filterPartnerId, filterCompany, query, onlyMine, user.id]);

  const visibleIds = useMemo(
    () => enrichedRows.map((r) => r.project.id).filter(Boolean) as string[],
    [enrichedRows],
  );
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected;

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  };

  // Применить bulk-операцию: assign | unassign
  const apply = async (mode: 'assign' | 'unassign') => {
    if (selected.size === 0) {
      toast({ title: 'Ничего не выбрано', description: 'Отметьте проекты галочками.' });
      return;
    }
    if (mode === 'assign' && !bulkPartnerId) {
      toast({
        title: 'Выберите партнёра',
        description: 'В нижней панели — Select «Партнёр».',
        variant: 'destructive',
      });
      return;
    }

    const partnerEmp = partnerEmployees.find((e: any) => e.id === bulkPartnerId);
    const partnerName = partnerEmp?.name || 'Партнёр';

    setBusy(true);
    let ok = 0;
    let fail = 0;

    try {
      for (const id of Array.from(selected)) {
        const row = enrichedRows.find((r) => r.project.id === id);
        if (!row) continue;
        const newTeam =
          mode === 'assign'
            ? withPartnerSet(row.team, bulkPartnerId, partnerName, user.id)
            : withPartnerRemoved(row.team);
        try {
          await supabaseDataStore.updateProject(id, { team: newTeam });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      await refreshProjects();
      setSelected(new Set());
      toast({
        title:
          mode === 'assign'
            ? `Партнёр назначен: ${ok}${fail > 0 ? `, ошибок: ${fail}` : ''}`
            : `Партнёр снят: ${ok}${fail > 0 ? `, ошибок: ${fail}` : ''}`,
        description:
          mode === 'assign'
            ? `${partnerName} теперь увидит таймщиты по этим проектам в /timesheet-approval.`
            : 'Таймщиты по этим проектам пойдут в фолбэк «Без партнёра» к зам.директору.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Счётчики для шапки.
  // mine — назначения, сделанные текущим пользователем (partner.assignedBy === user.id).
  // Нужен, чтобы в паре зам.ГД + CEO видеть «свою половину работы».
  const counts = useMemo(() => {
    let withP = 0;
    let withoutP = 0;
    let mine = 0;
    for (const p of projects as any[]) {
      const partner = findPartner(getProjectTeam(p));
      if (partner) {
        withP += 1;
        if (partner.assignedBy === user.id) mine += 1;
      } else {
        withoutP += 1;
      }
    }
    return { total: projects.length, withP, withoutP, mine };
  }, [projects, user.id]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-32">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Назначение партнёров
          </CardTitle>
          <CardDescription>
            Пакетно проставить партнёра импортированным проектам. После этого партнёр увидит
            таймщиты этих проектов в «Утверждение часов».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Всего проектов</div>
              <div className="text-2xl font-bold">{counts.total}</div>
            </div>
            <div className="rounded-lg border p-3 bg-amber-50/50">
              <div className="text-xs text-amber-700">Без партнёра</div>
              <div className="text-2xl font-bold text-amber-700">{counts.withoutP}</div>
            </div>
            <div className="rounded-lg border p-3 bg-emerald-50/50">
              <div className="text-xs text-emerald-700">С партнёром</div>
              <div className="text-2xl font-bold text-emerald-700">{counts.withP}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOnlyMine((v) => !v);
                if (!onlyMine && filter === 'no_partner') setFilter('with_partner');
              }}
              className={`rounded-lg border p-3 text-left transition ${
                onlyMine ? 'border-primary bg-primary/10' : 'bg-blue-50/50 hover:bg-blue-100/60'
              }`}
              title="Показать только проекты, где партнёра назначила(а) Я"
            >
              <div className="text-xs text-blue-700 flex items-center justify-between">
                Назначил(а) я
                {onlyMine && <CheckCircle2 className="w-3 h-3" />}
              </div>
              <div className="text-2xl font-bold text-blue-700">{counts.mine}</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Фильтры */}
      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Партнёр</Label>
              <Select value={filter} onValueChange={(v) => setFilter(v as PartnerFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_partner">Без партнёра ({counts.withoutP})</SelectItem>
                  <SelectItem value="with_partner">С партнёром</SelectItem>
                  <SelectItem value="all">Все</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filter === 'with_partner' && (
              <div>
                <Label className="text-xs">Какой партнёр</Label>
                <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Любой</SelectItem>
                    {partnerEmployees.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Компания</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {companyOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label className="text-xs">Поиск</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Название проекта или клиента…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Таблица */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              Найдено: <b>{enrichedRows.length}</b>
            </CardTitle>
            {visibleIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={allSelected || (someSelected ? 'indeterminate' : false)}
                  onCheckedChange={toggleAll}
                />
                Выделить всех ({visibleIds.length})
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {enrichedRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Ничего не найдено</div>
          ) : (
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {enrichedRows.map(({ project, partner }) => {
                const id = project.id;
                const checked = selected.has(id);
                const client = project.clientName || project.client?.name;
                const company = project.companyName || project.notes?.companyName;
                const mineMark = partner && partner.assignedBy === user.id;
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 ${
                      checked ? 'bg-primary/5' : ''
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOne(id)}
                      aria-label={`Выбрать ${project.name}`}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggleOne(id)}
                    >
                      <div className="text-sm font-medium truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {client && <>Клиент: {client}</>}
                        {client && company && ' · '}
                        {company && <>{company}</>}
                      </div>
                    </div>
                    {partner ? (
                      <Badge
                        variant="outline"
                        className={`text-xs border ${
                          mineMark
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title={mineMark ? 'Это назначение — твоё' : undefined}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {partner.userName}
                        {mineMark && <span className="ml-1 opacity-70">· я</span>}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        <AlertTriangle className="w-3 h-3 mr-1" /> нет партнёра
                      </Badge>
                    )}
                    {partner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project-approval?openId=${encodeURIComponent(id)}`);
                        }}
                        title="Доназначить команду в /project-approval"
                      >
                        <Users className="w-3 h-3 mr-1" /> Команда
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky-bar снизу */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(95vw,920px)]">
        <Card className="border-primary/40 shadow-2xl bg-background/95 backdrop-blur">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              Выбрано: <b className="ml-1">{selected.size}</b>
            </Badge>
            <Select value={bulkPartnerId} onValueChange={setBulkPartnerId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Выберите партнёра…" />
              </SelectTrigger>
              <SelectContent>
                {partnerEmployees.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    В системе нет сотрудников с ролью «partner»
                  </div>
                ) : (
                  partnerEmployees.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={busy || selected.size === 0 || !bulkPartnerId}
              onClick={() => apply('assign')}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Назначить ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={busy || selected.size === 0}
              onClick={() => apply('unassign')}
              title="Снять партнёра — таймщиты пойдут к зам.дир"
            >
              <X className="w-4 h-4 mr-2" />
              Снять
            </Button>
            {selected.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Сбросить выбор
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
