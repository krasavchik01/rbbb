import { parseMoney, projectAmountWithoutVAT, projectContract, projectNotes } from '@/lib/contractData';
import { getProjectWorkflowStatus, isProjectClosed } from '@/lib/projectWorkflow';

export type AccountingDocumentType = 'invoice' | 'avr' | 'esf';
export type AccountingDocumentStatus = 'draft' | 'issued' | 'sent' | 'signed' | 'registered' | 'cancelled';
export type AccountingPaymentKind = 'advance' | 'interim' | 'final' | 'other';
export type AccountingOperationalStatus =
  | 'needs_contract'
  | 'needs_invoice'
  | 'awaiting_payment'
  | 'overdue'
  | 'needs_avr'
  | 'awaiting_signature'
  | 'needs_esf'
  | 'awaiting_esf_registration'
  | 'complete';
export type AccountingProjectStatus = AccountingOperationalStatus | 'closed_attention' | 'closed_complete';
export type AccountingDeadlineUrgency = 'overdue' | 'today' | 'week' | 'month' | 'later' | 'missing' | 'complete';

export interface AccountingFile {
  id?: string;
  fileName?: string;
  storagePath?: string;
  publicUrl?: string;
  url?: string;
  isSeafile?: boolean;
  fileType?: string;
  fileSize?: number;
}

export interface AccountingDocument {
  id: string;
  type: AccountingDocumentType;
  number: string;
  issueDate: string;
  dueDate?: string;
  amount: number;
  status: AccountingDocumentStatus;
  sentAt?: string;
  signedAt?: string;
  notes?: string;
  file?: AccountingFile;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  source?: 'manual' | '1c' | string;
  sourceDatabase?: string;
  externalId?: string;
  syncedAt?: string;
}

export interface AccountingPayment {
  id: string;
  date: string;
  amount: number;
  kind: AccountingPaymentKind;
  reference?: string;
  notes?: string;
  file?: AccountingFile;
  createdAt: string;
  createdBy?: string;
  source?: 'manual' | '1c' | string;
  sourceDatabase?: string;
  externalId?: string;
  syncedAt?: string;
}

