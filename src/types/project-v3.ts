/**
 * Типы данных для проектов версии 3.0
 * С учетом нового workflow и финансовой модели
 */

import { UserRole } from './roles';
import type { AuditPeriod } from '@/lib/auditPeriods';
import { financeParticipants, isProtectedDetachedBonus } from '@/lib/projectLegacyCompatibility';

// Статусы проекта
export type ProjectStatus = 
  | 'new'                      // Новый проект (создан закупками)
  | 'pending_approval'         // На утверждении (у зам. директора)
  | 'approved'                 // Утверждён
  | 'planning'                 // В планировании (партнер)
  | 'in_progress'              // В работе
  | 'ready_to_complete'        // Готов к завершению
  | 'pending_payment_approval' // Ожидает утверждения выплат (у CEO)
  | 'completed'                // Завершён
  | 'cancelled';               // Отменён

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  new: 'Новый проект',
  pending_approval: 'На утверждении',
  approved: 'Утверждён',
  planning: 'В планировании',
  in_progress: 'В работе',
  ready_to_complete: 'Готов к завершению',
  pending_payment_approval: 'Ожидает утверждения выплат',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

// Виды проектов
export type ProjectType = 
  | 'financial_audit'
  | 'tax_audit'
  | 'it_audit'
  | 'real_estate_valuation'
  | 'business_valuation'
  | 'due_diligence'
  | 'consulting'
  | 'outsourcing'
  | 'other';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  financial_audit: 'Финансовый аудит',
  tax_audit: 'Налоговый аудит',
  it_audit: 'IT-аудит',
  real_estate_valuation: 'Оценка недвижимости',
  business_valuation: 'Оценка бизнеса',
  due_diligence: 'Due Diligence',
  consulting: 'Консалтинг',
  outsourcing: 'Аутсорсинг',
  other: 'Прочее',
};

// Информация о клиенте
export interface ClientInfo {
  name: string;                // Наименование клиента
  website?: string;            // Сайт компании
  activity?: string;           // Деятельность
  city?: string;               // Город
  contacts?: {                 // Контактные лица
    name: string;
    position?: string;
    phone?: string;
    email?: string;
  }[];
}

// Валюта проекта
export type ProjectCurrency = 'KZT' | 'USD' | 'EUR' | 'RUB';

export const CURRENCY_LABELS: Record<ProjectCurrency, string> = {
  KZT: '₸ Тенге',
  USD: '$ Доллар',
  EUR: '€ Евро',
  RUB: '₽ Рубль',
};

export const CURRENCY_SYMBOLS: Record<ProjectCurrency, string> = {
  KZT: '₸',
  USD: '$',
  EUR: '€',
  RUB: '₽',
};

// Допсоглашение к договору
export interface ContractAmendment {
  id: string;
  number: string;              // Номер допсоглашения
  date: string;                // Дата допсоглашения
  type: 'prolongation' | 'amount_change' | 'scope_change' | 'other'; // Тип изменения
  description: string;         // Описание изменений
  newAmount?: number;          // Новая сумма (если изменилась)
  newEndDate?: string;         // Новая дата окончания (если пролонгация)
  documentUrl?: string;        // URL скана допсоглашения
  createdBy: string;
  createdAt: string;
}

// Разбивка суммы по годам (для многолетних договоров)
export interface YearlyAmount {
  year: number;                // Год (2024, 2025, ...)
  amount: number;              // Сумма на этот год
  description?: string;        // Примечание
}

// Информация о договоре
export interface ContractInfo {
  number: string;              // Номер договора
  date: string;                // Дата договора
  subject: string;             // Предмет договора
  serviceStartDate: string;    // Срок оказания услуг (начало)
  serviceEndDate: string;      // Срок оказания услуг (окончание)
  amountWithoutVAT: number;    // Сумма без НДС
  vatRate?: number;            // Ставка НДС в % (0, 12, 16)
  vatAmount?: number;          // Сумма НДС
  amountWithVAT?: number;      // Сумма с НДС
  currency?: ProjectCurrency;  // Валюта (по умолчанию KZT)
  contractScanUrl?: string;    // URL скана договора
  contractOriginalUrl?: string; // URL оригинала договора (если заменили скан)

