/**
 * Библиотека стандартных аудиторских процедур по МСА
 * Организована по этапам аудита и областям проверки
 */

import {
  AuditProcedure,
  AuditArea,
  AuditStage,
  AuditProcedureType,
  RiskLevel,
  AuditRole,
  ISAStandardCode,
  FinancialAssertion,
} from '@/types/audit';

// ============================================
// ШАБЛОНЫ ПРОЦЕДУР ПО ОБЛАСТЯМ
// ============================================

interface ProcedureTemplate {
  code: string;
  name: string;
  description: string;
  stage: AuditStage;
  procedureType: AuditProcedureType;
  area: AuditArea;
  relatedISA: ISAStandardCode[];
  assertions: FinancialAssertion[];
  riskLevel: RiskLevel;
  isRequired: boolean;
  isSamplingBased: boolean;
  requiredRole: AuditRole;
  estimatedHours: number;
}

// ============================================
// 1. ПРИНЯТИЕ КЛИЕНТА (МСУК-1, ISA 210, 220)
// ============================================

export const CLIENT_ACCEPTANCE_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'CA-001',
    name: 'Проверка независимости команды',
    description: 'Проверить независимость всех членов команды и фирмы от клиента согласно Кодексу этики',
    stage: 'client_acceptance',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_220'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 2,
  },
  {
    code: 'CA-002',
    name: 'Оценка риска клиента (KYC)',
    description: 'Оценить риск клиента: финансовое положение, репутация, отрасль, судебные дела',
    stage: 'client_acceptance',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_210', 'ISA_220'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 3,
  },
  {
    code: 'CA-003',
    name: 'Согласование условий задания',
    description: 'Подготовить и согласовать письмо-обязательство с клиентом',
    stage: 'client_acceptance',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_210'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 2,
  },
  {
    code: 'CA-004',
    name: 'Коммуникация с предшествующим аудитором',
    description: 'Связаться с предшествующим аудитором для получения информации (при первичном аудите)',
    stage: 'client_acceptance',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_210', 'ISA_510'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: false,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 1,
  },
];

// ============================================
// 2. ПЛАНИРОВАНИЕ (ISA 300, 320)
// ============================================

export const PLANNING_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'PL-001',
    name: 'Понимание бизнеса клиента',
    description: 'Изучить бизнес, отрасль, внешнюю среду и применимую систему отчетности',
    stage: 'planning',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_300', 'ISA_315'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 4,
  },
  {
    code: 'PL-002',
    name: 'Расчет существенности',
    description: 'Рассчитать общую, рабочую существенность и порог явно незначительных искажений',
    stage: 'planning',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_320'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 2,
  },
  {
    code: 'PL-003',
    name: 'Предварительные аналитические процедуры',
    description: 'Выполнить предварительный анализ финансовой отчетности для выявления областей риска',
    stage: 'planning',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_315', 'ISA_520'],
    assertions: ['completeness', 'accuracy'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
  {
    code: 'PL-004',
    name: 'Планирование состава команды',
    description: 'Определить состав команды с учетом компетенций и объема работы',
    stage: 'planning',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_300', 'ISA_220'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 2,
  },
  {
    code: 'PL-005',
    name: 'Разработка общего плана аудита',
    description: 'Подготовить общий план аудита с указанием сроков, процедур и ресурсов',
    stage: 'planning',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_300'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 3,
  },
];

// ============================================
// 3. ОЦЕНКА РИСКОВ (ISA 315, 330, 240)
// ============================================

export const RISK_ASSESSMENT_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'RA-001',
    name: 'Оценка рисков существенного искажения',
    description: 'Выявить и оценить риски существенного искажения на уровне отчетности и утверждений',
    stage: 'risk_assessment',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_315'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 4,
  },
  {
    code: 'RA-002',
    name: 'Оценка рисков мошенничества',
    description: 'Оценить риски мошенничества: признание выручки, обход контролей руководством',
    stage: 'risk_assessment',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_240'],
    assertions: ['occurrence', 'accuracy'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 3,
  },
  {
    code: 'RA-003',
    name: 'Выявление значительных рисков',
    description: 'Определить значительные риски, требующие особого аудиторского внимания',
    stage: 'risk_assessment',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_315', 'ISA_330'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 2,
  },
  {
    code: 'RA-004',
    name: 'Разработка ответов на риски',
    description: 'Разработать аудиторские процедуры в ответ на оцененные риски',
    stage: 'risk_assessment',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_330'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 3,
  },
];

