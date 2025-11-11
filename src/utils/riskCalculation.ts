/**
 * Утилиты для расчета рисков в модуле МСУК-1 Compliance
 */

import type { MSUKClient, RiskResult } from '@/types/msuk';

/**
 * Рассчитывает уровень риска для клиента на основе факторов МСУК-1
 * @param client - Данные клиента (может быть частичными)
 * @returns Результат расчета риска
 */
export const calculateRisk = (client: Partial<MSUKClient>): RiskResult => {
  let riskLevel = 0;
  const factors: string[] = [];
  let eqrRequired = false;

  if (client.publicCompany) {
    riskLevel += 2;
    factors.push('✓ Публичная компания (ПЗО)');
    eqrRequired = true;
  }
  
  if (client.litigation) {
    riskLevel += 2;
    factors.push('✓ Судебные разбирательства');
    eqrRequired = true;
  }
  
  if (client.conflictOfInterest) {
    riskLevel += 1;
    factors.push('✓ Конфликт интересов');
  }
  
  if (client.country === 'RU') {
    riskLevel += 1;
    factors.push('✓ Риск страны - Россия');
  }
  
  if (client.industry === 'Финансовые услуги' || client.industry === 'Страхование') {
    riskLevel += 1;
    factors.push('✓ Высокий риск отрасли');
  }

  const riskText: RiskResult['riskText'] = 
    riskLevel >= 3 ? 'ВЫСОКИЙ' : 
    riskLevel >= 1 ? 'СРЕДНИЙ' : 
    'НИЗКИЙ';
  
  return { riskLevel, riskText, factors, eqrRequired };
};

