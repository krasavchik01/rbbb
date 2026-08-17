import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_ACCESS_CONTROL,
  PROJECT_VISIBILITY_SECTIONS,
  canRoleViewProjectSection,
  normalizeProjectAccessControl,
  setProjectRoleVisibility,
  type ProjectAccessControl,
} from './projectAccessControl';
import { USER_ROLES } from '@/types/roles';

describe('projectAccessControl', () => {
  it('uses safe defaults: bonuses only for CEO and admin', () => {
    const access = normalizeProjectAccessControl(undefined);

    expect(access.team).toEqual(USER_ROLES);
    expect(access.hours).toEqual(USER_ROLES);
    expect(access.contractMoney).toEqual(['ceo', 'admin', 'deputy_director', 'procurement', 'accountant']);
    expect(access.bonuses).toEqual(['ceo', 'admin']);

    expect(canRoleViewProjectSection(access, 'ceo', 'bonuses')).toBe(true);
    expect(canRoleViewProjectSection(access, 'admin', 'bonuses')).toBe(true);
    expect(canRoleViewProjectSection(access, 'deputy_director', 'bonuses')).toBe(false);
    expect(canRoleViewProjectSection(access, 'partner', 'bonuses')).toBe(false);
  });

  it('falls back section by section while preserving an explicit empty role list', () => {
    const access = normalizeProjectAccessControl({
      bonuses: [],
      team: ['partner', 'partner', 'not-a-role', null],
    });

    expect(access.bonuses).toEqual([]);
    expect(access.team).toEqual(['partner']);
    expect(access.hours).toEqual(DEFAULT_PROJECT_ACCESS_CONTROL.hours);
    expect(access.contractMoney).toEqual(DEFAULT_PROJECT_ACCESS_CONTROL.contractMoney);
  });

  it('rejects unknown roles and malformed settings without throwing', () => {
    expect(canRoleViewProjectSection(undefined, 'ceo', 'bonuses')).toBe(true);
    expect(canRoleViewProjectSection(undefined, 'deputy_director', 'bonuses')).toBe(false);
    expect(canRoleViewProjectSection(undefined, 'unknown-role', 'team')).toBe(false);
    expect(canRoleViewProjectSection(undefined, null, 'team')).toBe(false);

    const access = normalizeProjectAccessControl('broken settings');
    expect(access).toEqual(DEFAULT_PROJECT_ACCESS_CONTROL);
    expect(access).not.toBe(DEFAULT_PROJECT_ACCESS_CONTROL);
  });

  it('adds and removes a role immutably, never creates duplicates and blocks bonus grants to other roles', () => {
    const original = normalizeProjectAccessControl(DEFAULT_PROJECT_ACCESS_CONTROL);
    const withDeputy = setProjectRoleVisibility(original, 'deputy_director', 'bonuses', true);
    const addedAgain = setProjectRoleVisibility(withDeputy, 'deputy_director', 'bonuses', true);
    const withoutCeo = setProjectRoleVisibility(addedAgain, 'ceo', 'bonuses', false);

    expect(original.bonuses).toEqual(['ceo', 'admin']);
    expect(withDeputy.bonuses).toEqual(['ceo', 'admin']);
    expect(addedAgain.bonuses).toEqual(['ceo', 'admin']);
    expect(withoutCeo.bonuses).toEqual(['admin']);
    expect(withoutCeo.team).toEqual(original.team);
    expect(withoutCeo.team).not.toBe(original.team);
  });

  it('always normalizes every declared visibility section', () => {
    const malformed = {
      team: ['ceo', 'ceo'],
      hours: 'all',
      contractMoney: ['procurement', 'invalid'],
      bonuses: ['admin', 'deputy_director'],
    } as unknown as ProjectAccessControl;

    const access = normalizeProjectAccessControl(malformed);
    expect(Object.keys(access)).toEqual(PROJECT_VISIBILITY_SECTIONS.map((section) => section.key));
    expect(access).toEqual({
      team: ['ceo'],
      hours: DEFAULT_PROJECT_ACCESS_CONTROL.hours,
      contractMoney: ['procurement'],
      bonuses: ['admin'],
    });
  });
});
