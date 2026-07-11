import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, Filter, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEmployees, useProjects } from '@/hooks/useSupabaseData';
import { useAppSettings } from '@/lib/appSettings';
import { projectMatchesAllowedCompanies } from '@/lib/userCompanyAccess';
import {
  contractFileUrl as readContractFileUrl,
  dedupeProjectFiles,
  projectAmountWithoutVAT as readProjectAmountWithoutVAT,
  projectContract as readProjectContract,
  projectContractFiles as readProjectContractFiles,
  projectDeadline as readProjectDeadline,
  projectFinances as readProjectFinances,
  projectNotes as readProjectNotes,
  projectStartDate as readProjectStartDate,
} from '@/lib/contractData';
import {
  allProjectsHoursTotals,
  approvedHoursIndex,
  pendingHoursIndex,
  type ProjectHoursTotals,
} from '@/lib/timesheets';
import { calculateProjectFinances } from '@/types/project-v3';
import { getAuditPeriods, projectToAuditPeriod, type AuditPeriod } from '@/lib/auditPeriods';
import type { CanonicalTeamMember } from '@/types/project-domain';
import type * as XLSXNs from 'xlsx';

const loadXlsx = (): Promise<typeof XLSXNs> => import('xlsx');

type ProjectViewFilter =
  | 'all'
  | 'working'
  | 'attention'
  | 'closed'
  | 'no_partner'
  | 'no_leader'
  | 'no_contract'
  | 'no_amount'
  | 'waiting_hours';
