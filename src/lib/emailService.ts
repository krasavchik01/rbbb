/**
 * Email Service - работает через API бэкенд
 */

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// API endpoint
const API_BASE = window.location.origin;

// Загрузка конфигурации SMTP из localStorage
export const loadSMTPConfig = (): SMTPConfig | null => {
  try {
    const saved = localStorage.getItem('rb_smtp_config');
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (err) {
    console.error('Error loading SMTP config:', err);
    return null;
  }
};

// Сохранение конфигурации SMTP
export const saveSMTPConfig = (config: SMTPConfig): void => {
  localStorage.setItem('rb_smtp_config', JSON.stringify(config));
};

// Проверка подключения SMTP через API
export const testSMTPConnection = async (config: SMTPConfig): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/test-smtp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: `Ошибка подключения: ${error}`
    };
  }
};

// Шаблон письма с паролем для нового сотрудника
export const getWelcomeEmailTemplate = (employeeName: string, email: string, password: string): EmailTemplate => {
  return {
    subject: '🎉 Добро пожаловать в RB Partners!',
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
          .credential-row { margin: 10px 0; }
          .credential-label { font-weight: bold; color: #667eea; }
          .credential-value { font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Добро пожаловать!</h1>
            <p>RB Partners Group</p>
          </div>
          <div class="content">
            <h2>Здравствуйте, ${employeeName}!</h2>
            <p>Мы рады приветствовать вас в команде RB Partners! Ваш аккаунт был успешно создан.</p>
            
            <div class="credentials">
              <h3>📧 Ваши данные для входа:</h3>
              <div class="credential-row">
                <span class="credential-label">Email:</span>
                <span class="credential-value">${email}</span>
              </div>
              <div class="credential-row">
                <span class="credential-label">Пароль:</span>
                <span class="credential-value">${password}</span>
              </div>
            </div>

            <div class="warning">
              ⚠️ <strong>Важно:</strong> Пожалуйста, смените пароль при первом входе в систему для обеспечения безопасности вашего аккаунта.
            </div>

            <p>Для входа в систему перейдите по ссылке:</p>
            <a href="${window.location.origin}" class="button">Войти в систему →</a>

            <div class="footer">
              <p>Если у вас возникнут вопросы, обращайтесь к администратору.</p>
              <p>© ${new Date().getFullYear()} RB Partners Group. Все права защищены.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Добро пожаловать в RB Partners, ${employeeName}!

Ваши данные для входа:
Email: ${email}
Пароль: ${password}

Пожалуйста, смените пароль при первом входе.

Ссылка для входа: ${window.location.origin}

С уважением,
Команда RB Partners
    `.trim()
  };
};

// Отправка email через API
export const sendEmail = async (
  to: string,
  template: EmailTemplate,
  config?: SMTPConfig
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('📧 Starting email send process...');
    const smtpConfig = config || loadSMTPConfig();
    
    if (!smtpConfig) {
      console.error('❌ No SMTP config found');
      return {
        success: false,
        message: 'SMTP не настроен. Обратитесь к администратору.'
      };
    }

    console.log('📧 SMTP config loaded:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.user,
      from: smtpConfig.from
    });

    console.log('📧 Sending to API:', `${API_BASE}/api/send-email`);
    
    const response = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        config: smtpConfig
      })
    });

    console.log('📧 API response status:', response.status);
    console.log('📧 API response headers:', response.headers);

    const data = await response.json();
    console.log('📧 API response data:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Email send error:', error);
    return {
      success: false,
      message: `Ошибка отправки: ${error}`
    };
  }
};

// Отправка приветственного письма с паролем
export const sendWelcomeEmail = async (
  employeeName: string,
  email: string,
  password: string
): Promise<{ success: boolean; message: string }> => {
  const template = getWelcomeEmailTemplate(employeeName, email, password);
  return await sendEmail(email, template);
};




