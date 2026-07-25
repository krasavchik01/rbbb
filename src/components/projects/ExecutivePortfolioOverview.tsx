import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Clock, Gift, TrendingUp, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface ExecutivePortfolioSummary {
  totalProjects: number;
  activeProjects: number;
  closedProjects: number;
  attentionProjects: number;
  overdueProjects: number;
  dueNext30Projects: number;
  noDeadlineProjects: number;
  readyForBonuses: number;
  bonusReviewProjects: number;
  bonusConfiguredProjects: number;
  contractAmount: number;
  grossProfit: number;
  profitMargin: number;
  plannedBonusPool: number;
  allocatedBonuses: number;
  unallocatedBonuses: number;
  overallocatedBonuses: number;
  approvedForPayment: number;
  paidFromRegistry: number;
  pendingRegistryAmount: number;
  pendingHours: number;
  approvedHours: number;
  registryRows: number;
  registryUnmatchedRows: number;
  registryOutOfScopeRows: number;
  hoursRowCount: number;
  hoursComplete: boolean;
  hoursLoading: boolean;
  hoursError: boolean;
  groupedFinancialRows: number;
}

type ExecutiveAction = 'all' | 'attention' | 'overdue' | 'ready_bonus' | 'bonus_attention';

export function ExecutivePortfolioOverview({
  summary,
  registryLoading,
  registryError,
  onApplyView,
}: {
  summary: ExecutivePortfolioSummary;
  registryLoading: boolean;
  registryError: string | null;
  onApplyView: (view: ExecutiveAction) => void;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800" aria-label="Картина бизнеса генерального директора">
      <div className="border-b bg-gradient-to-r from-slate-50 via-background to-sky-50/60 px-4 py-4 dark:from-slate-950 dark:to-sky-950/20 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Картина бизнеса</h2>
              <Badge variant="outline">{summary.totalProjects} проектов</Badge>
              {registryLoading ? (
                <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Реестр загружается</Badge>
              ) : registryError ? (
                <Badge variant="outline" className="border-red-200 text-red-700">Реестр недоступен</Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-200 text-emerald-700">Реестр выплат подключён</Badge>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Портфель, риски и бонусы в одном месте. Плановый расчёт проекта отделён от утверждённого платёжного реестра.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full justify-between sm:w-auto">
            <Link to="/bonuses">Открыть реестр выплат <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-6">
        <ExecutiveMetric
          icon={<Banknote className="h-4 w-4" />}
          label="Договоры без НДС"
          value={money(summary.contractAmount)}
          detail={`${summary.activeProjects} проектов в работе`}
        />
        <ExecutiveMetric
          icon={<TrendingUp className="h-4 w-4" />}
          label="Прогнозный доход"
          value={money(summary.grossProfit)}
          detail={`После ГПХ, предрасхода и распределённых бонусов · маржа ${summary.profitMargin.toFixed(1)}%`}
          tone={summary.grossProfit < 0 ? 'danger' : 'positive'}
        />
        <ExecutiveMetric
          icon={<Gift className="h-4 w-4" />}
          label="Плановый бонусный пул"
          value={money(summary.plannedBonusPool)}
          detail="Черновой расчёт из проектов"
        />
        <ExecutiveMetric
          icon={<Wallet className="h-4 w-4" />}
          label="Распределено команде"
          value={money(summary.allocatedBonuses)}
          detail={summary.overallocatedBonuses > 0
            ? `Сверх пула ${money(summary.overallocatedBonuses)} · осталось ${money(summary.unallocatedBonuses)}`
            : `Осталось распределить ${money(summary.unallocatedBonuses)}`}
          tone={summary.overallocatedBonuses > 0 || summary.unallocatedBonuses > 0 ? 'warn' : 'default'}
        />
        <ExecutiveMetric
          icon={<Clock className="h-4 w-4" />}
          label="Утверждено к выплате"
          value={registryLoading ? 'Загрузка…' : registryError ? 'Нет данных' : money(summary.approvedForPayment)}
          detail={registryLoading ? 'Сверяем платёжный реестр' : registryError ? 'Не считать черновик выплатой' : 'Только утверждённые строки bonuses'}
          tone={summary.approvedForPayment > 0 ? 'warn' : 'default'}
        />
        <ExecutiveMetric
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Фактически выплачено"
          value={registryLoading ? 'Загрузка…' : registryError ? 'Нет данных' : money(summary.paidFromRegistry)}
          detail={registryLoading ? 'Сверяем платёжный реестр' : registryError ? 'Факт выплаты сейчас не подтверждён' : `Подтверждено датой выплаты · ${summary.registryRows} строк реестра`}
          tone="positive"
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-b bg-muted/10 px-4 py-3 text-xs sm:px-5">
        <OperationalFact label="В работе" value={summary.activeProjects.toLocaleString('ru-RU')} />
        <OperationalFact label="Закрыты" value={summary.closedProjects.toLocaleString('ru-RU')} />
        <OperationalFact label="Ближайшие 30 дней" value={summary.dueNext30Projects.toLocaleString('ru-RU')} warn={summary.dueNext30Projects > 0} />
        <OperationalFact label="Без срока" value={summary.noDeadlineProjects.toLocaleString('ru-RU')} warn={summary.noDeadlineProjects > 0} />
        <OperationalFact
          label="Утверждённые часы"
          value={summary.hoursLoading ? 'Загрузка…' : summary.hoursError || !summary.hoursComplete ? 'Нет данных' : `${summary.approvedHours.toFixed(1)} ч`}
          warn={summary.hoursError || !summary.hoursComplete}
        />
        <OperationalFact
          label="Ждут утверждения"
          value={summary.hoursLoading ? 'Загрузка…' : summary.hoursError || !summary.hoursComplete ? 'Нет данных' : `${summary.pendingHours.toFixed(1)} ч`}
          warn={summary.hoursError || !summary.hoursComplete || summary.pendingHours > 0}
        />
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] sm:p-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Что требует решения</h3>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onApplyView('all')}>Показать весь портфель</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <DecisionCard label="Требуют действия" value={summary.attentionProjects} detail="неполные данные или команда" tone="warn" onClick={() => onApplyView('attention')} />
            <DecisionCard label="Просрочены" value={summary.overdueProjects} detail="срок уже прошёл" tone="danger" onClick={() => onApplyView('overdue')} />
            <DecisionCard label="Готовы к бонусам" value={summary.readyForBonuses} detail="переданы генеральному директору" onClick={() => onApplyView('ready_bonus')} />
            <DecisionCard label="Проверить расчёт" value={summary.bonusReviewProjects} detail={`${summary.bonusConfiguredProjects} расчётов заполнено`} tone={summary.bonusReviewProjects > 0 ? 'warn' : 'positive'} onClick={() => onApplyView('bonus_attention')} />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3.5">
          <div className="text-sm font-semibold">Как читать бонусы</div>
          <div className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
            <p><span className="font-medium text-foreground">1.</span> Сумма без НДС − ГПХ − предрасход = база расчёта.</p>
            <p><span className="font-medium text-foreground">2.</span> База × процент = плановый бонусный пул.</p>
            <p><span className="font-medium text-foreground">3.</span> Персональные суммы — черновик до регистрации выплаты.</p>
            <p><span className="font-medium text-foreground">4.</span> Факт выплаты подтверждает только таблица bonuses.</p>
          </div>
          <div className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
            Часы: {summary.hoursLoading
              ? 'загружаются…'
              : summary.hoursError
                ? 'не загрузились — финансовые решения лучше отложить'
                : summary.hoursComplete
                  ? `${summary.hoursRowCount.toLocaleString('ru-RU')} строк загружено полностью`
                  : 'данные загружены не полностью'}
            {summary.pendingHours > 0 && ` · ${summary.pendingHours.toFixed(1)} ч ждут утверждения`}
            {summary.pendingRegistryAmount > 0 && ` · ${money(summary.pendingRegistryAmount)} в черновике платёжного реестра`}
            {summary.registryUnmatchedRows > 0 && ` · ${summary.registryUnmatchedRows} строк реестра требуют сверки`}
            {summary.registryOutOfScopeRows > 0 && ` · ${summary.registryOutOfScopeRows} строк вне доступного портфеля`}
            {summary.groupedFinancialRows > 0 && ` · ${summary.groupedFinancialRows} объединённых строк требуют выбора канонической записи`}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ExecutiveMetric({
  icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'positive' | 'warn' | 'danger';
}) {
  const valueTone = tone === 'positive'
    ? 'text-emerald-700 dark:text-emerald-300'
    : tone === 'danger'
      ? 'text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-foreground';
  return (
    <div className="min-w-0 bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</div>
      <div className={`mt-2 truncate text-xl font-semibold tabular-nums ${valueTone}`} title={value}>{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</div>
    </div>
  );
}

function OperationalFact({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${warn ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function DecisionCard({
  label,
  value,
  detail,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'default' | 'positive' | 'warn' | 'danger';
  onClick: () => void;
}) {
  const toneClass = tone === 'danger'
    ? 'border-red-200 bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20'
      : tone === 'positive'
        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20'
        : 'hover:bg-muted/40';
  return (
    <button type="button" className={`rounded-lg border p-3 text-left transition-colors ${toneClass}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {(tone === 'warn' || tone === 'danger') && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div>
    </button>
  );
}

function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value) || 0)} ₸`;
}
