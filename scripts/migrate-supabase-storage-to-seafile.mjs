import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import {
  getSeafileConfig,
  getSeafileDownloadUrl,
  getSeafileUploadUrl,
  sanitizeSeafileFileName,
  uniqueSeafileFileName,
} from '../api/_seafile-utils.mjs';

const ROOT = process.cwd();

for (const envFile of ['.env.vercel.local', '.env.local', '.env']) {
  dotenv.config({ path: path.join(ROOT, envFile), override: false });
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
const force = process.argv.includes('--force');
const deleteSource = process.argv.includes('--delete-source');
const limit = Number.parseInt(argValue('--limit') || '', 10) || 0;
const onlyProjectId = argValue('--project') || '';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Pull production env before executing.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seafileConfig = getSeafileConfig();

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function basenameFromPath(value) {
  const raw = String(value || '').split('?')[0].split('#')[0];
  const name = raw.split('/').filter(Boolean).pop() || 'file';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function fileDisplayName(file, storagePath, url) {
  return (
    String(file?.fileName || file?.name || '').trim() ||
    basenameFromPath(storagePath) ||
    basenameFromPath(url) ||
    'file'
  );
}

function inferBucket(file) {
  const bucket = String(file?.bucket || file?.bucketName || '').trim();
  if (bucket) return bucket;

  const storagePath = String(file?.storagePath || '').trim();
  if (storagePath.startsWith('contracts/')) return 'contracts';
  if (storagePath.startsWith('documents/')) return 'documents';
  if (storagePath.startsWith('project-files/')) return 'project-files';

  const category = String(file?.category || '').toLowerCase();
  if (category === 'contract' || category === 'scan') return 'contracts';
  if (category === 'document') return 'documents';
  return 'project-files';
}

function stripKnownBucketPrefix(bucket, storagePath) {
  let value = String(storagePath || '').trim().replace(/^\/+/, '');
  for (const known of ['contracts', 'documents', 'project-files']) {
    if (value.startsWith(`${known}/`)) {
      if (known === bucket) value = value.slice(known.length + 1);
      break;
    }
  }
  return value;
}

function parseSupabaseStorageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || !raw.includes('/storage/v1/object/')) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  const objectIndex = parts.findIndex((part, index) => part === 'object' && parts[index - 1] === 'v1');
  if (objectIndex < 0 || parts.length < objectIndex + 3) return null;

  const bucket = parts[objectIndex + 2];
  const storagePath = parts.slice(objectIndex + 3).join('/');
  if (!bucket || !storagePath) return null;

  return {
    bucket,
    storagePath: decodePath(storagePath),
  };
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSeafileFile(file) {
  const publicUrl = String(file?.publicUrl || file?.url || '').trim();
  const storagePath = String(file?.storagePath || '').trim();
  return file?.isSeafile === true || file?.storage === 'seafile' || publicUrl.startsWith('seafile://') || storagePath.startsWith('/');
}

function storageRefFromFile(file) {
  if (!file || (isSeafileFile(file) && !force)) return null;

  const url = String(file.publicUrl || file.url || file.downloadUrl || '').trim();
  const parsedUrl = parseSupabaseStorageUrl(url);
  if (parsedUrl) {
    return {
      ...parsedUrl,
      url,
      source: 'url',
    };
  }

  const storagePath = String(file.storagePath || file.path || '').trim();
  const parsedStorageUrl = parseSupabaseStorageUrl(storagePath);
  if (parsedStorageUrl) {
    return {
      ...parsedStorageUrl,
      url: storagePath,
      source: 'storagePathUrl',
    };
  }

  if (!storagePath || storagePath.startsWith('seafile://') || storagePath.startsWith('/')) return null;

  const bucket = inferBucket(file);
  const objectPath = stripKnownBucketPrefix(bucket, storagePath);
  if (!objectPath) return null;

  return {
    bucket,
    storagePath: objectPath,
    url,
    source: 'storagePath',
  };
}

function makeLegacyFiles(project, notes) {
  const contract = notes.contract || {};
  const urls = [
    ['contractScanUrl', contract.contractScanUrl || notes.contractScanUrl || project.contractScanUrl],
    ['contractOriginalUrl', contract.contractOriginalUrl || notes.contractOriginalUrl || project.contractOriginalUrl],
  ];

  return urls
    .filter(([, value]) => value && value !== 'pending_upload')
    .map(([field, value]) => ({
      id: `legacy_${field}_${String(value).slice(-32)}`,
      fileName: field === 'contractOriginalUrl' ? 'Original contract' : 'Contract scan',
      name: field === 'contractOriginalUrl' ? 'Original contract' : 'Contract scan',
      category: 'contract',
      fileType: 'application/pdf',
      fileSize: 0,
      publicUrl: value,
      url: value,
      legacyField: field,
    }));
}

function dedupeFiles(files) {
  const seen = new Map();
  for (const file of files) {
    if (!file) continue;
    const key = [
      file.id,
      file.storagePath,
      file.publicUrl,
      file.url,
      file.fileName || file.name,
      file.fileSize || file.size,
    ]
      .filter(Boolean)
      .join('|');
    if (!key) continue;
    seen.set(key, { ...seen.get(key), ...file });
  }
  return Array.from(seen.values());
}

function collectProjectFileCandidates(project) {
  const notes = parseJson(project.notes, {});
  const files = dedupeFiles([...asArray(notes.files), ...makeLegacyFiles(project, notes)]);
  const candidatesByStoragePath = new Map();

  for (const file of files) {
    const ref = storageRefFromFile(file);
    if (!ref) continue;
    const key = `${ref.bucket}:${ref.storagePath}`;
    if (!candidatesByStoragePath.has(key)) {
      candidatesByStoragePath.set(key, { file, ref });
      continue;
    }

    const previous = candidatesByStoragePath.get(key);
    candidatesByStoragePath.set(key, {
      file: {
        ...previous.file,
        ...file,
        fileName: previous.file.fileName || previous.file.name || file.fileName || file.name,
        name: previous.file.name || previous.file.fileName || file.name || file.fileName,
      },
      ref,
    });
  }

  return {
    notes,
    files: Array.from(candidatesByStoragePath.values()),
  };
}

async function fetchAllProjects() {
  const projects = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('projects')
      .select('id,name,notes,created_at,updated_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (onlyProjectId) query = query.eq('id', onlyProjectId);

    const { data, error } = await query;
    if (error) throw error;
    projects.push(...(data || []));
    if (!data || data.length < pageSize || onlyProjectId) break;
  }

  return limit > 0 ? projects.slice(0, limit) : projects;
}

async function downloadSupabaseObject(ref) {
  const { data, error } = await supabase.storage.from(ref.bucket).download(ref.storagePath);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
    size: data.size || arrayBuffer.byteLength,
  };
}

