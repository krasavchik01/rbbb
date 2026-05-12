/**
 * Движок опросов: кампании с настраиваемыми вопросами.
 *
 * Кампания = тема + список вопросов + аудитория + срок. Сотрудник проходит
 * кампанию, отправляет submission. Зам.дир смотрит агрегированный результат
 * по каждому проекту (см. surveyAggregator).
 *
 * Хранение: Supabase (survey_campaigns / survey_submissions). Если миграция
 * не применена — fallback на localStorage, чтобы UI работал в любом случае.
 */

import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types/roles';

const LS = {
  CAMPAIGNS: 'rb_survey_campaigns',
  SUBMISSIONS: 'rb_survey_submissions',
};

// ─── Типы ────────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'project_picker'  // используется только при scope=project_picker (выбор проекта)
  | 'year'            // селект года + кнопки годов
  | 'role'            // роль из PROJECT_ROLES
  | 'status_vote'     // голос за статус проекта: in_progress|completed|cancelled
  | 'percent'         // 0–100
  | 'employees'       // мультивыбор сотрудников
  | 'text'            // свободный текст
  | 'choice'          // single choice из options
  | 'date';           // дата

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // для type=choice
}

export type CampaignScope = 'general' | 'project_picker' | 'my_projects';

export type CampaignAudience =
  | { mode: 'all' }
  | { mode: 'roles'; roles: UserRole[] }
  | { mode: 'users'; userIds: string[] };

export type CampaignStatus = 'draft' | 'active' | 'closed';

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  template?: 'where_worked' | 'project_status' | 'confirm_team' | 'custom';
  scope: CampaignScope;
  audience: CampaignAudience;
  questions: Question[];
  status: CampaignStatus;
  deadline?: string;
  startedAt?: string;
  closedAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionItem {
  projectId?: string;
  projectName?: string;
  values: Record<string, any>; // { [questionId]: any }
}

export interface Submission {
  id: string;
  campaignId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  status: 'draft' | 'submitted';
  items: SubmissionItem[];
  submittedAt?: string;
  updatedAt: string;
}

// ─── Local fallback ──────────────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('surveyEngine: write failed', err);
  }
}

let tablesAvailableCache: boolean | null = null;
async function tablesAvailable(): Promise<boolean> {
  if (tablesAvailableCache !== null) return tablesAvailableCache;
  try {
    const { error } = await supabase.from('survey_campaigns' as any).select('id').limit(1);
    tablesAvailableCache = !error;
  } catch {
    tablesAvailableCache = false;
  }
  if (!tablesAvailableCache) {
    console.warn(
      '[surveyEngine] таблицы survey_campaigns/survey_submissions не найдены — работаем через localStorage. Примените миграцию 20260513000000_survey_engine.sql',
    );
  }
  return tablesAvailableCache;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    template: row.template || undefined,
    scope: row.scope || 'general',
    audience: row.audience || { mode: 'all' },
    questions: Array.isArray(row.questions) ? row.questions : [],
    status: row.status || 'draft',
    deadline: row.deadline || undefined,
    startedAt: row.started_at || undefined,
    closedAt: row.closed_at || undefined,
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}
function campaignToRow(c: Campaign) {
  return {
    id: c.id,
    title: c.title,
    description: c.description || null,
    template: c.template || null,
    scope: c.scope,
    audience: c.audience,
    questions: c.questions,
    status: c.status,
    deadline: c.deadline || null,
    started_at: c.startedAt || null,
    closed_at: c.closedAt || null,
    created_by: c.createdBy || null,
    created_by_name: c.createdByName || null,
    updated_at: new Date().toISOString(),
  };
}

function rowToSubmission(row: any): Submission {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    status: row.status || 'draft',
    items: Array.isArray(payload.items) ? payload.items : [],
    submittedAt: row.submitted_at || undefined,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}
function submissionToRow(s: Submission) {
  return {
    campaign_id: s.campaignId,
    user_id: s.userId,
    user_name: s.userName,
    user_role: s.userRole,
    status: s.status,
    payload: { items: s.items },
    submitted_at: s.submittedAt || null,
    updated_at: new Date().toISOString(),
  };
}

// ─── Кампании ────────────────────────────────────────────────────────────────

export async function listCampaigns(): Promise<Campaign[]> {
  if (await tablesAvailable()) {
    const { data, error } = await supabase
      .from('survey_campaigns' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) return data.map(rowToCampaign);
  }
  return readJson<Campaign[]>(LS.CAMPAIGNS, []);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (await tablesAvailable()) {
    const { data } = await supabase
      .from('survey_campaigns' as any)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) return rowToCampaign(data);
  }
  return readJson<Campaign[]>(LS.CAMPAIGNS, []).find((c) => c.id === id) || null;
}

