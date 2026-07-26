import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Loader2,
  PieChart as PieChartIcon,
  Printer,
  Search,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import {
  BONUS_REGISTRY_CURRENCY,
  buildBonusLedger,
  type BonusProjectSource,
  type EmployeeBonusLedger,
} from '@/lib/bonusLedger';
import { loadBonusPayments, type BonusPaymentRow } from '@/lib/bonusPayments';
import {
  BUSINESS_SEASON_NO_DATE,
  projectBusinessSeasonValueFromProject,
} from '@/lib/businessSeason';
import { loadTimesheetHoursSnapshot, type TimesheetHoursSnapshot } from '@/lib/timesheets';
import { ROLE_LABELS, type UserRole } from '@/types/roles';

const moneyFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const CURRENCY_SYMBOLS: Record<string, string> = {
  KZT: '₸',
  USD: '$',
  EUR: '€',
};

const PIE_COLORS = ['#10b981', '#2563eb', '#f59e0b', '#94a3b8'];

type SourceAmountField =
  | 'plannedAmount'
  | 'registryPendingAmount'
  | 'approvedAmount'
  | 'paidAmount'
  | 'unregisteredAmount'
  | 'overRegisteredAmount';

type LedgerStatusFilter = 'all' | 'unregistered' | 'pending' | 'approved' | 'paid' | 'mismatch';
type LedgerAmountMetric = 'plannedAmount' | 'approvedAmount' | 'paidAmount' | 'unregisteredAmount';

const AMOUNT_METRIC_LABELS: Record<LedgerAmountMetric, string> = {
  plannedAmount: 'Рассчитано',
  approvedAmount: 'Утверждено',
  paidAmount: 'Выплачено',
  unregisteredAmount: 'Не в реестре',
};

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

function formatMoney(value: number, currency = 'KZT'): string {
  return `${moneyFormat.format(Number(value) || 0)} ${currencySymbol(currency)}`;
}

function formatHours(value: number): string {
  return `${numberFormat.format(Number(value) || 0)} ч`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU').format(parsed);
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] || role.replace(/_/g, ' ') || 'Роль не указана';
}

function seasonFromProject(project: any) {
  const value = projectBusinessSeasonValueFromProject(project);
  if (value === BUSINESS_SEASON_NO_DATE) {
    return { key: value, label: 'Без даты' };
  }
  const endYear = Number(value.replace('season:', ''));
  return {
    key: value,
    label: `Сезон ${endYear} · октябрь ${endYear - 1} — сентябрь ${endYear}`,
  };
}

function amountCurrency(source: BonusProjectSource, field: SourceAmountField): string {
  return field === 'plannedAmount' || field === 'unregisteredAmount'
    ? source.currency
    : BONUS_REGISTRY_CURRENCY;
}

function sourceAmountBreakdown(
  sources: readonly BonusProjectSource[],
  field: SourceAmountField,
): Array<{ currency: string; amount: number }> {
  const totals = new Map<string, number>();
  for (const source of sources) {
    const value = Number(source[field]) || 0;
    if (value === 0) continue;
    const currency = amountCurrency(source, field);
    totals.set(currency, (totals.get(currency) || 0) + value);
  }
  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === 'KZT' ? -1 : b.currency === 'KZT' ? 1 : a.currency.localeCompare(b.currency)));
}

function MoneyBreakdown({
  sources,
  field,
  className = '',
}: {
  sources: readonly BonusProjectSource[];
  field: SourceAmountField;
  className?: string;
}) {
  const values = sourceAmountBreakdown(sources, field);
  if (values.length === 0) return <span className={className}>0 ₸</span>;
  return (
    <span className={className}>
      {values.map((value, index) => (
        <span key={value.currency}>
          {index > 0 ? ' + ' : ''}{formatMoney(value.amount, value.currency)}
        </span>
      ))}
    </span>
  );
}

function sumKzt(sources: readonly BonusProjectSource[], field: SourceAmountField): number {
  return sources.reduce((sum, source) => {
    if (amountCurrency(source, field) !== 'KZT') return sum;
    return sum + (Number(source[field]) || 0);
  }, 0);
}

