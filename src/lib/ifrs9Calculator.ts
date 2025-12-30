/**
 * МСФО 9 (IFRS 9) - Расчетная библиотека ECL
 *
 * Полная реализация расчета ожидаемых кредитных убытков (ECL)
 * в соответствии с требованиями IFRS 9 / МСФО 9
 */

import {
  ImpairmentStage,
  PDParameters,
  LGDParameters,
  EADParameters,
  ECLResult,
  ECLPeriodDetail,
  MacroAdjustment,
  MacroScenario,
  SICRAssessment,
  MigrationMatrix,
  PortfolioECLCalculation,
  PortfolioSegment,
  ECLMovement,
  ECLModelSettings,
  ProvisionMatrix,
  AgingBucket,
  FinancialAssetData,
  AssetType,
  SPPITest,
  ContractualTerms,
  FinancialInstrumentCategory,
  BusinessModel,
  IFRS9Project,
  DefaultDefinition,
} from '../types/ifrs9';

// ==================== БАЗОВЫЕ ФОРМУЛЫ ECL ====================

/**
 * Расчет ECL для отдельного актива
 * ECL = PD × LGD × EAD × DF
 */
export function calculateECL(
  pd: number,         // Probability of Default
  lgd: number,        // Loss Given Default (as decimal, e.g., 0.45 for 45%)
  ead: number,        // Exposure at Default
  discountFactor: number = 1  // Discount factor
): number {
  return pd * lgd * ead * discountFactor;
}

/**
 * Расчет 12-месячного ECL (Stage 1)
 */
export function calculate12MonthECL(
  pd12m: number,      // 12-month PD
  lgd: number,
  ead: number,
  effectiveRate: number = 0  // Effective interest rate for discounting
): number {
  // Для 12-месячного ECL дисконтирование обычно минимально
  const discountFactor = 1 / (1 + effectiveRate / 2);  // Примерно середина периода
  return calculateECL(pd12m, lgd, ead, discountFactor);
}

/**
 * Расчет Lifetime ECL (Stage 2, Stage 3)
 * Суммирует ECL по всем будущим периодам
 */
export function calculateLifetimeECL(
  marginalPDs: number[],      // Маргинальные PD по периодам
  lgd: number,
  eadProfile: number[],       // EAD по периодам (с учетом амортизации)
  effectiveRate: number
): ECLPeriodDetail[] {
  const periods: ECLPeriodDetail[] = [];
  let cumulativePD = 0;

  for (let i = 0; i < marginalPDs.length; i++) {
    const period = i + 1;
    const marginalPD = marginalPDs[i];
    cumulativePD += marginalPD * (1 - cumulativePD); // Маргинальная -> кумулятивная
    const ead = eadProfile[i] || eadProfile[eadProfile.length - 1];
    const discountFactor = 1 / Math.pow(1 + effectiveRate, period);

    const eclUndiscounted = marginalPD * lgd * ead;
    const eclDiscounted = eclUndiscounted * discountFactor;

    periods.push({
      period,
      pd_marginal: marginalPD,
      pd_cumulative: cumulativePD,
      lgd,
      ead,
      discount_factor: discountFactor,
      ecl_undiscounted: eclUndiscounted,
      ecl_discounted: eclDiscounted,
    });
  }

  return periods;
}

/**
 * Суммарный Lifetime ECL из детализации по периодам
 */
export function sumLifetimeECL(periods: ECLPeriodDetail[]): number {
  return periods.reduce((sum, p) => sum + p.ecl_discounted, 0);
}

// ==================== РАСЧЕТ PD ====================

/**
 * Конвертация годовой PD в маргинальные PD
 * Использует модель постоянной интенсивности дефолта
 */
export function annualPDToMarginal(
  annualPD: number,
  years: number
): number[] {
  const marginalPDs: number[] = [];
  let survivalProb = 1;

  for (let i = 0; i < years; i++) {
    const marginalPD = annualPD * survivalProb;
    marginalPDs.push(marginalPD);
    survivalProb *= (1 - annualPD);
  }

  return marginalPDs;
}

/**
 * Расчет PD из матрицы миграции
 */
