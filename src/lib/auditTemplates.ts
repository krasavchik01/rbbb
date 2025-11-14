/**
 * Каталог шаблонов аудита Russell Bedford
 * Интеграция рабочих файлов из Google Drive в методологию
 */

export type TemplateCategory = 
  | 'general'           // Общие рабочие файлы
  | 'planning'          // Планирование
  | 'risk-assessment'   // Оценка рисков
  | 'controls'          // Контроли
  | 'substantive'       // Субстантивные процедуры
  | 'completion';       // Завершение

export type TemplateRole = 
  | 'partner' 
  | 'manager' 
  | 'senior_auditor' 
  | 'assistant'
  | 'tax_specialist';

export interface AuditTemplate {
  id: string;
  name: string;
  fileName: string;
  description: string;
  category: TemplateCategory;
  stageId: string;              // ID этапа методологии
  elementId?: string;          // ID элемента (если привязан к конкретному элементу)
  requiredRole: TemplateRole;   // Кто должен заполнять
  fileType: 'doc' | 'docx' | 'xls' | 'xlsx' | 'pdf';
  googleDriveId?: string;       // ID файла в Google Drive (если доступен)
  order: number;
  isRequired: boolean;
  relatedTemplates?: string[];  // Связанные шаблоны
}

/**
 * Общие рабочие файлы (Папка 1)
 */
export const GENERAL_TEMPLATES: AuditTemplate[] = [
  {
    id: 'tpl-001',
    name: 'Содержание (Table of contents)',
    fileName: 'AA_Table_of_contents.doc',
    description: 'Содержание проекта аудита',
    category: 'general',
    stageId: 'stage-1',
    requiredRole: 'assistant',
    fileType: 'doc',
    order: 1,
    isRequired: true
  },
  {
    id: 'tpl-002',
    name: 'Содержание ключевых процессов',
    fileName: 'AA_Content_of_Key_process_file.doc',
    description: 'Описание ключевых процессов клиента',
    category: 'general',
    stageId: 'stage-2',
    requiredRole: 'assistant',
    fileType: 'doc',
    order: 2,
    isRequired: true
  },
  {
    id: 'tpl-003',
    name: 'Сводка запросов (Inquiry Summary)',
    fileName: 'AA_2004_Inquiry_Summary.doc',
    description: 'Сводка запросов и ответов клиента',
    category: 'general',
    stageId: 'stage-1',
    requiredRole: 'assistant',
    fileType: 'doc',
    order: 3,
    isRequired: false
  },
  {
    id: 'tpl-004',
    name: 'Чек-лист аудита',
    fileName: 'AA_A1_2004_Audit_checklist.doc',
    description: 'Чек-лист для проверки полноты аудита',
    category: 'general',
    stageId: 'stage-1',
    elementId: 'el-1-2',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 4,
    isRequired: true
  },
  {
    id: 'tpl-005',
    name: 'SIDD (Система независимости)',
    fileName: 'AA_A2_SIDD_final_AK.doc',
    description: 'Проверка независимости команды и фирмы',
    category: 'general',
    stageId: 'stage-1',
    elementId: 'el-1-2',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 5,
    isRequired: true
  },
  {
    id: 'tpl-006',
    name: 'Форма принятия клиента',
    fileName: 'AA_A3_1_Client_Acceptance_Form.doc',
    description: 'Форма для принятия решения о работе с клиентом',
    category: 'general',
    stageId: 'stage-1',
    elementId: 'el-1-4',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 6,
    isRequired: true
  },
  {
    id: 'tpl-007',
    name: 'Форма оценки задания',
    fileName: 'AA_A3_2_Engagement_evaluation_Acceptance_Form.doc',
    description: 'Оценка возможности выполнения задания',
    category: 'general',
    stageId: 'stage-1',
    elementId: 'el-1-4',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 7,
    isRequired: true
  },
  {
    id: 'tpl-008',
    name: 'Юридическое письмо',
    fileName: 'AA_A4_1_Legal_letter.doc',
    description: 'Письмо-обязательство для клиента',
    category: 'general',
    stageId: 'stage-1',
    elementId: 'el-1-5',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 8,
    isRequired: true
  },
  {
    id: 'tpl-009',
    name: 'Бюджет проекта',
    fileName: 'AA_A5_Budget.xls',
    description: 'Бюджет аудиторского задания',
    category: 'planning',
    stageId: 'stage-2',
    elementId: 'el-2-4',
    requiredRole: 'manager',
    fileType: 'xls',
    order: 9,
    isRequired: true
  },
  {
    id: 'tpl-010',
    name: 'Форма предвыпуска',
    fileName: 'AA_B2_2_Preissuance_form_final_IAS.doc',
    description: 'Форма предвыпуска заключения',
    category: 'completion',
    stageId: 'stage-6',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 10,
    isRequired: false
  },
  {
    id: 'tpl-011',
    name: 'Письмо руководству (RepLetter)',
    fileName: 'AA_B7_RepLetter.doc',
    description: 'Письмо руководству клиента о результатах аудита',
    category: 'completion',
    stageId: 'stage-6',
    elementId: 'el-6-4',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 11,
    isRequired: true
  },
  {
    id: 'tpl-012',
    name: 'Налоговый меморандум',
    fileName: 'AA_B9_1_Tax_Memo.doc',
    description: 'Меморандум по налоговым вопросам',
    category: 'general',
    stageId: 'stage-1',
    requiredRole: 'tax_specialist',
    fileType: 'doc',
    order: 12,
    isRequired: false
  },
  {
    id: 'tpl-013',
    name: 'Меморандум предшествующему аудитору',
    fileName: 'AA_B9_2_Memo_predecessor_auditor.doc',
    description: 'Коммуникация с предшествующим аудитором',
    category: 'general',
    stageId: 'stage-1',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 13,
    isRequired: false
  },
  {
    id: 'tpl-014',
    name: 'Оценка критичности IT (Word)',
    fileName: 'AA_B9_3_IT_Criticality_Scorecard.doc',
    description: 'Оценка критичности IT-систем клиента (Word версия)',
    category: 'controls',
    stageId: 'stage-4',
    elementId: 'el-4-2',
    requiredRole: 'senior_auditor',
    fileType: 'doc',
    order: 14,
    isRequired: false
  },
  {
    id: 'tpl-014-xls',
    name: 'Оценка критичности IT (Excel)',
    fileName: 'AA_B9_3_IT_Criticality_Scorecard.xls',
    description: 'Оценка критичности IT-систем клиента (Excel версия)',
    category: 'controls',
    stageId: 'stage-4',
    elementId: 'el-4-2',
    requiredRole: 'senior_auditor',
    fileType: 'xls',
    order: 15,
    isRequired: false
  },
  {
    id: 'tpl-015',
    name: 'Письмо руководству (ManLetter)',
    fileName: 'AA_C2_ManLetter_2004_eng_final.doc',
    description: 'Письмо руководству о выявленных недостатках',
    category: 'completion',
    stageId: 'stage-6',
    elementId: 'el-6-2',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 15,
    isRequired: true
  }
];

