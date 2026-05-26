/**
 * Таймщиты — CRUD + bulk insert поверх Supabase-таблицы timesheet_entries.
 *
 * Архитектурное решение (см. memory/project_timesheet_approval.md):
 *   - Одна строка = день × секция (а не агрегат на пару юзер×проект).
 *   - Источники: 'import' (xlsx), 'manual' (Timesheets.tsx), 'survey' (опрос).
 *   - Workflow: draft → submitted → approved | rejected.
 *   - Партнёр проекта (project.partner_id) подтверждает; fallback — зам.директор.
 *   - В Bonuses идут только status='approved' часы.
 *
 * В отличие от projectSurvey.ts здесь НЕТ localStorage-fallback. Раньше он
 * тихо маскировал отсутствие миграции — таймщиты «сохранялись» в браузере
 * сотрудника, а партнёр их не видел. Лучше явная ошибка.
 */

import { supabase } from '@/integrations/supabase/client';

export type TimesheetSource = 'manual' | 'import' | 'survey';
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimesheetEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string | null;
  projectName: string;
  workDate: string;            // ISO date (YYYY-MM-DD)
  hours: number;
  section?: string;
  position?: string;
  location?: string;
  city?: string;
  managerRaw?: string;
  partnerRaw?: string;
  notes?: string;
  source: TimesheetSource;
  importBatchId?: string;
  status: TimesheetStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Поля, которые задаёт автор записи (без id, статусов, аудита).
 * Используется для INSERT — БД сама поставит id/created_at/updated_at/status.
 */
export interface TimesheetEntryDraft {
  employeeId: string;
  employeeName: string;
  projectId: string | null;
  projectName: string;
  workDate: string;
  hours: number;
  section?: string;
  position?: string;
  location?: string;
  city?: string;
  managerRaw?: string;
  partnerRaw?: string;
  notes?: string;
  source: TimesheetSource;
  importBatchId?: string;
  status?: TimesheetStatus;     // по умолчанию 'submitted'
  createdBy?: string;
}

// ─── Row ↔ object mappers ───────────────────────────────────────────────────