export function calculatePDFromMigrationMatrix(
  matrix: MigrationMatrix,
  currentRating: number,  // Индекс текущего рейтинга
  years: number
): { pd12m: number; pdLifetime: number; marginalPDs: number[] } {
  const n = matrix.rating_scale.length;
  const defaultIndex = n - 1;  // Дефолт - последняя категория

  // Матрица как 2D массив
  let currentMatrix = [...matrix.transition_matrix.map(row => [...row])];

  const marginalPDs: number[] = [];
  let cumulativePD = 0;

  for (let year = 0; year < years; year++) {
    // Вероятность перехода в дефолт за текущий год
    const pdThisYear = currentMatrix[currentRating][defaultIndex] / 100;
    const marginalPD = pdThisYear * (1 - cumulativePD);
    marginalPDs.push(marginalPD);
    cumulativePD += marginalPD;

    // Возведение матрицы в следующую степень
    if (year < years - 1) {
      currentMatrix = multiplyMatrices(currentMatrix, matrix.transition_matrix);
    }
  }

  return {
    pd12m: marginalPDs[0] || 0,
    pdLifetime: cumulativePD,
    marginalPDs,
  };
}

/**
 * Умножение матриц
 */
function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const result: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        result[i][j] += a[i][k] * b[k][j] / 100;
      }
    }
  }

  return result;
}

/**
 * Расчет PD через Roll-rate анализ
 */
export function calculatePDFromRollRate(
  rollRates: { [bucket: string]: number },  // Вероятности перехода между бакетами
  currentBucket: string
): number {
  // Пример бакетов: 'current', '1-30', '31-60', '61-90', '90+'
  const bucketOrder = ['current', '1-30', '31-60', '61-90', '90+'];
  const currentIndex = bucketOrder.indexOf(currentBucket);

  if (currentIndex === -1) return 0;

  // Рассчитываем вероятность попасть в дефолт (90+)
  let pd = 1;
  for (let i = currentIndex; i < bucketOrder.length - 1; i++) {
    const rollRate = rollRates[bucketOrder[i]] || 0;
    pd *= rollRate;
  }

  return pd;
}

// ==================== РАСЧЕТ LGD ====================

/**
 * Расчет LGD с учетом обеспечения
 */
export function calculateLGDWithCollateral(
  unsecuredLGD: number,
  exposure: number,
  collateralValue: number,
  haircut: number,          // Дисконт к залогу
  recoveryTime: number,     // Время реализации (годы)
  discountRate: number,     // Ставка дисконтирования
  recoveryCosts: number     // Затраты на взыскание (%)
): LGDParameters {
  // Стоимость залога после дисконта
  const adjustedCollateral = collateralValue * (1 - haircut);

  // Дисконтирование к текущему моменту
  const discountedCollateral = adjustedCollateral / Math.pow(1 + discountRate, recoveryTime);

  // Recovery rate
  const recoveryRate = Math.min(discountedCollateral / exposure, 1) * (1 - recoveryCosts);

  // LGD для обеспеченной части
  const lgdSecured = 1 - recoveryRate;

  // LGD Downturn (увеличиваем на 10-20% для стресс-сценария)
  const lgdDownturn = Math.min(lgdSecured * 1.15, 1);

  return {
    lgd_secured: lgdSecured,
    lgd_unsecured: unsecuredLGD,
    lgd_downturn: lgdDownturn,
    recovery_rate: recoveryRate,
    collateral_haircut: haircut,
    time_to_recovery: recoveryTime * 12,  // В месяцах
    cost_of_recovery: recoveryCosts,
  };
}

/**
 * LGD по типу актива (дефолтные значения)
 */
export function getDefaultLGD(assetType: AssetType): number {
  const lgdDefaults: Record<AssetType, number> = {
    corporate_loan: 0.45,
    retail_loan: 0.50,
    mortgage: 0.20,
    trade_receivable: 0.60,
    lease_receivable: 0.35,
    interbank: 0.45,
    securities_debt: 0.40,
    guarantee: 0.50,
    credit_line: 0.45,
  };
  return lgdDefaults[assetType] || 0.45;
}

// ==================== РАСЧЕТ EAD ====================

/**
 * Расчет EAD с учетом CCF для внебалансовых обязательств
 */
export function calculateEAD(
  drawnAmount: number,
  undrawnAmount: number,
  ccf: number  // Credit Conversion Factor
): number {
  return drawnAmount + undrawnAmount * ccf;
}

/**
 * Профиль EAD по периодам с амортизацией
 */
