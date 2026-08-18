import { getSupabaseAdmin } from './_email-utils.mjs';
import { normalizeSeafilePath } from './_seafile-utils.mjs';

const READ_FILE_ROLES = new Set([
  'admin',
  'ceo',
  'deputy_director',
  'company_director',
  'procurement',
]);

const WRITE_FILE_ROLES = new Set([
  'admin',
  'ceo',
  'deputy_director',
  'company_director',
  'procurement',
]);

let supabaseAdminFactory = getSupabaseAdmin;

export function __setSeafileAccessSupabaseFactoryForTests(factory) {
  supabaseAdminFactory = typeof factory === 'function' ? factory : getSupabaseAdmin;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeAccessMode(options) {
  const raw = typeof options === 'string' ? options : options?.mode;
  return raw === 'write' ? 'write' : 'read';
}

function getHeader(req, name) {
  const lower = name.toLowerCase();
  return req.headers?.[lower] || req.headers?.[name] || '';
}

function safeDecode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(role, level) {
  const raw = String(role || '').trim().toLowerCase();
  const normalizedLevel = ['2', '3'].includes(String(level || '')) ? String(level) : '1';

  if (raw === 'it_admin') return 'admin';
  if (raw === 'designer') return 'admin_assistant';
  if (raw === 'project_manager') return 'project_leader';
  if (raw === 'employee') return 'assistant_1';
  if (raw === 'assistant') return `assistant_${normalizedLevel}`;
  if (raw === 'manager') return `manager_${normalizedLevel}`;
  if (raw === 'supervisor') return `supervisor_${normalizedLevel}`;
  if (raw === 'tax_specialist') return `tax_specialist_${normalizedLevel}`;
  return raw;
}

function parseNotes(notes) {
  if (!notes) return {};
  if (typeof notes === 'object') return notes;
  if (typeof notes !== 'string') return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePersonName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .trim();
}

function personMatchKey(value) {
  const tokens = normalizePersonName(value)
    .split(' ')
    .filter((token) => token.length >= 2)
    .filter((token) => !/(ович|евич|улы|ұлы|кызы|қызы)$/u.test(token));
  if (tokens.length >= 2) return tokens.slice(0, 2).sort().join(' ');
  return tokens.join(' ');
}

function objectMatchesUser(value, user) {
  if (!value || typeof value !== 'object') return false;

  const nested = value.employee || value.profile || value.user || {};
  const candidateId = normalizeIdentity(
    value.userId ||
      value.user_id ||
      value.employeeId ||
      value.employee_id ||
      value.partnerId ||
      value.partner_id ||
      nested.id ||
      value.id
  );
  const candidateEmail = normalizeIdentity(
    value.userEmail ||
      value.user_email ||
      value.employeeEmail ||
      value.employee_email ||
      nested.email ||
      value.email
  );
  const candidateName = normalizeIdentity(
    value.userName ||
      value.user_name ||
      value.employeeName ||
      value.employee_name ||
      value.partnerName ||
      value.partner_name ||
      nested.name ||
      nested.full_name ||
      value.name
  );
  const candidateNameKey = personMatchKey(
    value.userName ||
      value.user_name ||
      value.employeeName ||
      value.employee_name ||
      value.partnerName ||
      value.partner_name ||
      nested.name ||
      nested.full_name ||
      value.name
  );

  return (
    (user.idKey && candidateId === user.idKey) ||
    (user.emailKey && candidateEmail === user.emailKey) ||
    (user.nameKey && candidateName === user.nameKey) ||
    (user.personKey && candidateNameKey && candidateNameKey === user.personKey)
  );
}

function notesContainUser(value, user, depth = 0) {
  if (!value || depth > 8) return false;
  if (Array.isArray(value)) {
    return value.some((item) => notesContainUser(item, user, depth + 1));
  }
  if (typeof value !== 'object') return false;
  if (objectMatchesUser(value, user)) return true;
  return Object.values(value).some((item) => notesContainUser(item, user, depth + 1));
}

async function enrichUserFromAuth(req, supabase, fallback) {
  const authorization = getHeader(req, 'authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return fallback;

  const { data } = await supabase.auth.getUser(token);
  const authUser = data?.user;
  if (!authUser?.email) return fallback;

  const { data: employee } = await supabase
    .from('employees')
    .select('id,email,name,role,level')
    .ilike('email', authUser.email)
    .maybeSingle();

  return {
    id: employee?.id || fallback.id || authUser.id,
    email: employee?.email || authUser.email,
    name: employee?.name || fallback.name || authUser.user_metadata?.name || '',
    role: normalizeRole(employee?.role || fallback.role || authUser.app_metadata?.role || authUser.user_metadata?.role, employee?.level),
  };
}

async function enrichUserFromEmployee(req, supabase, fallback) {
  if (!fallback.id) return fallback;

  const { data: employee } = await supabase
    .from('employees')
    .select('id,email,name,role,level')
    .eq('id', fallback.id)
    .maybeSingle();

  if (!employee) return fallback;
  return {
    id: employee.id,
    email: employee.email || fallback.email || '',
    name: employee.name || fallback.name || '',
    role: fallback.role || normalizeRole(employee.role, employee.level),
  };
}

async function getRequestUser(req, supabase) {
  const legacy = {
    id: String(getHeader(req, 'x-suite-user-id') || getHeader(req, 'x-user-id') || '').trim(),
    email: String(getHeader(req, 'x-user-email') || '').trim(),
    name: safeDecode(getHeader(req, 'x-user-name')),
    role: normalizeRole(getHeader(req, 'x-user-role')),
  };

  let user = await enrichUserFromAuth(req, supabase, legacy);
  user = await enrichUserFromEmployee(req, supabase, user);

  const idKey = normalizeIdentity(user.id);
  const emailKey = normalizeIdentity(user.email);
  const nameKey = normalizeIdentity(user.name);
  const personKey = personMatchKey(user.name);

  if (!idKey && !emailKey && !nameKey && !user.role) return null;
  return {
    ...user,
    role: normalizeRole(user.role),
    idKey,
    emailKey,
    nameKey,
    personKey,
  };
}

function assertAuthenticated(user) {
  if (!user) throw httpError(401, 'Authentication is required for file access');
}

function parseSeafileOwner(storagePath) {
  const path = normalizeSeafilePath(storagePath);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'tasks' && parts[1]) {
    return { type: 'task', id: parts[1], path };
  }
  if (parts[0]) {
    return { type: 'project', id: parts[0], path };
  }
  return { type: 'unknown', id: '', path };
}

function userHasReadAccessByRole(user) {
  return READ_FILE_ROLES.has(normalizeRole(user?.role));
}

function userHasWriteAccessByRole(user) {
  return WRITE_FILE_ROLES.has(normalizeRole(user?.role));
}

async function userCanAccessProject(supabase, user, projectId) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id,name,notes,partner_id,manager_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw error;
  if (!project) return false;

  if (user.idKey && [project.partner_id, project.manager_id].some((id) => normalizeIdentity(id) === user.idKey)) {
    return true;
  }

  return notesContainUser(parseNotes(project.notes), user);
}