  // Допсоглашения и изменения
  amendments?: ContractAmendment[];  // Допсоглашения
  yearlyAmounts?: YearlyAmount[];    // Разбивка по годам
  isMultiYear?: boolean;             // Многолетний договор
}

// Член команды проекта
export interface TeamMember {
  userId: string;
  userName: string;
  role: UserRole;
  bonusPercent: number;        // Процент от общей суммы бонуса
  assignedAt: string;
  assignedBy: string;
}

// ГПХ (подрядчик) или Субподряд
export interface Contractor {
  id: string;
  name: string;
  amount: number;              // Сумма оплаты
  type?: 'gph' | 'subcontract'; // Тип: ГПХ или Субподряд
  description?: string;
  addedBy: string;
  addedAt: string;
}

// Задача в проекте
export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;          // userId
  assignedToName: string;
  plannedHours?: number;       // Планируемое время (для KPI)
  actualHours?: number;        // Фактическое время
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

// Оценка KPI
export interface KPIRating {
  userId: string;
  userName: string;
  rating: number;              // 1-5
  ratedBy: string;
  ratedByName: string;
  comment?: string;
  ratedAt: string;
}

// Информация об отчёте
export interface ReportInfo {
  languages: {
    russian: boolean;
    english: boolean;
    kazakh: boolean;
  };
  copies: {
    russian: number;
    english: number;
    kazakh: number;
  };
  format?: string;
  releaseDate?: string;
}

// Финансовая информация проекта
export interface ProjectFinances {
  vatRate?: number;
  vatAmount?: number;
  amountWithVAT?: number;
  currency?: string;
  distribution?: Record<string, number>;
  // Базовые суммы
  amountWithoutVAT: number;                    // Сумма без НДС
  preExpensePercent: number;                   // Процент предрасхода (по умолчанию 30%)
  preExpenseAmount: number;                    // Сумма предрасхода
  
  // ГПХ
  contractors: Contractor[];
  totalContractorsAmount: number;              // Общая сумма ГПХ
  
  // База для бонусов
  bonusBase: number;                           // Сумма без НДС - ГПХ - Предрасход
  bonusPercent: number;                        // Процент бонуса (можно настроить)
  totalBonusAmount: number;                    // Общая сумма бонуса
  bonusPoolOverrideAmount?: number | null;     // Ручной пул CEO в тенге
  bonusPoolManuallyAdjusted?: boolean;         // Не пересчитывать пул по проценту
  bonusPoolHistory?: Array<{
    type: string;
    by?: string;
    byName?: string;
    at: string;
    from?: unknown;
    to?: unknown;
  }>;
  
  // Распределение бонусов
  teamBonuses: {
    [userId: string]: {
      role: UserRole;
      percent: number;
      amount: number;
      manuallyAdjusted?: boolean;              // Изменено вручную CEO
      hiddenFromEmployee?: boolean;
      paidAt?: string | null;
      paidByName?: string | null;
      history?: Array<{
        type: string;
        by?: string;
        byName?: string;
        at: string;
        from?: unknown;
        to?: unknown;
      }>;
    };
  };
  
  // Итоги
  totalPaidBonuses: number;                    // Итого выплаченных бонусов
  totalCosts: number;                          // Итого затрат (бонусы + ГПХ + предрасход)
  grossProfit: number;                         // Грязный доход
  profitMargin: number;                        // Процент прибыли
}

// История изменений финансов
export interface FinanceChangeLog {
  id: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
}

// Файл проекта
export interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string; // путь в Supabase Storage
  uploadedBy: string;
  uploadedAt: string;
  category?: 'contract' | 'scan' | 'document' | 'screenshot' | 'other';
}