export function calculateEADProfile(
  initialEAD: number,
  maturityYears: number,
  amortizationType: 'linear' | 'annuity' | 'bullet'
): number[] {
  const profile: number[] = [];

  for (let year = 1; year <= maturityYears; year++) {
    let ead: number;

    switch (amortizationType) {
      case 'linear':
        ead = initialEAD * (1 - (year - 0.5) / maturityYears);
        break;
      case 'annuity':
        // Аннуитетная амортизация
        const rate = 0.1; // Примерная ставка
        const pmt = initialEAD * rate / (1 - Math.pow(1 + rate, -maturityYears));
        const principal = pmt - initialEAD * rate;
        ead = initialEAD - principal * (year - 0.5);
        break;
      case 'bullet':
        ead = initialEAD;  // Весь долг погашается в конце
        break;
      default:
        ead = initialEAD;
    }

    profile.push(Math.max(ead, 0));
  }

  return profile;
}

/**
 * CCF по типу продукта (дефолтные значения Basel)
 */
export function getDefaultCCF(assetType: AssetType): number {
  const ccfDefaults: Record<AssetType, number> = {
    corporate_loan: 0.75,
    retail_loan: 0.75,
    mortgage: 1.00,
    trade_receivable: 1.00,
    lease_receivable: 1.00,
    interbank: 0.50,
    securities_debt: 1.00,
    guarantee: 0.50,
    credit_line: 0.75,
  };
  return ccfDefaults[assetType] || 0.75;
}

// ==================== SICR - ОЦЕНКА СТАДИИ ====================

/**
 * Определение стадии обесценения
 */
export function determineStage(
  asset: FinancialAssetData,
  settings: ECLModelSettings
): ImpairmentStage {
  const { default_definition, sicr_dpd_threshold, sicr_pd_threshold_relative } = settings;

  // Stage 3: Дефолт
  if (
    asset.days_past_due >= default_definition.dpd_threshold ||
    asset.watch_list && asset.forbearance
  ) {
    return 'stage_3';
  }

  // Stage 2: SICR
  if (
    asset.days_past_due >= sicr_dpd_threshold ||
    asset.watch_list ||
    asset.forbearance
  ) {
    return 'stage_2';
  }

  // Stage 1: Performing
  return 'stage_1';
}

/**
 * Детальная оценка SICR
 */
export function assessSICR(
  asset: FinancialAssetData,
  pdAtOrigination: number,
  settings: ECLModelSettings
): SICRAssessment {
  const pdAtReporting = asset.internal_rating
    ? getRatingPD(asset.internal_rating)
    : 0.01;  // Дефолтная PD

  const pdChangeAbsolute = pdAtReporting - pdAtOrigination;
  const pdChangeRelative = pdAtOrigination > 0
    ? (pdAtReporting / pdAtOrigination - 1) * 100
    : 0;

  const triggers: string[] = [];

  // Проверка триггеров
  if (pdChangeAbsolute > settings.sicr_pd_threshold_absolute) {
    triggers.push(`Абсолютное изменение PD: ${(pdChangeAbsolute * 100).toFixed(2)}%`);
  }
  if (pdChangeRelative > settings.sicr_pd_threshold_relative) {
    triggers.push(`Относительное изменение PD: ${pdChangeRelative.toFixed(0)}%`);
  }
  if (asset.days_past_due >= settings.sicr_dpd_threshold) {
    triggers.push(`Просрочка ${asset.days_past_due} дней`);
  }
  if (asset.watch_list) {
    triggers.push('В списке наблюдения');
  }
  if (asset.forbearance) {
    triggers.push('Реструктуризация');
  }

  const sicrTriggered = triggers.length > 0;
  const previousStage: ImpairmentStage = 'stage_1';
  const newStage = determineStage(asset, settings);

  return {
    asset_id: asset.id,
    assessment_date: new Date().toISOString().split('T')[0],
    pd_at_origination: pdAtOrigination,
    pd_at_reporting: pdAtReporting,
    pd_change_absolute: pdChangeAbsolute,
    pd_change_relative: pdChangeRelative,
    days_past_due: asset.days_past_due,
    watch_list: asset.watch_list,
    forbearance: asset.forbearance,
    adverse_change: false,
    pd_threshold_absolute: settings.sicr_pd_threshold_absolute,
    pd_threshold_relative: settings.sicr_pd_threshold_relative,
    dpd_threshold: settings.sicr_dpd_threshold,
    sicr_triggered: sicrTriggered,
    triggers,
    previous_stage: previousStage,
    new_stage: newStage,
    stage_movement_reason: triggers.join('; ') || 'Нет изменений',
  };
}

