import { setCors } from '../_email-utils.mjs';
import { assertCanAccessSeafileOwner } from '../_seafile-access.mjs';
import {
  MAX_SEAFILE_FILE_SIZE,
  decodeOriginalFileName,
  getSeafileConfig,
  getSeafileUploadUrl,
  isSafeSeafileRelativePath,
  uniqueSeafileFileName,
} from '../_seafile-utils.mjs';

function requestUserId(req, fallback = 'system') {
  return String(
    req.body?.uploadedBy ||
      req.headers?.['x-suite-user-id'] ||
      req.headers?.['x-user-id'] ||
      fallback
  );
}

export default async function handler(req, res) {
  setCors(res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const projectId = String(req.body?.projectId || '').trim();
    const taskId = String(req.body?.taskId || '').trim();
    const category = String(req.body?.category || 'other').trim() || 'other';
    const uploadedBy = requestUserId(req);
    const fileName = String(req.body?.fileName || 'file').trim() || 'file';
    const fileType = String(req.body?.fileType || 'application/octet-stream').trim() || 'application/octet-stream';
    const fileSize = Number(req.body?.fileSize || 0);
    const relativePath = taskId ? `tasks/${taskId}` : projectId;

    if (!projectId && !taskId) {
      return res.status(400).json({ success: false, error: 'projectId or taskId is required' });
    }
    if (!isSafeSeafileRelativePath(relativePath)) {
      return res.status(400).json({ success: false, error: 'Invalid Seafile upload folder' });
    }
    if (fileSize > MAX_SEAFILE_FILE_SIZE) {
      return res.status(413).json({ success: false, error: 'File is too large for Seafile upload limit' });
    }

    await assertCanAccessSeafileOwner(req, { projectId, taskId }, { mode: 'write' });

    const seafileConfig = getSeafileConfig();
    const displayName = decodeOriginalFileName(fileName);
    const storedName = uniqueSeafileFileName(displayName);
    const uploadUrl = await getSeafileUploadUrl(seafileConfig);
    const storagePath = `/${relativePath}/${storedName}`;
    const now = new Date().toISOString();
    const id = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const baseFile = {
      id,
      name: displayName,
      fileName: displayName,
      storedName,
      fileType,
      fileSize,
      size: fileSize,
      storagePath,
      category,
      uploadedBy,
      uploadedAt: now,
      storage: 'seafile',
      isSeafile: true,
      publicUrl: `seafile://${storagePath}`,
      url: `seafile://${storagePath}`,
    };

    return res.status(200).json({
      success: true,
      uploadUrl,
      form: {
        fileField: 'file',
        fileName: storedName,
        storedName,
        parentDir: '/',
        relativePath,
        replace: '0',
      },
      file: taskId
        ? {
            id,
            name: displayName,
            storedName,
            size: fileSize,
            storagePath,
            uploadedAt: now,
            uploadedBy,
            storage: 'seafile',
            isSeafile: true,
            publicUrl: `seafile://${storagePath}`,
          }
        : {
            ...baseFile,
            projectId,
          },
      storage: 'seafile',
    });
  } catch (error) {
    console.error('Seafile upload-link error:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Could not create Seafile upload link',
    });
  }
}
