#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { classifyProject, RETAINED_COMPANIES } from './lib/project-retention.mjs';

dotenv.config({ path: '.env', quiet: true });

const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const expectedArg = process.argv.find((arg) => arg.startsWith('--expected-count='));
const expectedCount = expectedArg ? Number(expectedArg.split('=')[1]) : null;
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) throw new Error('Supabase credentials are missing');
if (commit && (!Number.isInteger(expectedCount) || expectedCount < 1)) {
  throw new Error('Commit mode requires --expected-count=N with a positive integer');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function readAll(table, columns = '*') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function chunks(values, size = 50) {
  const out = [];
  for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size));
  return out;
}

async function readRelated(table, projectIds, columns = '*') {
  const rows = [];
  for (const ids of chunks(projectIds)) {
    const { data, error } = await supabase.from(table).select(columns).in('project_id', ids);
    if (error) {
      if (error.code === '42P01' || error.code === '42703') return { table, unavailable: error.message, rows: [] };
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...(data || []));
  }
  return { table, rows };
}

async function deleteRelated(table, projectIds) {
  for (const ids of chunks(projectIds)) {
    const { error } = await supabase.from(table).delete().in('project_id', ids);
    if (error && error.code !== '42P01' && error.code !== '42703') {
      throw new Error(`${table}: ${error.message}`);
    }
  }
}

const projects = await readAll('projects', '*');
const classified = projects.map((project) => ({ project, classification: classifyProject(project) }));
const candidates = classified.filter((item) => item.classification.action === 'delete');
const kept = classified.filter((item) => item.classification.action === 'keep');
const candidateIds = candidates.map((item) => item.project.id);

const related = await Promise.all([
  readRelated('project_files', candidateIds),
  readRelated('project_amendments', candidateIds),
  readRelated('project_data', candidateIds),
  readRelated('timesheet_entries', candidateIds, 'id,project_id,project_name,employee_id,employee_name,work_date,hours,status'),
]);

const timesheets = related.find((item) => item.table === 'timesheet_entries')?.rows || [];
const timesheetSummary = timesheets.reduce((summary, row) => {
  summary.rows += 1;
  summary.hours += Number(row.hours || 0);
  if (row.status === 'approved') {
    summary.approvedRows += 1;
    summary.approvedHours += Number(row.hours || 0);
  }
  return summary;
}, { rows: 0, hours: 0, approvedRows: 0, approvedHours: 0 });

const byCompany = new Map();
for (const item of candidates) {
  const name = item.classification.company || '(не указана)';
  byCompany.set(name, (byCompany.get(name) || 0) + 1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.resolve('reports', 'project-purge');
await fs.mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, `project-purge-${timestamp}.json`);
const report = {
  generatedAt: new Date().toISOString(),
  mode: commit ? 'commit_requested' : 'dry_run',
  retainedCompanies: RETAINED_COMPANIES,
  policy: {
    keepConsortiums: true,
    keepMissingAndUnrecognized: true,
    deleteOnlyRetiredAndersonParker: true,
    preserveTimesheets: true,
    preserveSeafileObjects: true,
  },
  totals: {
    projectsBefore: projects.length,
    candidates: candidates.length,
    kept: kept.length,
    timesheetsPreserved: timesheetSummary,
  },
  candidatesByCompany: [...byCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([company, count]) => ({ company, count })),
  candidates: candidates.map(({ project, classification }) => ({ project, classification })),
  related,
};
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  mode: commit ? 'commit_requested' : 'dry_run',
  projectsBefore: projects.length,
  candidates: candidates.length,
  kept: kept.length,
  candidatesByCompany: report.candidatesByCompany,
  timesheetsPreserved: timesheetSummary,
  snapshot: reportPath,
}, null, 2));

if (!commit) {
  console.log(`\nDRY-RUN ONLY. To commit: node scripts/purge-projects-by-company.mjs --commit --expected-count=${candidates.length}`);
  process.exit(0);
}

if (candidates.length !== expectedCount) {
  throw new Error(`Safety stop: expected ${expectedCount} candidates, observed ${candidates.length}`);
}

for (const table of ['project_files', 'project_amendments', 'project_data']) {
  await deleteRelated(table, candidateIds);
}
for (const ids of chunks(candidateIds)) {
  const { error } = await supabase.from('projects').delete().in('id', ids);
  if (error) throw new Error(`projects: ${error.message}`);
}

let remaining = [];
for (const ids of chunks(candidateIds)) {
  const { data, error } = await supabase.from('projects').select('id,name').in('id', ids);
  if (error) throw new Error(`projects verification: ${error.message}`);
  remaining.push(...(data || []));
}
if (remaining.length > 0) throw new Error(`Verification failed: ${remaining.length} projects remain`);

const { count: projectsAfter, error: countError } = await supabase
  .from('projects')
  .select('id', { count: 'exact', head: true });
if (countError) throw new Error(`projects final count: ${countError.message}`);

console.log(JSON.stringify({
  status: 'committed',
  deleted: candidateIds.length,
  projectsAfter,
  timesheetRowsPreserved: timesheetSummary.rows,
  snapshot: reportPath,
}, null, 2));
