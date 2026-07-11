import type { ContractInfo } from '@/types/project-v3';

const PENDING_UPLOAD = 'pending_upload';

type AnyRecord = Record<string, any>;

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function mergeDefined<T extends Record<string, any>>(...sources: Array<T | null | undefined>): T {
  const result: Record<string, any> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (isPresent(value)) result[key] = value;
    }
  }
  return result as T;
}

export function projectNotes(project: any): AnyRecord {
  const notes = project?.notes;
  if (!notes) return {};
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof notes === 'object' ? notes : {};
}

function readArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseMoney(value: any): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[₸₽$€]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');

  if (!normalized || normalized === '-' || normalized === '.') return 0;
  const parts = normalized.split('.');
  const decimalSafe = parts.length > 2
    ? `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`
    : normalized;
  const parsed = Number(decimalSafe);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstText(...values: any[]): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text && text !== PENDING_UPLOAD) return text;
  }
  return '';
}

function firstPositiveNumber(...values: any[]): number {
  for (const value of values) {
    const parsed = parseMoney(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function projectFileKey(file: any): string {
  const direct = file?.id || file?.storagePath || file?.publicUrl || file?.url || file?.downloadUrl;
  if (direct) return String(direct).trim().toLowerCase();

  const name = String(file?.fileName || file?.name || '').trim().toLowerCase();
  const size = String(file?.fileSize || file?.size || '');
  const category = String(file?.category || '');
  return [category, name, size].filter(Boolean).join(':');
}

export function dedupeProjectFiles(files: any[] = []): any[] {
  const byKey = new Map<string, any>();
  for (const file of files || []) {
    if (!file) continue;
    const key = projectFileKey(file);
    if (!key) continue;
    byKey.set(key, {
      ...byKey.get(key),
      ...file,
      fileName: file.fileName || file.name || byKey.get(key)?.fileName,
      name: file.name || file.fileName || byKey.get(key)?.name,
      publicUrl: file.publicUrl || file.url || byKey.get(key)?.publicUrl,
      url: file.url || file.publicUrl || byKey.get(key)?.url,
    });
  }
  return Array.from(byKey.values());
}

export function projectFiles(project: any): any[] {
  const notes = projectNotes(project);
  return dedupeProjectFiles([
    ...readArray(notes.files),
    ...readArray(project?.files),
  ]);
}

export function projectStartDate(project: any): string {
  const notes = projectNotes(project);
  const contract = project?.contract || {};
  const noteContract = notes.contract || {};
  return firstText(
    contract.serviceStartDate,
    noteContract.serviceStartDate,
    contract.startDate,
    noteContract.startDate,
    project?.startDate,
    project?.start_date,
    notes.startDate,
    notes.start_date,
    notes.createdAt,
    project?.created_at,
    project?.createdAt,
  );
}

export function projectDeadline(project: any): string {
  const notes = projectNotes(project);
  const contract = project?.contract || {};
  const noteContract = notes.contract || {};
  return firstText(
    contract.serviceEndDate,
    noteContract.serviceEndDate,
    contract.endDate,
    noteContract.endDate,
    project?.deadline,
    project?.due_date,
    project?.end_date,
    project?.endDate,
    notes.deadline,
    notes.dueDate,
    notes.serviceTerm,
    notes.endDate,
    notes.end_date,
    contract.date,
    noteContract.date,
  );
}

export function projectContract(project: any): ContractInfo | null {
  const notes = projectNotes(project);
  const noteContract = notes.contract || {};
  const projectContractData = project?.contract || {};
  const finances = project?.finances || notes.finances || {};
  const merged = mergeDefined<ContractInfo>(noteContract, projectContractData);

  const amountWithoutVAT = firstPositiveNumber(
    projectContractData.amountWithoutVAT,
    noteContract.amountWithoutVAT,
    finances.amountWithoutVAT,
    finances.amountWithoutVat,
    notes.amountWithoutVAT,
    notes.amountWithoutVat,
    notes.amount,
    project?.amountWithoutVAT,
    project?.amount_without_vat,
    project?.amount,
  );
  const amountWithVAT = firstPositiveNumber(
    projectContractData.amountWithVAT,
    projectContractData.amountWithVat,
    noteContract.amountWithVAT,
    noteContract.amountWithVat,
    finances.amountWithVAT,
    finances.amountWithVat,
    notes.amountWithVAT,
    notes.amountWithVat,
  );
  const vatRate = parseMoney(
    projectContractData.vatRate ?? noteContract.vatRate ?? finances.vatRate ?? notes.vatRate ?? 0,
  );
  const vatAmount = firstPositiveNumber(
    projectContractData.vatAmount,
    noteContract.vatAmount,
    finances.vatAmount,
    amountWithVAT > amountWithoutVAT ? amountWithVAT - amountWithoutVAT : 0,
  );

  Object.assign(merged, {
    number: firstText(projectContractData.number, noteContract.number, projectContractData.contractNumber, noteContract.contractNumber, notes.contractNumber, project?.contractNumber, project?.contract_number),
    contractNumber: firstText(projectContractData.contractNumber, noteContract.contractNumber, projectContractData.number, noteContract.number, notes.contractNumber, project?.contractNumber, project?.contract_number),
    date: firstText(projectContractData.date, noteContract.date, projectContractData.contractDate, noteContract.contractDate, notes.contractDate, project?.contractDate, project?.contract_date),
    contractDate: firstText(projectContractData.contractDate, noteContract.contractDate, projectContractData.date, noteContract.date, notes.contractDate, project?.contractDate, project?.contract_date),
    subject: firstText(projectContractData.subject, noteContract.subject, notes.contractSubject, project?.contractSubject, project?.description),
    serviceStartDate: projectStartDate(project),
    serviceEndDate: projectDeadline(project),
    amountWithoutVAT,
    amountWithVAT: amountWithVAT || (amountWithoutVAT > 0 && vatRate > 0 ? amountWithoutVAT * (1 + vatRate / 100) : amountWithoutVAT),
    vatRate,
    vatAmount,
    currency: firstText(projectContractData.currency, noteContract.currency, finances.currency, notes.currency, project?.currency) || 'KZT',
    contractScanUrl: firstText(projectContractData.contractScanUrl, noteContract.contractScanUrl, notes.contractScanUrl, project?.contractScanUrl),
    contractOriginalUrl: firstText(projectContractData.contractOriginalUrl, noteContract.contractOriginalUrl, notes.contractOriginalUrl, project?.contractOriginalUrl),
  });

  return Object.keys(merged).length > 0 ? merged : null;
}

export function projectAmountWithoutVAT(project: any): number {
  return projectContract(project)?.amountWithoutVAT || 0;
}

export function projectFinances(project: any): AnyRecord {
  const notes = projectNotes(project);
  const source = {
    ...(notes.finances || {}),
    ...(project?.finances || {}),
  };
  const contract = projectContract(project);
  const amountWithoutVAT = projectAmountWithoutVAT(project);
  const vatRate = parseMoney(source.vatRate ?? contract?.vatRate ?? 0);
  const vatAmount = firstPositiveNumber(source.vatAmount, amountWithoutVAT * (vatRate / 100));
  const amountWithVAT = firstPositiveNumber(source.amountWithVAT, source.amountWithVat, amountWithoutVAT + vatAmount);
  const preExpensePercent = parseMoney(source.preExpensePercent ?? 30);
  const preExpenseAmount = firstPositiveNumber(source.preExpenseAmount, amountWithoutVAT * (preExpensePercent / 100));
  const totalContractorsAmount = firstPositiveNumber(source.totalContractorsAmount);
  const bonusBase = firstPositiveNumber(source.bonusBase, amountWithoutVAT - totalContractorsAmount - preExpenseAmount);
  const bonusPercent = parseMoney(source.bonusPercent ?? 10);
  const totalBonusAmount = firstPositiveNumber(source.totalBonusAmount, source.totalPaidBonuses, bonusBase * (bonusPercent / 100));
  const totalPaidBonuses = firstPositiveNumber(source.totalPaidBonuses, totalBonusAmount);
  const totalCosts = firstPositiveNumber(source.totalCosts, totalPaidBonuses + totalContractorsAmount + preExpenseAmount);
  const grossProfit = firstPositiveNumber(source.grossProfit, amountWithoutVAT - totalCosts);

  return {
    ...source,
    amountWithoutVAT,
    vatRate,
    vatAmount,
    amountWithVAT,
    preExpensePercent,
    preExpenseAmount,
    totalContractorsAmount,
    bonusBase,
    bonusPercent,
    totalBonusAmount,
    totalPaidBonuses,
    totalCosts,
    grossProfit,
    currency: firstText(source.currency, contract?.currency, notes.currency) || 'KZT',
  };
}

export function isContractFile(file: any): boolean {
  const category = String(file?.category || '').toLowerCase();
  const name = String(file?.fileName || file?.name || '').toLowerCase();
  return (
    category === 'contract' ||
    name.includes('договор') ||
    name.includes('contract') ||
    name.includes('dogovor') ||
    name.includes('доп') ||
    name.includes('соглаш')
  );
}

export function contractFileUrl(file: any): string {
  const url = file?.publicUrl || file?.url || file?.downloadUrl || file?.storagePath || '';
  return url === PENDING_UPLOAD ? '' : String(url || '');
}

export function projectContractFiles(project: any): any[] {
  const contract = projectContract(project);
  const files = projectFiles(project).filter(isContractFile);
  const legacyFiles = [
    contract?.contractScanUrl && contract.contractScanUrl !== PENDING_UPLOAD
      ? {
          id: `contract-scan:${contract.contractScanUrl}`,
          fileName: 'Скан договора',
          name: 'Скан договора',
          publicUrl: contract.contractScanUrl,
          url: contract.contractScanUrl,
          category: 'contract',
          legacy: true,
        }
      : null,
    contract?.contractOriginalUrl && contract.contractOriginalUrl !== PENDING_UPLOAD
      ? {
          id: `contract-original:${contract.contractOriginalUrl}`,
          fileName: 'Оригинал договора',
          name: 'Оригинал договора',
          publicUrl: contract.contractOriginalUrl,
          url: contract.contractOriginalUrl,
          category: 'contract',
          legacy: true,
        }
      : null,
  ].filter(Boolean);

  return dedupeProjectFiles([...(legacyFiles as any[]), ...files]);
}

export function mergeProjectFiles(existing: any[] = [], incoming: any[] = []): any[] {
  return dedupeProjectFiles([...(existing || []), ...(incoming || [])]);
}

export function buildContractUpdate(project: any, contract: ContractInfo, uploadedFiles: any[] = []) {
  const existingNotes = projectNotes(project);
  const files = mergeProjectFiles(projectFiles(project), uploadedFiles);
  const amountWithoutVAT = parseMoney(contract.amountWithoutVAT);
  const vatRate = parseMoney(contract.vatRate);
  const vatAmount = amountWithoutVAT * (vatRate / 100);
  const amountWithVAT = amountWithoutVAT + vatAmount;
  const nextContract = {
    ...contract,
    amountWithoutVAT,
    vatRate,
    vatAmount,
    amountWithVAT,
  };
  const finances = {
    ...(existingNotes.finances || project?.finances || {}),
    amountWithoutVAT,
    vatRate,
    vatAmount,
    amountWithVAT,
    currency: nextContract.currency || 'KZT',
  };

  return {
    contract: nextContract,
    finances,
    amountWithoutVAT,
    files,
    notes: {
      ...existingNotes,
      contract: nextContract,
      finances,
      amountWithoutVAT,
      files,
    },
  };
}
