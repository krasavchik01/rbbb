/**
 * Единая система аудита по Международным Стандартам Аудита (МСА/ISA)
 * Структура согласно IAASB Handbook 2023-2024
 *
 * Иерархия:
 * 1. Стандарт МСА (ISA 200-810)
 * 2. Этап аудита (7 этапов методологии Russell Bedford)
 * 3. Аудиторская процедура (7 типов по ISA 500)
 * 4. Рабочий документ (программа/файл)
 */

// ============================================
// МЕЖДУНАРОДНЫЕ СТАНДАРТЫ АУДИТА (ISA)
// ============================================

export type ISAStandardCode =
  // Общие принципы и обязанности (ISA 200-299)
  | 'ISA_200'  // Общие цели независимого аудитора
  | 'ISA_210'  // Согласование условий аудиторского задания
  | 'ISA_220'  // Управление качеством аудита
  | 'ISA_230'  // Аудиторская документация
  | 'ISA_240'  // Обязанности аудитора в отношении мошенничества
  | 'ISA_250'  // Соблюдение законов и нормативных актов
  | 'ISA_260'  // Информационное взаимодействие с руководством
  | 'ISA_265'  // Сообщение о недостатках внутреннего контроля

  // Планирование аудита (ISA 300-399)
  | 'ISA_300'  // Планирование аудита финансовой отчетности
  | 'ISA_315'  // Выявление и оценка рисков существенного искажения
  | 'ISA_320'  // Существенность при планировании и проведении аудита
  | 'ISA_330'  // Аудиторские процедуры в ответ на оцененные риски

  // Внутренний контроль (ISA 400-499)
  | 'ISA_402'  // Аудит организации, использующей сервисную организацию
  | 'ISA_450'  // Оценка искажений, выявленных в ходе аудита

  // Аудиторские доказательства (ISA 500-599)
  | 'ISA_500'  // Аудиторские доказательства
  | 'ISA_501'  // Аудиторские доказательства - особые аспекты
  | 'ISA_505'  // Внешние подтверждения
  | 'ISA_510'  // Аудит начальных сальдо
  | 'ISA_520'  // Аналитические процедуры
  | 'ISA_530'  // Аудиторская выборка
  | 'ISA_540'  // Аудит оценочных значений
  | 'ISA_550'  // Связанные стороны
  | 'ISA_560'  // События после отчетной даты
  | 'ISA_570'  // Непрерывность деятельности
  | 'ISA_580'  // Письменные заявления

  // Использование работы других лиц (ISA 600-699)
  | 'ISA_600'  // Аудит групповой финансовой отчетности
  | 'ISA_610'  // Использование работы внутренних аудиторов
  | 'ISA_620'  // Использование работы эксперта аудитора

  // Аудиторское заключение (ISA 700-799)
  | 'ISA_700'  // Формирование мнения и заключение
  | 'ISA_701'  // Ключевые вопросы аудита
  | 'ISA_705'  // Модификации мнения
  | 'ISA_706'  // Привлечение внимания и прочие вопросы
  | 'ISA_710'  // Сравнительная информация
  | 'ISA_720'  // Ответственность в отношении прочей информации

  // Специальные аудиты (ISA 800-899)
  | 'ISA_800'  // Аудит по специальным основам
  | 'ISA_805'  // Аудит отдельных отчетов
  | 'ISA_810'; // Задания по обзору

export interface ISAStandard {
  code: ISAStandardCode;
  number: number;
  nameRu: string;
  nameEn: string;
  description: string;
  category: 'general' | 'planning' | 'controls' | 'evidence' | 'others_work' | 'reporting' | 'special';
}

// ============================================
// 7 ТИПОВ АУДИТОРСКИХ ПРОЦЕДУР (ISA 500)
// ============================================

export type AuditProcedureType =
  | 'inspection'      // Инспектирование (проверка записей/документов/активов)
  | 'observation'     // Наблюдение (процессы/процедуры)
  | 'inquiry'         // Запрос (устный/письменный)
  | 'confirmation'    // Подтверждение (внешнее от третьих лиц)
  | 'recalculation'   // Пересчет (математическая точность)
  | 'reperformance'   // Повторное выполнение (независимое)
  | 'analytical';     // Аналитические процедуры

