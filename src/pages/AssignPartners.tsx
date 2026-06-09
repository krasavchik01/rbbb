/**
 * Быстрое назначение команды по проектам.
 *
 * Для зам.директора/CEO/admin: быстро найти проекты без команды, назначить или
 * изменить партнёра и участников прямо в списке, не проваливаясь в проект и не
 * теряя фильтры.
 */

import { useMemo, useState, useCallback } from 'react';
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
  type TeamMember,
} from '@/lib/projectTeam';
import { PROJECT_ROLES, normalizeUserRole, type UserRole } from '@/types/roles';
import {
  Briefcase,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
  Pencil,
  Save,
} from 'lucide-react';

type TeamFilter = 'no_team' | 'no_partner' | 'with_partner' | 'all';
type TeamDraft = Record<string, string>;

const NONE = '__none__';

function memberId(member: any): string | undefined {
  return member?.userId || member?.id || member?.employeeId;
}

function buildTeamDraft(team: TeamMember[]): TeamDraft {
  const draft: TeamDraft = {};
  for (const role of PROJECT_ROLES) draft[role.role] = NONE;
  for (const member of team) {
    if (!member?.role) continue;
    draft[member.role] = memberId(member) || NONE;
  }
  return draft;
}

function employeeProjectRole(employee: any): UserRole {
  return normalizeUserRole(employee?.role, employee?.level);
}

function buildTeamFromDraft(
  draft: TeamDraft,
  employees: any[],
  existingTeam: TeamMember[],
  assignedBy: string,
): TeamMember[] {
  const employeesById = new Map(employees.map((e: any) => [e.id, e]));
  const managedRoles = new Set(PROJECT_ROLES.map((r) => r.role));
  const preserved = existingTeam.filter((m) => !managedRoles.has(m.role as UserRole));
  const next: TeamMember[] = [...preserved];

  for (const role of PROJECT_ROLES) {
    const empId = draft[role.role];
    if (!empId || empId === NONE) continue;
    const emp = employeesById.get(empId);
    if (!emp) continue;
    next.push({
      userId: emp.id,
      userName: emp.name || emp.email || emp.id,
      role: role.role,
      bonusPercent: role.bonusPercent,
      assignedAt: new Date().toISOString(),
      assignedBy,
    });
  }

  return next;
}

