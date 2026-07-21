import { getAuditPeriods, type AuditPeriod } from '@/lib/auditPeriods';
import { projectContract, projectFiles, projectNotes } from '@/lib/contractData';
import { PROJECT_TYPE_LABELS, type ContractInfo, type ProjectType, type ProjectStage } from '@/types/project-v3';

export type ProjectDataWarningCode =
  | 'missing_company'
  | 'missing_client'
  | 'missing_contract_subject'
  | 'missing_service_type'
  | 'missing_contract_dates'
  | 'missing_contract_amount'
  | 'missing_contract_file'
  | 'missing_stage'
  | 'stage_without_period'
  | 'period_without_stage'
  | 'duplicate_period_stage_link'
  | 'stage_amount_mismatch';

export interface ProjectDataWarning {
  code: ProjectDataWarningCode;
  label: string;
  severity: 'attention' | 'critical';
}

export interface BusinessSeason {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface CommandCenterStagePeriod {
  stageId: string;
  stageName: string;
  stageAmountWithoutVAT: number | null;
  auditPeriodId: string | null;
  periodName: string | null;
  periodType: AuditPeriod['type'] | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  deadline: string | null;
  periodStatus: AuditPeriod['status'] | null;
  linked: boolean;
}

export interface ProjectCommandCenterModel {
  projectId: string;
  projectName: string;
  companyName: string | null;
  clientName: string | null;
  serviceType: ProjectType | null;
  serviceLabel: string | null;
  contract: {
    number: string | null;
    date: string | null;
    subject: string | null;
    serviceStartDate: string | null;
    serviceEndDate: string | null;
    amountWithoutVAT: number | null;
    contractFileCount: number;
  };
  businessSeason: BusinessSeason | null;
  stagePeriods: CommandCenterStagePeriod[];
  warnings: ProjectDataWarning[];
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function uniqueWarnings(warnings: ProjectDataWarning[]): ProjectDataWarning[] {
  return warnings.filter((warning, index, all) => all.findIndex((candidate) => candidate.code === warning.code) === index);
}

function warning(code: ProjectDataWarningCode, label: string, severity: ProjectDataWarning['severity'] = 'attention'): ProjectDataWarning {
  return { code, label, severity };
}

function isoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function businessSeasonForDate(value: unknown): BusinessSeason | null {
  const date = isoDate(value);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  const startYear = parsed.getUTCMonth() >= 9 ? parsed.getUTCFullYear() : parsed.getUTCFullYear() - 1;
  const endYear = startYear + 1;
  return {
    key: `${startYear}/${String(endYear).slice(-2)}`,
    label: `Сезон ${startYear}/${String(endYear).slice(-2)} · октябрь ${startYear} — сентябрь ${endYear}`,
    startDate: `${startYear}-10-01`,
    endDate: `${endYear}-09-30`,
  };
}

function firstCompanyName(project: any, notes: Record<string, any>): string | null {
  return text(
    project?.companyName ?? project?.ourCompany?.name ?? project?.ourCompany ?? project?.company?.name ?? project?.company ??
    notes.companyName ?? notes.ourCompany?.name ?? notes.ourCompany ?? notes.company?.name ?? notes.company,
  );
}

function firstClientName(project: any, notes: Record<string, any>): string | null {
  return text(project?.client?.name ?? project?.clientName ?? project?.client_name ?? notes.client?.name ?? notes.clientName ?? notes.client_name);
}

function projectStages(project: any, notes: Record<string, any>): ProjectStage[] {
  const values = project?.stages ?? notes.stages;
  return Array.isArray(values) ? values.filter((stage) => stage?.id && stage?.name) : [];
}

function isContractFile(file: any): boolean {
  const category = String(file?.category ?? file?.kind ?? '').toLowerCase();
  return category === 'contract' || category === 'contract_scan' || Boolean(file?.isContract) || /договор|contract/i.test(String(file?.fileName ?? file?.name ?? ''));
}

export function buildProjectCommandCenterModel(project: any): ProjectCommandCenterModel {
  const notes = projectNotes(project);
  const contract: Partial<ContractInfo> & { contractNumber?: string; contractDate?: string } = projectContract(project) || {};
  const amount = Number(contract.amountWithoutVAT || 0);
  const stages = projectStages(project, notes);
  const periods = getAuditPeriods(project);
  const periodsById = new Map(periods.map((period) => [period.id, period]));
  const referencedPeriodIds = new Set<string>();
  const warnings: ProjectDataWarning[] = [];

  const stagePeriods = stages.map((stage) => {
    const auditPeriodId = text(stage.auditPeriodId);
    const period = auditPeriodId ? periodsById.get(auditPeriodId) : undefined;
    if (auditPeriodId) referencedPeriodIds.add(auditPeriodId);
    return {
      stageId: String(stage.id),
      stageName: String(stage.name).trim(),
      stageAmountWithoutVAT: Number(stage.amountWithoutVAT || 0) > 0 ? Number(stage.amountWithoutVAT) : null,
      auditPeriodId,
      periodName: period?.name || null,
      periodType: period?.type || null,
      periodStartDate: isoDate(period?.startDate),
      periodEndDate: isoDate(period?.endDate),
      deadline: isoDate(period?.deadline),
      periodStatus: period?.status || null,
      linked: Boolean(period),
    };
  });

  const companyName = firstCompanyName(project, notes);
  const clientName = firstClientName(project, notes);
  const serviceType = text(project?.type ?? notes.type) as ProjectType | null;
  const serviceLabel = serviceType && PROJECT_TYPE_LABELS[serviceType] ? PROJECT_TYPE_LABELS[serviceType] : text(project?.serviceType ?? notes.serviceType);
  const subject = text(contract.subject);
  const startDate = isoDate(contract.serviceStartDate);
  const endDate = isoDate(contract.serviceEndDate);
  const contractFileCount = projectFiles(project).filter(isContractFile).length;

  if (!companyName) warnings.push(warning('missing_company', 'Не указана наша компания', 'critical'));
  if (!clientName) warnings.push(warning('missing_client', 'Не указан клиент'));
  if (!subject) warnings.push(warning('missing_contract_subject', 'Не указан предмет договора', 'critical'));
  if (!serviceLabel) warnings.push(warning('missing_service_type', 'Не указан вид услуги', 'critical'));
  if (!startDate || !endDate) warnings.push(warning('missing_contract_dates', 'Не указан срок оказания услуг', 'critical'));
  if (amount <= 0) warnings.push(warning('missing_contract_amount', 'Не указана сумма договора без НДС', 'critical'));
  if (contractFileCount === 0) warnings.push(warning('missing_contract_file', 'Не загружен файл договора'));
  if (stages.length === 0) warnings.push(warning('missing_stage', 'Не создан этап договора', 'critical'));
  if (stagePeriods.some((item) => !item.linked)) warnings.push(warning('stage_without_period', 'Есть этап без связанного периода', 'critical'));
  if (periods.some((period) => !referencedPeriodIds.has(period.id))) warnings.push(warning('period_without_stage', 'Есть период без связанного этапа'));

  const linkedIds = stagePeriods.map((item) => item.auditPeriodId).filter(Boolean);
  if (new Set(linkedIds).size !== linkedIds.length) warnings.push(warning('duplicate_period_stage_link', 'Один период связан с несколькими этапами', 'critical'));

  const stageAmountTotal = stagePeriods.reduce((total, item) => total + (item.stageAmountWithoutVAT || 0), 0);
  if (amount > 0 && stageAmountTotal > 0 && Math.abs(amount - stageAmountTotal) > 0.01) {
    warnings.push(warning('stage_amount_mismatch', 'Сумма этапов не равна сумме договора'));
  }

  return {
    projectId: String(project?.id || ''),
    projectName: text(project?.name ?? notes.name) || 'Без названия',
    companyName,
    clientName,
    serviceType,
    serviceLabel,
    contract: {
      number: text(contract.number ?? contract.contractNumber),
      date: isoDate(contract.date ?? contract.contractDate),
      subject,
      serviceStartDate: startDate,
      serviceEndDate: endDate,
      amountWithoutVAT: amount > 0 ? amount : null,
      contractFileCount,
    },
    businessSeason: businessSeasonForDate(startDate ?? endDate),
    stagePeriods,
    warnings: uniqueWarnings(warnings),
  };
}
