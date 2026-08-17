import type { BonusPaymentRow } from '@/lib/bonusPayments';
import { projectAmountWithoutVAT, projectFinances as readProjectFinances } from '@/lib/contractData';
import {
  dedupeCanonicalTeamMembers,
  financeParticipants,
  projectForFinanceCalculation,
} from '@/lib/projectLegacyCompatibility';
import { calculateProjectFinances } from '@/types/project-v3';
import { projectCompanyName } from '@/types/companies';

export interface BonusSeason {
  key: string;
  label: string;
}

export interface BonusProjectSource {
  key: string;
  projectId: string;
  projectName: string;
  companyName: string;
  currency: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  identityMatched: boolean;
  role: string;
  percent: number;
  manuallyAdjusted: boolean;
  projectBonusPoolAmount: number;
  projectAllocatedAmount: number;
  projectTeamPercentTotal: number;
  projectFormulaPolicy: 'technical' | 'manual' | 'mixed';
  season: BonusSeason | null;
  approvedHours: number;
  pendingHours: number;
  plannedAmount: number;
  registryPendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  registeredAmount: number;
  unregisteredAmount: number;
  overRegisteredAmount: number;
  latestPaymentDate: string | null;
  paymentRows: number;
}

export interface EmployeeBonusLedger {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  sources: BonusProjectSource[];
  projectCount: number;
  approvedHours: number;
  pendingHours: number;
  plannedAmount: number;
  registryPendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  registeredAmount: number;
  unregisteredAmount: number;
  overRegisteredAmount: number;
  currencyTotals: Record<string, BonusCurrencyTotals>;
}

export interface BonusCurrencyTotals {
  currency: string;
  bonusPoolAmount: number;
  plannedAmount: number;
  registryPendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  registeredAmount: number;
  linkedRegistryAmount: number;
  unregisteredAmount: number;
  overRegisteredAmount: number;
  unlinkedRegistryAmount: number;
  unallocatedPoolAmount: number;
  overAllocatedPoolAmount: number;
}

export interface BonusLedgerTotals {
  projectCount: number;
  employeeCount: number;
  bonusPoolAmount: number;
  plannedAmount: number;
  unallocatedPoolAmount: number;
  overAllocatedPoolAmount: number;
  registryPendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  registeredAmount: number;
  linkedRegistryAmount: number;
  unregisteredAmount: number;
  overRegisteredAmount: number;
  unlinkedRegistryAmount: number;
  reconciliationDelta: number;
  paymentRows: number;
  unlinkedPaymentRows: number;
  outOfScopePaymentRows: number;
  outOfScopeRegistryAmount: number;
  missingProjectPaymentRows: number;
  missingProjectRegistryAmount: number;
}

export interface BonusLedger {
  employees: EmployeeBonusLedger[];
  sources: BonusProjectSource[];
  totals: BonusLedgerTotals;
  currencyTotals: Record<string, BonusCurrencyTotals>;
  seasons: BonusSeason[];
}

export interface BuildBonusLedgerInput {
  projects: readonly any[];
  employees: readonly any[];
  payments: readonly BonusPaymentRow[];
  approvedHours?: ReadonlyMap<string, number>;
  pendingHours?: ReadonlyMap<string, number>;
  seasonForProject?: (project: any) => BonusSeason | null;
}

type PaymentBucket = {
  pending: number;
  approved: number;
  paid: number;
  rows: number;
  latestPaymentDate: string | null;
};

export const BONUS_REGISTRY_CURRENCY = 'KZT';

const EMPTY_PAYMENT_BUCKET: PaymentBucket = {
  pending: 0,
  approved: 0,
  paid: 0,
  rows: 0,
  latestPaymentDate: null,
};

