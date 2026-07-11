import { setCors } from '../_email-utils.mjs';
import { assertCanAccessSeafilePath } from '../_seafile-access.mjs';
import {
  deleteSeafileFile,
  getSeafileConfig,
  isSafeSeafilePath,
  normalizeSeafilePath,
} from '../_seafile-utils.mjs';

export default async function handler(req, res) {
  setCors(res, 'DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const storagePath = normalizeSeafilePath(req.query?.path || '');
    if (!isSafeSeafilePath(storagePath)) {
      return res.status(400).json({ success: false, error: 'Invalid Seafile file path' });
    }

    await assertCanAccessSeafilePath(req, storagePath, { mode: 'write' });

    const config = getSeafileConfig();
    await deleteSeafileFile(config, storagePath);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Seafile delete file error:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Could not delete Seafile file',
    });
  }
}
