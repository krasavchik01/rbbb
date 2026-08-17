import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Download, ExternalLink, Eye, FileSpreadsheet, Filter, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { useAppSettings } from '@/lib/appSettings';
import { canRoleViewProjectSection } from '@/lib/projectAccessControl';
import {
  legacyProjectCompanyLabel,
  projectHasMissingCompanyIdentity,
  projectMatchesAllowedCompanies,
} from '@/lib/userCompanyAccess';
import {
  contractFileUrl as readContractFileUrl,
  dedupeProjectFiles,
  parseMoney,
  projectAmountWithoutVAT as readProjectAmountWithoutVAT,
  projectContract as readProjectContract,
  projectContractFiles as readProjectContractFiles,
  projectDeadline as readProjectDeadline,
  projectFinances as readProjectFinances,
  projectNotes as readProjectNotes,
  projectStartDate as readProjectStartDate,
} from '@/lib/contractData';
import { loadTimesheetHoursSnapshot, type ProjectHoursTotals } from '@/lib/timesheets';
import {
  bonusPaymentKey,
  loadBonusPayments,
  summarizeBonusPaymentRegistry,
  type BonusPaymentLedgerState,
  type BonusPaymentRow,
} from '@/lib/bonusPayments';
import { calculateExecutiveBonusFinances } from '@/lib/bonusLedger';
import { calculateProjectFinances } from '@/types/project-v3';
import { hasPermission, isUserRole, ROLE_LABELS } from '@/types/roles';
import {
  buildProjectStatusUpdate,
  MANAGED_PROJECT_STATUS_LABELS,
  projectStatusOptionsForRole,
  type ManagedProjectStatus,
} from '@/lib/projectStatusActions';
import { notifyProjectReadyForCeoBonuses } from '@/lib/projectNotifications';
import { getAuditPeriods, projectToAuditPeriod, type AuditPeriod } from '@/lib/auditPeriods';
import { buildProjectCommandCenterModel } from '@/lib/projectCommandCenterModel';
import {
  BUSINESS_SEASON_NO_DATE,
  countProjectBusinessSeasons,
  projectBusinessSeasonDates,
  projectBusinessSeasonValueFromProject,
} from '@/lib/businessSeason';
import {
  canonicalTeamMarkerPatch,
  dedupeCanonicalTeamMembers,
  effectiveProjectTeam,
  financeParticipants,
  isSettledBonus,
  projectForFinanceCalculation,
} from '@/lib/projectLegacyCompatibility';
import { projectCommandCenterCapabilities } from '@/lib/projectCommandCenterPermissions';
import { ProjectDataIntegrityDrawer } from '@/components/projects/ProjectDataIntegrityDrawer';
import type { ExecutivePortfolioSummary } from '@/components/projects/ExecutivePortfolioOverview';
import {
  ProjectInlineDetail,
  type ProjectInlineBonusEmployee,
  type ProjectInlineTone,
} from '@/components/projects/ProjectInlineDetail';
import { CommandCenterColumnFilter } from '@/components/projects/CommandCenterColumnFilter';
import { supabaseDataStore } from '@/lib/supabaseDataStore';
import type { CanonicalTeamMember } from '@/types/project-domain';
import type * as XLSXNs from 'xlsx';

const loadXlsx = (): Promise<typeof XLSXNs> => import('xlsx');

type ProjectViewFilter =
  | 'all'
  | 'working'
  | 'ready_bonus'
  | 'closed';

// Historical layouts stay compile-checked during the migration, but are
// unreachable: /projects is the only mounted management screen.
const LEGACY_PROJECT_VIEWS_ENABLED: boolean = false;

type ProjectDeadlineFilter = 'all' | 'overdue' | 'next_30' | 'no_deadline';
type ProjectPeriodFilter = 'all' | 'has_periods' | 'no_periods';
type AuditPeriodTypeFilter = 'all' | AuditPeriod['type'];
type ProjectSort = 'default' | 'deadline_asc' | 'deadline_desc' | 'amount_desc' | 'hours_desc';
type ProjectCommandScope = 'executive' | 'operations';
type PartnerFilter = 'all' | 'unassigned' | string;
type CompanyFilter = 'all' | 'missing' | string;
type YearFilter = 'all' | string;
type BusinessSeasonFilter = 'all' | string;
type ContractFileFilter = 'all' | 'uploaded' | 'missing';
type CompanyOption = { id: string; name: string; fullName?: string; isActive?: boolean };
type PeriodDraft = { name: string; type: AuditPeriod['type']; startDate: string; endDate: string; deadline: string };
type ProjectDateDraft = { startDate: string; deadline: string };
type DateRange = { start: Date; end: Date };
type TeamTemplateCandidate = {
  partnerId: string;
  ownerName: string;
  sourceProjectId: string;
  signature: string;
  team: CanonicalTeamMember[];
};
type TeamTemplateDefinition = {
  id: string;
  label: string;
  sourceProjectId: string;
  occurrenceCount: number;
  team: CanonicalTeamMember[];
};
const COMMAND_CENTER_COLUMN_FILTER_KEYS = [
  'company',
  'project',
  'season',
  'contract',
  'subject',
  'service',
  'stage',
  'period',
  'partner',
  'leader',
  'status',
  'completeness',
  'money',
  'hours',
  'bonus',
] as const;
type ColumnFilterKey = typeof COMMAND_CENTER_COLUMN_FILTER_KEYS[number];
type ColumnFilterState = Record<ColumnFilterKey, string>;
const PROJECT_TABLE_PAGE_SIZES = [25, 50] as const;
const SHOW_LEGACY_BONUS_WORKSPACE = false;
const SHOW_LEGACY_GROUPED_PROJECT_ROWS = false;

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const TEAM_COLUMNS = [
  { key: 'partner', label: 'Партнер', percent: '29%' },
  { key: 'project_leader', label: 'Руководитель', percent: '24%' },
  { key: 'manager_1', label: 'Менеджер 1', percent: '10%' },
  { key: 'manager_2', label: 'Менеджер 2', percent: '8%' },
  { key: 'manager_3', label: 'Менеджер 3', percent: '6%' },
  { key: 'supervisor_3', label: 'Супервайзер 3', percent: '15%' },
  { key: 'supervisor_2', label: 'Супервайзер 2', percent: '10%' },
  { key: 'supervisor_1', label: 'Супервайзер 1', percent: '6%' },
  { key: 'tax_specialist_1', label: 'Налоговик 1', percent: '3%' },
  { key: 'tax_specialist_2', label: 'Налоговик 2', percent: '3%' },
  { key: 'assistant_3', label: 'Ассистент 3', percent: '4%' },
  { key: 'assistant_2', label: 'Ассистент 2', percent: '4%' },
  { key: 'assistant_1', label: 'Ассистент 1', percent: '2%' },
] as const;

function projectStatus(project: any): string {
  const notes = readProjectNotes(project);
  if (project?.status === 'completed' || project?.status === 'closed') return 'completed';
  return notes?.status || project?.status || 'new';
}

function projectTeam(project: any): CanonicalTeamMember[] {
  const notes = readProjectNotes(project);
  if (Array.isArray(notes?.team)) return notes.team as CanonicalTeamMember[];
  return [];
}

function projectAmount(project: any): number {
  return readProjectAmountWithoutVAT(project);
}

function projectClient(project: any): string {
  const notes = readProjectNotes(project);
  const value = project?.client?.name || notes?.client?.name || project?.companyName || project?.clientName || notes?.clientName;
  if (value) return value;
  return project?.client?.name || project?.notes?.client?.name || project?.companyName || project?.clientName || 'Клиент не указан';
}

function projectCompany(project: any): string {
  const notes = readProjectNotes(project);
  const value = project?.companyName || project?.ourCompany || project?.company || notes?.companyName || notes?.ourCompany || notes?.company;
  if (value) return value;
  const legacyCompany = legacyProjectCompanyLabel(project);
  if (legacyCompany) return legacyCompany;
  return (
    project?.companyName ||
    project?.ourCompany ||
    project?.company ||
    project?.notes?.companyName ||
    project?.notes?.ourCompany ||
    project?.notes?.company ||
    'Не указана'
  );
}

function projectType(project: any): string {
  const notes = readProjectNotes(project);
  const value = project?.type || project?.projectType || notes?.type || notes?.auditType;
  if (value) return value;
  return project?.type || project?.projectType || project?.notes?.type || project?.notes?.auditType || 'Тип не указан';
}

function projectContract(project: any): any {
  return readProjectContract(project);
}

function projectContractFiles(project: any): any[] {
  return readProjectContractFiles(project);
}

function contractFileUrl(file: any): string {
  return readContractFileUrl(file);
}

function hasContractEvidence(row: any): boolean {
  const contract = projectContract(row.project);
  return !!(
    contract?.number ||
    contract?.date ||
    contract?.subject ||
    Number(contract?.amountWithoutVAT || 0) > 0 ||
    projectContractFiles(row.project).length > 0
  );
}

function rowHasContractEvidence(row: any): boolean {
  const contract = row?.contract || projectContract(row?.project);
  return !!(
    contract?.number ||
    contract?.date ||
    contract?.subject ||
    Number(contract?.amountWithoutVAT || 0) > 0 ||
    (Array.isArray(row?.contractFiles) && row.contractFiles.length > 0) ||
    projectContractFiles(row?.project).length > 0
  );
}

function rawProjectStartDate(project: any): string {
  return readProjectStartDate(project);
}

function rawProjectDeadline(project: any): string {
  return readProjectDeadline(project);
}

function dateStamp(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : Number.POSITIVE_INFINITY;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function projectHasSavedPeriodList(project: any): boolean {
  if (Array.isArray(project?.auditPeriods)) return true;
  const notes = project?.notes;
  if (notes && typeof notes === 'object' && Array.isArray(notes.auditPeriods)) return true;
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      return Array.isArray(parsed?.auditPeriods);
    } catch {
      return false;
    }
  }
  return false;
}

function projectPeriods(project: any): AuditPeriod[] {
  const explicit = getAuditPeriods(project);
  if (projectHasSavedPeriodList(project)) return explicit;
  if (explicit.length > 0) return explicit;

  const start = rawProjectStartDate(project);
  const deadline = rawProjectDeadline(project);
  const hasPeriodSignal = start || deadline || project?.notes?.period || /\b20\d{2}\b/u.test(project?.name || '');
  return hasPeriodSignal ? [projectToAuditPeriod(project)] : [];
}

function periodLabel(period: AuditPeriod): string {
  const dates = period.startDate || period.endDate
    ? `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`
    : 'даты не указаны';
  return `${period.name} · ${dates}`;
}

function auditPeriodTypeLabel(type?: AuditPeriod['type']): string {
  if (type === 'six_months') return '6 месяцев';
  if (type === 'nine_months') return '9 месяцев';
  if (type === 'year') return 'Годовой';
  return 'Особый период';
}

function deadlineInfo(deadline: string, status: string) {
  if (!deadline) return { tone: 'none' as const, label: 'срок не указан', daysLeft: null as number | null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(deadline);
  if (!Number.isFinite(date.getTime())) return { tone: 'none' as const, label: deadline, daysLeft: null as number | null };
  date.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((date.getTime() - today.getTime()) / 86400000);
  if (status === 'completed' || status === 'closed') return { tone: 'done' as const, label: formatDate(deadline), daysLeft };
  if (daysLeft < 0) return { tone: 'overdue' as const, label: `просрочен на ${Math.abs(daysLeft)} дн.`, daysLeft };
  if (daysLeft <= 30) return { tone: 'soon' as const, label: `${daysLeft} дн.`, daysLeft };
  return { tone: 'normal' as const, label: formatDate(deadline), daysLeft };
}

function deadlineBadgeClass(tone: 'none' | 'done' | 'overdue' | 'soon' | 'normal') {
  if (tone === 'overdue') return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50';
  if (tone === 'soon') return 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50';
  if (tone === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50';
  return 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50';
}

function inlineDeadlineTone(tone: 'none' | 'done' | 'overdue' | 'soon' | 'normal'): ProjectInlineTone {
  if (tone === 'overdue') return 'danger';
  if (tone === 'soon') return 'warning';
  if (tone === 'done') return 'positive';
  if (tone === 'normal') return 'info';
  return 'neutral';
}

function inlineReadinessTone(level: 'ready' | 'attention' | 'closed'): ProjectInlineTone {
  if (level === 'ready') return 'positive';
  if (level === 'attention') return 'warning';
  return 'neutral';
}

function teamName(member: any): string {
  return member?.userName || member?.name || member?.employeeName || 'Без имени';
}

function teamRole(member: any): string {
  return member?.role || member?.role_on_project || 'member';
}

function isPartnerRole(role: string): boolean {
  return role === 'partner';
}

function isLeaderRole(role: string): boolean {
  return ['project_leader', 'manager_1', 'manager_2', 'manager_3'].includes(role);
}

function teamMemberId(member: any): string {
  const employee = member?.employee || member?.profile || member?.user || {};
  return member?.userId || member?.user_id || member?.employeeId || member?.employee_id || employee?.id || member?.id || '';
}

function teamTemplateSignature(team: CanonicalTeamMember[]): string {
  return team
    .map((member) => {
      const identity = teamMemberId(member)
        || String((member as any)?.userEmail || (member as any)?.email || teamName(member)).trim().toLowerCase();
      return `${teamRole(member)}:${identity}`;
    })
    .sort((left, right) => left.localeCompare(right, 'ru'))
    .join('|');
}

function selectPartnerTeamTemplate(
  candidates: TeamTemplateCandidate[],
  partnerId: string,
  excludedSourceProjectId?: string,
): TeamTemplateDefinition | null {
  const eligible = candidates.filter((candidate) => (
    candidate.partnerId === partnerId
    && candidate.sourceProjectId !== excludedSourceProjectId
  ));
  if (eligible.length === 0) return null;

  const groups = new Map<string, TeamTemplateCandidate[]>();
  for (const candidate of eligible) {
    const group = groups.get(candidate.signature) || [];
    group.push(candidate);
    groups.set(candidate.signature, group);
  }

  const rankedGroups = [...groups.values()].sort((left, right) => {
    if (right.length !== left.length) return right.length - left.length;
    if (right[0].team.length !== left[0].team.length) return right[0].team.length - left[0].team.length;
    return left[0].sourceProjectId.localeCompare(right[0].sourceProjectId, 'ru');
  });
  const winningGroup = rankedGroups[0];
  const source = [...winningGroup].sort((left, right) => (
    left.sourceProjectId.localeCompare(right.sourceProjectId, 'ru')
  ))[0];

  return {
    id: `partner:${partnerId}`,
    label: `Команда партнёра: ${source.ownerName} · ${source.team.length} чел.${winningGroup.length > 1 ? ` · ${winningGroup.length} проекта` : ''}`,
    sourceProjectId: source.sourceProjectId,
    occurrenceCount: winningGroup.length,
    team: source.team.map((member) => ({ ...member })),
  };
}

function bonusMemberIdentity(member: any): string {
  return teamMemberId(member) || normalizeProjectGroupText(teamName(member));
}

function projectRoleLabel(role: string): string {
  const fixed = TEAM_COLUMNS.find((column) => column.key === role)?.label;
  if (fixed) return fixed;
  if (isUserRole(role)) return ROLE_LABELS[role];
  return role.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()) || 'Другая роль';
}

function bonusRoleColumnsForTeam(team: any[]): Array<{ key: string; label: string; percent: string }> {
  const known = new Set<string>(TEAM_COLUMNS.map((column) => column.key));
  const extraRoles = Array.from(new Set(team.map(teamRole).filter((role) => !known.has(role))));
  return [
    ...TEAM_COLUMNS.map((column) => ({ ...column })),
    ...extraRoles.map((role) => ({ key: role, label: projectRoleLabel(role), percent: 'индивидуально' })),
  ];
}

function employeeName(employee: any): string {
  return employee?.name || employee?.full_name || employee?.email || employee?.id || 'Сотрудник';
}

function roleDefaultPercent(roleKey: string): number {
  const role = TEAM_COLUMNS.find((column) => column.key === roleKey);
  return Number(String(role?.percent || '0').replace('%', '')) || 0;
}

function teamByRole(team: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const column of TEAM_COLUMNS) {
    map[column.key] = team.filter((member) => teamRole(member) === column.key).map(teamName).join(' ');
  }
  return map;
}

function teamMembersByRole(team: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const column of TEAM_COLUMNS) {
    map[column.key] = team.filter((member) => teamRole(member) === column.key);
  }
  return map;
}

function teamMemberKey(member: any): string {
  return `${teamRole(member)}__${teamMemberId(member) || normalizeProjectGroupText(teamName(member))}`;
}

function uniqueMembersFromTeams(teams: CanonicalTeamMember[][]): CanonicalTeamMember[] {
  const seen = new Set<string>();
  const members: CanonicalTeamMember[] = [];

  for (const team of teams) {
    for (const member of team || []) {
      const key = teamMemberKey(member);
      if (seen.has(key)) continue;
      seen.add(key);
      members.push(member);
    }
  }

  return members;
}

function coveragePartnerNames(team: any[]): string[] {
  return team.filter((member) => teamRole(member) === 'partner').map(teamName);
}

function memberBonusPercent(member: any, finances: any): number {
  const id = teamMemberId(member);
  const storedPercent = id ? finances?.teamBonuses?.[id]?.percent : undefined;
  return Number(storedPercent ?? member?.bonusPercent ?? 0) || 0;
}

function memberBonusAmount(member: any, finances: any): number {
  const id = teamMemberId(member);
  return Number(id ? finances?.teamBonuses?.[id]?.amount : 0) || 0;
}

function hoursPairKey(employeeId: string, projectId: string): string {
  return `${employeeId}__${projectId}`;
}

function financeFor(project: any, team: CanonicalTeamMember[] = projectTeam(project)) {
  return calculateExecutiveBonusFinances(project, team);
}

function exportTeamList(team: any[], finances: any, includeBonuses: boolean): string {
  if (!Array.isArray(team) || team.length === 0) return '';

  return TEAM_COLUMNS.flatMap((column) => {
    const members = team.filter((member) => teamRole(member) === column.key);
    if (members.length === 0) return [];

    const names = members.map((member) => {
      const name = teamName(member);
      if (!includeBonuses) return name;
      const percent = memberBonusPercent(member, finances);
      const amount = memberBonusAmount(member, finances);
      return `${name} (${percent}% / ${money.format(amount)} ₸)`;
    });

    return [`${column.label}: ${names.join(', ')}`];
  }).join('\n');
}

function exportContractLabel(row: any): string {
  const contract = row.contract || {};
  const number = contract.number || contract.contractNumber;
  const date = contract.date || contract.contractDate;
  if (!number && !date) return '';
  return [number ? `№ ${number}` : '', date ? `от ${formatDate(date)}` : ''].filter(Boolean).join(' ');
}

function buildProjectExportRows(
  sourceRows: any[],
  access: { canSeeContractMoney: boolean; canSeeBonuses: boolean; canSeeTeam: boolean; canSeeHours: boolean },
): Record<string, string | number>[] {
  return sourceRows.map((row, index) => {
    const totalBonusAmount = Number(row.finances?.totalBonusAmount || row.finances?.totalPaidBonuses) || 0;
    const base: Record<string, string | number> = {
      '№': index + 1,
      Проект: row.name,
      Клиент: row.client,
      'Вид проекта': row.type,
      'Срок проекта': `${formatDate(row.startDate)} - ${formatDate(row.deadline)}`,
      Статус: row.readiness?.label || '',
      'Что не так': row.readiness?.issues?.join(', ') || '',
      Закрытие: row.readiness?.level === 'closed' ? 'Закрыт' : 'В работе',
    };

    if (access.canSeeContractMoney) {
      base['Наша компания'] = row.company;
      base['Сумма без НДС'] = Number(row.amount || 0);
      base['Договор'] = exportContractLabel(row);
    }

    if (access.canSeeBonuses) {
      base['Бонусный пул %'] = Number(row.finances?.bonusPercent || 0);
      base['Бонусы'] = totalBonusAmount;
    }
    if (access.canSeeContractMoney && access.canSeeBonuses) {
      base['Грязный доход'] = Number(row.finances?.grossProfit || 0);
    }

    const realTeam = row.coverageTeam || row.team || [];
    if (access.canSeeTeam) {
      base['Партнер'] = row.partnerNames?.join(', ') || 'не назначен';
      base['Руководитель'] =
        realTeam.filter((member: any) => isLeaderRole(teamRole(member))).map(teamName).join(', ') || 'не назначен';
      base['Команда'] = exportTeamList(realTeam, row.finances || {}, access.canSeeBonuses);
    }
    if (access.canSeeHours) {
      base['Часы утверждено'] = Number(row.hours?.approved || 0);
      base['Часы ждут'] = Number(row.hours?.pending || 0);
    }
    base['Записей в базе'] = row.duplicateRows?.length || 1;
    base['ID проектов'] = (row.projectIds || [row.id]).join(', ');

    return base;
  });
}

const LEGACY_ROLE_EXPORT_COLUMNS = [
  { key: 'partner', name: 'Партнер', amount: 'Сумма партнера' },
  { key: 'project_leader', name: 'Руководитель проекта', amount: 'Сумма руководителя' },
  { key: 'manager_1', name: 'Менеджер 1', amount: 'Сумма менеджера 1' },
  { key: 'manager_2', name: 'Менеджер 2', amount: 'Сумма менеджера 2' },
  { key: 'manager_3', name: 'Менеджер 3', amount: 'Сумма менеджера 3' },
  { key: 'supervisor_3', name: 'Супервайзер 3', amount: 'Сумма СВ3' },
  { key: 'supervisor_2', name: 'Супервайзер 2', amount: 'Сумма СВ2' },
  { key: 'supervisor_1', name: 'Супервайзер 1', amount: 'Сумма СВ1' },
  { key: 'tax_specialist_1', name: 'Налоговик 1', amount: 'Сумма налог. 1' },
  { key: 'tax_specialist_2', name: 'Налоговик 2', amount: 'Сумма налог. 2' },
  { key: 'assistant_3', name: 'Ассистент 3', amount: 'Сумма асс. 3' },
  { key: 'assistant_2', name: 'Ассистент 2', amount: 'Сумма асс. 2' },
  { key: 'assistant_1', name: 'Ассистент 1', amount: 'Сумма асс. 1' },
  { key: '__other__', name: 'Другие участники', amount: 'Сумма других участников' },
] as const;

const LEGACY_CEO_EXPORT_HEADERS = [
  '№',
  'Проект / клиент',
  'Вид проекта',
  'Наша компания',
  'Договор',
  'Дата договора',
  'Предмет договора',
  'Срок оказания услуг',
  'Сумма без НДС',
  'Статус',
  'Бонус %',
  'Итого бонусный пул',
  ...LEGACY_ROLE_EXPORT_COLUMNS.flatMap((column) => [column.name, column.amount]),
  'ГПХ / субподряд',
  'Сумма ГПХ',
  'Предрасход',
  'Распределено команде',
  'Остаток бонусного пула',
  'Утверждено к выплате',
  'Фактически выплачено',
  'Итого расходы',
  'База после расходов',
  'Грязный доход',
] as const;

type LegacyExportColumn = typeof LEGACY_CEO_EXPORT_HEADERS[number];
type LegacyExportRow = Record<LegacyExportColumn, string | number>;

