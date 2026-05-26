/**
 * Клиентский CRUD для ai_tasks. RLS на таблице открытая (USING true), поэтому
 * читаем/пишем напрямую с фронта через ANON клиента — без отдельного API route.
 * Server-side вставку делает AI через /api/ai/chat → create_task.
 *
 * Фронт здесь:
 *  - listMyTasks(userId): мои задачи
 *  - listAllTasks(): все задачи (для админа)
 *  - countPendingForUser(userId): счётчик для badge
 *  - updateTaskStatus(taskId, status): сменить статус
 */

import { supabase } from '@/integrations/supabase/client';

export interface AiTask {
  id: string;
  assigned_to: string;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  related_project_id: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  completed_at: string | null;
  created_via: string;
  created_at: string;
  updated_at: string;
}

export async function listMyTasks(userId: string): Promise<AiTask[]> {
  const { data, error } = await supabase
    .from('ai_tasks')
    .select('*')
    .eq('assigned_to', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[aiTasks] listMyTasks failed:', error);
    return [];
  }
  return (data as unknown as AiTask[]) || [];
}

export async function listAllTasks(limit = 200): Promise<AiTask[]> {
  const { data, error } = await supabase
    .from('ai_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[aiTasks] listAllTasks failed:', error);
    return [];
  }
  return (data as unknown as AiTask[]) || [];
}

/** Счётчик «непрочитанных» (pending) задач — для badge в Sidebar */
export async function countPendingForUser(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('ai_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId)
    .in('status', ['pending', 'in_progress']);
  if (error) {
    console.error('[aiTasks] countPending failed:', error);
    return 0;
  }
  return count || 0;
}

export async function updateTaskStatus(
  taskId: string,
  status: AiTask['status'],
): Promise<AiTask | null> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'done') patch.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('ai_tasks')
    .update(patch)
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) {
    console.error('[aiTasks] updateTaskStatus failed:', error);
    return null;
  }
  return data as unknown as AiTask;
}
