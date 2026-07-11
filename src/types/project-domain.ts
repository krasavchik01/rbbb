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
  distribution?: Record<string, number>;
  teamBonuses?: Record<string, TeamBonusDraft>;
  totalPaidBonuses?: number;
  totalCosts?: number;
  grossProfit?: number;
  profitMargin?: number;
}

export interface CanonicalProjectNotes extends UnknownRecord {
  name?: string;
  status?: string;
  completionPercent?: number;
  team?: CanonicalTeamMember[];
  auditPeriods?: CanonicalAuditPeriod[];
  finances?: CanonicalProjectFinances;
  contract?: UnknownRecord;
  client?: UnknownRecord;
  files?: unknown[];
  tasks?: unknown[];
}

export type ProjectNotesParseResult =
  | { ok: true; value: CanonicalProjectNotes; raw: unknown }
  | { ok: false; error: string; raw: unknown };
