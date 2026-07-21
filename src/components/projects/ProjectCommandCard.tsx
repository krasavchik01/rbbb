import { AlertCircle, ArrowRight, Building2, CalendarRange, ExternalLink, FileText, Layers3, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectCommandCenterModel } from '@/lib/projectCommandCenterModel';

interface ProjectCommandCardProps {
  model: ProjectCommandCenterModel;
  projectHref: string;
  canSeeContractMoney: boolean;
}

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

function dateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return 'Не указан';
  const format = (value: string | null) => value ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`)) : '…';
  return `${format(startDate)} — ${format(endDate)}`;
}

export function ProjectCommandCard({ model, projectHref, canSeeContractMoney }: ProjectCommandCardProps) {
  const criticalWarnings = model.warnings.filter((item) => item.severity === 'critical');

  return (
    <section className="rounded-lg border bg-background shadow-sm" aria-label={`Паспорт проекта ${model.projectName}`}>
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Паспорт проекта</Badge>
            {model.businessSeason && <Badge variant="outline">{model.businessSeason.key} · октябрь—сентябрь</Badge>}
          </div>
          <h3 className="text-base font-semibold leading-snug">{model.projectName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {model.companyName || 'Наша компания не указана'} · {model.clientName || 'Клиент не указан'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to={projectHref}>Открыть проект <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
        </Button>
      </div>

      {criticalWarnings.length > 0 && (
        <div className="border-b bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Требуют уточнения данные проекта</div>
              <div className="mt-1 text-xs leading-relaxed">{criticalWarnings.map((warning) => warning.label).join(' · ')}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-px bg-border lg:grid-cols-3">
        <div className="space-y-3 bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Договор и услуга</div>
          <Field label="Вид услуги" value={model.serviceLabel || 'Не указан'} />
          <Field label="Предмет договора" value={model.contract.subject || 'Не указан'} emphasis />
          <Field label="Номер / дата" value={[model.contract.number, model.contract.date ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${model.contract.date}T00:00:00`)) : null].filter(Boolean).join(' · ') || 'Не указаны'} />
          <Field label="Срок оказания услуг" value={dateRange(model.contract.serviceStartDate, model.contract.serviceEndDate)} />
          <Field label="Файлы договора" value={model.contract.contractFileCount > 0 ? `${model.contract.contractFileCount} файл(а)` : 'Не загружены'} />
        </div>

        <div className="space-y-3 bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4 text-primary" /> Этапы и периоды</div>
          {model.stagePeriods.length === 0 && <p className="text-sm text-muted-foreground">Этапы договора пока не созданы.</p>}
          {model.stagePeriods.map((item) => (
            <div key={item.stageId} className="rounded-md border bg-muted/20 px-3 py-2.5">
              <div className="text-xs text-muted-foreground">Этап договора</div>
              <div className="font-medium">{item.stageName}</div>
              <div className="my-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowRight className="h-3.5 w-3.5" /> Связанный период</div>
              {item.linked ? (
                <>
                  <div className="font-medium">{item.periodName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{dateRange(item.periodStartDate, item.periodEndDate)}{item.deadline ? ` · дедлайн ${new Intl.DateTimeFormat('ru-RU').format(new Date(`${item.deadline}T00:00:00`))}` : ''}</div>
                </>
              ) : <div className="text-sm text-amber-700 dark:text-amber-300">Период не связан с этапом</div>}
            </div>
          ))}
        </div>

        <div className="space-y-3 bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary" /> Контекст и деньги</div>
          <Field label="Наша компания" value={model.companyName || 'Не указана'} />
          <Field label="Клиент" value={model.clientName || 'Не указан'} />
          <div className="border-t pt-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Сумма договора без НДС</div>
            {canSeeContractMoney ? (
              <div className="font-semibold tabular-nums">{model.contract.amountWithoutVAT === null ? 'Не указана' : `${money.format(model.contract.amountWithoutVAT)} ₸`}</div>
            ) : <div className="text-sm text-muted-foreground">Недоступно для вашей роли</div>}
          </div>
          {model.businessSeason && <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"><CalendarRange className="mr-1 inline h-3.5 w-3.5" /> {model.businessSeason.label}</div>}
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={emphasis ? 'mt-0.5 text-sm font-medium leading-relaxed' : 'mt-0.5 text-sm leading-relaxed'}>{value}</div>
    </div>
  );
}