export interface ProcedureTypeInfo {
  type: AuditProcedureType;
  nameRu: string;
  nameEn: string;
  description: string;
  icon: string;
  applicableAssertions: FinancialAssertion[];
}

// ============================================
// ПРЕДПОСЫЛКИ ФИНАНСОВОЙ ОТЧЕТНОСТИ (ISA 315)
// ============================================

export type FinancialAssertion =
  // Предпосылки для классов операций
  | 'occurrence'       // Возникновение
  | 'completeness'     // Полнота
  | 'accuracy'         // Точность
  | 'cutoff'           // Отнесение к периоду
  | 'classification'   // Классификация

  // Предпосылки для сальдо счетов
  | 'existence'        // Существование
  | 'rights_obligations' // Права и обязанности
  | 'valuation'        // Оценка

  // Предпосылки для раскрытий
  | 'presentation';    // Представление

// ============================================
// ЭТАПЫ АУДИТА (Методология Russell Bedford)
// ============================================

export type AuditStage =
  | 'client_acceptance'    // 1. Принятие клиента (ISA 210, 220, МСУК-1)
  | 'planning'             // 2. Планирование (ISA 300, 320)
  | 'risk_assessment'      // 3. Оценка рисков (ISA 315, 330)
  | 'controls_testing'     // 4. Тестирование контролей (ISA 330, 402)
  | 'substantive_testing'  // 5. Субстантивные процедуры (ISA 500-580)
  | 'completion'           // 6. Завершение (ISA 560, 580)
  | 'reporting';           // 7. Заключение (ISA 700-720)

export interface AuditStageInfo {
  id: AuditStage;
  order: number;
  nameRu: string;
  nameEn: string;
  description: string;
  color: string;
  relatedISA: ISAStandardCode[];
  requiredRoles: AuditRole[];
}

// ============================================
// ОБЛАСТИ АУДИТА (по статьям отчетности)
// ============================================

export type AuditArea =
  // Активы
  | 'cash'               // Денежные средства
  | 'receivables'        // Дебиторская задолженность
  | 'inventory'          // Запасы
  | 'prepayments'        // Авансы выданные
  | 'fixed_assets'       // Основные средства
  | 'intangible_assets'  // Нематериальные активы
  | 'investments'        // Инвестиции
  | 'other_assets'       // Прочие активы

  // Обязательства
  | 'payables'           // Кредиторская задолженность
  | 'loans'              // Займы и кредиты
  | 'provisions'         // Резервы
  | 'deferred_tax'       // Отложенные налоги
  | 'other_liabilities'  // Прочие обязательства

  // Капитал
  | 'equity'             // Капитал
  | 'retained_earnings'  // Нераспределенная прибыль

  // Доходы и расходы
  | 'revenue'            // Выручка
  | 'cost_of_sales'      // Себестоимость
  | 'operating_expenses' // Операционные расходы
  | 'payroll'            // Расходы на персонал
  | 'other_income'       // Прочие доходы
  | 'other_expenses'     // Прочие расходы
  | 'taxes'              // Налоги

  // Специальные области
  | 'related_parties'    // Связанные стороны
  | 'going_concern'      // Непрерывность деятельности
  | 'subsequent_events'  // События после отчетной даты
  | 'disclosures';       // Раскрытия

// ============================================
// РОЛИ В АУДИТЕ
// ============================================

export type AuditRole =
  | 'partner'        // Партнер - подписывает заключение
  | 'manager'        // Менеджер - управляет проектом
  | 'senior'         // Старший аудитор - выполняет сложные процедуры
  | 'assistant'      // Ассистент - выполняет рутинные процедуры
  | 'specialist';    // Специалист (IT, налоги, оценка)

// ============================================
// УРОВНИ РИСКА (ISA 315)
// ============================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface RiskAssessment {
  inherentRisk: RiskLevel;       // Неотъемлемый риск
  controlRisk: RiskLevel;        // Риск контроля
  detectionRisk: RiskLevel;      // Риск необнаружения
  overallRisk: RiskLevel;        // Общий риск
  significantRisk: boolean;      // Значительный риск (ISA 315)
}

