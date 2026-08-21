import type {
  AccountingDeadlineUrgency,
  AccountingProjectStatus,
  AccountingProjectSummary,
} from '@/lib/accountingLedger';

export type AccountingDeadlineFilter = 'all' | 'overdue' | 'today' | 'week' | 'month' | 'missing';
export type AccountingProjectStateFilter = 'all' | 'open' | 'closed';
export type AccountingPaymentFilter = 'all' | 'debt' | 'unpaid' | 'partial' | 'paid' | 'overpaid';
export type AccountingDocumentFilter =
  | 'all'
  | 'invoice_missing'
  | 'avr_missing'
  | 'avr_unsigned'
  | 'esf_missing'
  | 'esf_unregistered'
  | 'complete';
export type AccountingContractFilter = 'all' | 'ready' | 'missing_number' | 'missing_amount' | 'missing_file';
export type AccountingSourceFilter = 'all' | 'has_1c' | 'has_hub' | 'mixed';
export type AccountingQuickFilter =
  | 'all'
  | 'action'
  | 'overdue'
  | 'debt'
  | 'no_invoice'
  | 'avr_unsigned'
  | 'esf_unregistered'
  | 'closed_debt';
export type AccountingSort = 'urgency' | 'debt_desc' | 'amount_desc' | 'paid_desc' | 'client';

export interface AccountingFilterableRow {
  clientName: string;
  companyName: string;
  contractNumber: string;
  leaderName: string;
  contractFileCount: number;
  summary: AccountingProjectSummary;
}

export interface AccountingFilterValues {
  query: string;
  company: string;
  status: 'all' | AccountingProjectStatus;
  deadline: AccountingDeadlineFilter;
  projectState: AccountingProjectStateFilter;
  payment: AccountingPaymentFilter;
  document: AccountingDocumentFilter;
  contract: AccountingContractFilter;
  source: AccountingSourceFilter;
  quick: AccountingQuickFilter;
  amountMin: number | null;
  amountMax: number | null;
  sort: AccountingSort;
}

export const DEFAULT_ACCOUNTING_FILTERS: AccountingFilterValues = {
  query: '',
  company: 'all',
  status: 'all',
  deadline: 'all',
  projectState: 'all',
  payment: 'all',
  document: 'all',
  contract: 'all',
  source: 'all',
  quick: 'all',
  amountMin: null,
  amountMax: null,
  sort: 'urgency',
};

const urgencyRank: Record<AccountingDeadlineUrgency, number> = {
  overdue: 0,
  today: 1,
  week: 2,
  month: 3,
  later: 4,
  missing: 5,
  complete: 6,
};

export function matchesAccountingDeadline(
  urgency: AccountingDeadlineUrgency,
  filter: AccountingDeadlineFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'overdue') return urgency === 'overdue';
  if (filter === 'today') return urgency === 'today';
  if (filter === 'week') return urgency === 'week';
  if (filter === 'month') return urgency === 'month';
  return urgency === 'missing';
}

function matchesStatus(row: AccountingFilterableRow, status: AccountingFilterValues['status']): boolean {
  if (status === 'all') return true;
  const linkedClosedStatus = status === 'closed_attention' || status === 'closed_complete';
  return linkedClosedStatus ? row.summary.status === status : row.summary.accountingStatus === status;
}

function matchesPayment(row: AccountingFilterableRow, filter: AccountingPaymentFilter): boolean {
  if (filter === 'all') return true;
  const { invoiceAmount, paidAmount, receivableAmount, overpaymentAmount } = row.summary;
  if (filter === 'debt') return receivableAmount > 0;
  if (filter === 'unpaid') return invoiceAmount > 0 && paidAmount <= 0;
  if (filter === 'partial') return paidAmount > 0 && receivableAmount > 0;
  if (filter === 'overpaid') return overpaymentAmount > 0;
  return invoiceAmount > 0 && receivableAmount <= 0 && overpaymentAmount <= 0;
}

function matchesDocument(row: AccountingFilterableRow, filter: AccountingDocumentFilter): boolean {
  if (filter === 'all') return true;
  const { invoices, avrs, esfs, ledger } = row.summary;
  if (filter === 'invoice_missing') return invoices.length === 0;
  if (filter === 'avr_missing') return avrs.length === 0;
  if (filter === 'avr_unsigned') return avrs.some((item) => item.status !== 'signed');
  if (filter === 'esf_missing') return esfs.length === 0;
  if (filter === 'esf_unregistered') return esfs.some((item) => item.status !== 'registered');
  const invoicesReady = invoices.length > 0;
  const avrsReady = avrs.length > 0 && avrs.every((item) => item.status === 'signed');
  const esfsReady = !ledger.requirements?.esf
    || (esfs.length > 0 && esfs.every((item) => item.status === 'registered'));
  return invoicesReady && avrsReady && esfsReady;
}

function hasContractNumber(row: AccountingFilterableRow): boolean {
  const value = row.contractNumber.trim();
  return Boolean(value && value !== '—');
}

