/**
 * Vercel Serverless Function для отправки email через SMTP
 * Путь: /api/send-email
 */

import nodemailer from 'nodemailer';

export default async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text, config } = req.body;

    if (!to || !subject || (!html && !text) || !config) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: to, subject, html/text, config' 
      });
    }

    // Создаем транспорт для отправки
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true для 465, false для других портов
      auth: {
        user: config.user,
        pass: config.password
      },
      tls: {
        rejectUnauthorized: false // Для самоподписанных сертификатов
      }
    });

    // Проверяем подключение
    await transporter.verify();

    // Отправляем email
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.from}>`,
      to: to,
      subject: subject,
      text: text,
      html: html
    });

    console.log('Email sent:', info.messageId);

    return res.status(200).json({
      success: true,
      message: `Email успешно отправлен на ${to}`,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({
      success: false,
      message: `Ошибка отправки: ${error.message}`
    });
  }
};

