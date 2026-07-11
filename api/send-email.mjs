import {
  getSupabaseAdmin,
  loadEmailConfig,
  parseBody,
  requireMailSender,
  sendMail,
  setCors,
} from './_email-utils.mjs';

export default async function handler(req, res) {
  setCors(res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();
    await requireMailSender(req, supabase);

    const { to, subject, html, text } = parseBody(req);
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, html/text',
      });
    }

    const config = await loadEmailConfig(supabase);
    if (!config) {
      return res.status(500).json({
        success: false,
        message: 'SMTP settings are not configured',
      });
    }

    const info = await sendMail(config, { to, subject, html, text });
    return res.status(200).json({
      success: true,
      message: `Email успешно отправлен на ${to}`,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: `Ошибка отправки: ${error.message}`,
    });
  }
}
