import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Database,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { supabaseDataStore, type Project } from '@/lib/supabaseDataStore';
import { projectContract, projectContractFiles, projectNotes } from '@/lib/contractData';
import { effectiveProjectTeam } from '@/lib/projectLegacyCompatibility';
import { projectForAccountingWorkspace } from '@/lib/accountingAccess';
import { sendEmail } from '@/lib/emailService';
import {
  ACCOUNTING_DOCUMENT_STATUS_LABELS,
  ACCOUNTING_PAYMENT_KIND_LABELS,
  ACCOUNTING_STATUS_LABELS,
  addAccountingPayment,
  accountingDeadlineUrgency,
  calculateAccountingProject,
  projectAccountingLedger,
  updateAccountingContact,
  upsertAccountingDocument,
  type AccountingContact,
  type AccountingDocument,
  type AccountingDocumentStatus,
  type AccountingDocumentType,
  type AccountingDeadlineUrgency,
  type AccountingFile,
  type AccountingPayment,
  type AccountingPaymentKind,
  type AccountingProjectStatus,
  type AccountingProjectSummary,
} from '@/lib/accountingLedger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { projectCompanyName } from '@/types/companies';
import {
  getOneCSyncStatus,
  createOneCIntegrationKey,
  ONEC_REJECTED_REASON_LABELS,
  ONEC_UNMATCHED_REASON_LABELS,
  pullOneCAccounting,
  type OneCSyncStatus,
} from '@/lib/oneCAccounting';
import {
  buildOneCAccountantMessage,
  buildOneCAccountingFixInstruction,
  classifyOneCCounterparty,
  filterOneCAccountingInbox,
  loadOneCAccountingInbox,
  ONE_C_ACCOUNTING_SCOPE_LABELS,
  ONE_C_INBOX_KIND_LABELS,
  summarizeOneCAccountingInbox,
  type OneCAccountingInboxRecord,
  type OneCAccountingScope,
} from '@/lib/oneCAccountingInbox';
import {
  DEFAULT_ACCOUNTING_FILTERS,
  countActiveAccountingFilters,
  filterAndSortAccountingRows,
  type AccountingContractFilter,
  type AccountingDeadlineFilter,
  type AccountingDocumentFilter,
  type AccountingPaymentFilter,
  type AccountingProjectStateFilter,
  type AccountingQuickFilter,
  type AccountingSort,
  type AccountingSourceFilter,
} from '@/lib/accountingFilters';

type EntryKind = AccountingDocumentType | 'payment';
type AccountingRow = {
  project: Project;
  summary: AccountingProjectSummary;
  clientName: string;
  companyName: string;
  contractNumber: string;
  contractDate: string;
  deadline: string;
  leaderName: string;
  contractFileCount: number;
};

const STATUS_COLORS: Record<AccountingProjectStatus, string> = {
  needs_contract: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  needs_invoice: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  awaiting_payment: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  overdue: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  needs_avr: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
  awaiting_signature: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  needs_esf: 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200',
  awaiting_esf_registration: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
  complete: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  closed_attention: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
  closed_complete: 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100',
};

const DEADLINE_COLORS: Record<AccountingDeadlineUrgency, string> = {
  overdue: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
  today: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
  week: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
  month: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  later: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  missing: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
  complete: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
};

const DEADLINE_FILTER_LABELS: Record<AccountingDeadlineFilter, string> = {
  all: 'Все сроки',
  overdue: 'Просрочено',
  today: 'Сделать сегодня',
  week: 'От 1 до 7 дней',
  month: 'От 8 до 30 дней',
  missing: 'Срок не задан',
};

const PROJECT_STATE_FILTER_LABELS: Record<AccountingProjectStateFilter, string> = {
  all: 'Все проекты',
  open: 'Только в работе',
  closed: 'Только закрытые',
};

const PAYMENT_FILTER_LABELS: Record<AccountingPaymentFilter, string> = {
  all: 'Любая оплата',
  debt: 'Есть задолженность',
  unpaid: 'Выставлено, но не оплачено',
  partial: 'Счета оплачены частично',
  paid: 'Все выставленные счета оплачены',
  overpaid: 'Оплата выше выставленных счетов',
};

const DOCUMENT_FILTER_LABELS: Record<AccountingDocumentFilter, string> = {
  all: 'Любые документы',
  invoice_missing: 'Нет счёта',
  avr_missing: 'Нет АВР',
  avr_unsigned: 'АВР не подписан',
  esf_missing: 'Нет ЭСФ',
  esf_unregistered: 'ЭСФ не зарегистрирован',
  complete: 'Комплект документов готов',
};

const CONTRACT_FILTER_LABELS: Record<AccountingContractFilter, string> = {
  all: 'Любой договор',
  ready: 'Договор заполнен и загружен',
  missing_number: 'Нет номера договора',
  missing_amount: 'Нет суммы договора',
  missing_file: 'Нет файла договора',
};

const SOURCE_FILTER_LABELS: Record<AccountingSourceFilter, string> = {
  all: 'HUB и 1С',
  has_1c: 'Есть данные из 1С',
  has_hub: 'Есть ручные данные HUB',
  mixed: 'Смешанные данные HUB + 1С',
};

const SORT_LABELS: Record<AccountingSort, string> = {
  urgency: 'Сначала срочные',
  debt_desc: 'Сначала большой долг',
  amount_desc: 'Сначала крупные договоры',
  paid_desc: 'Сначала крупные оплаты',
  client: 'Заказчик А–Я',
};

const QUICK_FILTERS: Array<{ value: AccountingQuickFilter; label: string }> = [
  { value: 'action', label: 'Требуют действий' },
  { value: 'overdue', label: 'Просрочено' },
  { value: 'debt', label: 'Есть долг' },
  { value: 'no_invoice', label: 'Без счёта' },
  { value: 'avr_unsigned', label: 'АВР не подписан' },
  { value: 'esf_unregistered', label: 'ЭСФ не зарегистрирован' },
  { value: 'closed_debt', label: 'Закрыты с долгом' },
];

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateAfter(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Ещё не запускалась';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function documentTypeLabel(type: AccountingDocumentType): string {
  if (type === 'invoice') return 'Счёт';
  if (type === 'avr') return 'АВР';
  return 'ЭСФ';
}

function deadlineText(urgency: AccountingDeadlineUrgency, days: number | null): string {
  if (urgency === 'complete') return 'Закрыто';
  if (urgency === 'missing' || days === null) return 'Срок не задан';
  if (urgency === 'today') return 'Сделать сегодня';
  if (urgency === 'overdue') return `Просрочено на ${Math.abs(days)} дн.`;
  return `Осталось ${days} дн.`;
}

function parseFilterAmount(value: string): number | null | undefined {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function DeadlineBadge({ urgency, days }: { urgency: AccountingDeadlineUrgency; days: number | null }) {
  return <Badge variant="outline" className={`whitespace-nowrap ${DEADLINE_COLORS[urgency]}`}><CalendarClock className="mr-1 h-3.5 w-3.5" />{deadlineText(urgency, days)}</Badge>;
}

function formatMoney(value: number, currency = 'KZT'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'KZT' ? 0 : 2,
  }).format(Number(value) || 0);
}

function formatCompactMoney(value: number, currency = 'KZT'): string {
  const amount = Number(value) || 0;
  const symbol = currency === 'KZT' ? '₸' : currency;
  const format = (scaled: number) => new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: scaled >= 100 ? 0 : 1,
  }).format(scaled);
  if (Math.abs(amount) >= 1_000_000_000) return `${format(amount / 1_000_000_000)} млрд ${symbol}`;
  if (Math.abs(amount) >= 1_000_000) return `${format(amount / 1_000_000)} млн ${symbol}`;
  if (Math.abs(amount) >= 1_000) return `${format(amount / 1_000)} тыс. ${symbol}`;
  return `${format(amount)} ${symbol}`;
}

function formatAmountBreakdown(amounts: Record<string, number>): string {
  const entries = Object.entries(amounts).sort(([left], [right]) => (
    left === 'KZT' ? -1 : right === 'KZT' ? 1 : left.localeCompare(right)
  ));
  if (entries.length === 0) return formatCompactMoney(0, 'KZT');
  return entries.map(([currency, value]) => formatCompactMoney(value, currency)).join(' · ');
}

function isOneCSessionError(value: string): boolean {
  return /актуальн.*сесси|сесси.*устар|авториза|\b401\b|jwt/i.test(String(value || ''));
}

function oneCCandidateProjectLabel(project: Project): string {
  const contract = projectContract(project);
  const number = String(contract?.number || 'без номера').trim();
  return `${clientName(project)} · договор ${number} · ${projectCompanyName(project) || 'компания не указана'}`;
}

