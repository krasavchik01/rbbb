/**
 * МСФО 9 (IFRS 9) - Типы и интерфейсы
 *
 * Полная модель для расчета ожидаемых кредитных убытков (ECL)
 * в соответствии с требованиями международных стандартов
 */

// ==================== СТАДИИ ОБЕСЦЕНЕНИЯ ====================

/**
 * Стадии обесценения по МСФО 9
 * Stage 1: 12-месячные ECL (performing assets)
 * Stage 2: Lifetime ECL (SICR - значительное увеличение кредитного риска)
 * Stage 3: Lifetime ECL (credit-impaired)
 * POCI: Purchased or originated credit-impaired
 */
export type ImpairmentStage = 'stage_1' | 'stage_2' | 'stage_3' | 'poci';

export const STAGE_LABELS: Record<ImpairmentStage, string> = {
  stage_1: 'Стадия 1 - Работающие активы',
  stage_2: 'Стадия 2 - Значительное увеличение риска',
  stage_3: 'Стадия 3 - Дефолт',
  poci: 'POCI - Приобретенные обесцененные'
};

// ==================== КЛАССИФИКАЦИЯ ФИ ====================

/**
 * Классификация финансовых инструментов
 */
export type FinancialInstrumentCategory =
  | 'amortised_cost'      // По амортизированной стоимости
  | 'fvoci_debt'          // По справедливой стоимости через ПСД (долговые)
  | 'fvoci_equity'        // По справедливой стоимости через ПСД (долевые)
  | 'fvtpl';              // По справедливой стоимости через прибыль/убыток

export const CATEGORY_LABELS: Record<FinancialInstrumentCategory, string> = {
  amortised_cost: 'По амортизированной стоимости (AC)',
  fvoci_debt: 'FVOCI - Долговые инструменты',
  fvoci_equity: 'FVOCI - Долевые инструменты',
  fvtpl: 'По справедливой стоимости через П/У (FVTPL)'
};

/**
 * Бизнес-модель управления ФИ
 */
export type BusinessModel =
  | 'hold_to_collect'           // Удержание для получения потоков
  | 'hold_to_collect_and_sell'  // Удержание и продажа
  | 'other';                    // Прочие (включая торговлю)

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  hold_to_collect: 'Удержание для получения потоков',
  hold_to_collect_and_sell: 'Удержание и продажа',
  other: 'Прочие цели'
};

// ==================== ТИПЫ ФИНАНСОВЫХ АКТИВОВ ====================

/**
 * Типы финансовых активов для расчета ECL
 */
export type AssetType =
  | 'corporate_loan'      // Корпоративные кредиты
  | 'retail_loan'         // Розничные кредиты
  | 'mortgage'            // Ипотека
  | 'trade_receivable'    // Торговая дебиторка
  | 'lease_receivable'    // Лизинговая дебиторка
  | 'interbank'           // Межбанк
  | 'securities_debt'     // Долговые ценные бумаги
  | 'guarantee'           // Гарантии
  | 'credit_line';        // Кредитные линии

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  corporate_loan: 'Корпоративный кредит',
  retail_loan: 'Розничный кредит',
  mortgage: 'Ипотечный кредит',
  trade_receivable: 'Торговая дебиторская задолженность',
  lease_receivable: 'Лизинговая дебиторская задолженность',
  interbank: 'Межбанковский кредит',
  securities_debt: 'Долговые ценные бумаги',
  guarantee: 'Финансовая гарантия',
  credit_line: 'Кредитная линия / Обязательство'
};

// ==================== ПАРАМЕТРЫ РИСКА ====================

/**
 * Probability of Default (PD) - Вероятность дефолта
 */
export interface PDParameters {
  pd_12_month: number;        // 12-месячная PD (Stage 1)
  pd_lifetime: number;        // Lifetime PD (Stage 2, 3)
  pd_marginal: number[];      // Маргинальные PD по годам
  pd_cumulative: number[];    // Кумулятивные PD по годам
  methodology: PDMethodology; // Методология расчета
  data_source: string;        // Источник данных
  adjustment_factors?: MacroAdjustment[]; // Макро-корректировки
}

