#!/usr/bin/env node
/**
 * Moves legacy deputy-director team tasks that are already complete out of
 * active notifications.  It is safe to rerun: only unread task notifications
 * are touched and each archived task gets one explanatory history record.
 *
 * Usage:
 *   node scripts/reconcile-deputy-team-notifications.mjs
 *   node scripts/reconcile-deputy-team-notifications.mjs --apply
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Не найдены учётные данные Supabase.');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function notesOf(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function memberRole(member) {
  return String(member?.role || member?.role_on_project || '').trim().toLowerCase();
}

function memberName(member) {
  return member?.userName || member?.name || member?.employeeName || 'Сотрудник';
}

function isCompleteTeam(notes) {
  const team = Array.isArray(notes.team) ? notes.team : [];
  return team.some((member) => memberRole(member) === 'partner')
    && team.some((member) => ['project_leader', 'manager_1', 'manager_2', 'manager_3'].includes(memberRole(member)));
}

function teamSummary(notes) {
  const team = Array.isArray(notes.team) ? notes.team : [];
  return team.map((member) => `${memberRole(member) || 'роль'} — ${memberName(member)}`).join('; ');
}

function taskProjectId(notification) {
  const action = String(notification.action_url || '');
  const direct = action.match(/[?&]teamProject=([^&]+)/)?.[1];
  if (direct) return decodeURIComponent(direct);
  return '';
}

function quotedProjectName(notification) {
  return String(notification.message || '').match(/["«]([^"»]+)["»]/u)?.[1]?.trim() || '';
}

function looksLikeDeputyTeamTask(notification) {
  return /новый проект|требует утверждения/i.test(`${notification.title || ''} ${notification.message || ''}`)
    && (String(notification.action_url || '') === '/projects?view=working' || Boolean(taskProjectId(notification)));
}

const [{ data: deputies, error: deputyError }, { data: projects, error: projectError }] = await Promise.all([
  supabase.from('employees').select('id,name').eq('role', 'deputy_director'),
  supabase.from('projects').select('id,name,notes').range(0, 999),
]);
if (deputyError) throw new Error(deputyError.message);
if (projectError) throw new Error(projectError.message);

const completedById = new Map();
const completedByName = new Map();
for (const project of projects || []) {
  const notes = notesOf(project.notes);
  if (!isCompleteTeam(notes)) continue;
  const prepared = { id: project.id, name: project.name, notes };
  completedById.set(String(project.id), prepared);
  completedByName.set(String(project.name || '').trim(), prepared);
}

const candidates = [];
for (const deputy of deputies || []) {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', deputy.id)
    .eq('read', false);
  if (error) throw new Error(error.message);
  for (const notification of notifications || []) {
    if (!looksLikeDeputyTeamTask(notification)) continue;
    const project = completedById.get(taskProjectId(notification))
      || completedByName.get(quotedProjectName(notification));
    if (project) candidates.push({ deputy, notification, project });
  }
}

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  completedProjects: completedById.size,
  deputyTasksToArchive: candidates.length,
  examples: candidates.slice(0, 15).map(({ deputy, notification, project }) => ({
    notificationId: notification.id,
    deputy: deputy.name,
    project: project.name,
  })),
};

if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const failed = [];
for (const { deputy, notification, project } of candidates) {
  const { error: archiveError } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notification.id);
  if (archiveError) {
    failed.push({ notificationId: notification.id, error: archiveError.message });
    continue;
  }
  const { error: historyError } = await supabase
    .from('notifications')
    .insert({
      user_id: deputy.id,
      title: '✅ Команда проекта назначена',
      message: `Система: проект «${project.name}» уже имел назначенных партнёра и руководителя. Активная задача закрыта. Состав: ${teamSummary(project.notes)}.`,
      type: 'success',
      action_url: `/projects?teamProject=${encodeURIComponent(project.id)}&team=1`,
      read: true,
    });
  if (historyError) failed.push({ notificationId: notification.id, error: historyError.message });
}

console.log(JSON.stringify({ ...summary, archived: candidates.length - failed.length, failed }, null, 2));
if (failed.length > 0) process.exitCode = 1;