function OneCInboxCard({
  records,
  projects,
  loading,
  refreshing,
  available,
  error,
  truncated,
  expectedUnmatchedCount,
  onRefresh,
}: {
  records: OneCAccountingInboxRecord[];
  projects: Project[];
  loading: boolean;
  refreshing: boolean;
  available: boolean;
  error: string;
  truncated: boolean;
  expectedUnmatchedCount: number | null;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<OneCAccountingScope>('review');
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [copiedRecordId, setCopiedRecordId] = useState('');
  const [classifyingRecordId, setClassifyingRecordId] = useState('');
  const [classificationMessage, setClassificationMessage] = useState('');
  const [classificationError, setClassificationError] = useState('');
  const scopeCounts = useMemo(() => records.reduce<Record<OneCAccountingScope, number>>((result, record) => {
    result[record.accountingScope] += 1;
    return result;
  }, { project: 0, supplier: 0, other: 0, review: 0 }), [records]);
  const scopedRecords = useMemo(
    () => records.filter((record) => record.accountingScope === scopeFilter),
    [records, scopeFilter],
  );
  const summary = useMemo(() => summarizeOneCAccountingInbox(scopedRecords), [scopedRecords]);
  const filtered = useMemo(() => filterOneCAccountingInbox(scopedRecords, query), [scopedRecords, query]);
  const projectLabels = useMemo(() => new Map(
    projects.map((project) => [String(project.id), oneCCandidateProjectLabel(project)]),
  ), [projects]);
  const visible = filtered.slice(0, visibleLimit);
  const reasons = Object.entries(summary.byReason).sort(([, left], [, right]) => right.count - left.count);
  const registryUnavailable = expectedUnmatchedCount !== null
    && expectedUnmatchedCount > 0
    && !available;
  const displayCount = records.length;
  const candidateLabels = (record: OneCAccountingInboxRecord) => record.matchCandidates
    .map((projectId) => projectLabels.get(projectId) || `Проект ${projectId}`)
    .filter(Boolean);
  const copyAccountantMessage = async (record: OneCAccountingInboxRecord) => {
    await navigator.clipboard.writeText(buildOneCAccountantMessage(record, candidateLabels(record)));
    setCopiedRecordId(record.id);
    window.setTimeout(() => setCopiedRecordId((current) => current === record.id ? '' : current), 1800);
  };
  const classifyCounterparty = async (record: OneCAccountingInboxRecord, scope: OneCAccountingScope) => {
    setClassifyingRecordId(record.id);
    setClassificationMessage('');
    setClassificationError('');
    try {
      const result = await classifyOneCCounterparty(record.id, scope);
      setClassificationMessage(
        scope === 'review'
          ? 'Ручная классификация снята. Контрагент возвращён в автоматически определённый раздел.'
          : `${ONE_C_ACCOUNTING_SCOPE_LABELS[scope]}: перенесено записей — ${result.updated}.`,
      );
      onRefresh();
    } catch (classificationFailure) {
      setClassificationError(classificationFailure instanceof Error
        ? classificationFailure.message
        : 'Не удалось сохранить вид контрагента');
    } finally {
      setClassifyingRecordId('');
    }
  };

  useEffect(() => {
    setVisibleLimit(100);
  }, [query, scopeFilter]);

  useEffect(() => {
    if (scopeCounts[scopeFilter] > 0 || records.length === 0) return;
    const fallback = (['review', 'project', 'supplier', 'other'] as OneCAccountingScope[])
      .find((scope) => scopeCounts[scope] > 0);
    if (fallback) setScopeFilter(fallback);
  }, [records.length, scopeCounts, scopeFilter]);

  if (!loading && !available && !error && displayCount <= 0) return null;
  if (loading) {
    return <Card className="border-sky-200/80 dark:border-sky-900/70"><CardContent className="flex items-center gap-3 p-4"><Loader2 className="h-5 w-5 animate-spin text-sky-600" /><div><div className="font-semibold">Реестр контрагентов 1С</div><div className="text-xs text-muted-foreground">Разделяю клиентов, поставщиков и прочие операции…</div></div></CardContent></Card>;
  }
  if (error && !available && records.length === 0) {
    const sessionExpired = isOneCSessionError(error);
    return <Card className="border-red-300 dark:border-red-900"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div><div className="font-semibold">{sessionExpired ? 'Сессия HUB устарела' : 'Не удалось загрузить реестр разбора 1С'}</div><div className="text-sm text-muted-foreground">{sessionExpired ? 'Сам обмен 1С мог выполниться, но кабинет не может прочитать его результат. Выйдите из HUB, войдите снова и откройте бухгалтерию.' : error}</div></div></div><Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{sessionExpired ? 'Проверить снова' : 'Повторить'}</Button></CardContent></Card>;
  }

  return (
    <Card className="overflow-hidden border-sky-200/80 dark:border-sky-900/70">
      <CardContent className="p-0">
        <div className="border-b bg-sky-50/50 p-4 dark:bg-sky-950/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Database className="h-5 w-5" /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2"><div className="font-semibold">Клиенты, поставщики и прочие операции</div><Badge variant="secondary">{displayCount}</Badge></div>
                <div className="mt-1 text-sm text-muted-foreground">Поставщики и хозяйственные расходы учитываются отдельно и не считаются ошибками проектов.</div>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>

          {error && <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/70 p-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Не удалось обновить реестр: {error}. Показаны последние успешно загруженные данные.</span></div>}
          {registryUnavailable && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/70 p-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>По сводке на разборе: {expectedUnmatchedCount}. Подробный реестр пока недоступен — он появится после обновления базы HUB и следующего полного обмена.</span></div>}
          {truncated && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/70 p-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Реестр ограничен 10 000 записями. В 1С есть ещё записи на разборе; уточните поиск или устраните несопоставленные договоры.</span></div>}
          {classificationMessage && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{classificationMessage}</div>}
          {classificationError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{classificationError}</div>}

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {([
              ['review', 'Нужно определить', 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'],
              ['project', 'Клиенты / проекты', 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200'],
              ['supplier', 'Поставщики / расходы', 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'],
              ['other', 'Прочие операции', 'border-slate-300 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-200'],
            ] as const).map(([scope, label, color]) => (
              <button key={scope} type="button" onClick={() => setScopeFilter(scope)} className={`rounded-lg border p-3 text-left transition hover:brightness-95 ${color} ${scopeFilter === scope ? 'ring-2 ring-primary/40' : ''}`}>
                <div className="text-xs font-medium">{label}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{scopeCounts[scope]}</div>
              </button>
            ))}
          </div>

          {summary.count > 0 && <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(['invoice', 'avr', 'esf', 'payment'] as const).map((recordKind) => {
              const item = summary.byKind[recordKind];
              return <div key={recordKind} className="rounded-lg border bg-background p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{ONE_C_INBOX_KIND_LABELS[recordKind]}</span><b className="tabular-nums">{item.count}</b></div><div className="mt-1 truncate text-xs font-medium tabular-nums" title={formatAmountBreakdown(item.amountsByCurrency)}>{formatAmountBreakdown(item.amountsByCurrency)}</div></div>;
            })}
          </div>}

          {scopeFilter === 'project' && reasons.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{reasons.map(([reason, item]) => <Badge key={reason} variant="outline" className="border-red-300 bg-background px-2.5 py-1 text-red-900 dark:text-red-200">{ONEC_UNMATCHED_REASON_LABELS[reason] || reason}: {item.count}</Badge>)}</div>}
        </div>

        {summary.count > 0 && (
          <>
            <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1 sm:max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Контрагент, БИН, договор, документ или назначение платежа…" /></div>
              <div className="whitespace-nowrap text-sm text-muted-foreground">{filtered.length} из {scopedRecords.length}</div>
            </div>

            <div className="hidden max-h-[560px] overflow-auto md:block">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr><th className="px-3 py-2.5">Документ 1С</th><th className="px-3 py-2.5">Контрагент и назначение</th><th className="px-3 py-2.5 text-right">Сумма</th><th className="px-3 py-2.5">Как учитывать</th></tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((record) => {
                    const instruction = buildOneCAccountingFixInstruction(record);
                    const candidates = candidateLabels(record);
                    return (
                      <tr key={record.id} className="align-top hover:bg-muted/30">
                        <td className="w-[220px] px-3 py-3">
                          <div className="flex items-center gap-2"><Badge variant="outline">{ONE_C_INBOX_KIND_LABELS[record.kind]}</Badge><span className="font-semibold">№ {record.documentNumber || 'б/н'}</span></div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatDate(record.documentDate)}</div>
                          <div className="mt-2 text-xs font-medium text-sky-700 dark:text-sky-300">{instruction.path}</div>
                        </td>
                        <td className="w-[340px] px-3 py-3">
                          <div><span className="text-xs text-muted-foreground">Договор:</span> <b>{record.contractNumber || 'не указан'}</b></div>
                          <div className="mt-1"><span className="text-xs text-muted-foreground">Контрагент:</span> {record.counterpartyName || 'не указан'}{record.counterpartyBin ? ` · БИН ${record.counterpartyBin}` : ''}</div>
                          <div className="mt-1"><span className="text-xs text-muted-foreground">Организация:</span> {record.organizationName || 'не указана'}{record.organizationBin ? ` · БИН ${record.organizationBin}` : ''}</div>
                          {record.reference && <div className="mt-1"><span className="text-xs text-muted-foreground">Назначение:</span> {record.reference}</div>}
                          {candidates.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium text-sky-700">Возможные проекты HUB: {candidates.length}</summary><ul className="mt-1 space-y-1 pl-4 text-muted-foreground">{candidates.map((candidate) => <li key={candidate}>{candidate}</li>)}</ul></details>}
                        </td>
                        <td className="w-[130px] whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(record.amount, record.currency)}</td>
                        <td className="min-w-[430px] px-3 py-3">
                          {scopeFilter === 'project' ? <>
                            <Badge variant="outline" className="whitespace-normal border-red-300 text-left text-red-900 dark:text-red-200">{ONEC_UNMATCHED_REASON_LABELS[record.matchReason] || record.matchReason}</Badge>
                            <div className="mt-2 font-medium text-red-950 dark:text-red-100">{instruction.reason}</div>
                            <div className="mt-1 text-sm leading-5 text-muted-foreground">{instruction.action}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void copyAccountantMessage(record)}><Copy className="mr-2 h-3.5 w-3.5" />{copiedRecordId === record.id ? 'Скопировано' : 'Скопировать бухгалтеру'}</Button>
                              <Button type="button" size="sm" variant="ghost" className="h-8" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'supplier')}>Это поставщик</Button>
                            </div>
                          </> : scopeFilter === 'review' ? <>
                            <div className="font-medium">Куда относится этот контрагент?</div>
                            <div className="mt-1 text-sm text-muted-foreground">Выбор применяется ко всем его записям и запоминается для следующих обменов.</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" size="sm" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'supplier')}>Поставщик / расход</Button>
                              <Button type="button" size="sm" variant="outline" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'project')}>Клиент / проект</Button>
                              <Button type="button" size="sm" variant="ghost" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'other')}>Прочее</Button>
                            </div>
                          </> : <>
                            <Badge variant="outline" className={scopeFilter === 'supplier' ? 'border-emerald-300 text-emerald-800 dark:text-emerald-200' : ''}>{ONE_C_ACCOUNTING_SCOPE_LABELS[scopeFilter]}</Badge>
                            <div className="mt-2 font-medium">К проекту привязывать не нужно</div>
                            <div className="mt-1 text-sm text-muted-foreground">Запись хранится в отдельном учёте и не увеличивает счётчик ошибок проектов.</div>
                            <Button type="button" size="sm" variant="ghost" className="mt-2 h-8" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'review')}>Изменить классификацию</Button>
                          </>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="max-h-[620px] space-y-3 overflow-auto p-3 md:hidden">
              {visible.map((record) => {
                const instruction = buildOneCAccountingFixInstruction(record);
                const candidates = candidateLabels(record);
                return (
                  <div key={record.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{ONE_C_INBOX_KIND_LABELS[record.kind]} № {record.documentNumber || 'б/н'}</div><div className="text-xs text-muted-foreground">{formatDate(record.documentDate)}</div></div><div className="whitespace-nowrap font-bold tabular-nums">{formatCompactMoney(record.amount, record.currency)}</div></div>
                    <div className="mt-3 rounded-lg bg-muted/50 p-2.5 text-sm"><div><span className="text-xs text-muted-foreground">Договор:</span> <b>{record.contractNumber || 'не указан'}</b></div><div className="mt-1"><span className="text-xs text-muted-foreground">Контрагент:</span> {record.counterpartyName || 'не указан'}{record.counterpartyBin ? ` · БИН ${record.counterpartyBin}` : ''}</div><div className="mt-1"><span className="text-xs text-muted-foreground">Организация:</span> {record.organizationName || 'не указана'}{record.organizationBin ? ` · БИН ${record.organizationBin}` : ''}</div>{record.reference && <div className="mt-1"><span className="text-xs text-muted-foreground">Назначение:</span> {record.reference}</div>}</div>
                    {scopeFilter === 'project' ? <>
                      <Badge variant="outline" className="mt-3 whitespace-normal border-red-300 text-left text-red-900 dark:text-red-200">{ONEC_UNMATCHED_REASON_LABELS[record.matchReason] || record.matchReason}</Badge>
                      <div className="mt-2 font-medium text-red-950 dark:text-red-100">{instruction.reason}</div>
                      <div className="mt-2 text-xs font-medium text-sky-700 dark:text-sky-300">{instruction.path}</div>
                      <div className="mt-1 text-sm leading-5 text-muted-foreground">{instruction.action}</div>
                      {candidates.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium text-sky-700">Показать возможные проекты HUB ({candidates.length})</summary><ul className="mt-1 space-y-1 pl-4 text-muted-foreground">{candidates.map((candidate) => <li key={candidate}>{candidate}</li>)}</ul></details>}
                      <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={() => void copyAccountantMessage(record)}><Copy className="mr-2 h-3.5 w-3.5" />{copiedRecordId === record.id ? 'Скопировано' : 'Скопировать бухгалтеру'}</Button>
                      <Button type="button" size="sm" variant="ghost" className="mt-2 w-full" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'supplier')}>Это поставщик / расход</Button>
                    </> : scopeFilter === 'review' ? <>
                      <div className="mt-3 font-medium">Куда относится этот контрагент?</div>
                      <div className="mt-1 text-sm text-muted-foreground">Выбор применится ко всем его записям и сохранится.</div>
                      <div className="mt-3 grid gap-2"><Button type="button" size="sm" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'supplier')}>Поставщик / расход</Button><Button type="button" size="sm" variant="outline" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'project')}>Клиент / проект</Button><Button type="button" size="sm" variant="ghost" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'other')}>Прочая операция</Button></div>
                    </> : <>
                      <Badge variant="outline" className={`mt-3 ${scopeFilter === 'supplier' ? 'border-emerald-300 text-emerald-800 dark:text-emerald-200' : ''}`}>{ONE_C_ACCOUNTING_SCOPE_LABELS[scopeFilter]}</Badge>
                      <div className="mt-2 font-medium">К проекту привязывать не нужно</div>
                      <div className="mt-1 text-sm text-muted-foreground">Запись хранится отдельно и не считается ошибкой проекта.</div>
                      <Button type="button" size="sm" variant="ghost" className="mt-2 w-full" disabled={classifyingRecordId === record.id} onClick={() => void classifyCounterparty(record, 'review')}>Изменить классификацию</Button>
                    </>}
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">По этому запросу записей нет.</div>}
            {filtered.length > visible.length && <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Показано {visible.length} из {filtered.length}</span><Button type="button" size="sm" variant="outline" onClick={() => setVisibleLimit((value) => Math.min(value + 100, filtered.length))}>Показать ещё {Math.min(100, filtered.length - visible.length)}</Button></div>}
          </>
        )}
        {summary.count === 0 && <div className="p-8 text-center text-sm text-muted-foreground">В разделе «{ONE_C_ACCOUNTING_SCOPE_LABELS[scopeFilter]}» пока нет записей.</div>}
      </CardContent>
    </Card>
  );
}

