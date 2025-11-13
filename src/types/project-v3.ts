/**
 * Типы данных для проектов версии 3.0
 * С учетом нового workflow и финансовой модели
 */

import { UserRole } from './roles';

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

// Информация о договоре
export interface ContractInfo {
  number: string;              // Номер договора
  date: string;                // Дата договора
  subject: string;             // Предмет договора
  serviceStartDate: string;    // Срок оказания услуг (начало)
  serviceEndDate: string;      // Срок оказания услуг (окончание)
  amountWithoutVAT: number;    // Сумма без НДС
  contractScanUrl?: string;    // URL скана договора
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

// ГПХ (подрядчик)
export interface Contractor {
  id: string;
  name: string;
  amount: number;              // Сумма оплаты
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
  
  // Распределение бонусов
  teamBonuses: {
    [userId: string]: {
      role: UserRole;
      percent: number;
      amount: number;
      manuallyAdjusted?: boolean;              // Изменено вручную CEO
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

// Этап проекта
export interface ProjectStage {
  id: string;
  name: string; // "Аудит за 6 месяцев"
  startDate: string;
  endDate: string;
  description?: string;
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
export const calculateProjectFinances = (project: Partial<ProjectV3>): ProjectFinances => {
  const amountWithoutVAT = project.contract?.amountWithoutVAT || 0;
  const preExpensePercent = 30; // По умолчанию 30%
  const preExpenseAmount = amountWithoutVAT * (preExpensePercent / 100);
  
  const contractors = project.finances?.contractors || [];
  const totalContractorsAmount = contractors.reduce((sum, c) => sum + c.amount, 0);
  
  const bonusBase = amountWithoutVAT - totalContractorsAmount - preExpenseAmount;
  const bonusPercent = project.finances?.bonusPercent || 10; // По умолчанию 10%
  const totalBonusAmount = bonusBase * (bonusPercent / 100);
  
  // Рассчитываем бонусы команды
  const teamBonuses: ProjectFinances['teamBonuses'] = {};
  const team = project.team || [];
  
  team.forEach(member => {
    const amount = totalBonusAmount * (member.bonusPercent / 100);
    teamBonuses[member.userId] = {
      role: member.role,
      percent: member.bonusPercent,
      amount: amount,
    };
  });
  
  const totalPaidBonuses = Object.values(teamBonuses).reduce((sum, b) => sum + b.amount, 0);
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
    teamBonuses,
    totalPaidBonuses,
    totalCosts,
    grossProfit,
    profitMargin,
  };
};