/**
 * Планирование аудита (Этап 2)
 */
export const PLANNING_TEMPLATES: AuditTemplate[] = [
  {
    id: 'tpl-016',
    name: 'Бюджет I (BUD1)',
    fileName: 'AA_D1_2004_BUD1.doc',
    description: 'Детальный бюджет аудита - часть 1',
    category: 'planning',
    stageId: 'stage-2',
    elementId: 'el-2-4',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 16,
    isRequired: true
  },
  {
    id: 'tpl-017',
    name: 'Бюджет II (BUDII)',
    fileName: 'AA_D2_2004_BUDII.doc',
    description: 'Детальный бюджет аудита - часть 2',
    category: 'planning',
    stageId: 'stage-2',
    elementId: 'el-2-4',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 17,
    isRequired: true
  },
  {
    id: 'tpl-018',
    name: 'Аналитика планирования',
    fileName: 'AA_D3_Planning_analytics.xls',
    description: 'Аналитические процедуры на этапе планирования',
    category: 'planning',
    stageId: 'stage-2',
    elementId: 'el-2-2',
    requiredRole: 'senior_auditor',
    fileType: 'xls',
    order: 18,
    isRequired: true
  },
  {
    id: 'tpl-019',
    name: 'Предварительный аналитический обзор',
    fileName: 'AA_D3_Preliminary_analytical_review.doc',
    description: 'Предварительный аналитический обзор финансовой отчетности',
    category: 'planning',
    stageId: 'stage-2',
    elementId: 'el-2-2',
    requiredRole: 'senior_auditor',
    fileType: 'doc',
    order: 19,
    isRequired: true
  },
  {
    id: 'tpl-020',
    name: 'RAD (Risk Assessment Document)',
    fileName: 'AA_D4_2004_RAD.doc',
    description: 'Документ оценки рисков',
    category: 'risk-assessment',
    stageId: 'stage-3',
    elementId: 'el-3-2',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 20,
    isRequired: true
  },
  {
    id: 'tpl-021',
    name: 'Пороговые значения планирования',
    fileName: 'AA_D5_Planning_Thresholds_Document.doc',
    description: 'Документ с пороговыми значениями для планирования',
    category: 'planning',
    stageId: 'stage-2',
    elementId: 'el-2-3',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 21,
    isRequired: true
  },
  {
    id: 'tpl-022',
    name: 'Программа аудита по мошенничеству',
    fileName: 'AA_D6_2004_Audit_Program_fraud.doc',
    description: 'Программа аудита для выявления рисков мошенничества',
    category: 'risk-assessment',
    stageId: 'stage-3',
    elementId: 'el-3-3',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 22,
    isRequired: true
  },
  {
    id: 'tpl-023',
    name: 'Программа аудита по специальным темам',
    fileName: 'AA_D7_Audit_program_for_specific_topics.doc',
    description: 'Программа аудита для специальных областей',
    category: 'risk-assessment',
    stageId: 'stage-3',
    elementId: 'el-3-4',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 23,
    isRequired: false
  },
  {
    id: 'tpl-024',
    name: 'План аудита',
    fileName: 'AA_D8_1_Audit_plan.doc',
    description: 'Общий план аудита',
    category: 'planning',
    stageId: 'stage-2',
    requiredRole: 'manager',
    fileType: 'doc',
    order: 24,
    isRequired: true
  },
  {
    id: 'tpl-025',
    name: 'Оценка широкой программы',
    fileName: 'AA_D8_2_Broad_Program_Evaluation.doc',
    description: 'Оценка общей программы аудита',
    category: 'planning',
    stageId: 'stage-2',
    requiredRole: 'partner',
    fileType: 'doc',
    order: 25,
    isRequired: true
  }
];

