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

export async function loadBonusPayments(): Promise<BonusPaymentRow[]> {
  const { data, error } = await supabase
    .from('bonuses')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}
