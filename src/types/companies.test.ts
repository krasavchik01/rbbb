import { describe, expect, it } from 'vitest';
import {
  findCompanyByAnyValue,
  projectCompanyId,
  projectCompanyName,
  resolveProjectCompany,
} from './companies';

describe('canonical company mapping', () => {
  it.each(['RB A+Partners', 'A+Partners', 'aplus', 'comp-rb-a', 'ТОО МАК'])(
    'maps %s to ТОО МАК',
    (value) => {
      expect(findCompanyByAnyValue(value)).toMatchObject({ id: 'mak', name: 'ТОО МАК' });
    },
  );

  it('keeps Academy and IT Audit as separate canonical companies', () => {
    expect(findCompanyByAnyValue('RB Academy')?.id).toBe('academy');
    expect(findCompanyByAnyValue('RB Partners IT Audit')?.id).toBe('rb-partners-it-audit');
  });

  it('uses one authoritative order and never substitutes the client', () => {
    const project = {
      companyId: 'academy',
      companyName: 'ТОО МКФ',
      client: { name: 'RB A+Partners' },
      notes: JSON.stringify({ companyId: 'comp-rb-a', companyName: 'ТОО Academy' }),
    };
    expect(resolveProjectCompany(project)?.id).toBe('mak');
    expect(projectCompanyId(project)).toBe('mak');
    expect(projectCompanyName(project)).toBe('ТОО МАК');
    expect(projectCompanyName({ client: { name: 'ТОО МКФ' } })).toBe('Компания не указана');
  });

  it('normalizes object-shaped legacy values', () => {
    expect(projectCompanyName({ ourCompany: { id: 'mkf', name: 'Мусорное имя' } })).toBe('ТОО МКФ');
  });

  it('shows the human-readable name for a custom unmapped company', () => {
    expect(projectCompanyName({ notes: { companyId: 'custom-1', companyName: 'Новая компания' } }))
      .toBe('Новая компания');
  });
});