/**
 * Субстантивные процедуры (Этап 5) - Программы аудита по разделам
 */
export const SUBSTANTIVE_TEMPLATES: AuditTemplate[] = [
  {
    id: 'tpl-026',
    name: 'Программа аудита - Выручка',
    fileName: 'AA_E1_2004_N_Sales_PAD_AA.doc',
    description: 'Программа аудита выручки',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'doc',
    order: 26,
    isRequired: true,
    relatedTemplates: ['tpl-027-rev']
  },
  {
    id: 'tpl-027',
    name: 'Программа аудита - Себестоимость',
    fileName: 'AA_E2_2004_COGS_PAD_final.doc',
    description: 'Программа аудита себестоимости',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'doc',
    order: 27,
    isRequired: true
  },
  {
    id: 'tpl-028',
    name: 'Программа аудита - Основные средства',
    fileName: 'AA_04_Audit_Program_Fixed_Assets.docx',
    description: 'Программа аудита основных средств',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 28,
    isRequired: true,
    relatedTemplates: ['tpl-028-ppe']
  },
  {
    id: 'tpl-028-ppe',
    name: 'Рабочий файл - Основные средства',
    fileName: 'A_J_04_PPE.xlsx',
    description: 'Рабочий файл для аудита основных средств',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 29,
    isRequired: true
  },
  {
    id: 'tpl-029',
    name: 'Программа аудита - Нематериальные активы',
    fileName: 'AA_04_Audit_Program_IA_E.docx',
    description: 'Программа аудита нематериальных активов',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 30,
    isRequired: false
  },
  {
    id: 'tpl-030',
    name: 'Программа аудита - Общехозяйственные расходы',
    fileName: 'AA_04_Audit_Program_for_G&A.docx',
    description: 'Программа аудита общехозяйственных расходов',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 31,
    isRequired: true
  },
  {
    id: 'tpl-031',
    name: 'Рабочий файл - Общехозяйственные расходы',
    fileName: 'AA_04_G&A_expenses.xlsx',
    description: 'Рабочий файл для аудита общехозяйственных расходов',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 32,
    isRequired: true
  },
  {
    id: 'tpl-032',
    name: 'Программа аудита - Денежные средства',
    fileName: 'AA_04_Audit_Program_Cash_and_cash_equiv.docx',
    description: 'Программа аудита денежных средств',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 33,
    isRequired: true
  },
  {
    id: 'tpl-033',
    name: 'Программа аудита - Расходы на персонал',
    fileName: 'AA_04_Audit_Program_HR_expenses.docx',
    description: 'Программа аудита расходов на персонал',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 34,
    isRequired: true
  },
  {
    id: 'tpl-034',
    name: 'Программа аудита - Себестоимость (детальная)',
    fileName: 'AA_04_Audit_Program_COGS.docx',
    description: 'Детальная программа аудита себестоимости',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-3',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 35,
    isRequired: false
  },
  {
    id: 'tpl-034-xls',
    name: 'Рабочий файл - Себестоимость',
    fileName: 'AA_04_COGS_final.xlsx',
    description: 'Рабочий файл для детального аудита себестоимости',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 36,
    isRequired: false,
    relatedTemplates: ['tpl-034']
  },
  {
    id: 'tpl-035',
    name: 'Программа аудита - События после отчетной даты',
    fileName: 'AA_04_Audit_Program_Subsequent_Events.docx',
    description: 'Программа аудита событий после отчетной даты',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-4',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 37,
    isRequired: false
  },
  {
    id: 'tpl-035-xls',
    name: 'Рабочий файл - События после отчетной даты',
    fileName: 'AA_04_D7_3_Subsequent_Events_AT_final.xlsx',
    description: 'Рабочий файл для аудита событий после отчетной даты',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 38,
    isRequired: false,
    relatedTemplates: ['tpl-035']
  },
  {
    id: 'tpl-036',
    name: 'Программа аудита - Раскрытия',
    fileName: 'AA_04_Audit_Program_Disclosures.docx',
    description: 'Программа аудита раскрытий в финансовой отчетности',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-4',
    requiredRole: 'senior_auditor',
    fileType: 'docx',
    order: 39,
    isRequired: true
  },
  {
    id: 'tpl-036-xls',
    name: 'Рабочий файл - Раскрытия',
    fileName: 'AA_04_DIsclosures_3.xlsx',
    description: 'Рабочий файл для аудита раскрытий в финансовой отчетности',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 40,
    isRequired: false,
    relatedTemplates: ['tpl-036']
  },
  {
    id: 'tpl-037',
    name: 'Рабочий файл - Основные средства (Rollforward)',
    fileName: 'AA_04_FA_Rollforward.xlsx',
    description: 'Рабочий файл движения основных средств',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 41,
    isRequired: false
  },
  {
    id: 'tpl-038',
    name: 'Рабочий файл - Прочая выручка',
    fileName: 'AA_04_G_Other_revenue.xlsx',
    description: 'Рабочий файл для аудита прочей выручки',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 39,
    isRequired: false
  },
  {
    id: 'tpl-039',
    name: 'Рабочий файл - Нематериальные активы',
    fileName: 'AA_04_H_Intangible_assets_Final.xlsx',
    description: 'Рабочий файл для аудита нематериальных активов',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 42,
    isRequired: false
  },
  {
    id: 'tpl-040',
    name: 'Протоколы (Minutes)',
    fileName: 'AA_04_Minutes.xlsx',
    description: 'Протоколы встреч и обсуждений',
    category: 'general',
    stageId: 'stage-6',
    elementId: 'el-6-2',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 43,
    isRequired: false
  },
  {
    id: 'tpl-041',
    name: 'Рабочий файл - Выручка',
    fileName: 'AA_04_O_Revenue.xlsx',
    description: 'Рабочий файл для детального аудита выручки',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 44,
    isRequired: true,
    relatedTemplates: ['tpl-026']
  },
  {
    id: 'tpl-042',
    name: 'Рабочий файл - Аренда',
    fileName: 'AA_04_P_Leasing.xlsx',
    description: 'Рабочий файл для аудита аренды',
    category: 'substantive',
    stageId: 'stage-5',
    elementId: 'el-5-6',
    requiredRole: 'assistant',
    fileType: 'xlsx',
    order: 45,
    isRequired: false
  }
];

