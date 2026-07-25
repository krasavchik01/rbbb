import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Gift, PieChart as PieChartIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ExecutivePortfolioSummary } from '@/components/projects/ExecutivePortfolioOverview';

export type ExecutiveVisualAction =
  | 'all'
  | 'working'
  | 'attention'
  | 'closed'
  | 'overdue'
  | 'next_30'
  | 'no_deadline'
  | 'waiting_hours'
  | 'ready_bonus'
  | 'bonus_attention'
  | 'portfolio_attention';

type VisualTone = 'sky' | 'amber' | 'emerald' | 'slate' | 'red' | 'violet';

type VisualSlice = {
  key: string;
  label: string;
  value: number;
  tone: VisualTone;
  action?: ExecutiveVisualAction;
};

const toneClasses: Record<VisualTone, { stroke: string; dot: string; bar: string; text: string }> = {
  sky: { stroke: 'stroke-sky-500 dark:stroke-sky-400', dot: 'bg-sky-500 dark:bg-sky-400', bar: 'bg-sky-500 dark:bg-sky-400', text: 'text-sky-700 dark:text-sky-300' },
  amber: { stroke: 'stroke-amber-500 dark:stroke-amber-400', dot: 'bg-amber-500 dark:bg-amber-400', bar: 'bg-amber-500 dark:bg-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  emerald: { stroke: 'stroke-emerald-500 dark:stroke-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400', bar: 'bg-emerald-500 dark:bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
  slate: { stroke: 'stroke-slate-400 dark:stroke-slate-500', dot: 'bg-slate-400 dark:bg-slate-500', bar: 'bg-slate-400 dark:bg-slate-500', text: 'text-slate-700 dark:text-slate-300' },
  red: { stroke: 'stroke-red-500 dark:stroke-red-400', dot: 'bg-red-500 dark:bg-red-400', bar: 'bg-red-500 dark:bg-red-400', text: 'text-red-700 dark:text-red-300' },
  violet: { stroke: 'stroke-violet-500 dark:stroke-violet-400', dot: 'bg-violet-500 dark:bg-violet-400', bar: 'bg-violet-500 dark:bg-violet-400', text: 'text-violet-700 dark:text-violet-300' },
};

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function safeChartPercent(value: number, total: number): number {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  if (safeTotal <= 0) return 0;
  return Math.min(100, Math.max(0, (safeValue / safeTotal) * 100));
}

function formatMoney(value: number): string {
  return `${money.format(Number.isFinite(value) ? value : 0)} ₸`;
}

export function ExecutivePortfolioVisuals({
  summary,
  registryLoading,
  registryError,
  onApplyView,
}: {
  summary: ExecutivePortfolioSummary;
  registryLoading: boolean;
  registryError: string | null;
  onApplyView: (view: ExecutiveVisualAction) => void;
}) {
  const portfolioSlices: VisualSlice[] = [
    { key: 'working', label: 'В работе — всё нормально', value: summary.portfolioInWorkProjects, tone: 'sky', action: 'working' },
    { key: 'attention', label: 'Требуют действия', value: summary.portfolioAttentionProjects, tone: 'amber', action: 'portfolio_attention' },
    { key: 'ready', label: 'Готовы к бонусам', value: summary.readyForBonuses, tone: 'emerald', action: 'ready_bonus' },
    { key: 'closed', label: 'Закрыты', value: summary.closedProjects, tone: 'slate', action: 'closed' },
  ];

  const hoursAvailable = summary.hoursComplete && !summary.hoursLoading && !summary.hoursError;
  const approvedHours = Math.max(0, summary.approvedHours);
  const pendingHours = Math.max(0, summary.pendingHours);
  const totalHours = approvedHours + pendingHours;
  const timesheetSlices: VisualSlice[] = [
    { key: 'approved', label: 'Утверждено', value: approvedHours, tone: 'emerald' },
    { key: 'pending', label: 'Ждут утверждения', value: pendingHours, tone: 'amber', action: 'waiting_hours' },
  ];

  return (
    <section className="min-w-0 space-y-3" aria-label="Визуальная картина портфеля генерального директора">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-semibold">Всё главное на графиках</h2>
          <p className="text-xs text-muted-foreground">Весь доступный портфель. Нажмите на показатель — таблица ниже покажет нужные проекты.</p>
        </div>
        <Badge variant="outline">весь доступный портфель</Badge>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-12">
        <BonusJourney
          summary={summary}
          registryLoading={registryLoading}
          registryError={registryError}
          onShowReady={() => onApplyView('ready_bonus')}
        />

        <div className="grid min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:col-span-1 xl:col-span-6">
          <DonutCard
            icon={<PieChartIcon className="h-4 w-4" />}
            title="Где сейчас проекты"
            subtitle="Каждый проект учтён один раз"
            slices={portfolioSlices}
            centerValue={summary.totalProjects.toLocaleString('ru-RU')}
            centerLabel="всего"
            formatValue={(value) => value.toLocaleString('ru-RU')}
            onApplyView={onApplyView}
          />

          <DonutCard
            icon={<Clock3 className="h-4 w-4" />}
            title="Таймшиты"
            subtitle="Утверждено и ждёт подтверждения"
            slices={hoursAvailable ? timesheetSlices : []}
            centerValue={hoursAvailable && totalHours > 0 ? `${safeChartPercent(approvedHours, totalHours).toFixed(0)}%` : '—'}
            centerLabel={hoursAvailable ? 'утверждено' : 'нет данных'}
            formatValue={(value) => `${value.toFixed(1)} ч`}
            onApplyView={onApplyView}
            state={summary.hoursLoading ? 'loading' : summary.hoursError || !summary.hoursComplete ? 'error' : totalHours <= 0 ? 'empty' : 'ready'}
          />
        </div>

        <DeadlineRiskBars summary={summary} onApplyView={onApplyView} />
      </div>
    </section>
  );
}

function BonusJourney({
  summary,
  registryLoading,
  registryError,
  onShowReady,
}: {
  summary: ExecutivePortfolioSummary;
  registryLoading: boolean;
  registryError: string | null;
  onShowReady: () => void;
}) {
  const registryAvailable = !registryLoading && !registryError;
  const stages: Array<{ key: string; label: string; detail: string; value: number | null; tone: VisualTone }> = [
    { key: 'pool', label: '1. Плановый бонусный пул', detail: 'расчёт проектов', value: Math.max(0, summary.plannedBonusPool), tone: 'sky' },
    { key: 'allocated', label: '2. Распределено сотрудникам', detail: 'черновик по людям', value: Math.max(0, summary.allocatedBonuses), tone: 'violet' },
    { key: 'approved', label: '3. К выплате сейчас', detail: 'утверждено в bonuses', value: registryAvailable ? Math.max(0, summary.approvedForPayment) : null, tone: 'amber' },
    { key: 'paid', label: '4. Фактически выплачено', detail: 'есть дата выплаты', value: registryAvailable ? Math.max(0, summary.paidFromRegistry) : null, tone: 'emerald' },
  ];
  const scale = Math.max(1, ...stages.map((stage) => stage.value ?? 0));

  return (
    <Card className="min-w-0 p-4 lg:col-span-1 xl:col-span-6" aria-label="Путь бонусов от плана до выплаты">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Gift className="h-4 w-4" /> Путь бонусов</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Четыре независимых этапа — от расчёта до реальных денег.</p>
        </div>
        {summary.readyForBonuses > 0 && <Badge variant="outline">{summary.readyForBonuses} готово к расчёту</Badge>}
      </div>

      <div className="mt-4 space-y-3" role="img" aria-label="Шкалы планового, распределённого, утверждённого и выплаченного бонуса">
        {stages.map((stage) => {
          const width = stage.value === null ? 0 : safeChartPercent(stage.value, scale);
          return (
            <div key={stage.key} className="min-w-0">
              <div className="mb-1 flex min-w-0 items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium leading-4">{stage.label}</div>
                  <div className="text-[11px] text-muted-foreground">{stage.detail}</div>
                </div>
                <div className={`shrink-0 text-sm font-semibold tabular-nums ${stage.value === null ? 'text-muted-foreground' : toneClasses[stage.tone].text}`}>
                  {stage.value === null ? (registryLoading ? 'Загрузка…' : 'Нет данных') : formatMoney(stage.value)}
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                {stage.value !== null && stage.value > 0 && <div className={`h-full rounded-full ${toneClasses[stage.tone].bar}`} style={{ width: `${width}%` }} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        {summary.unallocatedBonuses > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            <span className="font-semibold">Осталось распределить:</span> {formatMoney(summary.unallocatedBonuses)}
          </div>
        )}
        {summary.overallocatedBonuses > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-red-900 dark:bg-red-950/20 dark:text-red-200">
            <span className="font-semibold">Сверх планового пула:</span> {formatMoney(summary.overallocatedBonuses)}
          </div>
        )}
        {summary.unallocatedBonuses <= 0 && summary.overallocatedBonuses <= 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
            <span className="font-semibold">Пулы распределены без остатка.</span>
          </div>
        )}
        {registryError && (
          <div className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-red-900 dark:bg-red-950/20 dark:text-red-200">
            <span className="font-semibold">Факт выплаты не подтверждён:</span> реестр сейчас недоступен.
          </div>
        )}
      </div>

      <Button type="button" variant="outline" size="sm" className="mt-3 w-full sm:w-auto" onClick={onShowReady}>
        Показать проекты, готовые к бонусам
      </Button>
    </Card>
  );
}

function DonutCard({
  icon,
  title,
  subtitle,
  slices,
  centerValue,
  centerLabel,
  formatValue,
  onApplyView,
  state = 'ready',
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  slices: VisualSlice[];
  centerValue: string;
  centerLabel: string;
  formatValue: (value: number) => string;
  onApplyView: (view: ExecutiveVisualAction) => void;
  state?: 'ready' | 'loading' | 'error' | 'empty';
}) {
  const values = slices.map((slice) => ({ ...slice, value: Number.isFinite(slice.value) ? Math.max(0, slice.value) : 0 }));
  const total = values.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return (
    <Card className="min-w-0 p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>

      {state === 'loading' ? (
        <div role="status" aria-live="polite" className="flex h-40 items-center justify-center text-sm text-muted-foreground">Загружаем данные…</div>
      ) : state === 'error' ? (
        <div role="alert" className="flex h-40 flex-col items-center justify-center px-2 text-center text-sm text-red-700 dark:text-red-300"><AlertTriangle className="mb-2 h-5 w-5" />Данные не загрузились. Нули не показываем.</div>
      ) : state === 'empty' ? (
        <div className="flex h-40 flex-col items-center justify-center px-2 text-center text-sm text-muted-foreground"><CheckCircle2 className="mb-2 h-5 w-5" />Утверждённых и ожидающих часов пока нет.</div>
      ) : (
        <figure>
          <div className="relative mx-auto mt-2 h-32 w-32" role="img" aria-label={`${title}: ${values.map((slice) => `${slice.label} ${formatValue(slice.value)}`).join(', ')}`}>
            <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="21" cy="21" r="15.9155" fill="transparent" pathLength="100" strokeWidth="6" className="stroke-muted" />
              {total > 0 && values.map((slice) => {
                const percent = safeChartPercent(slice.value, total);
                const segment = (
                  <circle
                    key={slice.key}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="transparent"
                    pathLength="100"
                    strokeWidth="6"
                    strokeDasharray={`${percent} ${100 - percent}`}
                    strokeDashoffset={-offset}
                    className={toneClasses[slice.tone].stroke}
                  />
                );
                offset += percent;
                return segment;
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-xl font-semibold tabular-nums">{centerValue}</div>
              <div className="text-[10px] text-muted-foreground">{centerLabel}</div>
            </div>
          </div>

          <figcaption className="mt-2 space-y-1">
            {values.map((slice) => {
              const content = (
                <>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses[slice.tone].dot}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left text-[11px] leading-4">{slice.label}</span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums">{formatValue(slice.value)} · {safeChartPercent(slice.value, total).toFixed(0)}%</span>
                </>
              );
              return slice.action ? (
                <button key={slice.key} type="button" className="flex min-h-9 w-full items-center gap-2 rounded-md px-1.5 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onApplyView(slice.action!)} aria-label={`Показать: ${slice.label}, ${formatValue(slice.value)}`}>{content}</button>
              ) : (
                <div key={slice.key} className="flex min-h-9 items-center gap-2 px-1.5">{content}</div>
              );
            })}
          </figcaption>
        </figure>
      )}
    </Card>
  );
}

function DeadlineRiskBars({
  summary,
  onApplyView,
}: {
  summary: ExecutivePortfolioSummary;
  onApplyView: (view: ExecutiveVisualAction) => void;
}) {
  const rows: VisualSlice[] = [
    { key: 'overdue', label: 'Просрочены', value: summary.overdueProjects, tone: 'red', action: 'overdue' },
    { key: 'soon', label: 'Срок в ближайшие 30 дней', value: summary.dueNext30Projects, tone: 'amber', action: 'next_30' },
    { key: 'later', label: 'Срок позже 30 дней', value: summary.laterThan30Projects, tone: 'sky' },
    { key: 'missing', label: 'Срок не указан или некорректен', value: summary.noDeadlineProjects, tone: 'slate', action: 'no_deadline' },
  ];
  const scale = Math.max(1, summary.activeProjects);

  return (
    <Card className="min-w-0 p-4 lg:col-span-2 xl:col-span-12" aria-label="Сроки активных проектов">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4" /> Сроки активных проектов</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Категории не пересекаются. Закрытые проекты сюда не входят.</p>
        </div>
        <Badge variant="outline">{summary.activeProjects} в работе</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const content = (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{row.label}</span>
                <span className={`font-semibold tabular-nums ${toneClasses[row.tone].text}`}>{row.value}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                {row.value > 0 && <div className={`h-full rounded-full ${toneClasses[row.tone].bar}`} style={{ width: `${safeChartPercent(row.value, scale)}%` }} />}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{safeChartPercent(row.value, scale).toFixed(0)}% активного портфеля</div>
            </>
          );
          return row.action ? (
            <button key={row.key} type="button" className="min-h-16 rounded-md border px-3 py-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onApplyView(row.action!)} aria-label={`Показать проекты: ${row.label}, ${row.value}`}>{content}</button>
          ) : (
            <div key={row.key} className="min-h-16 rounded-md border px-3 py-2">{content}</div>
          );
        })}
      </div>
    </Card>
  );
}
