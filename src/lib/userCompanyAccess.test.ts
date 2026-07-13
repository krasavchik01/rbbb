import { describe, expect, it } from 'vitest';
import {
  legacyProjectCompanyLabel,
  projectHasLegacyUnresolvedCompanyIdentity,
  projectHasMissingCompanyIdentity,
  projectIsVisibleWithinCompanyScope,
} from './userCompanyAccess';

describe('projectHasMissingCompanyIdentity', () => {
  it('keeps a project without company fields visible for assignment', () => {
    expect(projectHasMissingCompanyIdentity({ notes: { clientName: 'Клиент без компании' } })).toBe(true);
  });

  it('preserves the historical comp-rb-a company identity instead of calling it missing', () => {
    const project = { notes: { companyId: 'comp-rb-a' } };
    expect(projectHasMissingCompanyIdentity(project)).toBe(false);
    expect(projectHasLegacyUnresolvedCompanyIdentity(project)).toBe(true);
    expect(legacyProjectCompanyLabel(project)).toBe('RB A+Partners (историческое назначение)');
  });

  it('does not treat a project with a company identity as missing', () => {
    expect(projectHasMissingCompanyIdentity({
      notes: { companyId: 'mak', companyName: 'ТОО МАК' },
    })).toBe(false);
  });

  it('lets a deputy triage unassigned projects without exposing another company', () => {
    expect(projectIsVisibleWithinCompanyScope(
      { notes: { clientName: 'Без компании' } },
      ['ТОО МАК'],
      'deputy_director',
    )).toBe(true);

    expect(projectIsVisibleWithinCompanyScope(
      { notes: { companyName: 'Чужая компания' } },
      ['ТОО МАК'],
      'deputy_director',
    )).toBe(false);

    expect(projectIsVisibleWithinCompanyScope(
      { notes: { clientName: 'Без компании' } },
      ['ТОО МАК'],
      'assistant_1',
    )).toBe(false);

    expect(projectIsVisibleWithinCompanyScope(
      { notes: { companyId: 'comp-rb-a' } },
      ['ТОО МАК'],
      'deputy_director',
    )).toBe(true);
  });
});
