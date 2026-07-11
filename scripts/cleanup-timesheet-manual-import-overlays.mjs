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

const columns = [
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
  return String(value ?? '')
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/\b(тоо|llp|аудит|аудиторская|финансовой|финансовая|отчетности|отчётности|фо|за|год|г)\b/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compact(value) {
  return normalize(value).replace(/\s+/g, '');
}

function hasProjectMatch(manualRow, importRow) {
  if (manualRow.project_id && importRow.project_id && manualRow.project_id === importRow.project_id) return true;
  const manualName = compact(manualRow.project_name);
  const importName = compact(importRow.project_name);
  if (!manualName || !importName) return false;
  if (manualName === importName) return true;
  // Conservative fuzzy match for the screenshot class: manual short client name vs imported full audit engagement name.
  // Require a meaningful company-name overlap, not just tiny tokens.
  return manualName.length >= 8 && (importName.includes(manualName) || manualName.includes(importName));
}

function businessDayKey(row) {
  return `${row.employee_id || ''}|${row.work_date || ''}|${Number(row.hours || 0)}`;
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

async function fetchAllRows() {
  const rows = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from('timesheet_entries')
      .select(columns.join(','))
      .range(from, from + step - 1)
      .order('id', { ascending: true });
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < step) break;
  }
  return rows;
}

function analyze(rows) {
  const importsByDay = new Map();
  const importsByEmployeeDate = new Map();
  const totalsByEmployeeDate = new Map();
  for (const row of rows) {
    const employeeDateKey = `${row.employee_id || ''}|${row.work_date || ''}`;
    const total = totalsByEmployeeDate.get(employeeDateKey) || 0;
    totalsByEmployeeDate.set(employeeDateKey, total + Number(row.hours || 0));

    if (row.source !== 'import') continue;
    if (row.status === 'approved' || row.status === 'rejected') continue;
    const key = businessDayKey(row);
    if (!importsByDay.has(key)) importsByDay.set(key, []);
    importsByDay.get(key).push(row);
    if (!importsByEmployeeDate.has(employeeDateKey)) importsByEmployeeDate.set(employeeDateKey, []);
    importsByEmployeeDate.get(employeeDateKey).push(row);
  }

  const candidates = [];
  const groups = [];
  for (const manual of rows) {
    if (manual.source !== 'manual') continue;
    if (manual.status !== 'draft') continue;

    const employeeDateKey = `${manual.employee_id || ''}|${manual.work_date || ''}`;
    const sameDateImports = importsByEmployeeDate.get(employeeDateKey) || [];
    const possibleImports = importsByDay.get(businessDayKey(manual)) || [];
    if (sameDateImports.length === 0) continue;

    const projectMatches = sameDateImports.filter((imp) => hasProjectMatch(manual, imp));
    const employeeDayTotal = totalsByEmployeeDate.get(employeeDateKey) || 0;
    const isHighHourImportOverlay = employeeDayTotal > 12;
    const matches = projectMatches.length > 0 ? projectMatches : (possibleImports.length > 0 ? possibleImports : sameDateImports);

    // Delete manual drafts either when project identity matches, or when the same employee/day is
    // already over a realistic daily limit while import rows exist. This covers the screenshot class
    // where the manual project name/hours differ slightly from the imported engagement snapshot.
    if (projectMatches.length === 0 && !isHighHourImportOverlay) continue;

    candidates.push(manual);
    groups.push({
      manualId: manual.id,
      manualKeyHash: hash(`${manual.employee_id}|${manual.work_date}|${manual.hours}|${normalize(manual.project_name)}`),
      matchedImportIds: matches.map((row) => row.id),
      matchCount: matches.length,
      matchReason: projectMatches.length > 0 ? 'project_match' : 'high_hour_import_overlay',
      employeeDayTotal,
      workDate: manual.work_date,
      hours: manual.hours,
      manualStatus: manual.status,
      manualSource: manual.source,
    });
  }

  const byDate = candidates.reduce((acc, row) => {
    acc[row.work_date] = (acc[row.work_date] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRows: rows.length,
    candidateCount: candidates.length,
    candidateIds: candidates.map((row) => row.id),
    candidateRows: candidates,
    groups,
    byDate,
  };
}

async function deleteCandidates(ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from('timesheet_entries')
      .delete()
      .in('id', chunk)
      .eq('source', 'manual')
      .eq('status', 'draft')
      .select('id');
    if (error) throw error;
    deleted += data?.length || 0;
  }
  return deleted;
}

async function main() {
  const rows = await fetchAllRows();
  const before = analyze(rows);

  const outDir = path.join(process.cwd(), 'reports', 'timesheet-duplicate-cleanup');
  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(outDir, `${timestamp}-manual-import-overlays-${mode}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    mode,
    createdAt: new Date().toISOString(),
    totalRows: before.totalRows,
    candidateCount: before.candidateCount,
    byDate: before.byDate,
    groups: before.groups,
    deletedRowsBackup: before.candidateRows,
  }, null, 2));

  let deleted = 0;
  if (mode === 'execute' && before.candidateIds.length > 0) {
    deleted = await deleteCandidates(before.candidateIds);
  }

  const afterRows = await fetchAllRows();
  const after = analyze(afterRows);

  console.log(JSON.stringify({
    mode,
    backupPath,
    before: {
      totalRows: before.totalRows,
      candidateCount: before.candidateCount,
      byDate: before.byDate,
    },
    deleted,
    after: {
      totalRows: after.totalRows,
      candidateCount: after.candidateCount,
      byDate: after.byDate,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
