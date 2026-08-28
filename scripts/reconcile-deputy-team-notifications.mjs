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

function hasAssignedTeam(project) {
  const notes = project.notes;
  const team = Array.isArray(notes.team) ? notes.team : [];
  return team.length > 0 || Boolean(project.partner_id) || Boolean(project.manager_id);
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

function normalizeProjectName(value) {
  return String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[«»"'`]/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findProjectByLegacyName(projects, name) {
  const normalizedName = normalizeProjectName(name);
  if (!normalizedName) return null;

  const exact = projects.filter((project) => normalizeProjectName(project.name) === normalizedName);
  if (exact.length === 1) return exact[0];

  // Старые уведомления иногда содержат полное/сокращённое название проекта.
  // Берём совпадение только если оно единственное, чтобы не закрыть чужую задачу.
  const fuzzy = projects.filter((project) => {
    const normalizedProjectName = normalizeProjectName(project.name);
    return normalizedProjectName.length >= 12
      && normalizedName.length >= 12
      && (normalizedProjectName.includes(normalizedName) || normalizedName.includes(normalizedProjectName));
  });
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

function looksLikeDeputyTeamTask(notification) {
  return /новый проект|требует утверждения/i.test(`${notification.title || ''} ${notification.message || ''}`)
    && (String(notification.action_url || '') === '/projects?view=working' || Boolean(taskProjectId(notification)));
}

const [{ data: deputies, error: deputyError }, { data: projects, error: projectError }] = await Promise.all([
  supabase.from('employees').select('id,name').eq('role', 'deputy_director'),
  supabase.from('projects').select('id,name,notes,partner_id,manager_id').range(0, 999),
]);
if (deputyError) throw new Error(deputyError.message);
if (projectError) throw new Error(projectError.message);

const completedById = new Map();
const completedByName = new Map();
const projectsById = new Map();
const projectsByName = new Map();
const preparedProjects = (projects || []).map((project) => ({
  ...project,
  notes: notesOf(project.notes),
}));
for (const project of preparedProjects) {
  projectsById.set(String(project.id), project);
  projectsByName.set(normalizeProjectName(project.name), project);
  if (!hasAssignedTeam(project)) continue;
  const prepared = { ...project };
  completedById.set(String(project.id), prepared);
  completedByName.set(normalizeProjectName(project.name), prepared);
}

const candidates = [];
const diagnostics = {
  unreadDeputyNotifications: 0,
  teamTasks: 0,
  linkedToProject: 0,
  linkedButIncomplete: 0,
  notLinked: 0,
  examples: [],
};
for (const deputy of deputies || []) {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', deputy.id)
    .eq('read', false);
  if (error) throw new Error(error.message);
  diagnostics.unreadDeputyNotifications += (notifications || []).length;
  for (const notification of notifications || []) {
    if (!looksLikeDeputyTeamTask(notification)) continue;
    diagnostics.teamTasks += 1;
    const projectId = taskProjectId(notification);
    const projectName = quotedProjectName(notification);
    const linkedProject = projectsById.get(projectId)
      || projectsByName.get(normalizeProjectName(projectName))
      || findProjectByLegacyName(preparedProjects, projectName);
    if (!linkedProject) {
      diagnostics.notLinked += 1;
      if (diagnostics.examples.length < 10) diagnostics.examples.push({ status: 'not-linked', projectName, actionUrl: notification.action_url });
      continue;
    }
    diagnostics.linkedToProject += 1;
    const project = completedById.get(String(linkedProject.id));
    if (project) candidates.push({ deputy, notification, project });
    else {
      diagnostics.linkedButIncomplete += 1;
      if (diagnostics.examples.length < 10) diagnostics.examples.push({
        status: 'incomplete',
        projectName: linkedProject.name,
        teamSize: Array.isArray(linkedProject.notes.team) ? linkedProject.notes.team.length : 0,
      });
    }
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
  diagnostics,
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
      message: `Проект «${project.name}». Действие: команда уже была назначена. Выполнил(а): система HUB.`,
      type: 'success',
      action_url: null,
      read: true,
    });
  if (historyError) failed.push({ notificationId: notification.id, error: historyError.message });
}

console.log(JSON.stringify({ ...summary, archived: candidates.length - failed.length, failed }, null, 2));
if (failed.length > 0) process.exitCode = 1;
