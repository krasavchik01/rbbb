import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROJECT_ROLES } from "@/types/roles";
import {
  ChevronDown,
  ChevronUp,
  Settings2,
  RotateCcw,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────
interface CEOSummaryTableProps {
  projects: any[];
  employees: any[];
  getProjectAmount: (project: any) => { amount: number | null; currency: string };
  getCompanyDisplayName: (company: string) => string;
  onProjectClick?: (project: any) => void;
}

// Role groups for display
const ROLE_GROUPS = [
  {
    key: "partner",
    label: "Партнёр",
    roles: ["partner"],
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    key: "managers",
    label: "Менеджеры",
    roles: ["manager_1", "manager_2", "manager_3"],
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    key: "supervisors",
    label: "Супервайзеры",
    roles: ["supervisor_3", "supervisor_2", "supervisor_1"],
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    key: "tax",
    label: "Налоговики",
    roles: ["tax_specialist_1", "tax_specialist_2"],
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    key: "assistants",
    label: "Ассистенты",
    roles: ["assistant_3", "assistant_2", "assistant_1"],
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
] as const;

// Bonus roles from PROJECT_ROLES
const BONUS_ROLES = PROJECT_ROLES.filter((r) => r.bonusPercent > 0);
const DEFAULT_DIST: Record<string, number> = {};
BONUS_ROLES.forEach((r) => (DEFAULT_DIST[r.role] = r.bonusPercent));

const ROLE_SHORT: Record<string, string> = {
  partner: "П",
  manager_1: "М1",
  manager_2: "М2",
  manager_3: "М3",
  supervisor_3: "С3",
  supervisor_2: "С2",
  supervisor_1: "С1",
  tax_specialist_1: "Н1",
  tax_specialist_2: "Н2",
  assistant_3: "А3",
  assistant_2: "А2",
  assistant_1: "А1",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v);

// ─── Component ──────────────────────────────────────────────
export function CEOSummaryTable({
  projects,
  employees,
  getProjectAmount,
  getCompanyDisplayName,
  onProjectClick,
}: CEOSummaryTableProps) {
  // Settings
  const [overheadPercent, setOverheadPercent] = useState(30);
  const [bonusPercent, setBonusPercent] = useState(10);
  const [distribution, setDistribution] = useState<Record<string, number>>(
    () => ({ ...DEFAULT_DIST })
  );
  const [showSettings, setShowSettings] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const distributionTotal = useMemo(
    () => Object.values(distribution).reduce((s, v) => s + v, 0),
    [distribution]
  );

  const resetSettings = useCallback(() => {
    setOverheadPercent(30);
    setBonusPercent(10);
    setDistribution({ ...DEFAULT_DIST });
  }, []);

  // Employee lookup
  const employeeMap = useMemo(() => {
    const map: Record<string, any> = {};
    (employees || []).forEach((e: any) => {
      if (e.id) map[e.id] = e;
    });
    return map;
  }, [employees]);

  const getEmployeeName = useCallback(
    (userId: string, fallback?: string): string => {
      const emp = employeeMap[userId];
      if (emp) return emp.name || emp.full_name || fallback || "—";
      return fallback || "—";
    },
    [employeeMap]
  );

  // Extract contractors amount
  const getContractorsAmount = useCallback((project: any): number => {
    const paths = [
      project.notes?.finances?.totalContractorsAmount,
      project.finances?.totalContractorsAmount,
      (() => {
        const arr =
          project.notes?.finances?.contractors ||
          project.finances?.contractors ||
          project.notes?.contractors ||
          [];
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.reduce(
            (sum: number, c: any) => sum + (Number(c.amount) || 0),
            0
          );
        }
        return null;
      })(),
    ];
    for (const val of paths) {
      if (val != null && typeof val === "number" && val > 0) return val;
    }
    return 0;
  }, []);

  // ─── Per-project calculation ──────────────────────────────
  const projectRows = useMemo(() => {
    return projects.map((project) => {
      const { amount: amountNoVAT, currency } = getProjectAmount(project);
      const base = amountNoVAT || 0;
      const overhead = base * (overheadPercent / 100);
      const contractors = getContractorsAmount(project);
      const remainder = Math.max(0, base - overhead - contractors);
      const bonusPool = remainder * (bonusPercent / 100);

      // Team from project
      const rawTeam: any[] =
        project.team || project.notes?.team || [];

      // Match team members to roles, calculate bonuses
      type MemberBonus = {
        userId: string;
        name: string;
        role: string;
        roleLabel: string;
        bonusPct: number;
        bonusAmount: number;
      };

      const memberBonuses: MemberBonus[] = [];
      const roleBonuses: Record<string, number> = {};
      BONUS_ROLES.forEach((r) => {
        const pct = distribution[r.role] || 0;
        const amount = bonusPool * (pct / 100);
        roleBonuses[r.role] = amount;

        // Find team member for this role
        const member = rawTeam.find(
          (m: any) =>
            (m.role || m.role_on_project) === r.role
        );
        if (member) {
          const userId = member.userId || member.id || member.employeeId || "";
          memberBonuses.push({
            userId,
            name:
              getEmployeeName(userId, member.name || member.userName) ||
              member.name ||
              member.userName ||
              "Неизвестный",
            role: r.role,
            roleLabel: r.label,
            bonusPct: pct,
            bonusAmount: amount,
          });
        }
      });

      const totalBonuses = Object.values(roleBonuses).reduce(
        (s, v) => s + v,
        0
      );
      const grossProfit = remainder - totalBonuses;

      // Company
      const rawCompany =
        project.companyName ||
        project.company ||
        project.ourCompany ||
        project.notes?.companyName ||
        "";
      const company =
        getCompanyDisplayName(rawCompany) || rawCompany || "—";

      return {
        project,
        id: project.id || project.notes?.id,
        name: project.name || project.notes?.name || "Без названия",
        company,
        currency,
        base,
        overhead,
        contractors,
        remainder,
        bonusPool,
        roleBonuses,
        memberBonuses,
        totalBonuses,
        grossProfit,
        rawTeam,
      };
    });
  }, [
    projects,
    overheadPercent,
    bonusPercent,
    distribution,
    getProjectAmount,
    getContractorsAmount,
    getCompanyDisplayName,
    getEmployeeName,
  ]);

  // ─── Totals ───────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = {
      base: 0,
      overhead: 0,
      contractors: 0,
      remainder: 0,
      bonusPool: 0,
      totalBonuses: 0,
      grossProfit: 0,
      roleBonuses: {} as Record<string, number>,
    };
    BONUS_ROLES.forEach((r) => (t.roleBonuses[r.role] = 0));
    projectRows.forEach((row) => {
      t.base += row.base;
      t.overhead += row.overhead;
      t.contractors += row.contractors;
      t.remainder += row.remainder;
      t.bonusPool += row.bonusPool;
      t.totalBonuses += row.totalBonuses;
      t.grossProfit += row.grossProfit;
      BONUS_ROLES.forEach((r) => {
        t.roleBonuses[r.role] += row.roleBonuses[r.role];
      });
    });
    return t;
  }, [projectRows]);

  // ─── Per-person analytics ─────────────────────────────────
  const personAnalytics = useMemo(() => {
    const map: Record<
      string,
      {
        userId: string;
        name: string;
        roles: Set<string>;
        projects: { projectName: string; projectId: string; role: string; bonusAmount: number }[];
        totalBonus: number;
      }
    > = {};

    projectRows.forEach((row) => {
      row.memberBonuses.forEach((mb) => {
        if (!mb.userId) return;
        if (!map[mb.userId]) {
          map[mb.userId] = {
            userId: mb.userId,
            name: mb.name,
            roles: new Set(),
            projects: [],
            totalBonus: 0,
          };
        }
        map[mb.userId].roles.add(mb.roleLabel);
        map[mb.userId].projects.push({
          projectName: row.name,
          projectId: row.id,
          role: mb.roleLabel,
          bonusAmount: mb.bonusAmount,
        });
        map[mb.userId].totalBonus += mb.bonusAmount;
      });
    });

    return Object.values(map).sort((a, b) => b.totalBonus - a.totalBonus);
  }, [projectRows]);

  // ─── Role group totals ────────────────────────────────────
  const groupTotals = useMemo(() => {
    const gt: Record<string, number> = {};
    ROLE_GROUPS.forEach((g) => {
      gt[g.key] = g.roles.reduce(
        (sum, role) => sum + (totals.roleBonuses[role] || 0),
        0
      );
    });
    return gt;
  }, [totals]);

  // ─── Helper: get members for a group in a project row ─────
  const getGroupMembers = (
    row: (typeof projectRows)[0],
    groupRoles: readonly string[]
  ) =>
    row.memberBonuses.filter((mb) => groupRoles.includes(mb.role));

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  CEO Финансовый свод
                </h3>
                <p className="text-sm text-muted-foreground">
                  Проекты, бонусы команды, аналитика по сотрудникам
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings((v) => !v)}
                className="gap-1.5"
              >
                <Settings2 className="w-4 h-4" />
                Настройки
                {showSettings ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSettings}
                title="Сбросить"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Settings Panel ──────────────────────────────── */}
        {showSettings && (
          <div className="p-4 border-b border-border bg-muted/30 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Накладные (предрасход)
                  </Label>
                  <span className="text-sm font-bold text-primary tabular-nums">
                    {overheadPercent}%
                  </span>
                </div>
                <Slider
                  value={[overheadPercent]}
                  onValueChange={([v]) => setOverheadPercent(v)}
                  min={0}
                  max={50}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Бонусный фонд
                  </Label>
                  <span className="text-sm font-bold text-primary tabular-nums">
                    {bonusPercent}%
                  </span>
                </div>
                <Slider
                  value={[bonusPercent]}
                  onValueChange={([v]) => setBonusPercent(v)}
                  min={0}
                  max={30}
                  step={1}
                />
              </div>
            </div>

            {/* Distribution by role groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Распределение бонусов по ролям
                </Label>
                <Badge
                  variant={
                    Math.abs(distributionTotal - 100) < 0.5
                      ? "default"
                      : "destructive"
                  }
                  className="tabular-nums"
                >
                  {distributionTotal}% / 100%
                </Badge>
              </div>

              {ROLE_GROUPS.map((group) => (
                <div key={group.key} className={`p-3 rounded-lg border ${group.border} ${group.bg}`}>
                  <div className={`text-xs font-semibold mb-2 ${group.color}`}>
                    {group.label} (
                    {group.roles.reduce(
                      (s, r) => s + (distribution[r] || 0),
                      0
                    )}
                    %)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
                    {group.roles.map((role) => {
                      const pr = PROJECT_ROLES.find(
                        (r) => r.role === role
                      );
                      return (
                        <div key={role} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {pr?.label || role}
                            </span>
                            <span className="text-[11px] font-bold tabular-nums w-7 text-right">
                              {distribution[role]}%
                            </span>
                          </div>
                          <Slider
                            value={[distribution[role]]}
                            onValueChange={([v]) =>
                              setDistribution((prev) => ({
                                ...prev,
                                [role]: v,
                              }))
                            }
                            min={0}
                            max={50}
                            step={1}
                            className="h-3"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {Math.abs(distributionTotal - 100) >= 0.5 && (
                <p className="text-xs text-destructive font-medium">
                  Сумма должна быть 100%. Сейчас: {distributionTotal}%
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Summary cards ───────────────────────────────── */}
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard
              label="Сумма без НДС"
              value={fmt(totals.base)}
              icon="💰"
              color="text-primary"
            />
            <SummaryCard
              label={`Накладные (${overheadPercent}%)`}
              value={fmt(totals.overhead)}
              icon="📉"
              color="text-red-500"
            />
            <SummaryCard
              label="ГПХ / Подряд"
              value={fmt(totals.contractors)}
              icon="👷"
              color="text-orange-500"
            />
            <SummaryCard
              label="Остаток"
              value={fmt(totals.remainder)}
              icon="📊"
              color="text-blue-500"
            />
            <SummaryCard
              label={`Бонусы (${bonusPercent}%)`}
              value={fmt(totals.bonusPool)}
              icon="🎯"
              color="text-green-500"
            />
            <SummaryCard
              label="Чистая прибыль"
              value={fmt(totals.grossProfit)}
              icon="🏆"
              color="text-emerald-600"
            />
          </div>
        </div>

        {/* ── Inner Tabs: Table / Analytics ────────────────── */}
        <Tabs defaultValue="table" className="w-full">
          <div className="px-4 pt-3">
            <TabsList className="w-auto">
              <TabsTrigger value="table" className="gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" />
                Таблица проектов
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Аналитика по сотрудникам
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ━━ TABLE TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="table" className="mt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase w-8">
                      #
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[160px]">
                      Проект
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase">
                      Без НДС
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-red-500 uppercase">
                      Вычеты
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-blue-500 uppercase">
                      Остаток
                    </th>
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-green-500 uppercase">
                      Бонус
                    </th>
                    {ROLE_GROUPS.map((g) => (
                      <th
                        key={g.key}
                        className={`px-2 py-2 text-left text-[10px] font-semibold uppercase min-w-[120px] ${g.color}`}
                      >
                        {g.label}
                        <br />
                        <span className="font-bold">
                          {g.roles.reduce(
                            (s, r) => s + (distribution[r] || 0),
                            0
                          )}
                          %
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-emerald-600 uppercase">
                      Прибыль
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projectRows.map((row, idx) => {
                    const isExpanded = expandedProject === row.id;
                    return (
                      <>
                        <tr
                          key={row.id || idx}
                          className={`hover:bg-secondary/20 transition-colors cursor-pointer ${
                            isExpanded ? "bg-secondary/10" : ""
                          }`}
                          onClick={() =>
                            setExpandedProject(
                              isExpanded ? null : row.id
                            )
                          }
                        >
                          <td className="px-2 py-2.5 text-xs text-muted-foreground tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-2.5 min-w-[160px]">
                            <div className="font-medium text-xs leading-tight line-clamp-2">
                              {row.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                              {row.company}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            {row.base > 0 ? (
                              <span className="text-xs font-medium tabular-nums">
                                {fmt(row.base)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <div className="text-xs text-red-500 tabular-nums">
                              -{fmt(row.overhead + row.contractors)}
                            </div>
                            {row.contractors > 0 && (
                              <div className="text-[9px] text-orange-400">
                                ГПХ: {fmt(row.contractors)}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                              {fmt(row.remainder)}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular-nums">
                              {fmt(row.bonusPool)}
                            </span>
                          </td>
                          {/* Role group columns */}
                          {ROLE_GROUPS.map((g) => {
                            const members = getGroupMembers(
                              row,
                              g.roles
                            );
                            const groupTotal = g.roles.reduce(
                              (s, r) =>
                                s + (row.roleBonuses[r] || 0),
                              0
                            );
                            return (
                              <td
                                key={g.key}
                                className="px-2 py-1.5 align-top min-w-[120px]"
                              >
                                {members.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {members.map((mb) => (
                                      <div
                                        key={mb.userId + mb.role}
                                        className="flex items-baseline justify-between gap-1"
                                      >
                                        <span className="text-[11px] truncate max-w-[80px]" title={mb.name}>
                                          <span className="text-[9px] text-muted-foreground mr-0.5">
                                            {ROLE_SHORT[mb.role]}
                                          </span>
                                          {mb.name.split(" ")[0]}
                                        </span>
                                        <span className="text-[11px] font-semibold tabular-nums whitespace-nowrap">
                                          {fmt(mb.bonusAmount)}
                                        </span>
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
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2.5 text-right">
                            <span
                              className={`text-xs font-bold tabular-nums ${
                                row.grossProfit >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-500"
                              }`}
                            >
                              {fmt(row.grossProfit)}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr key={`${row.id}-detail`}>
                            <td
                              colSpan={7 + ROLE_GROUPS.length}
                              className="p-0"
                            >
                              <ProjectDetail
                                row={row}
                                distribution={distribution}
                                overheadPercent={overheadPercent}
                                bonusPercent={bonusPercent}
                                onOpenProject={() =>
                                  onProjectClick?.(row.project)
                                }
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                <tfoot className="bg-secondary/50 font-semibold border-t-2 border-border">
                  <tr>
                    <td className="px-2 py-3" />
                    <td className="px-2 py-3 text-xs">
                      ИТОГО ({projectRows.length})
                    </td>
                    <td className="px-2 py-3 text-right text-xs tabular-nums">
                      {fmt(totals.base)}
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-red-500 tabular-nums">
                      -{fmt(totals.overhead + totals.contractors)}
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-blue-600 dark:text-blue-400 tabular-nums">
                      {fmt(totals.remainder)}
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-green-600 dark:text-green-400 tabular-nums">
                      {fmt(totals.bonusPool)}
                    </td>
                    {ROLE_GROUPS.map((g) => (
                      <td
                        key={g.key}
                        className={`px-2 py-3 text-right text-xs font-bold tabular-nums ${g.color}`}
                      >
                        {fmt(groupTotals[g.key])}
                      </td>
                    ))}
                    <td
                      className={`px-2 py-3 text-right text-xs tabular-nums ${
                        totals.grossProfit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500"
                      }`}
                    >
                      {fmt(totals.grossProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* ━━ ANALYTICS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <TabsContent value="analytics" className="mt-0 p-4 space-y-4">
            {/* Role group summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {ROLE_GROUPS.map((g) => (
                <div
                  key={g.key}
                  className={`p-3 rounded-lg border ${g.border} ${g.bg}`}
                >
                  <div className={`text-xs font-semibold ${g.color}`}>
                    {g.label}
                  </div>
                  <div className="text-lg font-bold tabular-nums mt-1">
                    {fmt(groupTotals[g.key])}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {g.roles.reduce(
                      (s, r) => s + (distribution[r] || 0),
                      0
                    )}
                    % от бонусного фонда
                  </div>
                </div>
              ))}
            </div>

            {/* Per-person table */}
            <Card className="overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/30">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Сводка по сотрудникам ({personAnalytics.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  Суммарные бонусы каждого сотрудника по всем проектам
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase w-8">
                        #
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">
                        Сотрудник
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">
                        Роли
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">
                        Проектов
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-green-500 uppercase">
                        Общий бонус
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[200px]">
                        Детализация
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {personAnalytics.map((person, idx) => (
                      <tr
                        key={person.userId}
                        className="hover:bg-secondary/20"
                      >
                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-sm">
                            {person.name}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(person.roles).map((role) => (
                              <Badge
                                key={role}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-xs font-semibold tabular-nums">
                            {person.projects.length}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                            {fmt(person.totalBonus)}
                          </span>
                        </td>
                        <td className="px-3 py-2 min-w-[200px]">
                          <div className="space-y-0.5">
                            {person.projects.map((p, i) => (
                              <div
                                key={i}
                                className="flex items-baseline justify-between gap-2 text-[11px]"
                              >
                                <span className="truncate max-w-[160px] text-muted-foreground" title={p.projectName}>
                                  {p.projectName}
                                  <span className="text-[9px] ml-1 opacity-60">
                                    ({p.role})
                                  </span>
                                </span>
                                <span className="font-semibold tabular-nums whitespace-nowrap">
                                  {fmt(p.bonusAmount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {personAnalytics.length > 0 && (
                    <tfoot className="bg-secondary/50 border-t-2 border-border">
                      <tr>
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5 text-xs font-semibold">
                          ИТОГО
                        </td>
                        <td />
                        <td />
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                          {fmt(
                            personAnalytics.reduce(
                              (s, p) => s + p.totalBonus,
                              0
                            )
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {personAnalytics.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Нет назначенных сотрудников в проектах
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Empty state */}
        {projectRows.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Нет проектов для отображения</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function ProjectDetail({
  row,
  distribution,
  overheadPercent,
  bonusPercent,
  onOpenProject,
}: {
  row: any;
  distribution: Record<string, number>;
  overheadPercent: number;
  bonusPercent: number;
  onOpenProject?: () => void;
}) {
  return (
    <div className="px-4 py-3 bg-muted/20 border-b border-border space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{row.name}</h4>
        {onOpenProject && (
          <Button variant="outline" size="sm" onClick={onOpenProject} className="text-xs h-7">
            Открыть проект
          </Button>
        )}
      </div>

      {/* Formula */}
      <div className="p-3 rounded-lg bg-background/60 text-xs space-y-1 max-w-lg">
        <div className="flex justify-between">
          <span>Сумма без НДС</span>
          <span className="font-semibold tabular-nums">{fmt(row.base)}</span>
        </div>
        <div className="flex justify-between text-red-500">
          <span>Накладные ({overheadPercent}%)</span>
          <span className="font-semibold tabular-nums">
            -{fmt(row.overhead)}
          </span>
        </div>
        {row.contractors > 0 && (
          <div className="flex justify-between text-orange-500">
            <span>ГПХ / Субподряд</span>
            <span className="font-semibold tabular-nums">
              -{fmt(row.contractors)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1 text-blue-500">
          <span>Остаток</span>
          <span className="font-semibold tabular-nums">
            {fmt(row.remainder)}
          </span>
        </div>
        <div className="flex justify-between text-green-500">
          <span>Бонусный фонд ({bonusPercent}%)</span>
          <span className="font-semibold tabular-nums">
            {fmt(row.bonusPool)}
          </span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-bold">
          <span
            className={
              row.grossProfit >= 0 ? "text-emerald-600" : "text-red-500"
            }
          >
            Чистая прибыль
          </span>
          <span
            className={`tabular-nums ${
              row.grossProfit >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {fmt(row.grossProfit)}
          </span>
        </div>
      </div>

      {/* Team distribution by groups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {ROLE_GROUPS.map((g) => {
          const members = row.memberBonuses.filter((mb: any) =>
            (g.roles as readonly string[]).includes(mb.role)
          );
          const groupTotal = g.roles.reduce(
            (s: number, r: string) => s + (row.roleBonuses[r] || 0),
            0
          );

          return (
            <div
              key={g.key}
              className={`p-2.5 rounded-lg border ${g.border} ${g.bg}`}
            >
              <div
                className={`text-[10px] font-semibold mb-1.5 ${g.color} flex justify-between`}
              >
                <span>{g.label}</span>
                <span className="tabular-nums">{fmt(groupTotal)}</span>
              </div>
              {g.roles.map((role) => {
                const member = members.find(
                  (mb: any) => mb.role === role
                );
                const pct = distribution[role] || 0;
                const amount = row.roleBonuses[role] || 0;
                return (
                  <div
                    key={role}
                    className="flex items-baseline justify-between gap-1 py-0.5"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-muted-foreground mr-1">
                        {ROLE_SHORT[role]}
                      </span>
                      {member ? (
                        <span className="text-[11px] font-medium">
                          {member.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 italic">
                          вакансия
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {pct}%
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums">
                        {fmt(amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/40 text-center">
      <div
        className={`text-lg font-bold ${color} flex items-center justify-center gap-1 tabular-nums`}
      >
        <span>{icon}</span>
        <span className="truncate">{value}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
        {label}
      </div>
    </div>
  );
}
