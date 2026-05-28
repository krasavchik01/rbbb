/**
 * CEO Финансовый свод — единая таблица бонусов по проектам.
 *
 * Что показывает:
 *   - KPI-карточки сверху (общий пул, прибыль, ждёт CEO, средний бонус).
 *   - Фильтр/поиск/сортировка над таблицей.
 *   - Таблица проектов: «Без НДС», «Вычеты», «Остаток», «Бонус», «Часы»,
 *     группы ролей (с членами и суммами), «Прибыль».
 *   - При клике на строку — раскрывается детальный блок с per-project
 *     слайдерами (overhead %, bonus %, доли ролей), формулой расчёта,
 *     командой с действиями (выплата / скрыть / правка суммы) и кнопкой
 *     «Утвердить и закрыть проект».
 *
 * Формула считается через единый src/lib/bonusCalculation.ts — то же что
 * используется на /bonuses (исторически calculateProjectFinances).
 */

import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROJECT_ROLES } from '@/types/roles';
import {
  ChevronDown,
  ChevronUp,
  Settings2,
  RotateCcw,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  computeProjectBonus,
  BONUS_ROLES,
  DEFAULT_DISTRIBUTION,
  DEFAULT_OVERHEAD_PERCENT,
  DEFAULT_BONUS_PERCENT,
  type BonusSettings,
  type BonusComputeResult,
} from '@/lib/bonusCalculation';
import { allProjectsHoursTotals, type ProjectHoursTotals } from '@/lib/timesheets';

// ─── Display config ─────────────────────────────────────────────────────────

