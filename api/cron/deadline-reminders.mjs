import { getSupabaseAdmin, loadEmailConfig, sendMail } from '../_email-utils.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSETS = new Set([30, 7, 2]);

function asEnvelope(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.__suiteASettings === 1) {
    return { ...value, companies: Array.isArray(value.companies) ? value.companies : [] };
  }
  return { __suiteASettings: 1, companies: Array.isArray(value) ? value : [] };
}

function dateOnly(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function projectDeadline(project) {
  let notes = project?.notes;
  if (typeof notes === 'string') {
    try { notes = JSON.parse(notes); } catch { notes = {}; }
  }
  return dateOnly(project?.deadline || notes?.contract?.serviceEndDate || notes?.deadline || notes?.contract?.deadline);
}

function daysUntil(isoDate) {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const target = Date.parse(`${isoDate}T00:00:00.000Z`);
  return Math.round((target - start) / DAY_MS);
}

export default async function handler(req, res) {
  const secret = String(process.env.CRON_SECRET || '');
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized cron request' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: settings, error: settingsError } = await supabase.from('app_settings').select('id,companies').limit(1).maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.id) throw new Error('app_settings row not found');
    const envelope = asEnvelope(settings.companies);
    const reminderConfig = envelope.deadlineReminders || {};
    const recipients = Array.isArray(reminderConfig.recipients) ? reminderConfig.recipients.filter((email) => /^\S+@\S+\.\S+$/.test(String(email))) : [];
    if (reminderConfig.enabled === false || recipients.length === 0) return res.status(200).json({ success: true, sent: 0, message: 'No recipients configured' });

    const { data: projects, error: projectsError } = await supabase.from('projects').select('*');
    if (projectsError) throw projectsError;
    const config = await loadEmailConfig(supabase);
    if (!config) throw new Error('SMTP settings are not configured');
    const history = Array.isArray(envelope.deadlineReminderHistory) ? envelope.deadlineReminderHistory : [];
    const sentKeys = new Set(history.map((entry) => entry?.key).filter(Boolean));
    const appUrl = String(process.env.PUBLIC_APP_URL || 'https://hub.rbpartners.kz').replace(/\/+$/, '');
    let sent = 0;

    for (const project of projects || []) {
      if (['completed', 'closed', 'cancelled'].includes(String(project?.status || '').toLowerCase())) continue;
      const deadline = projectDeadline(project);
      if (!deadline) continue;
      const days = daysUntil(deadline);
      if (!OFFSETS.has(days)) continue;
      const key = `${project.id}:${deadline}:${days}`;
      if (sentKeys.has(key)) continue;
      const name = String(project?.name || project?.title || 'Проект');
      const subject = `Срок проекта через ${days} дн.: ${name}`;
      const text = `Внимание: до срока проекта «${name}» осталось ${days} дн. Срок: ${deadline}. Откройте: ${appUrl}/project/${project.id}`;
      await sendMail(config, {
        to: recipients.join(', '),
        subject,
        text,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Контроль срока проекта</h2><p>До срока проекта <strong>${name}</strong> осталось <strong>${days} дн.</strong></p><p>Срок: <strong>${deadline}</strong></p><p><a href="${appUrl}/project/${project.id}">Открыть проект</a></p></div>`,
      });
      history.push({ key, projectId: project.id, deadline, days, sentAt: new Date().toISOString() });
      sentKeys.add(key);
      sent += 1;
    }

    envelope.deadlineReminderHistory = history.slice(-1000);
    if (sent > 0) {
      const { error: updateError } = await supabase.from('app_settings').update({ companies: envelope }).eq('id', settings.id);
      if (updateError) throw updateError;
    }
    return res.status(200).json({ success: true, sent });
  } catch (error) {
    console.error('deadline reminder cron error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Deadline reminder failed' });
  }
}
