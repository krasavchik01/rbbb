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

function memberId(member) {
  return member?.userId || member?.user_id || member?.employeeId || member?.employee_id || '';
}

function roleLabel(role) {
  const labels = {
    partner: 'Партнёр',
    project_leader: 'Руководитель',
    project_manager: 'Руководитель',
    manager: 'Руководитель',
    manager_1: 'Менеджер 1',
    manager_2: 'Менеджер 2',
    manager_3: 'Менеджер 3',
    assistant: 'Ассистент',
    assistant_1: 'Ассистент 1',
    assistant_2: 'Ассистент 2',
    assistant_3: 'Ассистент 3',
  };
  return labels[role] || String(role || 'Участник').replace(/_/g, ' ');
}

function projectTeam(project) {
  const notes = project.notes;
  return Array.isArray(notes.team) ? notes.team : [];
}

function hasAssignedTeam(project) {
  const team = projectTeam(project);
  return team.length > 0 || Boolean(project.partner_id) || Boolean(project.manager_id);
}

function workflowStatus(project) {
  const notesStatus = String(project.notes?.status || '').trim().toLowerCase();
  const directStatus = String(project.status || '').trim().toLowerCase();
  return { notesStatus, directStatus };
}

function projectHasWork(project, taskProjectIds, timesheetProjectIds) {
  const { notesStatus, directStatus } = workflowStatus(project);
  const pendingStatuses = new Set(['', 'new', 'pending', 'pending_approval', 'active']);
  return hasAssignedTeam(project)
    || !pendingStatuses.has(notesStatus)
    || !pendingStatuses.has(directStatus)
    || taskProjectIds.has(String(project.id))
    || timesheetProjectIds.has(String(project.id));
}

function taskProjectId(notification) {
  const action = String(notification.action_url || '');
  const direct = action.match(/[?&]teamProject=([^&]+)/)?.[1];
  if (direct) return decodeURIComponent(direct);
  return '';
}

function quotedProjectName(notification) {
  const message = String(notification.message || '');
  // Названия старых проектов часто сами содержат кавычки. Окончание
  // «для клиента» надёжнее первой попавшейся закрывающей кавычки.
  const createdProject = message.match(/создал проект\s+["«]([\s\S]+)["»]\s+для клиента/iu)?.[1]?.trim();
  if (createdProject) return createdProject;
  return message.match(/Проект\s*[«"]([^»"]+)[»"]/iu)?.[1]?.trim()
    || message.match(/["«]([^"»]+)["»]/u)?.[1]?.trim()
    || '';
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
  return /новый проект|требует утверждения/i.test(`${notification.title || ''} ${notification.message || ''}`);
}

const [
  { data: deputies, error: deputyError },
  { data: projects, error: projectError },
  { data: tasks, error: taskError },
  { data: timesheets, error: timesheetError },
] = await Promise.all([
  supabase.from('employees').select('id,name').eq('role', 'deputy_director'),
  supabase.from('projects').select('id,name,status,notes,partner_id,manager_id').range(0, 4999),
  supabase.from('tasks').select('project_id').not('project_id', 'is', null).range(0, 9999),
  supabase.from('timesheets').select('project_id').not('project_id', 'is', null).range(0, 9999),
]);
if (deputyError) throw new Error(deputyError.message);
if (projectError) throw new Error(projectError.message);
if (taskError) throw new Error(taskError.message);
if (timesheetError) throw new Error(timesheetError.message);

const taskProjectIds = new Set((tasks || []).map((task) => String(task.project_id)));
const timesheetProjectIds = new Set((timesheets || []).map((entry) => String(entry.project_id)));

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
  if (!projectHasWork(project, taskProjectIds, timesheetProjectIds)) continue;
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
      // Удалённый либо переименованный проект нельзя открыть и обработать из
      // старого уведомления. Такая строка больше не является рабочей задачей.
      candidates.push({ deputy, notification, project: null });
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
        workflowStatus: workflowStatus(linkedProject),
        teamSize: Array.isArray(linkedProject.notes.team) ? linkedProject.notes.team.length : 0,
        hasTasks: taskProjectIds.has(String(linkedProject.id)),
        hasTimesheets: timesheetProjectIds.has(String(linkedProject.id)),
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
    project: project?.name || quotedProjectName(notification) || 'Проект удалён',
  })),
  diagnostics,
};

if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const failed = [];
const historyRecordedProjects = new Set();
for (const { deputy, notification, project } of candidates) {
  const { error: archiveError } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notification.id);
  if (archiveError) {
    failed.push({ notificationId: notification.id, error: archiveError.message });
    continue;
  }
  const team = project ? projectTeam(project) : [];
  if (project && team.length > 0 && !historyRecordedProjects.has(String(project.id))) {
    historyRecordedProjects.add(String(project.id));
    const partner = team.find((member) => memberRole(member) === 'partner');
    const leader = team.find((member) => memberRole(member) === 'project_leader')
      || team.find((member) => ['project_manager', 'manager', 'manager_1', 'manager_2', 'manager_3'].includes(memberRole(member)));
    const partnerId = partner ? memberId(partner) : '';
    const leaderId = leader ? memberId(leader) : '';
    const members = team
      .filter((member) => {
        const id = memberId(member);
        return member !== partner
          && member !== leader
          && (!partnerId || id !== partnerId)
          && (!leaderId || id !== leaderId);
      })
      .map((member) => `${roleLabel(memberRole(member))}: ${memberName(member)}`);
    const { error: historyError } = await supabase
      .from('notifications')
      .insert({
        user_id: deputy.id,
        title: '✅ Команда проекта назначена',
        message: [
          `Проект «${project.name}»`,
          `Партнёр: ${partner ? memberName(partner) : 'Не назначен'}`,
          `Руководитель: ${leader ? memberName(leader) : 'Не назначен'}`,
          `Команда: ${members.length > 0 ? members.join(' | ') : 'Нет остальных участников'}`,
          'Действие: старая задача закрыта — проект уже был обработан',
          'Выполнил(а): система HUB',
        ].join('\n'),
        type: 'success',
        action_url: null,
        read: true,
      });
    if (historyError) failed.push({ notificationId: notification.id, error: historyError.message });
  }
}

console.log(JSON.stringify({ ...summary, archived: candidates.length - failed.length, failed }, null, 2));
if (failed.length > 0) process.exitCode = 1;