export async function saveCampaign(c: Campaign): Promise<Campaign> {
  const next = { ...c, updatedAt: new Date().toISOString() };
  // local cache
  const all = readJson<Campaign[]>(LS.CAMPAIGNS, []);
  const idx = all.findIndex((x) => x.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeJson(LS.CAMPAIGNS, all);

  if (await tablesAvailable()) {
    const { data } = await supabase
      .from('survey_campaigns' as any)
      .upsert(campaignToRow(next), { onConflict: 'id' })
      .select()
      .maybeSingle();
    if (data) return rowToCampaign(data);
  }
  return next;
}

export async function deleteCampaign(id: string): Promise<void> {
  const local = readJson<Campaign[]>(LS.CAMPAIGNS, []).filter((c) => c.id !== id);
  writeJson(LS.CAMPAIGNS, local);
  if (await tablesAvailable()) {
    await supabase.from('survey_campaigns' as any).delete().eq('id', id);
  }
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function listSubmissions(campaignId?: string): Promise<Submission[]> {
  if (await tablesAvailable()) {
    let q = supabase.from('survey_submissions' as any).select('*');
    if (campaignId) q = q.eq('campaign_id', campaignId);
    const { data, error } = await q.order('updated_at', { ascending: false });
    if (!error && data) return data.map(rowToSubmission);
  }
  const all = readJson<Submission[]>(LS.SUBMISSIONS, []);
  return campaignId ? all.filter((s) => s.campaignId === campaignId) : all;
}

export async function getSubmissionForUser(
  campaignId: string,
  userId: string,
): Promise<Submission | null> {
  if (await tablesAvailable()) {
    const { data } = await supabase
      .from('survey_submissions' as any)
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return rowToSubmission(data);
  }
  const all = readJson<Submission[]>(LS.SUBMISSIONS, []);
  return all.find((s) => s.campaignId === campaignId && s.userId === userId) || null;
}

export async function saveSubmission(s: Submission): Promise<Submission> {
  const next = { ...s, updatedAt: new Date().toISOString() };
  // local cache
  const all = readJson<Submission[]>(LS.SUBMISSIONS, []);
  const idx = all.findIndex((x) => x.campaignId === next.campaignId && x.userId === next.userId);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeJson(LS.SUBMISSIONS, all);

  if (await tablesAvailable()) {
    const { data } = await supabase
      .from('survey_submissions' as any)
      .upsert(submissionToRow(next), { onConflict: 'campaign_id,user_id' })
      .select()
      .maybeSingle();
    if (data) return rowToSubmission(data);
  }
  return next;
}

export async function submitSubmission(s: Submission): Promise<Submission> {
  return saveSubmission({ ...s, status: 'submitted', submittedAt: new Date().toISOString() });
}

export async function deleteSubmission(campaignId: string, userId: string): Promise<void> {
  const local = readJson<Submission[]>(LS.SUBMISSIONS, []).filter(
    (s) => !(s.campaignId === campaignId && s.userId === userId),
  );
  writeJson(LS.SUBMISSIONS, local);
  if (await tablesAvailable()) {
    await supabase
      .from('survey_submissions' as any)
      .delete()
      .eq('campaign_id', campaignId)
      .eq('user_id', userId);
  }
}

// ─── Шаблоны ─────────────────────────────────────────────────────────────────

export function campaignFromTemplate(
  template: 'where_worked' | 'project_status' | 'confirm_team' | 'custom',
  creator: { id: string; name: string },
): Campaign {
  const now = new Date().toISOString();
  const base: Campaign = {
    id: cryptoRandomId(),
    title: '',
    scope: 'project_picker',
    audience: { mode: 'all' },
    questions: [],
    status: 'draft',
    template,
    createdBy: creator.id,
    createdByName: creator.name,
    createdAt: now,
    updatedAt: now,
  };
  switch (template) {
    case 'where_worked':
      return {
        ...base,
        title: 'Где я работал — восстановление команд',
        description:
          'Найдите проекты, в которых вы участвовали, и укажите вашу роль, период и текущий статус проекта.',
        scope: 'project_picker',
        questions: [
          { id: 'role', type: 'role', label: 'Моя роль на проекте', required: true },
          { id: 'year', type: 'year', label: 'В каком году вы это сдавали?', required: true },
          { id: 'status_vote', type: 'status_vote', label: 'Что с проектом сейчас?', required: true },
          { id: 'comment', type: 'text', label: 'Комментарий (необязательно)' },
        ],
      };
    case 'project_status':
      return {
        ...base,
        title: 'Статус моих проектов',
        description:
          'По каждому вашему проекту укажите процент готовности и фактический статус.',
        scope: 'my_projects',
        audience: { mode: 'roles', roles: ['partner', 'project_leader', 'manager_1', 'manager_2', 'manager_3'] },
        questions: [
          { id: 'percent', type: 'percent', label: 'Процент готовности', required: true },
          { id: 'status_vote', type: 'status_vote', label: 'Текущий статус', required: true },
          { id: 'comment', type: 'text', label: 'Что осталось / комментарий' },
        ],
      };
    case 'confirm_team':
      return {
        ...base,
        title: 'Подтверди свою команду',
        description:
          'По каждому вашему проекту проверьте состав команды и при необходимости поправьте.',
        scope: 'my_projects',
        audience: { mode: 'roles', roles: ['partner', 'project_leader'] },
        questions: [
          { id: 'team', type: 'employees', label: 'Кто реально работал на проекте', required: true },
          { id: 'comment', type: 'text', label: 'Комментарий' },
        ],
      };
    case 'custom':
    default:
      return {
        ...base,
        title: 'Новая кампания',
        scope: 'general',
        questions: [],
      };
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Аудитория: подходит ли пользователю эта кампания ────────────────────────

export function audienceMatches(
  audience: CampaignAudience,
  user: { id: string; role: UserRole } | null,
): boolean {
  if (!user) return false;
  if (audience.mode === 'all') return true;
  if (audience.mode === 'roles') return audience.roles.includes(user.role);
  if (audience.mode === 'users') return audience.userIds.includes(user.id);
  return false;
}

export function audienceLabel(a: CampaignAudience): string {
  if (a.mode === 'all') return 'Все сотрудники';
  if (a.mode === 'roles') return `Роли: ${a.roles.length}`;
  if (a.mode === 'users') return `Сотрудники: ${a.userIds.length}`;
  return '';
}
