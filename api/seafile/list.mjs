import { setCors } from '../_email-utils.mjs';
import { assertCanAccessSeafilePath } from '../_seafile-access.mjs';
import {
  getSeafileConfig,
  isSafeSeafilePath,
  listSeafileDir,
  normalizeSeafilePath,
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
    const dirPath = normalizeSeafilePath(req.query?.path || '/');
    if (!isSafeSeafilePath(dirPath)) {
      return res.status(400).json({ success: false, error: 'Invalid Seafile directory path' });
    }

    await assertCanAccessSeafilePath(req, dirPath, { mode: 'read' });

    const config = getSeafileConfig();
    const entries = await listSeafileDir(config, dirPath);
    return res.status(200).json({ success: true, entries });
  } catch (error) {
    console.error('Seafile list error:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Could not list Seafile directory',
    });
  }
}
