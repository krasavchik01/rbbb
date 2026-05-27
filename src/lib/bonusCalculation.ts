/**
 * Единый расчёт бонусов по проекту.
 *
 * До этого формула жила в двух местах:
 *   - src/types/project-v3.ts → calculateProjectFinances (per-проект, через
 *     project.finances.bonusPercent, accantedrasход всегда 30%)
 *   - src/components/projects/CEOSummaryTable.tsx (свои useMemo с глобальными
 *     слайдерами overhead %, bonus %, distribution{})
 *
 * Теперь — одна функция, которая принимает defaults из CEO-настроек и
 * умеет per-проект'но переопределить любой параметр из project.finances.
 *
 *   base       = amountWithoutVAT
 *   overhead   = base × overheadPct
 *   contractors= ∑ project.finances.contractors[].amount
 *   remainder  = max(0, base − overhead − contractors)
 *   bonusPool  = remainder × bonusPct
 *   role pool  = bonusPool × distribution[role]%
 *   per-user   = либо manuallyAdjusted, либо плановая доля внутри role pool
 *                по project.team[].bonusPercent (внутри роли) или поровну.
 */

import { PROJECT_ROLES, type UserRole } from '@/types/roles';

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_OVERHEAD_PERCENT = 30;
export const DEFAULT_BONUS_PERCENT = 10;

/** Дефолтное распределение бонус-пула по ролям (из PROJECT_ROLES). */
export const DEFAULT_DISTRIBUTION: Record<string, number> = (() => {
  const d: Record<string, number> = {};
  PROJECT_ROLES.forEach((r) => {
    if (r.bonusPercent > 0) d[r.role] = r.bonusPercent;
  });
  return d;
})();

/** Роли, у которых есть бонус. Удобно для UI (колонки, итоги). */
export const BONUS_ROLES = PROJECT_ROLES.filter((r) => r.bonusPercent > 0);

// ─── Input types ────────────────────────────────────────────────────────────

export interface BonusSettings {
  /** Накладные % (по умолчанию 30). */
  overheadPercent?: number;
  /** Бонусный фонд % от остатка (по умолчанию 10). */
  bonusPercent?: number;
  /** Распределение пула по ролям, в % (∑ ≈ 100). */
  distribution?: Record<string, number>;
}

export interface BonusComputeMember {
  userId: string;
  userName: string;
  role: UserRole;
  /** % от пула, который получает именно этот человек (если в роли больше одного). */
  bonusPct: number;
  /** Плановая сумма = pool × bonusPct%. */
  plannedAmount: number;
  /** Фактическая сумма (с учётом ручной корректировки CEO). */
  finalAmount: number;
  manuallyAdjusted: boolean;
  hiddenFromEmployee: boolean;
  paidAt: string | null;
  paidByName: string | null;
  /** История изменений (аудит). */
  history: Array<{ type: string; by?: string; byName?: string; at: string; from?: unknown; to?: unknown }>;
}

