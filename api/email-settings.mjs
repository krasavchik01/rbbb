import {
  getSupabaseAdmin,
  loadEmailConfig,
  normalizeEmailConfig,
  parseBody,
  requireAdmin,
  safeConfig,
  saveEmailConfig,
  setCors,
  validateEmailConfig,
} from './_email-utils.mjs';

export default async function handler(req, res) {
  setCors(res, 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();
    await requireAdmin(req, supabase);

    if (req.method === 'GET') {
      const config = await loadEmailConfig(supabase);
      return res.status(200).json({ success: true, config: safeConfig(config) });
    }

    const body = parseBody(req);
    const existing = await loadEmailConfig(supabase).catch(() => null);
    const config = normalizeEmailConfig(body.config || body, existing);
    validateEmailConfig(config);
    await saveEmailConfig(supabase, config);

    return res.status(200).json({
      success: true,
      message: 'SMTP settings saved',
      config: safeConfig({ ...config, source: 'database' }),
    });
  } catch (error) {
    console.error('email-settings error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Email settings error',
    });
  }
}
