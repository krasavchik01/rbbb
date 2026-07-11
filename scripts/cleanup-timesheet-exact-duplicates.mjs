import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const mode = process.argv.includes('--execute') ? 'execute' : 'dry-run';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const selectColumns = [
  'id',
  'employee_id',
  'employee_name',
  'project_id',
  'project_name',
  'work_date',
  'hours',
  'section',
  'position',
  'location',
  'city',
  'manager_raw',
  'partner_raw',
  'notes',
  'source',
  'import_batch_id',
  'status',
  'reviewed_by',
  'reviewed_by_name',
  'reviewed_at',
  'reviewer_notes',
  'created_by',
  'created_at',
  'updated_at',
];

function normalize(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function exactKey(row) {
  // Keep the key intentionally strict: delete only rows that are identical business duplicates.
  const keyParts = [
    row.employee_id,
    row.employee_name,
    row.project_id,
    row.project_name,
    row.work_date,
    row.hours,
    row.section,
    row.position,
    row.location,
    row.city,
    row.manager_raw,
    row.partner_raw,
    row.notes,
    row.source,
    row.import_batch_id,
    row.status,
  ].map(normalize);
  return JSON.stringify(keyParts);
}

function hashKey(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function canonicalSort(a, b) {
  const aApproved = a.status === 'approved' ? 0 : 1;
  const bApproved = b.status === 'approved' ? 0 : 1;
  if (aApproved !== bApproved) return aApproved - bApproved;
  return String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id));
}

async function fetchAllRows() {
  const rows = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select(selectColumns.join(','))
      .range(from, from + step - 1)
      .order('id', { ascending: true });
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < step) break;
  }
  return rows;
}

function analyze(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = exactKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicateGroups = [];
  const deleteIds = [];
  const deleteRows = [];
  const keptIds = [];

  for (const [key, groupRows] of groups.entries()) {
    if (groupRows.length <= 1) continue;

    const sorted = [...groupRows].sort(canonicalSort);
    const keep = sorted[0];
    const candidates = sorted.slice(1).filter((row) => row.source === 'import' && row.status !== 'approved');

    // Extra safety: do not touch mixed-source groups or groups where the canonical row is missing.
    const allImport = sorted.every((row) => row.source === 'import');
    if (!allImport || candidates.length === 0) continue;

    keptIds.push(keep.id);
    deleteIds.push(...candidates.map((row) => row.id));
    deleteRows.push(...candidates);
    duplicateGroups.push({
      keyHash: hashKey(key),
      groupSize: sorted.length,
      keepId: keep.id,
      deleteIds: candidates.map((row) => row.id),
      workDate: keep.work_date,
      hours: keep.hours,
      status: keep.status,
      source: keep.source,
    });
  }

  return {
    totalRows: rows.length,
    duplicateGroups,
    deleteIds,
    deleteRows,
    keptIds,
  };
}

async function deleteInChunks(ids) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  let deleted = 0;
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .delete()
      .in('id', chunk)
      .select('id');
    if (error) throw error;
    deleted += data?.length || 0;
  }
  return deleted;
}

async function main() {
  const rows = await fetchAllRows();
  const analysis = analyze(rows);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'reports', 'timesheet-duplicate-cleanup');
  fs.mkdirSync(outDir, { recursive: true });
  const backupPath = path.join(outDir, `${timestamp}-${mode}.json`);

  fs.writeFileSync(backupPath, JSON.stringify({
    mode,
    createdAt: new Date().toISOString(),
    totalRows: analysis.totalRows,
    duplicateGroupCount: analysis.duplicateGroups.length,
    deleteCandidateCount: analysis.deleteIds.length,
    keptCount: analysis.keptIds.length,
    duplicateGroups: analysis.duplicateGroups,
    deletedRowsBackup: analysis.deleteRows,
  }, null, 2));

  let deleted = 0;
  if (mode === 'execute' && analysis.deleteIds.length > 0) {
    deleted = await deleteInChunks(analysis.deleteIds);
  }

  const rowsAfter = await fetchAllRows();
  const after = analyze(rowsAfter);
  console.log(JSON.stringify({
    mode,
    backupPath,
    before: {
      totalRows: analysis.totalRows,
      duplicateGroupCount: analysis.duplicateGroups.length,
      deleteCandidateCount: analysis.deleteIds.length,
    },
    deleted,
    after: {
      totalRows: rowsAfter.length,
      duplicateGroupCount: after.duplicateGroups.length,
      deleteCandidateCount: after.deleteIds.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
