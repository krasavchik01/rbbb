import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileText,
  Minus,
  Plus,
  RotateCcw,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export type ProjectInlineTone = 'neutral' | 'info' | 'positive' | 'warning' | 'danger';
export type ProjectInlineDataState = 'ready' | 'loading' | 'error';

export interface ProjectInlineTeamSummary {
  count: number;
  partnerName?: string | null;
  leaderName?: string | null;
  /** One deduplicated visible row per active project participant. */
  members: ProjectInlineTeamMember[];
}

export interface ProjectInlineTeamMember {
  id: string;
  name: string;
  roles: string[];
  approvedHours: number;
  pendingHours: number;
}

export interface ProjectInlineDeadlineSummary {
  rangeLabel: string;
  stateLabel: string;
  tone?: ProjectInlineTone;
}

export interface ProjectInlineHoursSummary {
  approved: number;
  pending: number;
  state?: ProjectInlineDataState;
}

export interface ProjectInlineContractSummary {
  number?: string | null;
  filesCount: number;
}

export interface ProjectInlineFinances {
  contractAmount: number | null;
  gphAmount: number | null;
  preExpenseAmount: number | null;
  allocatedBonusAmount: number | null;
  grossIncome: number | null;
}

export interface ProjectInlineBonusEmployee {
  /** One deduplicated row per employee. */
  id: string;
  name: string;
  roles: string[];
  approvedHours: number;
  pendingHours: number;
  amount: number;
  percent?: number | null;
  manuallyAdjusted?: boolean;
  approvedForPayment?: number | null;
  paidAmount?: number | null;
  pendingAmount?: number | null;
  editable?: boolean;
  lockedReason?: string | null;
}

export interface ProjectInlineBonuses {
  poolAmount: number;
  poolPercent: number;
  formulaPoolAmount?: number | null;
  manuallyAdjusted?: boolean;
  approvedForPayment?: number | null;
  paidAmount?: number | null;
  pendingAmount?: number | null;
  registryState?: ProjectInlineDataState;
  editable?: boolean;
  lockedReason?: string | null;
  employees: ProjectInlineBonusEmployee[];
}