// ============================================
// АУДИТОРСКАЯ ПРОЦЕДУРА
// ============================================

export interface AuditProcedure {
  id: string;
  code: string;                          // Код процедуры (например, "REV-001")
  name: string;                          // Название
  description: string;                   // Описание

  // Классификация по МСА
  stage: AuditStage;                     // Этап аудита
  procedureType: AuditProcedureType;     // Тип процедуры (ISA 500)
  area: AuditArea;                       // Область аудита
  relatedISA: ISAStandardCode[];         // Связанные стандарты
  assertions: FinancialAssertion[];      // Проверяемые предпосылки

  // Риск и важность
  riskLevel: RiskLevel;
  isRequired: boolean;                   // Обязательная процедура
  isSamplingBased: boolean;             // Основана на выборке (ISA 530)

  // Исполнение
  requiredRole: AuditRole;
  estimatedHours: number;
  relatedDocuments: string[];            // ID связанных рабочих документов

  // Статус выполнения
  status: 'not_started' | 'in_progress' | 'completed' | 'reviewed' | 'issues_found';
  assignedTo?: string;
  actualHours?: number;
  completedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  // Результаты
  findings?: string;
  conclusion?: string;
  evidenceRefs?: string[];               // Ссылки на доказательства
}

// ============================================
// РАБОЧИЙ ДОКУМЕНТ
// ============================================

export type WorkDocumentType =
  | 'program'          // Программа аудита
  | 'working_paper'    // Рабочий файл
  | 'checklist'        // Чек-лист
  | 'memo'             // Меморандум
  | 'confirmation'     // Подтверждение
  | 'representation'   // Письменное заявление
  | 'report';          // Отчет

export interface WorkDocument {
  id: string;
  code: string;                          // Код документа (например, "WP-FA-001")
  name: string;
  type: WorkDocumentType;

  // Связь с методологией
  stage: AuditStage;
  area?: AuditArea;
  procedureIds: string[];                // Связанные процедуры

  // Файл
  fileName?: string;
  fileType: 'doc' | 'docx' | 'xls' | 'xlsx' | 'pdf';
  templateUrl?: string;

  // Исполнение
  requiredRole: AuditRole;
  isRequired: boolean;
  order: number;

  // Статус
  status: 'not_started' | 'draft' | 'completed' | 'reviewed';
  preparedBy?: string;
  reviewedBy?: string;
}

// ============================================
// ПРОЕКТ АУДИТА
// ============================================

export type AuditType =
  | 'statutory'        // Обязательный аудит
  | 'initiative'       // Инициативный аудит
  | 'ipo'              // Аудит для IPO
  | 'due_diligence'    // Due Diligence
  | 'special';         // Специальный аудит

export type ReportingFramework =
  | 'IFRS'             // МСФО
  | 'GAAP_KZ'          // НСФО Казахстан
  | 'GAAP_RU'          // РСБУ Россия
  | 'US_GAAP';         // US GAAP

export interface AuditProject {
  id: string;

  // Основная информация
  clientId: string;
  clientName: string;
  reportingPeriod: string;               // "2024" или "Q1 2024"
  auditType: AuditType;
  reportingFramework: ReportingFramework;

  // Команда
  partnerId: string;
  managerId: string;
  teamMembers: string[];

  // Существенность (ISA 320)
  materiality: {
    overall: number;                     // Общая существенность
    performance: number;                 // Рабочая существенность
    trivial: number;                     // Явно незначительные искажения
    basis: string;                       // База расчета
  };

  // Риск клиента (МСУК-1)
  clientRisk: {
    level: RiskLevel;
    factors: string[];
    requiresEQR: boolean;                // Требуется проверка качества
  };

  // Прогресс
  currentStage: AuditStage;
  procedures: AuditProcedure[];
  documents: WorkDocument[];

  // Сроки
  plannedStartDate: string;
  plannedEndDate: string;
  reportDeadline: string;

  // Статус
  status: 'draft' | 'planning' | 'fieldwork' | 'completion' | 'reporting' | 'archived';

  createdAt: string;
  updatedAt: string;
}

// ============================================
// СПРАВОЧНИКИ
// ============================================