export interface AccountingContact {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ProjectAccountingLedger {
  version: 1 | 2;
  documents: AccountingDocument[];
  payments: AccountingPayment[];
  contact?: AccountingContact;
  requirements?: { esf?: boolean };
  sync?: { source?: string; sourceDatabase?: string; lastSyncedAt?: string };
  updatedAt?: string;
  updatedBy?: string;
}

export interface AccountingProjectSummary {
  projectId: string;
  contractAmount: number;
  invoiceAmount: number;
  avrAmount: number;
  esfAmount: number;
  paidAmount: number;
  receivableAmount: number;
  contractBalanceAmount: number;
  overpaymentAmount: number;
  overdueAmount: number;
  status: AccountingProjectStatus;
  accountingStatus: AccountingOperationalStatus;
  projectWorkflowStatus: string;
  projectClosed: boolean;
  hasOutstandingAccounting: boolean;
  nextActionLabel: string;
  nextActionDeadline: string;
  daysUntilNextAction: number | null;
  deadlineUrgency: AccountingDeadlineUrgency;
  currency: string;
  invoices: AccountingDocument[];
  avrs: AccountingDocument[];
  esfs: AccountingDocument[];
  payments: AccountingPayment[];
  ledger: ProjectAccountingLedger;
}

const EMPTY_LEDGER: ProjectAccountingLedger = {
  version: 1,
  documents: [],
  payments: [],
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function isoDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function isoTimestamp(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function calendarDaysBetween(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function accountingDeadlineUrgency(
  deadline: string,
  today = new Date().toISOString().slice(0, 10),
  complete = false,
): { days: number | null; urgency: AccountingDeadlineUrgency } {
  if (complete) return { days: null, urgency: 'complete' };
  if (!deadline) return { days: null, urgency: 'missing' };
  const days = calendarDaysBetween(today, deadline);
  if (days === null) return { days: null, urgency: 'missing' };
  if (days < 0) return { days, urgency: 'overdue' };
  if (days === 0) return { days, urgency: 'today' };
  if (days <= 7) return { days, urgency: 'week' };
  if (days <= 30) return { days, urgency: 'month' };
  return { days, urgency: 'later' };
}

function normalizeFile(value: unknown): AccountingFile | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const file: AccountingFile = {
    id: text(source.id) || undefined,
    fileName: text(source.fileName ?? source.name) || undefined,
    storagePath: text(source.storagePath ?? source.path) || undefined,
    publicUrl: text(source.publicUrl) || undefined,
    url: text(source.url) || undefined,
    isSeafile: Boolean(source.isSeafile),
    fileType: text(source.fileType ?? source.type) || undefined,
    fileSize: Math.max(0, parseMoney(source.fileSize ?? source.size)),
  };
  return file.id || file.fileName || file.storagePath || file.publicUrl || file.url ? file : undefined;
}

function normalizeDocument(value: unknown, index: number): AccountingDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const type = source.type === 'avr' ? 'avr' : source.type === 'invoice' ? 'invoice' : source.type === 'esf' ? 'esf' : null;
  if (!type) return null;
  const statusValues: AccountingDocumentStatus[] = ['draft', 'issued', 'sent', 'signed', 'registered', 'cancelled'];
  const status = statusValues.includes(source.status as AccountingDocumentStatus)
    ? source.status as AccountingDocumentStatus
    : 'draft';
  const createdAt = isoTimestamp(source.createdAt) || new Date(0).toISOString();
  return {
    id: text(source.id) || `${type}-${index}-${createdAt}`,
    type,
    number: text(source.number),
    issueDate: isoDate(source.issueDate),
    dueDate: isoDate(source.dueDate) || undefined,
    amount: Math.max(0, parseMoney(source.amount)),
    status,
    sentAt: isoTimestamp(source.sentAt) || undefined,
    signedAt: isoTimestamp(source.signedAt) || undefined,
    notes: text(source.notes) || undefined,
    file: normalizeFile(source.file),
    createdAt,
    createdBy: text(source.createdBy) || undefined,
    updatedAt: isoTimestamp(source.updatedAt) || undefined,
    updatedBy: text(source.updatedBy) || undefined,
    source: text(source.source) || undefined,
    sourceDatabase: text(source.sourceDatabase) || undefined,
    externalId: text(source.externalId) || undefined,
    syncedAt: isoTimestamp(source.syncedAt) || undefined,
  };
}

function normalizePayment(value: unknown, index: number): AccountingPayment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const kinds: AccountingPaymentKind[] = ['advance', 'interim', 'final', 'other'];
  const kind = kinds.includes(source.kind as AccountingPaymentKind)
    ? source.kind as AccountingPaymentKind
    : 'other';
  const createdAt = isoTimestamp(source.createdAt) || new Date(0).toISOString();
  const amount = Math.max(0, parseMoney(source.amount));
  if (amount <= 0) return null;
  return {
    id: text(source.id) || `payment-${index}-${createdAt}`,
    date: isoDate(source.date),
    amount,
    kind,
    reference: text(source.reference) || undefined,
    notes: text(source.notes) || undefined,
    file: normalizeFile(source.file),
    createdAt,
    createdBy: text(source.createdBy) || undefined,
    source: text(source.source) || undefined,
    sourceDatabase: text(source.sourceDatabase) || undefined,
    externalId: text(source.externalId) || undefined,
    syncedAt: isoTimestamp(source.syncedAt) || undefined,
  };
}

export function normalizeAccountingLedger(value: unknown): ProjectAccountingLedger {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_LEDGER };
  const source = value as Record<string, unknown>;
  const contactSource = source.contact && typeof source.contact === 'object' && !Array.isArray(source.contact)
    ? source.contact as Record<string, unknown>
    : {};
  const contact: AccountingContact = {
    name: text(contactSource.name) || undefined,
    phone: text(contactSource.phone) || undefined,
    email: text(contactSource.email) || undefined,
    notes: text(contactSource.notes) || undefined,
  };
  return {
    version: source.version === 2 ? 2 : 1,
    documents: (Array.isArray(source.documents) ? source.documents : [])
      .map(normalizeDocument)
      .filter((item): item is AccountingDocument => Boolean(item)),
    payments: (Array.isArray(source.payments) ? source.payments : [])
      .map(normalizePayment)
      .filter((item): item is AccountingPayment => Boolean(item)),
    contact: Object.values(contact).some(Boolean) ? contact : undefined,
    requirements: source.requirements && typeof source.requirements === 'object' && !Array.isArray(source.requirements)
      ? { esf: Boolean((source.requirements as Record<string, unknown>).esf) }
      : undefined,
    sync: source.sync && typeof source.sync === 'object' && !Array.isArray(source.sync)
      ? {
          source: text((source.sync as Record<string, unknown>).source) || undefined,
          sourceDatabase: text((source.sync as Record<string, unknown>).sourceDatabase) || undefined,
          lastSyncedAt: isoTimestamp((source.sync as Record<string, unknown>).lastSyncedAt) || undefined,
        }
      : undefined,
    updatedAt: isoTimestamp(source.updatedAt) || undefined,
    updatedBy: text(source.updatedBy) || undefined,
  };
}