export interface ProjectInlineDetailProps {
  projectId: string;
  name: string;
  company?: string | null;
  client?: string | null;
  serviceType?: string | null;
  statusLabel: string;
  statusTone?: ProjectInlineTone;
  issues?: string[];
  team: ProjectInlineTeamSummary;
  deadline: ProjectInlineDeadlineSummary;
  hours: ProjectInlineHoursSummary;
  contract: ProjectInlineContractSummary;
  finances: ProjectInlineFinances;
  showTeam?: boolean;
  showHours?: boolean;
  showFinances?: boolean;
  showBonuses?: boolean;
  bonuses?: ProjectInlineBonuses;
  showAdvancedToggle?: boolean;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  advancedContent?: ReactNode;
  onPoolAmountCommit?: (amount: number) => Promise<boolean>;
  onPoolPercentCommit?: (percent: number) => Promise<boolean>;
  onResetPoolFormula?: () => Promise<boolean>;
  onEmployeeAmountCommit?: (employeeId: string, amount: number) => Promise<boolean>;
  onResetEmployeeFormula?: (employeeId: string) => Promise<boolean>;
  /** Render directly inside a command-center table row, without a nested card shell. */
  embedded?: boolean;
  /** Role-aware controls supplied by the command center (team, status, dates). */
  managementControls?: ReactNode;
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const toneClasses: Record<ProjectInlineTone, string> = {
  neutral: 'border-border bg-muted/30 text-foreground',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200',
};

function formatMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${moneyFormatter.format(value)} ₸` : '—';
}

function safePositive(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function safePercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return value > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function inputNumber(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized.trim()) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

export function ProjectInlineDetail({
  projectId,
  name,
  company,
  client,
  serviceType,
  statusLabel,
  statusTone = 'neutral',
  issues = [],
  team,
  deadline,
  hours,
  contract,
  finances,
  showTeam = true,
  showHours = true,
  showFinances = true,
  showBonuses = false,
  bonuses,
  showAdvancedToggle = true,
  advancedOpen,
  onToggleAdvanced,
  advancedContent,
  onPoolAmountCommit,
  onPoolPercentCommit,
  onResetPoolFormula,
  onEmployeeAmountCommit,
  onResetEmployeeFormula,
  embedded = false,
  managementControls,
}: ProjectInlineDetailProps) {
  const approvedHours = safePositive(hours.approved);
  const pendingHours = safePositive(hours.pending);
  const totalHours = approvedHours + pendingHours;
  const approvedWidth = safePercent(approvedHours, totalHours);
  const pendingWidth = totalHours > 0 ? Math.max(0, 100 - approvedWidth) : 0;
  const visibleFactCount = 2 + Number(showTeam) + Number(showHours);
  const factGridColumns = visibleFactCount >= 4
    ? 'lg:grid-cols-4'
    : visibleFactCount === 3
      ? 'lg:grid-cols-3'
      : 'lg:grid-cols-2';
  const Root = embedded ? 'div' : Card;
  return (
    <Root
      id={`project-details-${projectId}`}
      className={embedded
        ? 'min-w-0 max-w-full overflow-hidden bg-background'
        : 'min-w-0 max-w-full overflow-hidden border-slate-200 shadow-sm dark:border-slate-800'}
      data-testid={`project-details-${projectId}`}
      data-project-id={embedded ? undefined : projectId}
      aria-label={`Свод проекта ${name}`}
    >
      <div className="flex min-w-0 flex-col gap-3 border-b bg-gradient-to-r from-background to-sky-50/60 px-3 py-3 dark:to-sky-950/20 sm:px-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold leading-snug sm:text-lg">{name}</h3>
            <Badge variant="outline" className={toneClasses[statusTone]}>{statusLabel}</Badge>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
            {[
              company ? `Наша компания: ${company}` : '',
              client ? `Клиент: ${client}` : '',
              serviceType ? `Услуга: ${serviceType}` : '',
            ].filter(Boolean).join(' · ') || 'Основные данные проекта не указаны'}
          </p>
          {issues.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Что требует внимания">
              {issues.slice(0, 3).map((issue) => (
                <Badge key={issue} variant="outline" className="max-w-full whitespace-normal border-amber-200 bg-amber-50/60 text-left text-[11px] leading-4 text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                  {issue}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
          <Button asChild type="button" variant="outline" size="sm" className="h-10 min-w-0 flex-1 sm:flex-none">
            <Link to={`/project/${projectId}`}>Файлы и договор <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
          {showAdvancedToggle && <Button
            type="button"
            variant={advancedOpen ? 'secondary' : 'outline'}
            size="sm"
            className="h-10 min-w-0 flex-1 sm:flex-none"
            onClick={onToggleAdvanced}
            data-testid="project-advanced-toggle"
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? 'Скрыть детали' : 'Ещё детали'}
            {advancedOpen ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
          </Button>}
        </div>
      </div>

      {managementControls && (
        <section className="min-w-0 border-b bg-background px-3 py-3 sm:px-4" aria-label="Управление проектом">
          {managementControls}
        </section>
      )}

      <div className={`grid min-w-0 grid-cols-1 gap-px bg-border sm:grid-cols-2 ${factGridColumns}`} data-testid="project-inline-facts">
        {showTeam && <FactCard icon={<Users className="h-4 w-4" />} label="Команда">
          <div className="font-semibold">{Math.max(0, team.count)} чел.</div>
          <div className="mt-1 break-words text-[11px] leading-4 text-muted-foreground">
            Партнёр: {team.partnerName || '—'}<br />Руководитель: {team.leaderName || '—'}
          </div>
        </FactCard>}
        <FactCard icon={<CalendarClock className="h-4 w-4" />} label="Сроки проекта">
          <div className="break-words font-semibold tabular-nums">{deadline.rangeLabel || 'Не указан'}</div>
          <Badge variant="outline" className={`mt-1.5 max-w-full whitespace-normal text-[10px] ${toneClasses[deadline.tone || 'neutral']}`}>
            {deadline.stateLabel || 'Нет оценки срока'}
          </Badge>
        </FactCard>
        {showHours && <FactCard icon={<Clock3 className="h-4 w-4" />} label="Таймшиты">
          {hours.state === 'loading' ? (
            <div className="text-sm text-muted-foreground">Загружаются…</div>
          ) : hours.state === 'error' ? (
            <div className="text-sm font-medium text-red-700 dark:text-red-300">Данные недоступны</div>
          ) : (
            <>
              <div className="font-semibold tabular-nums">{totalHours.toFixed(1)} ч</div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted" data-testid="project-hours-bar" aria-label={`Утверждено ${approvedHours.toFixed(1)} часа, ждёт ${pendingHours.toFixed(1)} часа`}>
                {approvedHours > 0 && <div className="bg-emerald-500" style={{ width: `${approvedWidth}%` }} />}
                {pendingHours > 0 && <div className="bg-amber-400" style={{ width: `${pendingWidth}%` }} />}
              </div>
              <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{approvedHours.toFixed(1)} утверждено · {pendingHours.toFixed(1)} ждёт</div>
            </>
          )}
        </FactCard>}
        <FactCard icon={<FileText className="h-4 w-4" />} label="Договор">
          <div className="break-words font-semibold">{contract.number ? `№ ${contract.number}` : 'Номер не указан'}</div>
          <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {showFinances ? <>Сумма без НДС: {formatMoney(finances.contractAmount)} · </> : null}
            {Math.max(0, contract.filesCount)} файл(а)
          </div>
        </FactCard>
      </div>

      {showTeam && <TeamMemberLedger
        projectId={projectId}
        members={team.members}
        showHours={showHours}
        bonusEmployees={showBonuses && bonuses ? bonuses.employees : undefined}
        bonusesEditable={Boolean(showBonuses && bonuses?.editable)}
        registryState={showBonuses && bonuses ? bonuses.registryState || 'ready' : 'ready'}
        onAmountCommit={showBonuses ? onEmployeeAmountCommit : undefined}
        onResetFormula={showBonuses ? onResetEmployeeFormula : undefined}
      />}

      {showFinances && <section className="min-w-0 border-t px-3 py-3 sm:px-4" aria-label="Финансовый поток проекта" data-testid="project-finance-flow">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BriefcaseBusiness className="h-4 w-4" /> Как складывается доход</div>
        <div className={`grid min-w-0 grid-cols-2 gap-2 ${showBonuses ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          <FlowValue index="1" label="Договор" value={finances.contractAmount} />
          <FlowValue index="2" label="Минус ГПХ" value={finances.gphAmount} negative />
          <FlowValue index="3" label="Минус предрасход" value={finances.preExpenseAmount} negative />
          {showBonuses ? (
            <>
              <FlowValue index="4" label="Минус бонусы" value={finances.allocatedBonusAmount} negative />
              <FlowValue index="5" label="Грязный доход" value={finances.grossIncome} result />
            </>
          ) : (
            <FlowValue
              index="4"
              label="Остаток до бонусов"
              value={safePositive(finances.contractAmount) - safePositive(finances.gphAmount) - safePositive(finances.preExpenseAmount)}
              result
            />
          )}
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground" aria-hidden="true">
          <span>Договор</span><ArrowRight className="h-3 w-3 shrink-0" /><span>Расходы</span><ArrowRight className="h-3 w-3 shrink-0" /><span className="truncate">{showBonuses ? 'Итоговый доход' : 'До распределения бонусов'}</span>
        </div>
      </section>}