function legacyMoney(value: unknown): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function legacyMoneyOrFallback(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function legacyRowTeam(row: any): any[] {
  return row.coverageTeam || row.team || [];
}

function legacyRoleMembers(row: any, role: string): any[] {
  if (role === '__other__') {
    const knownRoles = new Set(
      LEGACY_ROLE_EXPORT_COLUMNS
        .filter((column) => column.key !== '__other__')
        .map((column) => column.key as string),
    );
    return legacyRowTeam(row).filter((member) => !knownRoles.has(teamRole(member)));
  }
  return legacyRowTeam(row).filter((member) => teamRole(member) === role);
}

function legacyRoleMemberBonus(member: any, row: any, role: string): number | '' {
  const identity = teamMemberId(member) || normalizeProjectGroupText(teamName(member));
  const firstRole = LEGACY_ROLE_EXPORT_COLUMNS.find((column) => (
    legacyRoleMembers(row, column.key).some((candidate) => (
      (teamMemberId(candidate) || normalizeProjectGroupText(teamName(candidate))) === identity
    ))
  ))?.key;
  return firstRole === role ? memberBonusAmount(member, row.finances || {}) : '';
}

function legacyContractors(row: any): any[] {
  const finances = row.finances || {};
  const projectFinances = readProjectFinances(row.project || {});
  return [
    ...(Array.isArray(finances.contractors) ? finances.contractors : []),
    ...(Array.isArray(projectFinances.contractors) ? projectFinances.contractors : []),
  ];
}

function legacyContractorNames(row: any): string {
  const names = legacyContractors(row)
    .map((contractor) => contractor?.name || contractor?.label || contractor?.description)
    .filter(Boolean);
  return Array.from(new Set(names)).join(', ');
}

function legacyContractorAmount(row: any): number {
  const explicit = legacyMoney(row.finances?.totalContractorsAmount);
  if (explicit > 0) return explicit;
  return legacyContractors(row).reduce((sum, contractor) => sum + legacyMoney(contractor?.amount), 0);
}

function legacyServiceRange(row: any): string {
  const model = buildProjectCommandCenterModel(row.project || {});
  const start = model.contract.serviceStartDate || row.startDate;
  const end = model.contract.serviceEndDate || row.deadline;
  if (!start && !end) return '';
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function legacyExportProjectRows(
  row: any,
  index: number,
  paymentByProject?: ReadonlyMap<string, BonusPaymentLedgerState>,
): LegacyExportRow[] {
  const model = buildProjectCommandCenterModel(row.project || {});
  const gphAmount = legacyContractorAmount(row);
  const preExpense = legacyMoney(row.finances?.preExpenseAmount);
  const contractAmount = model.contract.amountWithoutVAT ?? legacyMoney(row.amount);
  const bonusPool = legacyMoney(row.finances?.totalBonusAmount);
  const allocatedBonuses = legacyMoney(row.finances?.totalPaidBonuses);
  const distributedBonuses = allocatedBonuses;
  const totalCosts = legacyMoneyOrFallback(row.finances?.totalCosts, gphAmount + preExpense + distributedBonuses);
  const bonusBaseFallback = Math.max(0, legacyMoney(contractAmount) - gphAmount - preExpense);
  const grossProfitFallback = legacyMoney(contractAmount) - totalCosts;
  const paymentLedger = paymentByProject
    ? projectPaymentLedger(row.projectIds?.length ? row.projectIds : [row.id], paymentByProject)
    : null;
  const roleMembersByColumn = LEGACY_ROLE_EXPORT_COLUMNS.map((column) => ({
    ...column,
    members: legacyRoleMembers(row, column.key),
  }));
  const contractorNames = legacyContractorNames(row);
  const maxLines = Math.max(1, ...roleMembersByColumn.map((column) => column.members.length));

  return Array.from({ length: maxLines }, (_, lineIndex) => {
    const isFirstLine = lineIndex === 0;
    const result: LegacyExportRow = {
      '№': isFirstLine ? index + 1 : '',
      'Проект / клиент': isFirstLine ? `${row.name || ''}${row.client ? `\n${row.client}` : ''}` : '',
      'Вид проекта': isFirstLine ? row.type || '' : '',
      'Наша компания': isFirstLine ? row.company || '' : '',
      'Договор': isFirstLine ? model.contract.number || exportContractLabel(row) : '',
      'Дата договора': isFirstLine && model.contract.date ? formatDate(model.contract.date) : '',
      'Предмет договора': isFirstLine ? model.contract.subject || '' : '',
      'Срок оказания услуг': isFirstLine ? legacyServiceRange(row) : '',
      'Сумма без НДС': isFirstLine ? contractAmount ?? '' : '',
      'Статус': isFirstLine ? row.readiness?.label || row.status || '' : '',
      'Бонус %': isFirstLine ? legacyMoney(row.finances?.bonusPercent) : '',
      'Итого бонусный пул': isFirstLine ? bonusPool : '',
      'ГПХ / субподряд': isFirstLine ? contractorNames : '',
      'Сумма ГПХ': isFirstLine ? gphAmount : '',
      'Предрасход': isFirstLine ? preExpense : '',
      'Распределено команде': isFirstLine ? distributedBonuses : '',
      'Остаток бонусного пула': isFirstLine ? bonusPool - distributedBonuses : '',
      'Утверждено к выплате': isFirstLine && paymentLedger ? paymentLedger.approvedUnpaidAmount : '',
      'Фактически выплачено': isFirstLine && paymentLedger ? paymentLedger.paidAmount : '',
      'Итого расходы': isFirstLine ? totalCosts : '',
      'База после расходов': isFirstLine ? legacyMoneyOrFallback(row.finances?.bonusBase, bonusBaseFallback) : '',
      'Грязный доход': isFirstLine ? legacyMoneyOrFallback(row.finances?.grossProfit, grossProfitFallback) : '',
    } as LegacyExportRow;

    for (const column of roleMembersByColumn) {
      const member = column.members[lineIndex];
      result[column.name as LegacyExportColumn] = member ? teamName(member) : '';
      result[column.amount as LegacyExportColumn] = member ? legacyRoleMemberBonus(member, row, column.key) : '';
    }

    return result;
  });
}

function legacyPartnerSheetName(name: string): string {
  const cleaned = String(name || 'Без партнера')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Без партнера').slice(0, 31);
}

function legacyUniqueSheetName(workbook: any, name: string): string {
  const base = legacyPartnerSheetName(name);
  const existing = new Set<string>(workbook.SheetNames || []);
  if (!existing.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const suffix = ` ${index}`;
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base.slice(0, 25)} ${Date.now().toString().slice(-5)}`;
}

function legacyPartnerKeys(row: any): string[] {
  const names = row.partnerNames?.length ? row.partnerNames : legacyRoleMembers(row, 'partner').map(teamName);
  return names.length > 0 ? Array.from(new Set(names)) : ['Без партнера'];
}

function legacyTotalsRow(rows: LegacyExportRow[]): (string | number)[] {
  const numericColumns = new Set<LegacyExportColumn>([
    'Сумма без НДС',
    'Итого бонусный пул',
    ...LEGACY_ROLE_EXPORT_COLUMNS.map((column) => column.amount as LegacyExportColumn),
    'Сумма ГПХ',
    'Предрасход',
    'Распределено команде',
    'Остаток бонусного пула',
    'Утверждено к выплате',
    'Фактически выплачено',
    'Итого расходы',
    'База после расходов',
    'Грязный доход',
  ]);
  return LEGACY_CEO_EXPORT_HEADERS.map((header, index) => {
    if (index === 1) return 'ИТОГО';
    if (!numericColumns.has(header)) return '';
    return rows.reduce((sum, row) => sum + legacyMoney(row[header]), 0);
  });
}

function appendLegacyCeoSheet(
  XLSX: any,
  workbook: any,
  sheetName: string,
  sourceRows: any[],
  paymentByProject?: ReadonlyMap<string, BonusPaymentLedgerState>,
) {
  const rows = sourceRows.flatMap((row, index) => legacyExportProjectRows(row, index, paymentByProject));
  const aoa: (string | number)[][] = [
    [`CEO ведомость · ${sheetName}`],
    [`Проект → сумма → бонусный пул → роли → ГПХ/предрасход → доход`],
    [],
    [...LEGACY_CEO_EXPORT_HEADERS],
    ...rows.map((row) => LEGACY_CEO_EXPORT_HEADERS.map((header) => row[header] ?? '')),
    legacyTotalsRow(rows),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const totalColumnCount = LEGACY_CEO_EXPORT_HEADERS.length;
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalColumnCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalColumnCount - 1 } },
  ];
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: Math.max(4, aoa.length - 2), c: totalColumnCount - 1 } }) };
  autosizeLegacySheet(worksheet, aoa);
  formatLegacySheetCells(XLSX, worksheet, aoa.length, totalColumnCount);
  XLSX.utils.book_append_sheet(workbook, worksheet, legacyUniqueSheetName(workbook, sheetName));
}

function buildLegacyCeoWorkbook(
  XLSX: any,
  sourceRows: any[],
  paymentByProject?: ReadonlyMap<string, BonusPaymentLedgerState>,
) {
  const workbook = XLSX.utils.book_new();
  appendLegacyCeoSheet(XLSX, workbook, 'ИТОГО', sourceRows, paymentByProject);
  const byPartner = new Map<string, any[]>();
  for (const row of sourceRows) {
    for (const partner of legacyPartnerKeys(row)) {
      if (!byPartner.has(partner)) byPartner.set(partner, []);
      byPartner.get(partner)?.push(row);
    }
  }
  [...byPartner.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru'))
    .forEach(([partner, rows]) => appendLegacyCeoSheet(XLSX, workbook, partner, rows, paymentByProject));
  return workbook;
}

function autosizeExportSheet(sheet: any, rows: Record<string, string | number>[]) {
  const keys = Object.keys(rows[0] || {});
  sheet['!cols'] = keys.map((key) => {
    const contentWidth = rows.reduce((width, row) => {
      const value = String(row[key] ?? '');
      return Math.max(width, ...value.split('\n').map((line) => line.length));
    }, key.length);
    return { wch: Math.min(Math.max(contentWidth + 2, 12), 48) };
  });
}

function autosizeLegacySheet(sheet: any, aoa: (string | number)[][]) {
  sheet['!cols'] = LEGACY_CEO_EXPORT_HEADERS.map((header, columnIndex) => {
    const contentWidth = aoa.reduce((width, row) => {
      const value = String(row[columnIndex] ?? '');
      return Math.max(width, ...value.split('\n').map((line) => line.length));
    }, String(header).length);
    return { wch: Math.min(Math.max(contentWidth + 2, 10), 34) };
  });
}

function formatLegacySheetCells(XLSX: any, sheet: any, rowCount: number, columnCount: number) {
  const moneyHeaders = new Set<string>(LEGACY_CEO_EXPORT_HEADERS.filter((header) => /Сумма|Итого|Грязный|База|Разница|Предрасход|пул/i.test(header)));
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address];
      if (!cell) continue;
      if (rowIndex === 0 || rowIndex === 3 || rowIndex === rowCount - 1) cell.s = { font: { bold: true } };
      if (moneyHeaders.has(String(LEGACY_CEO_EXPORT_HEADERS[columnIndex])) && typeof cell.v === 'number') cell.z = '#,##0';
    }
  }
}

function normalizeProjectGroupText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function partnerFilterKey(value: string): string {
  const tokens = normalizeProjectGroupText(value)
    .split(' ')
    .filter((token) => token.length >= 2)
    .filter((token) => !/(ович|евич|улы|ұлы|кызы|қызы)$/u.test(token));
  if (tokens.length >= 2) {
    return tokens.slice(0, 2).sort().join(' ');
  }
  return tokens.join(' ');
}

function companyAllowedNames(company: CompanyOption): string[] {
  return [company.name, company.fullName].filter(Boolean) as string[];
}

function rowSourceProjects(row: any): any[] {
  const duplicateRows = Array.isArray(row.duplicateRows) && row.duplicateRows.length > 0 ? row.duplicateRows : [row];
  return duplicateRows.map((item: any) => item.project || item).filter(Boolean);
}

function rowMatchesCompanyOption(row: any, company: CompanyOption): boolean {
  const allowedNames = companyAllowedNames(company);
  if (allowedNames.length === 0) return false;
  return rowSourceProjects(row).some((project) => projectMatchesAllowedCompanies(project, allowedNames));
}

function rowHasMissingCompany(row: any): boolean {
  return rowSourceProjects(row).some((project) => projectHasMissingCompanyIdentity(project));
}

function yearsFromText(value: string): string[] {
  return [...String(value || '').matchAll(/20\d{2}/g)].map((match) => match[0]);
}

function yearFromDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return yearsFromText(value)[0] || '';
  }
  return String(date.getFullYear());
}

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const text = String(value).trim();
  const ruMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const date = ruMatch
    ? new Date(Number(ruMatch[3]), Number(ruMatch[2]) - 1, Number(ruMatch[1]))
    : new Date(text);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function makeDateRange(startValue: string, endValue: string): DateRange | null {
  const start = parseDateValue(startValue);
  const end = parseDateValue(endValue);
  if (!start && !end) return null;
  const rangeStart = start || end;
  const rangeEnd = end || start;
  if (!rangeStart || !rangeEnd) return null;
  return rangeStart.getTime() <= rangeEnd.getTime()
    ? { start: rangeStart, end: rangeEnd }
    : { start: rangeEnd, end: rangeStart };
}

function yearRangeStart(year: number): Date {
  return new Date(year, 0, 1);
}

function yearRangeEnd(year: number): Date {
  return new Date(year, 11, 31);
}

function rowDateRanges(row: any): DateRange[] {
  // Operational filtering follows the project's own dates only. Historical
  // auditPeriods are a read-only migration archive and must not move a project
  // into another year/date range.
  const projectRange = makeDateRange(row.startDate, row.deadline);
  return projectRange ? [projectRange] : [];
}

function businessSeasonLabel(year: number): string {
  return `Сезон ${year} · октябрь ${year - 1} — сентябрь ${year}`;
}

function rowBusinessSeasonValue(row: any) {
  return projectBusinessSeasonValueFromProject(row.project);
}

function rowMatchesBusinessSeason(row: any, value: BusinessSeasonFilter): boolean {
  if (value === 'all') return true;
  return rowBusinessSeasonValue(row) === value;
}

function optionalMoneyFilterValue(value: string): number | null {
  const raw = String(value || '').trim();
  if (!raw || !/[0-9]/.test(raw)) return null;
  const parsed = parseMoney(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowMatchesAmountRange(row: any, fromValue: string, toValue: string): boolean {
  const from = optionalMoneyFilterValue(fromValue);
  const to = optionalMoneyFilterValue(toValue);
  if (from === null && to === null) return true;
  const amount = Number(row?.amount || 0);
  if (from !== null && to !== null) {
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    return amount >= min && amount <= max;
  }
  return from === null ? amount <= (to as number) : amount >= from;
}

function projectOperationalState(row: any): Exclude<ProjectViewFilter, 'all'> {
  if (row?.readiness?.level === 'closed') return 'closed';
  if (row?.status === 'pending_payment_approval') return 'ready_bonus';
  return 'working';
}

function rowMatchesAuditPeriodType(row: any, value: AuditPeriodTypeFilter): boolean {
  return value === 'all' || (row.periods || []).some((period: AuditPeriod) => period.type === value);
}

function plannedBonusPool(row: any): number {
  const value = Number(row?.finances?.totalBonusAmount);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function allocatedDraftBonuses(row: any): number {
  const value = Number(row?.finances?.totalPaidBonuses);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function rowNeedsBonusReview(row: any, hoursVerified = true): boolean {
  if (row?.status !== 'pending_payment_approval') return false;
  if (!hoursVerified) return true;
  if ((row?.projectIds || [row?.id]).filter(Boolean).length > 1) return true;
  const pool = plannedBonusPool(row);
  const allocated = allocatedDraftBonuses(row);
  const team = row?.coverageTeam || row?.team || [];
  return team.length === 0
    || Number(row?.hours?.pending || 0) > 0
    || pool <= 0
    || allocated <= 0
    || Math.abs(pool - allocated) > 1;
}

function memberPaymentLedger(
  projectIds: readonly string[],
  employeeId: string,
  byKey: ReadonlyMap<string, BonusPaymentLedgerState>,
): BonusPaymentLedgerState {
  return projectIds.reduce<BonusPaymentLedgerState>((acc, projectId) => {
    const value = byKey.get(bonusPaymentKey(projectId, employeeId));
    if (!value) return acc;
    acc.approvedUnpaidAmount += value.approvedUnpaidAmount;
    acc.paidAmount += value.paidAmount;
    acc.pendingAmount += value.pendingAmount;
    acc.rowCount += value.rowCount;
    if (value.latestPaymentDate && (!acc.latestPaymentDate || value.latestPaymentDate > acc.latestPaymentDate)) {
      acc.latestPaymentDate = value.latestPaymentDate;
    }
    return acc;
  }, { approvedUnpaidAmount: 0, paidAmount: 0, pendingAmount: 0, rowCount: 0, latestPaymentDate: null });
}

function projectPaymentLedger(
  projectIds: readonly string[],
  byProject: ReadonlyMap<string, BonusPaymentLedgerState>,
): BonusPaymentLedgerState {
  const total: BonusPaymentLedgerState = {
    approvedUnpaidAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    rowCount: 0,
    latestPaymentDate: null,
  };
  for (const projectId of projectIds) {
    const value = byProject.get(projectId);
    if (!value) continue;
    total.approvedUnpaidAmount += value.approvedUnpaidAmount;
    total.paidAmount += value.paidAmount;
    total.pendingAmount += value.pendingAmount;
    total.rowCount += value.rowCount;
    if (value.latestPaymentDate && (!total.latestPaymentDate || value.latestPaymentDate > total.latestPaymentDate)) {
      total.latestPaymentDate = value.latestPaymentDate;
    }
  }
  return total;
}

const EMPTY_COLUMN_FILTERS = COMMAND_CENTER_COLUMN_FILTER_KEYS.reduce((acc, key) => {
  acc[key] = '';
  return acc;
}, {} as ColumnFilterState);

function columnFilterTokens(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[,;|\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function textColumnMatches(haystack: string, filter: string): boolean {
  const tokens = columnFilterTokens(filter);
  if (tokens.length === 0) return true;
  const normalized = String(haystack || '').toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function numberColumnMatches(amount: number, filter: string): boolean {
  const raw = String(filter || '').trim();
  if (!raw) return true;
  const range = raw.match(/^\s*(\d[\d\s]*)?\s*-\s*(\d[\d\s]*)?\s*$/);
  if (range && (range[1] || range[2])) {
    const min = range[1] ? Number(range[1].replace(/\s/g, '')) : Number.NEGATIVE_INFINITY;
    const max = range[2] ? Number(range[2].replace(/\s/g, '')) : Number.POSITIVE_INFINITY;
    return amount >= min && amount <= max;
  }
  const exact = Number(raw.replace(/\s/g, ''));
  if (Number.isFinite(exact)) return amount >= exact;
  return textColumnMatches(String(amount), raw);
}

function rowMatchesColumnFilters(
  row: any,
  filters: ColumnFilterState,
  canSeeMoney: boolean,
  canSeeBonuses: boolean,
  canSeeTeam: boolean,
  canSeeHours: boolean,
): boolean {
  if (!hasActiveColumnFilters(filters)) return true;
  const notes = readProjectNotes(row.project);
  const commandModel = buildProjectCommandCenterModel(row.project);
  const team = row.coverageTeam || row.team || [];
  const partnerText = [...(row.partnerNames || []), ...team.filter((member: any) => teamRole(member) === 'partner').map(teamName)].join(' ');
  const leaderText = team.filter((member: any) => isLeaderRole(teamRole(member))).map(teamName).join(' ');
  const periodText = (row.periods || []).map((period: AuditPeriod) => `${period.name} ${periodLabel(period)} ${auditPeriodTypeLabel(period.type)} ${period.startDate || ''} ${period.endDate || ''} ${period.deadline || ''}`).join(' ');
  const stageText = (notes?.stages || []).map((stage: any) => `${stage.name || ''} ${stage.title || ''} ${stage.stageAmountWithoutVAT || ''}`).join(' ');
  const seasonValue = rowBusinessSeasonValue(row);
  const seasonYear = seasonValue.match(/^season:(20\d{2})$/)?.[1];
  const seasonText = seasonYear
    ? `${seasonYear} ${businessSeasonLabel(Number(seasonYear))}`
    : 'Без даты';
  const contractText = `${commandModel.contract.number || ''} ${commandModel.contract.date || ''} ${commandModel.contract.serviceStartDate || ''} ${commandModel.contract.serviceEndDate || ''}`;
  const statusText = `${row.status} ${row.readiness?.label || ''} ${(row.readiness?.issues || []).join(' ')} ${row.deadlineState?.label || ''}`;
  const completenessText = `${statusText} ${commandModel.warnings.map((item) => `${item.code} ${item.label} ${item.severity}`).join(' ')}`;
  const hourValue = Number(row.hours?.approved || 0) + Number(row.hours?.pending || 0);
  const bonusValue = Number(row.finances?.totalBonusAmount || row.finances?.totalPaidBonuses || 0);

  return (
    textColumnMatches(row.company, filters.company) &&
    textColumnMatches(`${row.name} ${row.client}`, filters.project) &&
    textColumnMatches(seasonText, filters.season) &&
    textColumnMatches(contractText, filters.contract) &&
    textColumnMatches(commandModel.contract.subject || '', filters.subject) &&
    textColumnMatches(row.type, filters.service) &&
    textColumnMatches(stageText, filters.stage) &&
    textColumnMatches(periodText, filters.period) &&
    (!canSeeTeam || textColumnMatches(partnerText, filters.partner)) &&
    (!canSeeTeam || textColumnMatches(leaderText, filters.leader)) &&
    textColumnMatches(statusText, filters.status) &&
    textColumnMatches(completenessText, filters.completeness) &&
    (!canSeeMoney || numberColumnMatches(Number(row.amount || 0), filters.money)) &&
    (!canSeeHours || numberColumnMatches(hourValue, filters.hours)) &&
    (!canSeeBonuses || numberColumnMatches(bonusValue, filters.bonus))
  );
}

function hasActiveColumnFilters(filters: ColumnFilterState): boolean {
  return Object.values(filters).some((value) => String(value || '').trim().length > 0);
}

function readInitialColumnFilters(): ColumnFilterState {
  if (typeof window === 'undefined') return EMPTY_COLUMN_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return COMMAND_CENTER_COLUMN_FILTER_KEYS.reduce((acc, key) => {
    acc[key] = params.get(`cf_${key}`) || '';
    return acc;
  }, {} as ColumnFilterState);
}

function normalizeProjectViewFilter(value: string | null | undefined): ProjectViewFilter {
  if (value === 'working' || value === 'ready_bonus' || value === 'closed') return value;
  if (value === 'bonus_attention') return 'ready_bonus';
  if (
    value === 'attention'
    || value === 'portfolio_attention'
    || value === 'no_partner'
    || value === 'no_leader'
    || value === 'no_contract'
    || value === 'no_amount'
    || value === 'waiting_hours'
  ) return 'working';
  return 'all';
}

function normalizeBusinessSeasonFilter(value: string | null | undefined): BusinessSeasonFilter {
  return value === BUSINESS_SEASON_NO_DATE || (value && /^season:20\d{2}$/.test(value)) ? value : 'all';
}

function syncCommandCenterUrl(state: {
  search: string;
  columnFilters: ColumnFilterState;
  viewFilter: ProjectViewFilter;
  businessSeasonFilter: BusinessSeasonFilter;
  amountFromFilter: string;
  amountToFilter: string;
  contractFileFilter: ContractFileFilter;
  deadlineFilter: ProjectDeadlineFilter;
  periodFilter: ProjectPeriodFilter;
  auditPeriodTypeFilter: AuditPeriodTypeFilter;
  sortBy: ProjectSort;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const setOrDelete = (key: string, value: string, emptyValue = '') => {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === emptyValue) params.delete(key);
    else params.set(key, normalized);
  };
  setOrDelete('q', state.search);
  setOrDelete('view', state.viewFilter, 'all');
  setOrDelete('season', state.businessSeasonFilter, 'all');
  setOrDelete('amountFrom', state.amountFromFilter);
  setOrDelete('amountTo', state.amountToFilter);
  setOrDelete('contractFile', state.contractFileFilter, 'all');
  setOrDelete('deadline', state.deadlineFilter, 'all');
  setOrDelete('periods', state.periodFilter, 'all');
  setOrDelete('periodType', state.auditPeriodTypeFilter, 'all');
  setOrDelete('sort', state.sortBy, 'deadline_asc');
  Object.entries(state.columnFilters).forEach(([key, value]) => setOrDelete(`cf_${key}`, value));
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState(null, '', next);
}

function bucketRange(value: string): DateRange | null {
  const yearMatch = value.match(/^year:(20\d{2})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return { start: yearRangeStart(year), end: yearRangeEnd(year) };
  }

  const quarterMatch = value.match(/^quarter:(20\d{2})-Q([1-4])$/);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    const startMonth = (quarter - 1) * 3;
    return {
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 3, 0),
    };
  }

  const monthMatch = value.match(/^month:(20\d{2})-(0[1-9]|1[0-2])$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]) - 1;
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0),
    };
  }

  return null;
}

function rangesIntersect(left: DateRange, right: DateRange): boolean {
  return left.start.getTime() <= right.end.getTime() && right.start.getTime() <= left.end.getTime();
}

function rowMatchesDateFilter(row: any, value: YearFilter): boolean {
  if (value === 'all') return true;
  const target = bucketRange(value);
  if (!target) return rowYears(row).includes(value);
  return rowDateRanges(row).some((range) => rangesIntersect(range, target));
}

function rowYears(row: any): string[] {
  const years = new Set<string>();
  for (const value of [row.name, row.client, row.company, row.startDate, row.deadline]) {
    for (const year of yearsFromText(value || '')) years.add(year);
  }
  for (const year of [yearFromDate(row.startDate), yearFromDate(row.deadline)]) {
    if (year) years.add(year);
  }
  for (const period of row.periods || []) {
    for (const value of [period.name, period.startDate, period.endDate, period.deadline]) {
      for (const year of yearsFromText(value || '')) years.add(year);
    }
    for (const year of [yearFromDate(period.startDate), yearFromDate(period.endDate), yearFromDate(period.deadline)]) {
      if (year) years.add(year);
    }
  }
  return [...years].sort();
}

function projectGroupKey(row: any): string {
  const name = normalizeProjectGroupText(row.name || row.client);
  const client = normalizeProjectGroupText(row.client || row.name);
  const company = normalizeProjectGroupText(row.company || '');
  const periods = row.periods.map((period: AuditPeriod) => normalizeProjectGroupText(period.name)).join('|');
  return `${company}__${client || name}__${periods || name}`;
}

function uniqueTeamMembers(rows: any[]): any[] {
  const seen = new Set<string>();
  const team: any[] = [];

  for (const row of rows) {
    for (const member of row.team || []) {
      const key = teamMemberKey(member);
      if (seen.has(key)) continue;
      seen.add(key);
      team.push(member);
    }
  }

  return team;
}

function uniqueCoverageTeamMembers(rows: any[]): any[] {
  return uniqueMembersFromTeams(rows.map((row) => row.coverageTeam || row.team || []));
}

function mergePeriods(rows: any[]): AuditPeriod[] {
  const seen = new Set<string>();
  const periods: AuditPeriod[] = [];

  for (const row of rows) {
    for (const period of row.periods || []) {
      const key = `${period.name || ''}__${period.startDate || ''}__${period.endDate || ''}__${period.deadline || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const existingTeamSource = (period as any).teamSource as string | undefined;
      const hasOwnTeam = existingTeamSource === 'period' || (!existingTeamSource && Array.isArray(period.team) && period.team.length > 0);
      periods.push({
        ...period,
        sourceProjectId: period.sourceProjectId || row.id,
        team: hasOwnTeam ? period.team : [],
        teamSource: hasOwnTeam ? 'period' : 'empty',
      } as AuditPeriod);
    }
  }

  return periods;
}

function keepExplicitPeriodTeams(periods: AuditPeriod[], sourceProjectId?: string): AuditPeriod[] {
  return (periods || []).map((period) => {
    const existingTeamSource = (period as any).teamSource as string | undefined;
    const hasOwnTeam = existingTeamSource === 'period' || (!existingTeamSource && Array.isArray(period.team) && period.team.length > 0);
    return {
      ...period,
      sourceProjectId: period.sourceProjectId || sourceProjectId,
      team: hasOwnTeam ? period.team : [],
      teamSource: hasOwnTeam ? 'period' : 'empty',
    } as AuditPeriod;
  });
}

function periodTeam(period: AuditPeriod): CanonicalTeamMember[] {
  return Array.isArray(period.team) ? period.team : [];
}

function periodStatusLabel(status?: string): string {
  if (status === 'completed') return 'Закрыт';
  if (status === 'ready_for_review') return 'На проверке';
  if (status === 'in_progress') return 'В работе';
  return 'План';
}

function periodStatusBadgeClass(status?: string): string {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30';
  if (status === 'ready_for_review') return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30';
  return 'bg-muted text-muted-foreground';
}

function choosePrimaryProjectRow(rows: any[]): any {
  const open = rows.filter((row) => row.readiness.level !== 'closed');
  const candidates = open.length > 0 ? open : rows;
  return [...candidates].sort((a, b) => {
    const aContract = hasContractEvidence(a) ? 0 : 1;
    const bContract = hasContractEvidence(b) ? 0 : 1;
    if (aContract !== bContract) return aContract - bContract;
    const aTeam = a.team.length;
    const bTeam = b.team.length;
    if (aTeam !== bTeam) return bTeam - aTeam;
    return dateStamp(a.deadline) - dateStamp(b.deadline);
  })[0] || rows[0];
}

function projectReadiness(row: {
  status: string;
  team: any[];
  amount: number;
  hasContract: boolean;
  hours: ProjectHoursTotals;
  includeContractIssues: boolean;
  includeFinancialIssues: boolean;
}) {
  const hasPartner = row.team.some((member) => teamRole(member) === 'partner');
  const hasLeader = row.team.some((member) => ['project_leader', 'manager_1', 'manager_2', 'manager_3'].includes(teamRole(member)));
  const issues: string[] = [];
  if (!hasPartner) issues.push('нет партнера');
  if (!hasLeader) issues.push('нет руководителя');
  if (row.team.length === 0) issues.push('нет команды');
  if (row.includeContractIssues && !row.hasContract) issues.push('нет договора');
  if (row.includeFinancialIssues && row.amount <= 0) issues.push('нет суммы');
  if (row.hours.pending > 0) issues.push('ждут часы');

  if (row.status === 'completed' || row.status === 'closed') return { level: 'closed' as const, label: 'Закрыт', issues };
  if (issues.length === 0) return { level: 'ready' as const, label: 'В работе', issues };
  return { level: 'attention' as const, label: 'Требует внимания', issues };
}

function readinessWithHoursState(
  readiness: ReturnType<typeof projectReadiness>,
  status: string,
  hoursState: { loading: boolean; complete: boolean; error: string | null },
): ReturnType<typeof projectReadiness> {
  if (status === 'completed' || status === 'closed' || hoursState.complete) return readiness;
  const issue = hoursState.loading ? 'часы загружаются' : 'часы не проверены';
  return {
    level: 'attention',
    label: hoursState.loading ? 'Загрузка часов' : 'Проверить часы',
    issues: Array.from(new Set([...readiness.issues, issue])),
  };
}

function issueBadgeClass(level: 'ready' | 'attention' | 'closed') {
  if (level === 'ready') return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50';
  if (level === 'closed') return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100';
  return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50';
}

function workloadComplexity(hours: ProjectHoursTotals): { label: string; className: string; total: number } {
  const total = Number(hours.approved || 0) + Number(hours.pending || 0);
  if (total >= 160) return { label: 'Высокая', className: 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-200', total };
  if (total >= 80) return { label: 'Средняя', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-200', total };
  return { label: 'Низкая', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-200', total };
}

function teamMemberForRole(team: any[], predicate: (role: string) => boolean): any | undefined {
  return (team || []).find((member) => predicate(teamRole(member)));
}

function displayMoney(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${money.format(parsed)} ₸` : '—';
}

function ProjectFilterField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ProjectTablePagination({
  page,
  pageCount,
  pageSize,
  start,
  end,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/10 px-3 py-2 text-xs">
      <div className="text-muted-foreground">
        Показаны <span className="font-medium text-foreground tabular-nums">{start + 1}–{end}</span> из <span className="font-medium text-foreground tabular-nums">{total}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[116px]" aria-label="Количество проектов на странице">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_TABLE_PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size} строк</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Назад
        </Button>
        <span className="min-w-[72px] text-center tabular-nums">{page} из {pageCount}</span>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Далее
        </Button>
      </div>
    </div>
  );
}

function EmployeeSearchAdd({
  employees,
  disabled,
  onPick,
  onAddContractor,
  triggerLabel = 'Добавить',
  triggerAriaLabel,
  triggerTestId,
  triggerClassName = '',
  selectedEmployeeId,
}: {
  employees: any[];
  disabled?: boolean;
  onPick: (employeeId: string) => void;
  onAddContractor?: () => void;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  triggerTestId?: string;
  triggerClassName?: string;
  selectedEmployeeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return employees
      .filter((employee) => {
        if (!q) return true;
        const role = String(employee?.role || '');
        const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] || '';
        const haystack = `${employeeName(employee)} ${employee?.email || ''} ${role} ${roleLabel} ${employee?.position || ''} ${employee?.department || ''}`.toLowerCase();
        return haystack.includes(q);
      });
  }, [employees, q]);

  const pick = (employeeId: string) => {
    onPick(employeeId);
    setOpen(false);
    setQuery('');
  };

  const addContractor = () => {
    onAddContractor?.();
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`h-9 min-w-0 justify-start ${triggerClassName || 'w-full'}`}
          disabled={disabled}
          aria-label={triggerAriaLabel || triggerLabel}
          data-testid={triggerTestId}
        >
          {triggerLabel === 'Добавить' ? <Plus className="mr-2 h-4 w-4 shrink-0" /> : <Search className="mr-2 h-4 w-4 shrink-0" />}
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-1rem)] max-w-[320px] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по ФИО, email или роли"
              aria-label="Поиск по ФИО, email или роли"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1" role="listbox" aria-label="Сотрудники">
          {onAddContractor && (
            <>
              <button
                type="button"
                aria-label="Добавить ГПХ"
                data-testid="add-contractor"
                className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  addContractor();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  addContractor();
                }}
              >
                <span className="font-medium">Добавить ГПХ / субподряд</span>
                <span className="text-xs text-muted-foreground">Указать сумму</span>
              </button>
              <div className="my-1 border-t" />
            </>
          )}
          {filtered.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
          )}
          {filtered.map((employee) => (
            <button
              type="button"
              key={employee.id}
              role="option"
              aria-selected={employee.id === selectedEmployeeId}
              className="flex w-full flex-col rounded px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={() => pick(employee.id)}
            >
              <span className="font-medium">{employeeName(employee)}</span>
              {(employee?.role || employee?.email) && (
                <span className="text-xs text-muted-foreground">
                  {[employee?.role ? (ROLE_LABELS[employee.role as keyof typeof ROLE_LABELS] || employee.role) : '', employee?.email || ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ProjectCommandCenter({ scope }: { scope?: ProjectCommandScope }) {
  const { user, isImpersonating } = useAuth();
  const { projects = [], loading: projectsLoading, error: projectsError, updateProject, deleteProject, deleteProjects, refresh: refreshProjects } = useProjects();
  const { employees = [], createEmployee } = useEmployees();
  const [appSettings] = useAppSettings();
  const { toast } = useToast();
  const [hoursTotals, setHoursTotals] = useState<Map<string, ProjectHoursTotals>>(new Map());
  const [memberHours, setMemberHours] = useState<Map<string, ProjectHoursTotals>>(new Map());
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursRowCount, setHoursRowCount] = useState(0);
  const [hoursComplete, setHoursComplete] = useState(false);
  const [paymentRows, setPaymentRows] = useState<BonusPaymentRow[]>([]);
  const [paymentRegistryLoading, setPaymentRegistryLoading] = useState(true);
  const [paymentRegistryError, setPaymentRegistryError] = useState<string | null>(null);
  const urlSyncReadyRef = useRef(false);
  const bonusMutationLocksRef = useRef<Set<string>>(new Set());
  const [search, setSearch] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q') || '');
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>(() => ({
    ...readInitialColumnFilters(),
    season: '',
    period: '',
  }));
  const [viewFilter, setViewFilter] = useState<ProjectViewFilter>(() => (
    typeof window === 'undefined'
      ? 'all'
      : normalizeProjectViewFilter(new URLSearchParams(window.location.search).get('view'))
  ));
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [partnerFilter, setPartnerFilter] = useState<PartnerFilter>('all');
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [businessSeasonFilter, setBusinessSeasonFilter] = useState<BusinessSeasonFilter>(() => (
    typeof window === 'undefined'
      ? 'all'
      : normalizeBusinessSeasonFilter(new URLSearchParams(window.location.search).get('season'))
  ));
  const [amountFromFilter, setAmountFromFilter] = useState(() => (
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('amountFrom') || ''
  ));
  const [amountToFilter, setAmountToFilter] = useState(() => (
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('amountTo') || ''
  ));
  const [contractFileFilter, setContractFileFilter] = useState<ContractFileFilter>(() => {
    if (typeof window === 'undefined') return 'all';
    const value = new URLSearchParams(window.location.search).get('contractFile');
    return value === 'uploaded' || value === 'missing' ? value : 'all';
  });
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState<ProjectDeadlineFilter>(() => (typeof window === 'undefined' ? 'all' : (new URLSearchParams(window.location.search).get('deadline') as ProjectDeadlineFilter)) || 'all');
  const [periodFilter, setPeriodFilter] = useState<ProjectPeriodFilter>('all');
  const [auditPeriodTypeFilter, setAuditPeriodTypeFilter] = useState<AuditPeriodTypeFilter>('all');
  const [sortBy, setSortBy] = useState<ProjectSort>(() => (typeof window === 'undefined' ? 'deadline_asc' : (new URLSearchParams(window.location.search).get('sort') as ProjectSort)) || 'deadline_asc');
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState<number>(25);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [openingFileKey, setOpeningFileKey] = useState<string | null>(null);
  const [contractorNameDrafts, setContractorNameDrafts] = useState<Record<string, string>>({});
  const [contractorAmountDrafts, setContractorAmountDrafts] = useState<Record<string, string>>({});
  const [gphEditorRowId, setGphEditorRowId] = useState<string | null>(null);
  const [gphAssignmentContext, setGphAssignmentContext] = useState<{
    rowId: string;
    roleKey: string;
    periodId?: string;
  } | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCompanyId, setBulkCompanyId] = useState('');
  const [bulkCompanyAssignOpen, setBulkCompanyAssignOpen] = useState(false);
  const [bulkAssigningCompany, setBulkAssigningCompany] = useState(false);
  const [bulkPartnerId, setBulkPartnerId] = useState('');
  const [bulkPartnerAssignOpen, setBulkPartnerAssignOpen] = useState(false);
  const [bulkAssigningPartner, setBulkAssigningPartner] = useState(false);
  const [bulkTeamTemplateId, setBulkTeamTemplateId] = useState('');
  const [bulkTeamAssignOpen, setBulkTeamAssignOpen] = useState(false);
  const [bulkAssigningTeam, setBulkAssigningTeam] = useState(false);
  const [projectTeamTemplateTarget, setProjectTeamTemplateTarget] = useState<{
    rowId: string;
    partnerId: string;
  } | null>(null);
  const [teamRoleDrafts, setTeamRoleDrafts] = useState<Record<string, string>>({});
  const [bulkLeaderId, setBulkLeaderId] = useState('');
  const [bulkLeaderAssignOpen, setBulkLeaderAssignOpen] = useState(false);
  const [bulkAssigningLeader, setBulkAssigningLeader] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [advancedRows, setAdvancedRows] = useState<Record<string, boolean>>({});
  const [wideProjectTable, setWideProjectTable] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1800px)').matches
  ));
  const [editingProjectDatesRowId, setEditingProjectDatesRowId] = useState<string | null>(null);
  const [projectDateDraft, setProjectDateDraft] = useState<ProjectDateDraft>({ startDate: '', deadline: '' });
  const [editingContractAmountRowId, setEditingContractAmountRowId] = useState<string | null>(null);
  const [contractAmountDraft, setContractAmountDraft] = useState('');
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodNameDraft, setPeriodNameDraft] = useState('');
  const [addingPeriodRowId, setAddingPeriodRowId] = useState<string | null>(null);
  const [newPeriodDraft, setNewPeriodDraft] = useState<PeriodDraft>({
    name: '',
    type: 'custom',
    startDate: '',
    endDate: '',
    deadline: '',
  });

  const effectiveScope: ProjectCommandScope =
    scope || (user?.role === 'ceo' || user?.role === 'admin' ? 'executive' : 'operations');
  const isExecutive = effectiveScope === 'executive';
  const capabilities = projectCommandCenterCapabilities(user?.role);
  const canEditProjectDetails = capabilities.canEditProjectDetails;
  const canSeeTeam = canRoleViewProjectSection(appSettings.projectAccess, user?.role, 'team');
  const canSeeHours = canRoleViewProjectSection(appSettings.projectAccess, user?.role, 'hours');
  const canSeeContractMoney = canRoleViewProjectSection(
    appSettings.projectAccess,
    user?.role,
    'contractMoney',
  );
  const canSeeBonusSummary = canRoleViewProjectSection(
    appSettings.projectAccess,
    user?.role,
    'bonuses',
  );
  const canEditBonusDraft = Boolean(
    user
      && canSeeBonusSummary
      && hasPermission(user.role, 'CHANGE_BONUS_MANUALLY')
      && !isImpersonating,
  );
  const canManageTeam = capabilities.canManageTeam && canSeeTeam;
  const canCloseProjects = capabilities.canCloseProjects;
  const canDeleteProjects = capabilities.canDeleteProjects;
  const canBulkAssignCompany = capabilities.canBulkAssignCompany;
  const canBulkAssignPartner = capabilities.canBulkAssignPartner;
  const canBulkAssignTeam = capabilities.canBulkAssignTeam;
  const canBulkAssignLeader = capabilities.canBulkAssignLeader;
  const canSelectProjects = canDeleteProjects || canBulkAssignCompany || canBulkAssignPartner || canBulkAssignTeam || canBulkAssignLeader;
  const canManageProjectStatus = capabilities.canManageProjectStatus;
  const canManageContractors = capabilities.canManageContractors && canSeeContractMoney;
  const statusOptions = projectStatusOptionsForRole(user?.role);
  const canEditPeriods = capabilities.canEditPeriods;
  const canEditContractAmount = capabilities.canSeeContractMoney;
  const isInitialProjectsLoad = projectsLoading && projects.length === 0;

  const openContractFile = async (
    file: any,
    label: string,
    key: string,
    mode: 'open' | 'download' = 'open',
  ) => {
    const rawUrl = contractFileUrl(file);
    const storagePath = String(file?.storagePath || file?.path || (rawUrl.startsWith('seafile://') ? rawUrl.replace(/^seafile:\/\//, '') : ''));
    const directUrl = rawUrl && !rawUrl.startsWith('seafile://') ? rawUrl : '';
    const isSeafileFile = Boolean(file?.isSeafile) || rawUrl.startsWith('seafile://');
    const actionKey = `${mode}:${key}`;
    const previewWindow = mode === 'open' ? window.open('about:blank', '_blank') : null;
    if (previewWindow) previewWindow.opener = null;
    setOpeningFileKey(actionKey);
    try {
      const url = isSeafileFile && storagePath
        ? await supabaseDataStore.getSeafileDownloadUrl(storagePath)
        : directUrl;
      const safeUrl = url || directUrl;
      if (!safeUrl || safeUrl.startsWith('seafile://')) {
        throw new Error(`Нет рабочей ссылки. В карточке сохранён только источник: ${storagePath || rawUrl || label}`);
      }
      const browserUrl = new URL(safeUrl, window.location.origin).href;
      if (mode === 'download') {
        const anchor = document.createElement('a');
        anchor.href = browserUrl;
        anchor.download = label;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else if (previewWindow) {
        previewWindow.location.href = browserUrl;
      } else {
        window.open(browserUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      previewWindow?.close();
      toast({
        title: 'Договор не привязан к рабочему хранилищу',
        description: error?.message || `Файл «${label}» есть в карточке, но безопасная ссылка не получена`,
        variant: 'destructive',
      });
    } finally {
      setOpeningFileKey(null);
    }
  };

  const cancelContractAmountEdit = () => {
    setEditingContractAmountRowId(null);
    setContractAmountDraft('');
  };

  const startContractAmountEdit = (row: (typeof rows)[number]) => {
    const currentAmount = Number(row.contract?.amountWithoutVAT || row.amount || 0);
    setEditingContractAmountRowId(row.id);
    setContractAmountDraft(currentAmount > 0 ? String(currentAmount) : '');
  };

  const saveContractAmount = async (row: (typeof rows)[number]) => {
    if (!canEditContractAmount || !updateProject) return;
    const amount = parseMoney(contractAmountDraft);
    if (amount <= 0) {
      toast({ title: 'Укажите сумму договора', description: 'Сумма должна быть больше 0.', variant: 'destructive' });
      return;
    }

    const sourceProject = row.project || row;
    const sourceProjectId = sourceProject.id || row.id;

    setSavingProjectId(`${row.id}:amount`);
    try {
      await updateProject(sourceProjectId, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const contract = {
          ...(currentNotes.contract || {}),
          ...(currentProject.contract || {}),
          amountWithoutVAT: amount,
        };
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject.finances || {}),
          amountWithoutVAT: amount,
        };
        const finances = calculateProjectFinances(projectForFinanceCalculation({
          ...currentProject,
          contract,
          finances: existingFinances,
        }));
        return {
          amountWithoutVAT: amount,
          contract,
          finances,
        };
      });
      toast({ title: 'Сумма договора обновлена', description: `${money.format(amount)} ₸ без НДС` });
      cancelContractAmountEdit();
    } catch (error: any) {
      toast({ title: 'Не удалось обновить сумму', description: error?.message || 'Попробуйте ещё раз', variant: 'destructive' });
    } finally {
      setSavingProjectId(null);
    }
  };

  const openGphAssignment = (rowId: string, roleKey: string, periodId?: string) => {
    setGphAssignmentContext({ rowId, roleKey, periodId });
    setGphEditorRowId(rowId);
  };

  const assignableEmployees = useMemo(
    () => [...(employees as any[])].sort((a, b) => employeeName(a).localeCompare(employeeName(b), 'ru')),
    [employees],
  );

  const partnerEmployees = useMemo(
    () => [...assignableEmployees].sort((left, right) => {
      const leftIsPartner = String(left?.role || '').toLowerCase() === 'partner';
      const rightIsPartner = String(right?.role || '').toLowerCase() === 'partner';
      if (leftIsPartner !== rightIsPartner) return leftIsPartner ? -1 : 1;
      return employeeName(left).localeCompare(employeeName(right), 'ru');
    }),
    [assignableEmployees],
  );
  const projectHoursScopeKey = useMemo(
    () => Array.from(new Set((projects as any[]).map((project) => String(project.id)).filter(Boolean))).sort().join('|'),
    [projects],
  );

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1800px)');
    const syncLayout = () => setWideProjectTable(media.matches);
    syncLayout();
    media.addEventListener('change', syncLayout);
    return () => media.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => {
    if (!urlSyncReadyRef.current) {
      urlSyncReadyRef.current = true;
      return;
    }
    syncCommandCenterUrl({ search, columnFilters, viewFilter, businessSeasonFilter, amountFromFilter, amountToFilter, contractFileFilter, deadlineFilter, periodFilter, auditPeriodTypeFilter, sortBy });
  }, [search, columnFilters, viewFilter, businessSeasonFilter, amountFromFilter, amountToFilter, contractFileFilter, deadlineFilter, periodFilter, auditPeriodTypeFilter, sortBy]);

  useEffect(() => {
    if (projectsLoading && projects.length === 0) return;
    if (projectsError) {
      setHoursTotals(new Map());
      setMemberHours(new Map());
      setHoursRowCount(0);
      setHoursComplete(false);
      setHoursLoading(false);
      setHoursError('Проекты не загрузились, поэтому часы нельзя сверить');
      return;
    }
    let active = true;
    const controller = new AbortController();
    const projectIds = projectHoursScopeKey ? projectHoursScopeKey.split('|') : [];
    setHoursLoading(true);
    setHoursError(null);
    loadTimesheetHoursSnapshot(projectIds, controller.signal)
      .then((snapshot) => {
        if (!active) return;
        const nextMemberHours = new Map<string, ProjectHoursTotals>();
        for (const [key, approved] of snapshot.approvedByEmployeeProject.entries()) {
          const current = nextMemberHours.get(key) || { approved: 0, pending: 0 };
          current.approved = approved;
          nextMemberHours.set(key, current);
        }
        for (const [key, pending] of snapshot.pendingByEmployeeProject.entries()) {
          const current = nextMemberHours.get(key) || { approved: 0, pending: 0 };
          current.pending = pending;
          nextMemberHours.set(key, current);
        }
        setHoursTotals(snapshot.byProject);
        setMemberHours(nextMemberHours);
        setHoursRowCount(snapshot.rowCount);
        setHoursComplete(snapshot.complete);
        setHoursError(snapshot.error);
      })
      .catch((error) => {
        console.error('[ProjectCommandCenter] failed to load hours totals', error);
        if (!active) return;
        setHoursComplete(false);
        setHoursError(error instanceof Error ? error.message : 'Не удалось загрузить таймшиты');
      })
      .finally(() => {
        if (active) setHoursLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [projectHoursScopeKey, projectsLoading, projectsError]);

  useEffect(() => {
    if (!canSeeBonusSummary) {
      setPaymentRows([]);
      setPaymentRegistryLoading(false);
      setPaymentRegistryError(null);
      return;
    }
    if (projectsLoading && projects.length === 0) return;
    if (projectsError) {
      setPaymentRows([]);
      setPaymentRegistryLoading(false);
      setPaymentRegistryError('Проекты не загрузились, поэтому реестр нельзя сопоставить');
      return;
    }
    let active = true;
    const controller = new AbortController();
    const projectIds = projectHoursScopeKey ? projectHoursScopeKey.split('|') : [];
    setPaymentRegistryLoading(true);
    setPaymentRegistryError(null);
    loadBonusPayments(projectIds, controller.signal)
      .then((rows) => {
        if (active) setPaymentRows(rows);
      })
      .catch((error) => {
        console.error('[ProjectCommandCenter] failed to load bonus payment registry', error);
        if (!active) return;
        setPaymentRows([]);
        setPaymentRegistryError(error instanceof Error ? error.message : 'Не удалось загрузить реестр выплат');
      })
      .finally(() => {
        if (active) setPaymentRegistryLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canSeeBonusSummary, projectHoursScopeKey, projectsLoading, projectsError]);

  const rows = useMemo(() => {
    const rawRows = projects.map((project: any) => {
      const status = projectStatus(project);
      const team = projectTeam(project);
      const amount = projectAmount(project);
      const hours = hoursTotals.get(project.id) || { approved: 0, pending: 0 };
      const contract = projectContract(project);
      const contractFiles = projectContractFiles(project);
      const hasContract = rowHasContractEvidence({ project, contract, contractFiles });
      const startDate = rawProjectStartDate(project);
      const deadline = rawProjectDeadline(project);
      const periods = keepExplicitPeriodTeams(projectPeriods(project), project.id);
      const realTeam = effectiveProjectTeam(project);
      const finances = financeFor(project, realTeam);
      const baseReadiness = projectReadiness({
        status,
        team: realTeam,
        amount,
        hasContract,
        hours,
        includeContractIssues: canSeeContractMoney,
        includeFinancialIssues: canSeeContractMoney,
      });
      const readiness = readinessWithHoursState(baseReadiness, status, { loading: hoursLoading, complete: hoursComplete && !hoursError, error: hoursError });
      const partnerNames = coveragePartnerNames(realTeam);
      const deadlineState = deadlineInfo(deadline, status);

      return {
        project,
        id: project.id,
        name: project.name || project.title || 'Проект без названия',
        company: projectCompany(project),
        client: projectClient(project),
        type: projectType(project),
        status,
        team,
        amount,
        finances,
        hours,
        baseReadiness,
        readiness,
        startDate,
        deadline,
        deadlineState,
        periods,
        coverageTeam: realTeam,
        partnerNames,
        teamColumns: teamByRole(team),
        teamColumnMembers: teamMembersByRole(realTeam),
        hasContract,
        hasContractFile: contractFiles.length > 0,
        contract,
        contractFiles,
        projectIds: [project.id],
        duplicateRows: [],
      };
    });

    if (SHOW_LEGACY_GROUPED_PROJECT_ROWS) {
      const groups = new Map<string, any[]>();
      for (const row of rawRows) {
        const key = projectGroupKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(row);
      }

      return Array.from(groups.values()).map((groupRows) => {
      if (groupRows.length === 1) return groupRows[0];

      const primary = choosePrimaryProjectRow(groupRows);
      const team = uniqueTeamMembers(groupRows);
      const periods = mergePeriods(groupRows);
      const realTeam = uniqueCoverageTeamMembers(groupRows);
      const amount = Math.max(...groupRows.map((row) => row.amount || 0));
      const hours = groupRows.reduce(
        (acc, row) => ({
          approved: acc.approved + Number(row.hours?.approved || 0),
          pending: acc.pending + Number(row.hours?.pending || 0),
        }),
        { approved: 0, pending: 0 },
      );
      const status = groupRows.every((row) => row.readiness.level === 'closed') ? 'completed' : primary.status;
      const deadlineRows = status === 'completed' ? groupRows : groupRows.filter((row) => row.readiness.level !== 'closed');
      const deadlineSource = [...(deadlineRows.length > 0 ? deadlineRows : groupRows)].sort(
        (a, b) => dateStamp(a.deadline) - dateStamp(b.deadline),
      )[0] || primary;
      const deadline = deadlineSource.deadline;
      const startDate = [...groupRows].sort((a, b) => dateStamp(a.startDate) - dateStamp(b.startDate))[0]?.startDate || primary.startDate;
      const finances = {
        ...primary.finances,
        amountWithoutVAT: amount,
      };
      const hasContract = groupRows.some(rowHasContractEvidence);
      const baseReadiness = projectReadiness({
        status,
        team: realTeam,
        amount,
        hasContract,
        hours,
        includeContractIssues: canSeeContractMoney,
        includeFinancialIssues: canSeeContractMoney,
      });
      const readiness = readinessWithHoursState(baseReadiness, status, { loading: hoursLoading, complete: hoursComplete && !hoursError, error: hoursError });
      const partnerNames = coveragePartnerNames(realTeam);
      const company = groupRows.find((row) => row.company && row.company !== 'Не указана')?.company || primary.company;
      const contractRow = groupRows.find(hasContractEvidence) || primary;
      const contractFiles = dedupeProjectFiles(groupRows.flatMap((row) => row.contractFiles || []));

      return {
        ...primary,
        status,
        company,
        team,
        amount,
        finances,
        hours,
        baseReadiness,
        readiness,
        hasContract,
        hasContractFile: groupRows.some((row) => row.hasContractFile),
        startDate,
        deadline,
        deadlineState: deadlineInfo(deadline, status),
        periods,
        coverageTeam: realTeam,
        partnerNames,
        teamColumns: teamByRole(team),
        teamColumnMembers: teamMembersByRole(realTeam),
        contract: contractRow.contract,
        contractFiles,
        projectIds: groupRows.flatMap((row) => row.projectIds || [row.id]),
        duplicateRows: groupRows,
      };
      });
    }

    return rawRows;
  }, [projects, hoursTotals, canSeeContractMoney, hoursLoading, hoursComplete, hoursError]);

  const gphEditorRow = gphEditorRowId ? rows.find((row) => row.id === gphEditorRowId) : undefined;

  const teamTemplateCandidates = useMemo<TeamTemplateCandidate[]>(() => rows.flatMap((row) => {
    const sourceTeam = row.coverageTeam || row.team || [];
    if (!sourceTeam.length) return [];
    const partner = sourceTeam.find((member: any) => isPartnerRole(teamRole(member)));
    const partnerId = partner ? teamMemberId(partner) : '';
    return [{
      partnerId,
      ownerName: partner ? teamName(partner) : row.name,
      sourceProjectId: row.id,
      signature: teamTemplateSignature(sourceTeam),
      team: sourceTeam.map((member: CanonicalTeamMember) => ({ ...member })),
    }];
  }), [rows]);

  const teamTemplates = useMemo<TeamTemplateDefinition[]>(() => {
    const partnerIds = Array.from(new Set(
      teamTemplateCandidates.map((candidate) => candidate.partnerId).filter(Boolean),
    ));
    const partnerTemplates = partnerIds
      .map((partnerId) => selectPartnerTeamTemplate(teamTemplateCandidates, partnerId))
      .filter((template): template is TeamTemplateDefinition => Boolean(template));
    const projectTemplates = teamTemplateCandidates
      .filter((candidate) => !candidate.partnerId)
      .map((candidate) => ({
        id: `project:${candidate.sourceProjectId}`,
        label: `Команда проекта: ${candidate.ownerName} · ${candidate.team.length} чел.`,
        sourceProjectId: candidate.sourceProjectId,
        occurrenceCount: 1,
        team: candidate.team.map((member) => ({ ...member })),
      }));
    return [...partnerTemplates, ...projectTemplates]
      .sort((left, right) => left.label.localeCompare(right.label, 'ru'));
  }, [teamTemplateCandidates]);

  const partnerTeamTemplateDefinition = (partnerId: string, excludedSourceProjectId?: string) => (
    selectPartnerTeamTemplate(teamTemplateCandidates, partnerId, excludedSourceProjectId)
  );

  const partnerTeamTemplate = (partnerId: string, excludedSourceProjectId?: string): CanonicalTeamMember[] | null => {
    const template = partnerTeamTemplateDefinition(partnerId, excludedSourceProjectId);
    return template ? template.team.map((member) => ({ ...member })) : null;
  };

  const projectTeamTemplateTargetRow = projectTeamTemplateTarget
    ? rows.find((row) => row.id === projectTeamTemplateTarget.rowId)
    : undefined;
  const projectTeamTemplateTargetDefinition = projectTeamTemplateTarget
    ? partnerTeamTemplateDefinition(projectTeamTemplateTarget.partnerId, projectTeamTemplateTarget.rowId)
    : undefined;

  const portfolioProjectIds = useMemo(
    () => new Set<string>(rows.flatMap((row) => row.projectIds?.length ? row.projectIds : [row.id]).filter(Boolean)),
    [rows],
  );
  const paymentRegistrySummary = useMemo(
    () => summarizeBonusPaymentRegistry(paymentRows, portfolioProjectIds),
    [paymentRows, portfolioProjectIds],
  );

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.amount += row.amount;
        acc.grossProfit += Number(row.finances.grossProfit) || 0;
        acc.plannedBonusPool += plannedBonusPool(row);
        acc.allocatedBonuses += allocatedDraftBonuses(row);
        acc.approvedHours += row.hours.approved;
        acc.pendingHours += row.hours.pending;
        if (row.baseReadiness.level === 'attention') acc.attention += 1;
        if (row.baseReadiness.level === 'closed') acc.closed += 1;
        if (row.deadlineState.tone === 'overdue') acc.overdue += 1;
        if (row.deadlineState.tone === 'soon') acc.soon += 1;
        if (row.baseReadiness.level !== 'closed' && !row.deadline) acc.noDeadline += 1;
        return acc;
      },
      {
        total: 0,
        attention: 0,
        closed: 0,
        overdue: 0,
        soon: 0,
        noDeadline: 0,
        amount: 0,
        grossProfit: 0,
        plannedBonusPool: 0,
        allocatedBonuses: 0,
        approvedHours: 0,
        pendingHours: 0,
      },
    );
  }, [rows]);

  const executiveSummary = useMemo<ExecutivePortfolioSummary>(() => {
    const portfolioBreakdown = rows.reduce(
      (acc, row) => {
        const closed = row.baseReadiness.level === 'closed';
        if (closed) {
          acc.closed += 1;
          return acc;
        }

        if (row.deadlineState.tone === 'overdue') acc.overdue += 1;
        else if (row.deadlineState.tone === 'soon') acc.soon += 1;
        else if (row.deadlineState.tone === 'normal') acc.later += 1;
        else acc.noDeadline += 1;

        if (row.status === 'pending_payment_approval') acc.readyBonus += 1;
        else if (row.baseReadiness.level === 'attention') acc.attention += 1;
        else acc.inWork += 1;
        return acc;
      },
      { inWork: 0, attention: 0, readyBonus: 0, closed: 0, overdue: 0, soon: 0, later: 0, noDeadline: 0 },
    );
    const readyForBonuses = portfolioBreakdown.readyBonus;
    const hoursVerified = hoursComplete && !hoursLoading && !hoursError;
    const bonusReviewProjects = rows.filter((row) => rowNeedsBonusReview(row, hoursVerified)).length;
    return {
      totalProjects: summary.total,
      activeProjects: summary.total - summary.closed,
      closedProjects: summary.closed,
      attentionProjects: summary.attention,
      portfolioInWorkProjects: portfolioBreakdown.inWork,
      portfolioAttentionProjects: portfolioBreakdown.attention,
      overdueProjects: portfolioBreakdown.overdue,
      dueNext30Projects: portfolioBreakdown.soon,
      laterThan30Projects: portfolioBreakdown.later,
      noDeadlineProjects: portfolioBreakdown.noDeadline,
      readyForBonuses,
      bonusReviewProjects,
      bonusConfiguredProjects: Math.max(0, readyForBonuses - bonusReviewProjects),
      contractAmount: summary.amount,
      grossProfit: summary.grossProfit,
      profitMargin: summary.amount > 0 ? (summary.grossProfit / summary.amount) * 100 : 0,
      plannedBonusPool: summary.plannedBonusPool,
      allocatedBonuses: summary.allocatedBonuses,
      unallocatedBonuses: rows.reduce(
        (total, row) => total + Math.max(0, plannedBonusPool(row) - allocatedDraftBonuses(row)),
        0,
      ),
      overallocatedBonuses: rows.reduce(
        (total, row) => total + Math.max(0, allocatedDraftBonuses(row) - plannedBonusPool(row)),
        0,
      ),
      approvedForPayment: paymentRegistrySummary.approvedUnpaidAmount,
      paidFromRegistry: paymentRegistrySummary.paidAmount,
      pendingRegistryAmount: paymentRegistrySummary.pendingAmount,
      pendingHours: summary.pendingHours,
      approvedHours: summary.approvedHours,
      registryRows: paymentRegistrySummary.totalRows,
      registryUnmatchedRows: paymentRegistrySummary.unmatchedRows,
      registryOutOfScopeRows: paymentRegistrySummary.outOfScopeRows,
      hoursRowCount,
      hoursComplete: hoursComplete && !hoursLoading && !hoursError,
      hoursLoading,
      hoursError: Boolean(hoursError),
      groupedFinancialRows: rows.filter((row) => (row.projectIds || [row.id]).length > 1).length,
    };
  }, [rows, summary, paymentRegistrySummary, hoursRowCount, hoursComplete, hoursLoading, hoursError]);

  const partnerOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();

    for (const row of rows) {
      for (const name of row.partnerNames || []) {
        const key = partnerFilterKey(name);
        if (!key) continue;
        const current = map.get(key) || { key, name, count: 0 };
        current.count += 1;
        map.set(key, current);
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [rows]);

  const companyOptions = useMemo(() => {
    return ((appSettings.companies || []) as CompanyOption[])
      .filter((company) => company?.id && company?.name && company.isActive !== false)
      .map((company) => ({
        key: company.id,
        name: company.name,
        count: rows.filter((row) => rowMatchesCompanyOption(row, company)).length,
        company,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [rows, appSettings.companies]);

  const businessSeasonOptions = useMemo(() => {
    const counts = countProjectBusinessSeasons(rows, (row) => projectBusinessSeasonDates(row.project));
    const datedOptions = [...counts.entries()]
      .filter(([value]) => value !== BUSINESS_SEASON_NO_DATE)
      .map(([value, count]) => ({
        value,
        year: Number(value.slice('season:'.length)),
        count,
      }))
      .sort((left, right) => right.year - left.year)
      .map(({ value, year, count }) => ({
        value,
        label: businessSeasonLabel(year),
        count,
      }));
    const withoutDateCount = counts.get(BUSINESS_SEASON_NO_DATE) || 0;
    return withoutDateCount > 0
      ? [...datedOptions, { value: BUSINESS_SEASON_NO_DATE, label: 'Без даты', count: withoutDateCount }]
      : datedOptions;
  }, [rows]);

  const selectedPartnerLabel = useMemo(() => {
    if (partnerFilter === 'all') return '';
    if (partnerFilter === 'unassigned') return 'Без партнера';
    return partnerOptions.find((item) => item.key === partnerFilter)?.name || '';
  }, [partnerFilter, partnerOptions]);

  const selectedCompanyLabel = useMemo(() => {
    if (companyFilter === 'all') return '';
    if (companyFilter === 'missing') return 'Наша компания не указана';
    return companyOptions.find((item) => item.key === companyFilter)?.name || '';
  }, [companyFilter, companyOptions]);

  const selectedBusinessSeasonLabel = useMemo(() => {
    if (businessSeasonFilter === 'all') return '';
    const option = businessSeasonOptions.find((item) => item.value === businessSeasonFilter);
    if (option) return option.label;
    if (businessSeasonFilter === BUSINESS_SEASON_NO_DATE) return 'Без даты';
    const match = businessSeasonFilter.match(/^season:(20\d{2})$/);
    return match ? businessSeasonLabel(Number(match[1])) : '';
  }, [businessSeasonFilter, businessSeasonOptions]);

  useEffect(() => {
    if (!canSeeTeam) {
      if (partnerFilter !== 'all') setPartnerFilter('all');
      setColumnFilters((current) => (
        current.partner || current.leader
          ? { ...current, partner: '', leader: '' }
          : current
      ));
    }
    if (!canSeeHours) {
      if (sortBy === 'hours_desc') setSortBy('deadline_asc');
      setColumnFilters((current) => (current.hours ? { ...current, hours: '' } : current));
    }
    if (!canSeeContractMoney) {
      if (sortBy === 'amount_desc') setSortBy('deadline_asc');
      setColumnFilters((current) => (current.money ? { ...current, money: '' } : current));
    }
    if (!canSeeBonusSummary) {
      setColumnFilters((current) => (current.bonus ? { ...current, bonus: '' } : current));
    }
  }, [canSeeTeam, canSeeHours, canSeeContractMoney, canSeeBonusSummary, partnerFilter, sortBy]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const exactRange = makeDateRange(dateFromFilter, dateToFilter);
    const filtered = rows.filter((row) => {
      const coverageTeamText = canSeeTeam
        ? (row.coverageTeam || row.team || []).map(teamName).join(' ')
        : '';
      const teamColumnsText = canSeeTeam ? Object.values(row.teamColumns).join(' ') : '';
      const haystack = `${row.company} ${row.name} ${row.client} ${row.type} ${row.startDate} ${row.deadline} ${teamColumnsText} ${coverageTeamText}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (companyFilter === 'missing') {
        if (!rowHasMissingCompany(row)) return false;
      } else if (companyFilter !== 'all') {
        const company = companyOptions.find((option) => option.key === companyFilter)?.company;
        if (!company || !rowMatchesCompanyOption(row, company)) return false;
      }
      if (canSeeTeam && partnerFilter === 'unassigned' && row.partnerNames.length > 0) return false;
      if (
        canSeeTeam &&
        partnerFilter !== 'all' &&
        partnerFilter !== 'unassigned' &&
        !row.partnerNames.some((name: string) => partnerFilterKey(name) === partnerFilter)
      ) {
        return false;
      }
      if (!rowMatchesDateFilter(row, yearFilter)) return false;
      if (!rowMatchesBusinessSeason(row, businessSeasonFilter)) return false;
      if (!rowMatchesAmountRange(row, amountFromFilter, amountToFilter)) return false;
      if (contractFileFilter === 'uploaded' && !row.hasContractFile) return false;
      if (contractFileFilter === 'missing' && row.hasContractFile) return false;
      if (exactRange && !rowDateRanges(row).some((range) => rangesIntersect(range, exactRange))) return false;
      if (viewFilter !== 'all' && projectOperationalState(row) !== viewFilter) return false;
      if (deadlineFilter === 'overdue' && row.deadlineState.tone !== 'overdue') return false;
      if (deadlineFilter === 'next_30' && row.deadlineState.tone !== 'soon') return false;
      if (deadlineFilter === 'no_deadline' && row.deadlineState.tone !== 'none') return false;
      if (periodFilter === 'has_periods' && row.periods.length === 0) return false;
      if (periodFilter === 'no_periods' && row.periods.length > 0) return false;
      if (!rowMatchesAuditPeriodType(row, auditPeriodTypeFilter)) return false;
      if (!rowMatchesColumnFilters(row, columnFilters, canSeeContractMoney, canSeeBonusSummary, canSeeTeam, canSeeHours)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'deadline_asc') return dateStamp(a.deadline) - dateStamp(b.deadline);
      if (sortBy === 'deadline_desc') return dateStamp(b.deadline) - dateStamp(a.deadline);
      if (canSeeContractMoney && sortBy === 'amount_desc') return b.amount - a.amount;
      if (canSeeHours && sortBy === 'hours_desc') return b.hours.approved + b.hours.pending - (a.hours.approved + a.hours.pending);
      return 0;
    });
  }, [rows, search, companyFilter, companyOptions, partnerFilter, yearFilter, businessSeasonFilter, amountFromFilter, amountToFilter, contractFileFilter, dateFromFilter, dateToFilter, viewFilter, deadlineFilter, periodFilter, auditPeriodTypeFilter, sortBy, columnFilters, canSeeContractMoney, canSeeBonusSummary, canSeeTeam, canSeeHours]);

  const tablePageCount = Math.max(1, Math.ceil(filteredRows.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, tablePageCount);
  const tablePageStart = (safeTablePage - 1) * tablePageSize;
  const tablePageEnd = Math.min(tablePageStart + tablePageSize, filteredRows.length);
  const visibleRows = useMemo(
    () => filteredRows.slice(tablePageStart, tablePageEnd),
    [filteredRows, tablePageStart, tablePageEnd],
  );

  useEffect(() => {
    setTablePage(1);
  }, [search, companyFilter, partnerFilter, yearFilter, businessSeasonFilter, amountFromFilter, amountToFilter, contractFileFilter, dateFromFilter, dateToFilter, viewFilter, deadlineFilter, periodFilter, auditPeriodTypeFilter, sortBy, columnFilters]);

  useEffect(() => {
    setTablePage((current) => Math.min(current, tablePageCount));
  }, [tablePageCount]);

  const canSeeGrossIncome = canSeeContractMoney && canSeeBonusSummary;
  const tableColSpan = 4
    + (canSeeTeam ? 1 : 0)
    + (canSeeHours ? 1 : 0)
    + (canSeeContractMoney ? 1 : 0)
    + (canSeeBonusSummary ? 1 : 0)
    + (canSeeGrossIncome ? 1 : 0);
  const setColumnFilter = (key: ColumnFilterKey, value: string) => {
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };
  const clearColumnFilter = (key: ColumnFilterKey) => setColumnFilter(key, '');
  const activeColumnFilters = hasActiveColumnFilters(columnFilters);
  const primaryFiltersActive = Boolean(
    search.trim()
      || companyFilter !== 'all'
      || (canSeeTeam && partnerFilter !== 'all')
      || yearFilter !== 'all'
      || businessSeasonFilter !== 'all'
      || amountFromFilter
      || amountToFilter
      || contractFileFilter !== 'all'
      || dateFromFilter
      || dateToFilter
      || viewFilter !== 'all'
      || deadlineFilter !== 'all'
      || periodFilter !== 'all'
      || auditPeriodTypeFilter !== 'all'
      || sortBy !== 'deadline_asc'
      || activeColumnFilters,
  );
  const clearAllProjectFilters = () => {
    setSearch('');
    setCompanyFilter('all');
    setPartnerFilter('all');
    setYearFilter('all');
    setBusinessSeasonFilter('all');
    setAmountFromFilter('');
    setAmountToFilter('');
    setContractFileFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setViewFilter('all');
    setDeadlineFilter('all');
    setPeriodFilter('all');
    setAuditPeriodTypeFilter('all');
    setSortBy('deadline_asc');
    setColumnFilters(EMPTY_COLUMN_FILTERS);
    setTablePage(1);
  };

  const toggleRow = (projectId: string) => {
    const opening = !expandedRows[projectId];
    setExpandedRows(opening ? { [projectId]: true } : {});
    if (!opening) setAdvancedRows((prev) => ({ ...prev, [projectId]: false }));
  };
  const toggleAdvancedRow = (projectId: string) => {
    setAdvancedRows((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };
  const openBonusWorkspace = (projectId: string) => {
    setExpandedRows((prev) => ({ ...prev, [projectId]: true }));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`project-details-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const projectIdsForRow = (row: (typeof rows)[number]): string[] => {
    return Array.from(new Set((row.projectIds?.length ? row.projectIds : [row.id]).filter(Boolean)));
  };

  const filteredProjectIds = Array.from(new Set(filteredRows.flatMap(projectIdsForRow)));
  const filteredDisplayRowCount = filteredRows.length;
  const totalDisplayRowCount = rows.length;
  const filteredDatabaseRecordCount = filteredProjectIds.length;
  const totalDatabaseRecordCount = projects.length;
  const allFilteredProjectsSelected = filteredProjectIds.length > 0
    && filteredProjectIds.every((projectId) => selectedProjectIds.has(projectId));

  const toggleProjectRowSelection = (row: (typeof rows)[number]) => {
    const ids = projectIdsForRow(row);
    const rowSelected = ids.every((id) => selectedProjectIds.has(id));
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => rowSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleAllFilteredProjects = () => {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      filteredProjectIds.forEach((id) => allFilteredProjectsSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const exportFilteredRows = async () => {
    if (filteredRows.length === 0) {
      toast({
        title: 'Нечего выгружать',
        description: 'По текущим фильтрам нет проектов.',
      });
      return;
    }

    try {
      const XLSX = await loadXlsx();
      if (canSeeBonusSummary && canSeeContractMoney) {
        if (paymentRegistryLoading) {
          toast({
            title: 'Реестр выплат ещё загружается',
            description: 'Дождитесь окончания сверки, чтобы Excel не содержал неполные суммы выплат.',
          });
          return;
        }
        if (paymentRegistryError) {
          toast({
            title: 'Excel не выгружен',
            description: 'Платёжный реестр недоступен. Обновите страницу и повторите выгрузку после успешной сверки.',
            variant: 'destructive',
          });
          return;
        }
        const workbook = buildLegacyCeoWorkbook(XLSX, filteredRows, paymentRegistrySummary.byProject);
        XLSX.writeFile(workbook, `ceo_legacy_partner_workbook_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast({
          title: 'CEO Excel готов',
          description: `Скачано листов: ИТОГО + партнёры. Проектов: ${filteredRows.length}`,
        });
        return;
      }

      const exportRows = buildProjectExportRows(filteredRows, {
        canSeeContractMoney,
        canSeeBonuses: canSeeBonusSummary,
        canSeeTeam,
        canSeeHours,
      });
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      autosizeExportSheet(worksheet, exportRows);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Подробно');
      XLSX.writeFile(workbook, `svod_filtered_detailed_${new Date().toISOString().slice(0, 10)}.xlsx`);

      toast({
        title: 'Выгрузка готова',
        description: `Скачано строк: ${filteredRows.length}`,
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось скачать ведомость',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    }
  };

  const closeProjectRow = async (row: (typeof rows)[number]) => {
    if (!canCloseProjects || !updateProject) return;
    if (hoursLoading || hoursError || !hoursComplete) {
      toast({ title: 'Закрытие заблокировано', description: 'Сначала дождитесь полной сверки таймшитов.', variant: 'destructive' });
      return;
    }
    if (row.hours.pending > 0) {
      toast({ title: 'Закрытие заблокировано', description: `${row.hours.pending.toFixed(1)} ч ещё ждут утверждения.`, variant: 'destructive' });
      return;
    }
    const ids = projectIdsForRow(row);
    if (ids.length === 0) return;

    const countText = ids.length > 1 ? `${ids.length} записей этого проекта` : 'этот проект';
    if (!window.confirm(`Закрыть ${countText}? Проект попадет в закрытые, прогресс станет 100%.`)) return;

    const now = new Date().toISOString();
    setSavingProjectId(`${row.id}:close`);
    try {
      await Promise.all(ids.map((projectId) => updateProject(projectId, {
        status: 'completed',
        completionPercent: 100,
        completion: 100,
        completedAt: now,
        approvedBy: user?.id || 'admin',
        approvedByName: user?.name || user?.email || 'Админ',
      })));

      toast({
        title: 'Проект закрыт',
        description: ids.length > 1 ? `Закрыто записей: ${ids.length}` : row.name,
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось закрыть проект',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const deleteProjectRow = async (row: (typeof rows)[number]) => {
    if (!canDeleteProjects || !deleteProject) return;
    const ids = projectIdsForRow(row);
    if (ids.length === 0) return;

    const countText = ids.length > 1 ? `${ids.length} записей этого проекта` : 'этот проект';
    if (!window.confirm(`Удалить ${countText}? Действие нельзя отменить.`)) return;

    setSavingProjectId(`${row.id}:delete`);
    try {
      await Promise.all(ids.map((projectId) => deleteProject(projectId)));
      toast({
        title: 'Проект удален',
        description: ids.length > 1 ? `Удалено записей: ${ids.length}` : row.name,
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось удалить проект',
        description: error?.message || 'Проверьте права удаления в базе',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const deleteSelectedProjects = async () => {
    if (!canDeleteProjects || bulkDeleting || selectedProjectIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const result = await deleteProjects(selectedProjectIds);
      setSelectedProjectIds(new Set(result.failedIds));
      setBulkDeleteOpen(false);
      toast({
        title: result.failedIds.length > 0 ? 'Удаление завершено частично' : 'Проекты удалены',
        description: `Удалено записей: ${result.deletedIds.length}.${result.failedIds.length > 0 ? ` Не удалено: ${result.failedIds.length}.` : ''}`,
        variant: result.failedIds.length > 0 ? 'destructive' : 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось удалить проекты',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const assignCompanyToSelectedProjects = async () => {
    if (!canBulkAssignCompany || !updateProject || bulkAssigningCompany || selectedProjectIds.size === 0) return;
    const company = companyOptions.find((option) => option.key === bulkCompanyId)?.company;
    if (!company) {
      toast({
        title: 'Выберите компанию',
        description: 'Выберите компанию, которую нужно назначить отмеченным проектам.',
        variant: 'destructive',
      });
      return;
    }

    setBulkAssigningCompany(true);
    const ids = Array.from(selectedProjectIds);
    const failedIds: string[] = [];
    const patch = {
      companyId: company.id,
      companyName: company.name,
      company: company.name,
      ourCompany: company.name,
    };

    try {
      for (let index = 0; index < ids.length; index += 20) {
        const batch = ids.slice(index, index + 20);
        const results = await Promise.allSettled(batch.map((projectId) => updateProject(projectId, patch)));
        results.forEach((result, resultIndex) => {
          if (result.status === 'rejected') failedIds.push(batch[resultIndex]);
        });
      }
      setSelectedProjectIds(new Set(failedIds));
      setBulkCompanyAssignOpen(false);
      toast({
        title: failedIds.length > 0 ? 'Назначение завершено частично' : 'Компания назначена',
        description: `Компания «${company.name}» назначена для ${ids.length - failedIds.length} проектов.${failedIds.length > 0 ? ` Не сохранено: ${failedIds.length}.` : ''}`,
        variant: failedIds.length > 0 ? 'destructive' : 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось назначить компанию',
        description: error?.message || 'Попробуйте ещё раз.',
        variant: 'destructive',
      });
    } finally {
      setBulkAssigningCompany(false);
    }
  };

  const assignCompanyToProject = async (row: (typeof rows)[number], companyId: string) => {
    if (!canBulkAssignCompany || !updateProject) return;
    const company = companyOptions.find((option) => option.key === companyId)?.company;
    if (!company) return;
    setSavingProjectId(`${row.id}:company`);
    try {
      await updateProject(row.id, {
        companyId: company.id,
        companyName: company.name,
        company: company.name,
        ourCompany: company.name,
      });
      toast({
        title: 'Компания назначена',
        description: `${row.name}: ${company.name}. Команда, договор, часы и бонусы сохранены.`,
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось назначить компанию',
        description: error?.message || 'Попробуйте ещё раз.',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const canonicalTeamUpdatePatch = (currentProject: any, nextTeam: CanonicalTeamMember[]) => {
    const currentNotes = readProjectNotes(currentProject);
    const marker = canonicalTeamMarkerPatch(currentProject, nextTeam);
    const canonicalTeam = Array.isArray(marker.team)
      ? marker.team
      : dedupeCanonicalTeamMembers([nextTeam]);
    const existingFinances = {
      ...(currentNotes.finances || {}),
      ...(currentProject?.finances || {}),
    };
    const markedProject = {
      ...currentProject,
      team: canonicalTeam,
      notes: {
        ...currentNotes,
        ...marker,
        finances: existingFinances,
      },
      finances: existingFinances,
    };
    const calculationProject = projectForFinanceCalculation(markedProject);
    const finances = calculateProjectFinances({
      ...calculationProject,
      finances: {
        ...existingFinances,
        amountWithoutVAT: projectAmount(currentProject),
      },
    });
    return { ...marker, finances };
  };

  const assignPartnerToSelectedProjects = async () => {
    if (!canBulkAssignPartner || !updateProject || bulkAssigningPartner || selectedProjectIds.size === 0) return;
    const partner = partnerEmployees.find((employee) => employee.id === bulkPartnerId);
    if (!partner) {
      toast({ title: 'Выберите партнёра', variant: 'destructive' });
      return;
    }

    setBulkAssigningPartner(true);
    const ids = Array.from(selectedProjectIds);
    const failedIds: string[] = [];
    try {
      for (let index = 0; index < ids.length; index += 20) {
        const batch = ids.slice(index, index + 20);
        const results = await Promise.allSettled(batch.map((projectId) => updateProject(projectId, (currentProject: any) => {
          const nextTeam = effectiveProjectTeam(currentProject)
            .filter((member: any) => teamRole(member) !== 'partner')
            .map((member: CanonicalTeamMember) => ({ ...member }));
          nextTeam.unshift({
            userId: partner.id,
            userName: employeeName(partner),
            userEmail: partner.email,
            name: employeeName(partner),
            role: 'partner',
            bonusPercent: roleDefaultPercent('partner'),
            assignedAt: new Date().toISOString(),
            assignedBy: user?.id || 'bulk-partner',
          });
          return canonicalTeamUpdatePatch(currentProject, nextTeam);
        })));
        results.forEach((result, resultIndex) => {
          if (result.status === 'rejected') failedIds.push(batch[resultIndex]);
        });
      }
      setSelectedProjectIds(new Set(failedIds));
      setBulkPartnerAssignOpen(false);
      toast({
        title: failedIds.length > 0 ? 'Партнёр назначен частично' : 'Партнёр назначен',
        description: `${employeeName(partner)}: ${ids.length - failedIds.length} проектов. Полный исторический состав сохранён в единой команде проекта.`,
        variant: failedIds.length > 0 ? 'destructive' : 'default',
      });
    } catch (error: any) {
      toast({ title: 'Не удалось назначить партнёра', description: error?.message || 'Повторите попытку', variant: 'destructive' });
    } finally {
      setBulkAssigningPartner(false);
    }
  };

  const assignTeamToSelectedProjects = async () => {
    if (!canBulkAssignTeam || !updateProject || bulkAssigningTeam || selectedProjectIds.size === 0) return;
    const template = teamTemplates.find((item) => item.id === bulkTeamTemplateId);
    if (!template) {
      toast({ title: 'Выберите шаблон команды', variant: 'destructive' });
      return;
    }

    setBulkAssigningTeam(true);
    const ids = Array.from(selectedProjectIds);
    const failedIds: string[] = [];
    try {
      for (let index = 0; index < ids.length; index += 20) {
        const batch = ids.slice(index, index + 20);
        const results = await Promise.allSettled(batch.map((projectId) => updateProject(projectId, (currentProject: any) => {
          const team = template.team.map((member) => ({ ...member }));
          return canonicalTeamUpdatePatch(currentProject, team);
        })));
        results.forEach((result, resultIndex) => {
          if (result.status === 'rejected') failedIds.push(batch[resultIndex]);
        });
      }
      setSelectedProjectIds(new Set(failedIds));
      setBulkTeamAssignOpen(false);
      toast({
        title: failedIds.length > 0 ? 'Команда назначена частично' : 'Команда назначена',
        description: `${template.label}: ${ids.length - failedIds.length} проектов. Команда сохранена единым составом проекта.`,
        variant: failedIds.length > 0 ? 'destructive' : 'default',
      });
    } catch (error: any) {
      toast({ title: 'Не удалось назначить команду', description: error?.message || 'Повторите попытку', variant: 'destructive' });
    } finally {
      setBulkAssigningTeam(false);
    }
  };

  const assignLeaderToSelectedProjects = async () => {
    if (!canBulkAssignLeader || !updateProject || bulkAssigningLeader || selectedProjectIds.size === 0) return;
    const employee = assignableEmployees.find((item) => item.id === bulkLeaderId);
    if (!employee) {
      toast({ title: 'Выберите руководителя', variant: 'destructive' });
      return;
    }

    setBulkAssigningLeader(true);
    const ids = Array.from(selectedProjectIds);
    const failedIds: string[] = [];
    try {
      for (let index = 0; index < ids.length; index += 20) {
        const batch = ids.slice(index, index + 20);
        const results = await Promise.allSettled(batch.map((projectId) => updateProject(projectId, (currentProject: any) => {
          const team = effectiveProjectTeam(currentProject)
            .filter((member: any) => !isLeaderRole(teamRole(member)))
            .map((member: CanonicalTeamMember) => ({ ...member }));
          team.push({
            userId: employee.id,
            userName: employeeName(employee),
            name: employeeName(employee),
            userEmail: employee.email,
            role: 'project_leader',
            bonusPercent: roleDefaultPercent('project_leader'),
            assignedAt: new Date().toISOString(),
            assignedBy: user?.id || 'bulk-leader',
          });
          return canonicalTeamUpdatePatch(currentProject, team);
        })));
        results.forEach((result, resultIndex) => {
          if (result.status === 'rejected') failedIds.push(batch[resultIndex]);
        });
      }
      setSelectedProjectIds(new Set(failedIds));
      setBulkLeaderAssignOpen(false);
      toast({
        title: failedIds.length > 0 ? 'Руководитель назначен частично' : 'Руководитель назначен',
        description: `${employeeName(employee)}: ${ids.length - failedIds.length} проектов.`,
        variant: failedIds.length > 0 ? 'destructive' : 'default',
      });
    } catch (error: any) {
      toast({ title: 'Не удалось назначить руководителя', description: error?.message || 'Повторите попытку', variant: 'destructive' });
    } finally {
      setBulkAssigningLeader(false);
    }
  };

  const calculateFinancesFromCurrentProject = (
    currentProject: any,
    commonTeam = projectTeam(currentProject),
    periods = getAuditPeriods(currentProject),
    financesPatch: Record<string, unknown> = {},
  ) => {
    const currentNotes = readProjectNotes(currentProject);
    const existingFinances = {
      ...(currentNotes.finances || {}),
      ...(currentProject?.finances || {}),
      ...financesPatch,
    };
    const calculationProject = projectForFinanceCalculation({
      ...currentProject,
      team: commonTeam,
      notes: {
        ...currentNotes,
        team: commonTeam,
        auditPeriods: periods,
        finances: existingFinances,
      },
      finances: existingFinances,
    });
    return calculateProjectFinances({
      ...calculationProject,
      finances: {
        ...existingFinances,
        amountWithoutVAT: projectAmount(currentProject),
      },
    });
  };

  const setProjectStatus = async (row: (typeof rows)[number], nextStatus: ManagedProjectStatus) => {
    if (!canManageProjectStatus || !user || !updateProject) return;
    if (!statusOptions.some((option) => option.value === nextStatus)) return;
    const requiresVerifiedHours = nextStatus === 'pending_payment_approval' || nextStatus === 'completed';
    if (requiresVerifiedHours && (hoursLoading || hoursError || !hoursComplete)) {
      toast({ title: 'Статус не изменён', description: 'Нельзя передать проект к бонусам или закрыть его, пока таймшиты не сверены полностью.', variant: 'destructive' });
      return;
    }
    if (requiresVerifiedHours && row.hours.pending > 0) {
      toast({ title: 'Статус не изменён', description: `${row.hours.pending.toFixed(1)} ч ещё ждут утверждения.`, variant: 'destructive' });
      return;
    }
    const ids = projectIdsForRow(row);
    setSavingProjectId(`${row.id}:status`);
    try {
      await Promise.all(ids.map(async (projectId) => {
        await updateProject(projectId, (currentProject: any) => {
          const statusUpdate = buildProjectStatusUpdate({
            project: currentProject,
            nextStatus,
            actor: user,
          });
          if (nextStatus !== 'pending_payment_approval') return statusUpdate;

          const finances = calculateFinancesFromCurrentProject(currentProject);
          return {
            ...statusUpdate,
            notes: {
              ...statusUpdate.notes,
              finances,
            },
          };
        });
      }));

      if (nextStatus === 'pending_payment_approval') {
        const ceoIds = (employees as any[])
          .filter((employee) => employee.role === 'ceo' || employee.role === 'admin')
          .map((employee) => employee.id);
        if (ceoIds.length > 0) {
          await notifyProjectReadyForCeoBonuses({
            projectName: row.name,
            ceoIds,
            partnerName: user.name,
            projectId: row.id,
          });
        }
      }

      toast({
        title: nextStatus === 'pending_payment_approval' ? 'Проект готов к бонусам' : 'Статус изменён',
        description: `${row.name}: ${MANAGED_PROJECT_STATUS_LABELS[nextStatus]}`,
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось изменить статус',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const ensureBonusDraftEditable = (row: (typeof rows)[number]): boolean => {
    const ids = projectIdsForRow(row);
    const ledger = projectPaymentLedger(ids, paymentRegistrySummary.byProject);
    const reason = !canEditBonusDraft
      ? isImpersonating
        ? 'В режиме проверки роли денежные изменения отключены. Вернитесь в свою учётную запись CEO.'
        : 'Изменять бонусный расчёт может только генеральный директор.'
      : ids.length > 1
      ? 'Свод объединяет несколько записей. Сначала выберите каноническую запись проекта.'
      : paymentRegistryLoading
        ? 'Платёжный реестр ещё загружается. Дождитесь завершения сверки.'
        : paymentRegistryError
          ? 'Платёжный реестр недоступен. Менять расчёт без проверки выплат небезопасно.'
        : ledger.rowCount > 0
            ? 'Расчёт уже передан в платёжный реестр. Для изменения нужна отдельная корректировка.'
            : '';
    if (!reason) return true;
    toast({ title: 'Редактирование бонуса заблокировано', description: reason, variant: 'destructive' });
    return false;
  };

  const beginBonusMutation = (row: (typeof rows)[number]): boolean => {
    if (!updateProject || !ensureBonusDraftEditable(row)) return false;
    if (bonusMutationLocksRef.current.has(row.id)) {
      toast({
        title: 'Изменение уже сохраняется',
        description: 'Дождитесь сохранения текущей суммы и повторите действие.',
      });
      return false;
    }
    bonusMutationLocksRef.current.add(row.id);
    return true;
  };

  const endBonusMutation = (projectId: string) => {
    bonusMutationLocksRef.current.delete(projectId);
  };

  const setBonusPercent = async (row: (typeof rows)[number], nextPercent: number): Promise<boolean> => {
    if (!beginBonusMutation(row)) return false;
    const bonusPercent = Math.max(0, Math.min(40, nextPercent));
    setSavingProjectId(row.id);
    try {
      await updateProject(row.id, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject?.finances || {}),
        };
        const history = Array.isArray(existingFinances.bonusPoolHistory) ? existingFinances.bonusPoolHistory : [];
        const nextHistory = [
          ...history,
          {
            type: 'pool_percent_change',
            by: user?.id,
            byName: user?.name,
            at: new Date().toISOString(),
            from: Number(existingFinances.bonusPercent || 0) || 0,
            to: bonusPercent,
            clearedManualPool: existingFinances.bonusPoolManuallyAdjusted === true,
          },
        ].slice(-20);
        const nextFinancesSource = {
          ...existingFinances,
          amountWithoutVAT: projectAmount(currentProject),
          bonusPercent,
          bonusPoolOverrideAmount: null,
          bonusPoolManuallyAdjusted: false,
          bonusPoolHistory: nextHistory,
        };
        const projectWithPercent = projectForFinanceCalculation({
          ...currentProject,
          finances: nextFinancesSource,
        });
        const finances = calculateProjectFinances(projectWithPercent);
        return { finances: {
          ...existingFinances,
          ...finances,
          bonusPercent,
          bonusPoolOverrideAmount: null,
          bonusPoolManuallyAdjusted: false,
          bonusPoolHistory: nextHistory,
        } };
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Не удалось обновить бонусы',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
      return false;
    } finally {
      endBonusMutation(row.id);
      setSavingProjectId(null);
    }
  };

  const setBonusPoolAmount = async (row: (typeof rows)[number], nextAmount: number): Promise<boolean> => {
    if (!Number.isFinite(nextAmount) || !beginBonusMutation(row)) return false;
    const amount = Math.max(0, Math.round(nextAmount));
    setSavingProjectId(`${row.id}:bonus-pool`);
    try {
      await updateProject(row.id, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject?.finances || {}),
        };
        const previousAmount = Number(existingFinances.totalBonusAmount || 0) || 0;
        const history = Array.isArray(existingFinances.bonusPoolHistory) ? existingFinances.bonusPoolHistory : [];
        const nextFinancesSource = {
          ...existingFinances,
          amountWithoutVAT: projectAmount(currentProject),
          bonusPoolOverrideAmount: amount,
          bonusPoolManuallyAdjusted: true,
          bonusPoolHistory: [
            ...history,
            {
              type: 'pool_amount_change',
              by: user?.id,
              byName: user?.name,
              at: new Date().toISOString(),
              from: previousAmount,
              to: amount,
            },
          ].slice(-20),
        };
        const finances = calculateProjectFinances(projectForFinanceCalculation({
          ...currentProject,
          finances: nextFinancesSource,
        }));
        return { finances };
      });
      toast({ title: 'Бонусный пул проекта сохранён', description: `${row.name}: ${money.format(amount)} ₸` });
      return true;
    } catch (error: any) {
      toast({
        title: 'Не удалось сохранить бонусный пул',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
      return false;
    } finally {
      endBonusMutation(row.id);
      setSavingProjectId(null);
    }
  };

  const resetBonusPoolToFormula = async (row: (typeof rows)[number]): Promise<boolean> => {
    if (!beginBonusMutation(row)) return false;
    setSavingProjectId(`${row.id}:bonus-pool`);
    try {
      let savedFormulaPercent = 0;
      await updateProject(row.id, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject?.finances || {}),
        };
        const history = Array.isArray(existingFinances.bonusPoolHistory) ? existingFinances.bonusPoolHistory : [];
        const nextFinancesSource = {
          ...existingFinances,
          amountWithoutVAT: projectAmount(currentProject),
          bonusPoolOverrideAmount: null,
          bonusPoolManuallyAdjusted: false,
          bonusPoolHistory: [
            ...history,
            {
              type: 'pool_formula_reset',
              by: user?.id,
              byName: user?.name,
              at: new Date().toISOString(),
              from: Number(existingFinances.totalBonusAmount || 0) || 0,
              to: null,
            },
          ].slice(-20),
        };
        const finances = calculateProjectFinances(projectForFinanceCalculation({
          ...currentProject,
          finances: nextFinancesSource,
        }));
        savedFormulaPercent = Number(finances.bonusPercent || 0) || 0;
        return { finances };
      });
      toast({ title: 'Бонусный пул снова считается по проценту', description: `${savedFormulaPercent.toFixed(1)}% от базы` });
      return true;
    } catch (error: any) {
      toast({
        title: 'Не удалось вернуть расчёт по проценту',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
      return false;
    } finally {
      endBonusMutation(row.id);
      setSavingProjectId(null);
    }
  };

  const addProjectContractor = async (row: (typeof rows)[number]) => {
    if (!canManageContractors || !updateProject || !createEmployee) return;
    const name = contractorNameDrafts[row.id]?.trim() || '';
    const rawAmount = contractorAmountDrafts[row.id] ?? String(Number(row.finances.totalContractorsAmount) || 0);
    const amount = Number(String(rawAmount).replace(/\s/g, '').replace(',', '.'));
    if (!name) {
      toast({ title: 'Укажите ФИО исполнителя ГПХ', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Укажите корректную сумму ГПХ', variant: 'destructive' });
      return;
    }

    const assignment = gphAssignmentContext?.rowId === row.id ? gphAssignmentContext : null;
    const assignmentPeriod = assignment?.periodId
      ? row.periods.find((item: AuditPeriod) => item.id === assignment.periodId)
      : undefined;
    if (assignment?.periodId && !assignmentPeriod) {
      toast({ title: 'Период уже изменён или удалён', description: 'Обновите свод и повторите назначение.', variant: 'destructive' });
      return;
    }
    const assignmentSourceRow = assignmentPeriod ? periodSourceRow(row, assignmentPeriod) : row;
    const targetProjectId = assignmentPeriod?.sourceProjectId
      || assignmentSourceRow?.project?.id
      || assignmentSourceRow?.id
      || row.id;

    setSavingProjectId(`${row.id}:contractors`);
    try {
      const sameName = (employees as any[]).find((employee) => (
        employeeName(employee).trim().toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru')
      ));
      const employee = sameName || await createEmployee({
        name,
        email: `gph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@external.invalid`,
        role: 'employee',
        level: '1',
        department: 'ГПХ / внешние исполнители',
        position: 'Исполнитель ГПХ',
      } as any);
      const contractorEntry = {
        id: `command-center-gph-${Date.now()}`,
        name,
        amount,
        type: 'gph',
        employeeId: employee.id,
        employeeName: employeeName(employee),
        source: 'project-command-center',
        addedAt: new Date().toISOString(),
        addedBy: user?.id,
      };
      const assignmentRoleKey = assignment?.roleKey || '';
      const assignmentPeriodId = assignment?.periodId;
      const assignmentMember = assignmentRoleKey ? {
        userId: employee.id,
        userName: employeeName(employee),
        userEmail: employee.email,
        name: employeeName(employee),
        role: assignmentRoleKey,
        bonusPercent: roleDefaultPercent(assignmentRoleKey),
        assignedAt: new Date().toISOString(),
        assignedBy: user?.id || 'gph-dialog',
      } : null;
      await updateProject(targetProjectId, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject?.finances || {}),
        };
        const contractors = Array.isArray(existingFinances.contractors)
          ? [...existingFinances.contractors, contractorEntry]
          : [contractorEntry];
        const totalContractorsAmount = contractors.reduce((sum: number, item: any) => sum + (Number(item?.amount) || 0), 0);
        let nextTeam = projectTeam(currentProject);
        let nextPeriods = getAuditPeriods(currentProject);
        const teamPatch: Record<string, unknown> = {};

        if (assignmentMember && assignmentPeriodId) {
          const basePeriods = persistedPeriodsForProject(currentProject);
          let matched = false;
          nextPeriods = basePeriods.map((item) => {
            if (item.id !== assignmentPeriodId) return item;
            matched = true;
            const currentPeriodTeam = periodTeam(item);
            const nextPeriodTeam = isPartnerRole(assignmentRoleKey)
              ? [assignmentMember, ...currentPeriodTeam.filter((member: any) => !isPartnerRole(teamRole(member)))]
              : isLeaderRole(assignmentRoleKey)
                ? [...currentPeriodTeam.filter((member: any) => !isLeaderRole(teamRole(member))), assignmentMember]
                : [...currentPeriodTeam.filter((member: any) => teamRole(member) !== assignmentRoleKey), assignmentMember];
            return {
              ...item,
              team: nextPeriodTeam,
              teamSource: 'period',
              updatedAt: new Date().toISOString(),
            } as AuditPeriod;
          });
          if (!matched) throw new Error('Период уже изменён или удалён. Обновите свод и повторите назначение.');
          teamPatch.auditPeriods = nextPeriods;
        } else if (assignmentMember) {
          nextTeam = isPartnerRole(assignmentRoleKey)
            ? [assignmentMember, ...nextTeam.filter((member: any) => !isPartnerRole(teamRole(member)))]
            : isLeaderRole(assignmentRoleKey)
              ? [...nextTeam.filter((member: any) => !isLeaderRole(teamRole(member))), assignmentMember]
              : [...nextTeam.filter((member: any) => teamRole(member) !== assignmentRoleKey), assignmentMember];
          teamPatch.team = nextTeam;
        }

        const recalculated = calculateFinancesFromCurrentProject(
          currentProject,
          nextTeam,
          nextPeriods,
          { contractors, totalContractorsAmount },
        );
        return {
          finances: recalculated,
          ...teamPatch,
        };
      });
      setContractorNameDrafts((current) => ({ ...current, [row.id]: '' }));
      setContractorAmountDrafts((current) => ({ ...current, [row.id]: '' }));
      setGphEditorRowId(null);
      setGphAssignmentContext(null);
      toast({
        title: 'Исполнитель ГПХ добавлен в базу и команду',
        description: `${employeeName(employee)}: ${money.format(amount)} ₸${assignment ? ` · ${TEAM_COLUMNS.find((column) => column.key === assignment.roleKey)?.label || 'роль назначена'}` : ''}`,
      });
    } catch (error: any) {
      toast({ title: 'Не удалось сохранить ГПХ', description: error?.message || 'Повторите попытку', variant: 'destructive' });
    } finally {
      setSavingProjectId(null);
    }
  };

  const setMemberBonusPercent = async (row: (typeof rows)[number], member: any, nextPercent: number): Promise<boolean> => {
    const memberId = teamMemberId(member);
    if (!memberId || !beginBonusMutation(row)) return false;

    const bonusPercent = Math.max(0, Math.min(100, nextPercent));
    setSavingProjectId(`${row.id}:${memberId}`);
    try {
      await updateProject(row.id, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const calculationProject = projectForFinanceCalculation(currentProject);
        const calculationTeam = calculationProject.team as CanonicalTeamMember[];
        const currentMember = calculationTeam.find((item: CanonicalTeamMember) => (
          teamMemberId(item) === memberId && teamRole(item) === teamRole(member)
        ));
        const currentFormulaPercent = Math.max(0, Math.min(100, Number(currentMember?.bonusPercent ?? bonusPercent) || 0));
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject?.finances || {}),
        };
        const previousBonus = existingFinances.teamBonuses?.[memberId] || {};
        const history = Array.isArray(previousBonus.history) ? previousBonus.history : [];
        const projectWithMemberPercent = projectForFinanceCalculation({
          ...currentProject,
          finances: {
            ...existingFinances,
            amountWithoutVAT: projectAmount(currentProject),
            teamBonuses: {
              ...(existingFinances.teamBonuses || {}),
              [memberId]: {
                ...previousBonus,
                manuallyAdjusted: false,
              },
            },
          },
        });
        const finances = calculateProjectFinances(projectWithMemberPercent);
        if (finances.teamBonuses[memberId]) {
          finances.teamBonuses[memberId] = {
            ...finances.teamBonuses[memberId],
            percent: currentFormulaPercent,
            history: [
              ...history,
              {
                type: 'formula_reset',
                by: user?.id,
                byName: user?.name,
                at: new Date().toISOString(),
                from: Number(previousBonus.amount || 0) || 0,
                to: Number(finances.teamBonuses[memberId].amount || 0) || 0,
              },
            ].slice(-20),
          };
        }
        return { finances };
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Не удалось обновить участника',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
      return false;
    } finally {
      endBonusMutation(row.id);
      setSavingProjectId(null);
    }
  };

  const setMemberBonusAmount = async (row: (typeof rows)[number], member: any, nextAmount: number): Promise<boolean> => {
    const memberId = teamMemberId(member);
    if (!memberId || !Number.isFinite(nextAmount) || !beginBonusMutation(row)) return false;

    const amount = Math.max(0, Math.round(nextAmount));
    setSavingProjectId(`${row.id}:${memberId}`);
    try {
      await updateProject(row.id, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const existingFinances = {
          ...(currentNotes.finances || {}),
          ...(currentProject?.finances || {}),
        };
        const bonusPool = Number(existingFinances.totalBonusAmount || 0) || 0;
        const previousBonus = existingFinances.teamBonuses?.[memberId] || {};
        const previousAmount = Number(previousBonus.amount || 0) || 0;
        const history = Array.isArray(previousBonus.history) ? previousBonus.history : [];
        const teamBonuses = {
          ...(existingFinances.teamBonuses || {}),
          [memberId]: {
            ...previousBonus,
            role: teamRole(member),
            percent: bonusPool > 0
              ? Number(((amount / bonusPool) * 100).toFixed(2))
              : Number(member?.bonusPercent || 0),
            amount,
            manuallyAdjusted: true,
            history: [
              ...history,
              {
                type: 'amount_change',
                by: user?.id,
                byName: user?.name,
                at: new Date().toISOString(),
                from: previousAmount,
                to: amount,
              },
            ].slice(-20),
          },
        };
        const totalAssigned = Object.values(teamBonuses).reduce((sum: number, item: any) => sum + (Number(item?.amount) || 0), 0);
        const totalContractorsAmount = Number(existingFinances.totalContractorsAmount || 0) || 0;
        const preExpenseAmount = Number(existingFinances.preExpenseAmount || 0) || 0;
        const currentAmount = projectAmount(currentProject);
        const grossProfit = currentAmount - totalAssigned - totalContractorsAmount - preExpenseAmount;
        return { finances: {
          ...existingFinances,
          amountWithoutVAT: currentAmount,
          teamBonuses,
          totalPaidBonuses: totalAssigned,
          totalCosts: totalAssigned + totalContractorsAmount + preExpenseAmount,
          grossProfit,
          profitMargin: currentAmount > 0 ? (grossProfit / currentAmount) * 100 : 0,
        } };
      });
      toast({ title: 'Бонус сотрудника сохранён', description: `${teamName(member)}: ${money.format(amount)} ₸` });
      return true;
    } catch (error: any) {
      toast({
        title: 'Не удалось сохранить бонус сотрудника',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
      return false;
    } finally {
      endBonusMutation(row.id);
      setSavingProjectId(null);
    }
  };

  const addTeamMember = async (row: (typeof rows)[number], roleKey: string, employeeId: string) => {
    if (!canManageTeam || !updateProject || !employeeId) return;
    const employee = (employees as any[]).find((item) => item.id === employeeId);
    if (!employee) return;

    setSavingProjectId(`${row.id}:add:${roleKey}`);
    try {
      const nextMember: CanonicalTeamMember = {
        userId: employee.id,
        userName: employeeName(employee),
        userEmail: employee.email,
        name: employeeName(employee),
        role: roleKey,
        bonusPercent: roleDefaultPercent(roleKey),
        assignedAt: new Date().toISOString(),
        assignedBy: user?.id || 'inline-table',
      };
      await updateProject(row.id, (currentProject: any) => {
        const currentTeam = effectiveProjectTeam(currentProject);
        const nextTeam = roleKey === 'partner'
          ? [nextMember, ...currentTeam.filter((member: any) => teamRole(member) !== 'partner')]
          : isLeaderRole(roleKey)
            ? [...currentTeam.filter((member: any) => !isLeaderRole(teamRole(member))), nextMember]
            : [...currentTeam, nextMember];
        return canonicalTeamUpdatePatch(currentProject, nextTeam);
      });
      toast({
        title: isPartnerRole(roleKey) ? 'Партнёр назначен' : 'Участник добавлен',
        description: isPartnerRole(roleKey)
          ? `${employeeName(employee)}. Весь исторический состав материализован в единой команде проекта.`
          : employeeName(employee),
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось добавить участника',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const applyPartnerTeamTemplateToProject = async () => {
    if (!canManageTeam || !updateProject || !projectTeamTemplateTarget || !projectTeamTemplateTargetRow) return;
    const template = partnerTeamTemplate(projectTeamTemplateTarget.partnerId, projectTeamTemplateTarget.rowId);
    if (!template?.length) {
      toast({
        title: 'Шаблон команды не найден',
        description: 'Сначала сохраните полную команду хотя бы в одном проекте этого партнёра.',
        variant: 'destructive',
      });
      setProjectTeamTemplateTarget(null);
      return;
    }

    const row = projectTeamTemplateTargetRow;
    setSavingProjectId(`${row.id}:team-template`);
    try {
      await updateProject(row.id, (currentProject: any) => {
        const nextTeam = template.map((member) => ({ ...member }));
        return canonicalTeamUpdatePatch(currentProject, nextTeam);
      });
      toast({
        title: 'Шаблон команды применён',
        description: `${projectTeamTemplateTargetDefinition?.label || 'Команда партнёра'}. Состав сохранён как единая команда проекта.`,
      });
      setProjectTeamTemplateTarget(null);
    } catch (error: any) {
      toast({
        title: 'Не удалось применить шаблон команды',
        description: error?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const removeTeamMember = async (row: (typeof rows)[number], member: any, memberIndex: number) => {
    if (!canManageTeam || !updateProject) return;
    const id = teamMemberId(member);
    const role = teamRole(member);
    setSavingProjectId(`${row.id}:remove:${id || memberIndex}`);
    try {
      await updateProject(row.id, (currentProject: any) => {
        const materializedTeam = effectiveProjectTeam(currentProject);
        let roleIndex = -1;
        const nextTeam = materializedTeam.filter((item: CanonicalTeamMember) => {
          if (teamRole(item) !== role) return true;
          roleIndex += 1;
          if (id && teamMemberId(item)) return teamMemberId(item) !== id;
          return roleIndex !== memberIndex;
        });
        return canonicalTeamUpdatePatch(currentProject, nextTeam);
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось убрать участника',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const periodSourceRow = (row: (typeof rows)[number], period: AuditPeriod) => {
    const sourceProjectId = period.sourceProjectId;
    const groupRows = row.duplicateRows?.length > 0 ? row.duplicateRows : [row];
    return groupRows.find((item: any) => item.id === sourceProjectId || item.project?.id === sourceProjectId) || row;
  };

  const persistedPeriodsForProject = (project: any): AuditPeriod[] => {
    const explicit = getAuditPeriods(project);
    if (projectHasSavedPeriodList(project)) return explicit;
    return explicit.length > 0 ? explicit : [projectToAuditPeriod(project)];
  };

  const cancelProjectDateEdit = () => {
    setEditingProjectDatesRowId(null);
    setProjectDateDraft({ startDate: '', deadline: '' });
  };

  const startProjectDateEdit = (row: (typeof rows)[number]) => {
    setEditingProjectDatesRowId(row.id);
    setProjectDateDraft({ startDate: row.startDate || '', deadline: row.deadline || '' });
  };

  const saveProjectDates = async (row: (typeof rows)[number]) => {
    if (!canEditPeriods || !updateProject) return;
    if (!projectDateDraft.startDate && !projectDateDraft.deadline) {
      toast({ title: 'Укажите хотя бы одну дату', variant: 'destructive' });
      return;
    }

    const sourceProject = row.project || row;
    const sourceProjectId = sourceProject.id || row.id;
    setSavingProjectId(`${row.id}:dates`);
    try {
      await updateProject(sourceProjectId, (currentProject: any) => {
        const currentNotes = readProjectNotes(currentProject);
        const contract = {
          ...(currentNotes.contract || {}),
          serviceStartDate: projectDateDraft.startDate || undefined,
          serviceEndDate: projectDateDraft.deadline || undefined,
        };
        return {
          startDate: projectDateDraft.startDate || undefined,
          start_date: projectDateDraft.startDate || undefined,
          deadline: projectDateDraft.deadline || undefined,
          endDate: projectDateDraft.deadline || undefined,
          contract,
        };
      });
      toast({ title: 'Сроки проекта обновлены', description: `${formatDate(projectDateDraft.startDate)} - ${formatDate(projectDateDraft.deadline)}` });
      cancelProjectDateEdit();
    } catch (error: any) {
      toast({
        title: 'Не удалось обновить сроки',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const startAddPeriod = (row: (typeof rows)[number]) => {
    const nextNumber = (row.periods?.length || 0) + 1;
    setAddingPeriodRowId(row.id);
    setNewPeriodDraft({
      name: `Период ${nextNumber}`,
      type: 'custom',
      startDate: row.startDate || '',
      endDate: row.deadline || '',
      deadline: row.deadline || '',
    });
  };

  const cancelAddPeriod = () => {
    setAddingPeriodRowId(null);
    setNewPeriodDraft({ name: '', type: 'custom', startDate: '', endDate: '', deadline: '' });
  };

  const addPeriod = async (row: (typeof rows)[number]) => {
    if (!canEditPeriods || !updateProject) return;
    const name = newPeriodDraft.name.trim();
    if (!name) {
      toast({ title: 'Укажите название периода', variant: 'destructive' });
      return;
    }

    const sourceProject = row.project || row;
    const sourceProjectId = sourceProject.id || row.id;
    const now = new Date().toISOString();
    const nextPeriod: AuditPeriod = {
      id: `period_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: newPeriodDraft.type,
      startDate: newPeriodDraft.startDate || '',
      endDate: newPeriodDraft.endDate || '',
      deadline: newPeriodDraft.deadline || undefined,
      status: 'planned',
      taskIds: [],
      documentIds: [],
      team: [],
      teamSource: 'empty',
      sourceProjectId,
      createdBy: user?.id || 'system',
      createdAt: now,
      updatedAt: now,
    };
    setSavingProjectId(`${row.id}:period:add`);
    try {
      await updateProject(sourceProjectId, (currentProject: any) => {
        const nextPeriods = [...persistedPeriodsForProject(currentProject), nextPeriod];
        const currentTeam = projectTeam(currentProject);
        const finances = calculateFinancesFromCurrentProject(currentProject, currentTeam, nextPeriods);
        return { auditPeriods: nextPeriods, finances };
      });
      toast({ title: 'Период добавлен', description: name });
      cancelAddPeriod();
    } catch (error: any) {
      toast({
        title: 'Не удалось добавить период',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const deletePeriod = async (row: (typeof rows)[number], period: AuditPeriod) => {
    if (!canEditPeriods || !updateProject) return;
    const sourceRow = periodSourceRow(row, period);
    const sourceProject = sourceRow.project || sourceRow;
    const sourceProjectId = sourceProject.id || sourceRow.id || row.id;

    setSavingProjectId(`${row.id}:${period.id}:delete`);
    try {
      await updateProject(sourceProjectId, (currentProject: any) => {
        let removed = false;
        const nextPeriods = persistedPeriodsForProject(currentProject).filter((item) => {
          const samePeriod = item.id === period.id || (
            !removed
            && !period.id
            && item.name === period.name
            && item.startDate === period.startDate
            && item.endDate === period.endDate
            && item.deadline === period.deadline
          );
          if (!samePeriod) return true;
          removed = true;
          return false;
        });
        if (!removed) throw new Error('Период уже изменён или удалён. Обновите свод и повторите действие.');
        const currentTeam = projectTeam(currentProject);
        const finances = calculateFinancesFromCurrentProject(currentProject, currentTeam, nextPeriods);
        return { auditPeriods: nextPeriods, finances };
      });
      toast({ title: 'Период удален', description: period.name });
    } catch (error: any) {
      toast({
        title: 'Не удалось удалить период',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const savePeriodName = async (row: (typeof rows)[number], period: AuditPeriod, nextName: string) => {
    if (!canEditPeriods || !updateProject) return;
    const name = nextName.trim();
    if (!name || name === period.name) {
      setEditingPeriodId(null);
      setPeriodNameDraft('');
      return;
    }

    const sourceRow = periodSourceRow(row, period);
    const sourceProject = sourceRow.project || sourceRow;
    const sourceProjectId = sourceProject.id || sourceRow.id || row.id;
    const now = new Date().toISOString();

    setSavingProjectId(`${row.id}:${period.id}:name`);
    try {
      await updateProject(sourceProjectId, (currentProject: any) => {
        let matched = false;
        const nextPeriods = persistedPeriodsForProject(currentProject).map((item) => {
          const samePeriod = item.id === period.id || (
            !matched
            && !period.id
            && item.name === period.name
            && item.startDate === period.startDate
            && item.endDate === period.endDate
            && item.deadline === period.deadline
          );
          if (!samePeriod) return item;
          matched = true;
          return {
            ...item,
            sourceProjectId,
            name,
            updatedAt: now,
          } as AuditPeriod;
        });
        if (!matched) throw new Error('Период уже изменён или удалён. Обновите свод и повторите действие.');
        const currentTeam = projectTeam(currentProject);
        const finances = calculateFinancesFromCurrentProject(currentProject, currentTeam, nextPeriods);
        return { auditPeriods: nextPeriods, finances };
      });
      toast({ title: 'Название периода обновлено', description: name });
      setEditingPeriodId(null);
      setPeriodNameDraft('');
    } catch (error: any) {
      toast({
        title: 'Не удалось обновить период',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const savePeriodTeam = async (
    row: (typeof rows)[number],
    period: AuditPeriod,
    updateTeam: (currentTeam: CanonicalTeamMember[]) => CanonicalTeamMember[],
  ) => {
    if (!canManageTeam || !updateProject) return;
    const sourceRow = periodSourceRow(row, period);
    const sourceProject = sourceRow.project || sourceRow;
    const sourceProjectId = sourceProject.id || sourceRow.id || row.id;
    const now = new Date().toISOString();

    await updateProject(sourceProjectId, (currentProject: any) => {
      let matched = false;
      const nextPeriods = persistedPeriodsForProject(currentProject).map((item) => {
        const samePeriod = item.id === period.id || (
          !matched
          && !period.id
          && item.name === period.name
          && item.startDate === period.startDate
          && item.endDate === period.endDate
          && item.deadline === period.deadline
        );
        if (!samePeriod) return item;
        matched = true;
        return {
          ...item,
          sourceProjectId,
          team: updateTeam(periodTeam(item)),
          teamSource: 'period',
          updatedAt: now,
        } as AuditPeriod;
      });
      if (!matched) throw new Error('Период уже изменён или удалён. Обновите свод и повторите действие.');
      const currentTeam = projectTeam(currentProject);
      const finances = calculateFinancesFromCurrentProject(currentProject, currentTeam, nextPeriods);
      return { auditPeriods: nextPeriods, finances };
    });
  };

  const addPeriodTeamMember = async (row: (typeof rows)[number], period: AuditPeriod, roleKey: string, employeeId: string) => {
    if (!canManageTeam || !updateProject || !employeeId) return;
    const employee = (employees as any[]).find((item) => item.id === employeeId);
    if (!employee) return;

    setSavingProjectId(`${row.id}:${period.id}:add:${roleKey}`);
    try {
      const nextMember: CanonicalTeamMember = {
        userId: employee.id,
        userName: employeeName(employee),
        name: employeeName(employee),
        userEmail: employee.email,
        role: roleKey,
        bonusPercent: roleDefaultPercent(roleKey),
        assignedAt: new Date().toISOString(),
        assignedBy: user?.id || 'period-table',
      };
      await savePeriodTeam(row, period, (currentTeam) => (
        isPartnerRole(roleKey)
          ? [nextMember, ...currentTeam.filter((member: any) => !isPartnerRole(teamRole(member)))]
          : isLeaderRole(roleKey)
            ? [...currentTeam.filter((member: any) => !isLeaderRole(teamRole(member))), nextMember]
            : [...currentTeam.filter((member: any) => teamRole(member) !== roleKey), nextMember]
      ));
      toast({ title: 'Участник добавлен в период', description: `${period.name}: ${employeeName(employee)}` });
    } catch (error: any) {
      toast({
        title: 'Не удалось добавить участника в период',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const removePeriodTeamMember = async (row: (typeof rows)[number], period: AuditPeriod, member: any, memberIndex: number) => {
    if (!canManageTeam || !updateProject) return;
    const id = teamMemberId(member);
    const role = teamRole(member);
    setSavingProjectId(`${row.id}:${period.id}:remove:${id || memberIndex}`);
    try {
      await savePeriodTeam(row, period, (currentTeam) => {
        let roleIndex = -1;
        return currentTeam.filter((item: any) => {
          if (teamRole(item) !== role) return true;
          roleIndex += 1;
          if (id && teamMemberId(item)) return teamMemberId(item) !== id;
          return roleIndex !== memberIndex;
        });
      });
      toast({ title: 'Участник убран из периода', description: period.name });
    } catch (error: any) {
      toast({
        title: 'Не удалось убрать участника из периода',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const renderProjectInlineDetail = (
    row: (typeof rows)[number],
    showAdvancedToggle = true,
    embedded = false,
  ) => {
    const rowProjectIds = row.projectIds?.length ? row.projectIds : [row.id];
    const paymentLedger = projectPaymentLedger(rowProjectIds, paymentRegistrySummary.byProject);
    const groupedBonusRow = rowProjectIds.length > 1;
    const currentTeamMembers: CanonicalTeamMember[] = row.coverageTeam || row.team || [];
    const protectedBonusMembers = financeParticipants(row.project)
      .filter((member: any) => member?.legacyBonusOnly)
      .map((member: CanonicalTeamMember) => {
        const memberId = teamMemberId(member);
        const employee = memberId
          ? (employees as any[]).find((item) => item.id === memberId)
          : undefined;
        return employee
          ? { ...member, userName: employeeName(employee), name: employeeName(employee) }
          : member;
      });
    const bonusTeamMembers = dedupeCanonicalTeamMembers([
      currentTeamMembers,
      protectedBonusMembers,
    ]);
    const memberGroups = new Map<string, { id: string; source: CanonicalTeamMember; roles: Set<string> }>();

    for (const member of bonusTeamMembers) {
      const identity = bonusMemberIdentity(member);
      const existing = memberGroups.get(identity);
      if (existing) {
        existing.roles.add(projectRoleLabel(teamRole(member)));
        continue;
      }
      memberGroups.set(identity, {
        id: teamMemberId(member),
        source: member,
        roles: new Set([
          projectRoleLabel(teamRole(member)),
          ...(member.legacyBonusOnly ? ['Сохранённый бонус · вне команды'] : []),
        ]),
      });
    }

    const bonusLockedReason = !canEditBonusDraft
      ? isImpersonating
        ? 'Режим проверки роли: денежные изменения отключены.'
        : 'Изменение бонусов доступно только генеральному директору.'
      : groupedBonusRow
      ? `Объединено записей: ${rowProjectIds.length}. Сначала выберите каноническую запись.`
      : paymentRegistryLoading
        ? 'Сверяем платёжный реестр. Редактирование временно недоступно.'
        : paymentRegistryError
          ? 'Платёжный реестр недоступен. Непроверенные выплаты менять небезопасно.'
          : paymentLedger.rowCount > 0
            ? 'Расчёт уже передан в платёжный реестр. Изменения возможны только отдельной корректировкой.'
            : savingProjectId
              ? 'Сохраняем изменения…'
              : null;
    const bonusEditable = canEditBonusDraft && !bonusLockedReason;
    const memberSourceById = new Map<string, CanonicalTeamMember>();
    const bonusEmployees: ProjectInlineBonusEmployee[] = Array.from(memberGroups.entries()).map(([identity, group]) => {
      const memberId = group.id;
      if (memberId) memberSourceById.set(memberId, group.source);
      const savedBonus = memberId ? row.finances.teamBonuses?.[memberId] : undefined;
      const settledDetachedBonus = Boolean(group.source.legacyBonusOnly) && isSettledBonus(savedBonus);
      const memberLedger = memberId
        ? memberPaymentLedger(rowProjectIds, memberId, paymentRegistrySummary.byKey)
        : { approvedUnpaidAmount: 0, paidAmount: 0, pendingAmount: 0, rowCount: 0, latestPaymentDate: null };
      const memberProjectHours = memberId
        ? rowProjectIds.reduce(
            (acc: ProjectHoursTotals, projectId: string) => {
              const value = memberHours.get(hoursPairKey(memberId, projectId)) || { approved: 0, pending: 0 };
              return {
                approved: acc.approved + Number(value.approved || 0),
                pending: acc.pending + Number(value.pending || 0),
              };
            },
            { approved: 0, pending: 0 },
          )
        : { approved: 0, pending: 0 };
      return {
        id: memberId || identity,
        name: teamName(group.source),
        roles: Array.from(group.roles),
        approvedHours: memberProjectHours.approved,
        pendingHours: memberProjectHours.pending,
        amount: memberBonusAmount(group.source, row.finances),
        percent: memberBonusPercent(group.source, row.finances),
        manuallyAdjusted: Boolean(memberId && row.finances.teamBonuses?.[memberId]?.manuallyAdjusted),
        approvedForPayment: memberLedger.approvedUnpaidAmount,
        paidAmount: memberLedger.paidAmount,
        pendingAmount: memberLedger.pendingAmount,
        editable: bonusEditable && Boolean(memberId) && !settledDetachedBonus,
        lockedReason: settledDetachedBonus
          ? 'Бонус уже утверждён или выплачен и сохранён только для сверки.'
          : memberId
            ? bonusLockedReason
            : 'У сотрудника нет идентификатора — сначала исправьте карточку команды.',
      };
    });
    const activeTeamIdentities = new Set(
      currentTeamMembers.map((member) => teamMemberId(member) || bonusMemberIdentity(member)),
    );
    const teamMembers = bonusEmployees
      .filter((employee) => activeTeamIdentities.has(employee.id))
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        roles: employee.roles,
        approvedHours: employee.approvedHours,
        pendingHours: employee.pendingHours,
      }));
    const currentPartner = teamMemberForRole(currentTeamMembers, isPartnerRole);
    const currentLeader = teamMemberForRole(currentTeamMembers, isLeaderRole);
    const currentCompanyId = companyOptions.find((option) => rowMatchesCompanyOption(row, option.company))?.key;
    const commonPartner = currentPartner;
    const commonLeader = currentLeader;
    const commonPartnerId = teamMemberId(commonPartner);
    const selectedTeamRole = teamRoleDrafts[row.id] || 'manager_1';
    const totalBonusAmount = plannedBonusPool(row);
    const allocatedBonuses = allocatedDraftBonuses(row);
    const bonusBase = Number(row.finances.bonusBase || 0) || 0;
    const formulaPercent = Number(row.finances.bonusPercent || 0) || 0;
    const closureStatusLabel = row.status === 'pending_payment_approval'
      ? 'Готов к бонусам'
      : row.status === 'ready_to_complete'
        ? 'Готов к закрытию'
        : row.readiness.level === 'closed'
          ? 'Закрыт'
          : row.readiness.label;

    return (
      <ProjectInlineDetail
        projectId={row.id}
        name={row.name}
        company={row.company}
        client={row.client}
        serviceType={row.type}
        statusLabel={closureStatusLabel}
        statusTone={inlineReadinessTone(row.readiness.level)}
        issues={row.readiness.issues}
        team={{
          count: teamMembers.length,
          partnerName: currentPartner ? teamName(currentPartner) : null,
          leaderName: currentLeader ? teamName(currentLeader) : null,
          members: teamMembers,
        }}
        deadline={{
          rangeLabel: `${formatDate(row.startDate)} — ${formatDate(row.deadline)}`,
          stateLabel: row.deadlineState.label,
          tone: inlineDeadlineTone(row.deadlineState.tone),
        }}
        hours={{
          approved: row.hours.approved,
          pending: row.hours.pending,
          state: hoursLoading ? 'loading' : hoursError || !hoursComplete ? 'error' : 'ready',
        }}
        contract={{ number: row.contract?.number || null, filesCount: row.contractFiles.length }}
        finances={{
          contractAmount: row.amount,
          gphAmount: Number(row.finances.totalContractorsAmount || 0),
          preExpenseAmount: Number(row.finances.preExpenseAmount || 0),
          allocatedBonusAmount: allocatedBonuses,
          grossIncome: Number(row.finances.grossProfit || 0),
        }}
        showTeam={canSeeTeam}
        showHours={canSeeHours}
        showFinances={canSeeContractMoney}
        showBonuses={canSeeBonusSummary}
        bonuses={canSeeBonusSummary ? {
          poolAmount: totalBonusAmount,
          poolPercent: formulaPercent,
          formulaPoolAmount: Math.max(0, bonusBase * (formulaPercent / 100)),
          manuallyAdjusted: row.finances.bonusPoolManuallyAdjusted === true,
          approvedForPayment: paymentLedger.approvedUnpaidAmount,
          paidAmount: paymentLedger.paidAmount,
          pendingAmount: paymentLedger.pendingAmount,
          registryState: paymentRegistryLoading ? 'loading' : paymentRegistryError ? 'error' : 'ready',
          editable: bonusEditable,
          lockedReason: bonusLockedReason,
          employees: bonusEmployees,
        } : undefined}
        showAdvancedToggle={showAdvancedToggle}
        advancedOpen={!embedded && Boolean(advancedRows[row.id])}
        onToggleAdvanced={() => toggleAdvancedRow(row.id)}
        embedded={embedded}
        managementControls={embedded ? (
          <div className={`grid min-w-0 gap-3 ${canSeeTeam ? 'xl:grid-cols-[minmax(220px,0.8fr)_minmax(320px,1.1fr)_minmax(420px,1.7fr)]' : ''}`}>
            <div className="min-w-0 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Компания, статус и срок</div>
              {canBulkAssignCompany ? (
                <Select
                  value={currentCompanyId}
                  onValueChange={(companyId) => void assignCompanyToProject(row, companyId)}
                  disabled={savingProjectId === `${row.id}:company`}
                >
                  <SelectTrigger className="h-9 w-full text-xs" aria-label={`Наша компания проекта ${row.name}`}>
                    <SelectValue placeholder="Назначить нашу компанию" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyOptions.map((company) => (
                      <SelectItem key={company.key} value={company.key}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium">Наша компания: {row.company || '—'}</div>
              )}
              {canManageProjectStatus ? (
                <Select
                  value={statusOptions.some((option) => option.value === row.status) ? row.status : undefined}
                  onValueChange={(value) => setProjectStatus(row, value as ManagedProjectStatus)}
                  disabled={savingProjectId === `${row.id}:status`}
                >
                  <SelectTrigger className="h-9 w-full text-xs" aria-label={`Изменить статус проекта ${row.name}`}>
                    <SelectValue placeholder={closureStatusLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={(option.value === 'pending_payment_approval' || option.value === 'completed') && (hoursLoading || Boolean(hoursError) || !hoursComplete || row.hours.pending > 0)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={issueBadgeClass(row.readiness.level)}>{closureStatusLabel}</Badge>
              )}
              {editingProjectDatesRowId === row.id ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <Input type="date" aria-label={`Начало проекта ${row.name}`} className="h-9 text-xs" value={projectDateDraft.startDate} onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, startDate: event.target.value }))} />
                  <Input type="date" aria-label={`Дедлайн проекта ${row.name}`} className="h-9 text-xs" value={projectDateDraft.deadline} onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, deadline: event.target.value }))} />
                  <Button type="button" size="sm" className="h-8 text-xs" disabled={savingProjectId === `${row.id}:dates`} onClick={() => saveProjectDates(row)}>Сохранить</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={cancelProjectDateEdit}>Отмена</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-start text-xs" disabled={!canEditPeriods} onClick={() => startProjectDateEdit(row)}>
                  {formatDate(row.startDate)} — {formatDate(row.deadline)} · изменить
                </Button>
              )}
              {canEditProjectDetails && (
                <Button asChild type="button" size="sm" className="h-9 w-full justify-start text-xs">
                  <Link to={`/project/${row.id}?edit=1`}>
                    Редактировать проект
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>

            {canSeeTeam && <div className="min-w-0 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Партнёр и руководитель</div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {canManageTeam ? (
                  <EmployeeSearchAdd
                    employees={partnerEmployees}
                    disabled={savingProjectId === `${row.id}:add:partner`}
                    selectedEmployeeId={commonPartnerId}
                    triggerLabel={commonPartner ? teamName(commonPartner) : 'Назначить партнёра'}
                    triggerAriaLabel={`Партнёр проекта ${row.name}`}
                    onPick={(employeeId) => addTeamMember(row, 'partner', employeeId)}
                  />
                ) : <div className="text-sm font-medium">Партнёр: {currentPartner ? teamName(currentPartner) : '—'}</div>}
                {canManageTeam ? (
                  <EmployeeSearchAdd
                    employees={assignableEmployees}
                    disabled={savingProjectId === `${row.id}:add:project_leader`}
                    selectedEmployeeId={teamMemberId(commonLeader)}
                    triggerLabel={commonLeader ? teamName(commonLeader) : 'Назначить руководителя'}
                    triggerAriaLabel={`Руководитель проекта ${row.name}`}
                    onPick={(employeeId) => addTeamMember(row, 'project_leader', employeeId)}
                  />
                ) : <div className="text-sm font-medium">Руководитель: {currentLeader ? teamName(currentLeader) : '—'}</div>}
              </div>
              {canManageTeam && commonPartnerId && partnerTeamTemplate(commonPartnerId, row.id)?.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start whitespace-normal px-1 py-1 text-left text-xs text-sky-700"
                  disabled={savingProjectId === `${row.id}:team-template`}
                  onClick={() => setProjectTeamTemplateTarget({ rowId: row.id, partnerId: commonPartnerId })}
                >
                  Применить сохранённый шаблон команды партнёра…
                </Button>
              ) : null}
            </div>}

            {canSeeTeam && <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Команда · {teamMembers.length} чел.</div>
                {row.periods?.some((period: AuditPeriod) => periodTeam(period).length > 0) && (
                  <span className="text-[10px] text-muted-foreground">сохранённый состав восстановлен</span>
                )}
              </div>
              <div className="grid min-h-8 gap-1.5" data-testid={`project-team-management-${row.id}`}>
                {currentTeamMembers.length === 0 && <span className="text-xs text-muted-foreground">Команда ещё не назначена</span>}
                {currentTeamMembers.map((member: CanonicalTeamMember, index: number) => {
                  const memberId = teamMemberId(member);
                  const role = teamRole(member);
                  const unifiedRoleMembers = currentTeamMembers.filter((candidate: CanonicalTeamMember) => teamRole(candidate) === role);
                  const unifiedRoleIndex = unifiedRoleMembers.findIndex((candidate: CanonicalTeamMember) => (
                    memberId ? teamMemberId(candidate) === memberId : teamName(candidate) === teamName(member)
                  ));
                  const editableMember = unifiedRoleIndex >= 0;
                  return (
                    <div key={`${memberId || teamName(member)}-${role}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_2rem] items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-[11px]">
                      <span className="min-w-0 break-words font-medium text-muted-foreground">{projectRoleLabel(role)}</span>
                      <span className="min-w-0 break-words font-semibold">{teamName(member)}</span>
                      {canManageTeam && editableMember && (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50"
                          aria-label={`Убрать ${teamName(member)} из команды проекта`}
                          disabled={savingProjectId === `${row.id}:remove:${memberId || unifiedRoleIndex}`}
                          onClick={() => void removeTeamMember(row, member, unifiedRoleIndex)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {canManageTeam && (
                <div className="grid min-w-0 gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Select value={selectedTeamRole} onValueChange={(value) => setTeamRoleDrafts((current) => ({ ...current, [row.id]: value }))}>
                    <SelectTrigger className="h-9 w-full text-xs" aria-label={`Роль нового участника проекта ${row.name}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEAM_COLUMNS.map((column) => <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <EmployeeSearchAdd
                    employees={assignableEmployees}
                    disabled={savingProjectId === `${row.id}:add:${selectedTeamRole}`}
                    triggerLabel={`Добавить: ${projectRoleLabel(selectedTeamRole)}`}
                    triggerAriaLabel={`Добавить сотрудника в команду проекта ${row.name}`}
                    onPick={(employeeId) => addTeamMember(row, selectedTeamRole, employeeId)}
                    onAddContractor={canManageContractors ? () => openGphAssignment(row.id, selectedTeamRole) : undefined}
                  />
                </div>
              )}
            </div>}
          </div>
        ) : undefined}
        onPoolAmountCommit={(amount) => setBonusPoolAmount(row, amount)}
        onPoolPercentCommit={(percent) => setBonusPercent(row, percent)}
        onResetPoolFormula={() => resetBonusPoolToFormula(row)}
        onEmployeeAmountCommit={(employeeId, amount) => {
          const source = memberSourceById.get(employeeId);
          return source ? setMemberBonusAmount(row, source, amount) : Promise.resolve(false);
        }}
        onResetEmployeeFormula={(employeeId) => {
          const source = memberSourceById.get(employeeId);
          if (!source) return Promise.resolve(false);
          const formulaPercent = Number(source.bonusPercent ?? roleDefaultPercent(teamRole(source))) || 0;
          return setMemberBonusPercent(row, source, formulaPercent);
        }}
      />
    );
  };

  return (
    <div className="relative min-h-screen bg-background" aria-busy={isInitialProjectsLoad}>
      {isInitialProjectsLoad && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Загружаем свод"
          className="absolute inset-0 z-30 flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background/95 px-6 backdrop-blur-sm"
        >
          <div className="flex max-w-sm flex-col items-center rounded-2xl border bg-card px-10 py-9 text-center shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Загружаем свод</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Получаем проекты, команды и показатели. Это может занять несколько секунд.
            </p>
          </div>
        </div>
      )}
      <div className="border-b bg-background">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {isExecutive ? 'CEO-ведомость' : 'Моя работа'}
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Свод</h1>
            </div>
            {canEditProjectDetails && (
              <Button asChild type="button" className="w-full sm:w-auto">
                <Link to="/create-project-procurement">
                  <Plus className="mr-2 h-4 w-4" />
                  Создать проект
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 max-w-full space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        {projectsError && (
          <Card role="alert" className="border-red-200 bg-red-50/60 p-5 dark:bg-red-950/20">
            <div className="font-semibold text-red-800 dark:text-red-200">Свод проектов не загрузился</div>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">Финансовые показатели и бонусы не показываются нулями, потому что исходные данные сейчас недоступны: {projectsError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refreshProjects()}>Повторить загрузку</Button>
          </Card>
        )}

        <Card className="p-3">
          <div className="space-y-4">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5" data-testid="project-primary-filters">
              <ProjectFilterField label="Поиск" className="sm:col-span-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={canSeeTeam ? 'Клиент, проект, партнёр или руководитель' : 'Клиент или проект'}
                    className="pl-9"
                  />
                </div>
              </ProjectFilterField>
              <ProjectFilterField label="Наша компания">
              <Select value={companyFilter} onValueChange={(value) => setCompanyFilter(value as CompanyFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Наша компания" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все наши компании</SelectItem>
                    <SelectItem value="missing">Наша компания не указана</SelectItem>
                    {companyOptions.map((company) => (
                    <SelectItem key={company.key} value={company.key}>
                      {company.name} · {company.count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </ProjectFilterField>
              {canSeeTeam && <ProjectFilterField label="Партнёр">
              <Select value={partnerFilter} onValueChange={(value) => setPartnerFilter(value as PartnerFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Партнер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все партнеры</SelectItem>
                  <SelectItem value="unassigned">Без партнера</SelectItem>
                  {partnerOptions.map((partner) => (
                    <SelectItem key={partner.key} value={partner.key}>
                      {partner.name} · {partner.count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </ProjectFilterField>}
              <ProjectFilterField label="Бизнес-сезон">
              <Select value={businessSeasonFilter} onValueChange={(value) => setBusinessSeasonFilter(value as BusinessSeasonFilter)}>
                <SelectTrigger className="w-full" aria-label="Бизнес-сезон">
                  <SelectValue placeholder="Бизнес-сезон" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все бизнес-сезоны</SelectItem>
                  {businessSeasonOptions.map((season) => (
                    <SelectItem key={season.value} value={season.value}>
                      {season.label} · {season.count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </ProjectFilterField>
              {canSeeContractMoney && <ProjectFilterField label="Сумма договора">
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    aria-label="Сумма договора от"
                    placeholder="От"
                    value={amountFromFilter}
                    onChange={(event) => setAmountFromFilter(event.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    aria-label="Сумма договора до"
                    placeholder="До"
                    value={amountToFilter}
                    onChange={(event) => setAmountToFilter(event.target.value)}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Без НДС · ₸</div>
              </ProjectFilterField>}
              <ProjectFilterField label="Файл договора">
                <Select value={contractFileFilter} onValueChange={(value) => setContractFileFilter(value as ContractFileFilter)}>
                  <SelectTrigger className="w-full" aria-label="Наличие договора">
                    <SelectValue placeholder="Наличие договора" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все проекты</SelectItem>
                    <SelectItem value="uploaded">Договор загружен</SelectItem>
                    <SelectItem value="missing">Договор не загружен</SelectItem>
                  </SelectContent>
                </Select>
              </ProjectFilterField>
              <ProjectFilterField label="Дата с">
              <Input
                type="date"
                aria-label="Дата начала диапазона"
                value={dateFromFilter}
                onChange={(event) => setDateFromFilter(event.target.value)}
                title="Показать проекты, пересекающиеся с начальной датой"
              />
              </ProjectFilterField>
              <ProjectFilterField label="Дата по">
              <Input
                type="date"
                aria-label="Дата окончания диапазона"
                value={dateToFilter}
                onChange={(event) => setDateToFilter(event.target.value)}
                title="Показать проекты, пересекающиеся с конечной датой"
              />
              </ProjectFilterField>
              <ProjectFilterField label="Состояние проекта">
              <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as ProjectViewFilter)}>
                <SelectTrigger className="w-full" aria-label="Состояние проекта">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="working">В работе</SelectItem>
                  <SelectItem value="ready_bonus">Готовы к бонусам</SelectItem>
                  <SelectItem value="closed">Закрытые</SelectItem>
                </SelectContent>
              </Select>
              </ProjectFilterField>
              <ProjectFilterField label="Срок проекта">
              <Select value={deadlineFilter} onValueChange={(value) => setDeadlineFilter(value as ProjectDeadlineFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сроки</SelectItem>
                  <SelectItem value="overdue">Просрочены</SelectItem>
                  <SelectItem value="next_30">Ближайшие 30 дней</SelectItem>
                  <SelectItem value="no_deadline">Без срока</SelectItem>
                </SelectContent>
              </Select>
              </ProjectFilterField>
              {LEGACY_PROJECT_VIEWS_ENABLED && <ProjectFilterField label="Наличие периодов">
              <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as ProjectPeriodFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все периоды</SelectItem>
                  <SelectItem value="has_periods">Есть периоды</SelectItem>
                  <SelectItem value="no_periods">Нет периодов</SelectItem>
                </SelectContent>
              </Select>
              </ProjectFilterField>}
              {LEGACY_PROJECT_VIEWS_ENABLED && <ProjectFilterField label="Тип периода">
              <Select value={auditPeriodTypeFilter} onValueChange={(value) => setAuditPeriodTypeFilter(value as AuditPeriodTypeFilter)}>
                <SelectTrigger className="w-full" aria-label="Тип аудиторского периода">
                  <SelectValue placeholder="Тип периода" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы периода</SelectItem>
                  <SelectItem value="six_months">6 месяцев</SelectItem>
                  <SelectItem value="nine_months">9 месяцев</SelectItem>
                  <SelectItem value="year">Годовой</SelectItem>
                  <SelectItem value="custom">Особый период</SelectItem>
                </SelectContent>
              </Select>
              </ProjectFilterField>}
              <ProjectFilterField label="Сортировка">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as ProjectSort)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline_asc">Сначала ближайшие</SelectItem>
                  <SelectItem value="deadline_desc">Сначала дальние</SelectItem>
                  {canSeeContractMoney && <SelectItem value="amount_desc">Сначала крупные</SelectItem>}
                  {canSeeHours && <SelectItem value="hours_desc">Сначала по часам</SelectItem>}
                  <SelectItem value="default">Без сортировки</SelectItem>
                </SelectContent>
              </Select>
              </ProjectFilterField>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t pt-3" data-testid="project-filter-actions">
              <Button type="button" variant="outline" size="sm" className="h-10" disabled={!primaryFiltersActive} onClick={clearAllProjectFilters}>
                Сбросить все фильтры
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                disabled={filteredRows.length === 0}
                onClick={exportFilteredRows}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Скачать Excel ИТОГО</span>
              </Button>
              <div className="min-w-[220px] text-sm text-muted-foreground sm:ml-auto">
                <div>Строк свода: <span className="font-medium text-foreground tabular-nums">{filteredDisplayRowCount}</span> из <span className="tabular-nums">{totalDisplayRowCount}</span></div>
                <div>Записей в базе: <span className="font-medium text-foreground tabular-nums">{filteredDatabaseRecordCount}</span> из <span className="tabular-nums">{totalDatabaseRecordCount}</span></div>
              </div>
            </div>
          </div>
          {(companyFilter !== 'all' || (canSeeTeam && partnerFilter !== 'all') || businessSeasonFilter !== 'all' || dateFromFilter || dateToFilter) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Сверка:</span>
              {companyFilter !== 'all' && <Badge variant="secondary">Наша компания: {selectedCompanyLabel}</Badge>}
              {canSeeTeam && partnerFilter !== 'all' && <Badge variant="secondary">Партнер: {selectedPartnerLabel}</Badge>}
              {businessSeasonFilter !== 'all' && <Badge variant="secondary">Бизнес-сезон: {selectedBusinessSeasonLabel}</Badge>}
              {(dateFromFilter || dateToFilter) && <Badge variant="secondary">Даты: {dateFromFilter || '…'} — {dateToFilter || '…'}</Badge>}
              <span className="ml-auto text-muted-foreground">
                Строк свода: <span className="font-medium text-foreground tabular-nums">{filteredDisplayRowCount}</span>; записей в базе: <span className="font-medium text-foreground tabular-nums">{filteredDatabaseRecordCount}</span>
              </span>
            </div>
          )}
        </Card>

        {canSelectProjects && selectedProjectIds.size > 0 && (
          <Card className="min-w-0 p-3" data-testid="project-bulk-actions">
            <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button type="button" variant="outline" size="sm" onClick={toggleAllFilteredProjects} disabled={filteredProjectIds.length === 0}>
                {allFilteredProjectsSelected ? 'Снять выбор с записей базы' : `Выбрать записи в базе (${filteredDatabaseRecordCount})`}
              </Button>
              {selectedProjectIds.size > 0 ? (
                <>
                  <Badge variant="secondary">Выбрано записей: {selectedProjectIds.size}</Badge>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProjectIds(new Set())}>
                    Снять весь выбор
                  </Button>
                  {canBulkAssignCompany && (
                    <>
                      <Select value={bulkCompanyId} onValueChange={setBulkCompanyId} disabled={bulkAssigningCompany}>
                        <SelectTrigger className="min-w-0 w-full sm:w-[250px]" aria-label="Выбрать компанию для выбранных проектов">
                          <SelectValue placeholder="Назначить компанию" />
                        </SelectTrigger>
                        <SelectContent>
                          {companyOptions.map((company) => (
                            <SelectItem key={company.key} value={company.key}>{company.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setBulkCompanyAssignOpen(true)}
                        disabled={!bulkCompanyId || bulkAssigningCompany}
                      >
                        Назначить компанию выбранным
                      </Button>
                    </>
                  )}
                  {canBulkAssignPartner && (
                    <>
                      <EmployeeSearchAdd
                        employees={partnerEmployees}
                        disabled={bulkAssigningPartner}
                        selectedEmployeeId={bulkPartnerId}
                        triggerLabel={bulkPartnerId
                          ? employeeName(partnerEmployees.find((partner) => partner.id === bulkPartnerId))
                          : 'Выбрать партнёра'}
                        triggerAriaLabel="Выбрать партнёра для выбранных проектов"
                        triggerTestId="bulk-partner-select"
                        triggerClassName="min-w-0 w-full sm:w-[250px]"
                        onPick={setBulkPartnerId}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setBulkPartnerAssignOpen(true)}
                        disabled={!bulkPartnerId || bulkAssigningPartner}
                      >
                        Назначить только партнёра
                      </Button>
                    </>
                  )}
                  {canBulkAssignTeam && (
                    <>
                      <Select value={bulkTeamTemplateId} onValueChange={setBulkTeamTemplateId} disabled={bulkAssigningTeam}>
                        <SelectTrigger className="min-w-0 w-full sm:w-[290px]" aria-label="Выбрать шаблон команды" data-testid="bulk-team-template-select">
                          <SelectValue placeholder="Применить готовую команду" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamTemplates.length === 0 ? (
                            <SelectItem value="no-team-template" disabled>Нет сохранённых команд</SelectItem>
                          ) : teamTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>{template.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        data-testid="bulk-assign-team"
                        onClick={() => setBulkTeamAssignOpen(true)}
                        disabled={!bulkTeamTemplateId || bulkAssigningTeam}
                      >
                        Применить команду
                      </Button>
                    </>
                  )}
                  {canBulkAssignLeader && (
                    <>
                      <EmployeeSearchAdd
                        employees={assignableEmployees}
                        disabled={bulkAssigningLeader}
                        selectedEmployeeId={bulkLeaderId}
                        triggerLabel={bulkLeaderId
                          ? employeeName(assignableEmployees.find((employee) => employee.id === bulkLeaderId))
                          : 'Выбрать руководителя'}
                        triggerAriaLabel="Выбрать руководителя для выбранных проектов"
                        triggerTestId="bulk-leader-select"
                        triggerClassName="min-w-0 w-full sm:w-[270px]"
                        onPick={setBulkLeaderId}
                      />
                      <Button
                        type="button"
                        size="sm"
                        data-testid="bulk-assign-leader"
                        onClick={() => setBulkLeaderAssignOpen(true)}
                        disabled={!bulkLeaderId || bulkAssigningLeader}
                      >
                        Назначить руководителя
                      </Button>
                    </>
                  )}
                  {canDeleteProjects && (
                    <Button type="button" variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить выбранные
                    </Button>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Отметьте проекты чекбоксами для массового назначения компании, партнёра, готовой команды или руководителя{canDeleteProjects ? ' или удаления' : ''}.
                </span>
              )}
            </div>
          </Card>
        )}

        <div className="min-w-0 overflow-hidden rounded-lg border bg-background" data-testid="project-summary-shell">
          <ProjectTablePagination
            page={safeTablePage}
            pageCount={tablePageCount}
            pageSize={tablePageSize}
            start={tablePageStart}
            end={tablePageEnd}
            total={filteredRows.length}
            onPageChange={setTablePage}
            onPageSizeChange={(value) => {
              setTablePageSize(value);
              setTablePage(1);
            }}
          />
          <table className="w-full table-fixed border-collapse text-sm" aria-label="Единый свод проектов">
            <TableHeader>
              <TableRow className="bg-muted/35 hover:bg-muted/35">
                <TableHead className="h-auto px-3 py-3 sm:px-4">
                  <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-foreground">Единый свод · один проект = одна строка</div>
                      <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                        {canSeeBonusSummary
                          ? 'Договор, компания, вся команда, сроки, часы, статус и бонус каждого находятся внутри одной строки проекта.'
                          : 'Договор, компания, вся команда, сроки, часы и статус находятся внутри одной строки проекта.'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-normal tabular-nums">
                      <span>Проектов: <b className="text-foreground">{executiveSummary.totalProjects}</b></span>
                      <span>В работе: <b className="text-foreground">{executiveSummary.activeProjects}</b></span>
                      <span>Просрочено: <b className={executiveSummary.overdueProjects > 0 ? 'text-red-700' : 'text-foreground'}>{executiveSummary.overdueProjects}</b></span>
                      {canSeeContractMoney && <span>Договоры: <b className="text-foreground">{displayMoney(executiveSummary.contractAmount)}</b></span>}
                      {canSeeBonusSummary && <span>Бонусный пул: <b className="text-foreground">{displayMoney(executiveSummary.plannedBonusPool)}</b></span>}
                      {canSeeBonusSummary && <span>К выплате: <b className="text-amber-700">{displayMoney(executiveSummary.approvedForPayment)}</b></span>}
                      {canSeeBonusSummary && <span>Выплачено: <b className="text-emerald-700">{displayMoney(executiveSummary.paidFromRegistry)}</b></span>}
                    </div>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading && (
                <TableRow><TableCell className="py-12 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Загружаю проекты…</TableCell></TableRow>
              )}
              {!projectsLoading && filteredRows.length === 0 && (
                <TableRow><TableCell className="py-12 text-center text-muted-foreground">{projectsError ? 'Проекты недоступны. Повторите загрузку выше.' : 'По текущим фильтрам проектов нет.'}</TableCell></TableRow>
              )}
              {!projectsLoading && visibleRows.map((row, rowIndex) => (
                <TableRow key={`ledger-${row.id}`} className="align-top hover:bg-background" data-project-id={row.id} data-testid="project-ledger-row">
                  <TableCell className="min-w-0 p-0 align-top">
                    <div className="flex items-center gap-2 border-b bg-muted/15 px-3 py-2 sm:px-4">
                      {canSelectProjects && (
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.has(row.id)}
                          onChange={() => toggleProjectRowSelection(row)}
                          aria-label={`Выбрать проект ${row.name}`}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                      )}
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">Строка {tablePageStart + rowIndex + 1} · ID {String(row.id).slice(0, 8)}</span>
                      {row.contract?.number && <Badge variant="outline" className="ml-auto text-[10px]">Договор № {row.contract.number}</Badge>}
                    </div>
                    {renderProjectInlineDetail(row, false, true)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
          <ProjectTablePagination
            page={safeTablePage}
            pageCount={tablePageCount}
            pageSize={tablePageSize}
            start={tablePageStart}
            end={tablePageEnd}
            total={filteredRows.length}
            onPageChange={(page) => {
              setTablePage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(value) => {
              setTablePageSize(value);
              setTablePage(1);
            }}
          />
        </div>

        {LEGACY_PROJECT_VIEWS_ENABLED && !wideProjectTable && (
        <Card className="min-w-0 overflow-hidden" data-testid="project-summary-shell">
          <div className="border-b bg-sky-50/60 px-3 py-2 text-xs dark:bg-sky-950/20">
            <span className="font-semibold">Проекты:</span> нажмите «Открыть свод» — часы, деньги, команда и бонусы появятся прямо под проектом.
          </div>
          <ProjectTablePagination
            page={safeTablePage}
            pageCount={tablePageCount}
            pageSize={tablePageSize}
            start={tablePageStart}
            end={tablePageEnd}
            total={filteredRows.length}
            onPageChange={setTablePage}
            onPageSizeChange={(value) => {
              setTablePageSize(value);
              setTablePage(1);
            }}
          />
          <div className="min-w-0 space-y-3 p-3">
            {projectsLoading && <div className="py-10 text-center text-sm text-muted-foreground">Загружаю проекты…</div>}
            {!projectsLoading && filteredRows.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">{projectsError ? 'Проекты недоступны. Повторите загрузку в сообщении выше.' : 'По текущим фильтрам проектов нет.'}</div>}
            {!projectsLoading && visibleRows.map((row) => {
              const expanded = Boolean(expandedRows[row.id]);
              const workload = workloadComplexity(row.hours);
              const currentPartner = teamMemberForRole(row.team, isPartnerRole);
              const currentLeader = teamMemberForRole(row.team, isLeaderRole);
              const currentPartnerId = teamMemberId(currentPartner);
              const hasPartnerTeamTemplate = Boolean(currentPartnerId && partnerTeamTemplate(currentPartnerId, row.id)?.length);
              const totalBonusAmount = plannedBonusPool(row);
              const allocatedBonuses = allocatedDraftBonuses(row);
              const closureStatusLabel = row.status === 'pending_payment_approval'
                ? 'Готов к бонусам'
                : row.status === 'ready_to_complete'
                  ? 'Готов к закрытию'
                  : row.readiness.level === 'closed'
                    ? 'Закрыт'
                    : row.readiness.label;
              return (
                <section key={`mobile-${row.id}`} className="min-w-0 overflow-hidden rounded-lg border bg-background" data-project-id={row.id}>
                  <div className="min-w-0 p-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {canSelectProjects && (
                        <input
                          type="checkbox"
                          checked={projectIdsForRow(row).every((projectId) => selectedProjectIds.has(projectId))}
                          onChange={() => toggleProjectRowSelection(row)}
                          aria-label={`Выбрать проект ${row.name}`}
                          className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link to={`/project/${row.id}`} className="block break-words text-sm font-semibold leading-5 hover:underline">{row.name}</Link>
                        <div className="mt-1 break-words text-xs leading-4 text-muted-foreground">{row.company} · {row.client}</div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${issueBadgeClass(row.readiness.level)}`}>{closureStatusLabel}</Badge>
                    </div>

                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs">
                      <div className="min-w-0 rounded-md bg-muted/30 p-2"><div className="text-[10px] uppercase text-muted-foreground">Срок</div><div className="mt-1 break-words font-semibold tabular-nums">{formatDate(row.deadline)}</div><div className="mt-0.5 break-words text-[10px] text-muted-foreground">{row.deadlineState.label}</div></div>
                      {canSeeHours && <div className="min-w-0 rounded-md bg-muted/30 p-2"><div className="text-[10px] uppercase text-muted-foreground">Часы</div><div className="mt-1 font-semibold tabular-nums">{hoursLoading ? 'Загрузка…' : hoursError ? 'Нет данных' : `${workload.total.toFixed(1)} ч`}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{hoursLoading || hoursError ? 'таймшиты сверяются' : `${row.hours.approved.toFixed(1)} утверждено`}</div></div>}
                      {canSeeContractMoney && <div className="min-w-0 rounded-md bg-muted/30 p-2"><div className="text-[10px] uppercase text-muted-foreground">Договор без НДС</div><div className="mt-1 break-words font-semibold tabular-nums">{displayMoney(row.amount)}</div></div>}
                      {canSeeBonusSummary && <div className="min-w-0 rounded-md bg-muted/30 p-2"><div className="text-[10px] uppercase text-muted-foreground">Бонусы</div><div className="mt-1 break-words font-semibold tabular-nums">{displayMoney(totalBonusAmount)}</div><div className="mt-0.5 break-words text-[10px] text-muted-foreground">Распределено {displayMoney(allocatedBonuses)}</div></div>}
                    </div>

                    {canManageTeam && (
                      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                        <div className="min-w-0 space-y-1">
                          <div className="text-[10px] font-medium uppercase text-muted-foreground">Партнёр</div>
                          <EmployeeSearchAdd
                            employees={partnerEmployees}
                            disabled={savingProjectId === `${row.id}:add:partner`}
                            selectedEmployeeId={currentPartnerId}
                            triggerLabel={currentPartner ? teamName(currentPartner) : 'Назначить партнёра'}
                            triggerAriaLabel={`Партнёр проекта ${row.name}`}
                            triggerClassName="h-10 w-full text-xs"
                            onPick={(employeeId) => addTeamMember(row, 'partner', employeeId)}
                          />
                          {hasPartnerTeamTemplate && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto w-full justify-start whitespace-normal px-1 py-1 text-left text-[11px] text-sky-700"
                              disabled={savingProjectId === `${row.id}:team-template`}
                              onClick={() => setProjectTeamTemplateTarget({ rowId: row.id, partnerId: currentPartnerId })}
                            >
                              Применить шаблон команды партнёра…
                            </Button>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="text-[10px] font-medium uppercase text-muted-foreground">Руководитель</div>
                          <EmployeeSearchAdd
                            employees={assignableEmployees}
                            disabled={savingProjectId === `${row.id}:add:project_leader`}
                            selectedEmployeeId={teamMemberId(currentLeader)}
                            triggerLabel={currentLeader ? teamName(currentLeader) : 'Назначить руководителя'}
                            triggerAriaLabel={`Руководитель проекта ${row.name}`}
                            triggerClassName="h-10 w-full text-xs"
                            onPick={(employeeId) => addTeamMember(row, 'project_leader', employeeId)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      {canManageProjectStatus ? (
                        <Select value={statusOptions.some((option) => option.value === row.status) ? row.status : undefined} onValueChange={(value) => setProjectStatus(row, value as ManagedProjectStatus)} disabled={savingProjectId === `${row.id}:status`}><SelectTrigger className="h-10 w-full min-w-0 text-xs" aria-label={`Изменить статус проекта ${row.name}`}><SelectValue placeholder={MANAGED_PROJECT_STATUS_LABELS[row.status as ManagedProjectStatus] || row.status || 'Статус'} /></SelectTrigger><SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value} disabled={(option.value === 'pending_payment_approval' || option.value === 'completed') && (hoursLoading || Boolean(hoursError) || !hoursComplete || row.hours.pending > 0)}>{option.label}</SelectItem>)}</SelectContent></Select>
                      ) : <div className="flex items-center"><Badge variant="outline" className={issueBadgeClass(row.readiness.level)}>{closureStatusLabel}</Badge></div>}
                      <div className="grid grid-cols-2 gap-2">
                        {canEditPeriods && <Button type="button" variant="outline" size="sm" className="h-10 min-w-0 px-2 text-xs" onClick={() => { startProjectDateEdit(row); setExpandedRows({ [row.id]: true }); }}>Сроки</Button>}
                        <Button type="button" variant={expanded ? 'secondary' : 'default'} size="sm" className="h-10 min-w-0 px-2 text-xs" aria-expanded={expanded} aria-controls={`project-details-${row.id}`} onClick={() => toggleRow(row.id)}>
                          {expanded ? 'Свернуть' : 'Открыть свод'} {expanded ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {expanded && (
                    <div className="min-w-0 space-y-3 border-t bg-muted/20 p-2 sm:p-3">
                      {renderProjectInlineDetail(row, false)}
                      {editingProjectDatesRowId === row.id && (
                        <div className="grid min-w-0 gap-2 rounded-lg border bg-background p-3 sm:grid-cols-2">
                          <label className="min-w-0 space-y-1"><span className="text-xs text-muted-foreground">Начало</span><Input aria-label={`Начало проекта ${row.name}`} type="date" className="h-10 w-full min-w-0" value={projectDateDraft.startDate} onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, startDate: event.target.value }))} /></label>
                          <label className="min-w-0 space-y-1"><span className="text-xs text-muted-foreground">Дедлайн</span><Input aria-label={`Дедлайн проекта ${row.name}`} type="date" className="h-10 w-full min-w-0" value={projectDateDraft.deadline} onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, deadline: event.target.value }))} /></label>
                          <Button type="button" size="sm" className="h-10" disabled={savingProjectId === `${row.id}:dates`} onClick={() => saveProjectDates(row)}>Сохранить сроки</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-10" onClick={cancelProjectDateEdit}>Отмена</Button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <ProjectTablePagination
            page={safeTablePage}
            pageCount={tablePageCount}
            pageSize={tablePageSize}
            start={tablePageStart}
            end={tablePageEnd}
            total={filteredRows.length}
            onPageChange={(page) => {
              setTablePage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(value) => {
              setTablePageSize(value);
              setTablePage(1);
            }}
          />
        </Card>
        )}

        {LEGACY_PROJECT_VIEWS_ENABLED && wideProjectTable && (
        <Card className="overflow-x-auto overflow-y-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-sky-50/60 px-3 py-2 text-xs dark:bg-sky-950/20">
            <div><span className="font-semibold">Общая таблица CEO:</span> одна строка — один проект.</div>
            <div className="text-muted-foreground"><span className="font-medium text-foreground">Меняется в строке:</span> партнёр, руководитель, сроки, сумма, статус и % бонуса. Часы, сложность и доход считаются автоматически.</div>
          </div>
          {activeColumnFilters && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2 text-xs">
              <span className="font-medium">Фильтры колонок:</span>
              {Object.entries(columnFilters).filter(([, value]) => value.trim()).map(([key, value]) => (
                <Badge key={key} variant="secondary">{key}: {value}</Badge>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setColumnFilters(EMPTY_COLUMN_FILTERS)}>
                Сбросить фильтры колонок
              </Button>
            </div>
          )}
          <ProjectTablePagination
            page={safeTablePage}
            pageCount={tablePageCount}
            pageSize={tablePageSize}
            start={tablePageStart}
            end={tablePageEnd}
            total={filteredRows.length}
            onPageChange={setTablePage}
            onPageSizeChange={(value) => {
              setTablePageSize(value);
              setTablePage(1);
            }}
          />
          <table className={`${canSeeBonusSummary ? 'min-w-[1460px]' : 'min-w-[1040px]'} w-full caption-bottom text-sm`} aria-label="Общая CEO-таблица проектов">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[72px]">
                  {canSelectProjects && (
                    <input
                      type="checkbox"
                      checked={allFilteredProjectsSelected}
                      onChange={toggleAllFilteredProjects}
                      aria-label="Выбрать все отфильтрованные проекты"
                      title="Выбрать все отфильтрованные проекты"
                      className="h-4 w-4 accent-primary"
                    />
                  )}
                </TableHead>
                <TableHead className="min-w-[260px]">
                  Проект и договор
                  <CommandCenterColumnFilter label="Проект / клиент" value={columnFilters.project} active={!!columnFilters.project} onChange={(value) => setColumnFilter('project', value)} onClear={() => clearColumnFilter('project')} />
                  <CommandCenterColumnFilter label="Наша компания" value={columnFilters.company} active={!!columnFilters.company} onChange={(value) => setColumnFilter('company', value)} onClear={() => clearColumnFilter('company')} />
                  <CommandCenterColumnFilter label="Договор" value={columnFilters.contract} active={!!columnFilters.contract} onChange={(value) => setColumnFilter('contract', value)} onClear={() => clearColumnFilter('contract')} />
                  <CommandCenterColumnFilter label="Предмет договора" value={columnFilters.subject} active={!!columnFilters.subject} onChange={(value) => setColumnFilter('subject', value)} onClear={() => clearColumnFilter('subject')} />
                  <CommandCenterColumnFilter label="Вид услуги" value={columnFilters.service} active={!!columnFilters.service} onChange={(value) => setColumnFilter('service', value)} onClear={() => clearColumnFilter('service')} />
                  <CommandCenterColumnFilter label="Этап" value={columnFilters.stage} active={!!columnFilters.stage} onChange={(value) => setColumnFilter('stage', value)} onClear={() => clearColumnFilter('stage')} />
                </TableHead>
                {canSeeTeam && <TableHead className="min-w-[230px]">
                  Партнёр / руководитель
                  <CommandCenterColumnFilter label="Партнёр" value={columnFilters.partner} active={!!columnFilters.partner} onChange={(value) => setColumnFilter('partner', value)} onClear={() => clearColumnFilter('partner')} />
                  <CommandCenterColumnFilter label="Руководитель" value={columnFilters.leader} active={!!columnFilters.leader} onChange={(value) => setColumnFilter('leader', value)} onClear={() => clearColumnFilter('leader')} />
                </TableHead>}
                <TableHead className="min-w-[190px]">
                  Период / дедлайн
                  <CommandCenterColumnFilter label="Бизнес-сезон" value={columnFilters.season} active={!!columnFilters.season} onChange={(value) => setColumnFilter('season', value)} onClear={() => clearColumnFilter('season')} />
                  <CommandCenterColumnFilter label="Период / дедлайн" value={columnFilters.period} active={!!columnFilters.period} onChange={(value) => setColumnFilter('period', value)} onClear={() => clearColumnFilter('period')} />
                </TableHead>
                {canSeeHours && <TableHead className="min-w-[150px]">
                  Часы / сложность
                  <CommandCenterColumnFilter label="Часы" value={columnFilters.hours} placeholder="Напр. 10-80" active={!!columnFilters.hours} onChange={(value) => setColumnFilter('hours', value)} onClear={() => clearColumnFilter('hours')} />
                </TableHead>}
                {canSeeContractMoney && <TableHead className="min-w-[170px] text-right">Сумма без НДС <CommandCenterColumnFilter label="Сумма договора" value={columnFilters.money} placeholder="Напр. 1000000-5000000" active={!!columnFilters.money} onChange={(value) => setColumnFilter('money', value)} onClear={() => clearColumnFilter('money')} /></TableHead>}
                {canSeeBonusSummary && <TableHead className="min-w-[190px] text-right">Бонусы <CommandCenterColumnFilter label="Бонус" value={columnFilters.bonus} placeholder="Напр. 100000-" active={!!columnFilters.bonus} onChange={(value) => setColumnFilter('bonus', value)} onClear={() => clearColumnFilter('bonus')} /></TableHead>}
                {canSeeGrossIncome && <TableHead className="min-w-[170px] text-right">Грязный доход</TableHead>}
                <TableHead className="min-w-[190px]">Статус / действия <CommandCenterColumnFilter label="Статус" value={columnFilters.status} active={!!columnFilters.status} onChange={(value) => setColumnFilter('status', value)} onClear={() => clearColumnFilter('status')} /><CommandCenterColumnFilter label="Полнота данных" value={columnFilters.completeness} active={!!columnFilters.completeness} onChange={(value) => setColumnFilter('completeness', value)} onClear={() => clearColumnFilter('completeness')} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsLoading && (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="py-10 text-center text-muted-foreground">
                    Загружаю ведомость...
                  </TableCell>
                </TableRow>
              )}
              {!projectsLoading && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="py-10 text-center text-muted-foreground">
                    {projectsError ? 'Проекты недоступны. Повторите загрузку в сообщении выше.' : 'По текущим фильтрам проектов нет.'}
                  </TableCell>
                </TableRow>
              )}
              {!projectsLoading &&
                visibleRows.map((row) => {
                  const expanded = !!expandedRows[row.id];
                  const totalBonusAmount = plannedBonusPool(row);
                  const allocatedBonuses = allocatedDraftBonuses(row);
                  const bonusRemaining = totalBonusAmount - allocatedBonuses;
                  const rowProjectIds = row.projectIds?.length ? row.projectIds : [row.id];
                  const paymentLedger = projectPaymentLedger(rowProjectIds, paymentRegistrySummary.byProject);
                  const groupedBonusRow = rowProjectIds.length > 1;
                  const bonusTeamMembers = row.coverageTeam || row.team || [];
                  const bonusRoleColumns = bonusRoleColumnsForTeam(bonusTeamMembers);
                  const firstBonusRoleByMember = new Map<string, string>();
                  for (const column of bonusRoleColumns) {
                    for (const member of bonusTeamMembers.filter((candidate: CanonicalTeamMember) => teamRole(candidate) === column.key)) {
                      const identity = bonusMemberIdentity(member);
                      if (!firstBonusRoleByMember.has(identity)) firstBonusRoleByMember.set(identity, column.key);
                    }
                  }
                  const compactBonusLockReason = !canEditBonusDraft
                    ? 'Изменять бонусы может только генеральный директор'
                    : row.finances.bonusPoolManuallyAdjusted === true
                      ? 'Пул задан точной суммой. Откройте свод проекта, чтобы изменить сумму или вернуть формулу'
                      : groupedBonusRow || paymentRegistryLoading || paymentRegistryError || paymentLedger.rowCount > 0
                        ? 'Сначала завершите сверку записей и платёжного реестра'
                        : '';
                  const bonusEditingLocked = Boolean(compactBonusLockReason);
                  const workload = workloadComplexity(row.hours);
                  const currentPartner = teamMemberForRole(row.team, isPartnerRole);
                  const currentLeader = teamMemberForRole(row.team, isLeaderRole);
                  const currentPartnerId = teamMemberId(currentPartner);
                  const hasPartnerTeamTemplate = Boolean(currentPartnerId && partnerTeamTemplate(currentPartnerId, row.id)?.length);
                  const commandModel = buildProjectCommandCenterModel(row.project);
                  const closureStatusLabel = row.status === 'pending_payment_approval'
                    ? 'Готов к бонусам'
                    : row.status === 'ready_to_complete'
                      ? 'Готов к закрытию'
                      : row.readiness.level === 'closed'
                        ? 'Закрыт'
                        : 'В работе';
                  return (
                    <Fragment key={row.id}>
                      <TableRow className="align-top hover:bg-muted/35">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1">
                          {canSelectProjects && (
                            <input
                              type="checkbox"
                              checked={projectIdsForRow(row).every((projectId) => selectedProjectIds.has(projectId))}
                              onChange={() => toggleProjectRowSelection(row)}
                              aria-label={`Выбрать проект ${row.name}`}
                              title="Выбрать для массовой операции"
                              className="h-4 w-4 shrink-0 accent-primary"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleRow(row.id)}
                            title={expanded ? 'Свернуть' : 'Раскрыть'}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 align-top">
                          <Link to={`/project/${row.id}`} className="font-semibold leading-snug hover:underline">{row.name}</Link>
                          <div className="mt-1 text-xs text-muted-foreground">{row.client}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[11px]">{row.type}</Badge>
                            {row.contract?.number && <Badge variant="secondary" className="text-[11px]">№ {row.contract.number}</Badge>}
                            {row.contractFiles.length > 0 && <Badge variant="outline" className="text-[11px]">договор ✓</Badge>}
                          </div>
                        </TableCell>
                        {canSeeTeam && <TableCell className="py-3 align-top">
                          <div className="space-y-2">
                            <div>
                              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Партнёр</div>
                              {canManageTeam ? (
                                <div className="space-y-1">
                                  <EmployeeSearchAdd
                                    employees={partnerEmployees}
                                    disabled={savingProjectId === `${row.id}:add:partner`}
                                    selectedEmployeeId={currentPartnerId}
                                    triggerLabel={currentPartner ? teamName(currentPartner) : 'Назначить партнёра'}
                                    triggerAriaLabel={`Партнёр проекта ${row.name}`}
                                    triggerClassName="h-8 w-full text-xs"
                                    onPick={(employeeId) => addTeamMember(row, 'partner', employeeId)}
                                  />
                                  {hasPartnerTeamTemplate && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto w-full justify-start whitespace-normal px-1 py-1 text-left text-[11px] text-sky-700"
                                      disabled={savingProjectId === `${row.id}:team-template`}
                                      onClick={() => setProjectTeamTemplateTarget({ rowId: row.id, partnerId: currentPartnerId })}
                                    >
                                      Применить шаблон команды…
                                    </Button>
                                  )}
                                </div>
                              ) : <div className="font-medium">{currentPartner ? teamName(currentPartner) : '—'}</div>}
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Руководитель</div>
                              {canManageTeam ? (
                                <EmployeeSearchAdd
                                  employees={assignableEmployees}
                                  disabled={savingProjectId === `${row.id}:add:project_leader`}
                                  selectedEmployeeId={teamMemberId(currentLeader)}
                                  triggerLabel={currentLeader ? teamName(currentLeader) : 'Назначить руководителя'}
                                  triggerAriaLabel={`Руководитель проекта ${row.name}`}
                                  triggerClassName="h-8 w-full text-xs"
                                  onPick={(employeeId) => addTeamMember(row, 'project_leader', employeeId)}
                                />
                              ) : <div className="font-medium">{currentLeader ? teamName(currentLeader) : '—'}</div>}
                            </div>
                          </div>
                        </TableCell>}
                        <TableCell className="py-3 align-top">
                          <div className="font-medium tabular-nums">{formatDate(row.startDate)} — {formatDate(row.deadline)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{row.periods.length > 0 ? row.periods.map((period: AuditPeriod) => period.name).slice(0, 2).join(', ') : 'Период не указан'}</div>
                          <Badge variant="outline" className={`mt-2 ${deadlineBadgeClass(row.deadlineState.tone)}`}>{row.deadlineState.label}</Badge>
                          {canEditPeriods && <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={() => { startProjectDateEdit(row); setExpandedRows((current) => ({ ...current, [row.id]: true })); }}>Изменить сроки</Button>}
                        </TableCell>
                        {canSeeHours && <TableCell className="py-3 align-top">
                          {hoursLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Загрузка часов</div>
                          ) : hoursError ? (
                            <div className="text-sm font-medium text-red-700">Часы недоступны</div>
                          ) : (
                            <>
                              <div className="text-lg font-semibold tabular-nums">{workload.total.toFixed(1)} ч</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{row.hours.approved.toFixed(1)} утверждено</div>
                              {row.hours.pending > 0 && <div className="text-xs font-medium text-amber-700">{row.hours.pending.toFixed(1)} ждут</div>}
                              <Badge variant="outline" className={`mt-2 ${workload.className}`}>Сложность: {workload.label}</Badge>
                            </>
                          )}
                        </TableCell>}
                        {canSeeContractMoney && (
                          <TableCell className="py-3 text-right align-top">
                            {editingContractAmountRowId === row.id ? (
                              <div className="ml-auto w-[160px] space-y-1.5"><Input aria-label={`Сумма договора ${row.name}`} inputMode="numeric" className="h-8 text-right" value={contractAmountDraft} onChange={(event) => setContractAmountDraft(event.target.value)} autoFocus /><div className="flex justify-end gap-1"><Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => saveContractAmount(row)}>Сохранить</Button><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={cancelContractAmountEdit}>Отмена</Button></div></div>
                            ) : <><div className="text-base font-semibold tabular-nums">{displayMoney(row.amount)}</div>{canEditContractAmount && <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={() => startContractAmountEdit(row)}>Изменить</Button>}</>}
                          </TableCell>
                        )}
                        {canSeeBonusSummary && (
                          <TableCell className="py-3 text-right align-top">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Плановый пул</div>
                            <div className="font-semibold tabular-nums">{displayMoney(totalBonusAmount)}</div>
                            {groupedBonusRow && <div className="text-[10px] font-medium text-amber-700">основная из {rowProjectIds.length} записей</div>}
                            <div className="mt-1 text-xs text-muted-foreground">Распределено: <span className="font-medium text-foreground">{displayMoney(allocatedBonuses)}</span></div>
                            <div className={`text-xs ${bonusRemaining < -1 ? 'font-medium text-red-700' : 'text-muted-foreground'}`}>Остаток: {displayMoney(bonusRemaining)}</div>
                            {paymentRegistryLoading ? (
                              <div className="mt-1 text-xs text-muted-foreground">Сверяем реестр выплат…</div>
                            ) : paymentRegistryError ? (
                              <div className="mt-1 text-xs font-medium text-red-700">Реестр выплат недоступен</div>
                            ) : (
                              <>
                                {paymentLedger.approvedUnpaidAmount > 0 && <div className="mt-1 text-xs font-medium text-amber-700">К выплате: {displayMoney(paymentLedger.approvedUnpaidAmount)}</div>}
                                {paymentLedger.paidAmount > 0 && <div className="text-xs font-medium text-emerald-700">Выплачено: {displayMoney(paymentLedger.paidAmount)}</div>}
                              </>
                            )}
                            <div className="mt-2 flex items-center justify-end gap-1" title={compactBonusLockReason || undefined}><Button type="button" variant="outline" size="icon" className="h-6 w-6" disabled={savingProjectId === row.id || bonusEditingLocked} onClick={() => setBonusPercent(row, Number(row.finances.bonusPercent || 0) - 1)} aria-label={`Уменьшить процент бонуса для ${row.name}`}><Minus className="h-3 w-3" /></Button><span className="w-10 text-center text-xs font-semibold tabular-nums">{Number(row.finances.bonusPercent || 0).toFixed(0)}%</span><Button type="button" variant="outline" size="icon" className="h-6 w-6" disabled={savingProjectId === row.id || bonusEditingLocked} onClick={() => setBonusPercent(row, Number(row.finances.bonusPercent || 0) + 1)} aria-label={`Увеличить процент бонуса для ${row.name}`}><Plus className="h-3 w-3" /></Button></div>
                            <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={() => openBonusWorkspace(row.id)}>По сотрудникам</Button>
                          </TableCell>
                        )}
                        {canSeeGrossIncome && <TableCell className="py-3 text-right align-top"><div className={`text-base font-semibold tabular-nums ${Number(row.finances.grossProfit) < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{displayMoney(row.finances.grossProfit)}</div><div className="mt-1 text-xs text-muted-foreground">после ГПХ, предрасхода и распределённых бонусов</div></TableCell>}
                        <TableCell className="py-3 align-top">
                          <div className="space-y-2">
                            {canManageProjectStatus ? (
                              <Select value={statusOptions.some((option) => option.value === row.status) ? row.status : undefined} onValueChange={(value) => setProjectStatus(row, value as ManagedProjectStatus)} disabled={savingProjectId === `${row.id}:status`}><SelectTrigger className="h-8 w-full text-xs" aria-label={`Изменить статус проекта ${row.name}`}><SelectValue placeholder={MANAGED_PROJECT_STATUS_LABELS[row.status as ManagedProjectStatus] || row.status || 'Статус'} /></SelectTrigger><SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value} disabled={(option.value === 'pending_payment_approval' || option.value === 'completed') && (hoursLoading || Boolean(hoursError) || !hoursComplete || row.hours.pending > 0)}>{option.label}</SelectItem>)}</SelectContent></Select>
                            ) : <Badge variant="outline" className={issueBadgeClass(row.readiness.level)}>{closureStatusLabel}</Badge>}
                            {row.readiness.issues.length > 0 && row.readiness.level !== 'closed' && <div className="text-xs leading-snug text-amber-700">{row.readiness.issues.slice(0, 2).join(' · ')}</div>}
                            <div className="flex flex-wrap gap-1"><Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleRow(row.id)}>{expanded ? 'Свернуть' : 'Подробнее'}</Button><Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"><Link to={`/project/${row.id}`}>Открыть <ExternalLink className="ml-1 h-3 w-3" /></Link></Button></div>
                            {canCloseProjects && row.readiness.level !== 'closed' && <Button type="button" variant="outline" size="sm" className="h-7 w-full px-2 text-xs" disabled={savingProjectId === `${row.id}:close` || hoursLoading || Boolean(hoursError) || !hoursComplete || row.hours.pending > 0} title={hoursLoading || hoursError || !hoursComplete ? 'Сначала завершите сверку таймшитов' : row.hours.pending > 0 ? 'Есть часы на утверждении' : undefined} onClick={() => closeProjectRow(row)}><CheckCircle2 className="mr-1 h-3 w-3" />Закрыть проект</Button>}
                            {canDeleteProjects && <Button type="button" variant="ghost" size="sm" className="h-7 w-full px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" disabled={savingProjectId === `${row.id}:delete`} onClick={() => deleteProjectRow(row)}><Trash2 className="mr-1 h-3 w-3" />Удалить</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${row.id}-details`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={tableColSpan} className="p-0">
                            <div className="space-y-4 border-t px-4 py-4">
                              {renderProjectInlineDetail(row)}
                              {editingProjectDatesRowId === row.id && (
                                <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-background px-4 py-3">
                                  <label className="min-w-0 flex-1 space-y-1 sm:flex-none"><span className="text-xs text-muted-foreground">Начало</span><Input aria-label={`Начало проекта ${row.name}`} type="date" className="h-10" value={projectDateDraft.startDate} onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, startDate: event.target.value }))} /></label>
                                  <label className="min-w-0 flex-1 space-y-1 sm:flex-none"><span className="text-xs text-muted-foreground">Дедлайн</span><Input aria-label={`Дедлайн проекта ${row.name}`} type="date" className="h-10" value={projectDateDraft.deadline} onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, deadline: event.target.value }))} /></label>
                                  <Button type="button" size="sm" className="h-10" disabled={savingProjectId === `${row.id}:dates`} onClick={() => saveProjectDates(row)}>Сохранить сроки</Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-10" onClick={cancelProjectDateEdit}>Отмена</Button>
                                </div>
                              )}
                              {advancedRows[row.id] && (
                                <div className="flex flex-col gap-4">
                                  <ProjectDataIntegrityDrawer model={commandModel} canRepair={canManageTeam || canManageProjectStatus} />
                              <div className="rounded-md border bg-background">
                                <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                                  <div className="text-sm font-semibold">Сроки и периоды</div>
                                  {canEditPeriods && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8"
                                      onClick={() => addingPeriodRowId === row.id ? cancelAddPeriod() : startAddPeriod(row)}
                                    >
                                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                                      Добавить период
                                    </Button>
                                  )}
                                </div>
                                <div className="grid gap-3 p-3 md:grid-cols-[220px_1fr]">
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <div className="text-xs text-muted-foreground">Срок проекта</div>
                                      {editingProjectDatesRowId === row.id ? (
                                        <div className="mt-1 space-y-2 rounded-md border bg-muted/20 p-2">
                                          <div className="grid gap-2">
                                            <label className="space-y-1">
                                              <span className="text-xs text-muted-foreground">Начало</span>
                                              <Input
                                                aria-label={`Начало проекта ${row.name}`}
                                                type="date"
                                                className="h-8"
                                                value={projectDateDraft.startDate}
                                                onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, startDate: event.target.value }))}
                                              />
                                            </label>
                                            <label className="space-y-1">
                                              <span className="text-xs text-muted-foreground">Дедлайн</span>
                                              <Input
                                                aria-label={`Дедлайн проекта ${row.name}`}
                                                type="date"
                                                className="h-8"
                                                value={projectDateDraft.deadline}
                                                onChange={(event) => setProjectDateDraft((draft) => ({ ...draft, deadline: event.target.value }))}
                                              />
                                            </label>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <Button
                                              type="button"
                                              size="sm"
                                              className="h-8"
                                              disabled={savingProjectId === `${row.id}:dates`}
                                              onClick={() => saveProjectDates(row)}
                                            >
                                              Сохранить сроки
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="h-8" onClick={cancelProjectDateEdit}>
                                              Отмена
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="font-medium">{formatDate(row.startDate)} - {formatDate(row.deadline)}</div>
                                          {canEditPeriods && (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-7 px-2 text-xs"
                                              onClick={() => startProjectDateEdit(row)}
                                            >
                                              Изменить сроки
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Дедлайн</div>
                                      <Badge variant="outline" className={deadlineBadgeClass(row.deadlineState.tone)}>
                                        {row.deadlineState.label}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {canEditPeriods && addingPeriodRowId === row.id && (
                                      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3">
                                        <div className="grid gap-2 md:grid-cols-5">
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Название периода</div>
                                            <Input
                                              value={newPeriodDraft.name}
                                              onChange={(event) => setNewPeriodDraft((draft) => ({ ...draft, name: event.target.value }))}
                                              placeholder="Например: 2024"
                                              className="h-8"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Вид аудита</div>
                                            <Select value={newPeriodDraft.type} onValueChange={(value) => setNewPeriodDraft((draft) => ({ ...draft, type: value as AuditPeriod['type'] }))}>
                                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="six_months">6 месяцев</SelectItem>
                                                <SelectItem value="nine_months">9 месяцев</SelectItem>
                                                <SelectItem value="year">Годовой</SelectItem>
                                                <SelectItem value="custom">Особый период</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Начало</div>
                                            <Input
                                              type="date"
                                              value={newPeriodDraft.startDate}
                                              onChange={(event) => setNewPeriodDraft((draft) => ({ ...draft, startDate: event.target.value }))}
                                              className="h-8"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Конец</div>
                                            <Input
                                              type="date"
                                              value={newPeriodDraft.endDate}
                                              onChange={(event) => setNewPeriodDraft((draft) => ({ ...draft, endDate: event.target.value }))}
                                              className="h-8"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Дедлайн</div>
                                            <Input
                                              type="date"
                                              value={newPeriodDraft.deadline}
                                              onChange={(event) => setNewPeriodDraft((draft) => ({ ...draft, deadline: event.target.value }))}
                                              className="h-8"
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8"
                                            onClick={cancelAddPeriod}
                                          >
                                            Отмена
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-8"
                                            disabled={savingProjectId === `${row.id}:period:add`}
                                            onClick={() => addPeriod(row)}
                                          >
                                            Сохранить период
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    {row.periods.length === 0 && (
                                      <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                        Периоды не указаны.
                                      </div>
                                    )}
                                    {row.periods.map((period: AuditPeriod) => {
                                      const team = periodTeam(period);
                                      const teamSource = period.teamSource;
                                      const periodHasOwnTeam = teamSource === 'period';
                                      return (
                                        <div key={period.id} className="rounded-md border bg-muted/10 px-3 py-3 text-sm">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                              {editingPeriodId === period.id ? (
                                                <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2">
                                                  <Input
                                                    value={periodNameDraft}
                                                    onChange={(event) => setPeriodNameDraft(event.target.value)}
                                                    onKeyDown={(event) => {
                                                      if (event.key === 'Enter') savePeriodName(row, period, periodNameDraft);
                                                      if (event.key === 'Escape') {
                                                        setEditingPeriodId(null);
                                                        setPeriodNameDraft('');
                                                      }
                                                    }}
                                                    className="h-8 min-w-[220px] max-w-[420px] text-sm font-semibold"
                                                    autoFocus
                                                  />
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    className="h-8"
                                                    disabled={savingProjectId === `${row.id}:${period.id}:name`}
                                                    onClick={() => savePeriodName(row, period, periodNameDraft)}
                                                  >
                                                    Сохранить
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={() => {
                                                      setEditingPeriodId(null);
                                                      setPeriodNameDraft('');
                                                    }}
                                                  >
                                                    Отмена
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div className="flex min-w-0 items-center gap-2">
                                                  <div className="truncate text-base font-semibold leading-tight">{period.name}</div>
                                                  {canEditPeriods && (
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-7 shrink-0 px-2 text-xs"
                                                      onClick={() => {
                                                        setEditingPeriodId(period.id);
                                                        setPeriodNameDraft(period.name || '');
                                                      }}
                                                    >
                                                      Изменить
                                                    </Button>
                                                  )}
                                                </div>
                                              )}
                                              <Badge variant="outline" className={periodStatusBadgeClass(period.status)}>
                                                {periodStatusLabel(period.status)}
                                              </Badge>
                                              <Badge variant="secondary" className="text-[11px]">
                                                {auditPeriodTypeLabel(period.type)}
                                              </Badge>
                                              <Badge variant={periodHasOwnTeam ? 'default' : 'outline'} className="text-[11px]">
                                                {periodHasOwnTeam ? 'своя команда периода' : 'не распределено'}
                                              </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                              <div className="text-xs text-muted-foreground">
                                                {periodLabel(period)}
                                                {period.deadline ? ` · дедлайн ${formatDate(period.deadline)}` : ''}
                                              </div>
                                              {canEditPeriods && (
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-7 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                                  disabled={savingProjectId === `${row.id}:${period.id}:delete`}
                                                  onClick={() => deletePeriod(row, period)}
                                                >
                                                  Удалить
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                          <div className="mt-3 grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-2 xl:grid-cols-5">
                                            {TEAM_COLUMNS.map((column) => {
                                              const members = team.filter((member: any) => teamRole(member) === column.key);
                                              const isKeyColumn = isPartnerRole(column.key) || isLeaderRole(column.key);
                                              return (
                                                <div
                                                  key={`${period.id}-${column.key}`}
                                                  className={`min-h-[104px] p-2 ${isKeyColumn ? 'bg-sky-500/5 ring-1 ring-inset ring-sky-500/20' : 'bg-background'}`}
                                                >
                                                  <div className="mb-2 flex items-center justify-between gap-2">
                                                    <div className={`text-xs font-semibold ${isKeyColumn ? 'text-sky-700 dark:text-sky-300' : ''}`}>
                                                      {column.label}
                                                    </div>
                                                    {canSeeBonusSummary && <div className="text-[11px] text-muted-foreground">{column.percent}</div>}
                                                  </div>
                                                  {members.length === 0 && canManageTeam && (
                                                    <EmployeeSearchAdd
                                                      employees={assignableEmployees}
                                                      disabled={savingProjectId === `${row.id}:${period.id}:add:${column.key}`}
                                                      onPick={(employeeId) => addPeriodTeamMember(row, period, column.key, employeeId)}
                                                      onAddContractor={canManageContractors ? () => openGphAssignment(row.id, column.key, period.id) : undefined}
                                                    />
                                                  )}
                                                  {members.length === 0 && !canManageTeam && (
                                                    <div className="text-xs text-muted-foreground">-</div>
                                                  )}
                                                  <div className="space-y-2">
                                                    {members.map((member: any, memberIndex: number) => {
                                                      const memberId = teamMemberId(member);
                                                      return (
                                                        <div key={`${period.id}-${column.key}-${memberId || teamName(member)}-${memberIndex}`} className="rounded-md border bg-muted/20 px-2 py-2">
                                                          <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 font-medium leading-snug">{teamName(member)}</div>
                                                            {canManageTeam && (
                                                              <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 shrink-0 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                disabled={savingProjectId === `${row.id}:${period.id}:remove:${memberId || memberIndex}`}
                                                                onClick={() => removePeriodTeamMember(row, period, member, memberIndex)}
                                                              >
                                                                Убрать
                                                              </Button>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-md border bg-background">
                                <div className="border-b px-3 py-2 text-sm font-semibold">Договор</div>
                                <div className="grid gap-3 p-3 md:grid-cols-[260px_1fr]">
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <div className="text-xs text-muted-foreground">Номер / дата</div>
                                      <div className="font-medium">
                                        {row.contract?.number || 'не указан'}
                                        {row.contract?.date ? ` от ${formatDate(row.contract.date)}` : ''}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Сумма без НДС</div>
                                      {editingContractAmountRowId === row.id ? (
                                        <div className="mt-1 space-y-2 rounded-md border bg-muted/20 p-2">
                                          <Input
                                            aria-label={`Сумма договора ${row.name}`}
                                            inputMode="numeric"
                                            className="h-8"
                                            value={contractAmountDraft}
                                            onChange={(event) => setContractAmountDraft(event.target.value)}
                                            placeholder="Напр. 15000000"
                                          />
                                          <div className="flex flex-wrap gap-2">
                                            <Button
                                              type="button"
                                              size="sm"
                                              className="h-8"
                                              disabled={savingProjectId === `${row.id}:amount`}
                                              onClick={() => saveContractAmount(row)}
                                            >
                                              Сохранить сумму
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="h-8" onClick={cancelContractAmountEdit}>
                                              Отмена
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="font-medium tabular-nums">
                                            {Number(row.contract?.amountWithoutVAT || row.amount || 0) > 0
                                              ? `${money.format(Number(row.contract?.amountWithoutVAT || row.amount || 0))} ₸`
                                              : 'не указана'}
                                          </div>
                                          {canEditContractAmount && (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-7 px-2 text-xs"
                                              onClick={() => startContractAmountEdit(row)}
                                            >
                                              Изменить сумму
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Файлы договора</div>
                                    {row.contractFiles.length === 0 && (
                                      <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                                        Файлы договора не загружены.
                                      </div>
                                    )}
                                    {row.contractFiles.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {row.contractFiles.map((file: any, index: number) => {
                                          const url = contractFileUrl(file);
                                          const label = file?.fileName || file?.name || `Файл ${index + 1}`;
                                          const sourcePath = String(file?.storagePath || file?.path || url || '').replace(/^seafile:\/\//, '');
                                          const fileKey = `${row.id}:${file?.id || label}-${index}`;
                                          return url ? (
                                            <div key={fileKey} className="flex max-w-full flex-col gap-1 rounded-md border bg-muted/20 p-2">
                                              <div className="flex flex-wrap gap-1">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-auto min-h-8 justify-start whitespace-normal text-left"
                                                  disabled={openingFileKey === `open:${fileKey}`}
                                                  onClick={() => void openContractFile(file, label, fileKey, 'open')}
                                                >
                                                  {openingFileKey === `open:${fileKey}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                                                  Открыть договор: {label}
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-auto min-h-8"
                                                  disabled={openingFileKey === `download:${fileKey}`}
                                                  onClick={() => void openContractFile(file, label, fileKey, 'download')}
                                                  aria-label={`Скачать договор: ${label}`}
                                                  title="Скачать договор"
                                                >
                                                  {openingFileKey === `download:${fileKey}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                                                  Скачать
                                                </Button>
                                              </div>
                                              {sourcePath && <div className="max-w-[360px] truncate text-[11px] text-muted-foreground" title={sourcePath}>Источник: {sourcePath}</div>}
                                            </div>
                                          ) : (
                                            <Badge key={`${label}-${index}`} variant="outline">
                                              {label}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {row.contract?.subject && (
                                      <div className="text-xs text-muted-foreground">
                                        {row.contract.subject}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {SHOW_LEGACY_BONUS_WORKSPACE && canSeeBonusSummary && (
                                <div className="order-first grid gap-3 md:grid-cols-4 xl:grid-cols-10">
                                  <MetricBox label="Сумма без НДС" value={`${money.format(row.amount)} ₸`} />
                                  <MetricBox label="Плановый бонусный пул" value={`${money.format(totalBonusAmount)} ₸`} />
                                  <MetricBox label="Распределено команде" value={`${money.format(allocatedBonuses)} ₸`} />
                                  <MetricBox label="Остаток пула" value={`${money.format(bonusRemaining)} ₸`} />
                                  <MetricBox label="Утверждено к выплате" value={paymentRegistryLoading ? 'Загрузка…' : paymentRegistryError ? 'Нет данных' : `${money.format(paymentLedger.approvedUnpaidAmount)} ₸`} />
                                  <MetricBox label="Фактически выплачено" value={paymentRegistryLoading ? 'Загрузка…' : paymentRegistryError ? 'Нет данных' : `${money.format(paymentLedger.paidAmount)} ₸`} />
                                  <MetricBox label="ГПХ" value={`${money.format(Number(row.finances.totalContractorsAmount) || 0)} ₸`} />
                                  <MetricBox label="Предрасход" value={`${money.format(Number(row.finances.preExpenseAmount) || 0)} ₸`} />
                                  <MetricBox label="База" value={`${money.format(Number(row.finances.bonusBase) || 0)} ₸`} />
                                  <MetricBox label="Грязный доход" value={`${money.format(Number(row.finances.grossProfit) || 0)} ₸`} />
                                </div>
                              )}

                              {SHOW_LEGACY_BONUS_WORKSPACE && canSeeBonusSummary && (
                              <div id={`bonus-workspace-${row.id}`} className="order-first scroll-mt-4 rounded-md border bg-background" aria-label={`Бонусы команды проекта ${row.name}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-3">
                                  <div>
                                    <div className="text-sm font-semibold">Расчёт бонусов по сотрудникам</div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Укажите итоговую сумму для каждого участника. Это распределение проекта; выплата считается фактом только после записи в платёжном реестре.</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-3">
                                    <div><div className="text-muted-foreground">Пул</div><div className="font-semibold tabular-nums">{displayMoney(totalBonusAmount)}</div></div>
                                    <div><div className="text-muted-foreground">Распределено</div><div className="font-semibold tabular-nums">{displayMoney(allocatedBonuses)}</div></div>
                                    <div><div className="text-muted-foreground">Остаток</div><div className={`font-semibold tabular-nums ${bonusRemaining < -1 ? 'text-red-700' : ''}`}>{displayMoney(bonusRemaining)}</div></div>
                                    {paymentRegistryLoading ? (
                                      <div className="col-span-2 text-muted-foreground">Сверяем платёжный реестр…</div>
                                    ) : paymentRegistryError ? (
                                      <div className="col-span-2 font-medium text-red-700">Реестр выплат недоступен</div>
                                    ) : (
                                      <>
                                        <div><div className="text-muted-foreground">К выплате</div><div className="font-semibold tabular-nums text-amber-700">{displayMoney(paymentLedger.approvedUnpaidAmount)}</div></div>
                                        <div><div className="text-muted-foreground">Выплачено</div><div className="font-semibold tabular-nums text-emerald-700">{displayMoney(paymentLedger.paidAmount)}</div></div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {groupedBonusRow && (
                                  <div className="border-b border-amber-200 bg-amber-50/70 px-3 py-3 text-xs text-amber-900 dark:bg-amber-950/20">
                                    <div className="font-semibold">Объединено записей: {rowProjectIds.length}. Редактирование бонусов заблокировано до выбора канонической записи.</div>
                                    <div className="mt-1">Платёжный реестр ниже собран по всем записям, а плановый пул относится к основной записи. Откройте нужную запись отдельно:</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(row.duplicateRows || []).map((duplicate: any, index: number) => (
                                        <Button key={duplicate.id} asChild variant="outline" size="sm" className="h-7 bg-background text-xs">
                                          <Link to={`/project/${duplicate.id}`}>Запись {index + 1} · {String(duplicate.id).slice(0, 8)}</Link>
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {!groupedBonusRow && !paymentRegistryLoading && !paymentRegistryError && (paymentLedger.approvedUnpaidAmount > 0 || paymentLedger.paidAmount > 0) && (
                                  <div className="border-b border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/20">
                                    Расчёт зафиксирован в платёжном реестре. Для изменения нужна отдельная ревизия или корректировка; текущий черновик заблокирован.
                                  </div>
                                )}
                                {(row.coverageTeam || row.team).length === 0 && (
                                  <div className="px-3 py-4 text-sm text-muted-foreground">Сначала назначьте команду проекта — здесь появятся персональные бонусы.</div>
                                )}
                                <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-5">
                                  {bonusRoleColumns.filter((column) => bonusTeamMembers.some((member: CanonicalTeamMember) => teamRole(member) === column.key)).map((column) => {
                                    const members = bonusTeamMembers.filter((member: CanonicalTeamMember) => teamRole(member) === column.key);
                                    const isKeyColumn = isPartnerRole(column.key) || isLeaderRole(column.key);
                                    return (
                                      <div
                                        key={column.key}
                                        className={`p-3 ${isKeyColumn ? 'bg-sky-500/5 ring-1 ring-inset ring-sky-500/20' : 'bg-background'}`}
                                      >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                          <div className={`font-medium ${isKeyColumn ? 'text-sky-700 dark:text-sky-300' : ''}`}>{column.label}</div>
                                          {canSeeBonusSummary && <div className="text-xs text-muted-foreground">{column.percent}</div>}
                                        </div>
                                        {members.length === 0 && !canManageTeam && <div className="text-sm text-muted-foreground">-</div>}
                                        {members.length === 0 && canManageTeam && (
                                          <EmployeeSearchAdd
                                            employees={assignableEmployees}
                                            disabled={savingProjectId === `${row.id}:add:${column.key}`}
                                            onPick={(employeeId) => addTeamMember(row, column.key, employeeId)}
                                            onAddContractor={canManageContractors ? () => openGphAssignment(row.id, column.key) : undefined}
                                          />
                                        )}
                                        <div className="space-y-2">
                                          {members.map((member: CanonicalTeamMember, memberIndex: number) => {
                                            const memberId = teamMemberId(member);
                                            const memberIdentity = bonusMemberIdentity(member);
                                            const primaryBonusRole = firstBonusRoleByMember.get(memberIdentity) || column.key;
                                            const isPrimaryBonusEditor = primaryBonusRole === column.key;
                                            const memberRoleLabels = Array.from(new Set(
                                              bonusTeamMembers
                                                .filter((candidate: CanonicalTeamMember) => bonusMemberIdentity(candidate) === memberIdentity)
                                                .map((candidate: CanonicalTeamMember) => projectRoleLabel(teamRole(candidate))),
                                            ));
                                            const percent = memberBonusPercent(member, row.finances);
                                            const amount = memberBonusAmount(member, row.finances);
                                            const canRemoveMember = canManageTeam && row.team.some((item: CanonicalTeamMember) => (
                                              teamMemberId(item) === memberId && teamRole(item) === teamRole(member)
                                            ));
                                            const savingMember = savingProjectId === `${row.id}:${memberId}`;
                                            const manuallyAdjusted = Boolean(memberId && row.finances.teamBonuses?.[memberId]?.manuallyAdjusted);
                                            const memberLedger = memberId
                                              ? memberPaymentLedger(rowProjectIds, memberId, paymentRegistrySummary.byKey)
                                              : { approvedUnpaidAmount: 0, paidAmount: 0, pendingAmount: 0, rowCount: 0, latestPaymentDate: null };
                                            const memberProjectHours = memberId
                                              ? (row.projectIds || [row.id]).reduce(
                                                (acc: ProjectHoursTotals, projectId: string) => {
                                                  const value = memberHours.get(hoursPairKey(memberId, projectId)) || { approved: 0, pending: 0 };
                                                  return {
                                                    approved: acc.approved + Number(value.approved || 0),
                                                    pending: acc.pending + Number(value.pending || 0),
                                                  };
                                                },
                                                { approved: 0, pending: 0 },
                                              )
                                              : { approved: 0, pending: 0 };
                                            return (
                                              <div key={`${memberId || teamName(member)}-${memberIndex}`} className="rounded-md border px-2 py-2">
                                                <div className="flex items-start justify-between gap-2">
                                                  <div className="font-medium leading-snug">{teamName(member)}</div>
                                                  {canRemoveMember && (
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      className="h-7 shrink-0 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                                      disabled={savingProjectId === `${row.id}:remove:${memberId || memberIndex}` || bonusEditingLocked}
                                                      onClick={() => removeTeamMember(row, member, memberIndex)}
                                                    >
                                                      Убрать
                                                    </Button>
                                                  )}
                                                </div>
                                                {memberRoleLabels.length > 1 && (
                                                  <div className="mt-1 text-[11px] text-muted-foreground">Роли: {memberRoleLabels.join(', ')}</div>
                                                )}
                                                {hoursLoading ? (
                                                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Часы загружаются</div>
                                                ) : hoursError ? (
                                                  <div className="mt-1 text-xs font-medium text-red-700">Часы недоступны</div>
                                                ) : (
                                                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                    <span className="tabular-nums">{memberProjectHours.approved.toFixed(1)} ч утверждено</span>
                                                    {memberProjectHours.pending > 0 && (
                                                      <span className="font-medium text-amber-700 tabular-nums">
                                                        {memberProjectHours.pending.toFixed(1)} ч ждут
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                  {!isPrimaryBonusEditor ? (
                                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Единая выплата редактируется в роли «{projectRoleLabel(primaryBonusRole)}»</Badge>
                                                  ) : (
                                                    <>
                                                      <Badge variant="outline" className="text-[10px]">{manuallyAdjusted ? 'Сумма задана вручную' : 'По формуле'}</Badge>
                                                      {paymentRegistryLoading ? (
                                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Реестр загружается</Badge>
                                                      ) : paymentRegistryError ? (
                                                        <Badge variant="outline" className="border-red-200 text-[10px] text-red-700">Статус выплаты недоступен</Badge>
                                                      ) : (
                                                        <>
                                                          {memberLedger.approvedUnpaidAmount > 0 && <Badge variant="outline" className="border-amber-200 text-[10px] text-amber-700">К выплате {displayMoney(memberLedger.approvedUnpaidAmount)}</Badge>}
                                                          {memberLedger.paidAmount > 0 && <Badge variant="outline" className="border-emerald-200 text-[10px] text-emerald-700">Выплачено {displayMoney(memberLedger.paidAmount)}</Badge>}
                                                          {memberLedger.rowCount === 0 && <Badge variant="outline" className="text-[10px] text-muted-foreground">Не в реестре</Badge>}
                                                        </>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                                {canSeeBonusSummary && isPrimaryBonusEditor && (
                                                  <div className="mt-2 flex items-center justify-between gap-2">
                                                    <div className="text-xs text-muted-foreground tabular-nums">{money.format(amount)} ₸</div>
                                                    <div className="flex items-center gap-1">
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        disabled={savingMember || !memberId || bonusEditingLocked}
                                                        onClick={() => setMemberBonusAmount(row, member, amount - 10000)}
                                                        aria-label={`Уменьшить бонус ${teamName(member)} на 10 000 тенге`}
                                                      >
                                                        <Minus className="h-3 w-3" />
                                                      </Button>
                                                      <Input
                                                        key={`${memberId}-${amount}`}
                                                        aria-label={`Бонус ${teamName(member)} в тенге`}
                                                        className="h-7 min-w-0 flex-1 px-2 text-right text-xs tabular-nums"
                                                        inputMode="numeric"
                                                        disabled={savingMember || !memberId || bonusEditingLocked}
                                                        defaultValue={String(Math.round(amount))}
                                                        onBlur={(event) => {
                                                          const nextAmount = Number(event.currentTarget.value.replace(/\s/g, '').replace(',', '.'));
                                                          if (Number.isFinite(nextAmount) && nextAmount >= 0) void setMemberBonusAmount(row, member, nextAmount);
                                                        }}
                                                        onKeyDown={(event) => {
                                                          if (event.key === 'Enter') event.currentTarget.blur();
                                                        }}
                                                      />
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        disabled={savingMember || !memberId || bonusEditingLocked}
                                                        onClick={() => setMemberBonusAmount(row, member, amount + 10000)}
                                                        aria-label={`Увеличить бонус ${teamName(member)} на 10 000 тенге`}
                                                      >
                                                        <Plus className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                                      <span>{percent.toFixed(1)}% от пула</span>
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-1.5 text-[11px]"
                                                        disabled={savingMember || !memberId || bonusEditingLocked}
                                                        onClick={() => setMemberBonusPercent(row, member, Number(member.bonusPercent || 0))}
                                                      >
                                                        По формуле
                                                      </Button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
            </TableBody>
          </table>
          <ProjectTablePagination
            page={safeTablePage}
            pageCount={tablePageCount}
            pageSize={tablePageSize}
            start={tablePageStart}
            end={tablePageEnd}
            total={filteredRows.length}
            onPageChange={(page) => {
              setTablePage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(value) => {
              setTablePageSize(value);
              setTablePage(1);
            }}
          />
        </Card>
        )}

        <AlertDialog open={Boolean(gphEditorRow)} onOpenChange={(open) => {
          if (open) return;
          setGphEditorRowId(null);
          setGphAssignmentContext(null);
        }}>
          {gphEditorRow && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Добавить исполнителя ГПХ</AlertDialogTitle>
                <AlertDialogDescription>
                  {gphEditorRow.name}. Укажите ФИО и сумму. Запись появится в реестре ГПХ проекта, а финансовый свод пересчитается сразу.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-3">
                <Input
                  aria-label={`ФИО исполнителя ГПХ для проекта ${gphEditorRow.name}`}
                  data-testid="contractor-name-input"
                  placeholder="ФИО исполнителя"
                  autoFocus
                  value={contractorNameDrafts[gphEditorRow.id] ?? ''}
                  onChange={(event) => setContractorNameDrafts((current) => ({ ...current, [gphEditorRow.id]: event.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Сумма ГПХ для проекта ${gphEditorRow.name}`}
                    data-testid="contractor-amount-input"
                    type="number"
                    min="0"
                    step="1000"
                    inputMode="numeric"
                    placeholder="Сумма"
                    value={contractorAmountDrafts[gphEditorRow.id] ?? ''}
                    onChange={(event) => setContractorAmountDrafts((current) => ({ ...current, [gphEditorRow.id]: event.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground">₸</span>
                </div>
              </div>
              {Array.isArray(gphEditorRow.finances.contractors) && gphEditorRow.finances.contractors.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="mb-2 font-medium">Уже добавленные ГПХ</div>
                  <div className="space-y-1 text-muted-foreground">
                    {gphEditorRow.finances.contractors.map((contractor: any, index: number) => (
                      <div key={contractor?.id || index} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">{contractor?.name || 'Исполнитель не указан'}</span>
                        <span className="shrink-0 tabular-nums">{money.format(Number(contractor?.amount) || 0)} ₸</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={savingProjectId === `${gphEditorRow.id}:contractors`}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  data-testid="save-contractor-amount"
                  disabled={savingProjectId === `${gphEditorRow.id}:contractors`}
                  onClick={(event) => {
                    event.preventDefault();
                    void addProjectContractor(gphEditorRow);
                  }}
                >
                  {savingProjectId === `${gphEditorRow.id}:contractors` ? 'Сохраняю…' : 'Учесть ГПХ'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>

        <AlertDialog
          open={Boolean(projectTeamTemplateTarget)}
          onOpenChange={(open) => {
            if (!open && savingProjectId !== `${projectTeamTemplateTarget?.rowId}:team-template`) {
              setProjectTeamTemplateTarget(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Заменить общую команду шаблоном партнёра?</AlertDialogTitle>
              <AlertDialogDescription>
                «{projectTeamTemplateTargetDefinition?.label || 'Шаблон команды партнёра'}» заменит единый состав проекта «{projectTeamTemplateTargetRow?.name || 'проект'}» только после этого подтверждения. Договоры, сроки, часы, бонусные выплаты и файлы не изменятся.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={savingProjectId === `${projectTeamTemplateTarget?.rowId}:team-template`}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-project-team-template"
                disabled={!projectTeamTemplateTargetDefinition || savingProjectId === `${projectTeamTemplateTarget?.rowId}:team-template`}
                onClick={(event) => {
                  event.preventDefault();
                  void applyPartnerTeamTemplateToProject();
                }}
              >
                {savingProjectId === `${projectTeamTemplateTarget?.rowId}:team-template` ? 'Применяю…' : 'Да, заменить общую команду'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkCompanyAssignOpen} onOpenChange={setBulkCompanyAssignOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Назначить компанию выбранным проектам?</AlertDialogTitle>
              <AlertDialogDescription>
                Компания «{companyOptions.find((option) => option.key === bulkCompanyId)?.name || 'не выбрана'}» будет назначена для {selectedProjectIds.size} проектов. Договоры, команда, часы, бонусы и файлы не изменятся.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkAssigningCompany}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void assignCompanyToSelectedProjects();
                }}
                disabled={bulkAssigningCompany || !bulkCompanyId}
              >
                {bulkAssigningCompany ? 'Назначаю…' : `Назначить ${selectedProjectIds.size}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkPartnerAssignOpen} onOpenChange={setBulkPartnerAssignOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Назначить партнёра выбранным проектам?</AlertDialogTitle>
              <AlertDialogDescription>
                Партнёр «{partnerEmployees.find((employee) => employee.id === bulkPartnerId) ? employeeName(partnerEmployees.find((employee) => employee.id === bulkPartnerId)) : 'не выбран'}» заменит только партнёра у {selectedProjectIds.size} проектов. Остальной исторический состав будет сохранён в единой команде проекта. Шаблон команды автоматически не применяется.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkAssigningPartner}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                disabled={bulkAssigningPartner || !bulkPartnerId}
                onClick={(event) => {
                  event.preventDefault();
                  void assignPartnerToSelectedProjects();
                }}
              >
                {bulkAssigningPartner ? 'Назначаю…' : `Назначить ${selectedProjectIds.size}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkTeamAssignOpen} onOpenChange={setBulkTeamAssignOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Применить команду к выбранным проектам?</AlertDialogTitle>
              <AlertDialogDescription>
                «{teamTemplates.find((template) => template.id === bulkTeamTemplateId)?.label || 'Шаблон не выбран'}» заменит единый состав у {selectedProjectIds.size} проектов. Договоры, сроки, часы, бонусные выплаты и файлы не изменятся.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkAssigningTeam}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-bulk-team"
                disabled={bulkAssigningTeam || !bulkTeamTemplateId}
                onClick={(event) => {
                  event.preventDefault();
                  void assignTeamToSelectedProjects();
                }}
              >
                {bulkAssigningTeam ? 'Назначаю…' : `Применить к ${selectedProjectIds.size}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkLeaderAssignOpen} onOpenChange={setBulkLeaderAssignOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Назначить руководителя выбранным проектам?</AlertDialogTitle>
              <AlertDialogDescription>
                Руководитель «{assignableEmployees.find((employee) => employee.id === bulkLeaderId) ? employeeName(assignableEmployees.find((employee) => employee.id === bulkLeaderId)) : 'не выбран'}» заменит текущего руководителя у {selectedProjectIds.size} проектов. Остальной исторический состав будет сохранён в единой команде проекта.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkAssigningLeader}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-bulk-leader"
                disabled={bulkAssigningLeader || !bulkLeaderId}
                onClick={(event) => {
                  event.preventDefault();
                  void assignLeaderToSelectedProjects();
                }}
              >
                {bulkAssigningLeader ? 'Назначаю…' : `Назначить ${selectedProjectIds.size}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить выбранные проекты?</AlertDialogTitle>
              <AlertDialogDescription>
                Будет удалено записей: {selectedProjectIds.size}. Утверждённые таймшиты и физические файлы Seafile сохраняются, но проекты исчезнут из рабочего свода. Действие нельзя отменить из интерфейса.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleting}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void deleteSelectedProjects();
                }}
                disabled={bulkDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {bulkDeleting ? 'Удаляю…' : `Удалить ${selectedProjectIds.size}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