export type PDMethodology =
  | 'migration_matrix'    // Матрица миграции
  | 'roll_rate'           // Roll-rate анализ
  | 'vintage_analysis'    // Винтажный анализ
  | 'external_rating'     // Внешние рейтинги
  | 'expert_judgment'     // Экспертная оценка
  | 'simplified';         // Упрощенный подход

/**
 * Loss Given Default (LGD) - Потери при дефолте
 */
export interface LGDParameters {
  lgd_secured: number;        // LGD для обеспеченных
  lgd_unsecured: number;      // LGD для необеспеченных
  lgd_downturn: number;       // LGD в условиях спада
  recovery_rate: number;      // Коэффициент возмещения
  collateral_haircut: number; // Дисконт по залогу
  time_to_recovery: number;   // Время до возмещения (месяцы)
  cost_of_recovery: number;   // Затраты на взыскание (%)
}

/**
 * Exposure at Default (EAD) - Подверженность риску при дефолте
 */
export interface EADParameters {
  current_exposure: number;    // Текущая задолженность
  ccf: number;                 // Credit Conversion Factor (для внебалансовых)
  undrawn_amount: number;      // Невыбранный лимит
  amortization_profile: AmortizationProfile;
}

export type AmortizationProfile = 'linear' | 'annuity' | 'bullet' | 'custom';

// ==================== МАКРО-КОРРЕКТИРОВКИ ====================

/**
 * Макроэкономические корректировки (Forward-looking)
 */
export interface MacroAdjustment {
  scenario: MacroScenario;
  weight: number;              // Вес сценария (сумма = 100%)
  pd_adjustment: number;       // Корректировка PD
  lgd_adjustment: number;      // Корректировка LGD
  factors: MacroFactor[];      // Факторы сценария
}

export type MacroScenario = 'base' | 'optimistic' | 'pessimistic';

export interface MacroFactor {
  name: string;                // GDP, Unemployment, Exchange rate, etc.
  current_value: number;       // Текущее значение
  forecast_values: number[];   // Прогноз по периодам
  sensitivity: number;         // Чувствительность к PD
}

// ==================== РЕЗУЛЬТАТЫ РАСЧЕТА ECL ====================

/**
 * Результат расчета ECL для одного актива/портфеля
 */
export interface ECLResult {
  id: string;
  calculation_date: string;
  asset_id: string;
  asset_type: AssetType;

  // Входные данные
  gross_carrying_amount: number;  // Валовая балансовая стоимость
  stage: ImpairmentStage;
  category: FinancialInstrumentCategory;

  // Параметры риска
  pd: PDParameters;
  lgd: LGDParameters;
  ead: EADParameters;

  // Результаты
  ecl_12_month: number;          // 12-месячный ECL
  ecl_lifetime: number;          // Lifetime ECL
  ecl_final: number;             // Итоговый ECL (в зависимости от стадии)
  coverage_ratio: number;         // Коэффициент покрытия (%)

  // Детализация по периодам (для lifetime)
  ecl_by_period?: ECLPeriodDetail[];

  // Сверка
  opening_balance: number;        // Резерв на начало
  charge_to_pnl: number;          // Начисление в P&L
  write_offs: number;             // Списания
  unwinding: number;              // Амортизация дисконта
  fx_adjustment: number;          // Валютная переоценка
  closing_balance: number;        // Резерв на конец

  // Метаданные
  methodology_notes: string;
  assumptions: string[];
  data_quality_score: number;     // Оценка качества данных 1-5
}

export interface ECLPeriodDetail {
  period: number;                 // Номер периода
  pd_marginal: number;            // Маргинальная PD
  pd_cumulative: number;          // Кумулятивная PD
  lgd: number;                    // LGD для периода
  ead: number;                    // EAD для периода
  discount_factor: number;        // Коэффициент дисконтирования
  ecl_undiscounted: number;       // ECL до дисконтирования
  ecl_discounted: number;         // ECL после дисконтирования
}

// ==================== SPPI ТЕСТ ====================

/**
 * SPPI Test - Solely Payments of Principal and Interest
 */
export interface SPPITest {
  id: string;
  asset_id: string;
  test_date: string;

  // Базовые характеристики
  contractual_terms: ContractualTerms;