// ============================================
// 4. ТЕСТИРОВАНИЕ КОНТРОЛЕЙ (ISA 330, 402)
// ============================================

export const CONTROLS_TESTING_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'CT-001',
    name: 'Описание системы внутреннего контроля',
    description: 'Задокументировать понимание ключевых контролей по значимым циклам',
    stage: 'controls_testing',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_315'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
  {
    code: 'CT-002',
    name: 'Сквозная проверка (walkthrough)',
    description: 'Провести сквозную проверку ключевых процессов от начала до конца',
    stage: 'controls_testing',
    procedureType: 'observation',
    area: 'disclosures',
    relatedISA: ['ISA_315', 'ISA_330'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 6,
  },
  {
    code: 'CT-003',
    name: 'Тестирование операционной эффективности контролей',
    description: 'Протестировать контроли на выборке транзакций',
    stage: 'controls_testing',
    procedureType: 'reperformance',
    area: 'disclosures',
    relatedISA: ['ISA_330'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: false,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 8,
  },
  {
    code: 'CT-004',
    name: 'Оценка IT-контролей',
    description: 'Оценить общие IT-контроли и контроли приложений',
    stage: 'controls_testing',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_315'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: false,
    isSamplingBased: false,
    requiredRole: 'specialist',
    estimatedHours: 4,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - ДЕНЕЖНЫЕ СРЕДСТВА
// ============================================

export const CASH_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'CASH-001',
    name: 'Подтверждение банковских остатков',
    description: 'Получить подтверждения остатков от всех банков на отчетную дату',
    stage: 'substantive_testing',
    procedureType: 'confirmation',
    area: 'cash',
    relatedISA: ['ISA_505', 'ISA_500'],
    assertions: ['existence', 'completeness', 'rights_obligations'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'CASH-002',
    name: 'Сверка банковских выписок',
    description: 'Проверить сверку между выписками банка и учетом на отчетную дату',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'cash',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'completeness'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'assistant',
    estimatedHours: 2,
  },
  {
    code: 'CASH-003',
    name: 'Проверка кассы',
    description: 'Провести инвентаризацию кассы или проверить акт инвентаризации',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'cash',
    relatedISA: ['ISA_500', 'ISA_501'],
    assertions: ['existence', 'accuracy'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'assistant',
    estimatedHours: 1,
  },
  {
    code: 'CASH-004',
    name: 'Анализ движения денежных средств',
    description: 'Проанализировать необычные движения по счетам',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'cash',
    relatedISA: ['ISA_520'],
    assertions: ['occurrence', 'completeness'],
    riskLevel: 'medium',
    isRequired: false,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 2,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - ДЕБИТОРСКАЯ ЗАДОЛЖЕННОСТЬ
// ============================================

export const RECEIVABLES_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'REC-001',
    name: 'Подтверждение дебиторской задолженности',
    description: 'Направить запросы на подтверждение остатков крупнейшим дебиторам',
    stage: 'substantive_testing',
    procedureType: 'confirmation',
    area: 'receivables',
    relatedISA: ['ISA_505', 'ISA_500'],
    assertions: ['existence', 'accuracy', 'rights_obligations'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 6,
  },
  {
    code: 'REC-002',
    name: 'Анализ просроченной задолженности',
    description: 'Проанализировать возрастную структуру дебиторской задолженности',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'receivables',
    relatedISA: ['ISA_520', 'ISA_540'],
    assertions: ['valuation', 'accuracy'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'REC-003',
    name: 'Тестирование резерва по сомнительным долгам',
    description: 'Оценить адекватность резерва по сомнительным долгам',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'receivables',
    relatedISA: ['ISA_540'],
    assertions: ['valuation', 'accuracy'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'REC-004',
    name: 'Проверка cut-off продаж',
    description: 'Проверить отнесение продаж к правильному периоду',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'receivables',
    relatedISA: ['ISA_500'],
    assertions: ['cutoff', 'occurrence'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - ЗАПАСЫ
// ============================================

export const INVENTORY_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'INV-001',
    name: 'Наблюдение за инвентаризацией',
    description: 'Присутствовать при инвентаризации запасов клиента',
    stage: 'substantive_testing',
    procedureType: 'observation',
    area: 'inventory',
    relatedISA: ['ISA_501', 'ISA_500'],
    assertions: ['existence', 'completeness'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 8,
  },
  {
    code: 'INV-002',
    name: 'Тестовые пересчеты',
    description: 'Выполнить выборочные пересчеты запасов при инвентаризации',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'inventory',
    relatedISA: ['ISA_501'],
    assertions: ['existence', 'accuracy'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 4,
  },
  {
    code: 'INV-003',
    name: 'Проверка себестоимости запасов',
    description: 'Проверить правильность оценки запасов (FIFO, средняя и т.д.)',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'inventory',
    relatedISA: ['ISA_500'],
    assertions: ['valuation', 'accuracy'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
  {
    code: 'INV-004',
    name: 'Анализ чистой стоимости реализации',
    description: 'Оценить необходимость обесценения до чистой стоимости реализации',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'inventory',
    relatedISA: ['ISA_540'],
    assertions: ['valuation'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 2,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - ОСНОВНЫЕ СРЕДСТВА
// ============================================

export const FIXED_ASSETS_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'FA-001',
    name: 'Проверка движения основных средств',
    description: 'Проверить поступления и выбытия основных средств за период',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'fixed_assets',
    relatedISA: ['ISA_500'],
    assertions: ['occurrence', 'completeness', 'accuracy'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
  {
    code: 'FA-002',
    name: 'Пересчет амортизации',
    description: 'Проверить правильность начисления амортизации',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'fixed_assets',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'valuation'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 3,
  },
  {
    code: 'FA-003',
    name: 'Физическая проверка активов',
    description: 'Выполнить выборочную физическую проверку существования активов',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'fixed_assets',
    relatedISA: ['ISA_500'],
    assertions: ['existence'],
    riskLevel: 'medium',
    isRequired: false,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 3,
  },
  {
    code: 'FA-004',
    name: 'Проверка обесценения',
    description: 'Оценить признаки обесценения и адекватность тестов на обесценение',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'fixed_assets',
    relatedISA: ['ISA_540'],
    assertions: ['valuation'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - ВЫРУЧКА
// ============================================

export const REVENUE_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'REV-001',
    name: 'Аналитические процедуры по выручке',
    description: 'Выполнить помесячный анализ выручки, сравнение с прошлым периодом и бюджетом',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'revenue',
    relatedISA: ['ISA_520'],
    assertions: ['completeness', 'accuracy', 'cutoff'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
  {
    code: 'REV-002',
    name: 'Тестирование выручки на выборке',
    description: 'Проверить первичные документы по выборке операций (договор, накладная, акт)',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'revenue',
    relatedISA: ['ISA_500', 'ISA_530'],
    assertions: ['occurrence', 'accuracy', 'classification'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 6,
  },
  {
    code: 'REV-003',
    name: 'Проверка cut-off выручки',
    description: 'Проверить отнесение выручки к правильному периоду на границе периодов',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'revenue',
    relatedISA: ['ISA_500'],
    assertions: ['cutoff', 'occurrence'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'REV-004',
    name: 'Анализ кредит-нот и возвратов',
    description: 'Проверить выданные кредит-ноты и возвраты после отчетной даты',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'revenue',
    relatedISA: ['ISA_500', 'ISA_560'],
    assertions: ['occurrence', 'accuracy'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 2,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - СЕБЕСТОИМОСТЬ И РАСХОДЫ
// ============================================

export const EXPENSES_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'EXP-001',
    name: 'Аналитические процедуры по расходам',
    description: 'Помесячный анализ расходов, сравнение с прошлым периодом',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'operating_expenses',
    relatedISA: ['ISA_520'],
    assertions: ['completeness', 'accuracy'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'EXP-002',
    name: 'Тестирование расходов на выборке',
    description: 'Проверить первичные документы по выборке расходов',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'operating_expenses',
    relatedISA: ['ISA_500', 'ISA_530'],
    assertions: ['occurrence', 'accuracy', 'classification'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 5,
  },
  {
    code: 'EXP-003',
    name: 'Проверка cut-off расходов',
    description: 'Проверить отнесение расходов к правильному периоду',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'operating_expenses',
    relatedISA: ['ISA_500'],
    assertions: ['cutoff', 'completeness'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'COGS-001',
    name: 'Анализ себестоимости',
    description: 'Проанализировать структуру и динамику себестоимости, маржинальность',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'cost_of_sales',
    relatedISA: ['ISA_520'],
    assertions: ['accuracy', 'completeness'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - КРЕДИТОРСКАЯ ЗАДОЛЖЕННОСТЬ
// ============================================

export const PAYABLES_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'PAY-001',
    name: 'Подтверждение кредиторской задолженности',
    description: 'Направить запросы на подтверждение остатков крупнейшим кредиторам',
    stage: 'substantive_testing',
    procedureType: 'confirmation',
    area: 'payables',
    relatedISA: ['ISA_505', 'ISA_500'],
    assertions: ['completeness', 'accuracy', 'rights_obligations'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
  {
    code: 'PAY-002',
    name: 'Поиск неучтенных обязательств',
    description: 'Проверить платежи после отчетной даты на предмет неучтенных обязательств',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'payables',
    relatedISA: ['ISA_500', 'ISA_560'],
    assertions: ['completeness'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
  {
    code: 'PAY-003',
    name: 'Проверка cut-off закупок',
    description: 'Проверить отнесение закупок к правильному периоду',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'payables',
    relatedISA: ['ISA_500'],
    assertions: ['cutoff', 'completeness'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'senior',
    estimatedHours: 3,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - РАСХОДЫ НА ПЕРСОНАЛ
// ============================================

export const PAYROLL_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'PAY-HR-001',
    name: 'Аналитические процедуры по ФОТ',
    description: 'Помесячный анализ ФОТ, сравнение со штатным расписанием',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'payroll',
    relatedISA: ['ISA_520'],
    assertions: ['completeness', 'accuracy'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 2,
  },
  {
    code: 'PAY-HR-002',
    name: 'Тестирование начислений на выборке',
    description: 'Проверить расчет зарплаты на выборке сотрудников',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'payroll',
    relatedISA: ['ISA_500', 'ISA_530'],
    assertions: ['accuracy', 'occurrence'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 4,
  },
  {
    code: 'PAY-HR-003',
    name: 'Проверка налогов с ФОТ',
    description: 'Проверить правильность расчета и уплаты налогов с ФОТ',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'payroll',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'completeness'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 2,
  },
];

// ============================================
// 5. СУБСТАНТИВНЫЕ ПРОЦЕДУРЫ - СПЕЦИАЛЬНЫЕ ОБЛАСТИ
// ============================================

export const SPECIAL_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'SP-001',
    name: 'Проверка связанных сторон',
    description: 'Выявить связанные стороны и проверить раскрытие операций с ними',
    stage: 'substantive_testing',
    procedureType: 'inquiry',
    area: 'related_parties',
    relatedISA: ['ISA_550'],
    assertions: ['completeness', 'accuracy', 'presentation'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 4,
  },
  {
    code: 'SP-002',
    name: 'Оценка непрерывности деятельности',
    description: 'Оценить способность организации продолжать деятельность',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'going_concern',
    relatedISA: ['ISA_570'],
    assertions: ['presentation'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 3,
  },
  {
    code: 'SP-003',
    name: 'Проверка событий после отчетной даты',
    description: 'Проверить события между отчетной датой и датой заключения',
    stage: 'substantive_testing',
    procedureType: 'inquiry',
    area: 'subsequent_events',
    relatedISA: ['ISA_560'],
    assertions: ['completeness', 'occurrence'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 3,
  },
  {
    code: 'SP-004',
    name: 'Проверка раскрытий',
    description: 'Проверить полноту и правильность раскрытий в примечаниях',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'disclosures',
    relatedISA: ['ISA_700'],
    assertions: ['completeness', 'accuracy', 'presentation'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'senior',
    estimatedHours: 4,
  },
];

// ============================================
// 6. ЗАВЕРШЕНИЕ АУДИТА (ISA 450, 560, 580)
// ============================================

export const COMPLETION_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'COM-001',
    name: 'Оценка совокупности искажений',
    description: 'Оценить влияние выявленных искажений на финансовую отчетность',
    stage: 'completion',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_450'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 2,
  },
  {
    code: 'COM-002',
    name: 'Получение письменных заявлений',
    description: 'Получить письмо-представление от руководства клиента',
    stage: 'completion',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_580'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 2,
  },
  {
    code: 'COM-003',
    name: 'Заключительные аналитические процедуры',
    description: 'Выполнить финальный анализ финансовой отчетности',
    stage: 'completion',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_520'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 2,
  },
  {
    code: 'COM-004',
    name: 'Обзор рабочих документов',
    description: 'Провести обзор полноты и качества аудиторской документации',
    stage: 'completion',
    procedureType: 'inspection',
    area: 'disclosures',
    relatedISA: ['ISA_230', 'ISA_220'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 4,
  },
];

// ============================================
// 7. ЗАКЛЮЧЕНИЕ (ISA 700-720)
// ============================================

export const REPORTING_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'REP-001',
    name: 'Формирование аудиторского мнения',
    description: 'Сформировать и задокументировать аудиторское мнение',
    stage: 'reporting',
    procedureType: 'analytical',
    area: 'disclosures',
    relatedISA: ['ISA_700'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 3,
  },
  {
    code: 'REP-002',
    name: 'Определение ключевых вопросов аудита',
    description: 'Определить ключевые вопросы аудита для включения в заключение',
    stage: 'reporting',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_701'],
    assertions: [],
    riskLevel: 'high',
    isRequired: false,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 2,
  },
  {
    code: 'REP-003',
    name: 'Подготовка аудиторского заключения',
    description: 'Подготовить текст аудиторского заключения',
    stage: 'reporting',
    procedureType: 'inspection',
    area: 'disclosures',
    relatedISA: ['ISA_700', 'ISA_705', 'ISA_706'],
    assertions: [],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 2,
  },
  {
    code: 'REP-004',
    name: 'Коммуникация с руководством',
    description: 'Подготовить и направить письмо руководству о результатах аудита',
    stage: 'reporting',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_260', 'ISA_265'],
    assertions: [],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 3,
  },
];

// ============================================
// ВСЕ ПРОЦЕДУРЫ
// ============================================

export const ALL_PROCEDURE_TEMPLATES: ProcedureTemplate[] = [
  ...CLIENT_ACCEPTANCE_PROCEDURES,
  ...PLANNING_PROCEDURES,
  ...RISK_ASSESSMENT_PROCEDURES,
  ...CONTROLS_TESTING_PROCEDURES,
  ...CASH_PROCEDURES,
  ...RECEIVABLES_PROCEDURES,
  ...INVENTORY_PROCEDURES,
  ...FIXED_ASSETS_PROCEDURES,
  ...REVENUE_PROCEDURES,
  ...EXPENSES_PROCEDURES,
  ...PAYABLES_PROCEDURES,
  ...PAYROLL_PROCEDURES,
  ...SPECIAL_PROCEDURES,
  ...COMPLETION_PROCEDURES,
  ...REPORTING_PROCEDURES,
];

// ============================================
// ФУНКЦИИ РАБОТЫ С ПРОЦЕДУРАМИ
// ============================================

/**
 * Создать процедуру из шаблона
 */
export function createProcedureFromTemplate(
  template: ProcedureTemplate,
  projectId: string
): AuditProcedure {
  return {
    id: `${projectId}-${template.code}-${Date.now()}`,
    code: template.code,
    name: template.name,
    description: template.description,
    stage: template.stage,
    procedureType: template.procedureType,
    area: template.area,
    relatedISA: template.relatedISA,
    assertions: template.assertions,
    riskLevel: template.riskLevel,
    isRequired: template.isRequired,
    isSamplingBased: template.isSamplingBased,
    requiredRole: template.requiredRole,
    estimatedHours: template.estimatedHours,
    relatedDocuments: [],
    status: 'not_started',
  };
}

/**
 * Получить процедуры по этапу
 */
export function getProceduresByStage(stage: AuditStage): ProcedureTemplate[] {
  return ALL_PROCEDURE_TEMPLATES.filter(p => p.stage === stage);
}

/**
 * Получить процедуры по области
 */
export function getProceduresByArea(area: AuditArea): ProcedureTemplate[] {
  return ALL_PROCEDURE_TEMPLATES.filter(p => p.area === area);
}

/**
 * Получить обязательные процедуры
 */
export function getRequiredProcedures(): ProcedureTemplate[] {
  return ALL_PROCEDURE_TEMPLATES.filter(p => p.isRequired);
}

/**
 * Получить процедуры по типу (ISA 500)
 */
export function getProceduresByType(type: AuditProcedureType): ProcedureTemplate[] {
  return ALL_PROCEDURE_TEMPLATES.filter(p => p.procedureType === type);
}

/**
 * Получить процедуры высокого риска
 */
export function getHighRiskProcedures(): ProcedureTemplate[] {
  return ALL_PROCEDURE_TEMPLATES.filter(p => p.riskLevel === 'high' || p.riskLevel === 'very_high');
}

/**
 * Получить процедуры по роли
 */
export function getProceduresByRole(role: AuditRole): ProcedureTemplate[] {
  return ALL_PROCEDURE_TEMPLATES.filter(p => p.requiredRole === role);
}

/**
 * Рассчитать общее время для набора процедур
 */
export function calculateTotalHours(procedures: ProcedureTemplate[]): number {
  return procedures.reduce((sum, p) => sum + p.estimatedHours, 0);
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ПРОЦЕДУРЫ ДЛЯ РЫНКА РК
// ============================================

export const KAZAKHSTAN_SPECIFIC_PROCEDURES: ProcedureTemplate[] = [
  {
    code: 'KZ-TAX-001',
    name: 'Проверка налоговой отчетности РК',
    description: 'Проверить соответствие налоговой отчетности требованиям Налогового кодекса РК (форма 100.00, 101.00, 200.00 и др.)',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'tax_compliance',
    relatedISA: ['ISA_250', 'ISA_500'],
    assertions: ['accuracy', 'completeness', 'presentation'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'tax_specialist',
    estimatedHours: 8,
  },
  {
    code: 'KZ-TAX-002',
    name: 'Проверка расчетов по КПН',
    description: 'Проверить правильность исчисления корпоративного подоходного налога по ставкам 20% (обычная) или 10% (для IT-компаний)',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'tax_compliance',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'valuation'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'tax_specialist',
    estimatedHours: 6,
  },
  {
    code: 'KZ-TAX-003',
    name: 'Проверка НДС (12%)',
    description: 'Проверить правильность расчета НДС по ставке 12%, наличие счетов-фактур в ЭСФ, своевременность уплаты',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'tax_compliance',
    relatedISA: ['ISA_500', 'ISA_530'],
    assertions: ['accuracy', 'completeness', 'occurrence'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'tax_specialist',
    estimatedHours: 10,
  },
  {
    code: 'KZ-SOC-001',
    name: 'Проверка социальных отчислений',
    description: 'Проверить правильность расчета и уплаты социальных отчислений (СО 9.5%), социального налога (СН 9.5%), отчислений на ОСМС (2%), ОПВС (3.5%)',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'payroll',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'completeness'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 6,
  },
  {
    code: 'KZ-FIN-001',
    name: 'Соответствие НСФО/МСФО',
    description: 'Проверить соответствие финансовой отчетности требованиям Национальных стандартов финансовой отчетности (НСФО) или МСФО в зависимости от категории компании',
    stage: 'reporting',
    procedureType: 'inspection',
    area: 'disclosures',
    relatedISA: ['ISA_700', 'ISA_720'],
    assertions: ['presentation', 'classification'],
    riskLevel: 'high',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 5,
  },
  {
    code: 'KZ-FIN-002',
    name: 'Проверка форм финотчетности РК',
    description: 'Проверить наличие и правильность заполнения обязательных форм: Бухгалтерский баланс, ОПУ, ОДС, Отчет об изменениях в капитале, Примечания',
    stage: 'reporting',
    procedureType: 'inspection',
    area: 'disclosures',
    relatedISA: ['ISA_700'],
    assertions: ['completeness', 'presentation'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'manager',
    estimatedHours: 4,
  },
  {
    code: 'KZ-LABOR-001',
    name: 'Проверка трудовых договоров',
    description: 'Проверить соответствие трудовых договоров требованиям Трудового кодекса РК: форма, содержание, регистрация в ЦОН',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'payroll',
    relatedISA: ['ISA_250', 'ISA_500'],
    assertions: ['occurrence', 'completeness'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 3,
  },
  {
    code: 'KZ-LABOR-002',
    name: 'Проверка соответствия МРОТ',
    description: 'Проверить, что заработная плата не ниже МРОТ (85 000 тенге с 01.01.2024), учет районных коэффициентов',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'payroll',
    relatedISA: ['ISA_250', 'ISA_500'],
    assertions: ['accuracy', 'valuation'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: true,
    requiredRole: 'assistant',
    estimatedHours: 2,
  },
  {
    code: 'KZ-BANK-001',
    name: 'Проверка валютного контроля',
    description: 'Проверить соблюдение требований валютного законодательства РК: репатриация валютной выручки, разрешения НБ РК на операции',
    stage: 'substantive_testing',
    procedureType: 'inspection',
    area: 'cash',
    relatedISA: ['ISA_250', 'ISA_500'],
    assertions: ['completeness', 'rights_obligations'],
    riskLevel: 'high',
    isRequired: false, // Только для компаний с валютными операциями
    isSamplingBased: true,
    requiredRole: 'manager',
    estimatedHours: 4,
  },
  {
    code: 'KZ-PROP-001',
    name: 'Проверка налога на имущество',
    description: 'Проверить правильность исчисления налога на имущество по ставкам 0.5-1.5% в зависимости от категории имущества',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'fixed_assets',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'valuation'],
    riskLevel: 'medium',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'assistant',
    estimatedHours: 3,
  },
  {
    code: 'KZ-LAND-001',
    name: 'Проверка земельного налога',
    description: 'Проверить правильность исчисления земельного налога согласно налоговому кодексу РК и базовым ставкам по регионам',
    stage: 'substantive_testing',
    procedureType: 'recalculation',
    area: 'fixed_assets',
    relatedISA: ['ISA_500'],
    assertions: ['accuracy', 'completeness'],
    riskLevel: 'medium',
    isRequired: false, // Только для землевладельцев
    isSamplingBased: false,
    requiredRole: 'assistant',
    estimatedHours: 2,
  },
  {
    code: 'KZ-TRANS-001',
    name: 'Проверка трансфертного ценообразования',
    description: 'Проверить соблюдение правил трансфертного ценообразования для сделок со связанными сторонами (если годовой доход >3 млрд тенге)',
    stage: 'substantive_testing',
    procedureType: 'analytical',
    area: 'related_parties',
    relatedISA: ['ISA_550'],
    assertions: ['valuation', 'accuracy'],
    riskLevel: 'very_high',
    isRequired: false, // Только для крупных компаний
    isSamplingBased: false,
    requiredRole: 'partner',
    estimatedHours: 12,
  },
  {
    code: 'KZ-STAT-001',
    name: 'Проверка статистической отчетности',
    description: 'Проверить наличие и своевременность сдачи статистической отчетности в Бюро национальной статистики (БНС)',
    stage: 'completion',
    procedureType: 'inquiry',
    area: 'disclosures',
    relatedISA: ['ISA_250'],
    assertions: ['completeness'],
    riskLevel: 'low',
    isRequired: true,
    isSamplingBased: false,
    requiredRole: 'assistant',
    estimatedHours: 1,
  },
];

// Добавляем КЗ-процедуры в общий список
export const ALL_PROCEDURE_TEMPLATES_WITH_KZ = [
  ...ALL_PROCEDURE_TEMPLATES,
  ...KAZAKHSTAN_SPECIFIC_PROCEDURES,
];

/**
 * Получить только процедуры для РК
 */
export function getKazakhstanProcedures(): ProcedureTemplate[] {
  return KAZAKHSTAN_SPECIFIC_PROCEDURES;
}

/**
 * Получить процедуры с учетом региона
 */
export function getProceduresByRegion(includeKZ: boolean = true): ProcedureTemplate[] {
  return includeKZ ? ALL_PROCEDURE_TEMPLATES_WITH_KZ : ALL_PROCEDURE_TEMPLATES;
}