// Этап проекта (с финансами)
export interface ProjectStage {
  id: string;
  name: string; // "Аудит за 6 месяцев", "2024 год", "2025 год"
  startDate: string;
  endDate: string;
  description?: string;
  amountWithoutVAT: number;  // Сумма без НДС за этот этап
  vatAmount: number;          // Сумма НДС (16%)
  amountWithVAT: number;      // Сумма с НДС
  year?: number;              // Год этапа (для удобства фильтрации)
  auditPeriodId?: string;     // Единый период аудита, к которому относится этап
}

// Дополнительная услуга
export interface AdditionalService {
  id: string;
  name: string; // "Обучение", "Семинар", "Консультация"
  description?: string;
  cost?: number;
}

// Доп соглашение
export interface ProjectAmendment {
  id: string;
  projectId: string;
  number: string; // номер доп соглашения
  date: string;
  description: string;
  fileUrl?: string; // файл доп соглашения
  createdBy: string;
  createdAt: string;
}

// Настройки видимости финансовой информации
export interface FinancialVisibility {
  enabled: boolean;                            // Показывать ли сумму вообще
  visibleTo: string[];                         // userId тех, кому показывать
}

// Полная структура проекта v3
export interface ProjectV3 {
  // Основная информация
  id: string;
  name: string;
  type: ProjectType;
  companyId: string;                           // ID компании из COMPANIES
  companyName: string;
  status: ProjectStatus;
  completionPercent: number;
  
  // Клиент и договор
  client: ClientInfo;
  contract: ContractInfo;
  
  // Команда
  team: TeamMember[];
  
  // Задачи и KPI
  tasks: ProjectTask[];
  kpiRatings: KPIRating[];
  
  // Отчёт
  reportInfo?: ReportInfo;
  
  // Финансы
  finances: ProjectFinances;
  financeChangeLogs: FinanceChangeLog[];
  
  // Настройки видимости финансовой информации
  financialVisibility?: FinancialVisibility;    // Кому показывать финансовую информацию
  
  // Новые поля: файлы, этапы, услуги, доп соглашения
  files?: ProjectFile[];                       // Файлы проекта (хранятся в отдельной таблице)
  stages?: ProjectStage[];                     // Этапы проекта (хранятся в JSONB notes)
  auditPeriods?: AuditPeriod[];                // Периоды аудита внутри одного проекта
  additionalServices?: AdditionalService[];   // Дополнительные услуги (хранятся в JSONB notes)
  amendments?: ProjectAmendment[];             // Доп соглашения (хранятся в отдельной таблице)
  
  // Метаданные
  createdBy: string;
  createdByName: string;
  createdAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  completedAt?: string;
  updated_at: string;
}

// Вспомогательные функции для расчёта финансов
const readProjectNotes = (project: any): any => {
  const notes = project?.notes;
  if (!notes) return {};
  if (typeof notes === 'string') {
    try {
      return JSON.parse(notes) || {};
    } catch {
      return {};
    }
  }
  return notes;
};

