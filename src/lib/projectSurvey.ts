/**
 * Опрос «Кто в каком проекте участвовал» + автогенерация предложений.
 *
 * Хранение: Supabase (project_survey_responses / project_survey_proposals /
 *           project_survey_config), localStorage используется как fallback,
 *           если таблиц нет (миграция не применена) или нет сети.
 *
 * Идея: сотрудник отправляет ответ → система сразу пересчитывает предложения
 * по каждому проекту (proposed_team + proposed_status). Зам.директор только
 * одобряет/отклоняет — менять команду вручную ему не нужно.
 */

import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types/roles';

const STORAGE_KEYS = {
  CONFIG: 'rb_project_survey_config',
  RESPONSES: 'rb_project_survey_responses',
  PROPOSALS: 'rb_project_survey_proposals',
};

export type SurveyProjectStatusVote =
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'unknown';

export interface SurveyProjectAnswer {
  projectId: string;
  projectName: string;
  participated: boolean;
  roleOnProject?: UserRole;
  periodFrom?: string;       // ISO date — пользователь вводит вручную
  periodTo?: string;         // ISO date
  totalHours?: number;       // суммарно часов на проект за период (для таймщитов)
  statusVote: SurveyProjectStatusVote;
  comment?: string;
}

export interface SurveyResponse {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  answers: SurveyProjectAnswer[];
  status: 'draft' | 'submitted';
  submittedAt?: string;
  updatedAt: string;
}

export interface SurveyConfig {
  enabled: boolean;
  title: string;
  description?: string;
  deadline?: string;
  startedAt?: string;
  startedBy?: string;
  startedByName?: string;
}

const DEFAULT_CONFIG: SurveyConfig = {
  enabled: false,
  title: 'Опрос по участию в проектах',
  description:
    'Отметьте проекты, в которых вы участвовали, укажите вашу роль и период. Это поможет восстановить реальную картину и закрыть завершённые проекты.',
};

export interface ProposedTeamMember {
  userId: string;
  userName: string;
  role: UserRole;
  periodFrom?: string;
  periodTo?: string;
  bonusPercent: number;
}

export interface SurveyProposal {
  id: string;
  projectId: string;
  projectName: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedTeam: ProposedTeamMember[];
  proposedStatus: 'in_progress' | 'completed' | 'cancelled' | null;
  statusVotes: Record<SurveyProjectStatusVote, number>;
  respondentsCount: number;
  participantsCount: number;
  confidence: 'low' | 'medium' | 'high';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  appliedAt?: string;
  overrideNotes?: string;
  generatedAt: string;
  updatedAt: string;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('projectSurvey: write failed', err);
  }
}

let cachedTablesAvailable: boolean | null = null;

async function tablesAvailable(): Promise<boolean> {
  if (cachedTablesAvailable !== null) return cachedTablesAvailable;
  try {
    const { error } = await supabase.from('project_survey_config' as any).select('id').limit(1);
    cachedTablesAvailable = !error;
  } catch {
    cachedTablesAvailable = false;
  }
  if (!cachedTablesAvailable) {
    console.warn(
      '[projectSurvey] Supabase tables not available — using localStorage fallback. ' +
        'Apply migration 20260512000000_add_project_survey.sql to enable shared storage.',
    );
  }
  return cachedTablesAvailable;
}

// ─── Row ↔ object mappers ────────────────────────────────────────────────────