/**
 * PD по внутреннему рейтингу
 */
function getRatingPD(rating: string): number {
  const ratingPDs: Record<string, number> = {
    'AAA': 0.0001, 'AA+': 0.0002, 'AA': 0.0003, 'AA-': 0.0005,
    'A+': 0.0008, 'A': 0.0012, 'A-': 0.0020,
    'BBB+': 0.0035, 'BBB': 0.0055, 'BBB-': 0.0090,
    'BB+': 0.0150, 'BB': 0.0250, 'BB-': 0.0400,
    'B+': 0.0650, 'B': 0.1000, 'B-': 0.1500,
    'CCC+': 0.2200, 'CCC': 0.3000, 'CCC-': 0.4000,
    'CC': 0.5000, 'C': 0.7000, 'D': 1.0000,
    // Числовые рейтинги
    '1': 0.0003, '2': 0.0008, '3': 0.0020, '4': 0.0055,
    '5': 0.0150, '6': 0.0400, '7': 0.1000, '8': 0.3000, '9': 0.7000, '10': 1.0000,
  };
  return ratingPDs[rating.toUpperCase()] || 0.05;
}

// ==================== МАКРО-КОРРЕКТИРОВКИ ====================

/**
 * Применение макро-сценариев к ECL
 */
export function applyMacroScenarios(
  baseECL: number,
  scenarios: MacroAdjustment[]
): number {
  return scenarios.reduce((weighted, scenario) => {
    const adjustedECL = baseECL * (1 + scenario.pd_adjustment) * (1 + scenario.lgd_adjustment);
    return weighted + adjustedECL * scenario.weight;
  }, 0);
}

/**
 * Создание стандартных макро-сценариев
 */
export function createDefaultMacroScenarios(): MacroAdjustment[] {
  return [
    {
      scenario: 'base',
      weight: 0.50,  // 50%
      pd_adjustment: 0,
      lgd_adjustment: 0,
      factors: [
        { name: 'ВВП', current_value: 3.5, forecast_values: [3.0, 3.2, 3.5], sensitivity: 0.1 },
        { name: 'Безработица', current_value: 5.0, forecast_values: [5.2, 5.0, 4.8], sensitivity: 0.15 },
      ],
    },
    {
      scenario: 'optimistic',
      weight: 0.25,  // 25%
      pd_adjustment: -0.15,  // PD уменьшается на 15%
      lgd_adjustment: -0.10,  // LGD уменьшается на 10%
      factors: [
        { name: 'ВВП', current_value: 3.5, forecast_values: [4.5, 5.0, 5.5], sensitivity: 0.1 },
        { name: 'Безработица', current_value: 5.0, forecast_values: [4.5, 4.0, 3.5], sensitivity: 0.15 },
      ],
    },
    {
      scenario: 'pessimistic',
      weight: 0.25,  // 25%
      pd_adjustment: 0.30,   // PD увеличивается на 30%
      lgd_adjustment: 0.15,  // LGD увеличивается на 15%
      factors: [
        { name: 'ВВП', current_value: 3.5, forecast_values: [1.0, 0.5, 1.5], sensitivity: 0.1 },
        { name: 'Безработица', current_value: 5.0, forecast_values: [7.0, 8.5, 8.0], sensitivity: 0.15 },
      ],
    },
  ];
}

// ==================== SPPI ТЕСТ ====================

/**
 * Проведение SPPI теста для классификации ФИ
 */
