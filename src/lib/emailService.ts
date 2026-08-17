import { supabase } from '@/integrations/supabase/client';

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  hasPassword?: boolean;
  source?: 'database' | 'env';
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface DeadlineReminderConfig {
  recipients: string[];
  enabled: boolean;
}

const getAPIBase = (): string => {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  } catch {
    // Browser-only helper; keep server-side rendering safe.
  }
  return '';
};

const getPublicAppBase = (): string => {
  const envUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = window.location.origin.replace(/\/+$/, '');
      if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return origin;
      }
    }
  } catch {
    // Browser-only helper; keep server-side rendering safe.
  }

  return 'https://hub.rbpartners.kz';
};

const getStoredUserId = (): string => {
  try {
    const saved = localStorage.getItem('user');
    if (!saved) return '';
    const user = JSON.parse(saved);
    return String(user?.id || '');
  } catch {
    return '';
  }
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Legacy logins may not have a Supabase Auth session yet.
  }

  const userId = getStoredUserId();
  if (userId) headers['X-Suite-User-Id'] = userId;

  return headers;
};

async function readJSON(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

export const loadSMTPConfig = async (): Promise<SMTPConfig | null> => {
  try {
    const response = await fetch(`${getAPIBase()}/api/email-settings`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
    const payload = await readJSON(response);
    return payload.config || null;
  } catch (error) {
    console.error('Error loading SMTP config:', error);
    return null;
  }
};

export const saveSMTPConfig = async (config: SMTPConfig): Promise<SMTPConfig | null> => {
  const response = await fetch(`${getAPIBase()}/api/email-settings`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ config }),
  });
  const payload = await readJSON(response);
  return payload.config || null;
};

export const testSMTPConnection = async (
  config: SMTPConfig,
  testRecipient?: string
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${getAPIBase()}/api/test-smtp`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ config, testRecipient }),
  });
  return readJSON(response);
};

export const loadDeadlineReminderConfig = async (): Promise<DeadlineReminderConfig> => {
  const response = await fetch(`${getAPIBase()}/api/deadline-reminders`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  const payload = await readJSON(response);
  return payload.config || { recipients: [], enabled: true };
};

export const saveDeadlineReminderConfig = async (config: DeadlineReminderConfig): Promise<DeadlineReminderConfig> => {
  const response = await fetch(`${getAPIBase()}/api/deadline-reminders`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ config }),
  });
  const payload = await readJSON(response);
  return payload.config || config;
};

export const requestPasswordResetEmail = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  const appUrl = getPublicAppBase();
  const response = await fetch(`${getAPIBase()}/api/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      appUrl,
      redirectTo: `${appUrl}/reset-password`,
    }),
  });
  return readJSON(response);
};

export const getWelcomeEmailTemplate = (employeeName: string, email: string, password: string): EmailTemplate => ({
  subject: 'Добро пожаловать в HUB',
  html: `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111827;line-height:1.5">
      <h2 style="margin:0 0 16px">Добро пожаловать в HUB</h2>
      <p>Здравствуйте, ${employeeName}.</p>
      <p>Ваш аккаунт создан. Используйте эти данные для первого входа:</p>
      <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px"><strong>Email:</strong> ${email}</p>
        <p style="margin:0"><strong>Пароль:</strong> ${password}</p>
      </div>
      <p>После входа пароль можно сменить в настройках безопасности.</p>
      <p><a href="${getPublicAppBase()}" style="color:#0284c7">Открыть HUB</a></p>
    </div>
  `,
  text: [
    `Здравствуйте, ${employeeName}.`,
    '',
    'Ваш аккаунт создан.',
    `Email: ${email}`,
    `Пароль: ${password}`,
    '',
    `Вход: ${getPublicAppBase()}`,
  ].join('\n'),
});

export const sendEmail = async (
  to: string,
  template: EmailTemplate
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${getAPIBase()}/api/send-email`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }),
    });

    return readJSON(response);
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, message: `Ошибка отправки: ${error instanceof Error ? error.message : error}` };
  }
};

export const sendWelcomeEmail = async (
  employeeName: string,
  email: string,
  password: string
): Promise<{ success: boolean; message: string }> => {
  return sendEmail(email, getWelcomeEmailTemplate(employeeName, email, password));
};
