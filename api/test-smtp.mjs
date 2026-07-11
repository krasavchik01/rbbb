import {
  createEmailTransport,
  getSupabaseAdmin,
  loadEmailConfig,
  normalizeEmailConfig,
  parseBody,
  requireAdmin,
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
    await requireAdmin(req, supabase);

    const body = parseBody(req);
    const existing = await loadEmailConfig(supabase).catch(() => null);
    const config = normalizeEmailConfig(body.config || body, existing);
    const testRecipient = String(body.testRecipient || '').trim();

    const transporter = createEmailTransport(config);
    await transporter.verify();

    let delivery = null;
    if (testRecipient) {
      delivery = await sendMail(config, {
        to: testRecipient,
        subject: 'SUITE-A: SMTP test',
        text: 'SMTP подключение работает. Это тестовое письмо из настроек SUITE-A.',
        html: '<p>SMTP подключение работает.</p><p>Это тестовое письмо из настроек SUITE-A.</p>',
      });
    }

    const accepted = Array.isArray(delivery?.accepted) ? delivery.accepted.map(String) : [];
    const rejected = Array.isArray(delivery?.rejected) ? delivery.rejected.map(String) : [];

    if (testRecipient && rejected.length) {
      return res.status(502).json({
        success: false,
        message: `SMTP отклонил письмо для: ${rejected.join(', ')}`,
        messageId: delivery?.messageId || '',
        accepted,
        rejected,
      });
    }

    return res.status(200).json({
      success: true,
      message: testRecipient
        ? `SMTP работает, письмо передано серверу на ${testRecipient}. Message ID: ${delivery?.messageId || 'нет'}`
        : 'SMTP подключение успешно. Для проверки доставки укажите email получателя теста.',
      messageId: delivery?.messageId || '',
      accepted,
      rejected,
    });
  } catch (error) {
    console.error('SMTP test error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: `Ошибка SMTP: ${error.message}`,
    });
  }
}
