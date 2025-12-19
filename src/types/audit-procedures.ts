/**
 * Аудиторские процедуры согласно МСА стандартам
 * ISA - International Standards on Auditing
 */

// Классификация аудита по стандартам МСА
export type AuditClassification =
  | 'financial_audit'           // МСА 200 - Финансовый аудит
  | 'internal_controls_audit'   // МСА 260 - Аудит внутренних контролей
  | 'compliance_audit'          // МСА 250 - Соответствие требованиям
  | 'operational_audit'         // Операционный аудит
  | 'fraud_investigation';      // МСА 240 - Ошибки и мошенничество

// Категории аудиторских процедур (МСА 500)
export type AuditProcedureCategory =
  | 'inspection'                // Проверка документов и активов
  | 'observation'               // Наблюдение за процессами
  | 'inquiry'                   // Опрос персонала
  | 'confirmation'              // Внешние подтверждения
  | 'recalculation'             // Пересчёт и проверка расчётов
  | 'reperformance'             // Повторное выполнение процедур
  | 'analytical_procedure'      // Аналитические процедуры
  | 'tracing'                   // Отслеживание операций
  | 'walkthrough'               // Пошаговое прохождение
  | 'sampling';                 // Выборочная проверка

// Области аудита (Risk Areas)
export type AuditArea =
  | 'revenue'                   // Доход
  | 'expenses'                  // Расходы
  | 'assets'                    // Активы
  | 'liabilities'               // Обязательства
  | 'equity'                    // Капитал
  | 'cash_flow'                 // Денежные потоки
  | 'payroll'                   // Зарплата
  | 'inventory'                 // Товарно-материальные ценности
  | 'receivables'               // Дебиторская задолженность
  | 'payables'                  // Кредиторская задолженность
  | 'fixed_assets'              // Основные средства
  | 'investments'               // Инвестиции
  | 'bank_reconciliation'       // Выверка банковских счётов
  | 'accounts_reconciliation'   // Выверка счётов
  | 'consolidation';            // Консолидация

// Уровни риска значительного искажения (ISA 315)
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

// Статус выполнения процедуры
export type ProcedureStatus =
  | 'planned'                   // Запланирована
  | 'in_progress'               // В процессе выполнения
  | 'completed'                 // Завершена
  | 'on_hold'                   // Приостановлена
  | 'cancelled';                // Отменена

// Основная структура аудиторской процедуры
export interface AuditProcedure {
  id: string;
  projectId: string;

  // Основная информация
  code: string;                 // Код процедуры (напр. AP-001)
  name: string;                 // Название процедуры
  description: string;          // Описание

  // Классификация (МСА)
  classification: AuditClassification;
  category: AuditProcedureCategory;
  area: AuditArea;

  // Риск и сложность
  riskLevel: RiskLevel;
  estimatedHours: number;       // Прогнозируемые часы

  // Ответственные
  assignedTo: string[];         // IDs аудиторов
  assignedToNames: string[];    // Имена аудиторов

  // Статус
  status: ProcedureStatus;
  startDate?: string;
  endDate?: string;
  actualHours?: number;

  // Документирование (МСА 230)
  documentationRequired: boolean;
  workingPaperReference?: string;

  // Результаты
  findingsCount: number;
  issuesFound: string[];
  conclusion?: string;          // Вывод аудитора

  // Метаданные
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // МСА требования
  isaReference: string;         // Ссылка на МСА стандарт (напр. "ISA 500")
  evidenceRequired: string[];   // Требуемые доказательства
  sampleSize?: number;          // Размер выборки
}

// Шаблоны процедур по областям
export interface ProcedureTemplate {
  id: string;
  area: AuditArea;
  category: AuditProcedureCategory;
  name: string;
  description: string;
  estimatedHours: number;
  isaReference: string;
  riskLevel: RiskLevel;
  evidenceRequired: string[];
}

// Результаты выполнения процедуры
export interface ProcedureResult {
  id: string;
  procedureId: string;

  status: 'successful' | 'with_findings' | 'inconclusive';
  findingsDescription?: string;
  evidenceFiles?: string[];     // Ссылки на загруженные файлы

  samplingDetails?: {
    totalPopulation: number;
    sampleSize: number;
    exceptions: number;
    projectedError: number;
  };

  workingPaper?: string;
  auditorNotes?: string;

  completedBy: string;
  completedAt: string;
}