function text(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function latestDate(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() >= new Date(current).getTime() ? candidate : current;
}

function projectId(project: any): string {
  return text(project?.id);
}

function projectName(project: any): string {
  return text(project?.name, project?.notes?.name, project?.clientName, project?.notes?.clientName, 'Без названия');
}

function projectCurrency(project: any): string {
  const raw = text(
    project?.contract?.currency,
    project?.notes?.contract?.currency,
    project?.currency,
    project?.notes?.currency,
    'KZT',
  ).toUpperCase();
  if (raw === '₸' || raw === 'ТГ' || raw === 'ТЕНГЕ') return 'KZT';
  if (raw === '$') return 'USD';
  return raw || 'KZT';
}

function employeeDisplayName(employee: any): string {
  return text(employee?.name, employee?.full_name, employee?.fullName);
}

function employeeDisplayEmail(employee: any): string {
  return text(employee?.email);
}

function projectTeam(project: any): any[] {
  const notesTeam = project?.notes?.team;
  if (Array.isArray(notesTeam)) return notesTeam;
  return Array.isArray(project?.team) ? project.team : [];
}

function teamMemberId(member: any): string {
  return text(member?.userId, member?.employeeId, member?.employee_id, member?.id);
}

function teamMemberName(member: any): string {
  return text(member?.userName, member?.employeeName, member?.name);
}

function teamMemberRole(member: any): string {
  return text(member?.role, member?.projectRole, member?.slotKey, 'employee');
}

function projectFinances(project: any): Record<string, any> {
  const notesFinances = project?.notes?.finances;
  const directFinances = project?.finances;
  return {
    ...(notesFinances && typeof notesFinances === 'object' ? notesFinances : {}),
    ...(directFinances && typeof directFinances === 'object' ? directFinances : {}),
    teamBonuses: {
      ...(notesFinances?.teamBonuses && typeof notesFinances.teamBonuses === 'object' ? notesFinances.teamBonuses : {}),
      ...(directFinances?.teamBonuses && typeof directFinances.teamBonuses === 'object' ? directFinances.teamBonuses : {}),
    },
  };
}

/** The same canonical calculation used by the project command centre. */
export function calculateExecutiveBonusFinances(
  project: any,
  additionalTeam?: readonly any[],
): Record<string, any> {
  const normalizedFinances = readProjectFinances(project);
  try {
    const calculationProject = projectForFinanceCalculation(project);
    const participants = dedupeCanonicalTeamMembers([
      Array.isArray(calculationProject?.team) ? calculationProject.team : [],
      additionalTeam || financeParticipants(project),
    ]);
    return calculateProjectFinances({
      ...calculationProject,
      team: participants,
      notes: {
        ...(calculationProject?.notes && typeof calculationProject.notes === 'object'
          ? calculationProject.notes
          : {}),
        team: participants,
      },
      finances: {
        ...normalizedFinances,
        amountWithoutVAT: projectAmountWithoutVAT(project),
      },
    });
  } catch {
    return projectFinances(project);
  }
}

function projectPoolAmount(finances: Record<string, any>, plannedForProject: number): number {
  if (finances.bonusPoolOverrideAmount !== null && finances.bonusPoolOverrideAmount !== undefined) {
    return money(finances.bonusPoolOverrideAmount);
  }
  if (finances.totalBonusAmount !== null && finances.totalBonusAmount !== undefined) {
    return money(finances.totalBonusAmount);
  }
  return plannedForProject;
}

function addPayment(bucket: PaymentBucket, row: BonusPaymentRow): PaymentBucket {
  const amount = money(row.bonus_amount);
  const next = { ...bucket, rows: bucket.rows + 1 };
  if (row.payment_date) {
    next.paid += amount;
    next.latestPaymentDate = latestDate(next.latestPaymentDate, row.payment_date);
  } else if (row.status === 'approved') {
    next.approved += amount;
  } else {
    next.pending += amount;
  }
  return next;
}

function currencySourceTotals(sources: readonly BonusProjectSource[], currency: string): BonusCurrencyTotals {
  return sources.reduce(
    (totals, source) => ({
      ...totals,
      plannedAmount: totals.plannedAmount + (source.currency === currency ? source.plannedAmount : 0),
      registryPendingAmount: totals.registryPendingAmount + (currency === BONUS_REGISTRY_CURRENCY ? source.registryPendingAmount : 0),
      approvedAmount: totals.approvedAmount + (currency === BONUS_REGISTRY_CURRENCY ? source.approvedAmount : 0),
      paidAmount: totals.paidAmount + (currency === BONUS_REGISTRY_CURRENCY ? source.paidAmount : 0),
      registeredAmount: totals.registeredAmount + (currency === BONUS_REGISTRY_CURRENCY ? source.registeredAmount : 0),
      linkedRegistryAmount: totals.linkedRegistryAmount + (currency === BONUS_REGISTRY_CURRENCY ? source.registeredAmount : 0),
      unregisteredAmount: totals.unregisteredAmount + (source.currency === currency ? source.unregisteredAmount : 0),
      overRegisteredAmount: totals.overRegisteredAmount + (currency === BONUS_REGISTRY_CURRENCY ? source.overRegisteredAmount : 0),
    }),
    {
      currency,
      bonusPoolAmount: 0,
      plannedAmount: 0,
      registryPendingAmount: 0,
      approvedAmount: 0,
      paidAmount: 0,
      registeredAmount: 0,
      linkedRegistryAmount: 0,
      unregisteredAmount: 0,
      overRegisteredAmount: 0,
      unlinkedRegistryAmount: 0,
      unallocatedPoolAmount: 0,
      overAllocatedPoolAmount: 0,
    },
  );
}

function sourceCurrencies(sources: readonly BonusProjectSource[]): string[] {
  return Array.from(new Set([
    ...sources.map((source) => source.currency),
    ...(sources.some((source) => source.registeredAmount > 0) ? [BONUS_REGISTRY_CURRENCY] : []),
  ])).sort((a, b) => (
    a === 'KZT' ? -1 : b === 'KZT' ? 1 : a.localeCompare(b)
  ));
}

function sumSources(sources: readonly BonusProjectSource[]): Omit<EmployeeBonusLedger, 'employeeId' | 'employeeName' | 'employeeEmail' | 'sources'> {
  const summary = sources.reduce(
    (totals, source) => ({
      projectCount: totals.projectCount + 1,
      approvedHours: totals.approvedHours + source.approvedHours,
      pendingHours: totals.pendingHours + source.pendingHours,
      plannedAmount: totals.plannedAmount + source.plannedAmount,
      registryPendingAmount: totals.registryPendingAmount + source.registryPendingAmount,
      approvedAmount: totals.approvedAmount + source.approvedAmount,
      paidAmount: totals.paidAmount + source.paidAmount,
      registeredAmount: totals.registeredAmount + source.registeredAmount,
      unregisteredAmount: totals.unregisteredAmount + source.unregisteredAmount,
      overRegisteredAmount: totals.overRegisteredAmount + source.overRegisteredAmount,
    }),
    {
      projectCount: 0,
      approvedHours: 0,
      pendingHours: 0,
      plannedAmount: 0,
      registryPendingAmount: 0,
      approvedAmount: 0,
      paidAmount: 0,
      registeredAmount: 0,
      unregisteredAmount: 0,
      overRegisteredAmount: 0,
    },
  );
  return {
    ...summary,
    currencyTotals: Object.fromEntries(sourceCurrencies(sources).map((currency) => [
      currency,
      currencySourceTotals(sources, currency),
    ])),
  };
}

/**
 * Builds one read-only executive ledger from the two deliberately separate
 * sources of truth:
 * - projects.notes.finances.teamBonuses = calculated/draft allocation;
 * - bonuses rows = final payment registry and its payment status.
 *
 * The function never treats a draft `paidAt` flag as proof of payment.
 */
export function buildBonusLedger({
  projects,
  employees,
  payments,
  approvedHours = new Map(),
  pendingHours = new Map(),
  seasonForProject = () => null,
}: BuildBonusLedgerInput): BonusLedger {
  const projectById = new Map<string, any>();
  for (const project of projects) {
    const id = projectId(project);
    if (id) projectById.set(id, project);
  }
  const employeeById = new Map<string, any>();
  for (const employee of employees) {
    const id = text(employee?.id);
    if (id) employeeById.set(id, employee);
  }
  const paymentByPair = new Map<string, PaymentBucket>();
  const paymentCurrency = new Map<string, string>();
  const unlinkedByCurrency = new Map<string, PaymentBucket>();
  let unlinkedRegistryAmount = 0;
  let unlinkedPaymentRows = 0;
  let outOfScopePaymentRows = 0;
  let outOfScopeRegistryAmount = 0;
  let missingProjectPaymentRows = 0;
  let missingProjectRegistryAmount = 0;
  let registryPendingAmount = 0;
  let approvedAmount = 0;
  let paidAmount = 0;
  let inScopePaymentRows = 0;

  for (const row of payments) {
    const rowProjectId = text(row.project_id);
    const amount = money(row.bonus_amount);
    if (!rowProjectId) {
      missingProjectPaymentRows += 1;
      missingProjectRegistryAmount += amount;
      continue;
    }
    if (!projectById.has(rowProjectId)) {
      outOfScopePaymentRows += 1;
      outOfScopeRegistryAmount += amount;
      continue;
    }
    inScopePaymentRows += 1;
    if (row.payment_date) paidAmount += amount;
    else if (row.status === 'approved') approvedAmount += amount;
    else registryPendingAmount += amount;

    const rowEmployeeId = text(row.employee_id);
    if (!rowEmployeeId) {
      unlinkedRegistryAmount += amount;
      unlinkedPaymentRows += 1;
      unlinkedByCurrency.set(
        BONUS_REGISTRY_CURRENCY,
        addPayment(unlinkedByCurrency.get(BONUS_REGISTRY_CURRENCY) || EMPTY_PAYMENT_BUCKET, row),
      );
      continue;
    }
    const key = `${rowProjectId}::${rowEmployeeId}`;
    paymentCurrency.set(key, BONUS_REGISTRY_CURRENCY);
    paymentByPair.set(key, addPayment(paymentByPair.get(key) || EMPTY_PAYMENT_BUCKET, row));
  }

  const sourceByPair = new Map<string, BonusProjectSource>();
  let bonusPoolAmount = 0;
  const projectPoolByCurrency = new Map<string, { pool: number; planned: number; unallocated: number; overallocated: number }>();
  const projectFinanceMeta = new Map<string, {
    finances: Record<string, any>;
    pool: number;
    allocated: number;
    percentTotal: number;
    policy: BonusProjectSource['projectFormulaPolicy'];
  }>();

  for (const project of projects) {
    const id = projectId(project);
    if (!id) continue;
    const finances = calculateExecutiveBonusFinances(project);
    const currency = projectCurrency(project);
    const bonuses = finances.teamBonuses && typeof finances.teamBonuses === 'object'
      ? finances.teamBonuses as Record<string, any>
      : {};
    const team = projectTeam(project);
    const memberById = new Map<string, any>();
    for (const member of team) {
      const memberId = teamMemberId(member);
      if (memberId) memberById.set(memberId, member);
    }
    const plannedForProject = Object.values(bonuses).reduce((sum, bonus: any) => sum + money(bonus?.amount), 0);
    const poolForProject = projectPoolAmount(finances, plannedForProject);
    const projectBonuses = Object.values(bonuses) as any[];
    const manualCount = projectBonuses.filter((bonus) => bonus?.manuallyAdjusted === true).length;
    const policy: BonusProjectSource['projectFormulaPolicy'] = manualCount === 0
      ? 'technical'
      : manualCount === projectBonuses.length ? 'manual' : 'mixed';
    const percentTotal = projectBonuses.reduce((sum, bonus) => sum + money(bonus?.percent), 0);
    projectFinanceMeta.set(id, {
      finances,
      pool: poolForProject,
      allocated: plannedForProject,
      percentTotal,
      policy,
    });
    bonusPoolAmount += poolForProject;
    const currencyPool = projectPoolByCurrency.get(currency) || { pool: 0, planned: 0, unallocated: 0, overallocated: 0 };
    projectPoolByCurrency.set(currency, {
      pool: currencyPool.pool + poolForProject,
      planned: currencyPool.planned + plannedForProject,
      unallocated: currencyPool.unallocated + Math.max(0, poolForProject - plannedForProject),
      overallocated: currencyPool.overallocated + Math.max(0, plannedForProject - poolForProject),
    });

    for (const [employeeId, bonus] of Object.entries(bonuses)) {
      if (!employeeId) continue;
      const key = `${id}::${employeeId}`;
      const employee = employeeById.get(employeeId);
      const member = memberById.get(employeeId);
      const payment = paymentByPair.get(key) || EMPTY_PAYMENT_BUCKET;
      const plannedAmount = money(bonus?.amount);
      const registeredAmount = payment.pending + payment.approved + payment.paid;
      const comparableRegistry = currency === BONUS_REGISTRY_CURRENCY ? registeredAmount : 0;
      sourceByPair.set(key, {
        key,
        projectId: id,
        projectName: projectName(project),
        companyName: projectCompanyName(project),
        currency,
        employeeId,
        employeeName: employeeDisplayName(employee) || teamMemberName(member) || text(bonus?.employeeName, 'Неизвестный сотрудник'),
        employeeEmail: employeeDisplayEmail(employee),
        identityMatched: Boolean(employee && employeeDisplayName(employee)),
        role: text(bonus?.role, teamMemberRole(member), employee?.role, 'employee'),
        percent: money(bonus?.percent),
        manuallyAdjusted: bonus?.manuallyAdjusted === true,
        projectBonusPoolAmount: poolForProject,
        projectAllocatedAmount: plannedForProject,
        projectTeamPercentTotal: percentTotal,
        projectFormulaPolicy: policy,
        season: seasonForProject(project),
        approvedHours: money(approvedHours.get(`${employeeId}__${id}`)),
        pendingHours: money(pendingHours.get(`${employeeId}__${id}`)),
        plannedAmount,
        registryPendingAmount: payment.pending,
        approvedAmount: payment.approved,
        paidAmount: payment.paid,
        registeredAmount,
        unregisteredAmount: Math.max(0, plannedAmount - comparableRegistry),
        overRegisteredAmount: currency === BONUS_REGISTRY_CURRENCY
          ? Math.max(0, registeredAmount - plannedAmount)
          : registeredAmount,
        latestPaymentDate: payment.latestPaymentDate,
        paymentRows: payment.rows,
      });
    }
  }

  // A legitimate manual payment can be entered before the draft allocation is
  // restored. Keep it visible instead of silently dropping money from totals.
  for (const [key, payment] of paymentByPair) {
    if (sourceByPair.has(key)) continue;
    const [id, employeeId] = key.split('::');
    const project = projectById.get(id);
    if (!project || !employeeId) continue;
    const employee = employeeById.get(employeeId);
    const member = projectTeam(project).find((candidate) => teamMemberId(candidate) === employeeId);
    const registeredAmount = payment.pending + payment.approved + payment.paid;
    const financeMeta = projectFinanceMeta.get(id) || {
      finances: calculateExecutiveBonusFinances(project),
      pool: 0,
      allocated: 0,
      percentTotal: 0,
      policy: 'technical' as const,
    };
    sourceByPair.set(key, {
      key,
      projectId: id,
      projectName: projectName(project),
      companyName: projectCompanyName(project),
      currency: paymentCurrency.get(key) || projectCurrency(project),
      employeeId,
      employeeName: employeeDisplayName(employee) || teamMemberName(member) || 'Неизвестный сотрудник',
      employeeEmail: employeeDisplayEmail(employee),
      identityMatched: Boolean(employee && employeeDisplayName(employee)),
      role: text(teamMemberRole(member), employee?.role, 'employee'),
      percent: 0,
      manuallyAdjusted: false,
      projectBonusPoolAmount: financeMeta.pool,
      projectAllocatedAmount: financeMeta.allocated,
      projectTeamPercentTotal: financeMeta.percentTotal,
      projectFormulaPolicy: financeMeta.policy,
      season: seasonForProject(project),
      approvedHours: money(approvedHours.get(`${employeeId}__${id}`)),
      pendingHours: money(pendingHours.get(`${employeeId}__${id}`)),
      plannedAmount: 0,
      registryPendingAmount: payment.pending,
      approvedAmount: payment.approved,
      paidAmount: payment.paid,
      registeredAmount,
      unregisteredAmount: 0,
      overRegisteredAmount: registeredAmount,
      latestPaymentDate: payment.latestPaymentDate,
      paymentRows: payment.rows,
    });
  }

  const sources = Array.from(sourceByPair.values()).sort((a, b) => (
    b.plannedAmount - a.plannedAmount || a.projectName.localeCompare(b.projectName, 'ru')
  ));
  const sourcesByEmployee = new Map<string, BonusProjectSource[]>();
  for (const source of sources) {
    const current = sourcesByEmployee.get(source.employeeId) || [];
    current.push(source);
    sourcesByEmployee.set(source.employeeId, current);
  }

  const employeeLedgers = Array.from(sourcesByEmployee.entries()).map(([employeeId, employeeSources]) => {
    const first = employeeSources[0];
    const summary = sumSources(employeeSources);
    return {
      employeeId,
      employeeName: first.employeeName,
      employeeEmail: first.employeeEmail,
      sources: employeeSources,
      ...summary,
    } satisfies EmployeeBonusLedger;
  }).sort((a, b) => b.plannedAmount - a.plannedAmount || a.employeeName.localeCompare(b.employeeName, 'ru'));

  const plannedAmount = sources.reduce((sum, source) => sum + source.plannedAmount, 0);
  const linkedRegistryAmount = sources.reduce((sum, source) => sum + source.registeredAmount, 0);
  const unregisteredAmount = sources.reduce((sum, source) => sum + source.unregisteredAmount, 0);
  const overRegisteredAmount = sources.reduce((sum, source) => sum + source.overRegisteredAmount, 0);
  const registeredAmount = registryPendingAmount + approvedAmount + paidAmount;
  const unallocatedPoolAmount = Array.from(projectPoolByCurrency.values()).reduce((sum, value) => sum + value.unallocated, 0);
  const overAllocatedPoolAmount = Array.from(projectPoolByCurrency.values()).reduce((sum, value) => sum + value.overallocated, 0);
  const reconciliationDelta = plannedAmount + overRegisteredAmount - linkedRegistryAmount - unregisteredAmount;
  const seasonMap = new Map<string, BonusSeason>();
  for (const source of sources) {
    if (source.season) seasonMap.set(source.season.key, source.season);
  }

  const currencies = Array.from(new Set([
    ...projectPoolByCurrency.keys(),
    ...sourceCurrencies(sources),
    ...unlinkedByCurrency.keys(),
  ])).sort((a, b) => (a === 'KZT' ? -1 : b === 'KZT' ? 1 : a.localeCompare(b)));
  const currencyTotals = Object.fromEntries(currencies.map((currency) => {
    const sourceTotals = currencySourceTotals(sources, currency);
    const pool = projectPoolByCurrency.get(currency) || { pool: 0, planned: 0, unallocated: 0, overallocated: 0 };
    const unlinked = unlinkedByCurrency.get(currency) || EMPTY_PAYMENT_BUCKET;
    const unlinkedAmount = unlinked.pending + unlinked.approved + unlinked.paid;
    return [currency, {
      ...sourceTotals,
      bonusPoolAmount: pool.pool,
      registryPendingAmount: sourceTotals.registryPendingAmount + unlinked.pending,
      approvedAmount: sourceTotals.approvedAmount + unlinked.approved,
      paidAmount: sourceTotals.paidAmount + unlinked.paid,
      unlinkedRegistryAmount: unlinkedAmount,
      registeredAmount: sourceTotals.registeredAmount + unlinkedAmount,
      unallocatedPoolAmount: pool.unallocated,
      overAllocatedPoolAmount: pool.overallocated,
    } satisfies BonusCurrencyTotals];
  }));

  return {
    employees: employeeLedgers,
    sources,
    seasons: Array.from(seasonMap.values()).sort((a, b) => b.key.localeCompare(a.key)),
    totals: {
      projectCount: projects.length,
      employeeCount: employeeLedgers.length,
      bonusPoolAmount,
      plannedAmount,
      unallocatedPoolAmount,
      overAllocatedPoolAmount,
      registryPendingAmount,
      approvedAmount,
      paidAmount,
      registeredAmount,
      linkedRegistryAmount,
      unregisteredAmount,
      overRegisteredAmount,
      unlinkedRegistryAmount,
      reconciliationDelta,
      paymentRows: inScopePaymentRows,
      unlinkedPaymentRows,
      outOfScopePaymentRows,
      outOfScopeRegistryAmount,
      missingProjectPaymentRows,
      missingProjectRegistryAmount,
    },
    currencyTotals,
  };
}
