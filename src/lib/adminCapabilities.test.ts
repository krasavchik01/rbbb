import { describe, expect, it } from 'vitest';
import {
  canAssignUserRole,
  canManageCriticalSettings,
  canManageEmployeeAccount,
  canManageUsers,
} from '@/lib/adminCapabilities';
import { projectCommandCenterCapabilities } from '@/lib/projectCommandCenterPermissions';
import { projectStatusOptionsForRole } from '@/lib/projectStatusActions';
import { roleCanAccessRoute } from '@/lib/roleAccess';
import { canRoleViewProjectSection } from '@/lib/projectAccessControl';
import { getEmployeeDbRoleForUserRole, normalizeUserRole } from '@/types/roles';

describe('admin assistant access boundaries', () => {
  it('can manage ordinary users without privilege escalation', () => {
    expect(canManageUsers('admin_assistant')).toBe(true);
    expect(roleCanAccessRoute('admin_assistant', '/user-management')).toBe(true);
    expect(canAssignUserRole('admin_assistant', 'assistant_1')).toBe(true);
    expect(canAssignUserRole('admin_assistant', 'manager_1')).toBe(true);
    expect(canManageEmployeeAccount('admin_assistant', 'assistant_1')).toBe(true);
  });

  it('uses a non-privileged database role representation', () => {
    expect(getEmployeeDbRoleForUserRole('admin_assistant')).toBe('designer');
    expect(normalizeUserRole('designer')).toBe('admin_assistant');
    expect(normalizeUserRole('it_admin')).toBe('admin');
  });

  it('cannot grant or modify critical accounts', () => {
    for (const role of ['ceo', 'deputy_director', 'procurement', 'accountant', 'admin', 'admin_assistant'] as const) {
      expect(canAssignUserRole('admin_assistant', role)).toBe(false);
      expect(canManageEmployeeAccount('admin_assistant', role)).toBe(false);
    }
    expect(canManageCriticalSettings('admin_assistant')).toBe(false);
    expect(canManageCriticalSettings('admin')).toBe(true);
  });

  it('keeps finance, accounting and bonuses hidden', () => {
    expect(canRoleViewProjectSection(undefined, 'admin_assistant', 'team')).toBe(true);
    expect(canRoleViewProjectSection(undefined, 'admin_assistant', 'hours')).toBe(true);
    expect(canRoleViewProjectSection(undefined, 'admin_assistant', 'contractMoney')).toBe(false);
    expect(canRoleViewProjectSection(undefined, 'admin_assistant', 'accounting')).toBe(false);
    expect(canRoleViewProjectSection(undefined, 'admin_assistant', 'bonuses')).toBe(false);
    expect(roleCanAccessRoute('admin_assistant', '/bonuses')).toBe(false);
  });

  it('can perform safe project administration but cannot close or delete', () => {
    const access = projectCommandCenterCapabilities('admin_assistant');
    expect(access.canEditProjectDetails).toBe(true);
    expect(access.canManageTeam).toBe(true);
    expect(access.canBulkAssignCompany).toBe(true);
    expect(access.canManageProjectStatus).toBe(true);
    expect(access.canSeeContractMoney).toBe(false);
    expect(access.canSeeBonusSummary).toBe(false);
    expect(access.canCloseProjects).toBe(false);
    expect(access.canDeleteProjects).toBe(false);

    const statuses = projectStatusOptionsForRole('admin_assistant').map((item) => item.value);
    expect(statuses).toContain('pending_payment_approval');
    expect(statuses).not.toContain('completed');
  });
});