// Предопределённые процедуры по МСА 500
export const MSA_PROCEDURES: ProcedureTemplate[] = [
  // INSPECTION (Проверка документов)
  {
    id: 'msa-001',
    area: 'revenue',
    category: 'inspection',
    name: 'Проверка договоров с клиентами',
    description: 'Инспекция оригиналов договоров продажи, счётов, накладных (МСА 500)',
    estimatedHours: 8,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Договоры', 'Счета-фактуры', 'Накладные'],
  },
  {
    id: 'msa-002',
    area: 'expenses',
    category: 'inspection',
    name: 'Проверка подтверждающих документов по расходам',
    description: 'Инспекция счётов, квитанций, авансовых отчётов',
    estimatedHours: 10,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'medium',
    evidenceRequired: ['Счета поставщиков', 'Платёжные документы', 'Авансовые отчёты'],
  },
  {
    id: 'msa-003',
    area: 'inventory',
    category: 'inspection',
    name: 'Проверка акта инвентаризации',
    description: 'Инспекция документов инвентаризации материальных активов',
    estimatedHours: 12,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Акты инвентаризации', 'Ведомости по результатам'],
  },

  // OBSERVATION (Наблюдение)
  {
    id: 'msa-004',
    area: 'inventory',
    category: 'observation',
    name: 'Наблюдение за физической инвентаризацией',
    description: 'Присутствие при проведении счёта товарно-материальных ценностей',
    estimatedHours: 16,
    isaReference: 'ISA 501 - Audit Evidence - Specific Considerations',
    riskLevel: 'high',
    evidenceRequired: ['Отчёт о наблюдении', 'Фотографии', 'Видеозаписи'],
  },
  {
    id: 'msa-005',
    area: 'cash_flow',
    category: 'observation',
    name: 'Наблюдение за проверкой кассы',
    description: 'Присутствие при пересчёте наличных денег в кассе',
    estimatedHours: 4,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Акт проверки кассы', 'Отчёт аудитора'],
  },

  // INQUIRY (Опрос)
  {
    id: 'msa-006',
    area: 'receivables',
    category: 'inquiry',
    name: 'Опрос по задолженности дебиторов',
    description: 'Вопросники и беседы с отделом продаж о сомнительных долгах',
    estimatedHours: 6,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'medium',
    evidenceRequired: ['Протокол интервью', 'Письменные ответы'],
  },
  {
    id: 'msa-007',
    area: 'liabilities',
    category: 'inquiry',
    name: 'Опрос по забытым обязательствам',
    description: 'Вопросники юридическому отделу о скрытых обязательствах',
    estimatedHours: 4,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'medium',
    evidenceRequired: ['Протоколы интервью'],
  },

  // CONFIRMATION (Внешние подтверждения)
  {
    id: 'msa-008',
    area: 'receivables',
    category: 'confirmation',
    name: 'Запрос подтверждения дебиторской задолженности',
    description: 'Запросы покупателям на подтверждение суммы задолженности (МСА 505)',
    estimatedHours: 10,
    isaReference: 'ISA 505 - External Confirmations',
    riskLevel: 'high',
    evidenceRequired: ['Письма подтверждения', 'Ответы клиентов'],
  },
  {
    id: 'msa-009',
    area: 'payables',
    category: 'confirmation',
    name: 'Запрос подтверждения кредиторской задолженности',
    description: 'Письма поставщикам на подтверждение задолженности',
    estimatedHours: 8,
    isaReference: 'ISA 505 - External Confirmations',
    riskLevel: 'medium',
    evidenceRequired: ['Письма подтверждения', 'Ответы поставщиков'],
  },
  {
    id: 'msa-010',
    area: 'bank_reconciliation',
    category: 'confirmation',
    name: 'Запрос выписки в банке',
    description: 'Прямые запросы в банк на подтверждение остатков счётов',
    estimatedHours: 6,
    isaReference: 'ISA 505 - External Confirmations',
    riskLevel: 'high',
    evidenceRequired: ['Банковские выписки', 'Письма от банка'],
  },

  // RECALCULATION (Пересчёт)
  {
    id: 'msa-011',
    area: 'payroll',
    category: 'recalculation',
    name: 'Пересчёт начисления заработной платы',
    description: 'Проверка правильности расчётов зарплаты, налогов, взносов',
    estimatedHours: 12,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Расчётные листы', 'Ведомости', 'Подтверждение платежей'],
  },
  {
    id: 'msa-012',
    area: 'assets',
    category: 'recalculation',
    name: 'Пересчёт амортизации основных средств',
    description: 'Проверка расчётов амортизации, проверка остаточной стоимости',
    estimatedHours: 10,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'medium',
    evidenceRequired: ['Реестр основных средств', 'Расчёты амортизации'],
  },

  // REPERFORMANCE (Повторное выполнение)
  {
    id: 'msa-013',
    area: 'accounts_reconciliation',
    category: 'reperformance',
    name: 'Повторное выполнение выверки счётов',
    description: 'Независимый пересчёт выверок счётов между синтетикой и аналитикой',
    estimatedHours: 14,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Выверочные листы', 'Реестры счётов'],
  },
  {
    id: 'msa-014',
    area: 'bank_reconciliation',
    category: 'reperformance',
    name: 'Повторное выполнение выверки банковских счётов',
    description: 'Независимое выполнение выверки остатков по банку',
    estimatedHours: 10,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Выверочные листы', 'Банковские выписки', 'Кассовая книга'],
  },

  // ANALYTICAL PROCEDURES (Аналитические процедуры)
  {
    id: 'msa-015',
    area: 'revenue',
    category: 'analytical_procedure',
    name: 'Аналитические процедуры по доходам',
    description: 'Анализ тенденций доходов, структуры, выявление аномалий (МСА 520)',
    estimatedHours: 8,
    isaReference: 'ISA 520 - Analytical Procedures',
    riskLevel: 'medium',
    evidenceRequired: ['Таблицы анализа', 'Графики', 'Выводы'],
  },
  {
    id: 'msa-016',
    area: 'expenses',
    category: 'analytical_procedure',
    name: 'Аналитические процедуры по расходам',
    description: 'Анализ структуры расходов, соотношение к доходам, выявление аномалий',
    estimatedHours: 8,
    isaReference: 'ISA 520 - Analytical Procedures',
    riskLevel: 'medium',
    evidenceRequired: ['Таблицы анализа', 'Сравнение с бюджетом'],
  },

  // TRACING (Отслеживание операций)
  {
    id: 'msa-017',
    area: 'revenue',
    category: 'tracing',
    name: 'Отслеживание операций от исходного документа до регистра',
    description: 'Пошаговое отслеживание операции продажи от договора до учёта',
    estimatedHours: 12,
    isaReference: 'ISA 500 - Audit Evidence',
    riskLevel: 'high',
    evidenceRequired: ['Операционные листы', 'Учетные записи'],
  },

  // WALKTHROUGH (Пошаговое прохождение)
  {
    id: 'msa-018',
    area: 'internal_controls_audit',
    category: 'walkthrough',
    name: 'Пошаговое прохождение процесса продаж',
    description: 'Полное пошаговое прохождение цикла продаж и расчётов (МСА 330)',
    estimatedHours: 16,
    isaReference: 'ISA 330 - The Auditor\'s Responses to Assessed Risks',
    riskLevel: 'high',
    evidenceRequired: ['Блок-схема процесса', 'Протокол прохождения'],
  },

  // SAMPLING (Выборочная проверка)
  {
    id: 'msa-019',
    area: 'expenses',
    category: 'sampling',
    name: 'Выборочная проверка первичных документов по расходам',
    description: 'Статистическая выборка первичных документов за период (МСА 530)',
    estimatedHours: 14,
    isaReference: 'ISA 530 - Audit Sampling',
    riskLevel: 'medium',
    evidenceRequired: ['План выборки', 'Выборочная ведомость', 'Вывод по выборке'],
  },
];

// Риск-ориентированный подход (МСА 315, 320)
export const RISK_ASSESSMENT_GUIDE = {
  financial_audit: {
    description: 'Финансовый аудит на соответствие стандартам финансовой отчётности',
    procedures: ['inspection', 'confirmation', 'analytical_procedure'],
    isaReferences: ['ISA 200', 'ISA 315', 'ISA 330'],
  },
  internal_controls_audit: {
    description: 'Оценка надёжности систем внутреннего контроля',
    procedures: ['observation', 'walkthrough', 'inquiry'],
    isaReferences: ['ISA 315', 'ISA 330', 'ISA 260'],
  },
  compliance_audit: {
    description: 'Проверка соответствия нормативным требованиям',
    procedures: ['inspection', 'inquiry', 'recalculation'],
    isaReferences: ['ISA 250', 'ISA 260'],
  },
};

// Уровни материальности (МСА 320)
export const MATERIALITY_LEVELS = {
  financial_statements: 0.05,    // 5% от базы
  operating_profit: 0.05,        // 5%
  revenue: 0.01,                 // 1%
  equity: 0.05,                  // 5%
};
