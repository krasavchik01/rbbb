/**
 * Агрегация submissions всех кампаний в предложения по проектам.
 * Не сохраняется в БД — пересчитывается на лету. Это намеренно: меньше
 * рассинхрона между ответами и предложениями.
 *
 * Сохраняются только решения зам.дира (approved/rejected), они отдельно
 * хранятся в project_survey_proposals (legacy таблица — переиспользуем).
 */

import type { Campaign, Submission } from './surveyEngine';
import type { UserRole } from '@/types/roles';

export type ProjectStatusVote = 'in_progress' | 'completed' | 'cancelled' | 'unknown';

export interface ProjectFact {
  // Кто что отметил по проекту
  userId: string;
  userName: string;
  userRole: UserRole;
  campaignId: string;
  campaignTitle: string;
  campaignTemplate?: string;
  // Поля факта (берутся из items.values по типу вопроса)
  roleOnProject?: UserRole;
  year?: number;
  periodFrom?: string;
  periodTo?: string;
  statusVote?: ProjectStatusVote;
  percent?: number;
  teamUserIds?: string[];
  comment?: string;
}

export interface ProjectAggregate {
  projectId: string;
  projectName: string;
  facts: ProjectFact[];
  statusVotes: Record<ProjectStatusVote, number>;
  participantsCount: number;     // уникальных пользователей, кто отметил participated (по любому факту)
  respondentsCount: number;      // уникальных пользователей, кто ответил хоть как-то
  proposedStatus: 'in_progress' | 'completed' | 'cancelled' | null;
  proposedTeam: {
    userId: string;
    userName: string;
    role: UserRole;
    periodFrom?: string;
    periodTo?: string;
  }[];
  avgPercent: number | null;
  confidence: 'low' | 'medium' | 'high';
}

const STATUS_KEY = ['in_progress', 'completed', 'cancelled', 'unknown'] as const;
function isStatus(v: any): v is ProjectStatusVote {
  return STATUS_KEY.includes(v);
}

function yearFromAny(v: any): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n) && n >= 1990 && n <= 2100) return n;
  }
  return undefined;
}

