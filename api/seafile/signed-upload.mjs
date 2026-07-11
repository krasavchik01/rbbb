import { setCors } from '../_email-utils.mjs';

export default async function handler(req, res) {
  setCors(res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return res.status(410).json({
    success: false,
    error: 'Supabase signed uploads are disabled. Use /api/seafile/upload.',
  });
}