async function uploadToSeafile({ projectId, displayName, contentType, buffer }) {
  const storedName = uniqueSeafileFileName(sanitizeSeafileFileName(displayName));
  const uploadUrl = await getSeafileUploadUrl(seafileConfig);
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: contentType || 'application/octet-stream' }), storedName);
  formData.append('parent_dir', '/');
  formData.append('relative_path', projectId);
  formData.append('replace', '0');

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Token ${seafileConfig.seafileToken}` },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Seafile upload failed: ${response.status}${details ? ` ${details}` : ''}`);
  }

  const storagePath = `/${projectId}/${storedName}`;
  let downloadOk = false;
  try {
    await getSeafileDownloadUrl(seafileConfig, storagePath);
    downloadOk = true;
  } catch {
    downloadOk = false;
  }

  return {
    storedName,
    storagePath,
    publicUrl: `seafile://${storagePath}`,
    downloadOk,
  };
}

function replaceContractUrl(notes, oldUrl, newUrl) {
  const next = { ...notes };
  const contract = { ...(next.contract || {}) };
  let changed = false;

  for (const field of ['contractScanUrl', 'contractOriginalUrl']) {
    if (contract[field] === oldUrl) {
      contract[field] = newUrl;
      changed = true;
    }
    if (next[field] === oldUrl) {
      next[field] = newUrl;
      changed = true;
    }
  }

  if (changed) next.contract = contract;
  return next;
}

function replaceFile(files, originalFile, migratedFile) {
  let replaced = false;
  const oldKey = originalFile.id || originalFile.storagePath || originalFile.publicUrl || originalFile.url;
  const next = files.map((file) => {
    const key = file.id || file.storagePath || file.publicUrl || file.url;
    if (oldKey && key === oldKey) {
      replaced = true;
      return migratedFile;
    }
    return file;
  });

  if (!replaced) next.push(migratedFile);
  return dedupeFiles(next);
}

function sameSupabaseRef(file, ref) {
  const current = storageRefFromFile(file);
  return !!current && current.bucket === ref.bucket && current.storagePath === ref.storagePath;
}