function periodForYear(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Преобразовать один SubmissionItem в plain факт. */
function itemToFact(
  campaign: Campaign,
  submission: Submission,
  projectId: string,
  projectName: string,
  values: Record<string, any>,
): ProjectFact {
  const fact: ProjectFact = {
    userId: submission.userId,
    userName: submission.userName,
    userRole: submission.userRole,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    campaignTemplate: campaign.template,
  };

  for (const q of campaign.questions) {
    const v = values[q.id];
    if (v === undefined || v === null || v === '') continue;
    switch (q.type) {
      case 'role':
        fact.roleOnProject = v as UserRole;
        break;
      case 'year': {
        const y = yearFromAny(v);
        if (y) {
          fact.year = y;
          const p = periodForYear(y);
          fact.periodFrom = p.from;
          fact.periodTo = p.to;
        }
        break;
      }
      case 'date':
        // дата — пока не используем как период, но кладём через специальные id (period_from / period_to)
        if (q.id === 'period_from' || q.id.includes('from')) fact.periodFrom = String(v);
        else if (q.id === 'period_to' || q.id.includes('to')) fact.periodTo = String(v);
        break;
      case 'status_vote':
        if (isStatus(v)) fact.statusVote = v;
        break;
      case 'percent':
        fact.percent = Number(v);
        break;
      case 'employees':
        fact.teamUserIds = Array.isArray(v) ? v : [];
        break;
      case 'text':
        if (q.id.includes('comment') || q.id.includes('note')) fact.comment = String(v);
        break;
      case 'choice':
      case 'project_picker':
      default:
        break;
    }
  }
  return fact;
}

export interface AggregatorInput {
  campaigns: Campaign[];
  submissions: Submission[];
  // справочник имён сотрудников — для employees-вопросов
  employees?: { id: string; name: string }[];
}

export function aggregateProjects(input: AggregatorInput): ProjectAggregate[] {
  const { campaigns, submissions, employees = [] } = input;
  const empById = new Map(employees.map((e) => [e.id, e.name]));
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  // ключ = projectId
  const buckets = new Map<string, { name: string; facts: ProjectFact[] }>();

  for (const sub of submissions) {
    if (sub.status !== 'submitted') continue;
    const campaign = campaignById.get(sub.campaignId);
    if (!campaign) continue;
    for (const item of sub.items) {
      const projectId = item.projectId;
      if (!projectId) continue;
      const bucket = buckets.get(projectId) || {
        name: item.projectName || '',
        facts: [],
      };
      bucket.facts.push(itemToFact(campaign, sub, projectId, bucket.name, item.values || {}));
      if (item.projectName) bucket.name = item.projectName;
      buckets.set(projectId, bucket);
    }
  }

  const out: ProjectAggregate[] = [];

  for (const [projectId, bucket] of buckets) {
    const facts = bucket.facts;
    const statusVotes: Record<ProjectStatusVote, number> = {
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      unknown: 0,
    };
    const respondents = new Set<string>();
    const participantsByUser = new Map<string, ProjectFact>();
    const percents: number[] = [];

    for (const f of facts) {
      respondents.add(f.userId);
      if (f.statusVote) statusVotes[f.statusVote] += 1;
      if (typeof f.percent === 'number' && !Number.isNaN(f.percent)) percents.push(f.percent);
      if (f.roleOnProject) {
        // самый «свежий» факт с ролью побеждает (но т.к. submissions уже последние — берём любой)
        if (!participantsByUser.has(f.userId)) {
          participantsByUser.set(f.userId, f);
        }
      }
      // также если в facts есть teamUserIds — это голос партнёра «состав команды»
      if (f.teamUserIds && f.teamUserIds.length > 0) {
        for (const uid of f.teamUserIds) {
          if (!participantsByUser.has(uid)) {
            participantsByUser.set(uid, {
              ...f,
              userId: uid,
              userName: empById.get(uid) || uid,
              roleOnProject: undefined,
            });
          }
        }
      }
    }

    // Решение по статусу: completed >= in_progress && >= cancelled > 0 → completed
    const informed = statusVotes.in_progress + statusVotes.completed + statusVotes.cancelled;
    let proposedStatus: ProjectAggregate['proposedStatus'] = null;
    if (informed > 0) {
      if (
        statusVotes.completed > 0 &&
        statusVotes.completed >= statusVotes.in_progress &&
        statusVotes.completed >= statusVotes.cancelled
      ) {
        proposedStatus = 'completed';
      } else if (statusVotes.cancelled > 0 && statusVotes.cancelled > statusVotes.in_progress) {
        proposedStatus = 'cancelled';
      } else {
        proposedStatus = 'in_progress';
      }
    }

    // Команда
    const proposedTeam = Array.from(participantsByUser.values()).map((f) => ({
      userId: f.userId,
      userName: f.userName,
      role: f.roleOnProject || ('assistant_1' as UserRole),
      periodFrom: f.periodFrom,
      periodTo: f.periodTo,
    }));

    // Уверенность
    const top = Math.max(statusVotes.in_progress, statusVotes.completed, statusVotes.cancelled);
    const ratio = informed > 0 ? top / informed : 0;
    const confidence: ProjectAggregate['confidence'] =
      informed >= 3 && ratio >= 0.7 ? 'high' : informed >= 2 ? 'medium' : 'low';

    out.push({
      projectId,
      projectName: bucket.name,
      facts,
      statusVotes,
      participantsCount: proposedTeam.length,
      respondentsCount: respondents.size,
      proposedStatus,
      proposedTeam,
      avgPercent: percents.length ? Math.round(percents.reduce((s, x) => s + x, 0) / percents.length) : null,
      confidence,
    });
  }

  return out.sort((a, b) => a.projectName.localeCompare(b.projectName, 'ru'));
}