function rowToResponse(row: any): SurveyResponse {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    answers: Array.isArray(row.answers) ? row.answers : [],
    status: row.status,
    submittedAt: row.submitted_at || undefined,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function responseToRow(r: SurveyResponse) {
  return {
    user_id: r.userId,
    user_name: r.userName,
    user_role: r.userRole,
    status: r.status,
    answers: r.answers,
    submitted_at: r.submittedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function rowToProposal(row: any): SurveyProposal {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    status: row.status,
    proposedTeam: Array.isArray(row.proposed_team) ? row.proposed_team : [],
    proposedStatus: row.proposed_status || null,
    statusVotes: row.status_votes || { in_progress: 0, completed: 0, cancelled: 0, unknown: 0 },
    respondentsCount: row.respondents_count || 0,
    participantsCount: row.participants_count || 0,
    confidence: row.confidence || 'low',
    reviewedBy: row.reviewed_by || undefined,
    reviewedByName: row.reviewed_by_name || undefined,
    reviewedAt: row.reviewed_at || undefined,
    appliedAt: row.applied_at || undefined,
    overrideNotes: row.override_notes || undefined,
    generatedAt: row.generated_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function proposalToRow(p: SurveyProposal) {
  return {
    project_id: p.projectId,
    project_name: p.projectName,
    status: p.status,
    proposed_team: p.proposedTeam,
    proposed_status: p.proposedStatus,
    status_votes: p.statusVotes,
    respondents_count: p.respondentsCount,
    participants_count: p.participantsCount,
    confidence: p.confidence,
    reviewed_by: p.reviewedBy || null,
    reviewed_by_name: p.reviewedByName || null,
    reviewed_at: p.reviewedAt || null,
    applied_at: p.appliedAt || null,
    override_notes: p.overrideNotes || null,
    updated_at: new Date().toISOString(),
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getSurveyConfig(): Promise<SurveyConfig> {
  if (await tablesAvailable()) {
    const { data } = await supabase
      .from('project_survey_config' as any)
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (data) {
      return {
        enabled: !!data.enabled,
        title: data.title || DEFAULT_CONFIG.title,
        description: data.description || DEFAULT_CONFIG.description,
        deadline: data.deadline || undefined,
        startedAt: data.started_at || undefined,
        startedBy: data.started_by || undefined,
        startedByName: data.started_by_name || undefined,
      };
    }
  }
  return { ...DEFAULT_CONFIG, ...readJson<Partial<SurveyConfig>>(STORAGE_KEYS.CONFIG, {}) };
}

export async function setSurveyConfig(patch: Partial<SurveyConfig>): Promise<SurveyConfig> {
  const current = await getSurveyConfig();
  const merged = { ...current, ...patch };
  writeJson(STORAGE_KEYS.CONFIG, merged);
  if (await tablesAvailable()) {
    const payload = {
      id: 'default',
      enabled: merged.enabled,
      title: merged.title,
      description: merged.description || null,
      deadline: merged.deadline || null,
      started_at: merged.startedAt || null,
      started_by: merged.startedBy || null,
      started_by_name: merged.startedByName || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('project_survey_config' as any)
      .upsert(payload, { onConflict: 'id' });
    if (error) console.error('[projectSurvey] setSurveyConfig failed', error);
  }
  return merged;
}

export async function startSurvey(
  by: { id: string; name: string },
  deadline?: string,
): Promise<SurveyConfig> {
  return setSurveyConfig({
    enabled: true,
    startedAt: new Date().toISOString(),
    startedBy: by.id,
    startedByName: by.name,
    deadline,
  });
}

export async function stopSurvey(): Promise<SurveyConfig> {
  return setSurveyConfig({ enabled: false });
}

// ─── Responses ───────────────────────────────────────────────────────────────

export async function getAllResponses(): Promise<SurveyResponse[]> {
  if (await tablesAvailable()) {
    const { data, error } = await supabase
      .from('project_survey_responses' as any)
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) return data.map(rowToResponse);
  }
  return readJson<SurveyResponse[]>(STORAGE_KEYS.RESPONSES, []);
}

export async function getResponseForUser(userId: string): Promise<SurveyResponse | null> {
  if (await tablesAvailable()) {
    const { data } = await supabase
      .from('project_survey_responses' as any)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return rowToResponse(data);
  }
  const local = readJson<SurveyResponse[]>(STORAGE_KEYS.RESPONSES, []);
  return local.find((r) => r.userId === userId) ?? null;
}

export async function saveResponse(response: SurveyResponse): Promise<SurveyResponse> {
  const next = { ...response, updatedAt: new Date().toISOString() };
  // local cache
  const all = readJson<SurveyResponse[]>(STORAGE_KEYS.RESPONSES, []);
  const idx = all.findIndex((r) => r.userId === next.userId);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeJson(STORAGE_KEYS.RESPONSES, all);

  if (await tablesAvailable()) {
    const { data, error } = await supabase
      .from('project_survey_responses' as any)
      .upsert(responseToRow(next), { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (error) console.error('[projectSurvey] saveResponse failed', error);
    if (data) return rowToResponse(data);
  }
  return next;
}

export async function submitResponse(response: SurveyResponse): Promise<SurveyResponse> {
  const submitted = await saveResponse({
    ...response,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
  });
  // Авто-перегенерация предложений по всем проектам после submit
  await regenerateProposals();
  return submitted;
}

export async function deleteResponse(userId: string): Promise<void> {
  const local = readJson<SurveyResponse[]>(STORAGE_KEYS.RESPONSES, []).filter(
    (r) => r.userId !== userId,
  );
  writeJson(STORAGE_KEYS.RESPONSES, local);
  if (await tablesAvailable()) {
    await supabase.from('project_survey_responses' as any).delete().eq('user_id', userId);
  }
  await regenerateProposals();
}

export async function clearAllResponses(): Promise<void> {
  writeJson(STORAGE_KEYS.RESPONSES, []);
  writeJson(STORAGE_KEYS.PROPOSALS, []);
  if (await tablesAvailable()) {
    await supabase.from('project_survey_responses' as any).delete().neq('user_id', '');
    await supabase.from('project_survey_proposals' as any).delete().neq('project_id', '');
  }
}

// ─── Proposals (autogenerated) ───────────────────────────────────────────────

export async function getAllProposals(): Promise<SurveyProposal[]> {
  if (await tablesAvailable()) {
    const { data, error } = await supabase
      .from('project_survey_proposals' as any)
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) return data.map(rowToProposal);
  }
  return readJson<SurveyProposal[]>(STORAGE_KEYS.PROPOSALS, []);
}

export async function upsertProposal(p: SurveyProposal): Promise<SurveyProposal> {
  const local = readJson<SurveyProposal[]>(STORAGE_KEYS.PROPOSALS, []);
  const idx = local.findIndex((x) => x.projectId === p.projectId);
  if (idx >= 0) local[idx] = p;
  else local.push(p);
  writeJson(STORAGE_KEYS.PROPOSALS, local);

  if (await tablesAvailable()) {
    const { data, error } = await supabase
      .from('project_survey_proposals' as any)
      .upsert(proposalToRow(p), { onConflict: 'project_id' })
      .select()
      .maybeSingle();
    if (error) console.error('[projectSurvey] upsertProposal failed', error);
    if (data) return rowToProposal(data);
  }
  return p;
}

export async function deleteProposal(projectId: string): Promise<void> {
  const local = readJson<SurveyProposal[]>(STORAGE_KEYS.PROPOSALS, []).filter(
    (p) => p.projectId !== projectId,
  );
  writeJson(STORAGE_KEYS.PROPOSALS, local);
  if (await tablesAvailable()) {
    await supabase.from('project_survey_proposals' as any).delete().eq('project_id', projectId);
  }
}

/**
 * Сформировать кандидатные предложения из ответов.
 * Берёт всех participated=true и собирает команду; голоса по статусу выбирают
 * proposed_status.
 */
export function buildProposalsFromResponses(responses: SurveyResponse[]): SurveyProposal[] {
  const projects = new Map<string, SurveyProposal>();

  for (const r of responses) {
    if (r.status !== 'submitted') continue;
    for (const a of r.answers) {
      let p = projects.get(a.projectId);
      if (!p) {
        p = {
          id: '',
          projectId: a.projectId,
          projectName: a.projectName,
          status: 'pending',
          proposedTeam: [],
          proposedStatus: null,
          statusVotes: { in_progress: 0, completed: 0, cancelled: 0, unknown: 0 },
          respondentsCount: 0,
          participantsCount: 0,
          confidence: 'low',
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        projects.set(a.projectId, p);
      }
      p.respondentsCount += 1;
      p.statusVotes[a.statusVote] = (p.statusVotes[a.statusVote] || 0) + 1;
      if (a.participated) {
        // дедуп по userId — последний ответ переписывает
        p.proposedTeam = p.proposedTeam.filter((m) => m.userId !== r.userId);
        p.proposedTeam.push({
          userId: r.userId,
          userName: r.userName,
          role: a.roleOnProject || ('assistant_1' as UserRole),
          periodFrom: a.periodFrom,
          periodTo: a.periodTo,
          bonusPercent: 0,
        });
      }
    }
  }

  for (const p of projects.values()) {
    p.participantsCount = p.proposedTeam.length;

    // Голосование по статусу: завершён > отменён > идёт > unknown
    const v = p.statusVotes;
    const informed = v.in_progress + v.completed + v.cancelled;
    if (informed === 0) {
      p.proposedStatus = null;
    } else if (v.completed >= v.in_progress && v.completed >= v.cancelled && v.completed > 0) {
      p.proposedStatus = 'completed';
    } else if (v.cancelled > v.in_progress && v.cancelled > 0) {
      p.proposedStatus = 'cancelled';
    } else {
      p.proposedStatus = 'in_progress';
    }

    // Уверенность: high — 3+ ответов и явный лидер (>=70%), medium — 2+, low — иначе
    const total = Math.max(1, informed);
    const top = Math.max(v.in_progress, v.completed, v.cancelled);
    const ratio = top / total;
    if (informed >= 3 && ratio >= 0.7) p.confidence = 'high';
    else if (informed >= 2) p.confidence = 'medium';
    else p.confidence = 'low';
  }

  return Array.from(projects.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName, 'ru'),
  );
}

/**
 * Пересоздать предложения по текущим ответам.
 * Подход: для проектов, где proposal в статусе approved/rejected — НЕ трогаем
 * (зам.дир уже принял решение). Для pending — пересчитываем из ответов.
 */
export async function regenerateProposals(): Promise<SurveyProposal[]> {
  const responses = await getAllResponses();
  const fresh = buildProposalsFromResponses(responses);
  const existing = await getAllProposals();
  const existingByProject = new Map(existing.map((p) => [p.projectId, p]));

  const out: SurveyProposal[] = [];

  for (const candidate of fresh) {
    const prev = existingByProject.get(candidate.projectId);
    if (prev && prev.status !== 'pending') {
      // Решение уже принято — оставляем как есть, но обновляем голоса/команду
      // для информации, не меняя status/applied_at.
      const updated: SurveyProposal = {
        ...prev,
        proposedTeam: candidate.proposedTeam,
        proposedStatus: candidate.proposedStatus,
        statusVotes: candidate.statusVotes,
        respondentsCount: candidate.respondentsCount,
        participantsCount: candidate.participantsCount,
        confidence: candidate.confidence,
        updatedAt: new Date().toISOString(),
      };
      out.push(await upsertProposal(updated));
      existingByProject.delete(candidate.projectId);
      continue;
    }
    const merged: SurveyProposal = {
      ...candidate,
      id: prev?.id || '',
      generatedAt: prev?.generatedAt || candidate.generatedAt,
    };
    out.push(await upsertProposal(merged));
    existingByProject.delete(candidate.projectId);
  }

  // Проекты, по которым ответы пропали — старые pending предложения чистим
  for (const orphan of existingByProject.values()) {
    if (orphan.status === 'pending') {
      await deleteProposal(orphan.projectId);
    } else {
      out.push(orphan);
    }
  }

  return out;
}

export async function approveProposal(
  proposal: SurveyProposal,
  reviewer: { id: string; name: string },
): Promise<SurveyProposal> {
  const next: SurveyProposal = {
    ...proposal,
    status: 'approved',
    reviewedBy: reviewer.id,
    reviewedByName: reviewer.name,
    reviewedAt: new Date().toISOString(),
  };
  return upsertProposal(next);
}

export async function rejectProposal(
  proposal: SurveyProposal,
  reviewer: { id: string; name: string },
  notes?: string,
): Promise<SurveyProposal> {
  const next: SurveyProposal = {
    ...proposal,
    status: 'rejected',
    reviewedBy: reviewer.id,
    reviewedByName: reviewer.name,
    reviewedAt: new Date().toISOString(),
    overrideNotes: notes,
  };
  return upsertProposal(next);
}

export async function markProposalApplied(p: SurveyProposal): Promise<SurveyProposal> {
  return upsertProposal({ ...p, appliedAt: new Date().toISOString() });
}

export async function exportResponsesAsJson(): Promise<string> {
  return JSON.stringify(
    {
      config: await getSurveyConfig(),
      responses: await getAllResponses(),
      proposals: await getAllProposals(),
    },
    null,
    2,
  );
}
