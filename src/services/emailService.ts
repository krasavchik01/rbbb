// Email сервис для отправки уведомлений
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private config: EmailConfig | null = null;

  // Настройка email сервера
  setConfig(config: EmailConfig) {
    this.config = config;
    localStorage.setItem('rb_email_config', JSON.stringify(config));
  }

  // Загрузка конфигурации из localStorage
  loadConfig() {
    const saved = localStorage.getItem('rb_email_config');
    if (saved) {
      this.config = JSON.parse(saved);
    }
  }

  // Отправка email (имитация)
  async sendEmail(message: EmailMessage): Promise<boolean> {
    try {
      // Имитация задержки сети
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!this.config) {
        throw new Error('Email сервер не настроен');
      }

      // В реальном приложении здесь будет отправка через SMTP
      console.log('📧 Отправка email:', {
        to: message.to,
        subject: message.subject,
        config: this.config
      });

      // Сохраняем в историю отправленных писем
      const sentEmails = JSON.parse(localStorage.getItem('rb_sent_emails') || '[]');
      sentEmails.push({
        ...message,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });
      localStorage.setItem('rb_sent_emails', JSON.stringify(sentEmails));

      return true;
    } catch (error) {
      console.error('Ошибка отправки email:', error);
      return false;
    }
  }

  // Отправка уведомления о новом проекте
  async sendProjectNotification(projectName: string, managerEmail: string) {
    const message: EmailMessage = {
      to: managerEmail,
      subject: `Новый проект: ${projectName}`,
      text: `Вам назначен новый проект "${projectName}". Проверьте детали в системе.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Новый проект назначен</h2>
          <p>Вам назначен новый проект: <strong>${projectName}</strong></p>
          <p>Проверьте детали проекта в системе RB Partners Suite.</p>
          <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280;">Это автоматическое уведомление от RB Partners Suite</p>
          </div>
        </div>
      `
    };

    return await this.sendEmail(message);
  }

  // Отправка уведомления о новой задаче
  async sendTaskNotification(taskTitle: string, assigneeEmail: string) {
    const message: EmailMessage = {
      to: assigneeEmail,
      subject: `Новая задача: ${taskTitle}`,
      text: `Вам назначена новая задача "${taskTitle}". Проверьте детали в системе.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Новая задача назначена</h2>
          <p>Вам назначена новая задача: <strong>${taskTitle}</strong></p>
          <p>Проверьте детали задачи в системе RB Partners Suite.</p>
          <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280;">Это автоматическое уведомление от RB Partners Suite</p>
          </div>
        </div>
      `
    };

    return await this.sendEmail(message);
  }

  // Отправка уведомления о новом сотруднике
  async sendEmployeeNotification(employeeName: string, hrEmail: string) {
    const message: EmailMessage = {
      to: hrEmail,
      subject: `Новый сотрудник: ${employeeName}`,
      text: `В систему добавлен новый сотрудник "${employeeName}". Проверьте профиль в HR разделе.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5cf6;">Новый сотрудник добавлен</h2>
          <p>В систему добавлен новый сотрудник: <strong>${employeeName}</strong></p>
          <p>Проверьте профиль сотрудника в HR разделе системы.</p>
          <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280;">Это автоматическое уведомление от RB Partners Suite</p>
          </div>
        </div>
      `
    };

    return await this.sendEmail(message);
  }

  // Получение истории отправленных писем
  getSentEmails() {
    return JSON.parse(localStorage.getItem('rb_sent_emails') || '[]');
  }

  // Очистка истории
  clearHistory() {
    localStorage.removeItem('rb_sent_emails');
  }
}

export const emailService = new EmailService();