export function performSPPITest(
  assetId: string,
  terms: ContractualTerms
): SPPITest {
  // Базовый кредитный договор?
  const basicLendingArrangement =
    terms.interest_rate_type !== 'mixed' ||
    (terms.benchmark_rate !== undefined && terms.spread !== undefined);

  // Процентные компоненты соответствуют?
  const interestComponentsPass =
    !terms.has_conversion_feature &&
    terms.interest_rate >= 0;

  // Досрочное погашение OK?
  const prepaymentFeaturesPass =
    !terms.has_prepayment_option ||
    (terms.prepayment_penalty !== undefined && terms.prepayment_penalty <= 0.02);

  // Пролонгация OK?
  const extensionFeaturesPass =
    !terms.has_extension_option;  // Упрощение: если есть опция - требует детального анализа

  // Условные события
  const contingentEventsPass = true;  // Требует анализа конкретного договора

  // Итоговый результат
  const sppiPassed =
    basicLendingArrangement &&
    interestComponentsPass &&
    prepaymentFeaturesPass &&
    extensionFeaturesPass &&
    contingentEventsPass;

  // Классификация
  let classificationResult: FinancialInstrumentCategory;
  if (!sppiPassed) {
    classificationResult = 'fvtpl';  // Не прошел SPPI -> FVTPL
  } else {
    classificationResult = 'amortised_cost';  // По умолчанию AC (зависит от бизнес-модели)
  }

  return {
    id: `sppi_${assetId}_${Date.now()}`,
    asset_id: assetId,
    test_date: new Date().toISOString().split('T')[0],
    contractual_terms: terms,
    basic_lending_arrangement: basicLendingArrangement,
    interest_components_pass: interestComponentsPass,
    prepayment_features_pass: prepaymentFeaturesPass,
    extension_features_pass: extensionFeaturesPass,
    contingent_events_pass: contingentEventsPass,
    sppi_passed: sppiPassed,
    classification_result: classificationResult,
    notes: sppiPassed
      ? 'SPPI тест пройден. Инструмент соответствует критериям базового кредитного договора.'
      : 'SPPI тест не пройден. Денежные потоки не являются исключительно платежами в счет основной суммы и процентов.',
  };
}

/**
 * Определение классификации ФИ на основе SPPI теста и бизнес-модели
 */
export function classifyFinancialInstrument(
  sppiPassed: boolean,
  businessModel: BusinessModel
): FinancialInstrumentCategory {
  if (!sppiPassed) {
    return 'fvtpl';  // Не прошел SPPI -> всегда FVTPL
  }

  switch (businessModel) {
    case 'hold_to_collect':
      return 'amortised_cost';
    case 'hold_to_collect_and_sell':
      return 'fvoci_debt';
    case 'other':
      return 'fvtpl';
    default:
      return 'amortised_cost';
  }
}

// ==================== УПРОЩЕННЫЙ ПОДХОД ====================

/**
 * Расчет ECL по упрощенному подходу (матрица резервирования)
 * Для торговой дебиторки по МСФО 9.5.5.15
 */
export function calculateSimplifiedECL(
  receivables: Array<{ amount: number; daysPastDue: number }>,
  provisionMatrix: ProvisionMatrix
): number {
  let totalECL = 0;

  for (const receivable of receivables) {
    // Находим подходящий бакет
    const bucket = findAgingBucket(receivable.daysPastDue, provisionMatrix.aging_buckets);
    if (bucket) {
      // Применяем ставку резервирования
      const rate = bucket.provision_rate * (1 + provisionMatrix.forward_looking_adjustment);
      totalECL += receivable.amount * rate;
    }
  }

  return totalECL;
}

/**
 * Поиск бакета по сроку просрочки
 */
function findAgingBucket(daysPastDue: number, buckets: AgingBucket[]): AgingBucket | undefined {
  return buckets.find(b =>
    daysPastDue >= b.days_from &&
    (b.days_to === null || daysPastDue <= b.days_to)
  );
}

/**
 * Создание стандартной матрицы резервирования
 */
export function createDefaultProvisionMatrix(): ProvisionMatrix {
  return {
    aging_buckets: [
      { name: 'Текущая', days_from: 0, days_to: 0, provision_rate: 0.01 },
      { name: '1-30 дней', days_from: 1, days_to: 30, provision_rate: 0.03 },
      { name: '31-60 дней', days_from: 31, days_to: 60, provision_rate: 0.10 },
      { name: '61-90 дней', days_from: 61, days_to: 90, provision_rate: 0.25 },
      { name: '91-180 дней', days_from: 91, days_to: 180, provision_rate: 0.50 },
      { name: '181-365 дней', days_from: 181, days_to: 365, provision_rate: 0.80 },
      { name: 'Более 365 дней', days_from: 366, days_to: null, provision_rate: 1.00 },
    ],
    historical_loss_rates: [0.01, 0.03, 0.10, 0.25, 0.50, 0.80, 1.00],
    forward_looking_adjustment: 0.05,  // +5% на прогнозную информацию
  };
}

// ==================== ПОЛНЫЙ РАСЧЕТ ДЛЯ АКТИВА ====================

