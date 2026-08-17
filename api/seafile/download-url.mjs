import { setCors } from '../_email-utils.mjs';
import { assertCanAccessSeafilePath } from '../_seafile-access.mjs';
import {
  getSeafileConfig,
  getSeafileDownloadUrl,
  isSafeSeafilePath,
  normalizeSeafilePath,
  toSeafileBrowserUrl,
} from '../_seafile-utils.mjs';

export default async function handler(req, res) {
  setCors(res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const storagePath = normalizeSeafilePath(req.query?.path || '');
    if (!isSafeSeafilePath(storagePath)) {
      return res.status(400).json({ success: false, error: 'Invalid Seafile file path' });
    }

    await assertCanAccessSeafilePath(req, storagePath, { mode: 'read' });

    const config = getSeafileConfig();
    const directUrl = await getSeafileDownloadUrl(config, storagePath);
    const url = toSeafileBrowserUrl(config, directUrl);
    return res.status(200).json({ success: true, url });
  } catch (error) {
    console.error('Seafile download-url error:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Could not get Seafile download url',
    });
  }
}