export const ISA_STANDARDS: Record<ISAStandardCode, ISAStandard> = {
  ISA_200: { code: 'ISA_200', number: 200, nameRu: 'Общие цели независимого аудитора', nameEn: 'Overall Objectives of the Independent Auditor', description: 'Устанавливает общие цели аудитора при проведении аудита финансовой отчетности', category: 'general' },
  ISA_210: { code: 'ISA_210', number: 210, nameRu: 'Согласование условий аудиторского задания', nameEn: 'Agreeing the Terms of Audit Engagements', description: 'Согласование условий задания с руководством клиента', category: 'general' },
  ISA_220: { code: 'ISA_220', number: 220, nameRu: 'Управление качеством аудита', nameEn: 'Quality Management for an Audit', description: 'Ответственность за качество на уровне задания', category: 'general' },
  ISA_230: { code: 'ISA_230', number: 230, nameRu: 'Аудиторская документация', nameEn: 'Audit Documentation', description: 'Требования к оформлению рабочих документов', category: 'general' },
  ISA_240: { code: 'ISA_240', number: 240, nameRu: 'Обязанности аудитора в отношении мошенничества', nameEn: 'The Auditor\'s Responsibilities Relating to Fraud', description: 'Выявление и оценка рисков мошенничества', category: 'general' },
  ISA_250: { code: 'ISA_250', number: 250, nameRu: 'Соблюдение законов и нормативных актов', nameEn: 'Consideration of Laws and Regulations', description: 'Учет законодательных требований', category: 'general' },
  ISA_260: { code: 'ISA_260', number: 260, nameRu: 'Информационное взаимодействие с руководством', nameEn: 'Communication with Those Charged with Governance', description: 'Коммуникация с органами управления', category: 'general' },
  ISA_265: { code: 'ISA_265', number: 265, nameRu: 'Сообщение о недостатках внутреннего контроля', nameEn: 'Communicating Deficiencies in Internal Control', description: 'Информирование о недостатках контроля', category: 'general' },

  ISA_300: { code: 'ISA_300', number: 300, nameRu: 'Планирование аудита', nameEn: 'Planning an Audit of Financial Statements', description: 'Разработка общей стратегии и плана аудита', category: 'planning' },
  ISA_315: { code: 'ISA_315', number: 315, nameRu: 'Выявление и оценка рисков', nameEn: 'Identifying and Assessing the Risks of Material Misstatement', description: 'Понимание организации и оценка рисков', category: 'planning' },
  ISA_320: { code: 'ISA_320', number: 320, nameRu: 'Существенность', nameEn: 'Materiality in Planning and Performing an Audit', description: 'Определение уровня существенности', category: 'planning' },
  ISA_330: { code: 'ISA_330', number: 330, nameRu: 'Аудиторские процедуры в ответ на риски', nameEn: 'The Auditor\'s Responses to Assessed Risks', description: 'Разработка ответов на оцененные риски', category: 'planning' },

  ISA_402: { code: 'ISA_402', number: 402, nameRu: 'Аудит с использованием сервисной организации', nameEn: 'Audit Considerations Relating to a Service Organization', description: 'Учет использования сервисных организаций', category: 'controls' },
  ISA_450: { code: 'ISA_450', number: 450, nameRu: 'Оценка искажений', nameEn: 'Evaluation of Misstatements Identified During the Audit', description: 'Оценка выявленных искажений', category: 'controls' },

  ISA_500: { code: 'ISA_500', number: 500, nameRu: 'Аудиторские доказательства', nameEn: 'Audit Evidence', description: 'Требования к получению аудиторских доказательств', category: 'evidence' },
  ISA_501: { code: 'ISA_501', number: 501, nameRu: 'Аудиторские доказательства - особые аспекты', nameEn: 'Audit Evidence - Specific Considerations', description: 'Запасы, судебные дела, сегментная информация', category: 'evidence' },
  ISA_505: { code: 'ISA_505', number: 505, nameRu: 'Внешние подтверждения', nameEn: 'External Confirmations', description: 'Получение подтверждений от третьих лиц', category: 'evidence' },
  ISA_510: { code: 'ISA_510', number: 510, nameRu: 'Аудит начальных сальдо', nameEn: 'Initial Audit Engagements - Opening Balances', description: 'Проверка начальных остатков', category: 'evidence' },
  ISA_520: { code: 'ISA_520', number: 520, nameRu: 'Аналитические процедуры', nameEn: 'Analytical Procedures', description: 'Применение аналитических процедур', category: 'evidence' },
  ISA_530: { code: 'ISA_530', number: 530, nameRu: 'Аудиторская выборка', nameEn: 'Audit Sampling', description: 'Методы выборочного тестирования', category: 'evidence' },
  ISA_540: { code: 'ISA_540', number: 540, nameRu: 'Аудит оценочных значений', nameEn: 'Auditing Accounting Estimates', description: 'Проверка бухгалтерских оценок', category: 'evidence' },
  ISA_550: { code: 'ISA_550', number: 550, nameRu: 'Связанные стороны', nameEn: 'Related Parties', description: 'Выявление и проверка операций со связанными сторонами', category: 'evidence' },
  ISA_560: { code: 'ISA_560', number: 560, nameRu: 'События после отчетной даты', nameEn: 'Subsequent Events', description: 'Проверка событий после отчетной даты', category: 'evidence' },
  ISA_570: { code: 'ISA_570', number: 570, nameRu: 'Непрерывность деятельности', nameEn: 'Going Concern', description: 'Оценка способности продолжать деятельность', category: 'evidence' },
  ISA_580: { code: 'ISA_580', number: 580, nameRu: 'Письменные заявления', nameEn: 'Written Representations', description: 'Получение письменных заявлений руководства', category: 'evidence' },

  ISA_600: { code: 'ISA_600', number: 600, nameRu: 'Аудит групповой отчетности', nameEn: 'Special Considerations - Audits of Group Financial Statements', description: 'Аудит консолидированной отчетности', category: 'others_work' },
  ISA_610: { code: 'ISA_610', number: 610, nameRu: 'Использование работы внутренних аудиторов', nameEn: 'Using the Work of Internal Auditors', description: 'Взаимодействие с внутренним аудитом', category: 'others_work' },
  ISA_620: { code: 'ISA_620', number: 620, nameRu: 'Использование работы эксперта', nameEn: 'Using the Work of an Auditor\'s Expert', description: 'Привлечение экспертов', category: 'others_work' },

  ISA_700: { code: 'ISA_700', number: 700, nameRu: 'Формирование мнения и заключение', nameEn: 'Forming an Opinion and Reporting', description: 'Формирование аудиторского мнения', category: 'reporting' },
  ISA_701: { code: 'ISA_701', number: 701, nameRu: 'Ключевые вопросы аудита', nameEn: 'Communicating Key Audit Matters', description: 'Описание ключевых вопросов аудита', category: 'reporting' },
  ISA_705: { code: 'ISA_705', number: 705, nameRu: 'Модификации мнения', nameEn: 'Modifications to the Opinion', description: 'Модифицированные заключения', category: 'reporting' },
  ISA_706: { code: 'ISA_706', number: 706, nameRu: 'Привлечение внимания', nameEn: 'Emphasis of Matter Paragraphs', description: 'Параграфы привлечения внимания', category: 'reporting' },
  ISA_710: { code: 'ISA_710', number: 710, nameRu: 'Сравнительная информация', nameEn: 'Comparative Information', description: 'Сравнительные показатели', category: 'reporting' },
  ISA_720: { code: 'ISA_720', number: 720, nameRu: 'Прочая информация', nameEn: 'The Auditor\'s Responsibilities Relating to Other Information', description: 'Ответственность за прочую информацию', category: 'reporting' },

  ISA_800: { code: 'ISA_800', number: 800, nameRu: 'Аудит по специальным основам', nameEn: 'Special Considerations - Special Purpose Frameworks', description: 'Специальные рамки отчетности', category: 'special' },
  ISA_805: { code: 'ISA_805', number: 805, nameRu: 'Аудит отдельных отчетов', nameEn: 'Special Considerations - Audits of Single Financial Statements', description: 'Аудит отдельных элементов', category: 'special' },
  ISA_810: { code: 'ISA_810', number: 810, nameRu: 'Задания по обзору', nameEn: 'Engagements to Report on Summary Financial Statements', description: 'Обзорные проверки', category: 'special' },
};