/**
 * Полный расчет ECL для финансового актива
 */
export function calculateAssetECL(
  asset: FinancialAssetData,
  settings: ECLModelSettings
): ECLResult {
  // 1. Определение стадии
  const stage = determineStage(asset, settings);

  // 2. Получение параметров риска
  const pd = calculateAssetPD(asset, stage, settings);
  const lgd = calculateAssetLGD(asset);
  const ead = calculateAssetEAD(asset);

  // 3. Расчет 12-месячного ECL
  const ecl12Month = calculate12MonthECL(
    pd.pd_12_month,
    lgd.lgd_secured,
    ead.current_exposure,
    settings.effective_interest_rate
  );

  // 4. Расчет Lifetime ECL
  const maturityYears = calculateRemainingMaturity(asset.maturity_date);
  const eadProfile = calculateEADProfile(
    ead.current_exposure,
    maturityYears,
    ead.amortization_profile
  );

  const lifetimePeriods = calculateLifetimeECL(
    pd.pd_marginal,
    lgd.lgd_secured,
    eadProfile,
    settings.effective_interest_rate
  );

  const eclLifetime = sumLifetimeECL(lifetimePeriods);

  // 5. Выбор итогового ECL в зависимости от стадии
  let eclFinal: number;
  switch (stage) {
    case 'stage_1':
      eclFinal = ecl12Month;
      break;
    case 'stage_2':
    case 'stage_3':
    case 'poci':
      eclFinal = eclLifetime;
      break;
    default:
      eclFinal = ecl12Month;
  }

  // 6. Применение макро-корректировок
  eclFinal = applyMacroScenarios(eclFinal, settings.macro_scenarios);

  // 7. Коэффициент покрытия
  const coverageRatio = asset.current_balance > 0
    ? eclFinal / asset.current_balance
    : 0;

  return {
    id: `ecl_${asset.id}_${Date.now()}`,
    calculation_date: new Date().toISOString().split('T')[0],
    asset_id: asset.id,
    asset_type: asset.asset_type,
    gross_carrying_amount: asset.current_balance,
    stage,
    category: 'amortised_cost',  // Предполагаем AC
    pd,
    lgd,
    ead,
    ecl_12_month: ecl12Month,
    ecl_lifetime: eclLifetime,
    ecl_final: eclFinal,
    coverage_ratio: coverageRatio,
    ecl_by_period: lifetimePeriods,
    opening_balance: 0,
    charge_to_pnl: eclFinal,
    write_offs: 0,
    unwinding: 0,
    fx_adjustment: 0,
    closing_balance: eclFinal,
    methodology_notes: `Расчет ECL по модели ${stage === 'stage_1' ? '12-месячный' : 'Lifetime'} с применением макро-сценариев`,
    assumptions: [
      `PD 12M: ${(pd.pd_12_month * 100).toFixed(2)}%`,
      `LGD: ${(lgd.lgd_secured * 100).toFixed(2)}%`,
      `EAD: ${ead.current_exposure.toLocaleString()}`,
      `Стадия: ${stage}`,
    ],
    data_quality_score: 4,
  };
}

/**
 * Вспомогательные функции для расчета параметров актива
 */
function calculateAssetPD(
  asset: FinancialAssetData,
  stage: ImpairmentStage,
  settings: ECLModelSettings
): PDParameters {
  const basePD = asset.internal_rating ? getRatingPD(asset.internal_rating) : 0.02;
  const maturityYears = calculateRemainingMaturity(asset.maturity_date);
  const marginalPDs = annualPDToMarginal(basePD, maturityYears);

  // Для Stage 3 PD = 100%
  const pd12Month = stage === 'stage_3' ? 1.0 : basePD;
  const pdLifetime = stage === 'stage_3' ? 1.0 : marginalPDs.reduce((a, b) => a + b, 0);

  return {
    pd_12_month: pd12Month,
    pd_lifetime: Math.min(pdLifetime, 1),
    pd_marginal: marginalPDs,
    pd_cumulative: marginalPDs.map((_, i) =>
      marginalPDs.slice(0, i + 1).reduce((a, b) => a + b, 0)
    ),
    methodology: asset.internal_rating ? 'external_rating' : 'expert_judgment',
    data_source: asset.internal_rating ? 'Внутренний рейтинг' : 'Экспертная оценка',
  };
}

