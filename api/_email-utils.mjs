import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://mknvqsnitzaurpwnhzwn.supabase.co';

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  '';

const ADMIN_ROLES = new Set(['admin']);
const MAIL_SEND_ROLES = new Set(['admin', 'ceo', 'deputy_director', 'hr', 'procurement', 'accountant']);

export function setCors(res, methods = 'GET,POST,OPTIONS') {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Suite-User-Id, X-User-Id, X-User-Name, X-User-Role');
}

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function getHeader(req, name) {
  const lower = name.toLowerCase();
  return req.headers?.[lower] || req.headers?.[name] || '';
}

export async function getRequestUser(req, supabase) {
  const authorization = getHeader(req, 'authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (token) {
    const { data } = await supabase.auth.getUser(token);
    const authUser = data?.user;
    if (authUser?.email) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id,email,name,role,level')
        .ilike('email', authUser.email)
        .maybeSingle();

      return {
        id: employee?.id || authUser.id,
        email: authUser.email,
        role: employee?.role || authUser.app_metadata?.role || authUser.user_metadata?.role || null,
      };
    }
  }

  const legacyUserId = getHeader(req, 'x-suite-user-id');
  if (legacyUserId) {
    const { data: employee } = await supabase
      .from('employees')
      .select('id,email,name,role,level')
      .eq('id', legacyUserId)
      .maybeSingle();

    if (employee) {
      return { id: employee.id, email: employee.email, role: employee.role || null };
    }
  }

  return null;
}

export async function requireAdmin(req, supabase) {
  const user = await getRequestUser(req, supabase);
  if (!user || !ADMIN_ROLES.has(String(user.role || ''))) {
    const error = new Error('Only admin can manage email settings');
    error.statusCode = 403;
    throw error;
  }
  return user;
}

export async function requireMailSender(req, supabase) {
  const user = await getRequestUser(req, supabase);
  if (!user || !MAIL_SEND_ROLES.has(String(user.role || ''))) {
    const error = new Error('Not allowed to send system email');
    error.statusCode = 403;
    throw error;
  }
  return user;
}

export function envEmailConfig() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST || '';
  const user = process.env.SMTP_USER || process.env.MAIL_USER || '';
  const password = process.env.SMTP_PASSWORD || process.env.MAIL_PASSWORD || '';
  if (!host || !user || !password) return null;

  const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 465);
  return {
    host,
    port,
    secure: String(process.env.SMTP_SECURE ?? process.env.MAIL_SECURE ?? port === 465).toLowerCase() !== 'false',
    user,
    password,
    from: process.env.SMTP_FROM || process.env.MAIL_FROM || user,
    fromName: process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'HUB',
    source: 'env',
  };
}

export function rowToConfig(row) {
  if (!row) return null;
  return {
    host: row.host || '',
    port: Number(row.port || 465),
    secure: row.secure !== false,
    user: row.username || '',
    password: row.password || '',
    from: row.from_email || row.username || '',
    fromName: row.from_name || 'HUB',
    source: 'database',
  };
}

export function safeConfig(config) {
  if (!config) return null;
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    password: '',
    from: config.from,
    fromName: config.fromName,
    hasPassword: Boolean(config.password),
    source: config.source || 'database',
  };
}

function encryptionKey() {
  return crypto.createHash('sha256').update(SERVICE_ROLE_KEY).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decryptSecret(payload) {
  if (!payload?.iv || !payload?.tag || !payload?.data) return '';
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function toSettingsEnvelope(rawCompanies) {
  if (rawCompanies && typeof rawCompanies === 'object' && !Array.isArray(rawCompanies) && rawCompanies.__suiteASettings === 1) {
    return {
      ...rawCompanies,
      companies: Array.isArray(rawCompanies.companies) ? rawCompanies.companies : [],
    };
  }

  return {
    __suiteASettings: 1,
    companies: Array.isArray(rawCompanies) ? rawCompanies : [],
  };
}

function envelopeEmailToConfig(email) {
  if (!email) return null;
  let password = '';
  try {
    password = decryptSecret(email.passwordEncrypted);
  } catch (error) {
    console.error('Failed to decrypt SMTP password:', error);
  }

  return {
    host: email.host || '',
    port: Number(email.port || 465),
    secure: email.secure !== false,
    user: email.user || '',
    password,
    from: email.from || email.user || '',
    fromName: email.fromName || 'HUB',
    source: 'database',
  };
}

function isMissingEmailSettingsTable(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42P01' || message.includes('email_settings') || message.includes('relation');
}

async function loadEmailConfigFromAppSettings(supabase) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('companies')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const envelope = toSettingsEnvelope(data?.companies);
  return envelopeEmailToConfig(envelope.emailSettings) || envEmailConfig();
}

async function saveEmailConfigToAppSettings(supabase, config) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('id, companies')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('app_settings row not found');

  const envelope = toSettingsEnvelope(data.companies);
  envelope.emailSettings = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    passwordEncrypted: encryptSecret(config.password),
    from: config.from,
    fromName: config.fromName,
    updatedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('app_settings')
    .update({ companies: envelope })
    .eq('id', data.id);

  if (updateError) throw updateError;
}

export async function loadEmailConfig(supabase) {
  let response = await supabase
    .from('email_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (response.error && isMissingEmailSettingsTable(response.error)) {
    return loadEmailConfigFromAppSettings(supabase);
  }

  if (response.error) {
    const fallback = envEmailConfig();
    if (fallback) return fallback;
    throw response.error;
  }

  return rowToConfig(response.data) || loadEmailConfigFromAppSettings(supabase);
}

export function normalizeEmailConfig(input, existing = null) {
  const port = Number(input?.port || existing?.port || 465);
  const password = String(input?.password || '').trim() || existing?.password || '';
  return {
    host: String(input?.host || existing?.host || '').trim(),
    port,
    secure: typeof input?.secure === 'boolean' ? input.secure : port === 465,
    user: String(input?.user || existing?.user || '').trim(),
    password,
    from: String(input?.from || input?.user || existing?.from || existing?.user || '').trim(),
    fromName: String(input?.fromName || existing?.fromName || 'HUB').trim(),
  };
}

export function validateEmailConfig(config) {
  const missing = [];
  if (!config.host) missing.push('SMTP host');
  if (!config.port) missing.push('SMTP port');
  if (!config.user) missing.push('SMTP login');
  if (!config.password) missing.push('SMTP password');
  if (!config.from) missing.push('sender email');
  if (!config.fromName) missing.push('sender name');
  if (missing.length) {
    throw new Error(`Missing email settings: ${missing.join(', ')}`);
  }
}

export async function saveEmailConfig(supabase, config) {
  let read = await supabase
    .from('email_settings')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (read.error && isMissingEmailSettingsTable(read.error)) {
    await saveEmailConfigToAppSettings(supabase, config);
    return;
  }

  if (read.error) throw read.error;

  const payload = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.user,
    password: config.password,
    from_email: config.from,
    from_name: config.fromName,
    updated_at: new Date().toISOString(),
  };

  if (read.data?.id) {
    const { error } = await supabase.from('email_settings').update(payload).eq('id', read.data.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('email_settings').insert(payload);
  if (error) throw error;
}

export function createEmailTransport(config) {
  validateEmailConfig(config);
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendMail(config, message) {
  const transporter = createEmailTransport(config);
  await transporter.verify();
  return transporter.sendMail({
    from: `${config.fromName} <${config.from}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export function makeRandomPassword() {
  return `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
}

export function publicSuccess(message = 'OK') {
  return { success: true, message };
}
