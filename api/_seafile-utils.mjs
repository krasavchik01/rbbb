const DEFAULT_SEAFILE_URL = 'https://cloud.rbpartners.kz';

export const MAX_SEAFILE_FILE_SIZE = 200 * 1024 * 1024;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeSeafileUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('/')) return DEFAULT_SEAFILE_URL;
  return raw.replace(/\/+$/, '');
}

export function getSeafileConfig() {
  const seafileUrl = normalizeSeafileUrl(
    process.env.SEAFILE_URL ||
      process.env.VITE_SEAFILE_BASE_URL ||
      process.env.VITE_SEAFILE_URL
  );
  const seafileToken = String(process.env.SEAFILE_TOKEN || process.env.VITE_SEAFILE_TOKEN || '').trim();
  const repoId = String(process.env.SEAFILE_REPO_ID || process.env.VITE_SEAFILE_REPO_ID || '').trim();

  if (!seafileToken || !repoId) {
    throw httpError(503, 'Seafile is not configured on the server');
  }

  return { seafileUrl, seafileToken, repoId };
}

export function normalizeSeafilePath(value) {
  let path = String(value || '').trim();
  path = path.replace(/^seafile:\/\//i, '');
  while (path.startsWith('//')) path = path.slice(1);
  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

export function isSafeSeafilePath(value) {
  const path = normalizeSeafilePath(value);
  if (!path.startsWith('/')) return false;
  if (path.includes('\0')) return false;
  return path.split('/').every((part) => part !== '..');
}

export function isSafeSeafileRelativePath(value) {
  const path = String(value || '').trim();
  if (!path || path.startsWith('/') || path.includes('\0')) return false;
  return path.split('/').every((part) => part && part !== '..');
}

export function decodeOriginalFileName(name = 'file') {
  const raw = String(name || 'file').trim() || 'file';
  try {
    const repaired = Buffer.from(raw, 'latin1').toString('utf8');
    if (/[\u0400-\u04FF]/.test(repaired) && repaired !== raw) {
      return repaired;
    }
  } catch {
    // Keep raw name.
  }
  return raw;
}

export function sanitizeSeafileFileName(name = 'file') {
  const safe = String(name || 'file')
    .replace(/[\\/:*?"<>|\0]+/g, '_')
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.|\.$/g, '')
    .trim();
  return safe || 'file';
}

export function uniqueSeafileFileName(name = 'file') {
  const safe = sanitizeSeafileFileName(name);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${stamp}-${safe}`;
}

export async function getSeafileUploadUrl(config) {
  const response = await fetch(`${config.seafileUrl}/api2/repos/${config.repoId}/upload-link/?p=/`, {
    headers: { Authorization: `Token ${config.seafileToken}` },
  });
  if (!response.ok) {
    throw httpError(502, `Could not get Seafile upload link: ${response.status}`);
  }

  const raw = await response.text();
  return raw.replace(/"/g, '').replace(/^https?:\/\/[^/]+/, config.seafileUrl);
}

export async function getSeafileDownloadUrl(config, storagePath) {
  const path = normalizeSeafilePath(storagePath);
  // PDF viewers and antivirus scanners make several range requests. Seafile
  // download links are single-use by default, so the second request used to
  // fail with 403 and Chrome displayed "Could not load PDF document".
  const response = await fetch(`${config.seafileUrl}/api2/repos/${config.repoId}/file/?p=${encodeURIComponent(path)}&reuse=1`, {
    headers: { Authorization: `Token ${config.seafileToken}` },
  });
  if (!response.ok) {
    throw httpError(response.status === 404 ? 404 : 502, `Could not get Seafile download link: ${response.status}`);
  }

  const raw = await response.text();
  return raw.replace(/"/g, '');
}

export function toSeafileBrowserUrl(config, downloadUrl) {
  try {
    const target = new URL(String(downloadUrl || ''));
    const configured = new URL(String(config?.seafileUrl || DEFAULT_SEAFILE_URL));
    const defaultOrigin = new URL(DEFAULT_SEAFILE_URL).origin;

    // The app already exposes this same-origin streaming proxy in Vite and
    // Vercel. Keeping the signed path behind the app origin makes the HTML
    // download attribute reliable and avoids cross-origin PDF behaviour.
    if (target.origin === configured.origin && configured.origin === defaultOrigin) {
      return `/seafile-proxy${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Keep the original URL for non-standard/custom Seafile installations.
  }
  return String(downloadUrl || '');
}

export async function listSeafileDir(config, dirPath) {
  const path = normalizeSeafilePath(dirPath);
  const response = await fetch(`${config.seafileUrl}/api2/repos/${config.repoId}/dir/?p=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Token ${config.seafileToken}` },
  });
  if (!response.ok) {
    throw httpError(response.status === 404 ? 404 : 502, `Could not list Seafile directory: ${response.status}`);
  }

  const entries = await response.json();
  return Array.isArray(entries) ? entries : [];
}

export async function deleteSeafileFile(config, storagePath) {
  const path = normalizeSeafilePath(storagePath);
  const response = await fetch(`${config.seafileUrl}/api2/repos/${config.repoId}/file/?p=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { Authorization: `Token ${config.seafileToken}` },
  });
  if (!response.ok) {
    throw httpError(response.status === 404 ? 404 : 502, `Could not delete Seafile file: ${response.status}`);
  }
}