export const PROCEDURE_TYPES: Record<AuditProcedureType, ProcedureTypeInfo> = {
  inspection: {
    type: 'inspection',
    nameRu: 'Инспектирование',
    nameEn: 'Inspection',
    description: 'Изучение записей, документов или физическое обследование активов',
    icon: 'Search',
    applicableAssertions: ['existence', 'rights_obligations', 'valuation', 'accuracy', 'completeness'],
  },
  observation: {
    type: 'observation',
    nameRu: 'Наблюдение',
    nameEn: 'Observation',
    description: 'Наблюдение за процессом или процедурой, выполняемой другими лицами',
    icon: 'Eye',
    applicableAssertions: ['existence', 'occurrence'],
  },
  inquiry: {
    type: 'inquiry',
    nameRu: 'Запрос',
    nameEn: 'Inquiry',
    description: 'Поиск информации у осведомленных лиц (устный или письменный)',
    icon: 'MessageCircle',
    applicableAssertions: ['completeness', 'occurrence', 'rights_obligations'],
  },
  confirmation: {
    type: 'confirmation',
    nameRu: 'Подтверждение',
    nameEn: 'External Confirmation',
    description: 'Получение прямого письменного ответа от третьей стороны',
    icon: 'CheckCircle',
    applicableAssertions: ['existence', 'rights_obligations', 'accuracy', 'completeness'],
  },
  recalculation: {
    type: 'recalculation',
    nameRu: 'Пересчет',
    nameEn: 'Recalculation',
    description: 'Проверка математической точности документов или записей',
    icon: 'Calculator',
    applicableAssertions: ['accuracy', 'valuation'],
  },
  reperformance: {
    type: 'reperformance',
    nameRu: 'Повторное выполнение',
    nameEn: 'Reperformance',
    description: 'Независимое выполнение процедур или контролей',
    icon: 'RefreshCw',
    applicableAssertions: ['accuracy', 'valuation', 'occurrence'],
  },
  analytical: {
    type: 'analytical',
    nameRu: 'Аналитические процедуры',
    nameEn: 'Analytical Procedures',
    description: 'Оценка финансовой информации через анализ взаимосвязей',
    icon: 'TrendingUp',
    applicableAssertions: ['completeness', 'accuracy', 'valuation', 'occurrence'],
  },
};

