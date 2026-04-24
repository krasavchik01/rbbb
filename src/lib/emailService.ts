/**
 * Email Service - SMTP конфиг из Supabase, отправка через Vercel API
 */

import { getAppSettings, saveAppSettings, type SMTPConfig } from './appSettings';

export type { SMTPConfig };

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// API endpoint
const getAPIBase = (): string => {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  } catch {}
  return '';
};

// Загрузка SMTP конфига из Supabase (через appSettings)
export const loadSMTPConfig = async (): Promise<SMTPConfig | null> => {
  try {
    const settings = await getAppSettings();
    return settings.smtp || null;
  } catch (err) {
    console.error('Error loading SMTP config:', err);
    return null;
  }
};

// Синхронная версия — из кеша (для быстрого доступа)
let _cachedSmtp: SMTPConfig | null = null;
export const loadSMTPConfigSync = (): SMTPConfig | null => {
  // При первом вызове пробуем из localStorage как фоллбэк
  if (!_cachedSmtp) {
    try {
      const saved = localStorage.getItem('rb_smtp_config');
      if (saved) _cachedSmtp = JSON.parse(saved);
    } catch {}
  }
  return _cachedSmtp;
};

// Сохранение SMTP конфига в Supabase
export const saveSMTPConfig = async (config: SMTPConfig): Promise<void> => {
  _cachedSmtp = config;
  // Сохраняем и в localStorage как кеш, и в Supabase как основное хранилище
  localStorage.setItem('rb_smtp_config', JSON.stringify(config));
  await saveAppSettings({ smtp: config } as any);
};

// Проверка подключения SMTP через API
export const testSMTPConnection = async (config: SMTPConfig): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${getAPIBase()}/api/test-smtp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });
    return await response.json();
  } catch (error) {
    return { success: false, message: `Ошибка подключения: ${error}` };
  }
};

// Шаблон приветственного письма
export const getWelcomeEmailTemplate = (employeeName: string, email: string, password: string): EmailTemplate => ({
  subject: 'Добро пожаловать в RB Partners!',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .credential-label { font-weight: bold; color: #667eea; }
        .credential-value { font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Добро пожаловать!</h1>
          <p>RB Partners Group</p>
        </div>
        <div class="content">
          <h2>Здравствуйте, ${employeeName}!</h2>
          <p>Ваш аккаунт в системе RB Partners создан.</p>
          <div class="credentials">
            <h3>Данные для входа:</h3>
            <div style="margin:10px 0"><span class="credential-label">Email:</span> <span class="credential-value">${email}</span></div>
            <div style="margin:10px 0"><span class="credential-label">Пароль:</span> <span class="credential-value">${password}</span></div>
          </div>
          <div class="warning">Пожалуйста, смените пароль при первом входе.</div>
          <p>Ссылка для входа: <a href="${getAPIBase()}">${getAPIBase()}</a></p>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} RB Partners Group</p></div>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `Здравствуйте, ${employeeName}!\n\nВаши данные для входа:\nEmail: ${email}\nПароль: ${password}\n\nСсылка: ${getAPIBase()}\n\nСмените пароль при первом входе.`
});

// Отправка email через Vercel API
export const sendEmail = async (
  to: string,
  template: EmailTemplate,
  config?: SMTPConfig
): Promise<{ success: boolean; message: string }> => {
  try {
    const smtpConfig = config || await loadSMTPConfig() || loadSMTPConfigSync();

    if (!smtpConfig) {
      return { success: false, message: 'SMTP не настроен. Настройте в Админке → SMTP Настройки.' };
    }

    const response = await fetch(`${getAPIBase()}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        config: smtpConfig
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, message: `Ошибка отправки: ${error}` };
  }
};

// Отправка приветственного письма
export const sendWelcomeEmail = async (
  employeeName: string,
  email: string,
  password: string
): Promise<{ success: boolean; message: string }> => {
  const template = getWelcomeEmailTemplate(employeeName, email, password);
  return await sendEmail(email, template);
};