function matchesContract(row: AccountingFilterableRow, filter: AccountingContractFilter): boolean {
  if (filter === 'all') return true;
  const hasNumber = hasContractNumber(row);
  const hasAmount = row.summary.contractAmount > 0;
  const hasFile = row.contractFileCount > 0;
  if (filter === 'ready') return hasNumber && hasAmount && hasFile;
  if (filter === 'missing_number') return !hasNumber;
  if (filter === 'missing_amount') return !hasAmount;
  return !hasFile;
}

function matchesSource(row: AccountingFilterableRow, filter: AccountingSourceFilter): boolean {
  if (filter === 'all') return true;
  const records = [...row.summary.ledger.documents, ...row.summary.ledger.payments];
  const hasOneC = row.summary.ledger.sync?.source === '1c'
    || records.some((item) => item.source === '1c');
  const hasHub = records.some((item) => item.source !== '1c')
    || (!hasOneC && records.length === 0);
  if (filter === 'has_1c') return hasOneC;
  if (filter === 'has_hub') return hasHub;
  return hasOneC && hasHub;
}

function matchesQuick(row: AccountingFilterableRow, filter: AccountingQuickFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'action') return row.summary.accountingStatus !== 'complete' || row.summary.hasOutstandingAccounting;
  if (filter === 'overdue') return row.summary.deadlineUrgency === 'overdue';
  if (filter === 'debt') return row.summary.receivableAmount > 0;
  if (filter === 'no_invoice') return row.summary.invoices.length === 0;
  if (filter === 'avr_unsigned') return row.summary.avrs.some((item) => item.status !== 'signed');
  if (filter === 'esf_unregistered') return row.summary.esfs.some((item) => item.status !== 'registered');
  return row.summary.projectClosed && row.summary.receivableAmount > 0;
}

function matchesQuery(row: AccountingFilterableRow, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (!normalized) return true;
  const contact = row.summary.ledger.contact || {};
  return [
    row.clientName,
    row.companyName,
    row.contractNumber,
    row.leaderName,
    contact.name,
    contact.phone,
    contact.email,
  ].some((value) => String(value || '').toLocaleLowerCase('ru').includes(normalized));
}

export function filterAndSortAccountingRows<T extends AccountingFilterableRow>(
  rows: T[],
  filters: AccountingFilterValues,
): T[] {
  return rows.filter((row) => {
    if (filters.company !== 'all' && row.companyName !== filters.company) return false;
    if (!matchesStatus(row, filters.status)) return false;
    if (!matchesAccountingDeadline(row.summary.deadlineUrgency, filters.deadline)) return false;
    if (filters.projectState === 'open' && row.summary.projectClosed) return false;
    if (filters.projectState === 'closed' && !row.summary.projectClosed) return false;
    if (!matchesPayment(row, filters.payment)) return false;
    if (!matchesDocument(row, filters.document)) return false;
    if (!matchesContract(row, filters.contract)) return false;
    if (!matchesSource(row, filters.source)) return false;
    if (!matchesQuick(row, filters.quick)) return false;
    if (filters.amountMin !== null && row.summary.contractAmount < filters.amountMin) return false;
    if (filters.amountMax !== null && row.summary.contractAmount > filters.amountMax) return false;
    return matchesQuery(row, filters.query);
  }).sort((left, right) => {
    if (filters.sort === 'debt_desc') {
      return right.summary.receivableAmount - left.summary.receivableAmount
        || left.clientName.localeCompare(right.clientName, 'ru');
    }
    if (filters.sort === 'amount_desc') {
      return right.summary.contractAmount - left.summary.contractAmount
        || left.clientName.localeCompare(right.clientName, 'ru');
    }
    if (filters.sort === 'paid_desc') {
      return right.summary.paidAmount - left.summary.paidAmount
        || left.clientName.localeCompare(right.clientName, 'ru');
    }
    if (filters.sort === 'client') return left.clientName.localeCompare(right.clientName, 'ru');
    const urgency = urgencyRank[left.summary.deadlineUrgency] - urgencyRank[right.summary.deadlineUrgency];
    const leftDays = left.summary.daysUntilNextAction ?? Number.MAX_SAFE_INTEGER;
    const rightDays = right.summary.daysUntilNextAction ?? Number.MAX_SAFE_INTEGER;
    return urgency || leftDays - rightDays || left.clientName.localeCompare(right.clientName, 'ru');
  });
}

export function countActiveAccountingFilters(filters: AccountingFilterValues): number {
  return Number(Boolean(filters.query.trim()))
    + Number(filters.company !== 'all')
    + Number(filters.status !== 'all')
    + Number(filters.deadline !== 'all')
    + Number(filters.projectState !== 'all')
    + Number(filters.payment !== 'all')
    + Number(filters.document !== 'all')
    + Number(filters.contract !== 'all')
    + Number(filters.source !== 'all')
    + Number(filters.quick !== 'all')
    + Number(filters.amountMin !== null)
    + Number(filters.amountMax !== null)
    + Number(filters.sort !== 'urgency');
}
