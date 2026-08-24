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
  /** The director assigned to the project's executor company in the company catalog. */
  companyDirectorName?: string | null;
  /** Stable employee identities keep the partner and project leader at the top of the CEO ledger. */
  partnerEmployeeId?: string | null;
  leaderEmployeeId?: string | null;
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
  onEmployeePercentCommit?: (employeeId: string, percent: number) => Promise<boolean>;
  onResetEmployeeFormula?: (employeeId: string) => Promise<boolean>;
  /** Render directly inside a command-center table row, without a nested card shell. */
  embedded?: boolean;
  /** Role-aware controls supplied by the command center (team, status, dates). */
  managementControls?: ReactNode;
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

function formatMoneyInput(value: number): string {
  return moneyFormatter.format(Math.max(0, Math.round(value))).replace(/\u00a0/g, ' ');
}

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
  onEmployeePercentCommit,
  embedded = false,
  managementControls,
}: ProjectInlineDetailProps) {
  const approvedHours = safePositive(hours.approved);
  const pendingHours = safePositive(hours.pending);
  const totalHours = approvedHours + pendingHours;
  const approvedWidth = safePercent(approvedHours, totalHours);
  const pendingWidth = totalHours > 0 ? Math.max(0, 100 - approvedWidth) : 0;
  const Root = embedded ? 'div' : Card;
  const showTeamFact = showTeam && !showBonuses;
  const visibleFactCount = 2 + Number(showTeamFact) + Number(showHours);
  const factGridColumns = visibleFactCount >= 4
    ? 'lg:grid-cols-4'
    : visibleFactCount === 3
      ? 'lg:grid-cols-3'
      : 'lg:grid-cols-2';

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
      {!showBonuses && <div className="flex min-w-0 flex-col gap-3 border-b bg-gradient-to-r from-background to-sky-50/60 px-3 py-3 dark:to-sky-950/20 sm:px-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold leading-snug sm:text-lg">{name}</h3>
            <Badge variant="outline" className={toneClasses[statusTone]}>{statusLabel}</Badge>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
            {[
              client ? `Клиент: ${client}` : '',
              company ? `Наша компания: ${company}` : '',
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
      </div>}

      {managementControls && !showBonuses && (
        <section className="min-w-0 border-b bg-background px-3 py-3 sm:px-4" aria-label="Управление проектом">
          {managementControls}
        </section>
      )}

      {showBonuses && bonuses && (
        <CeoProjectIdentityLine
          client={client}
          company={company}
          companyDirectorName={bonuses.companyDirectorName}
        />
      )}

      {showBonuses && bonuses && (
        <div className="min-w-0 border-b" data-testid="project-executive-ledger">
          <CeoBonusLedger
            projectId={projectId}
            projectName={name}
            finances={finances}
            bonuses={bonuses}
            showHours={showHours}
            onPoolAmountCommit={onPoolAmountCommit}
            onPoolPercentCommit={onPoolPercentCommit}
            onResetPoolFormula={onResetPoolFormula}
            onEmployeePercentCommit={onEmployeePercentCommit}
          />
          {managementControls && (
            <details className="border-t bg-muted/10" data-testid="project-management-details">
              <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:px-4">
                Изменить состав, компанию и сроки
              </summary>
              <section className="min-w-0 border-t bg-background px-3 py-3 sm:px-4" aria-label="Управление проектом">
                {managementControls}
              </section>
            </details>
          )}
        </div>
      )}

      {showBonuses ? <CeoProjectMetaDetails
        projectId={projectId}
        deadline={deadline}
        hours={hours}
        contract={contract}
        finances={finances}
        showHours={showHours}
        showFinances={showFinances}
      /> : <div className={`grid min-w-0 grid-cols-1 gap-px bg-border sm:grid-cols-2 ${factGridColumns}`} data-testid="project-inline-facts">
        {showTeamFact && <FactCard icon={<Users className="h-4 w-4" />} label="Команда">
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
      </div>}

      {showFinances && !showBonuses && <section className="min-w-0 border-t px-3 py-3 sm:px-4" aria-label="Финансовый поток проекта" data-testid="project-finance-flow">
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

      {!showBonuses && showTeam && <TeamMemberLedger
        projectId={projectId}
        members={team.members}
        showHours={showHours}
        bonusesEditable={false}
        registryState="ready"
      />}

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

function CeoProjectMetaDetails({
  projectId,
  deadline,
  hours,
  contract,
  finances,
  showHours,
  showFinances,
}: {
  projectId: string;
  deadline: ProjectInlineDeadlineSummary;
  hours: ProjectInlineHoursSummary;
  contract: ProjectInlineContractSummary;
  finances: ProjectInlineFinances;
  showHours: boolean;
  showFinances: boolean;
}) {
  const approvedHours = safePositive(hours.approved);
  const pendingHours = safePositive(hours.pending);
  const totalHours = approvedHours + pendingHours;
  const approvedWidth = safePercent(approvedHours, totalHours);
  const pendingWidth = totalHours > 0 ? Math.max(0, 100 - approvedWidth) : 0;

  return (
    <details className="min-w-0 border-t bg-background" data-testid="project-meta-details">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium hover:bg-muted/30 sm:px-4">
        <span>Сроки, часы и договор</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">Открыть <ChevronDown className="h-4 w-4" /></span>
      </summary>
      <div className={`grid min-w-0 grid-cols-1 gap-px border-t bg-border sm:grid-cols-2 ${showHours ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
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
          <Button asChild type="button" variant="link" size="sm" className="mt-1 h-auto px-0 py-0 text-xs">
            <Link to={`/project/${projectId}`}>Файлы и договор <ExternalLink className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </FactCard>
      </div>
    </details>
  );
}

function CeoProjectIdentityLine({
  client,
  company,
  companyDirectorName,
}: {
  client?: string | null;
  company?: string | null;
  companyDirectorName?: string | null;
}) {
  return (
    <section
      className="grid min-w-0 gap-px border-b bg-border md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
      aria-label="Клиент, наша компания и директор"
      data-testid="ceo-project-identity"
    >
      <LedgerIdentityCell label="Клиент" value={client || 'Не указан'} />
      <LedgerIdentityCell label="Наша компания" value={company || 'Не указана'} />
      <LedgerIdentityCell label="Директор компании" value={companyDirectorName || 'Не назначен'} />
    </section>
  );
}

function LedgerIdentityCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 bg-background px-3 py-2 text-xs sm:px-4">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words text-sm font-semibold leading-5">{value}</span>
    </div>
  );
}

function CeoBonusLedger({
  projectId,
  projectName,
  finances,
  bonuses,
  showHours,
  onPoolAmountCommit,
  onPoolPercentCommit,
  onResetPoolFormula,
  onEmployeePercentCommit,
}: {
  projectId: string;
  projectName: string;
  finances: ProjectInlineFinances;
  bonuses: ProjectInlineBonuses;
  showHours: boolean;
  onPoolAmountCommit?: (amount: number) => Promise<boolean>;
  onPoolPercentCommit?: (percent: number) => Promise<boolean>;
  onResetPoolFormula?: () => Promise<boolean>;
  onEmployeePercentCommit?: (employeeId: string, percent: number) => Promise<boolean>;
}) {
  const employees = Array.isArray(bonuses.employees) ? bonuses.employees : [];
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const partner = bonuses.partnerEmployeeId
    ? byId.get(bonuses.partnerEmployeeId)
    : employees.find((employee) => employee.roles.some(isPartnerLabel));
  const leader = bonuses.leaderEmployeeId
    ? byId.get(bonuses.leaderEmployeeId)
    : employees.find((employee) => employee.roles.some(isLeaderLabel));
  const primaryIds = new Set([partner?.id, leader?.id].filter(Boolean));
  const teamEmployees = employees.filter((employee) => !primaryIds.has(employee.id));
  const partnerAndLeaderAreSame = Boolean(partner && leader && partner.id === leader.id);

  return (
    <section className="min-w-0 bg-background" aria-label="Ведомость бонусов и команда" data-testid="project-bonus-editor">
      <BonusEditor
        projectId={projectId}
        projectName={projectName}
        finances={finances}
        bonuses={bonuses}
        onPoolAmountCommit={onPoolAmountCommit}
        onPoolPercentCommit={onPoolPercentCommit}
        onResetPoolFormula={onResetPoolFormula}
      />

      {bonuses.lockedReason && (
        <div className="mx-3 my-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs leading-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 sm:mx-4">
          {bonuses.lockedReason}
        </div>
      )}

      <section className="min-w-0" data-testid="project-team-ledger" aria-label="Команда и бонусы проекта">
        <CeoBonusLedgerHeader />
        <div className="min-w-0">
          <CeoBonusAllocationRow
            projectId={projectId}
            label={partnerAndLeaderAreSame ? 'Партнер и руководитель' : 'Партнер'}
            employee={partner}
            poolAmount={bonuses.poolAmount}
            showHours={showHours}
            editable={Boolean(bonuses.editable)}
            registryState={bonuses.registryState || 'ready'}
            onPercentCommit={onEmployeePercentCommit}
          />
          {!partnerAndLeaderAreSame && <CeoBonusAllocationRow
            projectId={projectId}
            label="Руководитель"
            employee={leader}
            poolAmount={bonuses.poolAmount}
            showHours={showHours}
            editable={Boolean(bonuses.editable)}
            registryState={bonuses.registryState || 'ready'}
            onPercentCommit={onEmployeePercentCommit}
          />}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 border-y bg-muted/20 px-3 py-1.5 sm:px-4">
          <div className="text-xs font-semibold">Команда</div>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{teamEmployees.length} чел.</span>
        </div>
        {teamEmployees.length === 0 ? (
          <div className="border-b px-3 py-2 text-sm text-muted-foreground sm:px-4">Другие участники команды не назначены.</div>
        ) : teamEmployees.map((employee) => (
          <CeoBonusAllocationRow
            key={employee.id}
            projectId={projectId}
            label={employee.roles.join(' · ') || 'Участник команды'}
            employee={employee}
            poolAmount={bonuses.poolAmount}
            showHours={showHours}
            editable={Boolean(bonuses.editable)}
            registryState={bonuses.registryState || 'ready'}
            onPercentCommit={onEmployeePercentCommit}
          />
        ))}
      </section>
    </section>
  );
}

function CeoBonusLedgerHeader() {
  return (
    <div className="hidden min-w-0 grid-cols-[minmax(105px,0.7fr)_minmax(180px,1.55fr)_92px_minmax(130px,0.8fr)] gap-3 border-b bg-muted/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid sm:px-4">
      <span>Роль</span>
      <span>Сотрудник</span>
      <span>Процент</span>
      <span className="text-right">Сумма бонуса</span>
    </div>
  );
}

function isPartnerLabel(value: string): boolean {
  return /партн|partner/i.test(value || '');
}

function isLeaderLabel(value: string): boolean {
  return /руковод|leader|директор проекта/i.test(value || '');
}

function normalizedPercent(value: number | null | undefined): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? Number(value) : 0));
}

function parsePercentInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function CeoBonusAllocationRow({
  projectId,
  label,
  employee,
  poolAmount,
  showHours,
  editable,
  registryState,
  onPercentCommit,
}: {
  projectId: string;
  label: string;
  employee?: ProjectInlineBonusEmployee;
  poolAmount: number;
  showHours: boolean;
  editable: boolean;
  registryState: ProjectInlineDataState;
  onPercentCommit?: (employeeId: string, percent: number) => Promise<boolean>;
}) {
  const savedPercent = normalizedPercent(employee?.percent);
  const [draftPercent, setDraftPercent] = useState(savedPercent.toFixed(1));
  const [saving, setSaving] = useState(false);
  const savedPercentRef = useRef(savedPercent);
  savedPercentRef.current = savedPercent;

  useEffect(() => {
    if (!saving) setDraftPercent(savedPercent.toFixed(1));
  }, [savedPercent, saving]);

  const previewPercent = parsePercentInput(draftPercent) ?? savedPercent;
  const previewAmount = Math.max(0, safePositive(poolAmount) * (previewPercent / 100));
  const rowEditable = Boolean(employee && editable && employee.editable !== false && onPercentCommit);

  const commitPercent = async () => {
    const nextPercent = parsePercentInput(draftPercent);
    if (!employee || !rowEditable || saving) return;
    if (nextPercent === null) {
      setDraftPercent(savedPercentRef.current.toFixed(1));
      return;
    }
    const normalized = Number(nextPercent.toFixed(2));
    if (Math.abs(normalized - savedPercentRef.current) < 0.001) {
      setDraftPercent(savedPercentRef.current.toFixed(1));
      return;
    }
    setSaving(true);
    let accepted = false;
    try {
      accepted = await onPercentCommit!(employee.id, normalized);
    } catch {
      accepted = false;
    } finally {
      setSaving(false);
    }
    if (!accepted) setDraftPercent(savedPercentRef.current.toFixed(1));
  };

  if (!employee) {
    return (
      <div className="grid min-w-0 gap-1.5 border-b px-3 py-1.5 sm:px-4 xl:grid-cols-[minmax(105px,0.7fr)_minmax(180px,1.55fr)_92px_minmax(130px,0.8fr)] xl:items-center xl:gap-3" data-testid={`member-bonus-${projectId}-${label.toLocaleLowerCase('ru').replace(/\s+/g, '-')}`}>
        <div className="min-w-0 text-xs font-medium text-muted-foreground">{label}</div>
        <div className="min-w-0 text-sm text-muted-foreground">Не назначен</div>
        <div className="text-sm text-muted-foreground">—</div>
        <div className="text-sm text-muted-foreground lg:text-right">—</div>
      </div>
    );
  }

  return (
    <div
      className="grid min-w-0 gap-1.5 border-b px-3 py-1.5 last:border-b-0 sm:px-4 xl:grid-cols-[minmax(105px,0.7fr)_minmax(180px,1.55fr)_92px_minmax(130px,0.8fr)] xl:items-center xl:gap-3"
      data-testid={`member-bonus-${projectId}-${employee.id}`}
      data-team-member-row="true"
      data-employee-id={employee.id}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground xl:hidden">Роль</div>
        <div className="break-words text-xs font-medium leading-4 text-muted-foreground">{label}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground xl:hidden">Сотрудник</div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <div className="break-words text-sm font-semibold leading-5">{employee.name}</div>
          {showHours && <div className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{safePositive(employee.approvedHours).toFixed(1)} ч{safePositive(employee.pendingHours) > 0 ? ` · ${safePositive(employee.pendingHours).toFixed(1)} ждёт` : ''}</div>}
          <PaymentStatus employee={employee} registryState={registryState} compact showEmpty={false} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground xl:hidden">Процент</div>
        {rowEditable ? (
          <div className="relative min-w-0" title={employee.lockedReason || undefined}>
            <Input
              value={draftPercent}
              inputMode="decimal"
              className="h-10 w-full pr-7 text-right text-sm font-semibold tabular-nums xl:h-9"
              aria-label={`Процент бонуса ${employee.name}`}
              data-testid={`employee-bonus-percent-${employee.id}-input`}
              disabled={saving}
              onChange={(event) => setDraftPercent(event.target.value)}
              onBlur={() => void commitPercent()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setDraftPercent(savedPercentRef.current.toFixed(1));
                  event.currentTarget.blur();
                }
              }}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
          </div>
        ) : (
          <div className="pt-1 text-sm font-semibold tabular-nums">{savedPercent.toFixed(1)}%</div>
        )}
        {employee.lockedReason && editable && <div className="mt-1 text-[10px] leading-4 text-amber-800 dark:text-amber-200">{employee.lockedReason}</div>}
      </div>
      <div className="min-w-0 xl:text-right">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground xl:hidden">Сумма бонуса</div>
        {rowEditable ? (
          <Input
            readOnly
            tabIndex={-1}
            value={formatMoneyInput(previewAmount)}
            className="h-10 w-full cursor-default text-right text-sm font-semibold tabular-nums xl:ml-auto xl:h-9 xl:max-w-[150px]"
            aria-label={`Сумма бонуса ${employee.name}; рассчитывается по проценту`}
            data-testid={`employee-bonus-${employee.id}-input`}
          />
        ) : (
          <div className="pt-1 text-sm font-semibold tabular-nums" data-testid={`employee-bonus-${employee.id}-amount`}>{formatMoney(safePositive(employee.amount))}</div>
        )}
        {rowEditable && <div className="mt-0.5 text-[10px] text-muted-foreground">от пула</div>}
      </div>
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
  const overallocated = allocated > pool;
  const registryState = bonuses.registryState || 'ready';
  const editable = Boolean(bonuses.editable);
  const paymentSummary = registryState === 'loading'
    ? 'Выплаты сверяются…'
    : registryState === 'error'
      ? 'Статус выплат недоступен'
      : safePositive(bonuses.pendingAmount) > 0
        ? `В реестре ждёт ${formatMoney(bonuses.pendingAmount)} · к выплате ${formatMoney(bonuses.approvedForPayment)} · выплачено ${formatMoney(bonuses.paidAmount)}`
        : safePositive(bonuses.approvedForPayment) > 0 || safePositive(bonuses.paidAmount) > 0
          ? `К выплате ${formatMoney(bonuses.approvedForPayment)} · выплачено ${formatMoney(bonuses.paidAmount)}`
          : null;
  const [percentBusy, setPercentBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const commitPercent = async (nextPercent: number) => {
    if (!editable || !onPoolPercentCommit || percentBusy) return false;
    setPercentBusy(true);
    try {
      return await onPoolPercentCommit(Math.max(0, nextPercent));
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
    <details className="min-w-0 border-b bg-sky-50/30 dark:bg-sky-950/10" aria-label="Пул бонусов" data-testid="project-bonus-settings" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-1.5 hover:bg-sky-100/40 dark:hover:bg-sky-900/20 sm:px-4" data-testid="project-bonus-summary">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="shrink-0 text-xs font-semibold">Бонусы</span>
          <BonusFact label="Пул" value={formatMoney(pool)} />
          <BonusFact label="Распределено" value={formatMoney(allocated)} />
          <BonusFact
            label={overallocated ? 'Сверх пула' : 'Остаток'}
            value={formatMoney(Math.abs(remainder))}
            tone={overallocated ? 'danger' : remainder > 0 ? 'warning' : 'positive'}
          />
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">Настроить <ChevronDown className="h-4 w-4" /></span>
      </summary>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5" data-testid={editable ? `project-bonus-pool-${projectId}` : undefined}>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Бонусный пул</span>
          {editable ? (
            <div className="w-[220px] max-w-full">
              <MoneyStepper
                value={pool}
                step={50_000}
                disabled={!onPoolAmountCommit}
                disabledReason={bonuses.lockedReason || undefined}
                onCommit={onPoolAmountCommit}
                label={`бонусный пул ${projectName}`}
                testIdPrefix="project-bonus-pool"
                compact
              />
            </div>
          ) : <span className="text-sm font-semibold tabular-nums">{formatMoney(pool)}</span>}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">От базы</span>
          {editable ? (
            <div className="w-[146px] max-w-full">
              <PercentStepper
                value={bonuses.poolPercent}
                disabled={!onPoolPercentCommit || percentBusy || Boolean(bonuses.manuallyAdjusted)}
                disabledReason={bonuses.manuallyAdjusted ? 'Сначала нажмите «Вернуть по формуле»' : bonuses.lockedReason || undefined}
                onCommit={onPoolPercentCommit ? commitPercent : undefined}
                label="процент бонусного пула"
                testIdPrefix="project-bonus-percent"
                compact
              />
            </div>
          ) : <span className="text-sm font-semibold tabular-nums">{normalizedPercent(bonuses.poolPercent).toFixed(1)}%</span>}
        </div>
        <BonusFact label="Распределено" value={formatMoney(allocated)} />
        <BonusFact
          label={overallocated ? 'Сверх пула' : 'Остаток'}
          value={formatMoney(Math.abs(remainder))}
          tone={overallocated ? 'danger' : remainder > 0 ? 'warning' : 'positive'}
        />
        {bonuses.manuallyAdjusted && <span className="text-[11px] leading-4 text-muted-foreground">По формуле: {bonuses.formulaPoolAmount == null ? 'не рассчитано' : formatMoney(bonuses.formulaPoolAmount)}</span>}
        {paymentSummary && <span className="text-[11px] leading-4 text-muted-foreground">{paymentSummary}</span>}
        {editable && bonuses.manuallyAdjusted && <Button type="button" variant="ghost" size="sm" className="h-7 max-w-full whitespace-normal px-1.5 text-[11px]" disabled={!onResetPoolFormula || resetBusy} onClick={() => void resetPool()} data-testid="project-bonus-pool-reset"><RotateCcw className="mr-1 h-3.5 w-3.5" />Вернуть по формуле</Button>}
      </div>
    </details>
  );
}

function BonusFact({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: ProjectInlineTone;
}) {
  const valueTone = tone === 'danger'
    ? 'text-red-700 dark:text-red-300'
    : tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'warning'
        ? 'text-amber-800 dark:text-amber-200'
        : 'text-foreground';
  return (
    <div className="flex shrink-0 items-baseline gap-1 text-xs">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${valueTone}`}>{value}</span>
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
  onPercentCommit,
  onResetFormula,
}: {
  projectId: string;
  members: ProjectInlineTeamMember[];
  showHours: boolean;
  bonusEmployees?: ProjectInlineBonusEmployee[];
  bonusesEditable: boolean;
  registryState: ProjectInlineDataState;
  onAmountCommit?: (employeeId: string, amount: number) => Promise<boolean>;
  onPercentCommit?: (employeeId: string, percent: number) => Promise<boolean>;
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
        {bonusesVisible && <span>Процент и точная сумма бонуса</span>}
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
              onPercentCommit={onPercentCommit}
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
  onPercentCommit,
  onResetFormula,
}: {
  projectId: string;
  employee: ProjectInlineBonusEmployee;
  globallyEditable: boolean;
  registryState: ProjectInlineDataState;
  showHours: boolean;
  onAmountCommit?: (employeeId: string, amount: number) => Promise<boolean>;
  onPercentCommit?: (employeeId: string, percent: number) => Promise<boolean>;
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
          <span className="font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Процент и сумма бонуса</span>
          <Badge variant="outline" className={employee.manuallyAdjusted ? toneClasses.warning : toneClasses.info}>{employee.manuallyAdjusted ? 'вручную' : 'по формуле'}</Badge>
        </div>
      {editable ? <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(150px,0.75fr)_minmax(220px,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="mb-1.5 text-xs font-medium">Доля от пула</div>
          <PercentStepper
            value={safePositive(employee.percent)}
            disabled={!editable || !onPercentCommit}
            disabledReason={employee.lockedReason || undefined}
            onCommit={onPercentCommit ? (percent) => onPercentCommit(employee.id, percent) : undefined}
            label={`процент бонуса ${employee.name}`}
            testIdPrefix={`employee-bonus-percent-${employee.id}`}
          />
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-xs font-medium">Точная сумма</div>
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
        <Button type="button" variant="ghost" size="sm" className="h-10 w-full whitespace-normal px-2 text-xs xl:w-auto" disabled={!editable || !onResetFormula || resetBusy} onClick={() => void resetFormula()} data-testid={`employee-bonus-reset-${employee.id}`}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />По формуле</Button>
      </div> : (
        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2" data-testid={`employee-bonus-readonly-${employee.id}`}>
          <div className="grid min-w-0 grid-cols-2 items-end gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Доля от пула</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{employee.percent == null ? '—' : `${employee.percent.toFixed(1)}%`}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Точная сумма</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{formatMoney(safePositive(employee.amount))}</div>
            </div>
          </div>
        </div>
      )}
      {employee.lockedReason && globallyEditable && <div className="mt-2 text-[11px] leading-4 text-amber-800 dark:text-amber-200">{employee.lockedReason}</div>}
      </div>
    </div>
  );
}

function PaymentStatus({
  employee,
  registryState,
  compact = false,
  showEmpty = true,
}: {
  employee: ProjectInlineBonusEmployee;
  registryState: ProjectInlineDataState;
  compact?: boolean;
  showEmpty?: boolean;
}) {
  const className = compact ? 'self-start px-1.5 py-0 text-[9px] leading-4' : 'self-start text-[10px]';
  if (registryState === 'loading') return <Badge variant="outline" className={className}>Реестр загружается</Badge>;
  if (registryState === 'error') return <Badge variant="outline" className={`${toneClasses.danger} ${className}`}>Статус выплаты недоступен</Badge>;
  const paid = safePositive(employee.paidAmount);
  const approved = safePositive(employee.approvedForPayment);
  const pending = safePositive(employee.pendingAmount);
  if (paid > 0 || approved > 0 || pending > 0) {
    return (
      <div className="flex max-w-full flex-wrap gap-1 sm:justify-end">
        {pending > 0 && <Badge variant="outline" className={`${toneClasses.info} whitespace-normal ${compact ? 'px-1.5 py-0 text-[9px] leading-4' : 'text-[10px]'}`}>Ждёт утверждения {formatMoney(pending)}</Badge>}
        {approved > 0 && <Badge variant="outline" className={`${toneClasses.warning} whitespace-normal ${compact ? 'px-1.5 py-0 text-[9px] leading-4' : 'text-[10px]'}`}>К выплате {formatMoney(approved)}</Badge>}
        {paid > 0 && <Badge variant="outline" className={`${toneClasses.positive} whitespace-normal ${compact ? 'px-1.5 py-0 text-[9px] leading-4' : 'text-[10px]'}`}>Выплачено {formatMoney(paid)}</Badge>}
      </div>
    );
  }
  return showEmpty ? <Badge variant="outline" className={`${className} text-muted-foreground`}>Не в реестре</Badge> : null;
}

function PercentStepper({
  value,
  disabled,
  disabledReason,
  onCommit,
  label,
  testIdPrefix,
  compact = false,
}: {
  value: number;
  disabled: boolean;
  disabledReason?: string;
  onCommit?: (percent: number) => Promise<boolean>;
  label: string;
  testIdPrefix: string;
  compact?: boolean;
}) {
  const normalizedValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const [draft, setDraft] = useState(normalizedValue.toFixed(1));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const skipNextBlurRef = useRef(false);

  useEffect(() => {
    if (!busy) setDraft(normalizedValue.toFixed(1));
  }, [normalizedValue, busy]);

  const parsedDraft = (source = draft) => {
    const parsed = Number(source.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
  };

  const commit = async (nextPercent: number) => {
    const normalizedPercent = Number(Math.max(0, Math.min(100, nextPercent)).toFixed(2));
    if (!onCommit || disabled || busyRef.current) return;
    setDraft(normalizedPercent.toFixed(1));
    if (Math.abs(normalizedPercent - normalizedValue) < 0.001) return;
    busyRef.current = true;
    setBusy(true);
    let accepted = false;
    try {
      accepted = await onCommit(normalizedPercent);
    } catch {
      accepted = false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (!accepted) setDraft(normalizedValue.toFixed(1));
  };

  const commitDraft = (source?: string) => {
    if (skipNextBlurRef.current) return;
    const parsed = parsedDraft(source);
    if (parsed === null) {
      setDraft(normalizedValue.toFixed(1));
      return;
    }
    void commit(parsed);
  };

  const controlsDisabled = disabled || busy || !onCommit;
  const keepDraftForStepClick = () => {
    skipNextBlurRef.current = true;
    window.setTimeout(() => { skipNextBlurRef.current = false; }, 0);
  };

  return (
    <div className={`grid min-w-0 ${compact ? 'grid-cols-[2rem_minmax(0,1fr)_2rem] gap-1' : 'grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] gap-2'}`} title={disabledReason}>
      <Button type="button" variant="outline" size="icon" className={compact ? 'h-8 w-8' : 'h-10 w-10'} disabled={controlsDisabled} onPointerDown={keepDraftForStepClick} onClick={() => void commit((parsedDraft() ?? normalizedValue) - 1)} aria-label={`Уменьшить ${label} на 1 процент`} data-testid={`${testIdPrefix}-minus`}><Minus className="h-4 w-4" /></Button>
      <div className="relative min-w-0">
        <Input
          className={`${compact ? 'h-8' : 'h-10'} min-w-0 w-full px-2 pr-7 text-center text-sm font-semibold tabular-nums`}
          inputMode="decimal"
          aria-label={`${label}, процентов от пула`}
          value={draft}
          disabled={controlsDisabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commitDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(normalizedValue.toFixed(1));
              event.currentTarget.blur();
            }
          }}
          data-testid={`${testIdPrefix}-input`}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
      </div>
      <Button type="button" variant="outline" size="icon" className={compact ? 'h-8 w-8' : 'h-10 w-10'} disabled={controlsDisabled} onPointerDown={keepDraftForStepClick} onClick={() => void commit((parsedDraft() ?? normalizedValue) + 1)} aria-label={`Увеличить ${label} на 1 процент`} data-testid={`${testIdPrefix}-plus`}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}

function MoneyStepper({
  value,
  step,
  disabled,
  disabledReason,
  onCommit,
  label,
  testIdPrefix,
  compact = false,
}: {
  value: number;
  step: number;
  disabled: boolean;
  disabledReason?: string;
  onCommit?: (amount: number) => Promise<boolean>;
  label: string;
  testIdPrefix: string;
  compact?: boolean;
}) {
  const normalizedValue = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  const [draft, setDraft] = useState(formatMoneyInput(normalizedValue));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const skipNextBlurRef = useRef(false);

  useEffect(() => {
    if (!busy) setDraft(formatMoneyInput(normalizedValue));
  }, [normalizedValue, busy]);

  const commit = async (nextAmount: number) => {
    const normalizedAmount = Math.max(0, Math.round(nextAmount));
    if (!onCommit || disabled || busyRef.current) return;
    setDraft(formatMoneyInput(normalizedAmount));
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
    if (!accepted) setDraft(formatMoneyInput(normalizedValue));
  };

  const commitDraft = () => {
    if (skipNextBlurRef.current) return;
    const parsed = inputNumber(draft);
    if (parsed === null) {
      setDraft(formatMoneyInput(normalizedValue));
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
    <div className={`grid min-w-0 ${compact ? 'grid-cols-[2rem_minmax(0,1fr)_2rem] gap-1' : 'grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] gap-2'}`} title={disabledReason}>
      <Button type="button" variant="outline" size="icon" className={compact ? 'h-8 w-8' : 'h-10 w-10'} disabled={controlsDisabled} onPointerDown={keepDraftForStepClick} onClick={() => void commit(Math.max(0, draftValue - step))} aria-label={`Уменьшить ${label} на ${moneyFormatter.format(step)} тенге`} data-testid={`${testIdPrefix}-minus`}><Minus className="h-4 w-4" /></Button>
      <Input
        className={`${compact ? 'h-8' : 'h-10'} min-w-0 w-full px-2 text-center text-sm font-semibold tabular-nums`}
        inputMode="numeric"
        aria-label={`${label} в тенге`}
        value={draft}
        disabled={controlsDisabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(formatMoneyInput(normalizedValue));
            event.currentTarget.blur();
          }
        }}
        data-testid={`${testIdPrefix}-input`}
      />
      <Button type="button" variant="outline" size="icon" className={compact ? 'h-8 w-8' : 'h-10 w-10'} disabled={controlsDisabled} onPointerDown={keepDraftForStepClick} onClick={() => void commit(draftValue + step)} aria-label={`Увеличить ${label} на ${moneyFormatter.format(step)} тенге`} data-testid={`${testIdPrefix}-plus`}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}