const ROLE_GROUPS = [
  { key: 'partner',     label: 'Партнёр',      roles: ['partner'],                                    color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10',   border: 'border-violet-500/20' },
  { key: 'managers',    label: 'Менеджеры',    roles: ['manager_1', 'manager_2', 'manager_3'],         color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',     border: 'border-blue-500/20' },
  { key: 'supervisors', label: 'Супервайзеры', roles: ['supervisor_3', 'supervisor_2', 'supervisor_1'], color: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-500/10',     border: 'border-cyan-500/20' },
  { key: 'tax',         label: 'Налоговики',   roles: ['tax_specialist_1', 'tax_specialist_2'],        color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',    border: 'border-amber-500/20' },
  { key: 'assistants',  label: 'Ассистенты',   roles: ['assistant_3', 'assistant_2', 'assistant_1'],   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
] as const;

const ROLE_SHORT: Record<string, string> = {
  partner: 'П',
  manager_1: 'М1', manager_2: 'М2', manager_3: 'М3',
  supervisor_3: 'С3', supervisor_2: 'С2', supervisor_1: 'С1',
  tax_specialist_1: 'Н1', tax_specialist_2: 'Н2',
  assistant_3: 'А3', assistant_2: 'А2', assistant_1: 'А1',
};

const fmt = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v);

// ─── Types ──────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid';
type SortKey = 'name' | 'base' | 'bonus' | 'profit';
type SortDir = 'asc' | 'desc';

export interface CEOSummaryActions {
  approveAndClose?: (
    project: any,
    finalSettings: { bonusPercent: number; overheadPercent: number; distribution: Record<string, number> },
  ) => Promise<void>;
  markPaid?: (projectId: string, userId: string) => Promise<void>;
  unmarkPaid?: (projectId: string, userId: string) => Promise<void>;
  toggleHidden?: (projectId: string, userId: string, current: boolean) => Promise<void>;
  adjustAmount?: (projectId: string, userId: string, amount: number) => Promise<void>;
}

interface CEOSummaryTableProps {
  projects: any[];
  employees: any[];
  getProjectAmount: (project: any) => { amount: number | null; currency: string };
  getCompanyDisplayName: (company: string) => string;
  onProjectClick?: (project: any) => void;
  /** Стартовый фильтр — Bonuses page передаёт 'pending'. */
  initialStatusFilter?: StatusFilter;
  /** CEO-действия. Если не переданы — таблица в режиме «только просмотр». */
  actions?: CEOSummaryActions;
  /** Скрыть заголовок «CEO Финансовый свод» (если таблица встроена в страницу
   * со своим заголовком, например /bonuses). */
  hideHeader?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProjectStatus(project: any): string {
  return project?.notes?.status || project?.status || '';
}

/** Маппинг статусов проекта → фильтр CEO. */
function projectMatchesStatusFilter(project: any, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const s = getProjectStatus(project);
  if (filter === 'pending') return s === 'pending_payment_approval';
  if (filter === 'approved') return s === 'completed' && !hasAllPaid(project);
  if (filter === 'paid') return s === 'completed' && hasAllPaid(project);
  return true;
}

function hasAllPaid(project: any): boolean {
  const tb = project?.finances?.teamBonuses || {};
  const vals = Object.values(tb) as any[];
  if (vals.length === 0) return false;
  return vals.every((v) => v?.paidAt);
}

const STATUS_PILLS: Record<string, { label: string; tone: string }> = {
  pending_payment_approval: { label: 'Ждёт CEO',  tone: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed:                { label: 'Закрыт',    tone: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  in_progress:              { label: 'В работе',  tone: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  cancelled:                { label: 'Отменён',   tone: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CEOSummaryTable({
  projects,
  employees,
  getProjectAmount,
  getCompanyDisplayName,
  onProjectClick,
  initialStatusFilter = 'all',
  actions,
  hideHeader = false,
}: CEOSummaryTableProps) {
  // ─── Global settings (defaults для всех проектов) ─────────────────────────
  const [globalOverhead, setGlobalOverhead] = useState(DEFAULT_OVERHEAD_PERCENT);
  const [globalBonus, setGlobalBonus] = useState(DEFAULT_BONUS_PERCENT);
  const [globalDistribution, setGlobalDistribution] = useState<Record<string, number>>(
    () => ({ ...DEFAULT_DISTRIBUTION }),
  );
  const [showSettings, setShowSettings] = useState(false);

  // ─── Per-project overrides (CEO может «подкрутить» один проект) ───────────
  // Ключ: projectId → BonusSettings (если поле задано — оно override'ит global).
  const [overrides, setOverrides] = useState<Record<string, BonusSettings>>({});
  const updateOverride = useCallback((projectId: string, patch: BonusSettings) => {
    setOverrides((prev) => ({ ...prev, [projectId]: { ...prev[projectId], ...patch } }));
  }, []);
  const resetOverride = useCallback((projectId: string) => {
    setOverrides((prev) => {
      const n = { ...prev };
      delete n[projectId];
      return n;
    });
  }, []);

  // ─── Filters / search / sort ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [sortKey, setSortKey] = useState<SortKey>('base');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  // ─── Expanded row ─────────────────────────────────────────────────────────
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // ─── Часы по проектам ────────────────────────────────────────────────────
  const [hoursMap, setHoursMap] = useState<Map<string, ProjectHoursTotals>>(new Map());
  useEffect(() => {
    let active = true;
    allProjectsHoursTotals().then((m) => {
      if (active) setHoursMap(m);
    });
    return () => { active = false; };
  }, []);

  // ─── Employee lookup ──────────────────────────────────────────────────────
  const employeeMap = useMemo(() => {
    const map: Record<string, any> = {};
    (employees || []).forEach((e: any) => {
      if (e?.id) map[e.id] = e;
    });
    return map;
  }, [employees]);

  const getEmployeeName = useCallback(
    (userId: string, fallback?: string): string => {
      const emp = employeeMap[userId];
      if (emp) return emp.name || emp.full_name || fallback || '—';
      return fallback || '—';
    },
    [employeeMap],
  );

  // ─── Compute rows ────────────────────────────────────────────────────────
  type Row = BonusComputeResult & {
    project: any;
    id: string;
    name: string;
    company: string;
    currency: string;
    status: string;
    hours: ProjectHoursTotals;
    effectiveSettings: { overheadPercent: number; bonusPercent: number; distribution: Record<string, number> };
  };

  const rows: Row[] = useMemo(() => {
    return projects.map((project) => {
      const id = project?.id || project?.notes?.id || '';
      const override = overrides[id] || {};
      const settings: BonusSettings = {
        overheadPercent: override.overheadPercent ?? globalOverhead,
        bonusPercent: override.bonusPercent ?? globalBonus,
        distribution: { ...globalDistribution, ...(override.distribution || {}) },
      };
      const r = computeProjectBonus(project, settings);
      // Если у проекта есть свой finances.bonusPercent — он уже учтён в r,
      // но мы хотим, чтобы override из этого UI имел приоритет. Поэтому
      // если CEO выставил override.bonusPercent — пересчитываем.
      const company =
        getCompanyDisplayName(project?.companyName || project?.company || project?.ourCompany || '') ||
        project?.companyName ||
        '—';
      const amt = getProjectAmount(project);
      return {
        ...r,
        project,
        id,
        name: project?.name || project?.notes?.name || 'Без названия',
        company,
        currency: amt.currency,
        status: getProjectStatus(project),
        hours: hoursMap.get(id) || { approved: 0, pending: 0 },
        effectiveSettings: {
          overheadPercent: settings.overheadPercent!,
          bonusPercent: settings.bonusPercent!,
          distribution: settings.distribution!,
        },
      };
    });
  }, [projects, overrides, globalOverhead, globalBonus, globalDistribution, hoursMap, getProjectAmount, getCompanyDisplayName]);

  // ─── Apply filters ────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let out = rows;
    if (needle) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.company.toLowerCase().includes(needle),
      );
    }
    if (statusFilter !== 'all') {
      out = out.filter((r) => projectMatchesStatusFilter(r.project, statusFilter));
    }
    const sorted = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'ru');
      else if (sortKey === 'base') cmp = a.base - b.base;
      else if (sortKey === 'bonus') cmp = a.bonusPool - b.bonusPool;
      else if (sortKey === 'profit') cmp = a.grossProfit - b.grossProfit;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, statusFilter, sortKey, sortDir]);

  // ─── Totals across visible rows ──────────────────────────────────────────
  const totals = useMemo(() => {
    const t = { base: 0, overhead: 0, contractors: 0, remainder: 0, bonusPool: 0, totalBonuses: 0, grossProfit: 0, roleBonuses: {} as Record<string, number> };
    BONUS_ROLES.forEach((r) => (t.roleBonuses[r.role] = 0));
    filteredRows.forEach((r) => {
      t.base += r.base;
      t.overhead += r.overhead;
      t.contractors += r.contractors;
      t.remainder += r.remainder;
      t.bonusPool += r.bonusPool;
      t.totalBonuses += r.totalPaidBonuses;
      t.grossProfit += r.grossProfit;
      BONUS_ROLES.forEach((br) => (t.roleBonuses[br.role] += r.roleBonuses[br.role] || 0));
    });
    return t;
  }, [filteredRows]);

  // ─── KPI numbers ──────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const pendingCount = rows.filter((r) => projectMatchesStatusFilter(r.project, 'pending')).length;
    const uniqueRecipients = new Set<string>();
    filteredRows.forEach((r) => r.members.forEach((m) => m.userId && uniqueRecipients.add(m.userId)));
    const avgBonus = uniqueRecipients.size > 0 ? totals.totalBonuses / uniqueRecipients.size : 0;
    return {
      pool: totals.bonusPool,
      profit: totals.grossProfit,
      pendingCount,
      avgBonus,
      paidOut: totals.totalBonuses,
      projectsCount: filteredRows.length,
    };
  }, [rows, filteredRows, totals]);

  // ─── Role group totals ────────────────────────────────────────────────────
  const groupTotals = useMemo(() => {
    const gt: Record<string, number> = {};
    ROLE_GROUPS.forEach((g) => {
      gt[g.key] = g.roles.reduce((s, r) => s + (totals.roleBonuses[r] || 0), 0);
    });
    return gt;
  }, [totals]);

  // ─── Per-person analytics ─────────────────────────────────────────────────
  const personAnalytics = useMemo(() => {
    const map: Record<string, {
      userId: string;
      name: string;
      roles: Set<string>;
      projects: { projectName: string; projectId: string; role: string; bonusAmount: number }[];
      totalBonus: number;
    }> = {};
    filteredRows.forEach((row) => {
      row.members.forEach((m) => {
        if (!m.userId) return;
        if (!map[m.userId]) {
          map[m.userId] = {
            userId: m.userId,
            name: getEmployeeName(m.userId, m.userName),
            roles: new Set(),
            projects: [],
            totalBonus: 0,
          };
        }
        const roleLabel = PROJECT_ROLES.find((r) => r.role === m.role)?.label || m.role;
        map[m.userId].roles.add(roleLabel);
        map[m.userId].projects.push({
          projectName: row.name,
          projectId: row.id,
          role: roleLabel,
          bonusAmount: m.finalAmount,
        });
        map[m.userId].totalBonus += m.finalAmount;
      });
    });
    return Object.values(map).sort((a, b) => b.totalBonus - a.totalBonus);
  }, [filteredRows, getEmployeeName]);

  const resetGlobal = useCallback(() => {
    setGlobalOverhead(DEFAULT_OVERHEAD_PERCENT);
    setGlobalBonus(DEFAULT_BONUS_PERCENT);
    setGlobalDistribution({ ...DEFAULT_DISTRIBUTION });
  }, []);

  const distributionTotal = useMemo(
    () => Object.values(globalDistribution).reduce((s, v) => s + v, 0),
    [globalDistribution],
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        {!hideHeader && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">CEO Финансовый свод</h3>
                  <p className="text-sm text-muted-foreground">
                    Проекты, бонусы команды, аналитика по сотрудникам
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)} className="gap-1.5">
                  <Settings2 className="w-4 h-4" />
                  Дефолты
                  {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetGlobal} title="Сбросить дефолты">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Дефолты (global settings) ───────────────────────────────────── */}
        {showSettings && (
          <div className="p-4 border-b border-border bg-muted/30 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SliderField label="Накладные (предрасход), дефолт" value={globalOverhead} onChange={setGlobalOverhead} max={50} />
              <SliderField label="Бонусный фонд, дефолт" value={globalBonus} onChange={setGlobalBonus} max={30} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Распределение бонусов по ролям (дефолт)</Label>
                <Badge variant={Math.abs(distributionTotal - 100) < 0.5 ? 'default' : 'destructive'} className="tabular-nums">
                  {distributionTotal}% / 100%
                </Badge>
              </div>
              {ROLE_GROUPS.map((group) => (
                <DistributionGroup
                  key={group.key}
                  group={group}
                  distribution={globalDistribution}
                  onChange={(role, v) => setGlobalDistribution((p) => ({ ...p, [role]: v }))}
                />
              ))}
              {Math.abs(distributionTotal - 100) >= 0.5 && (
                <p className="text-xs text-destructive font-medium">
                  Сумма должна быть 100%. Сейчас: {distributionTotal}%
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── KPI cards ────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI label="Проектов" value={String(kpi.projectsCount)} tone="text-primary" icon={<BarChart3 className="w-4 h-4" />} />
            <KPI label="Ждёт CEO" value={String(kpi.pendingCount)} tone="text-amber-500" icon={<AlertTriangle className="w-4 h-4" />} />
            <KPI label="Общий бонус-пул" value={fmt(kpi.pool)} tone="text-green-500" icon={<DollarSign className="w-4 h-4" />} />
            <KPI label="Выплачено / запланировано" value={fmt(kpi.paidOut)} tone="text-emerald-500" icon={<CheckCircle2 className="w-4 h-4" />} />
            <KPI label="Средний бонус на чел." value={fmt(kpi.avgBonus)} tone="text-blue-500" icon={<Users className="w-4 h-4" />} />
            <KPI label="Чистая прибыль" value={fmt(kpi.profit)} tone={kpi.profit >= 0 ? 'text-emerald-600' : 'text-red-500'} icon={<TrendingUp className="w-4 h-4" />} />
          </div>
        </div>

        {/* ── Filters bar ──────────────────────────────────────────────────── */}
        <div className="p-3 border-b border-border bg-muted/20 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по проекту или клиенту…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 text-sm w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="pending">Ждут CEO</SelectItem>
              <SelectItem value="approved">Закрыт, не выплачен</SelectItem>
              <SelectItem value="paid">Полностью выплачен</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => {
            const [k, d] = v.split(':') as [SortKey, SortDir];
            setSortKey(k); setSortDir(d);
          }}>
            <SelectTrigger className="h-9 text-sm w-[200px]">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base:desc">По сумме без НДС ↓</SelectItem>
              <SelectItem value="base:asc">По сумме без НДС ↑</SelectItem>
              <SelectItem value="bonus:desc">По бонус-пулу ↓</SelectItem>
              <SelectItem value="profit:desc">По прибыли ↓</SelectItem>
              <SelectItem value="name:asc">По имени А-Я</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            показано {filteredRows.length} из {rows.length}
          </div>
        </div>

        {/* ── Tabs: Table / Analytics ──────────────────────────────────────── */}
        <Tabs defaultValue="table" className="w-full">
          <div className="px-4 pt-3">
            <TabsList className="w-auto">
              <TabsTrigger value="table" className="gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" /> Таблица проектов
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" /> По сотрудникам
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ━━ TABLE TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="table" className="mt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase w-8">#</th>
                    <th
                      className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[180px] cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('name')}
                    >Проект</th>
                    <th
                      className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('base')}
                    >Без НДС</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-red-500 uppercase">Вычеты</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-blue-500 uppercase">Остаток</th>
                    <th
                      className="px-2 py-2 text-right text-[10px] font-semibold text-green-500 uppercase cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('bonus')}
                    >Бонус</th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-cyan-500 uppercase">Часы</th>
                    {ROLE_GROUPS.map((g) => (
                      <th key={g.key} className={`px-2 py-2 text-left text-[10px] font-semibold uppercase min-w-[140px] ${g.color}`}>
                        {g.label}
                        <br />
                        <span className="font-bold">{g.roles.reduce((s, r) => s + (globalDistribution[r] || 0), 0)}%</span>
                      </th>
                    ))}
                    <th
                      className="px-2 py-2 text-right text-[10px] font-semibold text-emerald-600 uppercase cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('profit')}
                    >Прибыль</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row, idx) => {
                    const isExpanded = expandedProject === row.id;
                    const statusPill = STATUS_PILLS[row.status];
                    return (
                      <Fragment key={row.id || idx}>
                        <tr
                          className={`hover:bg-secondary/20 transition-colors cursor-pointer ${isExpanded ? 'bg-secondary/10' : ''}`}
                          onClick={() => setExpandedProject(isExpanded ? null : row.id)}
                        >
                          <td className="px-2 py-2.5 text-xs text-muted-foreground tabular-nums">{idx + 1}</td>
                          <td className="px-2 py-2.5 min-w-[180px]">
                            <div className="flex items-start gap-1.5">
                              {isExpanded ? <ChevronUp className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onProjectClick?.(row.project); }}
                                  title="Открыть карточку проекта"
                                  className="group flex items-start gap-1 text-left font-medium text-xs leading-tight hover:text-primary transition-colors"
                                >
                                  <span className="line-clamp-2">{row.name}</span>
                                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[160px]">{row.company}</div>
                                {statusPill && (
                                  <Badge variant="outline" className={`mt-1 text-[9px] py-0 px-1.5 border ${statusPill.tone}`}>
                                    {statusPill.label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="text-xs font-medium tabular-nums">{row.base > 0 ? fmt(row.base) : '—'}</span>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <div className="text-xs text-red-500 tabular-nums">-{fmt(row.overhead + row.contractors)}</div>
                            {row.contractors > 0 && (
                              <div className="text-[9px] text-orange-400">ГПХ: {fmt(row.contractors)}</div>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 tabular-nums">{fmt(row.remainder)}</span>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular-nums">{fmt(row.bonusPool)}</span>
                            <div className="text-[9px] text-muted-foreground">{row.effectiveSettings.bonusPercent}% от остатка</div>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400 tabular-nums">{fmt(row.hours.approved)}</div>
                            {row.hours.pending > 0 && (
                              <div className="text-[9px] text-amber-500 tabular-nums">+{fmt(row.hours.pending)} ждёт</div>
                            )}
                          </td>
                          {ROLE_GROUPS.map((g) => {
                            const members = row.members.filter((m) => (g.roles as readonly string[]).includes(m.role));
                            const groupTotal = g.roles.reduce((s, r) => s + (row.roleBonuses[r] || 0), 0);
                            const groupPotential = g.roles.reduce((s, r) => s + (row.rolePotential[r] || 0), 0);
                            return (
                              <td key={g.key} className="px-2 py-1.5 align-top min-w-[140px]">
                                {members.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {members.map((m) => (
                                      <div key={m.userId + m.role} className="flex items-baseline justify-between gap-1">
                                        <span className="text-[11px] truncate max-w-[80px]" title={getEmployeeName(m.userId, m.userName)}>
                                          <span className="text-[9px] text-muted-foreground mr-0.5">{ROLE_SHORT[m.role]}</span>
                                          {getEmployeeName(m.userId, m.userName).split(' ')[0]}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground tabular-nums">{m.bonusPct.toFixed(0)}%</span>
                                        <span className="text-[11px] font-semibold tabular-nums whitespace-nowrap">{fmt(m.finalAmount)}</span>
                                      </div>
                                    ))}
                                    {members.length > 1 && (
                                      <div className={`text-[9px] font-bold tabular-nums text-right pt-0.5 border-t border-border/50 ${g.color}`}>
                                        = {fmt(groupTotal)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground/50 italic">
                                    не назначен
                                    {groupPotential > 0 && (
                                      <span className="block opacity-70 not-italic">({fmt(groupPotential)})</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2.5 text-right">
                            <span className={`text-xs font-bold tabular-nums ${row.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {fmt(row.grossProfit)}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8 + ROLE_GROUPS.length} className="p-0">
                              <ProjectDetail
                                row={row}
                                employees={employees}
                                actions={actions}
                                onOpenProject={() => onProjectClick?.(row.project)}
                                onChangeOverride={(patch) => updateOverride(row.id, patch)}
                                onResetOverride={() => resetOverride(row.id)}
                                hasOverride={!!overrides[row.id]}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-secondary/50 font-semibold border-t-2 border-border">
                  <tr>
                    <td className="px-2 py-3" />
                    <td className="px-2 py-3 text-xs">ИТОГО ({filteredRows.length})</td>
                    <td className="px-2 py-3 text-right text-xs tabular-nums">{fmt(totals.base)}</td>
                    <td className="px-2 py-3 text-right text-xs text-red-500 tabular-nums">-{fmt(totals.overhead + totals.contractors)}</td>
                    <td className="px-2 py-3 text-right text-xs text-blue-600 dark:text-blue-400 tabular-nums">{fmt(totals.remainder)}</td>
                    <td className="px-2 py-3 text-right text-xs text-green-600 dark:text-green-400 tabular-nums">{fmt(totals.bonusPool)}</td>
                    <td className="px-2 py-3" />
                    {ROLE_GROUPS.map((g) => (
                      <td key={g.key} className={`px-2 py-3 text-right text-xs font-bold tabular-nums ${g.color}`}>{fmt(groupTotals[g.key])}</td>
                    ))}
                    <td className={`px-2 py-3 text-right text-xs tabular-nums ${totals.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {fmt(totals.grossProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* ━━ ANALYTICS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="analytics" className="mt-0 p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {ROLE_GROUPS.map((g) => (
                <div key={g.key} className={`p-3 rounded-lg border ${g.border} ${g.bg}`}>
                  <div className={`text-xs font-semibold ${g.color}`}>{g.label}</div>
                  <div className="text-lg font-bold tabular-nums mt-1">{fmt(groupTotals[g.key])}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {g.roles.reduce((s, r) => s + (globalDistribution[r] || 0), 0)}% от пула
                  </div>
                </div>
              ))}
            </div>

            <Card className="overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/30">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Сводка по сотрудникам ({personAnalytics.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase w-8">#</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Сотрудник</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Роли</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">Проектов</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-green-500 uppercase">Общий бонус</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[200px]">Детализация</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {personAnalytics.map((person, idx) => (
                      <tr key={person.userId} className="hover:bg-secondary/20">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-sm">{person.name}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(person.roles).map((role) => (
                              <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0">{role}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums">{person.projects.length}</td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">{fmt(person.totalBonus)}</td>
                        <td className="px-3 py-2 min-w-[200px]">
                          <div className="space-y-0.5">
                            {person.projects.map((p, i) => (
                              <div key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
                                <span className="truncate max-w-[180px] text-muted-foreground" title={p.projectName}>
                                  {p.projectName}
                                  <span className="text-[9px] ml-1 opacity-60">({p.role})</span>
                                </span>
                                <span className="font-semibold tabular-nums whitespace-nowrap">{fmt(p.bonusAmount)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {personAnalytics.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Нет назначенных сотрудников в проектах</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {filteredRows.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Нет проектов по вашему фильтру</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KPI({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={tone}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${tone}`}>{value}</div>
    </div>
  );
}

function SliderField({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm font-bold text-primary tabular-nums">{value}%</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={0} max={max} step={1} />
    </div>
  );
}

function DistributionGroup({
  group,
  distribution,
  onChange,
}: {
  group: typeof ROLE_GROUPS[number];
  distribution: Record<string, number>;
  onChange: (role: string, v: number) => void;
}) {
  return (
    <div className={`p-3 rounded-lg border ${group.border} ${group.bg}`}>
      <div className={`text-xs font-semibold mb-2 ${group.color}`}>
        {group.label} ({group.roles.reduce((s, r) => s + (distribution[r] || 0), 0)}%)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
        {group.roles.map((role) => {
          const pr = PROJECT_ROLES.find((r) => r.role === role);
          return (
            <div key={role} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{pr?.label || role}</span>
                <span className="text-[11px] font-bold tabular-nums w-7 text-right">{distribution[role] || 0}%</span>
              </div>
              <Slider value={[distribution[role] || 0]} onValueChange={([v]) => onChange(role, v)} min={0} max={50} step={1} className="h-3" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Expanded row: details + per-project tweaks + actions ───────────────────

function ProjectDetail({
  row,
  employees,
  actions,
  onOpenProject,
  onChangeOverride,
  onResetOverride,
  hasOverride,
}: {
  row: {
    id: string; name: string; project: any;
    base: number; overhead: number; overheadPercent: number;
    contractors: number; remainder: number; bonusPercent: number; bonusPool: number;
    grossProfit: number; members: any[]; roleBonuses: Record<string, number>; rolePotential: Record<string, number>;
    effectiveSettings: { overheadPercent: number; bonusPercent: number; distribution: Record<string, number> };
  };
  employees: any[];
  actions?: CEOSummaryActions;
  onOpenProject?: () => void;
  onChangeOverride: (patch: BonusSettings) => void;
  onResetOverride: () => void;
  hasOverride: boolean;
}) {
  const eff = row.effectiveSettings;
  const distTotal = Object.values(eff.distribution).reduce((s, v) => s + v, 0);
  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    (employees || []).forEach((e: any) => { if (e?.id) m[e.id] = e; });
    return m;
  }, [employees]);
  const empName = (uid: string, fb?: string) => empMap[uid]?.name || fb || '—';

  const [adjustDraft, setAdjustDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const approveAll = async () => {
    if (!actions?.approveAndClose) return;
    setBusy(true);
    try {
      await actions.approveAndClose(row.project, {
        bonusPercent: eff.bonusPercent,
        overheadPercent: eff.overheadPercent,
        distribution: eff.distribution,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3 bg-muted/20 border-b border-border space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold">{row.name}</h4>
          {hasOverride && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
              переопределено для этого проекта
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasOverride && (
            <Button variant="ghost" size="sm" onClick={onResetOverride} className="text-xs h-7 gap-1">
              <RotateCcw className="w-3 h-3" /> Сбросить override
            </Button>
          )}
          {onOpenProject && (
            <Button variant="outline" size="sm" onClick={onOpenProject} className="text-xs h-7">
              Открыть проект
            </Button>
          )}
          {actions?.approveAndClose && (
            <Button size="sm" onClick={approveAll} disabled={busy} className="text-xs h-7 gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Утвердить и закрыть
            </Button>
          )}
        </div>
      </div>

      {/* Per-project sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-background/60 border border-border">
        <SliderField
          label={`Накладные (этот проект)`}
          value={eff.overheadPercent}
          onChange={(v) => onChangeOverride({ overheadPercent: v })}
          max={50}
        />
        <SliderField
          label={`Бонусный фонд (этот проект)`}
          value={eff.bonusPercent}
          onChange={(v) => onChangeOverride({ bonusPercent: v })}
          max={30}
        />
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Распределение по ролям (этот проект)</Label>
            <Badge variant={Math.abs(distTotal - 100) < 0.5 ? 'default' : 'destructive'} className="text-[10px] tabular-nums">
              {distTotal}% / 100%
            </Badge>
          </div>
          {ROLE_GROUPS.map((g) => (
            <DistributionGroup
              key={g.key}
              group={g}
              distribution={eff.distribution}
              onChange={(role, v) =>
                onChangeOverride({ distribution: { ...eff.distribution, [role]: v } })
              }
            />
          ))}
        </div>
      </div>

      {/* Formula breakdown */}
      <div className="p-3 rounded-lg bg-background/60 text-xs space-y-1 max-w-lg border border-border">
        <Line label="Сумма без НДС" value={fmt(row.base)} />
        <Line label={`Накладные (${eff.overheadPercent}%)`} value={`-${fmt(row.overhead)}`} tone="text-red-500" />
        {row.contractors > 0 && <Line label="ГПХ / Субподряд" value={`-${fmt(row.contractors)}`} tone="text-orange-500" />}
        <Line label="Остаток" value={fmt(row.remainder)} tone="text-blue-500" bold />
        <Line label={`Бонусный фонд (${eff.bonusPercent}%)`} value={fmt(row.bonusPool)} tone="text-green-500" />
        <Line label="Чистая прибыль" value={fmt(row.grossProfit)} tone={row.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'} bold />
      </div>

      {/* Members with actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {row.members.length === 0 ? (
          <div className="col-span-2 p-4 text-center text-xs text-muted-foreground rounded-lg border border-dashed">
            В команду пока никого не назначили. Назначьте, чтобы бонусы посчитались.
          </div>
        ) : (
          row.members.map((m: any) => {
            const roleLabel = PROJECT_ROLES.find((r) => r.role === m.role)?.label || m.role;
            const draft = adjustDraft[m.userId];
            const onAdjust = async () => {
              if (!actions?.adjustAmount) return;
              const n = Number(draft);
              if (!Number.isFinite(n) || n < 0) return;
              setBusy(true);
              try {
                await actions.adjustAmount(row.id, m.userId, n);
                setAdjustDraft((p) => { const x = { ...p }; delete x[m.userId]; return x; });
              } finally { setBusy(false); }
            };
            return (
              <div key={m.userId} className="p-3 rounded-lg border border-border bg-background/60">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{empName(m.userId, m.userName)}</div>
                    <div className="text-[11px] text-muted-foreground">{roleLabel} • {m.bonusPct.toFixed(1)}% от пула</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">{fmt(m.finalAmount)}</div>
                    {m.manuallyAdjusted && (
                      <div className="text-[9px] text-amber-600">правка CEO (план: {fmt(m.plannedAmount)})</div>
                    )}
                    {m.paidAt && <div className="text-[9px] text-emerald-600">выплачено {new Date(m.paidAt).toLocaleDateString('ru')}</div>}
                  </div>
                </div>
                {actions && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {actions.adjustAmount && (
                      <>
                        <Input
                          type="number"
                          value={draft ?? String(Math.round(m.finalAmount))}
                          onChange={(e) => setAdjustDraft((p) => ({ ...p, [m.userId]: e.target.value }))}
                          className="h-7 text-xs w-28"
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdjust} disabled={busy}>
                          Сохранить
                        </Button>
                      </>
                    )}
                    {actions.markPaid && !m.paidAt && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => actions.markPaid!(row.id, m.userId)} disabled={busy}>
                        <CheckCircle2 className="w-3 h-3" /> Выплачено
                      </Button>
                    )}
                    {actions.unmarkPaid && m.paidAt && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => actions.unmarkPaid!(row.id, m.userId)} disabled={busy}>
                        Снять выплату
                      </Button>
                    )}
                    {actions.toggleHidden && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => actions.toggleHidden!(row.id, m.userId, !!m.hiddenFromEmployee)}
                        disabled={busy}
                      >
                        {m.hiddenFromEmployee ? <><EyeOff className="w-3 h-3" /> скрыт</> : <><Eye className="w-3 h-3" /> виден</>}
                      </Button>
                    )}
                  </div>
                )}
                {m.history && m.history.length > 0 && (
                  <HistoryRow history={m.history} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Line({ label, value, tone, bold }: { label: string; value: string; tone?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${tone || ''} ${bold ? 'font-bold border-t border-border pt-1' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function HistoryRow({ history }: { history: Array<{ type: string; by?: string; byName?: string; at: string; from?: unknown; to?: unknown }> }) {
  const [open, setOpen] = useState(false);
  if (!history.length) return null;
  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
        <Clock className="w-3 h-3" />
        История ({history.length})
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
          {history.slice().reverse().map((h, i) => (
            <li key={i}>
              {new Date(h.at).toLocaleString('ru')} — {h.byName || '?'} — {h.type}
              {h.from !== undefined && h.to !== undefined && (
                <span> ({String(h.from)} → {String(h.to)})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
