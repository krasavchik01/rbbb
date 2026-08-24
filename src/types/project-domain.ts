import type { UserRole } from '@/types/roles';

export type UnknownRecord = Record<string, unknown>;

export interface CanonicalTeamMember extends UnknownRecord {
  userId: string;
  userName?: string;
  role: UserRole | string;
  bonusPercent: number;
  assignedAt?: string;
  assignedBy?: string;
}

export interface CanonicalAuditPeriod extends UnknownRecord {
  id: string;
  name: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  partnerId?: string;
  partnerName?: string;
  status?: string;
  team?: CanonicalTeamMember[];
  teamSource?: 'period' | 'empty';
}

export interface TeamBonusDraft extends UnknownRecord {
  role: UserRole | string;
  percent: number;
  amount: number;
  manuallyAdjusted?: boolean;
  /** What the CEO changed last: a share of the pool or a fixed tenge amount. */
  adjustmentMode?: 'percent' | 'amount';
  hiddenFromEmployee?: boolean;
  paidAt?: string | null;
  paidByName?: string | null;
  history?: UnknownRecord[];
}

export interface CanonicalProjectFinances extends UnknownRecord {
  amountWithoutVAT?: number;
  preExpensePercent?: number;
  preExpenseAmount?: number;
  contractors?: Array<UnknownRecord & { amount?: number }>;
  totalContractorsAmount?: number;
  bonusBase?: number;
  bonusPercent?: number;
  totalBonusAmount?: number;
  bonusPoolOverrideAmount?: number | null;
  bonusPoolManuallyAdjusted?: boolean;
  bonusPoolHistory?: UnknownRecord[];
  distribution?: Record<string, number>;
  teamBonuses?: Record<string, TeamBonusDraft>;
  totalPaidBonuses?: number;
  totalCosts?: number;
  grossProfit?: number;
  profitMargin?: number;
}

export interface CanonicalProjectFile extends UnknownRecord {
  id?: string;
  isSeafile?: boolean;
  storagePath?: string;
  category?: string;
}

export interface CanonicalProjectNotes extends UnknownRecord {
  name?: string;
  status?: string;
  completionPercent?: number;
  team?: CanonicalTeamMember[];
  teamSource?: 'canonical' | 'legacy_union';
  teamUnifiedAt?: string;
  auditPeriods?: CanonicalAuditPeriod[];
  finances?: CanonicalProjectFinances;
  contract?: UnknownRecord;
  client?: UnknownRecord;
  files?: CanonicalProjectFile[];
  tasks?: unknown[];
  accounting?: UnknownRecord;
}

export type ProjectNotesParseResult =
  | { ok: true; value: CanonicalProjectNotes; raw: unknown }
  | { ok: false; error: string; raw: unknown };
