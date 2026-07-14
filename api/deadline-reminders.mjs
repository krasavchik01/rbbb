import { getSupabaseAdmin, parseBody, requireAdmin, setCors } from './_email-utils.mjs';

function asEnvelope(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.__suiteASettings === 1) {
    return { ...value, companies: Array.isArray(value.companies) ? value.companies : [] };
  }
  return { __suiteASettings: 1, companies: Array.isArray(value) ? value : [] };
}

function normalizeConfig(value) {
  const seen = new Set();
  const recipients = (Array.isArray(value?.recipients) ? value.recipients : [])
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((email) => /^\S+@\S+\.\S+$/.test(email))
    .filter((email) => !seen.has(email) && seen.add(email));
  return { recipients: recipients.slice(0, 50), enabled: value?.enabled !== false };
}

export default async function handler(req, res) {
  setCors(res, 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    await requireAdmin(req, supabase);
    const { data, error } = await supabase.from('app_settings').select('id,companies').limit(1).maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('app_settings row not found');
    const envelope = asEnvelope(data.companies);

    if (req.method === 'GET') {
      return res.status(200).json({ success: true, config: normalizeConfig(envelope.deadlineReminders) });
    }

    const config = normalizeConfig(parseBody(req).config || parseBody(req));
    envelope.deadlineReminders = { ...config, updatedAt: new Date().toISOString() };
    const { error: updateError } = await supabase.from('app_settings').update({ companies: envelope }).eq('id', data.id);
    if (updateError) throw updateError;
    return res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('deadline-reminders error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Deadline reminders error' });
  }
}
