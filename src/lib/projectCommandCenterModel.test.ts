import { describe, expect, it } from 'vitest';
import { buildProjectCommandCenterModel, businessSeasonForDate } from './projectCommandCenterModel';

describe('businessSeasonForDate', () => {
  it('uses October through September rather than calendar years', () => {
    expect(businessSeasonForDate('2024-10-01')).toMatchObject({ key: '2024/25', startDate: '2024-10-01', endDate: '2025-09-30' });
    expect(businessSeasonForDate('2025-09-30')?.key).toBe('2024/25');
    expect(businessSeasonForDate('2025-10-01')?.key).toBe('2025/26');
  });
});

describe('buildProjectCommandCenterModel', () => {
  it('uses the contract end date as the single business season anchor', () => {
    const model = buildProjectCommandCenterModel({
      id: 'cross-season-project',
      name: 'Длинный проект',
      contract: {
        serviceStartDate: '2023-09-22',
        serviceEndDate: '2029-10-17',
      },
    });

    expect(model.businessSeason?.key).toBe('2029/30');
  });

  it('keeps contract subject, service, stage and linked period as distinct visible fields', () => {
    const model = buildProjectCommandCenterModel({
      id: 'p-1',
      name: 'Аудит ТОО «Клиент»',
      type: 'financial_audit',
      companyName: 'RB Partners',
      client: { name: 'ТОО «Клиент»' },
      contract: {
        number: '24/11-07/2PC',
        date: '2024-11-12',
        subject: 'Аудит финансовой отчётности за 6 месяцев 2024 года',
        serviceStartDate: '2024-10-01',
        serviceEndDate: '2025-09-30',
        amountWithoutVAT: 48000000,
      },
      notes: {
        files: [{ id: 'contract-1', category: 'contract', isSeafile: true, storagePath: '/contracts/24.pdf' }],
        stages: [{ id: 'stage-1', name: 'Промежуточный аудит', auditPeriodId: 'period-1', amountWithoutVAT: 48000000 }],
        auditPeriods: [{
          id: 'period-1', name: '6 месяцев 2024', type: 'six_months', startDate: '2024-10-01', endDate: '2025-03-31',
          deadline: '2025-04-15', status: 'in_progress', createdBy: 'user', createdAt: '2024-10-01', updatedAt: '2024-10-01',
        }],
      },
    });

    expect(model.companyName).toBe('RB Partners');
    expect(model.clientName).toBe('ТОО «Клиент»');
    expect(model.serviceLabel).toBe('Финансовый аудит');
    expect(model.contract.subject).toBe('Аудит финансовой отчётности за 6 месяцев 2024 года');
    expect(model.stagePeriods).toEqual([expect.objectContaining({ stageName: 'Промежуточный аудит', periodName: '6 месяцев 2024', linked: true })]);
    expect(model.businessSeason?.key).toBe('2024/25');
    expect(model.warnings).toEqual([]);
  });

  it('flags historical ambiguity instead of silently presenting it as complete data', () => {
    const model = buildProjectCommandCenterModel({
      id: 'p-2', name: 'Старый проект', type: 'consulting', notes: {
        stages: [{ id: 'stage-orphan', name: 'Этап без периода', auditPeriodId: 'missing-period' }],
        auditPeriods: [{
          id: 'period-orphan', name: 'Лишний период', type: 'custom', startDate: '2024-01-01', endDate: '2024-02-01',
          status: 'planned', createdBy: 'user', createdAt: '2024-01-01', updatedAt: '2024-01-01',
        }],
      },
    });

    expect(model.contract.amountWithoutVAT).toBeNull();
    expect(model.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'missing_company', 'missing_contract_subject', 'missing_contract_dates', 'missing_contract_amount',
      'missing_contract_file', 'stage_without_period', 'period_without_stage',
    ]));
  });
});