function calculateAssetLGD(asset: FinancialAssetData): LGDParameters {
  const baseLGD = getDefaultLGD(asset.asset_type);
  const hasCollateral = asset.collateral_value > 0;

  if (hasCollateral) {
    return calculateLGDWithCollateral(
      baseLGD,
      asset.current_balance,
      asset.collateral_value,
      0.20,  // 20% дисконт к залогу
      2,     // 2 года на реализацию
      asset.effective_rate || 0.10,
      0.10   // 10% затраты на взыскание
    );
  }

  return {
    lgd_secured: baseLGD,
    lgd_unsecured: baseLGD,
    lgd_downturn: Math.min(baseLGD * 1.15, 1),
    recovery_rate: 1 - baseLGD,
    collateral_haircut: 0,
    time_to_recovery: 24,
    cost_of_recovery: 0.10,
  };
}

function calculateAssetEAD(asset: FinancialAssetData): EADParameters {
  const ccf = getDefaultCCF(asset.asset_type);
  const ead = calculateEAD(asset.current_balance, asset.undrawn_commitment, ccf);

  return {
    current_exposure: ead,
    ccf,
    undrawn_amount: asset.undrawn_commitment,
    amortization_profile: 'linear',
  };
}

function calculateRemainingMaturity(maturityDate: string): number {
  const today = new Date();
  const maturity = new Date(maturityDate);
  const diffMs = maturity.getTime() - today.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365);
  return Math.max(Math.ceil(diffYears), 1);
}

// ==================== РАСЧЕТ ДЛЯ ПОРТФЕЛЯ ====================

/**
 * Расчет ECL для всего портфеля
 */
export function calculatePortfolioECL(
  project: IFRS9Project
): PortfolioECLCalculation {
  const assets = project.assets;
  const settings = project.settings;

  // Расчет ECL для каждого актива
  const assetResults = assets.map(asset => ({
    asset,
    result: calculateAssetECL(asset, settings),
  }));

  // Группировка по сегментам
  const segmentMap = new Map<AssetType, typeof assetResults>();
  for (const ar of assetResults) {
    const existing = segmentMap.get(ar.asset.asset_type) || [];
    existing.push(ar);
    segmentMap.set(ar.asset.asset_type, existing);
  }

  // Формирование сегментов
  const segments: PortfolioSegment[] = Array.from(segmentMap.entries()).map(([assetType, items]) => {
    const stage1 = items.filter(i => i.result.stage === 'stage_1');
    const stage2 = items.filter(i => i.result.stage === 'stage_2');
    const stage3 = items.filter(i => i.result.stage === 'stage_3' || i.result.stage === 'poci');

    const totalECL = items.reduce((sum, i) => sum + i.result.ecl_final, 0);
    const totalExposure = items.reduce((sum, i) => sum + i.asset.current_balance, 0);

    return {
      id: `seg_${assetType}`,
      name: getAssetTypeLabel(assetType),
      asset_type: assetType,
      number_of_assets: items.length,
      gross_carrying_amount: totalExposure,
      stage_distribution: {
        stage_1: {
          count: stage1.length,
          amount: stage1.reduce((sum, i) => sum + i.asset.current_balance, 0),
        },
        stage_2: {
          count: stage2.length,
          amount: stage2.reduce((sum, i) => sum + i.asset.current_balance, 0),
        },
        stage_3: {
          count: stage3.length,
          amount: stage3.reduce((sum, i) => sum + i.asset.current_balance, 0),
        },
      },
      avg_pd_12m: items.reduce((sum, i) => sum + i.result.pd.pd_12_month, 0) / items.length,
      avg_pd_lifetime: items.reduce((sum, i) => sum + i.result.pd.pd_lifetime, 0) / items.length,
      avg_lgd: items.reduce((sum, i) => sum + i.result.lgd.lgd_secured, 0) / items.length,
      ecl: totalECL,
      coverage_ratio: totalExposure > 0 ? totalECL / totalExposure : 0,
    };
  });

  // Агрегированные данные по стадиям
  const stage1Assets = assetResults.filter(ar => ar.result.stage === 'stage_1');
  const stage2Assets = assetResults.filter(ar => ar.result.stage === 'stage_2');
  const stage3Assets = assetResults.filter(ar => ar.result.stage === 'stage_3' || ar.result.stage === 'poci');

  const totalGrossExposure = assets.reduce((sum, a) => sum + a.current_balance, 0);
  const totalECL = assetResults.reduce((sum, ar) => sum + ar.result.ecl_final, 0);

  return {
    id: `portfolio_${project.id}`,
    name: project.name,
    calculation_date: new Date().toISOString().split('T')[0],
    client_name: project.client_name,
    client_type: 'other',
    segments,
    total_gross_exposure: totalGrossExposure,
    total_ecl: totalECL,
    total_coverage_ratio: totalGrossExposure > 0 ? totalECL / totalGrossExposure : 0,
    stage_1_exposure: stage1Assets.reduce((sum, ar) => sum + ar.asset.current_balance, 0),
    stage_1_ecl: stage1Assets.reduce((sum, ar) => sum + ar.result.ecl_final, 0),
    stage_2_exposure: stage2Assets.reduce((sum, ar) => sum + ar.asset.current_balance, 0),
    stage_2_ecl: stage2Assets.reduce((sum, ar) => sum + ar.result.ecl_final, 0),
    stage_3_exposure: stage3Assets.reduce((sum, ar) => sum + ar.asset.current_balance, 0),
    stage_3_ecl: stage3Assets.reduce((sum, ar) => sum + ar.result.ecl_final, 0),
    movement: createEmptyMovement(),
    disclosures: [],
  };
}

