import multer from 'multer';
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

export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 25,
    fileSize: MAX_SEAFILE_FILE_SIZE,
  },
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
  });
}

function requestUserId(req, fallback = 'system') {
  return String(
    req.body?.uploadedBy ||
      req.headers?.['x-suite-user-id'] ||
      req.headers?.['x-user-id'] ||
      fallback
  );
}

async function uploadOneFile({ config, file, projectId, taskId, category, uploadedBy }) {
  const relativePath = taskId ? `tasks/${taskId}` : projectId;
  if (!isSafeSeafileRelativePath(relativePath)) {
    const error = new Error('Invalid Seafile upload folder');
    error.statusCode = 400;
    throw error;
  }

  const displayName = decodeOriginalFileName(file.originalname);
  const storedName = uniqueSeafileFileName(displayName);
  const uploadUrl = await getSeafileUploadUrl(config);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
    storedName
  );
  formData.append('parent_dir', '/');
  formData.append('relative_path', relativePath);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Token ${config.seafileToken}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    const details = await uploadRes.text().catch(() => '');
    const error = new Error(`Could not upload file to Seafile: ${uploadRes.status}${details ? ` ${details}` : ''}`);
    error.statusCode = 502;
    throw error;
  }

  const storagePath = `/${relativePath}/${storedName}`;
  const now = new Date().toISOString();
  const baseRecord = {
    id: `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fileName: displayName,
    name: displayName,
    storedName,
    fileType: file.mimetype || 'application/octet-stream',
    fileSize: file.size || 0,
    storagePath,
    category,
    uploadedBy,
    uploadedAt: now,
    storage: 'seafile',
    isSeafile: true,
    publicUrl: `seafile://${storagePath}`,
    url: `seafile://${storagePath}`,
  };

  if (taskId) {
    return {
      id: baseRecord.id,
      name: displayName,
      storedName,
      size: file.size || 0,
      storagePath,
      uploadedAt: now,
      uploadedBy,
      storage: 'seafile',
      isSeafile: true,
      publicUrl: `seafile://${storagePath}`,
    };
  }

  return {
    ...baseRecord,
    projectId,
  };
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
    await runMiddleware(req, res, upload.any());

    const projectId = String(req.body?.projectId || '').trim();
    const taskId = String(req.body?.taskId || '').trim();
    const category = String(req.body?.category || 'other').trim() || 'other';
    const uploadedBy = requestUserId(req);
    const files = Array.isArray(req.files) ? req.files : [];

    if (!projectId && !taskId) {
      return res.status(400).json({ success: false, error: 'projectId or taskId is required' });
    }
    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'file is required' });
    }

    await assertCanAccessSeafileOwner(req, { projectId, taskId }, { mode: 'write' });

    const seafileConfig = getSeafileConfig();
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadOneFile({
        config: seafileConfig,
        file,
        projectId,
        taskId,
        category,
        uploadedBy,
      }));
    }

    return res.status(200).json({
      success: true,
      file: uploaded[0],
      files: uploaded,
      storage: 'seafile',
    });
  } catch (error) {
    console.error('Seafile project file upload error:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Could not upload project file to Seafile',
    });
  }
}