      {showBonuses && bonuses && (
        <BonusEditor
          projectId={projectId}
          projectName={name}
          finances={finances}
          bonuses={bonuses}
          onPoolAmountCommit={onPoolAmountCommit}
          onPoolPercentCommit={onPoolPercentCommit}
          onResetPoolFormula={onResetPoolFormula}
        />
      )}

      {advancedOpen && advancedContent && (
        <div className="min-w-0 max-w-full border-t bg-muted/10 px-3 py-3 sm:px-4" data-testid="project-advanced-content">
          {advancedContent}
        </div>
      )}
    </Root>
  );
}

function FactCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-background p-3 sm:p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function FlowValue({
  index,
  label,
  value,
  negative = false,
  result = false,
}: {
  index: string;
  label: string;
  value: number | null;
  negative?: boolean;
  result?: boolean;
}) {
  const negativeIncome = result && typeof value === 'number' && value < 0;
  return (
    <div className={`min-w-0 rounded-md border p-2.5 ${result ? 'col-span-2 border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20 sm:col-span-1' : 'bg-background'}`}>
      <div className="flex items-center gap-1 text-[10px] leading-4 text-muted-foreground"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground">{index}</span>{label}</div>
      <div className={`mt-1 break-words text-sm font-semibold tabular-nums ${negativeIncome ? 'text-red-700 dark:text-red-300' : result ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
        {negative && value !== null ? '− ' : ''}{formatMoney(value)}
      </div>
    </div>
  );
}

function BonusEditor({
  projectId,
  projectName,
  finances,
  bonuses,
  onPoolAmountCommit,
  onPoolPercentCommit,
  onResetPoolFormula,
}: {
  projectId: string;
  projectName: string;
  finances: ProjectInlineFinances;
  bonuses: ProjectInlineBonuses;
  onPoolAmountCommit?: (amount: number) => Promise<boolean>;
  onPoolPercentCommit?: (percent: number) => Promise<boolean>;
  onResetPoolFormula?: () => Promise<boolean>;
}) {
  const pool = safePositive(bonuses.poolAmount);
  const allocated = safePositive(finances.allocatedBonusAmount);
  const remainder = pool - allocated;
  const allocationPercent = safePercent(allocated, pool);
  const overallocated = allocated > pool;
  const registryState = bonuses.registryState || 'ready';
  const editable = Boolean(bonuses.editable);
  const [percentBusy, setPercentBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const commitPercent = async (nextPercent: number) => {
    if (!editable || !onPoolPercentCommit || percentBusy) return;
    setPercentBusy(true);
    try {
      await onPoolPercentCommit(Math.max(0, nextPercent));
    } finally {
      setPercentBusy(false);
    }
  };

  const resetPool = async () => {
    if (!editable || !onResetPoolFormula || resetBusy) return;
    setResetBusy(true);
    try {
      await onResetPoolFormula();
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <section className="min-w-0 border-t bg-sky-50/30 px-3 py-3 dark:bg-sky-950/10 sm:px-4" aria-label="Бонусы команды" data-testid="project-bonus-editor">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold">Бонусы проекта</h4>
            <Badge variant="outline" className={bonuses.manuallyAdjusted ? toneClasses.warning : toneClasses.info}>
              {bonuses.manuallyAdjusted ? 'Пул задан вручную' : 'Пул по формуле'}
            </Badge>
            {!editable && <Badge variant="outline" className={toneClasses.neutral}>Только просмотр</Badge>}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {editable
              ? 'Пул и суммы каждого сотрудника меняются прямо здесь. Реальная выплата подтверждается платёжным реестром.'
              : 'Точный пул, распределение и выплаты показаны без права изменения. Редактирование выполняет генеральный директор.'}
          </p>
        </div>
        {bonuses.lockedReason && (
          <div className="max-w-full rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 sm:max-w-sm">
            {bonuses.lockedReason}
          </div>
        )}
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <BonusFact label="Бонусный пул" value={formatMoney(pool)} />
        <BonusFact label="Итого бонусов" value={formatMoney(allocated)} />
        <BonusFact label={overallocated ? 'Сверх пула' : 'Остаток'} value={formatMoney(Math.abs(remainder))} tone={overallocated ? 'danger' : remainder > 0 ? 'warning' : 'positive'} />
        <BonusFact
          label="Статус выплаты"
          value={registryState === 'loading'
            ? 'Сверяется…'
            : registryState === 'error'
              ? 'Нет данных'
              : safePositive(bonuses.pendingAmount) > 0
                ? `В реестре ждёт ${formatMoney(bonuses.pendingAmount)} · к выплате ${formatMoney(bonuses.approvedForPayment)} · выплачено ${formatMoney(bonuses.paidAmount)}`
                : `К выплате ${formatMoney(bonuses.approvedForPayment)} · выплачено ${formatMoney(bonuses.paidAmount)}`}
          tone={registryState === 'error' ? 'danger' : safePositive(bonuses.paidAmount) > 0 ? 'positive' : 'neutral'}
          compact
        />
      </div>

      <div className="mt-2" data-testid="project-bonus-allocation-bar">
        <div className="flex min-w-0 items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">Заполнение пула</span>
          <span className={`shrink-0 font-semibold tabular-nums ${overallocated ? 'text-red-700 dark:text-red-300' : ''}`}>{pool > 0 ? `${((allocated / pool) * 100).toFixed(0)}%` : allocated > 0 ? 'сверх пула' : '0%'}</span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted" aria-label={`Распределено ${formatMoney(allocated)} из ${formatMoney(pool)}`}>
          {allocated > 0 && <div className={`h-full rounded-full ${overallocated ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${allocationPercent}%` }} />}
        </div>
      </div>

      {editable && <div className="mt-3 rounded-lg border bg-background p-3" data-testid={`project-bonus-pool-${projectId}`}>
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 text-xs font-medium">Сумма бонусного пула</div>
            <MoneyStepper
              value={pool}
              step={50_000}
              disabled={!editable || !onPoolAmountCommit}
              disabledReason={bonuses.lockedReason || undefined}
              onCommit={onPoolAmountCommit}
              label={`бонусный пул ${projectName}`}
              testIdPrefix="project-bonus-pool"
            />
          </div>
          <div className="min-w-0 lg:w-[260px]">
            <div className="mb-1.5 text-xs font-medium">{bonuses.manuallyAdjusted ? 'Процент по формуле (не активен)' : 'Процент от базы'}</div>
            <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] gap-2" title={bonuses.manuallyAdjusted ? 'Сначала нажмите «Вернуть по формуле»' : undefined}>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10" disabled={!editable || !onPoolPercentCommit || percentBusy || bonuses.manuallyAdjusted} onClick={() => void commitPercent(bonuses.poolPercent - 1)} aria-label="Уменьшить процент бонусного пула" data-testid="project-bonus-percent-minus"><Minus className="h-4 w-4" /></Button>
              <div className="flex h-10 min-w-0 items-center justify-center rounded-md border bg-muted/20 text-base font-semibold tabular-nums" data-testid="project-bonus-percent">{bonuses.poolPercent.toFixed(1)}%</div>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10" disabled={!editable || !onPoolPercentCommit || percentBusy || bonuses.manuallyAdjusted} onClick={() => void commitPercent(bonuses.poolPercent + 1)} aria-label="Увеличить процент бонусного пула" data-testid="project-bonus-percent-plus"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{bonuses.formulaPoolAmount == null ? 'Формульная сумма не рассчитана' : `По формуле: ${formatMoney(bonuses.formulaPoolAmount)}`}</span>
          <Button type="button" variant="ghost" size="sm" className="h-10 max-w-full whitespace-normal px-2 text-xs" disabled={!editable || !onResetPoolFormula || resetBusy} onClick={() => void resetPool()} data-testid="project-bonus-pool-reset"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Вернуть по формуле</Button>
        </div>
      </div>}

    </section>
  );
}

function BonusFact({
  label,
  value,
  tone = 'neutral',
  compact = false,
}: {
  label: string;
  value: string;
  tone?: ProjectInlineTone;
  compact?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-2.5 ${toneClasses[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className={`mt-1 break-words font-semibold tabular-nums ${compact ? 'text-xs leading-4' : 'text-sm'}`}>{value}</div>
    </div>
  );
}

function TeamMemberLedger({
  projectId,
  members,
  showHours,
  bonusEmployees,
  bonusesEditable,
  registryState,
  onAmountCommit,
  onResetFormula,
}: {
  projectId: string;
  members: ProjectInlineTeamMember[];
  showHours: boolean;
  bonusEmployees?: ProjectInlineBonusEmployee[];
  bonusesEditable: boolean;
  registryState: ProjectInlineDataState;
  onAmountCommit?: (employeeId: string, amount: number) => Promise<boolean>;
  onResetFormula?: (employeeId: string) => Promise<boolean>;
}) {
  const bonusesVisible = Array.isArray(bonusEmployees);
  const activeMembers = dedupeTeamMembers(members);
  const activeIds = new Set(activeMembers.map((member) => member.id));
  const bonusesById = new Map((bonusEmployees || []).map((employee) => [employee.id, employee]));
  const visibleBonusRows = bonusesVisible
    ? [
        ...activeMembers.map((member) => mergeMemberBonus(member, bonusesById.get(member.id))),
        ...(bonusEmployees || []).filter((employee) => !activeIds.has(employee.id)),
      ]
    : [];
  const visibleCount = bonusesVisible ? visibleBonusRows.length : activeMembers.length;
  const headerGridColumns = bonusesVisible
    ? showHours
      ? 'grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.55fr)_minmax(0,1.6fr)]'
      : 'grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1.6fr)]'
    : showHours
      ? 'grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.65fr)]'
      : 'grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]';

  return (
    <section
      className="min-w-0 border-t bg-background"
      aria-label={bonusesVisible ? 'Команда и бонусы проекта' : 'Состав команды проекта'}
      data-testid="project-team-ledger"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{bonusesVisible ? 'Команда и бонусы' : 'Состав команды'}</h4>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {activeMembers.length} чел.{visibleCount > activeMembers.length ? ` · ещё ${visibleCount - activeMembers.length} из сохранённого расчёта` : ''}
        </span>
      </div>

      <div
        className={`hidden min-w-0 border-y bg-muted/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-4 lg:grid ${headerGridColumns} gap-3`}
        aria-hidden="true"
      >
        <span>Сотрудник</span>
        <span>Роль в проекте</span>
        {showHours && <span>Утверждено</span>}
        {bonusesVisible && <span>Точный бонус</span>}
      </div>

      {visibleCount === 0 ? (
        <div className="border-t border-dashed px-3 py-4 text-sm text-muted-foreground sm:px-4">
          Команда ещё не назначена.
        </div>
      ) : bonusesVisible ? (
        <div className="min-w-0" aria-label="Бонусы сотрудников">
          {visibleBonusRows.map((employee) => (
            <EmployeeBonusRow
              key={employee.id}
              projectId={projectId}
              employee={employee}
              globallyEditable={bonusesEditable}
              registryState={registryState}
              showHours={showHours}
              onAmountCommit={onAmountCommit}
              onResetFormula={onResetFormula}
            />
          ))}
        </div>
      ) : (
        <div className="min-w-0">
          {activeMembers.map((member) => (
            <TeamMemberRow key={member.id} projectId={projectId} member={member} showHours={showHours} />
          ))}
        </div>
      )}
    </section>
  );
}

function dedupeTeamMembers(members: ProjectInlineTeamMember[]): ProjectInlineTeamMember[] {
  const result = new Map<string, ProjectInlineTeamMember>();
  for (const member of Array.isArray(members) ? members : []) {
    const id = String(member?.id || '').trim();
    const name = String(member?.name || '').trim();
    const identity = id || name.toLocaleLowerCase('ru');
    if (!identity) continue;
    const existing = result.get(identity);
    if (!existing) {
      result.set(identity, {
        ...member,
        id: id || identity,
        name: name || 'Без имени',
        roles: Array.from(new Set(member.roles || [])),
      });
      continue;
    }
    result.set(identity, {
      ...existing,
      roles: Array.from(new Set([...(existing.roles || []), ...(member.roles || [])])),
      approvedHours: Math.max(safePositive(existing.approvedHours), safePositive(member.approvedHours)),
      pendingHours: Math.max(safePositive(existing.pendingHours), safePositive(member.pendingHours)),
    });
  }
  return Array.from(result.values());
}

function mergeMemberBonus(
  member: ProjectInlineTeamMember,
  employee?: ProjectInlineBonusEmployee,
): ProjectInlineBonusEmployee {
  if (!employee) {
    return {
      ...member,
      amount: 0,
      editable: false,
      lockedReason: 'Расчёт бонуса для сотрудника не загружен.',
    };
  }
  return {
    ...employee,
    name: member.name || employee.name,
    roles: Array.from(new Set([...(member.roles || []), ...(employee.roles || [])])),
    approvedHours: safePositive(member.approvedHours),
    pendingHours: safePositive(member.pendingHours),
  };
}

function TeamMemberRow({
  projectId,
  member,
  showHours,
}: {
  projectId: string;
  member: ProjectInlineTeamMember;
  showHours: boolean;
}) {
  return (
    <div
      className={`grid min-w-0 gap-2 border-b px-3 py-2.5 last:border-b-0 sm:px-4 lg:items-center lg:gap-3 ${showHours ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.65fr)]' : 'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]'}`}
      data-testid={`project-team-member-${projectId}-${member.id}`}
      data-team-member-row="true"
      data-employee-id={member.id}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Сотрудник</div>
        <div className="break-words text-sm font-semibold leading-5">{member.name}</div>
      </div>
      <MemberRoles roles={member.roles} />
      {showHours && <MemberHours approved={member.approvedHours} pending={member.pendingHours} />}
    </div>
  );
}