/**
 * Все шаблоны
 */
export const ALL_AUDIT_TEMPLATES: AuditTemplate[] = [
  ...GENERAL_TEMPLATES,
  ...PLANNING_TEMPLATES,
  ...SUBSTANTIVE_TEMPLATES
];

/**
 * Получить шаблоны по этапу
 */
export function getTemplatesByStage(stageId: string): AuditTemplate[] {
  return ALL_AUDIT_TEMPLATES.filter(t => t.stageId === stageId);
}

/**
 * Получить шаблоны по элементу
 */
export function getTemplatesByElement(elementId: string): AuditTemplate[] {
  return ALL_AUDIT_TEMPLATES.filter(t => t.elementId === elementId);
}

/**
 * Получить шаблоны по роли
 */
export function getTemplatesByRole(role: TemplateRole): AuditTemplate[] {
  return ALL_AUDIT_TEMPLATES.filter(t => t.requiredRole === role);
}

/**
 * Получить шаблон по ID
 */
export function getTemplateById(templateId: string): AuditTemplate | undefined {
  return ALL_AUDIT_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Получить шаблоны по категории
 */
export function getTemplatesByCategory(category: TemplateCategory): AuditTemplate[] {
  return ALL_AUDIT_TEMPLATES.filter(t => t.category === category);
}

