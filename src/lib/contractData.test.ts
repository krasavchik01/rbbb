import { describe, expect, it } from 'vitest';
import {
  parseMoney,
  projectAmountWithoutVAT,
  projectContract,
  projectContractFiles,
  projectDeadline,
  projectFiles,
  projectFinances,
  projectStartDate,
} from './contractData';

describe('contractData', () => {
  it('parses money from formatted strings', () => {
    expect(parseMoney('1 234 567 ₸')).toBe(1234567);
    expect(parseMoney('1 234 567,89')).toBe(1234567.89);
    expect(parseMoney('0 ₸')).toBe(0);
  });

  it('reads contract data from legacy notes fields', () => {
    const project = {
      deadline: '2026-12-31',
      start_date: '2026-01-01',
      notes: {
        contractNumber: '№ 10',
        contractDate: '2026-02-01',
        contractSubject: 'Audit',
        amountWithoutVAT: '4 500 000 ₸',
        currency: 'KZT',
      },
    };

    const contract = projectContract(project);
    expect(contract?.number).toBe('№ 10');
    expect(contract?.date).toBe('2026-02-01');
    expect(contract?.subject).toBe('Audit');
    expect(contract?.amountWithoutVAT).toBe(4500000);
    expect(contract?.serviceStartDate).toBe('2026-01-01');
    expect(contract?.serviceEndDate).toBe('2026-12-31');
  });

  it('prefers positive amounts over zero placeholders', () => {
    const project = {
      contract: { amountWithoutVAT: 0 },
      notes: {
        contract: { amountWithoutVAT: '7 980 000' },
        finances: { amountWithoutVAT: 0 },
      },
    };

    expect(projectAmountWithoutVAT(project)).toBe(7980000);
    expect(projectFinances(project).amountWithoutVAT).toBe(7980000);
  });

  it('reads files from JSON notes and legacy contract urls', () => {
    const project = {
      notes: {
        files: JSON.stringify([
          { id: 'doc-1', fileName: 'Документ.pdf', publicUrl: 'https://example.test/doc.pdf' },
        ]),
        contract: {
          contractScanUrl: 'https://example.test/scan.pdf',
        },
      },
    };

    expect(projectFiles(project)).toHaveLength(1);
    expect(projectContractFiles(project).map((file) => file.fileName)).toContain('Скан договора');
  });

  it('reads project dates from all supported legacy fields', () => {
    expect(projectStartDate({ notes: { startDate: '2025-01-01' } })).toBe('2025-01-01');
    expect(projectDeadline({ notes: { serviceTerm: '2025-12-31' } })).toBe('2025-12-31');
  });
});