function clientName(project: any): string {
  const notes = projectNotes(project);
  const client = project.client || notes.client || {};
  return String(project.clientName || notes.clientName || client.name || project.name || 'Проект без названия').trim();
}

function leaderName(project: any): string {
  const team = effectiveProjectTeam(project);
  const leader = team.find((member: any) => (
    ['project_leader', 'manager_1', 'manager_2', 'manager_3'].includes(String(member?.role || ''))
  ));
  return String(leader?.userName || leader?.name || '—');
}

function storedFile(result: any, source: File): AccountingFile {
  const file = result?.file || {};
  return {
    ...file,
    id: file.id || result?.id,
    fileName: file.fileName || file.name || source.name,
    storagePath: file.storagePath || result?.storagePath,
    publicUrl: file.publicUrl || result?.publicUrl,
    url: file.url,
    isSeafile: Boolean(file.isSeafile || result?.storagePath),
    fileType: file.fileType || source.type,
    fileSize: Number(file.fileSize || source.size || 0),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ContactEditor({
  row,
  saving,
  onSave,
}: {
  row: AccountingRow;
  saving: boolean;
  onSave: (row: AccountingRow, contact: AccountingContact) => Promise<void>;
}) {
  const current = row.summary.ledger.contact || {};
  const [contact, setContact] = useState<AccountingContact>(current);
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Контакт заказчика</div>
          <div className="text-xs text-muted-foreground">Кому бухгалтерия отправляет счёт и АВР</div>
        </div>
        <Button size="sm" disabled={saving} onClick={() => onSave(row, contact)}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input value={contact.name || ''} onChange={(event) => setContact((value) => ({ ...value, name: event.target.value }))} placeholder="ФИО" />
        <Input value={contact.phone || ''} onChange={(event) => setContact((value) => ({ ...value, phone: event.target.value }))} placeholder="Телефон" />
        <Input type="email" value={contact.email || ''} onChange={(event) => setContact((value) => ({ ...value, email: event.target.value }))} placeholder="Электронная почта" />
      </div>
      <Textarea className="mt-3 min-h-20" value={contact.notes || ''} onChange={(event) => setContact((value) => ({ ...value, notes: event.target.value }))} placeholder="Примечание: способ отправки, особые требования заказчика…" />
    </div>
  );
}

export default function Accounting() {
  const { user, logout } = useAuth();
  const { projects, loading, error, updateProject } = useProjects();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountingProjectStatus>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<AccountingDeadlineFilter>('all');
  const [projectStateFilter, setProjectStateFilter] = useState<AccountingProjectStateFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<AccountingPaymentFilter>('all');
  const [documentFilter, setDocumentFilter] = useState<AccountingDocumentFilter>('all');
  const [contractFilter, setContractFilter] = useState<AccountingContractFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<AccountingSourceFilter>('all');
  const [quickFilter, setQuickFilter] = useState<AccountingQuickFilter>('all');
  const [sortMode, setSortMode] = useState<AccountingSort>('urgency');
  const [amountMinFilter, setAmountMinFilter] = useState('');
  const [amountMaxFilter, setAmountMaxFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [oneCDetailsOpen, setOneCDetailsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [entry, setEntry] = useState<{ kind: EntryKind; row: AccountingRow } | null>(null);
  const [amount, setAmount] = useState('');
  const [number, setNumber] = useState('');
  const [entryDate, setEntryDate] = useState(today());
  const [dueDate, setDueDate] = useState(dateAfter(14));
  const [paymentKind, setPaymentKind] = useState<AccountingPaymentKind>('advance');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [savingKey, setSavingKey] = useState('');
  const [oneCStatus, setOneCStatus] = useState<OneCSyncStatus | null>(null);
  const [oneCStatusReadError, setOneCStatusReadError] = useState('');
  const [oneCActionError, setOneCActionError] = useState('');
  const [oneCActionErrorCode, setOneCActionErrorCode] = useState('');
  const [oneCSyncing, setOneCSyncing] = useState(false);
  const [oneCIntegrationKey, setOneCIntegrationKey] = useState('');
  const [oneCInboxRecords, setOneCInboxRecords] = useState<OneCAccountingInboxRecord[]>([]);
  const [oneCInboxLoading, setOneCInboxLoading] = useState(true);
  const [oneCInboxRefreshing, setOneCInboxRefreshing] = useState(false);
  const [oneCInboxAvailable, setOneCInboxAvailable] = useState(false);
  const [oneCInboxError, setOneCInboxError] = useState('');
  const [oneCInboxTruncated, setOneCInboxTruncated] = useState(false);
  const oneCDataMountedRef = useRef(false);
  const oneCStatusRequestRef = useRef(0);
  const oneCInboxRequestRef = useRef(0);
  const currentOneCInboxRecords = useMemo(() => {
    const lastSuccessMs = Date.parse(String(oneCStatus?.lastSuccessAt || ''));
    if (!Number.isFinite(lastSuccessMs)) return oneCInboxRecords;
    const current = oneCInboxRecords.filter((record) => Date.parse(record.lastSeenAt) === lastSuccessMs);
    return current.length > 0 ? current : oneCInboxRecords;
  }, [oneCInboxRecords, oneCStatus?.lastSuccessAt]);
  const oneCInboxScopeCounts = useMemo(() => currentOneCInboxRecords.reduce<Record<OneCAccountingScope, number>>((result, record) => {
    result[record.accountingScope] += 1;
    return result;
  }, { project: 0, supplier: 0, other: 0, review: 0 }), [currentOneCInboxRecords]);
  const currentOneCReviewCount = oneCInboxScopeCounts.project + oneCInboxScopeCounts.review;

  const refreshOneCStatus = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const requestId = ++oneCStatusRequestRef.current;
    try {
      const status = await getOneCSyncStatus();
      if (!oneCDataMountedRef.current || requestId !== oneCStatusRequestRef.current) return;
      setOneCStatus(status);
      setOneCStatusReadError('');
      if (!status.lastError) {
        setOneCActionError('');
        setOneCActionErrorCode('');
      }
    } catch (statusError) {
      if (!oneCDataMountedRef.current || requestId !== oneCStatusRequestRef.current) return;
      setOneCStatusReadError(statusError instanceof Error ? statusError.message : 'Нет данных о синхронизации');
    }
  }, []);

  const refreshOneCInbox = useCallback(async (initial = false) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const requestId = ++oneCInboxRequestRef.current;
    if (initial) setOneCInboxLoading(true);
    else setOneCInboxRefreshing(true);
    try {
      const result = await loadOneCAccountingInbox();
      if (!oneCDataMountedRef.current || requestId !== oneCInboxRequestRef.current) return;
      setOneCInboxRecords(result.records);
      setOneCInboxAvailable(result.available);
      setOneCInboxTruncated(result.truncated);
      setOneCInboxError('');
    } catch (inboxError) {
      if (!oneCDataMountedRef.current || requestId !== oneCInboxRequestRef.current) return;
      setOneCInboxError(inboxError instanceof Error ? inboxError.message : 'Нет данных о несопоставленных записях');
    } finally {
      if (oneCDataMountedRef.current && requestId === oneCInboxRequestRef.current) {
        setOneCInboxLoading(false);
        setOneCInboxRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    oneCDataMountedRef.current = true;
    const refreshVisibleData = (initial = false) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshOneCStatus();
      void refreshOneCInbox(initial);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshVisibleData(false);
    };

    refreshVisibleData(true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => refreshVisibleData(false), 60_000);
    return () => {
      oneCDataMountedRef.current = false;
      oneCStatusRequestRef.current += 1;
      oneCInboxRequestRef.current += 1;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [refreshOneCInbox, refreshOneCStatus]);

  const handleOneCInboxRefresh = useCallback(() => {
    void refreshOneCStatus();
    void refreshOneCInbox(false);
  }, [refreshOneCInbox, refreshOneCStatus]);

  const latestOneCRun = oneCStatus?.latestRun || null;
  const completedLatestOneCRun = latestOneCRun?.status === 'success' && latestOneCRun.complete
    ? latestOneCRun
    : null;
  const oneCDisplayStats = completedLatestOneCRun || (oneCStatus?.lastSuccessAt ? {
    rawReceived: oneCStatus.rawReceived ?? oneCStatus.received,
    accepted: oneCStatus.accepted ?? oneCStatus.received,
    rejectedCount: oneCStatus.rejectedCount ?? 0,
    rejectedReasons: oneCStatus.rejectedReasons || {},
    matched: oneCStatus.matched,
    unmatchedCount: oneCStatus.unmatchedCount,
    unmatchedSummary: oneCStatus.unmatchedSummary,
    updatedProjects: oneCStatus.updatedProjects,
    complete: true,
    batchCount: 1,
    expectedBatchCount: 1,
    status: 'success' as const,
    completedAt: oneCStatus.lastSuccessAt,
  } : null);
  const oneCRunArithmeticValid = Boolean(oneCDisplayStats)
    && oneCDisplayStats!.rawReceived === oneCDisplayStats!.accepted + oneCDisplayStats!.rejectedCount
    && oneCDisplayStats!.accepted === oneCDisplayStats!.matched + oneCDisplayStats!.unmatchedCount;
  const lastOneCSuccessMs = Date.parse(String(oneCStatus?.lastSuccessAt || '')) || 0;
  const lastOneCErrorMs = Date.parse(String(oneCStatus?.lastErrorAt || '')) || 0;
  const latestSuccessfulRunMs = completedLatestOneCRun
    ? Date.parse(String(completedLatestOneCRun.completedAt || '')) || 0
    : 0;
  const latestRunErrorMs = latestOneCRun?.status === 'error'
    ? Date.parse(String(latestOneCRun.completedAt || latestOneCRun.startedAt || '')) || 0
    : 0;
  const activeStoredOneCError = Boolean(oneCStatus?.lastError)
    && (!lastOneCSuccessMs || !lastOneCErrorMs || lastOneCErrorMs > Math.max(lastOneCSuccessMs, latestSuccessfulRunMs));
  const activeLatestRunError = Boolean(latestRunErrorMs)
    && latestRunErrorMs > Math.max(lastOneCSuccessMs, latestSuccessfulRunMs);
  const activeOneCError = Boolean(oneCActionError) || activeStoredOneCError || activeLatestRunError;
  const oneCSessionExpired = isOneCSessionError(oneCStatusReadError) || isOneCSessionError(oneCInboxError);
  const oneCIntegrityWarning = Boolean(completedLatestOneCRun) && !oneCRunArithmeticValid;
  const oneCErrorAfterSuccessfulData = activeOneCError && Boolean(oneCStatus?.lastSuccessAt);
  const effectiveOneCErrorCode = oneCActionError
    ? oneCActionErrorCode || 'sync_failed'
    : oneCStatus?.lastErrorCode
      || (activeStoredOneCError && !oneCInboxLoading && !oneCInboxAvailable ? 'schema_not_ready' : '');
  const oneCStatusLabel = oneCSessionExpired
    ? 'Требуется повторный вход'
    : activeOneCError
    ? oneCErrorAfterSuccessfulData ? 'Последняя отправка не принята' : 'Требуется настройка'
    : oneCIntegrityWarning
      ? 'Проверить контрольные суммы'
    : latestOneCRun?.status === 'processing'
      ? 'Обмен выполняется'
      : oneCStatus?.lastSuccessAt
        ? 'Обмен работает'
        : oneCStatus?.configured ? 'Подключение настроено' : 'Ожидает подключения';
  const oneCSyncErrorTitle = effectiveOneCErrorCode === 'schema_not_ready'
    ? 'HUB ожидает обновления базы'
    : effectiveOneCErrorCode === 'sync_busy'
      ? 'Другой обмен уже выполняется'
      : effectiveOneCErrorCode === 'pull_not_configured'
        ? 'Получение данных из 1С не настроено'
        : oneCErrorAfterSuccessfulData
          ? 'Последняя отправка 1С не была принята HUB'
          : 'Обмен 1С пока не готов';
  const oneCSyncErrorGuidance = effectiveOneCErrorCode === 'schema_not_ready'
    ? 'Нужно применить обновление структуры базы HUB, затем повторить полный обмен.'
    : effectiveOneCErrorCode === 'sync_busy'
      ? 'Дождитесь завершения текущего обмена и обновите состояние кабинета.'
      : effectiveOneCErrorCode === 'pull_not_configured'
        ? 'Автоматическое получение выключено. Используйте отправку из 1С или настройте pull-обмен.'
        : 'Проверьте журнал обмена и повторите отправку. Частичный импорт не выполнялся.';
  const reopenAuthenticatedSession = () => {
    logout();
    window.location.assign('/login');
  };

  const runOneCSync = async () => {
    setOneCSyncing(true);
    try {
      const status = await pullOneCAccounting();
      setOneCStatus(status);
      setOneCActionError('');
      setOneCActionErrorCode('');
      toast({
        title: 'Данные из 1С обновлены',
        description: `Получено ${status.received}, связано с проектами ${status.matched}, без проекта ${status.unmatchedCount}. Поставщики учитываются отдельно.`,
      });
      await refreshOneCInbox(false);
    } catch (syncError: any) {
      const message = syncError?.message || 'Не удалось получить данные из 1С';
      let actionErrorCode = 'sync_failed';
      try {
        const refreshedStatus = await getOneCSyncStatus();
        setOneCStatus(refreshedStatus);
        setOneCStatusReadError('');
        actionErrorCode = refreshedStatus.lastErrorCode || actionErrorCode;
      } catch {
        // The action still has a safe generic classification when status refresh is unavailable.
      }
      setOneCActionError(message);
      setOneCActionErrorCode(actionErrorCode);
      toast({ title: 'Синхронизация 1С не выполнена', description: message, variant: 'destructive' });
    } finally {
      setOneCSyncing(false);
    }
  };

  const createIntegrationKey = async () => {
    setOneCSyncing(true);
    try {
      const result = await createOneCIntegrationKey();
      setOneCStatus(result.status);
      setOneCIntegrationKey(result.integrationKey);
      setOneCActionError('');
      setOneCActionErrorCode('');
      toast({ title: 'Ключ обмена 1С создан', description: 'Скопируйте его сейчас: повторно HUB этот ключ не показывает.' });
    } catch (keyError: any) {
      toast({ title: 'Не удалось создать ключ 1С', description: keyError?.message, variant: 'destructive' });
    } finally {
      setOneCSyncing(false);
    }
  };

  const rows = useMemo<AccountingRow[]>(() => projects.map(projectForAccountingWorkspace).map((project) => {
    const contract = projectContract(project);
    return {
      project,
      summary: calculateAccountingProject(project),
      clientName: clientName(project),
      companyName: projectCompanyName(project),
      contractNumber: String(contract?.number || '—'),
      contractDate: String(contract?.date || ''),
      deadline: String(contract?.serviceEndDate || project.deadline || ''),
      leaderName: leaderName(project),
      contractFileCount: projectContractFiles(project).length,
    };
  }), [projects]);

  const companies = useMemo(() => Array.from(new Set(rows.map((row) => row.companyName))).sort(), [rows]);
  const parsedAmountMin = parseFilterAmount(amountMinFilter);
  const parsedAmountMax = parseFilterAmount(amountMaxFilter);
  const amountMinInvalid = parsedAmountMin === undefined;
  const amountMaxInvalid = parsedAmountMax === undefined;
  const amountRangeInvalid = typeof parsedAmountMin === 'number'
    && typeof parsedAmountMax === 'number'
    && parsedAmountMin > parsedAmountMax;
  const amountFilterError = amountMinInvalid
    ? 'Укажите корректную минимальную сумму.'
    : amountMaxInvalid
      ? 'Укажите корректную максимальную сумму.'
      : amountRangeInvalid
        ? 'Минимальная сумма не может быть больше максимальной.'
        : '';
  const normalizedAmountMin: number | null = amountFilterError || parsedAmountMin === undefined ? null : parsedAmountMin;
  const normalizedAmountMax: number | null = amountFilterError || parsedAmountMax === undefined ? null : parsedAmountMax;
  const accountingFilters = useMemo(() => ({
    ...DEFAULT_ACCOUNTING_FILTERS,
    query: search,
    company: companyFilter,
    status: statusFilter,
    deadline: deadlineFilter,
    projectState: projectStateFilter,
    payment: paymentFilter,
    document: documentFilter,
    contract: contractFilter,
    source: sourceFilter,
    quick: quickFilter,
    amountMin: normalizedAmountMin,
    amountMax: normalizedAmountMax,
    sort: sortMode,
  }), [
    search,
    companyFilter,
    statusFilter,
    deadlineFilter,
    projectStateFilter,
    paymentFilter,
    documentFilter,
    contractFilter,
    sourceFilter,
    quickFilter,
    normalizedAmountMin,
    normalizedAmountMax,
    sortMode,
  ]);
  const filteredRows = useMemo(() => {
    return filterAndSortAccountingRows(rows, accountingFilters);
  }, [rows, accountingFilters]);
  const activeFilterCount = countActiveAccountingFilters(accountingFilters);
  const activeFilterLabels = useMemo(() => {
    const labels: Array<{ id: string; label: string }> = [];
    if (search.trim()) labels.push({ id: 'search', label: `Поиск: ${search.trim()}` });
    if (companyFilter !== 'all') labels.push({ id: 'company', label: companyFilter });
    if (statusFilter !== 'all') labels.push({ id: 'status', label: ACCOUNTING_STATUS_LABELS[statusFilter] });
    if (deadlineFilter !== 'all') labels.push({ id: 'deadline', label: DEADLINE_FILTER_LABELS[deadlineFilter] });
    if (projectStateFilter !== 'all') labels.push({ id: 'project', label: PROJECT_STATE_FILTER_LABELS[projectStateFilter] });
    if (paymentFilter !== 'all') labels.push({ id: 'payment', label: PAYMENT_FILTER_LABELS[paymentFilter] });
    if (documentFilter !== 'all') labels.push({ id: 'document', label: DOCUMENT_FILTER_LABELS[documentFilter] });
    if (contractFilter !== 'all') labels.push({ id: 'contract', label: CONTRACT_FILTER_LABELS[contractFilter] });
    if (sourceFilter !== 'all') labels.push({ id: 'source', label: SOURCE_FILTER_LABELS[sourceFilter] });
    if (quickFilter !== 'all') labels.push({ id: 'quick', label: QUICK_FILTERS.find((item) => item.value === quickFilter)?.label || quickFilter });
    if (accountingFilters.amountMin !== null) labels.push({ id: 'amount-min', label: `Сумма от ${accountingFilters.amountMin.toLocaleString('ru-RU')}` });
    if (accountingFilters.amountMax !== null) labels.push({ id: 'amount-max', label: `Сумма до ${accountingFilters.amountMax.toLocaleString('ru-RU')}` });
    if (sortMode !== 'urgency') labels.push({ id: 'sort', label: SORT_LABELS[sortMode] });
    return labels;
  }, [
    search,
    companyFilter,
    statusFilter,
    deadlineFilter,
    projectStateFilter,
    paymentFilter,
    documentFilter,
    contractFilter,
    sourceFilter,
    quickFilter,
    accountingFilters.amountMin,
    accountingFilters.amountMax,
    sortMode,
  ]);

  const resetFilters = () => {
    setSearch('');
    setCompanyFilter('all');
    setStatusFilter('all');
    setDeadlineFilter('all');
    setProjectStateFilter('all');
    setPaymentFilter('all');
    setDocumentFilter('all');
    setContractFilter('all');
    setSourceFilter('all');
    setQuickFilter('all');
    setSortMode('urgency');
    setAmountMinFilter('');
    setAmountMaxFilter('');
  };

  const deadlineCounts = useMemo(() => ({
    overdue: rows.filter((row) => row.summary.deadlineUrgency === 'overdue').length,
    today: rows.filter((row) => row.summary.deadlineUrgency === 'today').length,
    week: rows.filter((row) => row.summary.deadlineUrgency === 'week').length,
    month: rows.filter((row) => row.summary.deadlineUrgency === 'month').length,
    missing: rows.filter((row) => row.summary.deadlineUrgency === 'missing').length,
  }), [rows]);

  const totalsByCurrency = useMemo(() => {
    const result: Record<string, { contract: number; invoiced: number; paid: number; receivable: number; overdue: number }> = {};
    for (const row of filteredRows) {
      const currency = row.summary.currency;
      result[currency] ||= { contract: 0, invoiced: 0, paid: 0, receivable: 0, overdue: 0 };
      result[currency].contract += row.summary.contractAmount;
      result[currency].invoiced += row.summary.invoiceAmount;
      result[currency].paid += row.summary.paidAmount;
      result[currency].receivable += row.summary.receivableAmount;
      result[currency].overdue += row.summary.overdueAmount;
    }
    return result;
  }, [filteredRows]);

  const primaryCurrency = totalsByCurrency.KZT ? 'KZT' : Object.keys(totalsByCurrency)[0] || 'KZT';
  const primaryTotals = totalsByCurrency[primaryCurrency] || { contract: 0, invoiced: 0, paid: 0, receivable: 0, overdue: 0 };

  const openEntry = (row: AccountingRow, kind: EntryKind) => {
    const already = kind === 'invoice'
      ? row.summary.invoiceAmount
      : kind === 'avr'
        ? row.summary.avrAmount
        : kind === 'esf'
          ? row.summary.esfAmount
        : row.summary.paidAmount;
    setEntry({ row, kind });
    setAmount(String(Math.max(0, row.summary.contractAmount - already) || ''));
    setNumber('');
    setEntryDate(today());
    setDueDate(dateAfter(kind === 'avr' ? 7 : kind === 'esf' ? 5 : 14));
    setPaymentKind(row.summary.paidAmount > 0 ? 'interim' : 'advance');
    setReference('');
    setNotes('');
    setFile(null);
  };

  const saveEntry = async () => {
    if (!entry || !user) return;
    const parsedAmount = Number(String(amount).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Укажите сумму больше нуля', variant: 'destructive' });
      return;
    }
    if (!entryDate) {
      toast({ title: 'Укажите дату', variant: 'destructive' });
      return;
    }
    if (entry.kind !== 'payment' && !number.trim()) {
      toast({ title: `Укажите номер: ${documentTypeLabel(entry.kind)}`, variant: 'destructive' });
      return;
    }
    if (entry.kind !== 'payment' && !dueDate) {
      toast({
        title: 'Укажите контрольный срок',
        description: entry.kind === 'invoice'
          ? 'До какой даты ожидается оплата.'
          : entry.kind === 'avr'
            ? 'До какой даты нужно получить подписанный АВР.'
            : 'До какой даты ЭСФ должна быть зарегистрирована.',
        variant: 'destructive',
      });
      return;
    }

    const saveKey = `${entry.row.project.id}:${entry.kind}:new`;
    setSavingKey(saveKey);
    try {
      let uploadedFile: AccountingFile | undefined;
      if (file) {
        const result = await supabaseDataStore.uploadProjectFile(entry.row.project.id, file, 'document', user.id);
        uploadedFile = storedFile(result, file);
      }
      const now = new Date().toISOString();
      await updateProject(entry.row.project.id, (current: Project) => {
        const currentLedger = projectAccountingLedger(current);
        const nextLedger = entry.kind === 'payment'
          ? addAccountingPayment(currentLedger, {
              id: makeId('payment'),
              date: entryDate,
              amount: parsedAmount,
              kind: paymentKind,
              reference: reference.trim() || undefined,
              notes: notes.trim() || undefined,
              file: uploadedFile,
              createdAt: now,
              createdBy: user.name || user.id,
            }, user.name || user.id)
          : upsertAccountingDocument(currentLedger, {
              id: makeId(entry.kind),
              type: entry.kind,
              number: number.trim(),
              issueDate: entryDate,
              dueDate: dueDate || undefined,
              amount: parsedAmount,
              status: 'issued',
              notes: notes.trim() || undefined,
              file: uploadedFile,
              createdAt: now,
              createdBy: user.name || user.id,
            }, user.name || user.id);
        return { notes: { ...current.notes, accounting: nextLedger } };
      });
      toast({
        title: entry.kind === 'payment' ? 'Оплата учтена' : `${documentTypeLabel(entry.kind)} добавлен`,
        description: `${entry.row.clientName} · ${formatMoney(parsedAmount, entry.row.summary.currency)}`,
      });
      setEntry(null);
      setExpanded((value) => ({ ...value, [entry.row.project.id]: true }));
    } catch (saveError: any) {
      toast({ title: 'Не удалось сохранить', description: saveError?.message || 'Повторите попытку', variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const updateDocumentStatus = async (row: AccountingRow, document: AccountingDocument, status: AccountingDocumentStatus) => {
    if (!user) return;
    if (document.source === '1c') {
      toast({ title: 'Документ ведётся в 1С', description: 'Измените статус в 1С — HUB получит его при следующей синхронизации.' });
      return;
    }
    const key = `${row.project.id}:${document.id}:${status}`;
    setSavingKey(key);
    try {
      const now = new Date().toISOString();
      await updateProject(row.project.id, (current: Project) => {
        const ledger = projectAccountingLedger(current);
        const next = upsertAccountingDocument(ledger, {
          ...document,
          status,
          sentAt: status === 'sent' ? now : document.sentAt,
          signedAt: status === 'signed' ? now : document.signedAt,
          updatedAt: now,
          updatedBy: user.name || user.id,
        }, user.name || user.id);
        return { notes: { ...current.notes, accounting: next } };
      });
      toast({ title: `Статус изменён: ${ACCOUNTING_DOCUMENT_STATUS_LABELS[status]}` });
    } catch (statusError: any) {
      toast({ title: 'Не удалось изменить статус', description: statusError?.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const removeRecord = async (row: AccountingRow, kind: 'document' | 'payment', id: string) => {
    const sourceRecord = kind === 'document'
      ? row.summary.ledger.documents.find((item) => item.id === id)
      : row.summary.ledger.payments.find((item) => item.id === id);
    if (sourceRecord?.source === '1c') {
      toast({ title: 'Запись ведётся в 1С', description: 'Удалите или отмените её в 1С — HUB обновится автоматически.' });
      return;
    }
    if (!user || !window.confirm('Удалить ошибочную запись из бухгалтерского реестра?')) return;
    const key = `${row.project.id}:${id}:delete`;
    setSavingKey(key);
    try {
      await updateProject(row.project.id, (current: Project) => {
        const ledger = projectAccountingLedger(current);
        const next = {
          ...ledger,
          documents: kind === 'document' ? ledger.documents.filter((item) => item.id !== id) : ledger.documents,
          payments: kind === 'payment' ? ledger.payments.filter((item) => item.id !== id) : ledger.payments,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name || user.id,
        };
        return { notes: { ...current.notes, accounting: next } };
      });
      toast({ title: 'Запись удалена' });
    } finally {
      setSavingKey('');
    }
  };

  const saveContact = async (row: AccountingRow, contact: AccountingContact) => {
    if (!user) return;
    const key = `${row.project.id}:contact`;
    setSavingKey(key);
    try {
      await updateProject(row.project.id, (current: Project) => ({
        notes: {
          ...current.notes,
          accounting: updateAccountingContact(projectAccountingLedger(current), contact, user.name || user.id),
        },
      }));
      toast({ title: 'Контакт заказчика сохранён' });
    } catch (contactError: any) {
      toast({ title: 'Не удалось сохранить контакт', description: contactError?.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const openFile = async (fileValue?: AccountingFile) => {
    if (!fileValue) return;
    const preview = window.open('about:blank', '_blank');
    try {
      const direct = fileValue.publicUrl || fileValue.url || '';
      const url = fileValue.isSeafile && fileValue.storagePath
        ? await supabaseDataStore.getSeafileDownloadUrl(fileValue.storagePath)
        : direct;
      if (!url) throw new Error('У файла нет рабочей ссылки');
      if (preview) preview.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (fileError: any) {
      preview?.close();
      toast({ title: 'Не удалось открыть файл', description: fileError?.message, variant: 'destructive' });
    }
  };

  const sendDocumentEmail = async (row: AccountingRow, document: AccountingDocument) => {
    const recipient = row.summary.ledger.contact?.email?.trim();
    if (!recipient) {
      toast({ title: 'Сначала укажите email заказчика', description: 'Раскройте проект и сохраните контакт заказчика.', variant: 'destructive' });
      return;
    }
    if (!document.file) {
      toast({ title: 'Сначала прикрепите файл документа', variant: 'destructive' });
      return;
    }
    const typeLabel = documentTypeLabel(document.type);
    const documentDescription = document.type === 'invoice'
      ? 'счёт на оплату'
      : document.type === 'avr'
        ? 'акт выполненных работ'
        : 'электронный счёт-фактуру';
    if (!window.confirm(`Отправить ${typeLabel.toLowerCase()} № ${document.number} на ${recipient}?`)) return;
    const key = `${row.project.id}:${document.id}:email`;
    setSavingKey(key);
    try {
      const direct = document.file.publicUrl || document.file.url || '';
      const fileUrl = document.file.isSeafile && document.file.storagePath
        ? await supabaseDataStore.getSeafileDownloadUrl(document.file.storagePath)
        : direct;
      if (!fileUrl) throw new Error('Не удалось получить ссылку на файл');
      const safeClient = escapeHtml(row.clientName);
      const safeNumber = escapeHtml(document.number);
      const safeUrl = escapeHtml(fileUrl);
      const result = await sendEmail(recipient, {
        subject: `${typeLabel} № ${document.number} — ${row.companyName}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><p>Здравствуйте.</p><p>Направляем ${documentDescription} <strong>№ ${safeNumber}</strong> по проекту «${safeClient}» на сумму <strong>${escapeHtml(formatMoney(document.amount, row.summary.currency))}</strong>.</p><p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#0284c7;color:#fff;text-decoration:none;border-radius:8px">Скачать документ</a></p><p>С уважением,<br>${escapeHtml(row.companyName)}<br>HUB</p></div>`,
        text: `Здравствуйте.\n\nНаправляем ${documentDescription} № ${document.number} по проекту «${row.clientName}» на сумму ${formatMoney(document.amount, row.summary.currency)}.\n\nСкачать документ: ${fileUrl}\n\n${row.companyName}\nHUB`,
      });
      if (!result.success) throw new Error(result.message || 'Почтовый сервер не подтвердил отправку');
      await updateDocumentStatus(row, document, 'sent');
      toast({ title: `${typeLabel} отправлен`, description: recipient });
    } catch (sendError: any) {
      toast({ title: 'Не удалось отправить email', description: sendError?.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const exportExcel = () => {
    const exportRows = filteredRows.map((row, index) => ({
      '№': index + 1,
      'Наша компания': row.companyName,
      'Заказчик / проект': row.clientName,
      'Договор №': row.contractNumber === '—' ? '' : row.contractNumber,
      'Дата договора': row.contractDate,
      'Срок проекта': row.deadline,
      'Следующее действие': row.summary.nextActionLabel,
      'Контрольный срок': row.summary.nextActionDeadline,
      'Осталось дней': row.summary.daysUntilNextAction ?? '',
      'Контроль срока': deadlineText(row.summary.deadlineUrgency, row.summary.daysUntilNextAction),
      'Статус проекта': row.summary.projectClosed ? 'Закрыт' : 'В работе',
      'Статус бухгалтерии': ACCOUNTING_STATUS_LABELS[row.summary.accountingStatus],
      'Валюта': row.summary.currency,
      'Стоимость проекта': row.summary.contractAmount,
      'Счета №': row.summary.invoices.map((item) => item.number).filter(Boolean).join(', '),
      'Выставлено': row.summary.invoiceAmount,
      'Оплачено по факту': row.summary.paidAmount,
      'Дебиторская задолженность': row.summary.receivableAmount,
      'Остаток по договору': row.summary.contractBalanceAmount,
      'АВР №': row.summary.avrs.map((item) => item.number).filter(Boolean).join(', '),
      'Сумма АВР': row.summary.avrAmount,
      'ЭСФ №': row.summary.esfs.map((item) => item.number).filter(Boolean).join(', '),
      'Сумма ЭСФ': row.summary.esfAmount,
      'Источник учёта': row.summary.ledger.sync?.source === '1c' ? `1С · ${row.summary.ledger.sync.sourceDatabase || ''}`.trim() : 'HUB',
      'Последняя синхронизация 1С': row.summary.ledger.sync?.lastSyncedAt || '',
      'Статус': ACCOUNTING_STATUS_LABELS[row.summary.status],
      'Руководитель проекта': row.leaderName === '—' ? '' : row.leaderName,
      'Контакт заказчика': row.summary.ledger.contact?.name || '',
      'Телефон': row.summary.ledger.contact?.phone || '',
      'Email': row.summary.ledger.contact?.email || '',
      'Примечание': row.summary.ledger.contact?.notes || '',
    }));
    const workbook = XLSX.utils.book_new();
    const appendSheet = (name: string, data: typeof exportRows) => {
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet['!cols'] = [5, 24, 38, 20, 14, 14, 28, 16, 14, 22, 10, 18, 24, 18, 18, 22, 20, 22, 18, 24, 24, 24, 18, 28, 34]
        .map((width) => ({ wch: width }));
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    };
    appendSheet('Общий реестр', exportRows);
    for (const company of companies) {
      const data = exportRows.filter((item) => item['Наша компания'] === company);
      if (data.length > 0) appendSheet(company.replace(/[\\/?*:]/g, ' ').split('[').join(' ').split(']').join(' ').slice(0, 31) || 'Компания', data);
    }
    XLSX.writeFile(workbook, `HUB_Бухгалтерия_${today()}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-muted-foreground">Загружаю бухгалтерский реестр…</p></div>
      </div>
    );
  }

  if (error) {
    return <Card className="border-destructive/40"><CardContent className="flex gap-3 p-6"><AlertCircle className="h-5 w-5 text-destructive" /><div><b>Не удалось загрузить проекты</b><p className="text-sm text-muted-foreground">{error}</p></div></CardContent></Card>;
  }

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ReceiptText className="h-4 w-4" /> Финансовые документы и оплаты</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Бухгалтерский кабинет</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Один проект — одна строка. Статус связан со сводом; долги, счета и неподписанные АВР остаются под контролем даже после закрытия проекта.</p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={filteredRows.length === 0}><Download className="mr-2 h-4 w-4" />Скачать Excel</Button>
      </div>

      <Card data-testid="accounting-filters" className="overflow-hidden border-primary/20 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Поиск по бухгалтерскому реестру"
                className="h-11 pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Заказчик, договор, руководитель или контакт…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={activeFilterCount > 0 ? 'default' : 'outline'}
                className="h-11 flex-1 sm:flex-none lg:hidden"
                aria-expanded={filtersOpen}
                aria-controls="accounting-advanced-filters"
                data-testid="accounting-filter-toggle"
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Фильтры{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
              </Button>
              <div data-testid="accounting-result-count" aria-live="polite" className="whitespace-nowrap rounded-lg bg-muted px-3 py-2 text-sm font-medium tabular-nums">
                {filteredRows.length} из {rows.length}
              </div>
            </div>
          </div>

          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Быстрые фильтры">
            {QUICK_FILTERS.map((item) => {
              const selected = quickFilter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-label={`Быстрый фильтр: ${item.label}`}
                  aria-pressed={selected}
                  onClick={() => setQuickFilter(selected ? 'all' : item.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/50 hover:bg-muted'}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div id="accounting-advanced-filters" className={`${filtersOpen ? 'grid' : 'hidden'} mt-4 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid xl:grid-cols-4`}>
            <div className="grid gap-1.5"><Label>Наша компания</Label><Select value={companyFilter} onValueChange={setCompanyFilter}><SelectTrigger aria-label="Наша компания"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все наши компании</SelectItem>{companies.map((company) => <SelectItem key={company} value={company}>{company}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Что нужно сделать</Label><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}><SelectTrigger aria-label="Что нужно сделать"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все состояния</SelectItem>{Object.entries(ACCOUNTING_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Срок следующего действия</Label><Select value={deadlineFilter} onValueChange={(value) => setDeadlineFilter(value as AccountingDeadlineFilter)}><SelectTrigger aria-label="Срок следующего действия"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DEADLINE_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Состояние проекта</Label><Select value={projectStateFilter} onValueChange={(value) => setProjectStateFilter(value as AccountingProjectStateFilter)}><SelectTrigger aria-label="Состояние проекта"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PROJECT_STATE_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Оплата и задолженность</Label><Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as AccountingPaymentFilter)}><SelectTrigger aria-label="Оплата и задолженность"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAYMENT_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Документы</Label><Select value={documentFilter} onValueChange={(value) => setDocumentFilter(value as AccountingDocumentFilter)}><SelectTrigger aria-label="Документы"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DOCUMENT_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Договор</Label><Select value={contractFilter} onValueChange={(value) => setContractFilter(value as AccountingContractFilter)}><SelectTrigger aria-label="Договор"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CONTRACT_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Источник данных</Label><Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as AccountingSourceFilter)}><SelectTrigger aria-label="Источник данных"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SOURCE_FILTER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label htmlFor="accounting-amount-min">Сумма договора от</Label><Input id="accounting-amount-min" inputMode="decimal" aria-invalid={amountMinInvalid || amountRangeInvalid} aria-describedby={amountFilterError ? 'accounting-amount-error' : undefined} value={amountMinFilter} onChange={(event) => setAmountMinFilter(event.target.value)} placeholder="0 ₸" /></div>
            <div className="grid gap-1.5"><Label htmlFor="accounting-amount-max">Сумма договора до</Label><Input id="accounting-amount-max" inputMode="decimal" aria-invalid={amountMaxInvalid || amountRangeInvalid} aria-describedby={amountFilterError ? 'accounting-amount-error' : undefined} value={amountMaxFilter} onChange={(event) => setAmountMaxFilter(event.target.value)} placeholder="Без ограничения" /></div>
            <div className="grid gap-1.5 sm:col-span-2"><Label>Сортировка</Label><Select value={sortMode} onValueChange={(value) => setSortMode(value as AccountingSort)}><SelectTrigger aria-label="Сортировка"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SORT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            {amountFilterError && <div id="accounting-amount-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 sm:col-span-2 xl:col-span-4">{amountFilterError} Фильтр по сумме применится после исправления.</div>}
          </div>

          {(activeFilterLabels.length > 0 || Boolean(amountFilterError)) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">{activeFilterLabels.length > 0 ? 'Выбрано:' : 'Фильтр суммы не применён'}</span>
              {activeFilterLabels.map((item) => <Badge key={item.id} variant="secondary" className="max-w-full truncate">{item.label}</Badge>)}
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={resetFilters}><X className="mr-1 h-3.5 w-3.5" />Сбросить всё</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="onec-health" className={oneCSessionExpired ? 'border-red-300 dark:border-red-900' : activeOneCError ? oneCErrorAfterSuccessfulData ? 'border-amber-300 dark:border-amber-900' : 'border-red-300 dark:border-red-900' : oneCIntegrityWarning ? 'border-amber-300 dark:border-amber-900' : latestOneCRun?.status === 'processing' ? 'border-sky-300 dark:border-sky-900' : 'border-emerald-200 dark:border-emerald-900'}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Database className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">Обмен с 1С</div>
                  <Badge variant="outline" className={oneCSessionExpired ? 'border-red-300 text-red-700 dark:text-red-300' : activeOneCError || oneCIntegrityWarning ? 'border-amber-300 text-amber-800 dark:text-amber-200' : latestOneCRun?.status === 'processing' ? 'border-sky-300 text-sky-800 dark:text-sky-200' : oneCStatus?.configured ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'}>
                    {oneCStatusLabel}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {oneCStatus?.lastSuccessAt
                    ? `Последнее успешное обновление: ${formatDateTime(oneCStatus.lastSuccessAt)} · база ${oneCStatus.source || '1С'}`
                    : 'После подключения оплаты, счета, АВР и ЭСФ будут обновляться здесь автоматически.'}
                </div>
                {activeOneCError && (
                  <div role="alert" className={`mt-2 rounded-lg border p-2.5 text-sm ${oneCErrorAfterSuccessfulData ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'}`}>
                    <div className="font-semibold">{oneCSyncErrorTitle}</div>
                    <div className="mt-1">
                      {oneCErrorAfterSuccessfulData
                        ? `Данные успешного обмена от ${formatDateTime(oneCStatus?.lastSuccessAt)} сохранены и не повреждены.`
                        : 'Финансовые данные не изменялись частично.'}
                    </div>
                    <div className="mt-1">{oneCSyncErrorGuidance}</div>
                    {oneCStatus?.lastErrorAt && <div className="mt-1 text-xs opacity-80">Неудачная попытка: {formatDateTime(oneCStatus.lastErrorAt)}.</div>}
                  </div>
                )}
                {oneCIntegrityWarning && !activeOneCError && <div role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="font-semibold">Контрольные суммы последнего обмена не сошлись</div><div className="mt-1">Данные сохранены, но бухгалтеру или администратору нужно открыть подробности 1С и проверить пакеты.</div></div>}
                {oneCStatusReadError && (
                  <div role="status" className={`mt-2 rounded-lg border p-2.5 text-sm ${oneCSessionExpired ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200'}`}>
                    <div className="font-semibold">{oneCSessionExpired ? 'Сессия HUB устарела — это не ошибка ключа 1С' : 'Не удалось обновить текущее состояние кабинета'}</div>
                    <div className="mt-1">{oneCSessionExpired ? 'Кабинет не может прочитать свежий результат обмена. Войдите в HUB повторно; после входа откроются фактическое состояние и подробный реестр.' : `Показаны последние сохранённые данные${oneCStatus?.lastSuccessAt ? ` от ${formatDateTime(oneCStatus.lastSuccessAt)}` : ''}. Обновите страницу через минуту.`}</div>
                    {oneCSessionExpired && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={reopenAuthenticatedSession}>Выйти и войти снова</Button>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {oneCDisplayStats && <Badge variant="secondary">Сопоставлено: {oneCDisplayStats.matched}</Badge>}
              {currentOneCReviewCount > 0 && <Badge variant="destructive">Разобрать: {currentOneCReviewCount}</Badge>}
              {user?.role === 'admin' && oneCStatus && !oneCStatus.pushEnabled && <Button variant="outline" onClick={createIntegrationKey} disabled={oneCSyncing}>Создать ключ 1С</Button>}
              {oneCStatus?.pullEnabled ? (
                <Button onClick={runOneCSync} disabled={oneCSyncing}>
                  {oneCSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Синхронизировать 1С
                </Button>
              ) : (
                <Button variant="outline" disabled><RefreshCw className="mr-2 h-4 w-4" />Автообмен из 1С</Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setOneCDetailsOpen((value) => !value)} aria-expanded={oneCDetailsOpen}>
                {oneCDetailsOpen ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                {oneCDetailsOpen ? 'Скрыть подробности' : 'Подробности 1С'}
              </Button>
            </div>
          </div>
          {oneCDetailsOpen && <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {oneCDisplayStats && <Badge variant="secondary">Подготовлено 1С: {oneCDisplayStats.rawReceived}</Badge>}
            {oneCDisplayStats && <Badge variant="secondary">Принято HUB: {oneCDisplayStats.accepted}</Badge>}
            {Boolean(oneCDisplayStats?.rejectedCount) && <Badge variant="outline" className="border-amber-300 text-amber-700">Отклонено: {oneCDisplayStats?.rejectedCount}</Badge>}
          </div>}
          {oneCDetailsOpen && latestOneCRun && (
            <div className={`mt-4 rounded-xl border p-3 ${latestOneCRun.complete && oneCRunArithmeticValid && latestOneCRun.status === 'success' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">Контроль полного запуска 1С</div>
                <Badge variant="outline">Пакеты: {latestOneCRun.batchCount} из {latestOneCRun.expectedBatchCount}</Badge>
              </div>
              <div className="mt-2 text-sm tabular-nums">
                {latestOneCRun.rawReceived} подготовлено = {latestOneCRun.accepted} принято + {latestOneCRun.rejectedCount} отклонено; {latestOneCRun.accepted} принято = {latestOneCRun.matched} связано с проектами + {latestOneCRun.unmatchedCount} без проекта, включая поставщиков и прочие операции.
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {latestOneCRun.complete && oneCRunArithmeticValid && latestOneCRun.status === 'success'
                  ? 'Все пакеты получены, контрольные суммы сходятся.'
                  : 'Запуск неполный или контрольные суммы не сошлись — автоматический обмен требует проверки.'}
              </div>
              {Object.keys(latestOneCRun.rejectedReasons || {}).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(latestOneCRun.rejectedReasons).map(([reason, count]) => (
                    <Badge key={reason} variant="outline" className="border-amber-300 bg-background text-amber-900 dark:text-amber-200">
                      {ONEC_REJECTED_REASON_LABELS[reason] || reason}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          {oneCDetailsOpen && (
            <div className="mt-4">
              <OneCInboxCard
                records={currentOneCInboxRecords}
                projects={projects}
                loading={oneCInboxLoading}
                refreshing={oneCInboxRefreshing}
                available={oneCInboxAvailable}
                error={oneCInboxError}
                truncated={oneCInboxTruncated}
                expectedUnmatchedCount={oneCDisplayStats ? Number(oneCDisplayStats.unmatchedCount || 0) : null}
                onRefresh={handleOneCInboxRefresh}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: 'Договоры', value: primaryTotals.contract, icon: FileText, color: 'text-slate-600' },
          { label: 'Выставлено', value: primaryTotals.invoiced, icon: ReceiptText, color: 'text-blue-600' },
          { label: 'Оплачено по факту', value: primaryTotals.paid, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'К получению', value: primaryTotals.receivable, icon: WalletCards, color: 'text-amber-600' },
          { label: 'Просрочено', value: primaryTotals.overdue, icon: AlertCircle, color: 'text-red-600' },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-2 p-3 md:gap-3 md:p-4">
              <div className="rounded-xl bg-muted p-2 md:p-2.5"><item.icon className={`h-5 w-5 ${item.color}`} /></div>
              <div className="min-w-0"><div className="text-[11px] text-muted-foreground md:text-xs">{item.label}</div><div className="whitespace-nowrap text-base font-bold tabular-nums md:text-lg" title={formatMoney(item.value, primaryCurrency)}>{formatCompactMoney(item.value, primaryCurrency)}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>
      {Object.keys(totalsByCurrency).length > 1 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Другие валюты:</span>
          {Object.entries(totalsByCurrency).filter(([currency]) => currency !== primaryCurrency).map(([currency, value]) => (
            <Badge key={currency} variant="outline">{currency}: оплачено {formatMoney(value.paid, currency)}, долг {formatMoney(value.receivable, currency)}</Badge>
          ))}
        </div>
      )}

      <Card className="border-amber-200/80 dark:border-amber-900/70">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-600" /><div><div className="font-semibold">Контроль бухгалтерских сроков</div><div className="text-xs text-muted-foreground">Просроченные задачи всегда показываются первыми.</div></div></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              { filter: 'overdue' as const, label: 'Просрочено', value: deadlineCounts.overdue, color: 'text-red-600' },
              { filter: 'today' as const, label: 'Сегодня', value: deadlineCounts.today, color: 'text-red-600' },
              { filter: 'week' as const, label: 'До 7 дней', value: deadlineCounts.week, color: 'text-orange-600' },
              { filter: 'month' as const, label: 'До 30 дней', value: deadlineCounts.month, color: 'text-amber-600' },
              { filter: 'missing' as const, label: 'Без срока', value: deadlineCounts.missing, color: 'text-violet-600' },
            ].map((item) => <button key={item.label} type="button" onClick={() => setDeadlineFilter(item.filter)} className={`rounded-lg border p-3 text-left transition hover:bg-muted ${deadlineFilter === item.filter ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'bg-background'}`}><div className="text-xs text-muted-foreground">{item.label}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</div></button>)}
          </div>
        </CardContent>
      </Card>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div>
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="w-10 px-2 py-3"></th><th className="w-[23%] px-2 py-3">Проект, компания и договор</th><th className="w-[10%] px-2 py-3 text-right">Стоимость</th><th className="w-[10%] px-2 py-3 text-right">Выставлено</th><th className="w-[10%] px-2 py-3 text-right">Оплачено</th><th className="w-[11%] px-2 py-3 text-right">Долг</th><th className="w-[22%] px-2 py-3">Что сделать и до какого срока</th><th className="w-[14%] px-2 py-3 text-right">Действия</th></tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((row) => {
                const isExpanded = Boolean(expanded[row.project.id]);
                return [
                  <tr key={row.project.id} className="align-top hover:bg-muted/30">
                    <td className="px-2 py-4"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((value) => ({ ...value, [row.project.id]: !isExpanded }))}>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></td>
                    <td className="px-2 py-4"><div className="font-semibold leading-snug">{row.clientName}</div><div className="mt-1 line-clamp-2 text-xs text-primary">{row.companyName}</div><div className="mt-1 text-xs text-muted-foreground">№ {row.contractNumber} {row.contractDate && `от ${formatDate(row.contractDate)}`}</div><div className="mt-1 text-xs text-muted-foreground">Руководитель: {row.leaderName}</div></td>
                    <td className="px-2 py-4 text-right font-medium tabular-nums" title={formatMoney(row.summary.contractAmount, row.summary.currency)}>{formatCompactMoney(row.summary.contractAmount, row.summary.currency)}</td>
                    <td className="px-2 py-4 text-right"><div className="font-medium tabular-nums" title={formatMoney(row.summary.invoiceAmount, row.summary.currency)}>{formatCompactMoney(row.summary.invoiceAmount, row.summary.currency)}</div><div className="text-xs text-muted-foreground">{row.summary.invoices.length} сч.</div></td>
                    <td className="px-2 py-4 text-right"><div className="font-semibold tabular-nums text-emerald-600" title={formatMoney(row.summary.paidAmount, row.summary.currency)}>{formatCompactMoney(row.summary.paidAmount, row.summary.currency)}</div><div className="text-xs text-muted-foreground">{row.summary.payments.length} плат.</div></td>
                    <td className="px-2 py-4 text-right"><div className={`font-bold tabular-nums ${row.summary.receivableAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`} title={formatMoney(row.summary.receivableAmount, row.summary.currency)}>{formatCompactMoney(row.summary.receivableAmount, row.summary.currency)}</div><div className="mt-1 text-[11px] text-muted-foreground" title={formatMoney(row.summary.contractBalanceAmount, row.summary.currency)}>договор: {formatCompactMoney(row.summary.contractBalanceAmount, row.summary.currency)}</div></td>
                    <td className="px-2 py-4"><div className="font-semibold leading-tight">{row.summary.nextActionLabel}</div><div className="mt-2"><DeadlineBadge urgency={row.summary.deadlineUrgency} days={row.summary.daysUntilNextAction} /></div>{row.summary.nextActionDeadline && <div className="mt-1 text-xs font-medium">до {formatDate(row.summary.nextActionDeadline)}</div>}<Badge variant="outline" className={`mt-2 whitespace-normal text-left text-[11px] leading-tight ${STATUS_COLORS[row.summary.status]}`}>{ACCOUNTING_STATUS_LABELS[row.summary.status]}</Badge>{row.deadline && <div className="mt-2 text-[11px] text-muted-foreground">Срок проекта: {formatDate(row.deadline)}</div>}</td>
                    <td className="px-2 py-4"><div className="ml-auto grid max-w-[128px] gap-1"><Button size="sm" variant="outline" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'invoice')}><ReceiptText className="mr-1 h-3.5 w-3.5" />Счёт</Button><Button size="sm" variant="outline" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'avr')}><Send className="mr-1 h-3.5 w-3.5" />АВР</Button><Button size="sm" variant="outline" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'esf')}><FileCheck2 className="mr-1 h-3.5 w-3.5" />ЭСФ</Button><Button size="sm" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'payment')}><Banknote className="mr-1 h-3.5 w-3.5" />Оплата</Button></div></td>
                  </tr>,
                  isExpanded && <tr key={`${row.project.id}:details`}><td colSpan={8} className="bg-muted/20 p-4"><AccountingDetails row={row} savingKey={savingKey} onStatus={updateDocumentStatus} onSendEmail={sendDocumentEmail} onRemove={removeRecord} onOpenFile={openFile} onSaveContact={saveContact} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredRows.map((row) => {
          const isExpanded = Boolean(expanded[row.project.id]);
          return <Card key={row.project.id}><CardContent className="p-4"><button type="button" className="w-full text-left" onClick={() => setExpanded((value) => ({ ...value, [row.project.id]: !isExpanded }))}><div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{row.clientName}</div><div className="mt-1 text-xs text-muted-foreground">{row.companyName} · № {row.contractNumber}</div></div>{isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</div><div className="mt-3 rounded-lg border bg-muted/30 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Следующее действие</div><div className="mt-1 font-semibold">{row.summary.nextActionLabel}</div><div className="mt-2 flex flex-wrap items-center gap-2"><DeadlineBadge urgency={row.summary.deadlineUrgency} days={row.summary.daysUntilNextAction} />{row.summary.nextActionDeadline && <span className="text-sm font-medium">до {formatDate(row.summary.nextActionDeadline)}</span>}</div>{row.deadline && <div className="mt-2 text-xs text-muted-foreground">Срок проекта: {formatDate(row.deadline)}</div>}</div><Badge variant="outline" className={`mt-3 ${STATUS_COLORS[row.summary.status]}`}>{ACCOUNTING_STATUS_LABELS[row.summary.status]}</Badge><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Стоимость</div><b>{formatMoney(row.summary.contractAmount, row.summary.currency)}</b></div><div><div className="text-xs text-muted-foreground">Выставлено</div><b>{formatMoney(row.summary.invoiceAmount, row.summary.currency)}</b></div><div><div className="text-xs text-muted-foreground">Оплачено</div><b className="text-emerald-600">{formatMoney(row.summary.paidAmount, row.summary.currency)}</b></div><div><div className="text-xs text-muted-foreground">Задолженность</div><b className={row.summary.receivableAmount ? 'text-red-600' : 'text-emerald-600'}>{formatMoney(row.summary.receivableAmount, row.summary.currency)}</b></div></div></button><div className="mt-4 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => openEntry(row, 'invoice')}>Счёт</Button><Button size="sm" variant="outline" onClick={() => openEntry(row, 'avr')}>АВР</Button><Button size="sm" variant="outline" onClick={() => openEntry(row, 'esf')}>ЭСФ</Button><Button size="sm" onClick={() => openEntry(row, 'payment')}>Оплата</Button></div>{isExpanded && <div className="mt-4 border-t pt-4"><AccountingDetails row={row} savingKey={savingKey} onStatus={updateDocumentStatus} onSendEmail={sendDocumentEmail} onRemove={removeRecord} onOpenFile={openFile} onSaveContact={saveContact} /></div>}</CardContent></Card>;
        })}
      </div>

      {filteredRows.length === 0 && <Card><CardContent className="py-16 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><div className="mt-3 font-semibold">Ничего не найдено</div><p className="text-sm text-muted-foreground">Измените поиск или фильтры.</p></CardContent></Card>}

      <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && setEntry(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{entry?.kind === 'payment' ? 'Добавить фактическую оплату' : entry ? `Добавить ${documentTypeLabel(entry.kind)}` : 'Добавить документ'}</DialogTitle><DialogDescription>{entry?.row.clientName} · {entry && formatMoney(entry.row.summary.contractAmount, entry.row.summary.currency)}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            {entry?.kind !== 'payment' && <div className="grid gap-2"><Label htmlFor="entry-number">Номер: {entry ? documentTypeLabel(entry.kind) : 'документ'}</Label><Input id="entry-number" value={number} onChange={(event) => setNumber(event.target.value)} placeholder={entry?.kind === 'invoice' ? 'СЧ-123' : entry?.kind === 'avr' ? 'АВР-123' : 'ЭСФ-123'} /></div>}
            <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="entry-date">Дата</Label><Input id="entry-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="entry-amount">Сумма</Label><Input id="entry-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div></div>
            {entry?.kind !== 'payment' && <div className="grid gap-2"><Label htmlFor="due-date">{entry?.kind === 'invoice' ? 'Оплатить до' : entry?.kind === 'avr' ? 'Получить подписанный АВР до' : 'Зарегистрировать ЭСФ до'}</Label><Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>}
            {entry?.kind === 'payment' && <div className="grid gap-2"><Label>Тип оплаты</Label><Select value={paymentKind} onValueChange={(value) => setPaymentKind(value as AccountingPaymentKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCOUNTING_PAYMENT_KIND_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
            {entry?.kind === 'payment' && <div className="grid gap-2"><Label htmlFor="payment-reference">Номер платёжного поручения / назначение</Label><Input id="payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="ПП №…, оплата по договору…" /></div>}
            <div className="grid gap-2"><Label htmlFor="entry-file">Файл {entry?.kind === 'payment' ? 'платёжного документа' : entry ? documentTypeLabel(entry.kind) : 'документа'} (необязательно)</Label><Input id="entry-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)} /></div>
            <div className="grid gap-2"><Label htmlFor="entry-notes">Примечание</Label><Textarea id="entry-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Что важно знать бухгалтерии" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEntry(null)}>Отмена</Button><Button onClick={saveEntry} disabled={Boolean(savingKey)}>{savingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{entry?.kind === 'payment' ? 'Учесть оплату' : entry ? `Сохранить ${documentTypeLabel(entry.kind)}` : 'Сохранить'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(oneCIntegrationKey)} onOpenChange={(open) => !open && setOneCIntegrationKey('')}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ключ обмена HUB ↔ 1С</DialogTitle>
            <DialogDescription>Этот ключ показывается только один раз. Передайте его ответственному специалисту 1С по защищённому каналу.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="onec-integration-key">X-Hub-1C-Key</Label>
            <Textarea id="onec-integration-key" readOnly value={oneCIntegrationKey} className="min-h-24 break-all font-mono text-sm" />
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              Адрес приёма: <code>https://hub.rbpartners.kz/api/1c/sync</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOneCIntegrationKey('')}>Закрыть</Button>
            <Button onClick={async () => {
              await navigator.clipboard.writeText(oneCIntegrationKey);
              toast({ title: 'Ключ скопирован' });
            }}>Скопировать ключ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountingDetails({
  row,
  savingKey,
  onStatus,
  onSendEmail,
  onRemove,
  onOpenFile,
  onSaveContact,
}: {
  row: AccountingRow;
  savingKey: string;
  onStatus: (row: AccountingRow, document: AccountingDocument, status: AccountingDocumentStatus) => Promise<void>;
  onSendEmail: (row: AccountingRow, document: AccountingDocument) => Promise<void>;
  onRemove: (row: AccountingRow, kind: 'document' | 'payment', id: string) => Promise<void>;
  onOpenFile: (file?: AccountingFile) => Promise<void>;
  onSaveContact: (row: AccountingRow, contact: AccountingContact) => Promise<void>;
}) {
  const documents = [...row.summary.invoices, ...row.summary.avrs, ...row.summary.esfs].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const payments = [...row.summary.payments].sort((a, b) => b.date.localeCompare(a.date));
  const notes = projectNotes(row.project);
  const amendments = Array.isArray((row.project as any).amendments)
    ? (row.project as any).amendments
    : Array.isArray(notes.amendments)
      ? notes.amendments
      : [];
  const finances = (row.project as any).finances || notes.finances || {};
  const contractors = Array.isArray(finances.contractors) ? finances.contractors : [];
  const contractFiles = projectContractFiles(row.project);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border bg-background p-4"><div className="text-xs uppercase text-muted-foreground">Договор</div><div className="mt-1 font-semibold">№ {row.contractNumber}</div><div className="text-sm text-muted-foreground">от {formatDate(row.contractDate)}</div><div className="mt-2 text-lg font-bold">{formatMoney(row.summary.contractAmount, row.summary.currency)}</div>{amendments.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Дополнительных соглашений: <b className="text-foreground">{amendments.length}</b>{amendments.slice(0, 2).map((item: any, index: number) => <div key={item?.id || index}>№ {item?.number || 'б/н'}{item?.date ? ` от ${formatDate(item.date)}` : ''}{Number(item?.amount || item?.amountWithoutVAT || 0) > 0 ? ` · ${formatMoney(Number(item.amount || item.amountWithoutVAT), row.summary.currency)}` : ''}</div>)}</div>}</div>
        <div className="rounded-xl border bg-background p-4"><div className="text-xs uppercase text-muted-foreground">Контроль оплаты</div><div className="mt-2 flex justify-between text-sm"><span>Оплачено</span><b className="text-emerald-600">{formatMoney(row.summary.paidAmount, row.summary.currency)}</b></div><div className="mt-1 flex justify-between text-sm"><span>Дебиторка</span><b className={row.summary.receivableAmount ? 'text-red-600' : 'text-emerald-600'}>{formatMoney(row.summary.receivableAmount, row.summary.currency)}</b></div><div className="mt-1 flex justify-between text-sm"><span>Остаток договора</span><b>{formatMoney(row.summary.contractBalanceAmount, row.summary.currency)}</b></div></div>
        <div className="rounded-xl border bg-background p-4"><div className="text-xs uppercase text-muted-foreground">Проект</div><div className="mt-2 text-sm">Руководитель: <b>{row.leaderName}</b></div><div className="mt-1 text-sm">Срок: <b>{formatDate(row.deadline)}</b></div>{contractors.length > 0 && <div className="mt-2 text-xs text-muted-foreground">ГПХ / субподряд: <b className="text-foreground">{contractors.map((item: any) => item?.name || item?.label).filter(Boolean).join(', ') || `${contractors.length} записей`}</b></div>}<div className="mt-3 flex flex-wrap gap-1.5">{contractFiles.length === 0 ? <span className="text-xs text-muted-foreground">Файл договора не загружен</span> : contractFiles.map((file: any, index: number) => <Button key={file?.id || file?.storagePath || index} size="sm" variant="outline" onClick={() => onOpenFile(file as AccountingFile)}><Download className="mr-1 h-3.5 w-3.5" />{file?.fileName || file?.name || 'Договор'}</Button>)}</div></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-background p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><FileCheck2 className="h-4 w-4" />Счета, АВР и ЭСФ</div>{documents.length === 0 ? <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Документы ещё не добавлены.</div> : <div className="space-y-2">{documents.map((document) => { const documentDeadline = accountingDeadlineUrgency(document.dueDate || '', today(), document.status === 'signed' || document.status === 'registered' || document.status === 'cancelled'); return <div key={document.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><div className="font-medium">{documentTypeLabel(document.type)} № {document.number || 'без номера'}</div>{document.source === '1c' && <Badge variant="secondary" className="text-[10px]">из 1С</Badge>}</div><div className="text-xs text-muted-foreground">{formatDate(document.issueDate)} · {formatMoney(document.amount, row.summary.currency)}{document.dueDate ? ` · ${document.type === 'invoice' ? 'оплатить' : document.type === 'avr' ? 'подписать' : 'зарегистрировать'} до ${formatDate(document.dueDate)}` : ''}</div><div className="mt-1"><DeadlineBadge urgency={documentDeadline.urgency} days={documentDeadline.days} /></div></div><Badge variant="outline">{ACCOUNTING_DOCUMENT_STATUS_LABELS[document.status]}</Badge></div><div className="mt-2 flex flex-wrap gap-1.5">{document.file && <Button size="sm" variant="ghost" onClick={() => onOpenFile(document.file)}><Download className="mr-1 h-3.5 w-3.5" />{document.file.fileName || 'Файл'}</Button>}{document.file && row.summary.ledger.contact?.email && !['sent', 'signed', 'registered'].includes(document.status) && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onSendEmail(row, document)}><Send className="mr-1 h-3.5 w-3.5" />Отправить email</Button>}{document.status === 'draft' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'issued')}>Выставлен</Button>}{document.status === 'issued' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'sent')}>Уже отправлен</Button>}{document.type === 'avr' && document.status === 'sent' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'signed')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Подписан</Button>}{document.type === 'esf' && document.status === 'sent' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'registered')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Зарегистрирован</Button>}<Button size="sm" variant="ghost" className="text-destructive" disabled={Boolean(savingKey)} onClick={() => onRemove(row, 'document', document.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>{document.notes && <div className="mt-2 text-xs text-muted-foreground">{document.notes}</div>}</div>; })}</div>}</div>
        <div className="rounded-xl border bg-background p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><Banknote className="h-4 w-4" />Фактические оплаты</div>{payments.length === 0 ? <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Оплаты ещё не внесены.</div> : <div className="space-y-2">{payments.map((payment: AccountingPayment) => <div key={payment.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><div className="font-semibold text-emerald-600">+ {formatMoney(payment.amount, row.summary.currency)}</div><div className="text-xs text-muted-foreground">{formatDate(payment.date)} · {ACCOUNTING_PAYMENT_KIND_LABELS[payment.kind]}</div>{payment.reference && <div className="mt-1 text-xs">{payment.reference}</div>}{payment.file && <Button size="sm" variant="ghost" className="mt-1 h-7 px-1" onClick={() => onOpenFile(payment.file)}><Download className="mr-1 h-3.5 w-3.5" />Документ</Button>}</div><Button size="sm" variant="ghost" className="text-destructive" disabled={Boolean(savingKey)} onClick={() => onRemove(row, 'payment', payment.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>}</div>
      </div>
      <ContactEditor row={row} saving={savingKey === `${row.project.id}:contact`} onSave={onSaveContact} />
    </div>
  );
}