export interface BonusComputeResult {
  base: number;
  overheadPercent: number;
  overhead: number;
  contractors: number;
  remainder: number;
  bonusPercent: number;
  bonusPool: number;
  /** Эффективное распределение по ролям (после per-project override). */
  distribution: Record<string, number>;
  /** role → фактическая сумма выплат по членам в этой роли. */
  roleBonuses: Record<string, number>;
  /** role → «потенциальная» сумма = bonusPool × distribution[role]%. Полезно
   * для UI: показать сколько было бы, если бы роль была заполнена. */
  rolePotential: Record<string, number>;
  members: BonusComputeMember[];
  totalPaidBonuses: number;
  totalCosts: number;
  grossProfit: number;
  profitMargin: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Сумма ГПХ — пробуем несколько мест, где она исторически хранилась. */
function readContractorsAmount(project: any): number {
  const fromFinances = project?.finances?.totalContractorsAmount;
  if (typeof fromFinances === 'number' && fromFinances > 0) return fromFinances;
  const arr =
    project?.finances?.contractors ||
    project?.notes?.finances?.contractors ||
    project?.notes?.contractors ||
    [];
  if (Array.isArray(arr)) {
    return arr.reduce((s: number, c: any) => s + (Number(c?.amount) || 0), 0);
  }
  return 0;
}

/** Сумма без НДС — приоритет project.contract.amountWithoutVAT, fallback на поля. */
function readAmountWithoutVAT(project: any): number {
  return (
    Number(project?.contract?.amountWithoutVAT) ||
    Number(project?.amountWithoutVAT) ||
    Number(project?.notes?.contract?.amountWithoutVAT) ||
    Number(project?.notes?.amountWithoutVAT) ||
    0
  );
}

function readTeam(project: any): any[] {
  if (Array.isArray(project?.team)) return project.team;
  if (Array.isArray(project?.notes?.team)) return project.notes.team;
  return [];
}

/** Эффективные настройки = settings → project.finances overrides → defaults. */
function effectiveSettings(project: any, settings?: BonusSettings) {
  const finances = project?.finances || {};
  const overheadPercent =
    finances.preExpensePercent ??
    settings?.overheadPercent ??
    DEFAULT_OVERHEAD_PERCENT;
  const bonusPercent =
    finances.bonusPercent ??
    settings?.bonusPercent ??
    DEFAULT_BONUS_PERCENT;
  const distribution: Record<string, number> = {
    ...DEFAULT_DISTRIBUTION,
    ...(settings?.distribution || {}),
    ...(finances.distribution || {}),
  };
  return { overheadPercent, bonusPercent, distribution };
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function computeProjectBonus(
  project: any,
  settings?: BonusSettings,
): BonusComputeResult {
  const base = readAmountWithoutVAT(project);
  const contractors = readContractorsAmount(project);
  const { overheadPercent, bonusPercent, distribution } = effectiveSettings(project, settings);

  const overhead = base * (overheadPercent / 100);
  const remainder = Math.max(0, base - overhead - contractors);
  const bonusPool = remainder * (bonusPercent / 100);

  const team = readTeam(project);
  const teamBonuses: Record<string, any> = project?.finances?.teamBonuses || {};

  // Расчёт по членам команды.
  //   pct = member.bonusPercent (если задан в project.team[]) — это per-проект
  //         override, который CEO мог поменять руками; иначе distribution[role]
  //         (общая настройка) — это «дефолт по роли».
  //   plannedAmount = bonusPool × pct%
  //   finalAmount   = либо ручная сумма CEO (manuallyAdjusted), либо planned.
  const members: BonusComputeMember[] = [];
  for (const m of team) {
    const role = (m?.role || m?.role_on_project) as UserRole | undefined;
    if (!role) continue;
    if (!DEFAULT_DISTRIBUTION.hasOwnProperty(role) && !(distribution as any).hasOwnProperty(role)) continue;
    const userId = m?.userId || m?.id || m?.employeeId;
    if (!userId) continue;

    const memberPct = typeof m?.bonusPercent === 'number' ? m.bonusPercent : undefined;
    const pct = memberPct ?? distribution[role] ?? 0;
    const plannedAmount = bonusPool * (pct / 100);

    const existing = teamBonuses[userId] || {};
    const manuallyAdjusted = !!existing.manuallyAdjusted;
    const finalAmount = manuallyAdjusted ? Number(existing.amount) || 0 : plannedAmount;
    const bonusPct = bonusPool > 0 ? (finalAmount / bonusPool) * 100 : pct;

    members.push({
      userId,
      userName: m?.userName || m?.name || existing.userName || '',
      role,
      bonusPct,
      plannedAmount,
      finalAmount,
      manuallyAdjusted,
      hiddenFromEmployee: !!existing.hiddenFromEmployee,
      paidAt: existing.paidAt || null,
      paidByName: existing.paidByName || null,
      history: Array.isArray(existing.history) ? existing.history : [],
    });
  }

  // Агрегация по ролям — сумма ФАКТИЧЕСКИХ выплат в каждой роли.
  // Если в роли никого нет, остаётся 0 (и в UI можно показать «не назначен»
  // вместе с «потенциальной» суммой = bonusPool × distribution[role]%).
  const roleBonuses: Record<string, number> = {};
  for (const r of BONUS_ROLES) roleBonuses[r.role] = 0;
  for (const m of members) {
    if (roleBonuses.hasOwnProperty(m.role)) roleBonuses[m.role] += m.finalAmount;
  }

  const totalPaidBonuses = members.reduce((s, m) => s + m.finalAmount, 0);
  const totalCosts = totalPaidBonuses + contractors + overhead;
  const grossProfit = base - totalCosts;
  const profitMargin = base > 0 ? (grossProfit / base) * 100 : 0;

  const rolePotential: Record<string, number> = {};
  for (const r of BONUS_ROLES) {
    rolePotential[r.role] = bonusPool * ((distribution[r.role] || 0) / 100);
  }

  return {
    base,
    overheadPercent,
    overhead,
    contractors,
    remainder,
    bonusPercent,
    bonusPool,
    distribution,
    roleBonuses,
    rolePotential,
    members,
    totalPaidBonuses,
    totalCosts,
    grossProfit,
    profitMargin,
  };
}

// ─── Aggregations ──────────────────────────────────────────────────────────

export interface ProjectBonusRow extends BonusComputeResult {
  project: any;
  id: string;
  name: string;
}

export function computeAllProjects(projects: any[], settings?: BonusSettings): ProjectBonusRow[] {
  return (projects || []).map((p) => {
    const r = computeProjectBonus(p, settings);
    return {
      ...r,
      project: p,
      id: p?.id || p?.notes?.id || '',
      name: p?.name || p?.notes?.name || 'Без названия',
    };
  });
}

export interface BonusTotals {
  base: number;
  overhead: number;
  contractors: number;
  remainder: number;
  bonusPool: number;
  totalBonuses: number;
  grossProfit: number;
  roleBonuses: Record<string, number>;
}

export function aggregateTotals(rows: ProjectBonusRow[]): BonusTotals {
  const t: BonusTotals = {
    base: 0,
    overhead: 0,
    contractors: 0,
    remainder: 0,
    bonusPool: 0,
    totalBonuses: 0,
    grossProfit: 0,
    roleBonuses: {},
  };
  for (const r of BONUS_ROLES) t.roleBonuses[r.role] = 0;
  for (const row of rows) {
    t.base += row.base;
    t.overhead += row.overhead;
    t.contractors += row.contractors;
    t.remainder += row.remainder;
    t.bonusPool += row.bonusPool;
    t.totalBonuses += row.totalPaidBonuses;
    t.grossProfit += row.grossProfit;
    for (const r of BONUS_ROLES) {
      t.roleBonuses[r.role] += row.roleBonuses[r.role] || 0;
    }
  }
  return t;
}