function MemberRoles({ roles }: { roles: string[] }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Роль в проекте</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap gap-1 lg:mt-0">
        {(roles || []).map((role) => (
          <Badge key={role} variant="outline" className="max-w-full whitespace-normal text-[10px]">{role}</Badge>
        ))}
        {(roles || []).length === 0 && <span className="text-xs text-muted-foreground">Роль не указана</span>}
      </div>
    </div>
  );
}

function MemberHours({ approved, pending }: { approved: number; pending: number }) {
  return (
    <div className="min-w-0 tabular-nums">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Утверждено</div>
      <div className="text-sm font-semibold">{safePositive(approved).toFixed(1)} ч</div>
      {safePositive(pending) > 0 && <div className="text-[10px] leading-4 text-amber-700 dark:text-amber-300">{safePositive(pending).toFixed(1)} ч ждёт</div>}
    </div>
  );
}

function EmployeeBonusRow({
  projectId,
  employee,
  globallyEditable,
  registryState,
  showHours,
  onAmountCommit,
  onResetFormula,
}: {
  projectId: string;
  employee: ProjectInlineBonusEmployee;
  globallyEditable: boolean;
  registryState: ProjectInlineDataState;
  showHours: boolean;
  onAmountCommit?: (employeeId: string, amount: number) => Promise<boolean>;
  onResetFormula?: (employeeId: string) => Promise<boolean>;
}) {
  const editable = globallyEditable && employee.editable !== false;
  const [resetBusy, setResetBusy] = useState(false);

  const resetFormula = async () => {
    if (!editable || !onResetFormula || resetBusy) return;
    setResetBusy(true);
    try {
      await onResetFormula(employee.id);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div
      className={`grid min-w-0 gap-2 border-b px-3 py-2.5 last:border-b-0 sm:px-4 lg:items-center lg:gap-3 ${showHours ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.55fr)_minmax(0,1.6fr)]' : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1.6fr)]'}`}
      data-testid={`member-bonus-${projectId}-${employee.id}`}
      data-team-member-row="true"
      data-employee-id={employee.id}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Сотрудник</div>
        <div className="break-words text-sm font-semibold leading-5">{employee.name}</div>
        <div className="mt-1">
          <PaymentStatus employee={employee} registryState={registryState} />
        </div>
      </div>
      <MemberRoles roles={employee.roles} />
      {showHours && <MemberHours approved={employee.approvedHours} pending={employee.pendingHours} />}
      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-1 text-[10px]">
          <span className="font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Точный бонус</span>
          <Badge variant="outline" className={employee.manuallyAdjusted ? toneClasses.warning : toneClasses.info}>{employee.manuallyAdjusted ? 'вручную' : 'по формуле'}</Badge>
        </div>
      {editable ? <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-1 text-xs">
            <span className="font-medium">Итоговый бонус</span>
            {employee.percent != null && <span className="text-muted-foreground tabular-nums">{employee.percent.toFixed(1)}% от пула</span>}
          </div>
          <MoneyStepper
            value={safePositive(employee.amount)}
            step={10_000}
            disabled={!editable || !onAmountCommit}
            disabledReason={employee.lockedReason || undefined}
            onCommit={onAmountCommit ? (amount) => onAmountCommit(employee.id, amount) : undefined}
            label={`бонус ${employee.name}`}
            testIdPrefix={`employee-bonus-${employee.id}`}
          />
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-10 w-full whitespace-normal px-2 text-xs sm:w-auto" disabled={!editable || !onResetFormula || resetBusy} onClick={() => void resetFormula()} data-testid={`employee-bonus-reset-${employee.id}`}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />По формуле</Button>
      </div> : (
        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2" data-testid={`employee-bonus-readonly-${employee.id}`}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium">Итоговый бонус</span>
            <span className="text-base font-semibold tabular-nums">{formatMoney(safePositive(employee.amount))}</span>
          </div>
          {employee.percent != null && <div className="mt-0.5 text-right text-[11px] text-muted-foreground tabular-nums">{employee.percent.toFixed(1)}% от пула</div>}
        </div>
      )}
      {employee.lockedReason && globallyEditable && <div className="mt-2 text-[11px] leading-4 text-amber-800 dark:text-amber-200">{employee.lockedReason}</div>}
      </div>
    </div>
  );
}

function PaymentStatus({ employee, registryState }: { employee: ProjectInlineBonusEmployee; registryState: ProjectInlineDataState }) {
  if (registryState === 'loading') return <Badge variant="outline" className="self-start text-[10px]">Реестр загружается</Badge>;
  if (registryState === 'error') return <Badge variant="outline" className={`${toneClasses.danger} self-start text-[10px]`}>Статус выплаты недоступен</Badge>;
  const paid = safePositive(employee.paidAmount);
  const approved = safePositive(employee.approvedForPayment);
  const pending = safePositive(employee.pendingAmount);
  if (paid > 0 || approved > 0 || pending > 0) {
    return (
      <div className="flex max-w-full flex-wrap gap-1 sm:justify-end">
        {pending > 0 && <Badge variant="outline" className={`${toneClasses.info} whitespace-normal text-[10px]`}>Ждёт утверждения {formatMoney(pending)}</Badge>}
        {approved > 0 && <Badge variant="outline" className={`${toneClasses.warning} whitespace-normal text-[10px]`}>К выплате {formatMoney(approved)}</Badge>}
        {paid > 0 && <Badge variant="outline" className={`${toneClasses.positive} whitespace-normal text-[10px]`}>Выплачено {formatMoney(paid)}</Badge>}
      </div>
    );
  }
  return <Badge variant="outline" className="self-start text-[10px] text-muted-foreground">Не в реестре</Badge>;
}

function MoneyStepper({
  value,
  step,
  disabled,
  disabledReason,
  onCommit,
  label,
  testIdPrefix,
}: {
  value: number;
  step: number;
  disabled: boolean;
  disabledReason?: string;
  onCommit?: (amount: number) => Promise<boolean>;
  label: string;
  testIdPrefix: string;
}) {
  const normalizedValue = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  const [draft, setDraft] = useState(String(normalizedValue));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const skipNextBlurRef = useRef(false);

  useEffect(() => {
    if (!busy) setDraft(String(normalizedValue));
  }, [normalizedValue, busy]);

  const commit = async (nextAmount: number) => {
    const normalizedAmount = Math.max(0, Math.round(nextAmount));
    if (!onCommit || disabled || busyRef.current) return;
    setDraft(String(normalizedAmount));
    if (normalizedAmount === normalizedValue) return;
    busyRef.current = true;
    setBusy(true);
    let accepted = false;
    try {
      accepted = await onCommit(normalizedAmount);
    } catch {
      accepted = false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (!accepted) setDraft(String(normalizedValue));
  };

  const commitDraft = () => {
    if (skipNextBlurRef.current) return;
    const parsed = inputNumber(draft);
    if (parsed === null) {
      setDraft(String(normalizedValue));
      return;
    }
    void commit(parsed);
  };

  const draftValue = inputNumber(draft) ?? normalizedValue;
  const controlsDisabled = disabled || busy || !onCommit;
  const keepDraftForStepClick = () => {
    skipNextBlurRef.current = true;
    window.setTimeout(() => { skipNextBlurRef.current = false; }, 0);
  };

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] gap-2" title={disabledReason}>
      <Button type="button" variant="outline" size="icon" className="h-10 w-10" disabled={controlsDisabled} onPointerDown={keepDraftForStepClick} onClick={() => void commit(Math.max(0, draftValue - step))} aria-label={`Уменьшить ${label} на ${moneyFormatter.format(step)} тенге`} data-testid={`${testIdPrefix}-minus`}><Minus className="h-4 w-4" /></Button>
      <Input
        className="h-10 min-w-0 w-full px-2 text-center text-sm font-semibold tabular-nums"
        inputMode="numeric"
        aria-label={`${label} в тенге`}
        value={draft}
        disabled={controlsDisabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(normalizedValue));
            event.currentTarget.blur();
          }
        }}
        data-testid={`${testIdPrefix}-input`}
      />
      <Button type="button" variant="outline" size="icon" className="h-10 w-10" disabled={controlsDisabled} onPointerDown={keepDraftForStepClick} onClick={() => void commit(draftValue + step)} aria-label={`Увеличить ${label} на ${moneyFormatter.format(step)} тенге`} data-testid={`${testIdPrefix}-plus`}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}