function sourceMatchesStatus(source: BonusProjectSource, filter: LedgerStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unregistered') return source.unregisteredAmount > 0;
  if (filter === 'pending') return source.registryPendingAmount > 0;
  if (filter === 'approved') return source.approvedAmount > 0;
  if (filter === 'paid') return source.paidAmount > 0;
  return source.overRegisteredAmount > 0 || source.projectAllocatedAmount > source.projectBonusPoolAmount;
}

function parseAmountFilter(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sourceSearchText(source: BonusProjectSource): string {
  return `${source.employeeName} ${source.employeeEmail} ${source.projectName} ${source.companyName} ${source.role}`.toLowerCase();
}

function KpiCard({
  testId,
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  testId?: string;
  label: string;
  value: string;
  hint: string;
  icon: typeof Banknote;
  tone: 'blue' | 'amber' | 'emerald' | 'slate' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  };
  return (
    <Card data-testid={testId} className="min-w-0 border-border/70 p-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3 xl:block 2xl:flex">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl xl:mb-3 2xl:mb-0 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 whitespace-nowrap text-lg font-black leading-tight text-foreground 2xl:text-xl">{value}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
        </div>
      </div>
    </Card>
  );
}

function SourceStatus({ source }: { source: BonusProjectSource }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {source.paidAmount > 0 && <Badge className="bg-emerald-600 text-white">Выплачено</Badge>}
      {source.approvedAmount > 0 && <Badge className="bg-blue-600 text-white">Утверждено</Badge>}
      {source.registryPendingAmount > 0 && <Badge variant="secondary">В реестре · ждёт</Badge>}
      {source.unregisteredAmount > 0 && <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">Не внесено в реестр</Badge>}
      {source.overRegisteredAmount > 0 && <Badge variant="destructive">Реестр выше расчёта</Badge>}
      {source.manuallyAdjusted && <Badge variant="outline">Ручная сумма CEO</Badge>}
    </div>
  );
}

function PrintSlip({ employee, onClose }: { employee: EmployeeBonusLedger; onClose: () => void }) {
  const hasRegistryMoney = employee.sources.some((source) => source.approvedAmount > 0 || source.paidAmount > 0);
  const approvedForSignature = sumKzt(employee.sources, 'approvedAmount');
  const paidForSignature = sumKzt(employee.sources, 'paidAmount');
  const signatureAmount = approvedForSignature > 0 ? approvedForSignature : paidForSignature;
  const signatureAmountLabel = approvedForSignature > 0
    ? 'К выдаче по текущему реестру'
    : 'Подтверждено как выплаченное';
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-3 sm:p-8 print:static print:bg-white print:p-0">
      <div
        data-testid="bonus-print-slip"
        className="bonus-print-slip mx-auto max-w-4xl bg-white p-5 text-slate-950 shadow-2xl sm:p-10 print:max-w-none print:shadow-none"
      >
        <div className="mb-5 flex items-start justify-between gap-4 print:hidden">
          <p className="text-sm text-slate-600">Предпросмотр документа перед печатью</p>
          <Button variant="outline" size="icon" aria-label="Закрыть ведомость" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-b-2 border-slate-900 pb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">SUITE-A · RB Partners</p>
          <h1 className="mt-2 text-2xl font-black">Ведомость выплаты бонуса</h1>
          <p className="mt-1 text-sm text-slate-600">Персональная расшифровка по проектам</p>
        </div>

        {!hasRegistryMoney && (
          <div className="mt-5 border-2 border-amber-500 bg-amber-50 p-3 text-center text-sm font-bold text-amber-900">
            ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ — В ФИНАЛЬНОМ ПЛАТЁЖНОМ РЕЕСТРЕ НЕТ УТВЕРЖДЁННОЙ СУММЫ
          </div>
        )}

        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-slate-500">Сотрудник:</span> <strong>{employee.employeeName}</strong></div>
          <div><span className="text-slate-500">Email:</span> <strong>{employee.employeeEmail || '—'}</strong></div>
          <div><span className="text-slate-500">Проектов:</span> <strong>{employee.sources.length}</strong></div>
          <div><span className="text-slate-500">Дата формирования:</span> <strong>{formatDate(new Date().toISOString())}</strong></div>
        </div>

        <div className="mt-6 overflow-hidden border border-slate-300">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-slate-300 p-2">Проект / роль</th>
                <th className="border-b border-slate-300 p-2 text-right">Расчёт</th>
                <th className="border-b border-slate-300 p-2 text-right">К выплате</th>
                <th className="border-b border-slate-300 p-2 text-right">Выплачено</th>
              </tr>
            </thead>
            <tbody>
              {employee.sources.map((source) => (
                <tr key={source.key}>
                  <td className="border-b border-slate-200 p-2 align-top">
                    <strong>{source.projectName}</strong>
                    <div className="text-slate-500">{source.companyName} · {roleLabel(source.role)}</div>
                  </td>
                  <td className="border-b border-slate-200 p-2 text-right align-top">{formatMoney(source.plannedAmount, source.currency)}</td>
                  <td className="border-b border-slate-200 p-2 text-right align-top">{formatMoney(source.approvedAmount, BONUS_REGISTRY_CURRENCY)}</td>
                  <td className="border-b border-slate-200 p-2 text-right align-top">{formatMoney(source.paidAmount, BONUS_REGISTRY_CURRENCY)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-2 border border-slate-300 bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div>Расчётный итог: <strong><MoneyBreakdown sources={employee.sources} field="plannedAmount" /></strong></div>
          <div>Утверждено к выплате: <strong>{formatMoney(approvedForSignature)}</strong></div>
          <div>Фактически выплачено: <strong>{formatMoney(paidForSignature)}</strong></div>
        </div>

        <div className="mt-5 border-2 border-slate-900 p-4 text-center text-base">
          {signatureAmountLabel}: <strong className="text-lg">{formatMoney(signatureAmount)}</strong>
        </div>

        <div className="mt-14 grid gap-10 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-8 font-semibold">Сумму {formatMoney(signatureAmount)} получил(а): ____________________</p>
            <p>Подпись сотрудника: ____________________</p>
          </div>
          <div>
            <p className="mb-8">Дата: «____» ______________ 20____ г.</p>
            <p>Выдал(а) / подпись: ____________________</p>
          </div>
        </div>

        <p className="mt-12 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          Источник расчёта: карточки проектов. Факт утверждения и выплаты подтверждается только финальным платёжным реестром.
        </p>
      </div>
    </div>
  );
}

export default function Bonuses() {
  const { projects = [], loading: projectsLoading, error: projectsError } = useProjects();
  const { employees = [], loading: employeesLoading, error: employeesError } = useEmployees();
  const [payments, setPayments] = useState<BonusPaymentRow[]>([]);
  const [hours, setHours] = useState<TimesheetHoursSnapshot | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [season, setSeason] = useState('all');
  const [status, setStatus] = useState<LedgerStatusFilter>('all');
  const [amountMetric, setAmountMetric] = useState<LedgerAmountMetric>('plannedAmount');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [page, setPage] = useState(1);
  const [printEmployee, setPrintEmployee] = useState<EmployeeBonusLedger | null>(null);

  const projectScope = useMemo(
    () => Array.from(new Set(projects.map((project: any) => String(project.id)).filter(Boolean))).sort(),
    [projects],
  );
  const projectScopeKey = projectScope.join('|');

  useEffect(() => {
    if (projectsLoading) return;
    let active = true;
    const controller = new AbortController();
    setLedgerLoading(true);
    setRegistryError(null);
    setHoursError(null);

    Promise.allSettled([
      // CEO/admin load the whole final registry once. The pure ledger then
      // reports missing/out-of-scope rows instead of silently hiding them.
      loadBonusPayments(undefined, controller.signal),
      loadTimesheetHoursSnapshot(projectScope, controller.signal),
    ]).then(([paymentResult, hoursResult]) => {
      if (!active) return;
      if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value);
      else {
        setPayments([]);
        setRegistryError(paymentResult.reason instanceof Error ? paymentResult.reason.message : String(paymentResult.reason));
      }
      if (hoursResult.status === 'fulfilled') {
        setHours(hoursResult.value);
        if (!hoursResult.value.complete) setHoursError(hoursResult.value.error || 'Таймшиты загружены не полностью');
      } else {
        setHours(null);
        setHoursError(hoursResult.reason instanceof Error ? hoursResult.reason.message : String(hoursResult.reason));
      }
      setLedgerLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [projectScopeKey, projectsLoading]);

  const ledger = useMemo(() => buildBonusLedger({
    projects,
    employees,
    payments,
    approvedHours: hours?.approvedByEmployeeProject,
    pendingHours: hours?.pendingByEmployeeProject,
    seasonForProject: seasonFromProject,
  }), [projects, employees, payments, hours]);

  const normalizedSearch = search.trim().toLowerCase();
  const amountFromValue = parseAmountFilter(amountFrom);
  const amountToValue = parseAmountFilter(amountTo);
  const visibleEmployees = useMemo(() => ledger.employees.flatMap((employee) => {
    const employeeMatches = `${employee.employeeName} ${employee.employeeEmail}`.toLowerCase().includes(normalizedSearch);
    const sources = employee.sources.filter((source) => {
      if (season !== 'all' && source.season?.key !== season) return false;
      if (!sourceMatchesStatus(source, status)) return false;
      const selectedAmount = Number(source[amountMetric]) || 0;
      if (amountFromValue !== null && selectedAmount < amountFromValue) return false;
      if (amountToValue !== null && selectedAmount > amountToValue) return false;
      if (!normalizedSearch || employeeMatches) return true;
      return sourceSearchText(source).includes(normalizedSearch);
    });
    return sources.length > 0 ? [{ ...employee, sources }] : [];
  }), [ledger.employees, normalizedSearch, season, status, amountMetric, amountFromValue, amountToValue]);
  const visibleSources = useMemo(
    () => visibleEmployees.flatMap((employee) => employee.sources),
    [visibleEmployees],
  );
  const displayKzt = useMemo(() => {
    const projectsInScope = new Map<string, BonusProjectSource>();
    for (const source of visibleSources) {
      if (source.currency === 'KZT' && !projectsInScope.has(source.projectId)) {
        projectsInScope.set(source.projectId, source);
      }
    }
    const scopedProjects = Array.from(projectsInScope.values());
    return {
      plannedAmount: sumKzt(visibleSources, 'plannedAmount'),
      registryPendingAmount: sumKzt(visibleSources, 'registryPendingAmount'),
      approvedAmount: sumKzt(visibleSources, 'approvedAmount'),
      paidAmount: sumKzt(visibleSources, 'paidAmount'),
      unregisteredAmount: sumKzt(visibleSources, 'unregisteredAmount'),
      bonusPoolAmount: scopedProjects.reduce((sum, source) => sum + source.projectBonusPoolAmount, 0),
      unallocatedPoolAmount: scopedProjects.reduce(
        (sum, source) => sum + Math.max(0, source.projectBonusPoolAmount - source.projectAllocatedAmount),
        0,
      ),
    };
  }, [visibleSources]);
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(visibleEmployees.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedEmployees = visibleEmployees.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch, season, status, amountMetric, amountFromValue, amountToValue]);

  const kzt = ledger.currencyTotals.KZT || {
    currency: 'KZT',
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
  };

  const loading = projectsLoading || employeesLoading || ledgerLoading;
  const reconciliationReady = !loading
    && !projectsError
    && !employeesError
    && !registryError
    && !hoursError;
  const currencyReconciliations = Object.values(ledger.currencyTotals).map((totals) => ({
    ...totals,
    delta: totals.plannedAmount + totals.overRegisteredAmount - totals.linkedRegistryAmount - totals.unregisteredAmount,
  }));
  const reconciliationOk = reconciliationReady
    && currencyReconciliations.every((item) => Math.abs(item.delta) < 0.01)
    && ledger.totals.unlinkedPaymentRows === 0
    && ledger.totals.missingProjectPaymentRows === 0
    && ledger.totals.outOfScopePaymentRows === 0;

  const pieData = [
    { name: 'Выплачено', value: displayKzt.paidAmount, color: PIE_COLORS[0] },
    { name: 'Утверждено к выплате', value: displayKzt.approvedAmount, color: PIE_COLORS[1] },
    { name: 'В реестре, ждёт решения', value: displayKzt.registryPendingAmount, color: PIE_COLORS[2] },
    { name: 'Ещё не внесено в реестр', value: displayKzt.unregisteredAmount, color: PIE_COLORS[3] },
  ];
  const chartPieData = pieData.some((item) => item.value > 0)
    ? pieData.filter((item) => item.value > 0)
    : [{ name: 'Нет данных', value: 1, color: '#cbd5e1' }];

  const topEmployees = useMemo(() => visibleEmployees
    .map((employee) => ({
      name: employee.employeeName.length > 24 ? `${employee.employeeName.slice(0, 22)}…` : employee.employeeName,
      fullName: employee.employeeName,
      value: sumKzt(employee.sources, amountMetric),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10), [visibleEmployees, amountMetric]);
  const chartEmployeeData = topEmployees.length > 0 ? topEmployees : [{ name: 'Нет данных', fullName: 'Нет данных', value: 0 }];

  const nonKzt = Object.values(ledger.currencyTotals).filter((item) => item.currency !== 'KZT' && (
    item.bonusPoolAmount || item.plannedAmount || item.registeredAmount
  ));
  const unknownIdentities = ledger.employees.filter((employee) => employee.sources.some((source) => !source.identityMatched)).length;
  const overPercentProjects = new Set(
    ledger.sources.filter((source) => source.projectTeamPercentTotal > 100.001).map((source) => source.projectId),
  ).size;

  useEffect(() => {
    if (!printEmployee) return;
    const frame = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(frame);
  }, [printEmployee]);

  return (
    <div data-testid="bonus-dashboard" className="mx-auto w-full max-w-[1600px] min-w-0 space-y-5 overflow-x-hidden px-3 pb-24 pt-3 sm:px-5 md:px-7 md:pb-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .bonus-print-slip, .bonus-print-slip * { visibility: visible !important; }
          .bonus-print-slip {
            display: block !important;
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 18mm !important;
            box-shadow: none !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <header className="flex min-w-0 flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link to="/projects" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Вернуться в свод проектов
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletCards className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Бонусная ведомость</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Один экран: сотрудники → проекты → расчёт → платёжный реестр</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5">
          <BadgeCheck className="h-4 w-4 text-emerald-600" /> Только CEO и администратор
        </Badge>
      </header>

      {loading && (
        <Card className="flex items-center gap-3 border-primary/20 bg-primary/5 p-5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="font-semibold">Собираем точную ведомость…</p>
            <p className="text-sm text-muted-foreground">Сверяем проекты, сотрудников, утверждённые часы и финальный реестр выплат.</p>
          </div>
        </Card>
      )}

      {(projectsError || employeesError || registryError || hoursError) && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-bold text-destructive">Часть данных не загрузилась</p>
              <p className="mt-1 text-muted-foreground">
                {[projectsError, employeesError, registryError, hoursError].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 font-medium">Суммы не подменяются нулями молча: ошибка показана до принятия решения.</p>
            </div>
          </div>
        </Card>
      )}

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          testId="bonus-kpi-planned"
          label="Рассчитано сотрудникам"
          value={formatMoney(displayKzt.plannedAmount)}
          hint={`${visibleEmployees.length} чел. · ${visibleSources.length} источников в текущей выборке`}
          icon={Users}
          tone="violet"
        />
        <KpiCard
          testId="bonus-kpi-approved"
          label="Утверждено к выплате"
          value={formatMoney(displayKzt.approvedAmount)}
          hint="По сотрудникам и проектам текущей выборки"
          icon={BadgeCheck}
          tone="blue"
        />
        <KpiCard
          testId="bonus-kpi-paid"
          label="Фактически выплачено"
          value={formatMoney(displayKzt.paidAmount)}
          hint="Только строки текущей выборки с датой оплаты"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          testId="bonus-kpi-unregistered"
          label="Ещё не в реестре"
          value={formatMoney(displayKzt.unregisteredAmount)}
          hint="Расчёт есть в текущей выборке, платёжной записи нет"
          icon={Clock3}
          tone="amber"
        />
        <KpiCard
          label="Пул выбранных проектов"
          value={formatMoney(displayKzt.bonusPoolAmount)}
          hint={`Не распределено ${formatMoney(displayKzt.unallocatedPoolAmount)}`}
          icon={CircleDollarSign}
          tone="slate"
        />
      </section>

      <Card
        data-testid="bonus-reconciliation"
        className={`border p-4 ${loading ? 'border-primary/30 bg-primary/5' : reconciliationOk ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {loading
              ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
              : reconciliationOk
              ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
            <div className="min-w-0">
              <p className="font-black">
                {loading
                  ? 'Сверяем платёжный реестр…'
                  : !reconciliationReady
                    ? 'Сверка не завершена: часть данных недоступна'
                    : reconciliationOk
                      ? 'Сверка сошлась'
                      : 'Нужна сверка платёжного реестра'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Расчёт {formatMoney(kzt.plannedAmount)} + превышение реестра {formatMoney(kzt.overRegisteredAmount)} =
                сопоставлено в реестре {formatMoney(kzt.linkedRegistryAmount)} + ещё не внесено {formatMoney(kzt.unregisteredAmount)}.
                {kzt.unlinkedRegistryAmount > 0 && ` Отдельно без сотрудника: ${formatMoney(kzt.unlinkedRegistryAmount)}.`}
              </p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-4">
            <div><span className="text-muted-foreground">В портфеле</span><strong className="block text-sm">{ledger.totals.paymentRows}</strong></div>
            <div><span className="text-muted-foreground">Без сотрудника</span><strong className="block text-sm">{ledger.totals.unlinkedPaymentRows} · {formatMoney(kzt.unlinkedRegistryAmount)}</strong></div>
            <div><span className="text-muted-foreground">Без проекта</span><strong className="block text-sm">{ledger.totals.missingProjectPaymentRows} · {formatMoney(ledger.totals.missingProjectRegistryAmount)}</strong></div>
            <div><span className="text-muted-foreground">Вне портфеля</span><strong className="block text-sm">{ledger.totals.outOfScopePaymentRows} · {formatMoney(ledger.totals.outOfScopeRegistryAmount)}</strong></div>
          </div>
        </div>
      </Card>

      {(nonKzt.length > 0 || unknownIdentities > 0 || overPercentProjects > 0 || kzt.overAllocatedPoolAmount > 0) && (
        <Card className="border-amber-500/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-bold">Контроль качества перед выплатой</p>
              <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                {nonKzt.length > 0 && (
                  <p><strong className="text-foreground">Валюта:</strong> {nonKzt.map((item) => `${item.currency}: ${formatMoney(item.plannedAmount, item.currency)}`).join(' · ')}. Эти суммы не прибавлены к KZT.</p>
                )}
                {unknownIdentities > 0 && <p><strong className="text-foreground">Сотрудники:</strong> {unknownIdentities} записей требуют сопоставления с базой; печать расписки заблокирована.</p>}
                {overPercentProjects > 0 && <p><strong className="text-foreground">Формула:</strong> в {overPercentProjects} проект(ах) сумма ролевых процентов выше 100%.</p>}
                {kzt.overAllocatedPoolAmount > 0 && <p><strong className="text-foreground">Пул:</strong> распределение выше пулов на {formatMoney(kzt.overAllocatedPoolAmount)}.</p>}
              </div>
            </div>
          </div>
        </Card>
      )}

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card data-testid="bonus-status-chart" className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <PieChartIcon className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-black">Состояние расчёта и выплат</h2>
              <p className="text-xs text-muted-foreground">Текущая выборка · KZT не смешивается с иностранной валютой</p>
            </div>
          </div>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.9fr)] sm:items-center">
            <div className="h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {chartPieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(value: number | string) => formatMoney(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-start justify-between gap-3 rounded-lg bg-muted/35 p-2.5 text-xs">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="leading-snug text-muted-foreground">{item.name}</span>
                  </div>
                  <strong className="shrink-0">{formatMoney(item.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card data-testid="bonus-top-employees-chart" className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <BarChart3 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-black">Лестница сотрудников</h2>
              <p className="text-xs text-muted-foreground">Топ по «{AMOUNT_METRIC_LABELS[amountMetric]}» в текущей выборке · KZT</p>
            </div>
          </div>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartEmployeeData} layout="vertical" margin={{ top: 0, right: 34, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(value: number | string) => formatMoney(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 7, 7, 0]} minPointSize={2}>
                  <LabelList dataKey="value" position="right" formatter={(value: unknown) => moneyFormat.format(Number(value) || 0)} className="fill-foreground text-[10px]" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card className="min-w-0 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 xl:items-end">
          <label className="min-w-0 xl:col-span-3">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Поиск</span>
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Сотрудник, проект, компания или роль" className="w-full pl-9" />
            </div>
          </label>
          <label className="min-w-0 xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Бизнес-сезон</span>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все бизнес-сезоны</SelectItem>
                {ledger.seasons.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="min-w-0 xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Состояние денег</span>
            <Select value={status} onValueChange={(value) => setStatus(value as LedgerStatusFilter)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все состояния</SelectItem>
                <SelectItem value="unregistered">Не внесено в реестр</SelectItem>
                <SelectItem value="pending">В реестре, ждёт</SelectItem>
                <SelectItem value="approved">Утверждено к выплате</SelectItem>
                <SelectItem value="paid">Выплачено</SelectItem>
                <SelectItem value="mismatch">Есть расхождение</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="min-w-0 xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Фильтровать сумму</span>
            <Select value={amountMetric} onValueChange={(value) => setAmountMetric(value as LedgerAmountMetric)}>
              <SelectTrigger data-testid="bonus-amount-metric" aria-label="Показатель суммы" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(AMOUNT_METRIC_LABELS) as Array<[LedgerAmountMetric, string]>).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="min-w-0 xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Диапазон суммы</span>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <Input
                data-testid="bonus-amount-min"
                aria-label="Сумма от"
                inputMode="decimal"
                value={amountFrom}
                onChange={(event) => setAmountFrom(event.target.value)}
                placeholder="От"
              />
              <Input
                data-testid="bonus-amount-max"
                aria-label="Сумма до"
                inputMode="decimal"
                value={amountTo}
                onChange={(event) => setAmountTo(event.target.value)}
                placeholder="До"
              />
            </div>
          </div>
          <div data-testid="bonus-visible-count" className="text-sm text-muted-foreground xl:col-span-1 xl:pb-2 xl:text-right">
            Показано <strong className="text-foreground">{visibleEmployees.length}</strong> из {ledger.employees.length} сотрудников
          </div>
        </div>
      </Card>

      <section data-testid="bonus-employee-table" className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">По каждому сотруднику</h2>
            <p className="text-sm text-muted-foreground">Все проекты, часы контроля, процент, расчёт и факт оплаты — без переходов на другие страницы.</p>
          </div>
        </div>

        {!loading && visibleEmployees.length === 0 && (
          <Card className="p-10 text-center">
            <Users className="mx-auto h-9 w-9 text-muted-foreground/40" />
            <p className="mt-3 font-semibold">По выбранным условиям ничего не найдено</p>
          </Card>
        )}

        {pagedEmployees.map((employee) => {
          const printable = employee.sources.every((source) => source.identityMatched);
          return (
            <Card
              key={employee.employeeId}
              data-testid={`bonus-employee-row-${employee.employeeId}`}
              data-bonus-employee-row="true"
              className="min-w-0 overflow-hidden border-border/80 shadow-sm"
            >
              <div className="grid min-w-0 gap-4 border-b border-border bg-muted/20 p-4 lg:grid-cols-[minmax(220px,1.2fr)_repeat(4,minmax(120px,0.7fr))_auto] lg:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">
                    {employee.employeeName.slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words font-black leading-tight">{employee.employeeName}</h3>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{employee.employeeEmail || `ID: ${employee.employeeId}`}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{employee.sources.length} проект(а) · {formatHours(employee.sources.reduce((sum, source) => sum + source.approvedHours, 0))} утверждено</p>
                  </div>
                </div>
                <div><p className="text-[11px] uppercase text-muted-foreground">Рассчитано</p><MoneyBreakdown sources={employee.sources} field="plannedAmount" className="font-black" /></div>
                <div><p className="text-[11px] uppercase text-muted-foreground">Утверждено</p><MoneyBreakdown sources={employee.sources} field="approvedAmount" className="font-black text-blue-600" /></div>
                <div><p className="text-[11px] uppercase text-muted-foreground">Выплачено</p><MoneyBreakdown sources={employee.sources} field="paidAmount" className="font-black text-emerald-600" /></div>
                <div><p className="text-[11px] uppercase text-muted-foreground">Не в реестре</p><MoneyBreakdown sources={employee.sources} field="unregisteredAmount" className="font-black text-amber-600" /></div>
                <Button
                  variant="outline"
                  className="w-full gap-2 lg:w-auto"
                  disabled={!printable}
                  title={printable ? 'Подготовить персональную ведомость' : 'Сначала сопоставьте сотрудника с базой'}
                  aria-label={`Распечатать ведомость: ${employee.employeeName}`}
                  onClick={() => setPrintEmployee(employee as EmployeeBonusLedger)}
                >
                  <Printer className="h-4 w-4" /> Печать
                </Button>
              </div>

              <div data-testid="bonus-project-sources" className="divide-y divide-border">
                {employee.sources.map((source) => {
                  const formulaWarning = source.projectTeamPercentTotal > 100.001
                    || source.projectAllocatedAmount > source.projectBonusPoolAmount + 0.01;
                  return (
                    <article key={source.key} className="grid min-w-0 gap-3 p-4 xl:grid-cols-[minmax(240px,1.5fr)_minmax(170px,0.75fr)_repeat(4,minmax(110px,0.6fr))] xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start gap-2">
                          <h4 className="min-w-0 break-words text-sm font-bold leading-snug">{source.projectName}</h4>
                          {!source.identityMatched && <Badge variant="destructive">ID не найден в сотрудниках</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{source.companyName} · {source.season?.label || 'Без даты'}</p>
                        <p className="mt-1 text-xs"><strong>{roleLabel(source.role)}</strong> · {numberFormat.format(source.percent)}%</p>
                        <div className="mt-2"><SourceStatus source={source} /></div>
                        {formulaWarning && (
                          <p className="mt-2 text-xs font-semibold text-destructive">
                            Контроль формулы: команда {numberFormat.format(source.projectTeamPercentTotal)}%; распределено {formatMoney(source.projectAllocatedAmount, source.currency)} из пула {formatMoney(source.projectBonusPoolAmount, source.currency)}.
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg bg-muted/35 p-3 text-xs">
                        <p className="font-semibold">Контроль часов</p>
                        <p className="mt-1 text-muted-foreground">Утверждено: <strong className="text-foreground">{formatHours(source.approvedHours)}</strong></p>
                        <p className="text-muted-foreground">Ждёт: <strong className="text-foreground">{formatHours(source.pendingHours)}</strong></p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Часы показываются для контроля и сейчас не являются множителем формулы.</p>
                      </div>
                      <div><p className="text-[11px] uppercase text-muted-foreground">Расчёт</p><p className="font-black">{formatMoney(source.plannedAmount, source.currency)}</p></div>
                      <div><p className="text-[11px] uppercase text-muted-foreground">Утверждено</p><p className="font-black text-blue-600">{formatMoney(source.approvedAmount)}</p></div>
                      <div><p className="text-[11px] uppercase text-muted-foreground">Выплачено</p><p className="font-black text-emerald-600">{formatMoney(source.paidAmount)}</p>{source.latestPaymentDate && <p className="text-[10px] text-muted-foreground">{formatDate(source.latestPaymentDate)}</p>}</div>
                      <div><p className="text-[11px] uppercase text-muted-foreground">Осталось вне реестра</p><p className="font-black text-amber-600">{formatMoney(source.unregisteredAmount, source.currency)}</p></div>
                    </article>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {visibleEmployees.length > pageSize && (
          <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Сотрудники {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, visibleEmployees.length)} из {visibleEmployees.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Назад</Button>
              <span className="min-w-16 text-center text-sm font-semibold">{safePage} из {pageCount}</span>
              <Button variant="outline" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Далее</Button>
            </div>
          </Card>
        )}
      </section>

      <Card className="border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Как читать ведомость:</strong> «Рассчитано» — техническое распределение из карточки проекта; «Утверждено» и «Выплачено» — только финальный реестр. Несколько платёжных строк одного сотрудника по одному проекту считаются траншами. KZT и USD никогда не складываются в одну сумму.
      </Card>

      {printEmployee && <PrintSlip employee={printEmployee} onClose={() => setPrintEmployee(null)} />}
    </div>
  );
}