function rowToEntry(row: any): TimesheetEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    projectId: row.project_id,
    projectName: row.project_name,
    workDate: row.work_date,
    hours: Number(row.hours) || 0,
    section: row.section ?? undefined,
    position: row.position ?? undefined,
    location: row.location ?? undefined,
    city: row.city ?? undefined,
    managerRaw: row.manager_raw ?? undefined,
    partnerRaw: row.partner_raw ?? undefined,
    notes: row.notes ?? undefined,
    source: (row.source || 'manual') as TimesheetSource,
    importBatchId: row.import_batch_id ?? undefined,
    status: (row.status || 'submitted') as TimesheetStatus,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewerNotes: row.reviewer_notes ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftToRow(d: TimesheetEntryDraft) {
  return {
    employee_id: d.employeeId,
    employee_name: d.employeeName,
    project_id: d.projectId,
    project_name: d.projectName,
    work_date: d.workDate,
    hours: d.hours,
    section: d.section ?? null,
    position: d.position ?? null,
    location: d.location ?? null,
    city: d.city ?? null,
    manager_raw: d.managerRaw ?? null,
    partner_raw: d.partnerRaw ?? null,
    notes: d.notes ?? null,
    source: d.source,
    import_batch_id: d.importBatchId ?? null,
    status: d.status ?? 'submitted',
    created_by: d.createdBy ?? null,
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────

export interface ListFilter {
  employeeId?: string;
  projectId?: string;
  partnerId?: string;            // фильтр через JOIN на projects.partner_id
  status?: TimesheetStatus | TimesheetStatus[];
  source?: TimesheetSource;
  workDateFrom?: string;
  workDateTo?: string;
  importBatchId?: string;
  limit?: number;
}

/**
 * Общий list — все фильтры опциональны. Если задан partnerId, делаем
 * pre-fetch проектов этого партнёра, затем фильтр по projectId.
 */
export async function listTimesheets(filter: ListFilter = {}): Promise<TimesheetEntry[]> {
  let projectIdsForPartner: string[] | null = null;

  if (filter.partnerId) {
    const { data: projs, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .eq('partner_id', filter.partnerId);
    if (projErr) {
      console.error('[timesheets] listTimesheets: partner projects fetch failed', projErr);
      return [];
    }
    projectIdsForPartner = (projs || []).map((p: any) => p.id);
    if (projectIdsForPartner.length === 0) return [];
  }

  let q = supabase.from('timesheet_entries').select('*').order('work_date', { ascending: false });

  if (filter.employeeId) q = q.eq('employee_id', filter.employeeId);
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  if (filter.source) q = q.eq('source', filter.source);
  if (filter.importBatchId) q = q.eq('import_batch_id', filter.importBatchId);
  if (filter.workDateFrom) q = q.gte('work_date', filter.workDateFrom);
  if (filter.workDateTo) q = q.lte('work_date', filter.workDateTo);
  if (filter.status) {
    q = Array.isArray(filter.status) ? q.in('status', filter.status) : q.eq('status', filter.status);
  }
  if (projectIdsForPartner) q = q.in('project_id', projectIdsForPartner);
  if (filter.limit) q = q.limit(filter.limit);

  const { data, error } = await q;
  if (error) {
    console.error('[timesheets] listTimesheets failed', error);
    return [];
  }
  return (data || []).map(rowToEntry);
}

// ─── Insert / update / delete ───────────────────────────────────────────────

export async function createEntry(draft: TimesheetEntryDraft): Promise<TimesheetEntry | null> {
  const { data, error } = await supabase
    .from('timesheet_entries')
    .insert(draftToRow(draft))
    .select()
    .maybeSingle();
  if (error) {
    console.error('[timesheets] createEntry failed', error);
    return null;
  }
  return data ? rowToEntry(data) : null;
}

export async function bulkInsert(drafts: TimesheetEntryDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;
  const { data, error } = await supabase
    .from('timesheet_entries')
    .insert(drafts.map(draftToRow))
    .select('id');
  if (error) {
    console.error('[timesheets] bulkInsert failed', error);
    return 0;
  }
  return data?.length || 0;
}

/**
 * Идемпотентный bulk-импорт: удаляет все строки пачки (по import_batch_id)
 * и вставляет новые. Используется в ImportTimesheet — повторная загрузка
 * того же xlsx не дублирует записи.
 *
 * Внимание: если по этой пачке были approved записи — они тоже удалятся.
 * В UI импорта это должно быть отображено как предупреждение.
 */
export async function replaceBatch(
  importBatchId: string,
  drafts: TimesheetEntryDraft[],
): Promise<{ deleted: number; inserted: number }> {
  // 1) delete old
  const { count: deletedCount, error: delErr } = await supabase
    .from('timesheet_entries')
    .delete({ count: 'exact' })
    .eq('import_batch_id', importBatchId)
    .eq('source', 'import');
  if (delErr) {
    console.error('[timesheets] replaceBatch: delete failed', delErr);
    return { deleted: 0, inserted: 0 };
  }
  // 2) insert new
  const inserted = await bulkInsert(drafts.map((d) => ({ ...d, importBatchId })));
  return { deleted: deletedCount || 0, inserted };
}

export async function updateEntry(
  id: string,
  patch: Partial<Omit<TimesheetEntry, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<TimesheetEntry | null> {
  const row: any = {};
  if (patch.employeeId !== undefined) row.employee_id = patch.employeeId;
  if (patch.employeeName !== undefined) row.employee_name = patch.employeeName;
  if (patch.projectId !== undefined) row.project_id = patch.projectId;
  if (patch.projectName !== undefined) row.project_name = patch.projectName;
  if (patch.workDate !== undefined) row.work_date = patch.workDate;
  if (patch.hours !== undefined) row.hours = patch.hours;
  if (patch.section !== undefined) row.section = patch.section ?? null;
  if (patch.position !== undefined) row.position = patch.position ?? null;
  if (patch.location !== undefined) row.location = patch.location ?? null;
  if (patch.city !== undefined) row.city = patch.city ?? null;
  if (patch.managerRaw !== undefined) row.manager_raw = patch.managerRaw ?? null;
  if (patch.partnerRaw !== undefined) row.partner_raw = patch.partnerRaw ?? null;
  if (patch.notes !== undefined) row.notes = patch.notes ?? null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy ?? null;
  if (patch.reviewedByName !== undefined) row.reviewed_by_name = patch.reviewedByName ?? null;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt ?? null;
  if (patch.reviewerNotes !== undefined) row.reviewer_notes = patch.reviewerNotes ?? null;

  const { data, error } = await supabase
    .from('timesheet_entries')
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) {
    console.error('[timesheets] updateEntry failed', error);
    return null;
  }
  return data ? rowToEntry(data) : null;
}

export async function deleteEntry(id: string): Promise<boolean> {
  const { error } = await supabase.from('timesheet_entries').delete().eq('id', id);
  if (error) {
    console.error('[timesheets] deleteEntry failed', error);
    return false;
  }
  return true;
}

// ─── Approval helpers ───────────────────────────────────────────────────────

export async function approveEntries(
  ids: string[],
  reviewer: { id: string; name: string },
): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from('timesheet_entries')
    .update({
      status: 'approved',
      reviewed_by: reviewer.id,
      reviewed_by_name: reviewer.name,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: null,
    })
    .in('id', ids)
    .select('id');
  if (error) {
    console.error('[timesheets] approveEntries failed', error);
    return 0;
  }
  return data?.length || 0;
}

export async function rejectEntries(
  ids: string[],
  reviewer: { id: string; name: string },
  reason: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from('timesheet_entries')
    .update({
      status: 'rejected',
      reviewed_by: reviewer.id,
      reviewed_by_name: reviewer.name,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reason || null,
    })
    .in('id', ids)
    .select('id');
  if (error) {
    console.error('[timesheets] rejectEntries failed', error);
    return 0;
  }
  return data?.length || 0;
}

// ─── Aggregation helpers (для Bonuses и сводок) ─────────────────────────────

export interface HoursByPair {
  employeeId: string;
  projectId: string;
  hours: number;
}

/**
 * Сумма approved-часов по парам (сотрудник × проект).
 * Bonuses.tsx переключается на это вместо чтения из project_survey_responses.
 */
export async function approvedHoursIndex(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('timesheet_entries')
    .select('employee_id, project_id, hours')
    .eq('status', 'approved');
  if (error) {
    console.error('[timesheets] approvedHoursIndex failed', error);
    return new Map();
  }
  const idx = new Map<string, number>();
  for (const r of data || []) {
    if (!r.project_id) continue;
    const key = `${r.employee_id}__${r.project_id}`;
    idx.set(key, (idx.get(key) || 0) + (Number(r.hours) || 0));
  }
  return idx;
}

// ─── Утилиты для импорта ────────────────────────────────────────────────────

/**
 * Стабильный хэш для import_batch_id. Принимает имя файла + размер + первые
 * N байт содержимого. SubtleCrypto использует SHA-256, формат hex.
 *
 * Не криптографическая защита — просто способ узнать «тот же файл или новый».
 */
export async function makeImportBatchId(file: File): Promise<string> {
  const slice = await file.slice(0, 64 * 1024).arrayBuffer();
  const buf = new Uint8Array(slice);
  // Включаем имя и размер, чтобы два разных файла с одинаковым началом не схлопнулись
  const meta = new TextEncoder().encode(`${file.name}|${file.size}|`);
  const combined = new Uint8Array(meta.length + buf.length);
  combined.set(meta, 0);
  combined.set(buf, meta.length);
  const digest = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