export const AUDIT_STAGES: AuditStageInfo[] = [
  {
    id: 'client_acceptance',
    order: 1,
    nameRu: 'Принятие клиента',
    nameEn: 'Client Acceptance',
    description: 'Оценка возможности принятия или продолжения аудиторского задания, проверка независимости (МСУК-1)',
    color: '#3b82f6',
    relatedISA: ['ISA_210', 'ISA_220'],
    requiredRoles: ['partner', 'manager'],
  },
  {
    id: 'planning',
    order: 2,
    nameRu: 'Планирование аудита',
    nameEn: 'Audit Planning',
    description: 'Разработка стратегии аудита, определение объёма, сроков и ресурсов',
    color: '#10b981',
    relatedISA: ['ISA_300', 'ISA_320'],
    requiredRoles: ['partner', 'manager'],
  },
  {
    id: 'risk_assessment',
    order: 3,
    nameRu: 'Оценка рисков',
    nameEn: 'Risk Assessment',
    description: 'Выявление и оценка рисков существенных искажений',
    color: '#f59e0b',
    relatedISA: ['ISA_315', 'ISA_330', 'ISA_240'],
    requiredRoles: ['manager', 'senior'],
  },
  {
    id: 'controls_testing',
    order: 4,
    nameRu: 'Тестирование контролей',
    nameEn: 'Controls Testing',
    description: 'Получение понимания системы внутреннего контроля и тестирование её эффективности',
    color: '#8b5cf6',
    relatedISA: ['ISA_315', 'ISA_330', 'ISA_402'],
    requiredRoles: ['senior', 'assistant'],
  },
  {
    id: 'substantive_testing',
    order: 5,
    nameRu: 'Субстантивные процедуры',
    nameEn: 'Substantive Testing',
    description: 'Сбор достаточных и надлежащих аудиторских доказательств',
    color: '#ef4444',
    relatedISA: ['ISA_500', 'ISA_505', 'ISA_520', 'ISA_530', 'ISA_540'],
    requiredRoles: ['senior', 'assistant'],
  },
  {
    id: 'completion',
    order: 6,
    nameRu: 'Завершение аудита',
    nameEn: 'Audit Completion',
    description: 'Обзор выполненных процедур, анализ искажений, получение заявлений руководства',
    color: '#06b6d4',
    relatedISA: ['ISA_450', 'ISA_560', 'ISA_580'],
    requiredRoles: ['partner', 'manager'],
  },
  {
    id: 'reporting',
    order: 7,
    nameRu: 'Заключение',
    nameEn: 'Reporting',
    description: 'Формирование аудиторского мнения и выпуск заключения',
    color: '#84cc16',
    relatedISA: ['ISA_700', 'ISA_701', 'ISA_705', 'ISA_706'],
    requiredRoles: ['partner'],
  },
];

