export interface ProjectCommandCenterCapabilities {
  canSeeContractMoney: boolean;
  canSeeBonusSummary: boolean;
  canEditProjectDetails: boolean;
  canManageTeam: boolean;
  canCloseProjects: boolean;
  canDeleteProjects: boolean;
  canBulkAssignCompany: boolean;
  canBulkAssignPartner: boolean;
  canBulkAssignTeam: boolean;
  canBulkAssignLeader: boolean;
  canManageProjectStatus: boolean;
  canManageContractors: boolean;
  canEditPeriods: boolean;
}

const EXECUTIVE_ROLES = ['ceo', 'admin'];
const DELEGATED_ROLES = ['admin', 'admin_assistant', 'ceo', 'deputy_director'];
const PROJECT_DETAILS_EDITOR_ROLES = ['admin', 'admin_assistant', 'procurement'];
const MONEY_ROLES = ['admin', 'ceo', 'procurement'];
const BONUS_SUMMARY_ROLES = ['admin', 'ceo'];

export function projectCommandCenterCapabilities(role?: string | null): ProjectCommandCenterCapabilities {
  const userRole = String(role || '');
  const isExecutive = EXECUTIVE_ROLES.includes(userRole);
  const isDelegated = DELEGATED_ROLES.includes(userRole);
  const canSeeContractMoney = MONEY_ROLES.includes(userRole);
  const canManageTeam = isDelegated;
  return {
    canSeeContractMoney,
    canSeeBonusSummary: BONUS_SUMMARY_ROLES.includes(userRole),
    canEditProjectDetails: PROJECT_DETAILS_EDITOR_ROLES.includes(userRole),
    canManageTeam,
    canCloseProjects: isExecutive,
    canDeleteProjects: isExecutive,
    canBulkAssignCompany: isDelegated,
    canBulkAssignPartner: isDelegated,
    canBulkAssignTeam: isDelegated,
    canBulkAssignLeader: isDelegated,
    canManageProjectStatus: isDelegated,
    canManageContractors: isDelegated,
    canEditPeriods: canManageTeam || userRole === 'partner' || userRole === 'procurement',
  };
}

export function contractAmountEditDeniedReason(role?: string | null): string | null {
  return projectCommandCenterCapabilities(role).canSeeContractMoney
    ? null
    : 'Only procurement, delegated deputy directors, CEO and admin can edit contract value.';
}