function getAssetTypeLabel(assetType: AssetType): string {
  const labels: Record<AssetType, string> = {
    corporate_loan: 'Корпоративные кредиты',
    retail_loan: 'Розничные кредиты',
    mortgage: 'Ипотечные кредиты',
    trade_receivable: 'Торговая дебиторка',
    lease_receivable: 'Лизинговая дебиторка',
    interbank: 'Межбанковские кредиты',
    securities_debt: 'Долговые ценные бумаги',
    guarantee: 'Финансовые гарантии',
    credit_line: 'Кредитные линии',
  };
  return labels[assetType] || assetType;
}

function createEmptyMovement(): ECLMovement {
  const today = new Date().toISOString().split('T')[0];
  return {
    period_start: today,
    period_end: today,
    opening_balance: 0,
    stage_transfers_in: 0,
    stage_transfers_out: 0,
    model_parameter_changes: 0,
    macro_adjustments: 0,
    new_originated: 0,
    derecognized: 0,
    write_offs: 0,
    recoveries: 0,
    fx_effect: 0,
    other_movements: 0,
    closing_balance: 0,
  };
}

// ==================== НАСТРОЙКИ ПО УМОЛЧАНИЮ ====================

/**
 * Создание настроек модели по умолчанию
 */
export function createDefaultSettings(): ECLModelSettings {
  return {
    effective_interest_rate: 0.12,  // 12%
    calculation_approach: 'mixed',
    sicr_pd_threshold_absolute: 0.01,  // 1%
    sicr_pd_threshold_relative: 200,   // 200%
    sicr_dpd_threshold: 30,
    default_definition: {
      dpd_threshold: 90,
      qualitative_indicators: [
        'Существенные финансовые затруднения',
        'Нарушение договорных обязательств',
        'Реструктуризация на льготных условиях',
        'Вероятность банкротства',
      ],
      unlikeliness_to_pay: true,
      cross_default: false,
    },
    macro_scenarios: createDefaultMacroScenarios(),
    simplified_approach_enabled: true,
    provision_matrix: createDefaultProvisionMatrix(),
  };
}

// ==================== ЭКСПОРТ УТИЛИТ ====================

export const IFRS9Utils = {
  // Базовые расчеты
  calculateECL,
  calculate12MonthECL,
  calculateLifetimeECL,
  sumLifetimeECL,

  // PD
  annualPDToMarginal,
  calculatePDFromMigrationMatrix,
  calculatePDFromRollRate,

  // LGD
  calculateLGDWithCollateral,
  getDefaultLGD,

  // EAD
  calculateEAD,
  calculateEADProfile,
  getDefaultCCF,

  // Стадии
  determineStage,
  assessSICR,

  // Макро
  applyMacroScenarios,
  createDefaultMacroScenarios,

  // SPPI
  performSPPITest,
  classifyFinancialInstrument,

  // Упрощенный подход
  calculateSimplifiedECL,
  createDefaultProvisionMatrix,

  // Полный расчет
  calculateAssetECL,
  calculatePortfolioECL,

  // Настройки
  createDefaultSettings,
};

export default IFRS9Utils;