  // Результаты проверок
  basic_lending_arrangement: boolean;  // Базовый кредитный договор?
  interest_components_pass: boolean;   // Процентные компоненты соответствуют?
  prepayment_features_pass: boolean;   // Досрочное погашение OK?
  extension_features_pass: boolean;    // Пролонгация OK?
  contingent_events_pass: boolean;     // Условные события OK?

  // Итог
  sppi_passed: boolean;
  classification_result: FinancialInstrumentCategory;
  notes: string;
}

export interface ContractualTerms {
  principal_amount: number;
  interest_rate_type: 'fixed' | 'floating' | 'mixed';
  interest_rate: number;
  spread: number;
  benchmark_rate?: string;
  has_prepayment_option: boolean;
  prepayment_penalty?: number;
  has_extension_option: boolean;
  has_conversion_feature: boolean;
  currency: string;
  maturity_date: string;
}

// ==================== SICR - ЗНАЧИТЕЛЬНОЕ УВЕЛИЧЕНИЕ РИСКА ====================

/**
 * SICR Assessment - Оценка значительного увеличения кредитного риска
 */
export interface SICRAssessment {
  asset_id: string;
  assessment_date: string;

  // Количественные критерии
  pd_at_origination: number;        // PD при выдаче
  pd_at_reporting: number;          // PD на отчетную дату
  pd_change_absolute: number;       // Абсолютное изменение PD
  pd_change_relative: number;       // Относительное изменение PD (%)

  // Качественные критерии
  days_past_due: number;            // Просрочка в днях
  watch_list: boolean;              // В списке наблюдения
  forbearance: boolean;             // Реструктуризация
  adverse_change: boolean;          // Негативные изменения

  // Пороговые значения
  pd_threshold_absolute: number;    // Порог абсолютного изменения
  pd_threshold_relative: number;    // Порог относительного изменения
  dpd_threshold: number;            // Порог просрочки (обычно 30)

  // Результат
  sicr_triggered: boolean;          // SICR произошло?
  triggers: string[];               // Какие триггеры сработали
  previous_stage: ImpairmentStage;
  new_stage: ImpairmentStage;
  stage_movement_reason: string;
}

// ==================== МАТРИЦА МИГРАЦИИ ====================

/**
 * Матрица миграции рейтингов
 */
export interface MigrationMatrix {
  id: string;
  name: string;
  as_of_date: string;
  period_months: number;            // Период наблюдения

  // Рейтинговые категории
  rating_scale: string[];           // ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D']

  // Матрица переходов (из строки в столбец)
  transition_matrix: number[][];    // Проценты перехода

  // Статистика
  sample_size: number;
  observation_period_start: string;
  observation_period_end: string;
  data_source: string;
}

// ==================== РАСЧЕТ ДЛЯ ПОРТФЕЛЯ ====================

/**
 * Параметры расчета для портфеля
 */
export interface PortfolioECLCalculation {
  id: string;
  name: string;
  calculation_date: string;
  client_name: string;
  client_type: 'bank' | 'mfo' | 'leasing' | 'trading' | 'other';

  // Сегменты портфеля
  segments: PortfolioSegment[];

  // Агрегированные результаты
  total_gross_exposure: number;
  total_ecl: number;
  total_coverage_ratio: number;

  // По стадиям
  stage_1_exposure: number;
  stage_1_ecl: number;
  stage_2_exposure: number;
  stage_2_ecl: number;
  stage_3_exposure: number;
  stage_3_ecl: number;

  // Движение резерва
  movement: ECLMovement;

  // Раскрытия
  disclosures: IFRS9Disclosure[];
}

export interface PortfolioSegment {
  id: string;
  name: string;                     // "Корп. кредиты - Крупный бизнес"
  asset_type: AssetType;

  // Объем
  number_of_assets: number;
  gross_carrying_amount: number;

  // Распределение по стадиям
  stage_distribution: {
    stage_1: { count: number; amount: number };
    stage_2: { count: number; amount: number };
    stage_3: { count: number; amount: number };
  };

  // Параметры риска (средневзвешенные)
  avg_pd_12m: number;
  avg_pd_lifetime: number;
  avg_lgd: number;

  // Результаты
  ecl: number;
  coverage_ratio: number;
}

/**
 * Движение резерва ECL
 */
export interface ECLMovement {
  period_start: string;
  period_end: string;

  opening_balance: number;