type ProjectDeadlineFilter = 'all' | 'overdue' | 'next_30' | 'no_deadline';
type ProjectPeriodFilter = 'all' | 'has_periods' | 'no_periods';
type ProjectSort = 'default' | 'deadline_asc' | 'deadline_desc' | 'amount_desc' | 'hours_desc';
type ProjectCommandScope = 'executive' | 'operations';
type TableDetailLevel = 'compact' | 'detailed';
type PartnerFilter = 'all' | 'unassigned' | string;
type CompanyFilter = 'all' | 'missing' | string;
type YearFilter = 'all' | string;
type CompanyOption = { id: string; name: string; fullName?: string; isActive?: boolean };
type PeriodDraft = { name: string; startDate: string; endDate: string; deadline: string };
type DateRange = { start: Date; end: Date };

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const TEAM_COLUMNS = [
  { key: 'partner', label: 'Партнер', percent: '29%' },
  { key: 'project_leader', label: 'Руководитель', percent: '24%' },
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

function coverageTeam(projectTeam: CanonicalTeamMember[], periods: AuditPeriod[]): CanonicalTeamMember[] {
  return uniqueMembersFromTeams([projectTeam || [], ...(periods || []).map(periodTeam)]);
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

function financeFor(project: any) {
  const normalizedFinances = readProjectFinances(project);
  try {
    return calculateProjectFinances({
      ...project,
      finances: {
        ...normalizedFinances,
        amountWithoutVAT: projectAmount(project),
      },
    });
  } catch {
    const amount = projectAmount(project);
    return {
      amountWithoutVAT: amount,
      preExpenseAmount: 0,
      totalContractorsAmount: 0,
      bonusBase: amount,
      bonusPercent: 10,
      totalBonusAmount: amount * 0.1,
      totalPaidBonuses: 0,
      totalCosts: amount * 0.1,
      grossProfit: amount,
      profitMargin: amount > 0 ? 100 : 0,
      teamBonuses: {},
    };
  }
}

function exportPeriodLabel(period: AuditPeriod): string {
  const parts = [periodLabel(period)];
  if (period.deadline) parts.push(`дедлайн ${formatDate(period.deadline)}`);
  parts.push(periodStatusLabel(period.status));
  return parts.join(' · ');
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

function exportPeriodTeamList(period: AuditPeriod, includeBonuses: boolean): string {
  const team = periodTeam(period);
  const finances = (period as any)?.finances || {};
  return exportTeamList(team, finances, includeBonuses);
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
  detailLevel: TableDetailLevel,
  access: { canSeeContractMoney: boolean; isExecutive: boolean },
): Record<string, string | number>[] {
  return sourceRows.map((row, index) => {
    const totalBonusAmount = Number(row.finances?.totalBonusAmount || row.finances?.totalPaidBonuses) || 0;
    const base: Record<string, string | number> = {
      '№': index + 1,
      Проект: row.name,
      Клиент: row.client,
      'Вид проекта': row.type,
      'Срок проекта': `${formatDate(row.startDate)} - ${formatDate(row.deadline)}`,
      Периоды: row.periods?.length ? row.periods.map(exportPeriodLabel).join('\n') : 'нет периодов',
      Статус: row.readiness?.label || '',
      'Что не так': row.readiness?.issues?.join(', ') || '',
      Закрытие: row.readiness?.level === 'closed' ? 'Закрыт' : 'В работе',
    };

    if (access.canSeeContractMoney) {
      base['Наша компания'] = row.company;
      base['Сумма без НДС'] = Number(row.amount || 0);
      base['Договор'] = exportContractLabel(row);
    }

    if (access.isExecutive) {
      base['Бонусный пул %'] = Number(row.finances?.bonusPercent || 0);
      base['Бонусы'] = totalBonusAmount;
      base['Грязный доход'] = Number(row.finances?.grossProfit || 0);
    }

    if (detailLevel === 'compact') return base;

    const realTeam = row.coverageTeam || row.team || [];
    base['Партнер'] = row.partnerNames?.join(', ') || 'не назначен';
    base['Руководитель'] =
      realTeam.filter((member: any) => isLeaderRole(teamRole(member))).map(teamName).join(', ') || 'не назначен';
    base['Команда'] = exportTeamList(realTeam, row.finances || {}, access.isExecutive);
    base['Периоды и команды'] =
      row.periods?.length
        ? row.periods
            .map((period: AuditPeriod) => {
              const team = exportPeriodTeamList(period, access.isExecutive);
              return team ? `${exportPeriodLabel(period)}\n${team}` : exportPeriodLabel(period);
            })
            .join('\n\n')
        : '';
    base['Часы утверждено'] = Number(row.hours?.approved || 0);
    base['Часы ждут'] = Number(row.hours?.pending || 0);
    base['Записей в базе'] = row.duplicateRows?.length || 1;
    base['ID проектов'] = (row.projectIds || [row.id]).join(', ');

    return base;
  });
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

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

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

function rangesFromYearText(value: string): DateRange[] {
  const ranges: DateRange[] = [];
  const text = String(value || '');
  const rangeRegex = /(20\d{2})(?:\s*[-–—]\s*(20\d{2}))?/g;
  for (const match of text.matchAll(rangeRegex)) {
    const startYear = Number(match[1]);
    const endYear = Number(match[2] || match[1]);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) continue;
    const from = Math.min(startYear, endYear);
    const to = Math.max(startYear, endYear);
    ranges.push({ start: yearRangeStart(from), end: yearRangeEnd(to) });
  }
  return ranges;
}

function rowDateRanges(row: any): DateRange[] {
  const ranges: DateRange[] = [];
  const projectRange = makeDateRange(row.startDate, row.deadline);
  if (projectRange) ranges.push(projectRange);

  for (const period of row.periods || []) {
    const periodRange = makeDateRange(period.startDate, period.endDate || period.deadline);
    if (periodRange) ranges.push(periodRange);
    if (!periodRange && period.deadline) {
      const deadlineRange = makeDateRange(period.deadline, period.deadline);
      if (deadlineRange) ranges.push(deadlineRange);
    }
    ranges.push(...rangesFromYearText(period.name || ''));
  }

  for (const value of [row.name, row.client, row.company]) {
    ranges.push(...rangesFromYearText(value || ''));
  }

  return ranges;
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

function periodFilterLabel(value: string): string {
  if (value === 'all') return 'Все даты';
  const yearMatch = value.match(/^year:(20\d{2})$/);
  if (yearMatch) return yearMatch[1];
  const quarterMatch = value.match(/^quarter:(20\d{2})-Q([1-4])$/);
  if (quarterMatch) return `${quarterMatch[1]} · ${quarterMatch[2]} квартал`;
  const monthMatch = value.match(/^month:(20\d{2})-(0[1-9]|1[0-2])$/);
  if (monthMatch) return `${monthMatch[1]} · ${MONTH_NAMES[Number(monthMatch[2]) - 1]}`;
  return value;
}

function rowDateBucketKeys(row: any): { years: Set<string>; quarters: Set<string>; months: Set<string> } {
  const years = new Set<string>();
  const quarters = new Set<string>();
  const months = new Set<string>();

  for (const range of rowDateRanges(row)) {
    const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    const end = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    while (cursor.getTime() <= end.getTime()) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      const quarter = Math.floor((month - 1) / 3) + 1;
      years.add(`year:${year}`);
      quarters.add(`quarter:${year}-Q${quarter}`);
      months.add(`month:${year}-${String(month).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return { years, quarters, months };
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

function issueBadgeClass(level: 'ready' | 'attention' | 'closed') {
  if (level === 'ready') return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50';
  if (level === 'closed') return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100';
  return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50';
}

function rowHasIssue(row: { readiness: { issues: string[] } }, issue: string) {
  return row.readiness.issues.includes(issue);
}

function SummaryItem({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
        {value}
      </span>
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

function EmployeeSearchAdd({
  employees,
  disabled,
  onPick,
}: {
  employees: any[];
  disabled?: boolean;
  onPick: (employeeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return employees
      .filter((employee) => {
        if (!q) return true;
        const haystack = `${employeeName(employee)} ${employee?.email || ''} ${employee?.role || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 80);
  }, [employees, q]);

  const pick = (employeeId: string) => {
    onPick(employeeId);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-start" disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени, почте, роли"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
          )}
          {filtered.map((employee) => (
            <button
              type="button"
              key={employee.id}
              className="flex w-full flex-col rounded px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={() => pick(employee.id)}
            >
              <span className="font-medium">{employeeName(employee)}</span>
              {(employee?.role || employee?.email) && (
                <span className="text-xs text-muted-foreground">{employee?.role || employee?.email}</span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ProjectCommandCenter({ scope }: { scope?: ProjectCommandScope }) {
  const { user } = useAuth();
  const { projects = [], loading: projectsLoading, updateProject, deleteProject } = useProjects();
  const { employees = [] } = useEmployees();
  const [appSettings] = useAppSettings();
  const { toast } = useToast();
  const [hoursTotals, setHoursTotals] = useState<Map<string, ProjectHoursTotals>>(new Map());
  const [memberHours, setMemberHours] = useState<Map<string, ProjectHoursTotals>>(new Map());
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ProjectViewFilter>('all');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [partnerFilter, setPartnerFilter] = useState<PartnerFilter>('all');
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<ProjectDeadlineFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<ProjectPeriodFilter>('all');
  const [sortBy, setSortBy] = useState<ProjectSort>('deadline_asc');
  const [tableDetailLevel, setTableDetailLevel] = useState<TableDetailLevel>('compact');
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodNameDraft, setPeriodNameDraft] = useState('');
  const [addingPeriodRowId, setAddingPeriodRowId] = useState<string | null>(null);
  const [newPeriodDraft, setNewPeriodDraft] = useState<PeriodDraft>({
    name: '',
    startDate: '',
    endDate: '',
    deadline: '',
  });

  const effectiveScope: ProjectCommandScope =
    scope || (user?.role === 'ceo' || user?.role === 'admin' ? 'executive' : 'operations');
  const isExecutive = effectiveScope === 'executive';
  const isProcurement = user?.role === 'procurement';
  const canSeeContractMoney = isExecutive || isProcurement;
  const canManageTeam = user?.role === 'ceo' || user?.role === 'admin' || user?.role === 'deputy_director';
  const canCloseProjects = user?.role === 'ceo' || user?.role === 'admin';
  const canDeleteProjects = user?.role === 'admin';
  const canEditPeriods = canManageTeam || user?.role === 'partner';

  const assignableEmployees = useMemo(
    () => [...(employees as any[])].sort((a, b) => employeeName(a).localeCompare(employeeName(b), 'ru')),
    [employees],
  );

  useEffect(() => {
    let active = true;
    Promise.all([allProjectsHoursTotals(), approvedHoursIndex(), pendingHoursIndex()])
      .then(([totals, approvedByMember, pendingByMember]) => {
        if (!active) return;
        const nextMemberHours = new Map<string, ProjectHoursTotals>();
        for (const [key, approved] of approvedByMember.entries()) {
          const current = nextMemberHours.get(key) || { approved: 0, pending: 0 };
          current.approved = approved;
          nextMemberHours.set(key, current);
        }
        for (const [key, pending] of pendingByMember.entries()) {
          const current = nextMemberHours.get(key) || { approved: 0, pending: 0 };
          current.pending = pending;
          nextMemberHours.set(key, current);
        }
        setHoursTotals(totals);
        setMemberHours(nextMemberHours);
      })
      .catch((error) => {
        console.error('[ProjectCommandCenter] failed to load hours totals', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const rawRows = projects.map((project: any) => {
      const status = projectStatus(project);
      const team = projectTeam(project);
      const amount = projectAmount(project);
      const finances = financeFor(project);
      const hours = hoursTotals.get(project.id) || { approved: 0, pending: 0 };
      const contract = projectContract(project);
      const contractFiles = projectContractFiles(project);
      const hasContract = rowHasContractEvidence({ project, contract, contractFiles });
      const startDate = rawProjectStartDate(project);
      const deadline = rawProjectDeadline(project);
      const periods = keepExplicitPeriodTeams(projectPeriods(project), project.id);
      const realTeam = coverageTeam(team, periods);
      const readiness = projectReadiness({
        status,
        team: realTeam,
        amount,
        hasContract,
        hours,
        includeContractIssues: canSeeContractMoney,
        includeFinancialIssues: canSeeContractMoney,
      });
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
        readiness,
        startDate,
        deadline,
        deadlineState,
        periods,
        coverageTeam: realTeam,
        partnerNames,
        teamColumns: teamByRole(team),
        teamColumnMembers: teamMembersByRole(team),
        hasContract,
        contract,
        contractFiles,
        projectIds: [project.id],
        duplicateRows: [],
      };
    });

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
      const readiness = projectReadiness({
        status,
        team: realTeam,
        amount,
        hasContract,
        hours,
        includeContractIssues: canSeeContractMoney,
        includeFinancialIssues: canSeeContractMoney,
      });
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
        readiness,
        hasContract,
        startDate,
        deadline,
        deadlineState: deadlineInfo(deadline, status),
        periods,
        coverageTeam: realTeam,
        partnerNames,
        teamColumns: teamByRole(team),
        teamColumnMembers: teamMembersByRole(team),
        contract: contractRow.contract,
        contractFiles,
        projectIds: groupRows.flatMap((row) => row.projectIds || [row.id]),
        duplicateRows: groupRows,
      };
    });
  }, [projects, hoursTotals, canSeeContractMoney]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.amount += row.amount;
        acc.grossProfit += Number(row.finances.grossProfit) || 0;
        acc.bonuses += Number(row.finances.totalPaidBonuses) || 0;
        acc.approvedHours += row.hours.approved;
        acc.pendingHours += row.hours.pending;
        if (row.readiness.level === 'attention') acc.attention += 1;
        if (row.readiness.level === 'closed') acc.closed += 1;
        if (row.deadlineState.tone === 'overdue') acc.overdue += 1;
        if (row.deadlineState.tone === 'soon') acc.soon += 1;
        if (!row.deadline) acc.noDeadline += 1;
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
        bonuses: 0,
        approvedHours: 0,
        pendingHours: 0,
      },
    );
  }, [rows]);

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

  const dateFilterOptions = useMemo(() => {
    const years = new Map<string, number>();
    const quarters = new Map<string, number>();
    const months = new Map<string, number>();

    for (const row of rows) {
      const keys = rowDateBucketKeys(row);
      for (const key of keys.years) years.set(key, (years.get(key) || 0) + 1);
      for (const key of keys.quarters) quarters.set(key, (quarters.get(key) || 0) + 1);
      for (const key of keys.months) months.set(key, (months.get(key) || 0) + 1);
    }

    const sortDesc = ([a]: [string, number], [b]: [string, number]) => b.localeCompare(a);
    const toOption = ([value, count]: [string, number]) => ({ value, label: periodFilterLabel(value), count });

    return {
      years: [...years.entries()].sort(sortDesc).map(toOption),
      quarters: [...quarters.entries()].sort(sortDesc).map(toOption),
      months: [...months.entries()].sort(sortDesc).map(toOption),
    };
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

  const selectedDateFilterLabel = useMemo(() => {
    return periodFilterLabel(yearFilter);
  }, [yearFilter]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const periodText = row.periods.map(periodLabel).join(' ');
      const coverageTeamText = (row.coverageTeam || row.team || []).map(teamName).join(' ');
      const haystack = `${row.company} ${row.name} ${row.client} ${row.type} ${row.startDate} ${row.deadline} ${periodText} ${Object.values(row.teamColumns).join(' ')} ${coverageTeamText}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (companyFilter === 'missing') {
        if (companyOptions.some((option) => rowMatchesCompanyOption(row, option.company))) return false;
      } else if (companyFilter !== 'all') {
        const company = companyOptions.find((option) => option.key === companyFilter)?.company;
        if (!company || !rowMatchesCompanyOption(row, company)) return false;
      }
      if (partnerFilter === 'unassigned' && row.partnerNames.length > 0) return false;
      if (
        partnerFilter !== 'all' &&
        partnerFilter !== 'unassigned' &&
        !row.partnerNames.some((name: string) => partnerFilterKey(name) === partnerFilter)
      ) {
        return false;
      }
      if (!rowMatchesDateFilter(row, yearFilter)) return false;
      if (viewFilter === 'working' && row.readiness.level !== 'ready') return false;
      if (viewFilter === 'attention' && row.readiness.level !== 'attention') return false;
      if (viewFilter === 'closed' && row.readiness.level !== 'closed') return false;
      if (viewFilter === 'no_partner' && !rowHasIssue(row, 'нет партнера')) return false;
      if (viewFilter === 'no_leader' && !rowHasIssue(row, 'нет руководителя')) return false;
      if (viewFilter === 'no_contract' && !rowHasIssue(row, 'нет договора')) return false;
      if (viewFilter === 'no_amount' && !rowHasIssue(row, 'нет суммы')) return false;
      if (viewFilter === 'waiting_hours' && !rowHasIssue(row, 'ждут часы')) return false;
      if (deadlineFilter === 'overdue' && row.deadlineState.tone !== 'overdue') return false;
      if (deadlineFilter === 'next_30' && row.deadlineState.tone !== 'soon') return false;
      if (deadlineFilter === 'no_deadline' && row.deadline) return false;
      if (periodFilter === 'has_periods' && row.periods.length === 0) return false;
      if (periodFilter === 'no_periods' && row.periods.length > 0) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'deadline_asc') return dateStamp(a.deadline) - dateStamp(b.deadline);
      if (sortBy === 'deadline_desc') return dateStamp(b.deadline) - dateStamp(a.deadline);
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'hours_desc') return b.hours.approved + b.hours.pending - (a.hours.approved + a.hours.pending);
      return 0;
    });
  }, [rows, search, companyFilter, companyOptions, partnerFilter, yearFilter, viewFilter, deadlineFilter, periodFilter, sortBy]);

  const tableColSpan = 6 + (canSeeContractMoney ? 1 : 0) + (isExecutive ? 3 : 0);

  const toggleRow = (projectId: string) => {
    setExpandedRows((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const projectIdsForRow = (row: (typeof rows)[number]): string[] => {
    return Array.from(new Set((row.projectIds?.length ? row.projectIds : [row.id]).filter(Boolean)));
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
      const exportRows = buildProjectExportRows(filteredRows, tableDetailLevel, {
        canSeeContractMoney,
        isExecutive,
      });
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      autosizeExportSheet(worksheet, exportRows);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, tableDetailLevel === 'detailed' ? 'Подробно' : 'Кратко');
      XLSX.writeFile(workbook, `svod_filtered_${tableDetailLevel}_${new Date().toISOString().slice(0, 10)}.xlsx`);

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

  const setBonusPercent = async (row: (typeof rows)[number], nextPercent: number) => {
    if (!isExecutive || !updateProject) return;
    const bonusPercent = Math.max(0, Math.min(40, nextPercent));
    setSavingProjectId(row.id);
    try {
      const projectWithPercent = {
        ...row.project,
        finances: {
          ...(row.project?.notes?.finances || {}),
          ...(row.project?.finances || {}),
          amountWithoutVAT: row.amount,
          bonusPercent,
        },
      };
      const finances = calculateProjectFinances(projectWithPercent);
      await updateProject(row.id, {
        finances: {
          ...(row.project?.notes?.finances || {}),
          ...(row.project?.finances || {}),
          ...finances,
          bonusPercent,
        },
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось обновить бонусы',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const setMemberBonusPercent = async (row: (typeof rows)[number], member: any, nextPercent: number) => {
    if (!isExecutive || !updateProject) return;
    const memberId = teamMemberId(member);
    if (!memberId) return;

    const bonusPercent = Math.max(0, Math.min(100, nextPercent));
    setSavingProjectId(`${row.id}:${memberId}`);
    try {
      const nextTeam = row.team.map((item: CanonicalTeamMember) => {
        if (teamMemberId(item) !== memberId || teamRole(item) !== teamRole(member)) return item;
        return { ...item, bonusPercent };
      });

      const existingFinances = {
        ...(row.project?.notes?.finances || {}),
        ...(row.project?.finances || {}),
      };
      const projectWithMemberPercent = {
        ...row.project,
        team: nextTeam,
        finances: {
          ...existingFinances,
          amountWithoutVAT: row.amount,
          teamBonuses: {
            ...(existingFinances.teamBonuses || {}),
            [memberId]: {
              ...(existingFinances.teamBonuses?.[memberId] || {}),
              manuallyAdjusted: false,
            },
          },
        },
      };
      const finances = calculateProjectFinances(projectWithMemberPercent);
      await updateProject(row.id, { team: nextTeam, finances });
    } catch (error: any) {
      toast({
        title: 'Не удалось обновить участника',
        description: error?.message || 'Попробуйте еще раз',
        variant: 'destructive',
      });
    } finally {
      setSavingProjectId(null);
    }
  };

  const addTeamMember = async (row: (typeof rows)[number], roleKey: string, employeeId: string) => {
    if (!canManageTeam || !updateProject || !employeeId) return;
    const employee = (employees as any[]).find((item) => item.id === employeeId);
    if (!employee) return;

    setSavingProjectId(`${row.id}:add:${roleKey}`);
    try {
      const nextTeam = [
        ...row.team,
        {
          userId: employee.id,
          userName: employeeName(employee),
          name: employeeName(employee),
          role: roleKey,
          bonusPercent: roleDefaultPercent(roleKey),
          assignedAt: new Date().toISOString(),
          assignedBy: user?.id || 'inline-table',
        },
      ];
      const existingFinances = {
        ...(row.project?.notes?.finances || {}),
        ...(row.project?.finances || {}),
      };
      const projectWithTeam = {
        ...row.project,
        team: nextTeam,
        finances: {
          ...existingFinances,
          amountWithoutVAT: row.amount,
        },
      };
      const finances = calculateProjectFinances(projectWithTeam);
      await updateProject(row.id, { team: nextTeam, finances });
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

  const removeTeamMember = async (row: (typeof rows)[number], member: any, memberIndex: number) => {
    if (!canManageTeam || !updateProject) return;
    const id = teamMemberId(member);
    const role = teamRole(member);
    setSavingProjectId(`${row.id}:remove:${id || memberIndex}`);
    try {
      const nextTeam = row.team.filter((item: CanonicalTeamMember, index: number) => {
        if (id && teamMemberId(item)) return !(teamMemberId(item) === id && teamRole(item) === role);
        return index !== memberIndex;
      });
      const existingFinances = {
        ...(row.project?.notes?.finances || {}),
        ...(row.project?.finances || {}),
      };
      const projectWithTeam = {
        ...row.project,
        team: nextTeam,
        finances: {
          ...existingFinances,
          amountWithoutVAT: row.amount,
        },
      };
      const finances = calculateProjectFinances(projectWithTeam);
      await updateProject(row.id, { team: nextTeam, finances });
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

  const startAddPeriod = (row: (typeof rows)[number]) => {
    const nextNumber = (row.periods?.length || 0) + 1;
    setAddingPeriodRowId(row.id);
    setNewPeriodDraft({
      name: `Период ${nextNumber}`,
      startDate: row.startDate || '',
      endDate: row.deadline || '',
      deadline: row.deadline || '',
    });
  };

  const cancelAddPeriod = () => {
    setAddingPeriodRowId(null);
    setNewPeriodDraft({ name: '', startDate: '', endDate: '', deadline: '' });
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
      type: 'custom',
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
    const nextPeriods = [...persistedPeriodsForProject(sourceProject), nextPeriod];

    setSavingProjectId(`${row.id}:period:add`);
    try {
      await updateProject(sourceProjectId, { auditPeriods: nextPeriods });
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
    const basePeriods = persistedPeriodsForProject(sourceProject);
    let removed = false;
    const nextPeriods = basePeriods.filter((item) => {
      const samePeriod =
        item.id === period.id ||
        (
          !removed &&
          item.name === period.name &&
          item.startDate === period.startDate &&
          item.endDate === period.endDate &&
          item.deadline === period.deadline
        );
      if (samePeriod) {
        removed = true;
        return false;
      }
      return true;
    });

    setSavingProjectId(`${row.id}:${period.id}:delete`);
    try {
      await updateProject(sourceProjectId, { auditPeriods: nextPeriods });
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
    const basePeriods = persistedPeriodsForProject(sourceProject);
    let matched = false;

    const nextPeriods = basePeriods.map((item) => {
      const samePeriod =
        item.id === period.id ||
        (
          !matched &&
          item.name === period.name &&
          item.startDate === period.startDate &&
          item.endDate === period.endDate &&
          item.deadline === period.deadline
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

    if (!matched) {
      nextPeriods.push({
        ...period,
        sourceProjectId,
        name,
        updatedAt: now,
      } as AuditPeriod);
    }

    setSavingProjectId(`${row.id}:${period.id}:name`);
    try {
      await updateProject(sourceProjectId, { auditPeriods: nextPeriods });
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

  const savePeriodTeam = async (row: (typeof rows)[number], period: AuditPeriod, nextTeam: any[]) => {
    if (!canManageTeam || !updateProject) return;
    const sourceRow = periodSourceRow(row, period);
    const sourceProject = sourceRow.project || sourceRow;
    const sourceProjectId = sourceProject.id || sourceRow.id || row.id;
    const now = new Date().toISOString();
    const basePeriods = persistedPeriodsForProject(sourceProject);
    let matched = false;

    const nextPeriods = basePeriods.map((item) => {
      const samePeriod =
        item.id === period.id ||
        (
          !matched &&
          item.name === period.name &&
          item.startDate === period.startDate &&
          item.endDate === period.endDate &&
          item.deadline === period.deadline
        );
      if (!samePeriod) return item;
      matched = true;
      return {
        ...item,
        sourceProjectId,
        team: nextTeam,
        teamSource: 'period',
        updatedAt: now,
      } as AuditPeriod;
    });

    if (!matched) {
      nextPeriods.push({
        ...period,
        sourceProjectId,
        team: nextTeam,
        teamSource: 'period',
        updatedAt: now,
      } as AuditPeriod);
    }

    await updateProject(sourceProjectId, { auditPeriods: nextPeriods });
  };

  const addPeriodTeamMember = async (row: (typeof rows)[number], period: AuditPeriod, roleKey: string, employeeId: string) => {
    if (!canManageTeam || !updateProject || !employeeId) return;
    const employee = (employees as any[]).find((item) => item.id === employeeId);
    if (!employee) return;

    setSavingProjectId(`${row.id}:${period.id}:add:${roleKey}`);
    try {
      const nextTeam = [
        ...periodTeam(period).filter((member: any) => teamRole(member) !== roleKey),
        {
          userId: employee.id,
          userName: employeeName(employee),
          name: employeeName(employee),
          userEmail: employee.email,
          role: roleKey,
          bonusPercent: roleDefaultPercent(roleKey),
          assignedAt: new Date().toISOString(),
          assignedBy: user?.id || 'period-table',
        },
      ];
      await savePeriodTeam(row, period, nextTeam);
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
      const nextTeam = periodTeam(period).filter((item: any, index: number) => {
        if (teamRole(item) !== role) return true;
        if (id && teamMemberId(item)) return teamMemberId(item) !== id;
        return index !== memberIndex;
      });
      await savePeriodTeam(row, period, nextTeam);
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

  return (
    <div className="min-h-screen bg-background">
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
            {isExecutive && (
              <Button asChild variant="outline">
                <Link to="/bonuses">Бонусы</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 max-w-full space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border bg-background px-4 py-3 text-sm">
          <SummaryItem label="Всего" value={summary.total.toString()} />
          <SummaryItem label="В работе" value={(summary.total - summary.closed).toString()} />
          <SummaryItem label="Требуют действия" value={summary.attention.toString()} tone={summary.attention > 0 ? 'warn' : 'default'} />
          <SummaryItem label="Закрыты" value={summary.closed.toString()} />
          <SummaryItem label="Просрочены" value={summary.overdue.toString()} tone={summary.overdue > 0 ? 'warn' : 'default'} />
          <SummaryItem label="30 дней" value={summary.soon.toString()} tone={summary.soon > 0 ? 'warn' : 'default'} />
          <SummaryItem label="Без срока" value={summary.noDeadline.toString()} tone={summary.noDeadline > 0 ? 'warn' : 'default'} />
          <SummaryItem label="Часы" value={`${summary.approvedHours.toFixed(1)} ч`} />
          {summary.pendingHours > 0 && <SummaryItem label="Ждут" value={`${summary.pendingHours.toFixed(1)} ч`} tone="warn" />}
          {isExecutive && <SummaryItem label="Доход" value={`${money.format(summary.grossProfit)} ₸`} />}
          {isExecutive && <SummaryItem label="Бонусы" value={`${money.format(summary.bonuses)} ₸`} />}
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-9">
              <div className="relative flex-1 md:col-span-2 xl:col-span-2 2xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Клиент, проект, партнер, руководитель"
                  className="pl-9"
                />
              </div>
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
              <Select value={yearFilter} onValueChange={(value) => setYearFilter(value as YearFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Период" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все даты</SelectItem>
                  <SelectGroup>
                    <SelectLabel>Годы</SelectLabel>
                    {dateFilterOptions.years.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label} · {item.count}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Кварталы</SelectLabel>
                    {dateFilterOptions.quarters.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label} · {item.count}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Месяцы</SelectLabel>
                    {dateFilterOptions.months.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label} · {item.count}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as ProjectViewFilter)}>
                <SelectTrigger className="w-full">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все проекты</SelectItem>
                  <SelectItem value="working">В работе без проблем</SelectItem>
                  <SelectItem value="attention">Требуют действия</SelectItem>
                  <SelectItem value="closed">Закрытые</SelectItem>
                  <SelectItem value="no_partner">Без партнера</SelectItem>
                  <SelectItem value="no_leader">Без руководителя</SelectItem>
                  {canSeeContractMoney && <SelectItem value="no_contract">Без договора</SelectItem>}
                  {canSeeContractMoney && <SelectItem value="no_amount">Без суммы</SelectItem>}
                  <SelectItem value="waiting_hours">Ждут часы</SelectItem>
                </SelectContent>
              </Select>
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
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as ProjectSort)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline_asc">Сначала ближайшие</SelectItem>
                  <SelectItem value="deadline_desc">Сначала дальние</SelectItem>
                  <SelectItem value="amount_desc">Сначала крупные</SelectItem>
                  <SelectItem value="hours_desc">Сначала по часам</SelectItem>
                  <SelectItem value="default">Без сортировки</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tableDetailLevel} onValueChange={(value) => setTableDetailLevel(value as TableDetailLevel)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Кратко</SelectItem>
                  <SelectItem value="detailed">Подробно</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                disabled={filteredRows.length === 0}
                onClick={exportFilteredRows}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Скачать</span>
              </Button>
              <div className="text-sm text-muted-foreground">
                Показано {filteredRows.length} из {rows.length}
              </div>
            </div>
          </div>
          {(companyFilter !== 'all' || partnerFilter !== 'all' || yearFilter !== 'all') && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Сверка:</span>
              {companyFilter !== 'all' && <Badge variant="secondary">Наша компания: {selectedCompanyLabel}</Badge>}
              {partnerFilter !== 'all' && <Badge variant="secondary">Партнер: {selectedPartnerLabel}</Badge>}
              {yearFilter !== 'all' && <Badge variant="secondary">Период: {selectedDateFilterLabel}</Badge>}
              <span className="ml-auto text-muted-foreground">
                Найдено: <span className="font-medium text-foreground tabular-nums">{filteredRows.length}</span>
              </span>
            </div>
          )}
        </Card>

        <Card className="overflow-x-auto overflow-y-hidden">
          <table className={`${isExecutive ? 'min-w-[1540px]' : 'min-w-[1100px]'} w-full caption-bottom text-sm`}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px]" />
                <TableHead>Проект</TableHead>
                <TableHead className="hidden min-w-[180px] lg:table-cell">Вид проекта</TableHead>
                <TableHead className="min-w-[190px]">Срок / периоды</TableHead>
                <TableHead className="min-w-[130px]">Статус</TableHead>
                {canSeeContractMoney && <TableHead className="min-w-[140px] text-right">Сумма</TableHead>}
                {isExecutive && <TableHead className="min-w-[180px] text-center">Бонусный пул</TableHead>}
                {isExecutive && <TableHead className="min-w-[150px] text-right">Бонусы</TableHead>}
                {isExecutive && <TableHead className="min-w-[150px] text-right">Грязный доход</TableHead>}
                <TableHead className="min-w-[150px] text-right">Закрытие</TableHead>
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
                    По текущим фильтрам проектов нет.
                  </TableCell>
                </TableRow>
              )}
              {!projectsLoading &&
                filteredRows.map((row) => {
                  const expanded = tableDetailLevel === 'detailed' || !!expandedRows[row.id];
                  const totalBonusAmount = Number(row.finances.totalBonusAmount || row.finances.totalPaidBonuses) || 0;
                  return (
                    <Fragment key={row.id}>
                      <TableRow className="align-top hover:bg-muted/35">
                        <TableCell className="py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={tableDetailLevel === 'detailed'}
                            onClick={() => toggleRow(row.id)}
                            title={tableDetailLevel === 'detailed' ? 'Подробный вид включен' : expanded ? 'Свернуть' : 'Раскрыть'}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="py-3">
                          <Link to={`/project/${row.id}`} className="font-medium leading-snug hover:underline">
                            {row.name}
                          </Link>
                          {row.duplicateRows?.length > 1 && (
                            <Badge variant="secondary" className="ml-2 align-middle text-[11px]">
                              {row.duplicateRows.length} записей в базе
                            </Badge>
                          )}
                          <div className="mt-1 text-xs text-muted-foreground">{row.client}</div>
                        </TableCell>
                        <TableCell className="hidden py-3 text-muted-foreground lg:table-cell">{row.type}</TableCell>
                        <TableCell className="py-3">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              {formatDate(row.startDate)} - {formatDate(row.deadline)}
                            </div>
                            <Badge variant="outline" className={deadlineBadgeClass(row.deadlineState.tone)}>
                              {row.deadlineState.label}
                            </Badge>
                            {row.periods.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {row.periods.length} период(а): {row.periods.slice(0, 2).map((period: AuditPeriod) => period.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="space-y-1.5">
                            <Badge variant="outline" className={issueBadgeClass(row.readiness.level)}>
                              {row.readiness.label}
                            </Badge>
                            {row.readiness.issues.length > 0 && row.readiness.level !== 'closed' && (
                              <div className="max-w-[180px] text-xs leading-snug text-muted-foreground">
                                {row.readiness.issues.join(', ')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        {canSeeContractMoney && <TableCell className="py-3 text-right font-medium tabular-nums">{money.format(row.amount)} ₸</TableCell>}
                        {isExecutive && (
                          <TableCell className="py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={savingProjectId === row.id}
                                onClick={() => setBonusPercent(row, Number(row.finances.bonusPercent || 0) - 1)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="w-12 text-center font-semibold tabular-nums">
                                {Number(row.finances.bonusPercent || 0).toFixed(0)}%
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={savingProjectId === row.id}
                                onClick={() => setBonusPercent(row, Number(row.finances.bonusPercent || 0) + 1)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                        {isExecutive && <TableCell className="py-3 text-right font-medium tabular-nums">{money.format(totalBonusAmount)} ₸</TableCell>}
                        {isExecutive && <TableCell className="py-3 text-right font-medium tabular-nums">{money.format(Number(row.finances.grossProfit) || 0)} ₸</TableCell>}
                        <TableCell className="py-3">
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className={issueBadgeClass(row.readiness.level)}>
                              {row.readiness.level === 'closed' ? 'Закрыт' : 'В работе'}
                            </Badge>
                            {(canCloseProjects || canDeleteProjects) && (
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {canCloseProjects && row.readiness.level !== 'closed' && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={savingProjectId === `${row.id}:close` || savingProjectId === `${row.id}:delete`}
                                    onClick={() => closeProjectRow(row)}
                                  >
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Закрыть
                                  </Button>
                                )}
                                {canDeleteProjects && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                    disabled={savingProjectId === `${row.id}:close` || savingProjectId === `${row.id}:delete`}
                                    onClick={() => deleteProjectRow(row)}
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Удалить
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${row.id}-details`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={tableColSpan} className="p-0">
                            <div className="space-y-4 border-t px-4 py-4">
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
                                      <div className="font-medium">{formatDate(row.startDate)} - {formatDate(row.deadline)}</div>
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
                                        <div className="grid gap-2 md:grid-cols-4">
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
                                                    {isExecutive && <div className="text-[11px] text-muted-foreground">{column.percent}</div>}
                                                  </div>
                                                  {members.length === 0 && canManageTeam && (
                                                    <EmployeeSearchAdd
                                                      employees={assignableEmployees}
                                                      disabled={savingProjectId === `${row.id}:${period.id}:add:${column.key}`}
                                                      onPick={(employeeId) => addPeriodTeamMember(row, period, column.key, employeeId)}
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
                                      <div className="font-medium tabular-nums">
                                        {Number(row.contract?.amountWithoutVAT || row.amount || 0) > 0
                                          ? `${money.format(Number(row.contract?.amountWithoutVAT || row.amount || 0))} ₸`
                                          : 'не указана'}
                                      </div>
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
                                          return url ? (
                                            <a
                                              key={`${file?.id || label}-${index}`}
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex"
                                            >
                                              <Button type="button" variant="outline" size="sm" className="h-8">
                                                {label}
                                              </Button>
                                            </a>
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

                              {isExecutive && (
                                <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                                  <MetricBox label="Сумма без НДС" value={`${money.format(row.amount)} ₸`} />
                                  <MetricBox label="Общая сумма бонуса" value={`${money.format(totalBonusAmount)} ₸`} />
                                  <MetricBox label="Итого бонусов" value={`${money.format(Number(row.finances.totalPaidBonuses) || 0)} ₸`} />
                                  <MetricBox label="Разница" value={`${money.format(totalBonusAmount - (Number(row.finances.totalPaidBonuses) || 0))} ₸`} />
                                  <MetricBox label="ГПХ" value={`${money.format(Number(row.finances.totalContractorsAmount) || 0)} ₸`} />
                                  <MetricBox label="Предрасход" value={`${money.format(Number(row.finances.preExpenseAmount) || 0)} ₸`} />
                                  <MetricBox label="База" value={`${money.format(Number(row.finances.bonusBase) || 0)} ₸`} />
                                  <MetricBox label="Грязный доход" value={`${money.format(Number(row.finances.grossProfit) || 0)} ₸`} />
                                </div>
                              )}

                              <div className="hidden rounded-md border bg-background">
                                <div className="border-b px-3 py-2 text-sm font-semibold">Команда и проценты</div>
                                <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-5">
                                  {TEAM_COLUMNS.map((column) => {
                                    const members = row.teamColumnMembers[column.key] || [];
                                    const isKeyColumn = isPartnerRole(column.key) || isLeaderRole(column.key);
                                    return (
                                      <div
                                        key={column.key}
                                        className={`p-3 ${isKeyColumn ? 'bg-sky-500/5 ring-1 ring-inset ring-sky-500/20' : 'bg-background'}`}
                                      >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                          <div className={`font-medium ${isKeyColumn ? 'text-sky-700 dark:text-sky-300' : ''}`}>{column.label}</div>
                                          {isExecutive && <div className="text-xs text-muted-foreground">{column.percent}</div>}
                                        </div>
                                        {members.length === 0 && !canManageTeam && <div className="text-sm text-muted-foreground">-</div>}
                                        {members.length === 0 && canManageTeam && (
                                          <EmployeeSearchAdd
                                            employees={assignableEmployees}
                                            disabled={savingProjectId === `${row.id}:add:${column.key}`}
                                            onPick={(employeeId) => addTeamMember(row, column.key, employeeId)}
                                          />
                                        )}
                                        <div className="space-y-2">
                                          {members.map((member: CanonicalTeamMember, memberIndex: number) => {
                                            const memberId = teamMemberId(member);
                                            const percent = memberBonusPercent(member, row.finances);
                                            const amount = memberBonusAmount(member, row.finances);
                                            const savingMember = savingProjectId === `${row.id}:${memberId}`;
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
                                                  {canManageTeam && (
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      className="h-7 shrink-0 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                                      disabled={savingProjectId === `${row.id}:remove:${memberId || memberIndex}`}
                                                      onClick={() => removeTeamMember(row, member, memberIndex)}
                                                    >
                                                      Убрать
                                                    </Button>
                                                  )}
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                  <span className="tabular-nums">{memberProjectHours.approved.toFixed(1)} ч утверждено</span>
                                                  {memberProjectHours.pending > 0 && (
                                                    <span className="font-medium text-amber-700 tabular-nums">
                                                      {memberProjectHours.pending.toFixed(1)} ч ждут
                                                    </span>
                                                  )}
                                                </div>
                                                {isExecutive && (
                                                  <div className="mt-2 flex items-center justify-between gap-2">
                                                    <div className="text-xs text-muted-foreground tabular-nums">{money.format(amount)} ₸</div>
                                                    <div className="flex items-center gap-1">
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        disabled={savingMember || !memberId}
                                                        onClick={() => setMemberBonusPercent(row, member, percent - 1)}
                                                      >
                                                        <Minus className="h-3 w-3" />
                                                      </Button>
                                                      <span className="w-10 text-center text-xs font-semibold tabular-nums">{percent.toFixed(0)}%</span>
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        disabled={savingMember || !memberId}
                                                        onClick={() => setMemberBonusPercent(row, member, percent + 1)}
                                                      >
                                                        <Plus className="h-3 w-3" />
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
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
            </TableBody>
          </table>
        </Card>
      </div>
    </div>
  );
}