async function updateProjectNotes(projectId, notes) {
  const { error } = await supabase
    .from('projects')
    .update({
      notes: JSON.stringify(notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  if (error) throw error;
}

async function migrateProject(project, index, total) {
  const { notes, files } = collectProjectFileCandidates(project);
  const result = {
    projectId: project.id,
    projectName: project.name,
    candidates: files.length,
    migrated: [],
    skipped: [],
    errors: [],
  };

  if (files.length === 0) return result;

  let nextNotes = { ...notes, files: asArray(notes.files) };

  console.log(`[${index}/${total}] ${project.name || project.id}: ${files.length} file(s)`);

  for (const { file, ref } of files) {
    const displayName = fileDisplayName(file, ref.storagePath, ref.url);

    if (dryRun) {
      result.skipped.push({
        reason: 'dry-run',
        fileName: displayName,
        bucket: ref.bucket,
        storagePath: ref.storagePath,
      });
      continue;
    }

    try {
      const downloaded = await downloadSupabaseObject(ref);
      const uploaded = await uploadToSeafile({
        projectId: project.id,
        displayName,
        contentType: file.fileType || file.type || downloaded.contentType,
        buffer: downloaded.buffer,
      });

      const migratedFile = {
        ...file,
        id: file.id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        projectId: project.id,
        fileName: file.fileName || file.name || displayName,
        name: file.name || file.fileName || displayName,
        storedName: uploaded.storedName,
        fileType: file.fileType || file.type || downloaded.contentType,
        fileSize: file.fileSize || file.size || downloaded.size,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.publicUrl,
        url: uploaded.publicUrl,
        storage: 'seafile',
        isSeafile: true,
        uploadedAt: file.uploadedAt || file.createdAt || new Date().toISOString(),
        category: file.category || 'document',
        migratedFrom: {
          storage: 'supabase',
          bucket: ref.bucket,
          storagePath: ref.storagePath,
          publicUrl: ref.url || file.publicUrl || file.url || '',
          migratedAt: new Date().toISOString(),
        },
      };

      const remainingFiles = nextNotes.files.filter((item) => !sameSupabaseRef(item, ref));
      nextNotes.files = replaceFile(remainingFiles, file, migratedFile);
      nextNotes = replaceContractUrl(
        nextNotes,
        ref.url || file.publicUrl || file.url || file.storagePath,
        uploaded.publicUrl
      );

      if (deleteSource) {
        const { error } = await supabase.storage.from(ref.bucket).remove([ref.storagePath]);
        if (error) throw error;
      }

      result.migrated.push({
        fileName: displayName,
        bucket: ref.bucket,
        oldPath: ref.storagePath,
        newPath: uploaded.storagePath,
        downloadOk: uploaded.downloadOk,
      });
    } catch (error) {
      result.errors.push({
        fileName: displayName,
        bucket: ref.bucket,
        storagePath: ref.storagePath,
        message: error?.message || String(error),
      });
    }
  }

  if (!dryRun && result.migrated.length > 0) {
    await updateProjectNotes(project.id, nextNotes);
  }

  return result;
}

function writeReport(report) {
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(reportsDir, `supabase-to-seafile-${dryRun ? 'dry-run' : 'migration'}-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
}

async function main() {
  console.log(`Mode: ${dryRun ? 'dry-run' : 'execute'}`);
  console.log(`Supabase: ${new URL(supabaseUrl).host}`);
  console.log(`Seafile: ${new URL(seafileConfig.seafileUrl).host}`);
  if (deleteSource) console.log('Source deletion: enabled');

  const projects = await fetchAllProjects();
  const report = {
    startedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'execute',
    deleteSource,
    onlyProjectId,
    limit,
    totals: {
      projectsScanned: projects.length,
      projectsWithCandidates: 0,
      candidates: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    },
    projects: [],
  };

  let index = 0;
  for (const project of projects) {
    index += 1;
    const result = await migrateProject(project, index, projects.length);
    if (result.candidates > 0) {
      report.totals.projectsWithCandidates += 1;
      report.projects.push(result);
    }
    report.totals.candidates += result.candidates;
    report.totals.migrated += result.migrated.length;
    report.totals.skipped += result.skipped.length;
    report.totals.errors += result.errors.length;
  }

  report.finishedAt = new Date().toISOString();
  const reportPath = writeReport(report);

  console.log('\n=== RESULT ===');
  console.log(`Projects scanned: ${report.totals.projectsScanned}`);
  console.log(`Projects with Supabase files: ${report.totals.projectsWithCandidates}`);
  console.log(`Candidate files: ${report.totals.candidates}`);
  console.log(`Migrated files: ${report.totals.migrated}`);
  console.log(`Skipped: ${report.totals.skipped}`);
  console.log(`Errors: ${report.totals.errors}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