  // Изменения из-за переоценки
  stage_transfers_in: number;
  stage_transfers_out: number;
  model_parameter_changes: number;
  macro_adjustments: number;

  // Изменения портфеля
  new_originated: number;
  derecognized: number;

  // Использование резерва
  write_offs: number;
  recoveries: number;

  // Прочее
  fx_effect: number;
  other_movements: number;

  closing_balance: number;
}

// ==================== РАСКРЫТИЯ ====================

/**
 * Раскрытия по МСФО 7 / МСФО 9
 */
export interface IFRS9Disclosure {
  type: DisclosureType;
  title: string;
  content: any;               // Структура зависит от типа
  notes: string;
}

export type DisclosureType =
  | 'credit_risk_exposure'    // Подверженность кредитному риску
  | 'ecl_by_stage'            // ECL по стадиям
  | 'ecl_movement'            // Движение резерва
  | 'stage_movement'          // Движение между стадиями
  | 'credit_quality'          // Качество кредитного портфеля
  | 'collateral'              // Залоговое обеспечение
  | 'concentrations'          // Концентрации риска
  | 'modified_assets'         // Модифицированные активы
  | 'written_off'             // Списанные активы
  | 'sensitivity';            // Анализ чувствительности

// ==================== НАСТРОЙКИ РАСЧЕТА ====================

/**
 * Настройки модели ECL
 */
export interface ECLModelSettings {
  // Общие настройки
  effective_interest_rate: number;  // Эффективная ставка для дисконтирования
  calculation_approach: 'individual' | 'collective' | 'mixed';

  // Пороги SICR
  sicr_pd_threshold_absolute: number;  // Например, 1%
  sicr_pd_threshold_relative: number;  // Например, 200%
  sicr_dpd_threshold: number;          // Например, 30 дней

  // Дефолт
  default_definition: DefaultDefinition;

  // Макро-сценарии
  macro_scenarios: MacroAdjustment[];

  // Упрощенный подход для торговой дебиторки
  simplified_approach_enabled: boolean;
  provision_matrix?: ProvisionMatrix;
}

export interface DefaultDefinition {
  dpd_threshold: number;              // Обычно 90 дней
  qualitative_indicators: string[];   // Качественные признаки
  unlikeliness_to_pay: boolean;       // UTP - маловероятность погашения
  cross_default: boolean;             // Кросс-дефолт
}

/**
 * Матрица резервирования (для упрощенного подхода)
 */
export interface ProvisionMatrix {
  aging_buckets: AgingBucket[];
  historical_loss_rates: number[];    // Исторические убытки по бакетам
  forward_looking_adjustment: number; // Корректировка на прогноз
}

export interface AgingBucket {
  name: string;                       // "Текущая", "1-30 дней", etc.
  days_from: number;
  days_to: number | null;             // null = infinity
  provision_rate: number;             // Ставка резервирования %
}

// ==================== ПРОЕКТ РАСЧЕТА ====================

/**
 * Проект расчета МСФО 9
 */
export interface IFRS9Project {
  id: string;
  name: string;
  client_id: string;
  client_name: string;
  reporting_date: string;
  created_at: string;
  created_by: string;
  status: 'draft' | 'in_progress' | 'review' | 'approved' | 'final';

  // Настройки
  settings: ECLModelSettings;

  // Данные
  assets: FinancialAssetData[];

  // Результаты
  portfolio_result?: PortfolioECLCalculation;

  // Аудит
  audit_trail: AuditEntry[];
  review_notes: string[];
}

export interface FinancialAssetData {
  id: string;
  external_id?: string;              // ID из системы клиента
  asset_type: AssetType;

  // Основные данные
  debtor_name: string;
  debtor_segment: string;
  contract_date: string;
  maturity_date: string;
  currency: string;

  // Суммы
  original_amount: number;
  current_balance: number;
  undrawn_commitment: number;

  // Ставки
  interest_rate: number;
  effective_rate: number;

  // Кредитное качество
  internal_rating?: string;
  external_rating?: string;
  days_past_due: number;

  // Залоги
  collateral_value: number;
  collateral_type: string;

  // Флаги
  watch_list: boolean;
  forbearance: boolean;

  // Рассчитанные поля
  stage?: ImpairmentStage;
  ecl_result?: ECLResult;
}

export interface AuditEntry {
  timestamp: string;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
}