export function projectAccountingLedger(project: unknown): ProjectAccountingLedger {
  const notes = projectNotes(project);
  const direct = project && typeof project === 'object' && !Array.isArray(project)
    ? (project as Record<string, unknown>).accounting
    : undefined;
  return normalizeAccountingLedger(direct ?? notes.accounting);
}

export function calculateAccountingProject(
  project: any,
  today = new Date().toISOString().slice(0, 10),
): AccountingProjectSummary {
  const ledger = projectAccountingLedger(project);
  const activeDocuments = ledger.documents.filter((document) => document.status !== 'cancelled');
  const invoices = activeDocuments.filter((document) => document.type === 'invoice');
  const avrs = activeDocuments.filter((document) => document.type === 'avr');
  const esfs = activeDocuments.filter((document) => document.type === 'esf');
  const payments = ledger.payments;
  const invoiceAmount = invoices.reduce((sum, document) => sum + document.amount, 0);
  const avrAmount = avrs.reduce((sum, document) => sum + document.amount, 0);
  const esfAmount = esfs.reduce((sum, document) => sum + document.amount, 0);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const receivableAmount = Math.max(0, invoiceAmount - paidAmount);
  const overpaymentAmount = Math.max(0, paidAmount - invoiceAmount);
  const contractAmount = Math.max(0, projectAmountWithoutVAT(project));
  const contractBalanceAmount = Math.max(0, contractAmount - paidAmount);
  const overdueInvoices = invoices.filter((invoice) => (
    invoice.dueDate && invoice.dueDate < today && invoice.status !== 'draft'
  ));
  const overdueAmount = receivableAmount > 0 && overdueInvoices.length > 0 ? receivableAmount : 0;
  const contract = projectContract(project);

  let accountingStatus: AccountingOperationalStatus;
  if (!contract?.number || contractAmount <= 0) accountingStatus = 'needs_contract';
  else if (invoiceAmount <= 0) accountingStatus = 'needs_invoice';
  else if (overdueAmount > 0) accountingStatus = 'overdue';
  else if (receivableAmount > 0) accountingStatus = 'awaiting_payment';
  else if (avrAmount <= 0) accountingStatus = 'needs_avr';
  else if (avrs.some((avr) => avr.status !== 'signed')) accountingStatus = 'awaiting_signature';
  else if (ledger.requirements?.esf && esfAmount <= 0) accountingStatus = 'needs_esf';
  else if (ledger.requirements?.esf && esfs.some((esf) => esf.status !== 'registered')) accountingStatus = 'awaiting_esf_registration';
  else accountingStatus = 'complete';
  const projectWorkflowStatus = getProjectWorkflowStatus(project);
  const projectClosed = isProjectClosed(project);
  const hasOutstandingAccounting = accountingStatus !== 'complete';
  const status: AccountingProjectStatus = projectClosed
    ? hasOutstandingAccounting ? 'closed_attention' : 'closed_complete'
    : accountingStatus;

  const projectStartDate = isoDate(contract?.serviceStartDate || project?.start_date || project?.startDate || contract?.date);
  const projectEndDate = isoDate(contract?.serviceEndDate || project?.deadline);
  const unpaidInvoiceDeadline = invoices
    .filter((invoice) => invoice.status !== 'draft' && invoice.dueDate)
    .map((invoice) => invoice.dueDate || '')
    .sort()[0] || '';
  const unsignedAvrDeadline = avrs
    .filter((avr) => avr.status !== 'signed' && avr.dueDate)
    .map((avr) => avr.dueDate || '')
    .sort()[0] || '';
  const pendingEsfDeadline = esfs
    .filter((esf) => esf.status !== 'registered' && esf.dueDate)
    .map((esf) => esf.dueDate || '')
    .sort()[0] || '';
  const nextActionLabel: Record<AccountingOperationalStatus, string> = {
    needs_contract: 'Добавить договор и сумму',
    needs_invoice: 'Выставить счёт',
    awaiting_payment: 'Получить оплату',
    overdue: 'Получить просроченную оплату',
    needs_avr: 'Оформить АВР',
    awaiting_signature: 'Получить подписанный АВР',
    needs_esf: 'Выписать ЭСФ',
    awaiting_esf_registration: 'Зарегистрировать ЭСФ',
    complete: 'Документы закрыты',
  };
  const nextActionDeadline = accountingStatus === 'awaiting_payment' || accountingStatus === 'overdue'
    ? unpaidInvoiceDeadline
    : accountingStatus === 'awaiting_signature'
      ? unsignedAvrDeadline
      : accountingStatus === 'awaiting_esf_registration'
        ? pendingEsfDeadline
        : accountingStatus === 'needs_esf'
          ? projectEndDate
      : accountingStatus === 'needs_avr'
        ? projectEndDate
        : accountingStatus === 'needs_contract' || accountingStatus === 'needs_invoice'
          ? projectStartDate || projectEndDate
          : '';
  const deadline = accountingDeadlineUrgency(nextActionDeadline, today, accountingStatus === 'complete');

  return {
    projectId: text(project?.id),
    contractAmount,
    invoiceAmount,
    avrAmount,
    esfAmount,
    paidAmount,
    receivableAmount,
    contractBalanceAmount,
    overpaymentAmount,
    overdueAmount,
    status,
    accountingStatus,
    projectWorkflowStatus,
    projectClosed,
    hasOutstandingAccounting,
    nextActionLabel: nextActionLabel[accountingStatus],
    nextActionDeadline,
    daysUntilNextAction: deadline.days,
    deadlineUrgency: deadline.urgency,
    currency: text(contract?.currency || project?.currency) || 'KZT',
    invoices,
    avrs,
    esfs,
    payments,
    ledger,
  };
}