async function userCanAccessTask(supabase, user, taskId) {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('id,project_id,assignees,reporter')
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw error;
  if (!task) return false;

  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  if (user.idKey && [task.reporter, ...assignees].some((id) => normalizeIdentity(id) === user.idKey)) {
    return true;
  }

  if (task.project_id) {
    return userCanAccessProject(supabase, user, task.project_id);
  }

  return false;
}

export async function assertCanAccessSeafileOwner(req, owner, options = {}) {
  const supabase = supabaseAdminFactory();
  const mode = normalizeAccessMode(options);
  const user = await getRequestUser(req, supabase);
  assertAuthenticated(user);

  // The restricted assistant role must not inherit file access through a
  // stale project-team assignment: contracts and attachments may contain
  // financial or other critical information.
  if (normalizeRole(user?.role) === 'admin_assistant') {
    throw httpError(403, 'No permission to access critical project files');
  }

  if (mode === 'write') {
    if (userHasWriteAccessByRole(user)) {
      return { user, access: 'role', mode };
    }
    throw httpError(403, 'No permission to change this file');
  }

  if (userHasReadAccessByRole(user)) {
    return { user, access: 'role', mode };
  }

  if (owner?.taskId) {
    if (await userCanAccessTask(supabase, user, owner.taskId)) {
      return { user, access: 'task', mode };
    }
    throw httpError(403, 'No access to this task file');
  }

  if (owner?.projectId) {
    if (await userCanAccessProject(supabase, user, owner.projectId)) {
      return { user, access: 'project', mode };
    }
    throw httpError(403, 'No access to this project file');
  }

  throw httpError(403, 'No project or task owner for this file');
}

export async function assertCanAccessSeafilePath(req, storagePath, options = {}) {
  const owner = parseSeafileOwner(storagePath);
  if (owner.type === 'task') {
    return assertCanAccessSeafileOwner(req, { taskId: owner.id }, options);
  }
  if (owner.type === 'project') {
    return assertCanAccessSeafileOwner(req, { projectId: owner.id }, options);
  }
  throw httpError(403, 'No project or task owner for this file');
}