export default function AssignPartners() {
  const { user } = useAuth();
  const { projects = [], refresh: refreshProjects } = useProjects();
  const { employees = [] } = useEmployees();
  const { toast } = useToast();

  const [filter, setFilter] = useState<TeamFilter>('no_team');
  const [filterPartnerId, setFilterPartnerId] = useState<string>('any');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPartnerId, setBulkPartnerId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamDraft>>({});

  const partnerEmployees = useMemo(
    () => (employees as any[]).filter((e) => employeeProjectRole(e) === 'partner'),
    [employees],
  );

  const employeesByRole = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const role of PROJECT_ROLES) map.set(role.role, []);
    for (const emp of employees as any[]) {
      const role = employeeProjectRole(emp);
      if (!map.has(role)) continue;
      map.get(role)!.push(emp);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
    }
    return map;
  }, [employees]);

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects as any[]) {
      const c = p.companyName || p.notes?.companyName || p.notes?.ourCompany;
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [projects]);

  const enrichedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects as any[])
      .map((p) => {
        const team = getProjectTeam(p);
        const partner = findPartner(team);
        return { project: p, team, partner };
      })
      .filter(({ project, team, partner }) => {
        if (filter === 'no_team' && team.length > 0) return false;
        if (filter === 'no_partner' && partner) return false;
        if (filter === 'with_partner') {
          if (!partner) return false;
          if (filterPartnerId !== 'any' && partner.userId !== filterPartnerId) return false;
        }
        if (onlyMine && filter !== 'no_team' && filter !== 'no_partner') {
          if (!partner || partner.assignedBy !== user?.id) return false;
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
      .sort((a, b) => (a.project.name || '').localeCompare(b.project.name || '', 'ru'));
  }, [projects, filter, filterPartnerId, filterCompany, query, onlyMine, user?.id]);

  const visibleIds = useMemo(
    () => enrichedRows.map((r) => r.project.id).filter(Boolean) as string[],
    [enrichedRows],
  );
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected;

  const counts = useMemo(() => {
    let withPartner = 0;
    let withoutPartner = 0;
    let withoutTeam = 0;
    let mine = 0;
    for (const p of projects as any[]) {
      const team = getProjectTeam(p);
      const partner = findPartner(team);
      if (team.length === 0) withoutTeam += 1;
      if (partner) {
        withPartner += 1;
        if (partner.assignedBy === user?.id) mine += 1;
      } else {
        withoutPartner += 1;
      }
    }
    return { total: projects.length, withPartner, withoutPartner, withoutTeam, mine };
  }, [projects, user?.id]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const openTeamEditor = (projectId: string, team: TeamMember[]) => {
    setEditingProjectId((current) => (current === projectId ? null : projectId));
    setTeamDrafts((prev) => ({
      ...prev,
      [projectId]: prev[projectId] || buildTeamDraft(team),
    }));
  };

  const setDraftRole = (projectId: string, role: string, employeeId: string) => {
    setTeamDrafts((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || {}),
        [role]: employeeId,
      },
    }));
  };

  const saveTeam = async (projectId: string) => {
    const row = enrichedRows.find((r) => r.project.id === projectId);
    if (!row || !user) return;
    const draft = teamDrafts[projectId] || buildTeamDraft(row.team);
    const nextTeam = buildTeamFromDraft(draft, employees as any[], row.team, user.id);

    if (!nextTeam.some((m) => m.role === 'partner')) {
      toast({
        title: 'Выберите партнёра',
        description: 'Партнёр обязателен, иначе часы снова попадут к зам.директору.',
        variant: 'destructive',
      });
      return;
    }

    setBusy(true);
    try {
      await supabaseDataStore.updateProject(projectId, { team: nextTeam });
      await refreshProjects();
      setEditingProjectId(null);
      setSelected(new Set());
      toast({
        title: 'Команда сохранена',
        description: 'Проект обновлён без выхода из списка — фильтры сохранены.',
      });
    } catch (error: any) {
      toast({ title: 'Ошибка сохранения команды', description: error?.message || 'Не удалось сохранить.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const apply = async (mode: 'assign' | 'unassign') => {
    if (selected.size === 0) {
      toast({ title: 'Ничего не выбрано', description: 'Отметьте проекты галочками.' });
      return;
    }
    if (mode === 'assign' && !bulkPartnerId) {
      toast({ title: 'Выберите партнёра', description: 'В нижней панели — Select «Партнёр».', variant: 'destructive' });
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
        const newTeam = mode === 'assign'
          ? withPartnerSet(row.team, bulkPartnerId, partnerName, user?.id || '')
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
        title: mode === 'assign'
          ? `Партнёр назначен: ${ok}${fail > 0 ? `, ошибок: ${fail}` : ''}`
          : `Партнёр снят: ${ok}${fail > 0 ? `, ошибок: ${fail}` : ''}`,
        description: mode === 'assign'
          ? `${partnerName} теперь увидит таймщиты этих проектов в «Утверждение часов».`
          : 'Таймщиты по этим проектам пойдут к зам.директору.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <div className="p-6 text-muted-foreground">Войдите.</div>;
  if (!['deputy_director', 'ceo', 'admin'].includes(user.role)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>Назначение команды доступно зам.директору, CEO и админу.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-32">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Назначение команды
          </CardTitle>
          <CardDescription>
            Быстро найти проекты без команды и назначить партнёра/менеджера/ассистентов прямо здесь.
            После сохранения фильтр остаётся на месте — не нужно проваливаться в проект и возвращаться назад.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <button type="button" onClick={() => setFilter('all')} className={`rounded-lg border p-3 text-left ${filter === 'all' ? 'border-primary bg-primary/10' : ''}`}>
              <div className="text-xs text-muted-foreground">Всего проектов</div>
              <div className="text-2xl font-bold">{counts.total}</div>
            </button>
            <button type="button" onClick={() => setFilter('no_team')} className={`rounded-lg border p-3 text-left bg-red-50/50 ${filter === 'no_team' ? 'border-primary ring-1 ring-primary' : ''}`}>
              <div className="text-xs text-red-700">Без команды</div>
              <div className="text-2xl font-bold text-red-700">{counts.withoutTeam}</div>
            </button>
            <button type="button" onClick={() => setFilter('no_partner')} className={`rounded-lg border p-3 text-left bg-amber-50/50 ${filter === 'no_partner' ? 'border-primary ring-1 ring-primary' : ''}`}>
              <div className="text-xs text-amber-700">Без партнёра</div>
              <div className="text-2xl font-bold text-amber-700">{counts.withoutPartner}</div>
            </button>
            <button type="button" onClick={() => setFilter('with_partner')} className={`rounded-lg border p-3 text-left bg-emerald-50/50 ${filter === 'with_partner' ? 'border-primary ring-1 ring-primary' : ''}`}>
              <div className="text-xs text-emerald-700">С партнёром</div>
              <div className="text-2xl font-bold text-emerald-700">{counts.withPartner}</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setOnlyMine((v) => !v);
                if (!onlyMine && (filter === 'no_team' || filter === 'no_partner')) setFilter('with_partner');
              }}
              className={`rounded-lg border p-3 text-left transition ${onlyMine ? 'border-primary bg-primary/10' : 'bg-blue-50/50 hover:bg-blue-100/60'}`}
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

      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Показать</Label>
              <Select value={filter} onValueChange={(v) => setFilter(v as TeamFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_team">Без команды ({counts.withoutTeam})</SelectItem>
                  <SelectItem value="no_partner">Без партнёра ({counts.withoutPartner})</SelectItem>
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
                    {partnerEmployees.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                  {companyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label className="text-xs">Поиск</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Название проекта или клиента…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
                {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Найдено: <b>{enrichedRows.length}</b></CardTitle>
            {visibleIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={allSelected || (someSelected ? 'indeterminate' : false)} onCheckedChange={toggleAll} />
                Выделить всех ({visibleIds.length})
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {enrichedRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Ничего не найдено</div>
          ) : (
            <div className="divide-y max-h-[65vh] overflow-y-auto">
              {enrichedRows.map(({ project, team, partner }) => {
                const id = project.id;
                const checked = selected.has(id);
                const client = project.clientName || project.client?.name;
                const company = project.companyName || project.notes?.companyName;
                const mineMark = partner && partner.assignedBy === user.id;
                const isEditing = editingProjectId === id;
                const draft = teamDrafts[id] || buildTeamDraft(team);
                return (
                  <div key={id} className={checked ? 'bg-primary/5' : ''}>
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(id)} aria-label={`Выбрать ${project.name}`} />
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleOne(id)}>
                        <div className="text-sm font-medium truncate">{project.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {client && <>Клиент: {client}</>}{client && company && ' · '}{company && <>{company}</>}
                        </div>
                        {team.length > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Команда: {team.map((m) => m.userName).filter(Boolean).slice(0, 5).join(', ')}{team.length > 5 ? `, +${team.length - 5}` : ''}
                          </div>
                        )}
                      </div>
                      {team.length === 0 ? (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> нет команды</Badge>
                      ) : partner ? (
                        <Badge variant="outline" className={`text-xs border ${mineMark ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> {partner.userName}{mineMark && <span className="ml-1 opacity-70">· я</span>}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200"><AlertTriangle className="w-3 h-3 mr-1" /> нет партнёра</Badge>
                      )}
                      <Button type="button" variant={isEditing ? 'secondary' : 'outline'} size="sm" className="h-8 px-2 text-xs" onClick={() => openTeamEditor(id, team)}>
                        <Pencil className="w-3 h-3 mr-1" /> {isEditing ? 'Закрыть' : team.length ? 'Изменить' : 'Команда'}
                      </Button>
                    </div>

                    {isEditing && (
                      <div className="px-4 pb-4 pt-2 bg-muted/20 border-t">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {PROJECT_ROLES.map((role) => {
                            const options = employeesByRole.get(role.role) || [];
                            return (
                              <div key={role.role}>
                                <Label className="text-xs">{role.label} · {role.bonusPercent}%</Label>
                                <Select value={draft[role.role] || NONE} onValueChange={(value) => setDraftRole(id, role.role, value)}>
                                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NONE}>Не назначен</SelectItem>
                                    {options.map((emp: any) => <SelectItem key={emp.id} value={emp.id}>{emp.name || emp.email}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Button size="sm" onClick={() => saveTeam(id)} disabled={busy}>
                            <Save className="w-4 h-4 mr-2" /> Сохранить команду
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingProjectId(null)}>Отмена</Button>
                          <span className="text-xs text-muted-foreground">Сохраняет команду прямо здесь, без перехода в карточку проекта.</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(95vw,920px)]">
        <Card className="border-primary/40 shadow-2xl bg-background/95 backdrop-blur">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-sm">Выбрано: <b className="ml-1">{selected.size}</b></Badge>
            <Select value={bulkPartnerId} onValueChange={setBulkPartnerId}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Партнёр для выбранных…" /></SelectTrigger>
              <SelectContent>
                {partnerEmployees.length === 0 ? <div className="px-2 py-1.5 text-sm text-muted-foreground">Нет сотрудников с ролью «partner»</div> : partnerEmployees.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={busy || selected.size === 0 || !bulkPartnerId} onClick={() => apply('assign')}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Назначить партнёра ({selected.size})
            </Button>
            <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={busy || selected.size === 0} onClick={() => apply('unassign')} title="Снять партнёра — таймщиты пойдут к зам.дир">
              <X className="w-4 h-4 mr-2" /> Снять партнёра
            </Button>
            {selected.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Сбросить выбор</Button>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
