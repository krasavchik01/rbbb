import {
  getSupabaseAdmin,
  loadEmailConfig,
  makeRandomPassword,
  parseBody,
  publicSuccess,
  sendMail,
  setCors,
} from './_email-utils.mjs';

function isUserNotFound(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('user not found') || message.includes('not found');
}

function getActionLink(data) {
  return (
    data?.properties?.action_link ||
    data?.properties?.actionLink ||
    data?.action_link ||
    data?.actionLink ||
    ''
  );
}

function getRecoveryTokenHash(data) {
  const tokenFromProperties = (
    data?.properties?.hashed_token ||
    data?.properties?.hashedToken ||
    data?.hashed_token ||
    data?.hashedToken ||
    ''
  );
  if (tokenFromProperties) return String(tokenFromProperties);

  const actionLink = getActionLink(data);
  try {
    const url = new URL(actionLink);
    return url.searchParams.get('token_hash') || url.searchParams.get('token') || '';
  } catch {
    return '';
  }
}

const FALLBACK_APP_URL = 'https://hub.rbpartners.kz';

function cleanUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.origin.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || ''));
}

function getRequestOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  return cleanUrl(`${proto}://${host}`);
}

function getPublicAppUrl(req, { appUrl, redirectTo }) {
  const candidates = [
    appUrl,
    redirectTo,
    getRequestOrigin(req),
    process.env.PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VITE_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    FALLBACK_APP_URL,
  ];

  for (const candidate of candidates) {
    const origin = cleanUrl(candidate);
    if (origin && !isLocalOrigin(origin)) return origin;
  }

  return FALLBACK_APP_URL;
}

function buildAppRecoveryLink({ appUrl, tokenHash, email }) {
  const url = new URL('/reset-password', appUrl);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'recovery');
  if (email) url.searchParams.set('email', email);
  return url.toString();
}

function forceRedirectInActionLink(actionLink, redirectTo) {
  try {
    const url = new URL(actionLink);
    url.searchParams.set('redirect_to', redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
}

function buildResetEmail({ appUrl, actionLink }) {
  return {
    subject: 'Восстановление пароля HUB',
    text: [
      'Вы запросили восстановление пароля в HUB.',
      '',
      'Откройте ссылку и задайте новый пароль:',
      actionLink,
      '',
      'Если вы не запрашивали восстановление, просто игнорируйте это письмо.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111827;line-height:1.5">
        <h2 style="margin:0 0 16px">Восстановление пароля HUB</h2>
        <p>Вы запросили восстановление пароля.</p>
        <p style="margin:24px 0">
          <a href="${actionLink}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
            Задать новый пароль
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280">Если кнопка не открывается, скопируйте ссылку:</p>
        <p style="font-size:13px;word-break:break-all;color:#374151">${actionLink}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="font-size:12px;color:#6b7280">HUB: ${appUrl}</p>
      </div>
    `,
  };
}

export default async function handler(req, res) {
  setCors(res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const genericMessage = 'Если такой пользователь есть, письмо восстановления отправлено';

  try {
    const body = parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const incomingRedirectTo = String(body.redirectTo || '').trim();
    const incomingAppUrl = String(body.appUrl || '').trim();
    const appUrl = getPublicAppUrl(req, { appUrl: incomingAppUrl, redirectTo: incomingRedirectTo });
    const resetRedirectTo = `${appUrl}/reset-password`;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Некорректный email' });
    }

    const supabase = getSupabaseAdmin();
    const { data: employee } = await supabase
      .from('employees')
      .select('id,email,name,role,level')
      .ilike('email', email)
      .maybeSingle();

    if (!employee) {
      return res.status(200).json(publicSuccess(genericMessage));
    }

    let { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: resetRedirectTo },
    });

    if (linkError && isUserNotFound(linkError)) {
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        password: makeRandomPassword(),
        email_confirm: true,
        user_metadata: {
          name: employee.name,
          role: employee.role,
          employee_id: employee.id,
        },
      });

      if (createError && !String(createError.message || '').toLowerCase().includes('already')) {
        throw createError;
      }

      const retry = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: resetRedirectTo },
      });
      linkData = retry.data;
      linkError = retry.error;
    }

    if (linkError) throw linkError;

    const supabaseActionLink = forceRedirectInActionLink(getActionLink(linkData), resetRedirectTo);
    const tokenHash = getRecoveryTokenHash(linkData);
    const actionLink = tokenHash
      ? buildAppRecoveryLink({ appUrl, tokenHash, email })
      : supabaseActionLink;
    if (!actionLink) throw new Error('Supabase did not return a recovery link');

    const config = await loadEmailConfig(supabase);
    if (!config) throw new Error('SMTP settings are not configured');

    await sendMail(config, {
      to: email,
      ...buildResetEmail({ appUrl: appUrl || resetRedirectTo, actionLink }),
    });

    return res.status(200).json(publicSuccess(genericMessage));
  } catch (error) {
    console.error('password reset email error:', error);
    return res.status(500).json({
      success: false,
      message: `Не удалось отправить письмо восстановления: ${error.message}`,
    });
  }
}