export function upsertAccountingDocument(
  ledger: ProjectAccountingLedger,
  document: AccountingDocument,
  actor?: string,
): ProjectAccountingLedger {
  const current = normalizeAccountingLedger(ledger);
  const exists = current.documents.some((item) => item.id === document.id);
  return {
    ...current,
    documents: exists
      ? current.documents.map((item) => item.id === document.id ? document : item)
      : [...current.documents, document],
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
}

export function addAccountingPayment(
  ledger: ProjectAccountingLedger,
  payment: AccountingPayment,
  actor?: string,
): ProjectAccountingLedger {
  const current = normalizeAccountingLedger(ledger);
  return {
    ...current,
    payments: [...current.payments, payment],
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
}

export function updateAccountingContact(
  ledger: ProjectAccountingLedger,
  contact: AccountingContact,
  actor?: string,
): ProjectAccountingLedger {
  const current = normalizeAccountingLedger(ledger);
  return {
    ...current,
    contact: {
      name: text(contact.name) || undefined,
      phone: text(contact.phone) || undefined,
      email: text(contact.email) || undefined,
      notes: text(contact.notes) || undefined,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
}

export const ACCOUNTING_STATUS_LABELS: Record<AccountingProjectStatus, string> = {
  needs_contract: 'Нет договора или суммы',
  needs_invoice: 'Нужно выставить счёт',
  awaiting_payment: 'Ожидаем оплату',
  overdue: 'Просроченная оплата',
  needs_avr: 'Нужно оформить АВР',
  awaiting_signature: 'Ждём подписанный АВР',
  needs_esf: 'Нужно выписать ЭСФ',
  awaiting_esf_registration: 'Ждём регистрацию ЭСФ',
  complete: 'Документы закрыты',
  closed_attention: 'Проект закрыт · бухгалтерия требует действий',
  closed_complete: 'Проект и бухгалтерия закрыты',
};

export const ACCOUNTING_DOCUMENT_STATUS_LABELS: Record<AccountingDocumentStatus, string> = {
  draft: 'Черновик',
  issued: 'Выставлен',
  sent: 'Отправлен',
  signed: 'Подписан',
  registered: 'Зарегистрирован',
  cancelled: 'Отменён',
};

export const ACCOUNTING_PAYMENT_KIND_LABELS: Record<AccountingPaymentKind, string> = {
  advance: 'Предоплата',
  interim: 'Промежуточная',
  final: 'Финальная',
  other: 'Другая',
};