export const AUDIT_AREAS: Record<AuditArea, { nameRu: string; nameEn: string; category: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses' | 'special' }> = {
  cash: { nameRu: 'Денежные средства', nameEn: 'Cash and Cash Equivalents', category: 'assets' },
  receivables: { nameRu: 'Дебиторская задолженность', nameEn: 'Trade Receivables', category: 'assets' },
  inventory: { nameRu: 'Запасы', nameEn: 'Inventories', category: 'assets' },
  prepayments: { nameRu: 'Авансы выданные', nameEn: 'Prepayments', category: 'assets' },
  fixed_assets: { nameRu: 'Основные средства', nameEn: 'Property, Plant and Equipment', category: 'assets' },
  intangible_assets: { nameRu: 'Нематериальные активы', nameEn: 'Intangible Assets', category: 'assets' },
  investments: { nameRu: 'Инвестиции', nameEn: 'Investments', category: 'assets' },
  other_assets: { nameRu: 'Прочие активы', nameEn: 'Other Assets', category: 'assets' },

  payables: { nameRu: 'Кредиторская задолженность', nameEn: 'Trade Payables', category: 'liabilities' },
  loans: { nameRu: 'Займы и кредиты', nameEn: 'Loans and Borrowings', category: 'liabilities' },
  provisions: { nameRu: 'Резервы', nameEn: 'Provisions', category: 'liabilities' },
  deferred_tax: { nameRu: 'Отложенные налоги', nameEn: 'Deferred Tax', category: 'liabilities' },
  other_liabilities: { nameRu: 'Прочие обязательства', nameEn: 'Other Liabilities', category: 'liabilities' },

  equity: { nameRu: 'Капитал', nameEn: 'Share Capital', category: 'equity' },
  retained_earnings: { nameRu: 'Нераспределенная прибыль', nameEn: 'Retained Earnings', category: 'equity' },

  revenue: { nameRu: 'Выручка', nameEn: 'Revenue', category: 'income' },
  other_income: { nameRu: 'Прочие доходы', nameEn: 'Other Income', category: 'income' },

  cost_of_sales: { nameRu: 'Себестоимость', nameEn: 'Cost of Sales', category: 'expenses' },
  operating_expenses: { nameRu: 'Операционные расходы', nameEn: 'Operating Expenses', category: 'expenses' },
  payroll: { nameRu: 'Расходы на персонал', nameEn: 'Payroll Expenses', category: 'expenses' },
  other_expenses: { nameRu: 'Прочие расходы', nameEn: 'Other Expenses', category: 'expenses' },
  taxes: { nameRu: 'Налоги', nameEn: 'Income Tax', category: 'expenses' },

  related_parties: { nameRu: 'Связанные стороны', nameEn: 'Related Parties', category: 'special' },
  going_concern: { nameRu: 'Непрерывность деятельности', nameEn: 'Going Concern', category: 'special' },
  subsequent_events: { nameRu: 'События после отчетной даты', nameEn: 'Subsequent Events', category: 'special' },
  disclosures: { nameRu: 'Раскрытия', nameEn: 'Disclosures', category: 'special' },
};
