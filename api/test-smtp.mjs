/**
 * Vercel Serverless Function для тестирования SMTP подключения
 * Путь: /api/test-smtp
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
    const { config } = req.body;

    if (!config || !config.host || !config.port || !config.user || !config.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Заполните все обязательные поля' 
      });
    }

    // Создаем транспорт для тестирования
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Проверяем подключение
    await transporter.verify();

    return res.status(200).json({
      success: true,
      message: 'Подключение успешно! SMTP сервер доступен.'
    });

  } catch (error) {
    console.error('SMTP test error:', error);
    return res.status(500).json({
      success: false,
      message: `Ошибка подключения: ${error.message}`
    });
  }
};

