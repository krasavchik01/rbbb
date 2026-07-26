import type { ReactNode } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, Gift, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface ExecutivePortfolioSummary {
  totalProjects: number;
  activeProjects: number;
  closedProjects: number;
  attentionProjects: number;
  portfolioInWorkProjects: number;
  portfolioAttentionProjects: number;
  overdueProjects: number;
  dueNext30Projects: number;
  laterThan30Projects: number;
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
      <div className="border-b bg-gradient-to-r from-slate-50 via-background to-sky-50/60 px-4 py-3 dark:from-slate-950 dark:to-sky-950/20 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">Картина бизнеса</h2>
              <Badge variant="outline">{summary.totalProjects} проектов</Badge>
              {registryLoading ? (
                <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Реестр загружается</Badge>
              ) : registryError ? (
                <Badge variant="outline" className="border-red-200 text-red-700">Реестр недоступен</Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-200 text-emerald-700">Реестр выплат подключён</Badge>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
              Сначала риски и деньги; детальный расчёт открывается прямо внутри нужного проекта.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onApplyView('all')}>Показать все проекты</Button>
        </div>
      </div>

      <div className="grid border-b lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:divide-x">
        <div className="p-3 sm:p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Требуют решения</h3>
          <div className="grid grid-cols-2 gap-2">
            <DecisionCard label="Просрочены" value={summary.overdueProjects} detail="срок прошёл" tone="danger" onClick={() => onApplyView('overdue')} />
            <DecisionCard label="Требуют действия" value={summary.attentionProjects} detail="есть проблема" tone="warn" onClick={() => onApplyView('attention')} />
            <DecisionCard label="Готовы к бонусам" value={summary.readyForBonuses} detail="можно считать" onClick={() => onApplyView('ready_bonus')} />
            <DecisionCard label="Проверить бонусы" value={summary.bonusReviewProjects} detail={`${summary.bonusConfiguredProjects} заполнено`} tone={summary.bonusReviewProjects > 0 ? 'warn' : 'positive'} onClick={() => onApplyView('bonus_attention')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border">
          <ExecutiveMetric icon={<Banknote className="h-4 w-4" />} label="Договоры без НДС" value={money(summary.contractAmount)} detail={`${summary.activeProjects} в работе`} />
          <ExecutiveMetric icon={<TrendingUp className="h-4 w-4" />} label="Прогнозный доход" value={money(summary.grossProfit)} detail={`Маржа ${summary.profitMargin.toFixed(1)}%`} tone={summary.grossProfit < 0 ? 'danger' : 'positive'} />
          <ExecutiveMetric icon={<Gift className="h-4 w-4" />} label="Бонусный пул" value={money(summary.plannedBonusPool)} detail={summary.overallocatedBonuses > 0 ? `Сверх пула ${money(summary.overallocatedBonuses)}` : `Осталось ${money(summary.unallocatedBonuses)}`} tone={summary.overallocatedBonuses > 0 ? 'danger' : summary.unallocatedBonuses > 0 ? 'warn' : 'default'} />
          <ExecutiveMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Выплачено по реестру" value={registryLoading ? 'Загрузка…' : registryError ? 'Нет данных' : money(summary.paidFromRegistry)} detail={registryLoading ? 'Сверяем реестр' : registryError ? 'Факт не подтверждён' : `К выплате ${money(summary.approvedForPayment)}`} tone={registryError ? 'danger' : !registryLoading && summary.paidFromRegistry > 0 ? 'positive' : 'default'} />
        </div>
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

      <details className="group px-4 py-2.5 sm:px-5">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Как считаются бонусы и откуда взяты цифры</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-3.5">
            <div className="text-sm font-semibold">Формула</div>
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
          <div className="rounded-lg border bg-muted/20 p-3.5 text-xs leading-5 text-muted-foreground">
            <div className="text-sm font-semibold text-foreground">Источники истины</div>
            <p className="mt-2"><span className="font-medium text-foreground">Проекты и команды:</span> projects + projects.notes.</p>
            <p><span className="font-medium text-foreground">Часы:</span> только timesheet_entries со статусом approved; submitted показаны отдельно.</p>
            <p><span className="font-medium text-foreground">Расчёт:</span> notes.finances.teamBonuses.</p>
            <p><span className="font-medium text-foreground">Факт выплаты:</span> только таблица bonuses и дата выплаты.</p>
          </div>
        </div>
      </details>
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
      <div className={`mt-1.5 whitespace-normal text-sm font-semibold tabular-nums sm:text-lg ${valueTone}`}>{value}</div>
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
    <button type="button" className={`min-h-20 rounded-lg border p-2.5 text-left transition-colors ${toneClass}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {(tone === 'warn' || tone === 'danger') && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div>
    </button>
  );
}

function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value) || 0)} ₸`;
}
