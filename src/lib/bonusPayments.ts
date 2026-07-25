import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type BonusPaymentRow = Database['public']['Tables']['bonuses']['Row'];

export type BonusPaymentState = {
  registered: boolean;
  paid: boolean;
  paymentDate: string | null;
  amount: number;
  rowCount: number;
};

export type BonusPaymentIndex = {
  byKey: Map<string, BonusPaymentState>;
  totalRows: number;
  unmatchedRows: number;
};

export type BonusPaymentLedgerState = {
  approvedUnpaidAmount: number;
  paidAmount: number;
  pendingAmount: number;
  rowCount: number;
  latestPaymentDate: string | null;
};

export type BonusPaymentRegistrySummary = {
  approvedUnpaidAmount: number;
  paidAmount: number;
  pendingAmount: number;
  totalRows: number;
  unmatchedRows: number;
  outOfScopeRows: number;
  byKey: Map<string, BonusPaymentLedgerState>;
};

const EMPTY_PAYMENT_STATE: BonusPaymentState = {
  registered: false,
  paid: false,
  paymentDate: null,
  amount: 0,
  rowCount: 0,
};

export function bonusPaymentKey(projectId: string, employeeId: string): string {
  return `${projectId}::${employeeId}`;
}

function latestDate(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() >= new Date(current).getTime() ? candidate : current;
}

export function buildBonusPaymentIndex(rows: readonly BonusPaymentRow[]): BonusPaymentIndex {
  const byKey = new Map<string, BonusPaymentState>();
  let unmatchedRows = 0;

  for (const row of rows) {
    if (!row.project_id || !row.employee_id) {
      unmatchedRows += 1;
      continue;
    }

    const key = bonusPaymentKey(row.project_id, row.employee_id);
    const current = byKey.get(key) || EMPTY_PAYMENT_STATE;
    const amount = Number(row.bonus_amount);
    const paid = current.paid || Boolean(row.payment_date);
    const registered = current.registered || row.status === 'approved' || Boolean(row.payment_date);

    byKey.set(key, {
      registered,
      paid,
      paymentDate: latestDate(current.paymentDate, row.payment_date),
      amount: current.amount + (Number.isFinite(amount) ? amount : 0),
      rowCount: current.rowCount + 1,
    });
  }

  return { byKey, totalRows: rows.length, unmatchedRows };
}

export function getBonusPaymentState(
  index: BonusPaymentIndex,
  projectId: string,
  employeeId: string,
): BonusPaymentState {
  return index.byKey.get(bonusPaymentKey(projectId, employeeId)) || { ...EMPTY_PAYMENT_STATE };
}

/**
 * Exact payment-ledger totals for CEO reporting. Draft amounts from project
 * notes never enter this summary: approved/unpaid and paid are derived only
 * from rows of the final `bonuses` registry, while payment_date is the sole
 * proof of an actual payment.
 */
export function summarizeBonusPaymentRegistry(
  rows: readonly BonusPaymentRow[],
  includedProjectIds?: ReadonlySet<string>,
): BonusPaymentRegistrySummary {
  const byKey = new Map<string, BonusPaymentLedgerState>();
  let approvedUnpaidAmount = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let unmatchedRows = 0;
  let outOfScopeRows = 0;
  let totalRows = 0;

  for (const row of rows) {
    totalRows += 1;
    if (includedProjectIds && row.project_id && !includedProjectIds.has(row.project_id)) {
      outOfScopeRows += 1;
      continue;
    }
    if (!row.project_id || !row.employee_id) {
      unmatchedRows += 1;
      continue;
    }

    const amount = Number(row.bonus_amount);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const paid = Boolean(row.payment_date);
    const approved = !paid && row.status === 'approved';
    const key = bonusPaymentKey(row.project_id, row.employee_id);
    const current = byKey.get(key) || {
      approvedUnpaidAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      rowCount: 0,
      latestPaymentDate: null,
    };

    if (paid) {
      paidAmount += safeAmount;
      current.paidAmount += safeAmount;
      current.latestPaymentDate = latestDate(current.latestPaymentDate, row.payment_date);
    } else if (approved) {
      approvedUnpaidAmount += safeAmount;
      current.approvedUnpaidAmount += safeAmount;
    } else {
      pendingAmount += safeAmount;
      current.pendingAmount += safeAmount;
    }
    current.rowCount += 1;
    byKey.set(key, current);
  }

  return {
    approvedUnpaidAmount,
    paidAmount,
    pendingAmount,
    totalRows,
    unmatchedRows,
    outOfScopeRows,
    byKey,
  };
}

export async function loadBonusPayments(
  projectIds?: readonly string[],
  signal?: AbortSignal,
): Promise<BonusPaymentRow[]> {
  const pageSize = 1000;
  const rows: BonusPaymentRow[] = [];
  const uniqueProjectIds = projectIds
    ? Array.from(new Set(projectIds.map(String).filter(Boolean)))
    : null;
  if (uniqueProjectIds && uniqueProjectIds.length === 0) return [];
  const scopes: Array<string[] | null> = uniqueProjectIds
    ? Array.from({ length: Math.ceil(uniqueProjectIds.length / 100) }, (_, index) => uniqueProjectIds.slice(index * 100, (index + 1) * 100))
    : [null];

  for (const scope of scopes) {
    let from = 0;
    for (;;) {
      let query = supabase
        .from('bonuses')
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (scope) query = query.in('project_id', scope);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < pageSize) break;
      from += page.length;
    }
  }

  return rows;
}