const parseProjectMoney = (value: any): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null) return 0;
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[₸₽$€]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  if (!normalized) return 0;
  const parts = normalized.split('.');
  const decimalSafe = parts.length > 2
    ? `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`
    : normalized;
  const parsed = Number(decimalSafe);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstPositiveProjectMoney = (...values: any[]): number => {
  for (const value of values) {
    const parsed = parseProjectMoney(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

export const calculateProjectFinances = (project: Partial<ProjectV3>): ProjectFinances => {
  const rawProject = project as any;
  const notes = readProjectNotes(rawProject);
  const notesFinances = notes?.finances || {};
  const directFinances = rawProject?.finances || {};
  const financesSource = {
    ...notesFinances,
    ...directFinances,
    teamBonuses: {
      ...(notesFinances.teamBonuses || {}),
      ...(directFinances.teamBonuses || {}),
    },
  };
  const amountWithoutVAT = firstPositiveProjectMoney(
    project.contract?.amountWithoutVAT,
    notes?.contract?.amountWithoutVAT,
    financesSource?.amountWithoutVAT,
    rawProject?.amountWithoutVAT,
    rawProject?.amount_without_vat,
    rawProject?.amount,
    notes?.amountWithoutVAT,
    notes?.amount,
  );
  const preExpensePercent = Math.max(0, parseProjectMoney(financesSource.preExpensePercent ?? 30));
  const preExpenseAmount = amountWithoutVAT * (preExpensePercent / 100);

  const contractors: Contractor[] = Array.isArray(financesSource.contractors)
    ? financesSource.contractors
    : [];
  const totalContractorsAmount = contractors.reduce(
    (sum: number, contractor: Contractor) => sum + Math.max(0, parseProjectMoney(contractor.amount)),
    0,
  );

  const bonusBase = Math.max(0, amountWithoutVAT - totalContractorsAmount - preExpenseAmount);
  // 0% is a valid CEO decision and must not silently jump back to the 10% default.
  const formulaBonusPercent = Math.max(0, parseProjectMoney(financesSource.bonusPercent ?? 10));
  const rawPoolOverride = financesSource.bonusPoolOverrideAmount;
  const bonusPoolManuallyAdjusted = financesSource.bonusPoolManuallyAdjusted === true
    && rawPoolOverride !== undefined
    && rawPoolOverride !== null;
  const totalBonusAmount = bonusPoolManuallyAdjusted
    ? Math.max(0, parseProjectMoney(rawPoolOverride))
    : bonusBase * (formulaBonusPercent / 100);
  // Keep the configured formula percent even while a fixed pool is active, so
  // "Вернуть расчёт по проценту" restores the CEO's last formula instead of a
  // percentage derived from the temporary manual amount.
  const bonusPercent = formulaBonusPercent;
  const existingTeamBonuses = financesSource.teamBonuses || {};

  const teamBonuses: ProjectFinances['teamBonuses'] = {};
  const team: TeamMember[] = financeParticipants(project) as TeamMember[];

  team.forEach((member: TeamMember) => {
    const userId = member.userId || (member as any).id || (member as any).employeeId;
    if (!userId) return;
    const existingBonus = existingTeamBonuses[userId];
    const manuallyAdjusted = Boolean(existingBonus?.manuallyAdjusted);
    const amountLocked = isProtectedDetachedBonus(existingBonus);
    const memberPercent = Math.max(0, parseProjectMoney(member.bonusPercent));
    const previousCalculated = teamBonuses[userId];
    const combinedPercent = amountLocked
      ? Math.max(0, parseProjectMoney(existingBonus?.percent ?? memberPercent))
      : Math.max(0, parseProjectMoney(previousCalculated?.percent)) + memberPercent;
    const amount = amountLocked
      ? Math.max(0, parseProjectMoney(existingBonus?.amount))
      : totalBonusAmount * (combinedPercent / 100);
    const percent = amountLocked && totalBonusAmount > 0
      ? Number(((amount / totalBonusAmount) * 100).toFixed(2))
      : combinedPercent;

    teamBonuses[userId] = {
      ...existingBonus,
      role: member.role,
      percent,
      amount,
      manuallyAdjusted,
    };
  });

  const totalPaidBonuses = Object.values(teamBonuses).reduce((sum, b) => sum + Math.max(0, parseProjectMoney(b.amount)), 0);
  const totalCosts = totalPaidBonuses + totalContractorsAmount + preExpenseAmount;
  const grossProfit = amountWithoutVAT - totalCosts;
  const profitMargin = amountWithoutVAT > 0 ? (grossProfit / amountWithoutVAT) * 100 : 0;

  return {
    amountWithoutVAT,
    preExpensePercent,
    preExpenseAmount,
    contractors,
    totalContractorsAmount,
    bonusBase,
    bonusPercent,
    totalBonusAmount,
    bonusPoolOverrideAmount: bonusPoolManuallyAdjusted ? totalBonusAmount : null,
    bonusPoolManuallyAdjusted,
    bonusPoolHistory: Array.isArray(financesSource.bonusPoolHistory)
      ? financesSource.bonusPoolHistory.slice(-20)
      : [],
    teamBonuses,
    totalPaidBonuses,
    totalCosts,
    grossProfit,
    profitMargin,
  };
};

