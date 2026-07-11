#!/usr/bin/env node
/**
 * Approve historical timesheets only for projects closed from the partner ledger.
 *
 * Usage:
 *   node scripts/approve-ledger-project-timesheets.mjs
 *   node scripts/approve-ledger-project-timesheets.mjs --commit
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const DATE_FROM = '2024-01-01';
const DATE_TO = '2025-12-31';
const REPORT_PATH = path.resolve('reports/partner-ledger-close/partner-ledger-close-report.json');
const REVIEWER_NAME = 'Partner ledger bulk approval 2024-2025';
const REVIEWER_NOTES = 'auto:partner-ledger-timesheet-approval-2026-06-09';
const COMMIT = process.argv.includes('--commit');

function loadProjectIds() {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const ids = report.rows
    .filter((row) => row.commitAllowed && row.matchedProjectId)
    .map((row) => row.matchedProjectId);
  return [...new Set(ids)].sort();
}

function summarize(rows) {
  const byStatus = {};
  let hours = 0;
  let toApprove = 0;
  let toApproveHours = 0;

  for (const row of rows) {
    const status = row.status || '(null)';
    if (!byStatus[status]) byStatus[status] = { count: 0, hours: 0 };
    const rowHours = Number(row.hours) || 0;
    byStatus[status].count += 1;
    byStatus[status].hours += rowHours;
    hours += rowHours;

    if (row.status !== 'approved' && row.status !== 'rejected') {
      toApprove += 1;
      toApproveHours += rowHours;
    }
  }

  return { byStatus, hours, toApprove, toApproveHours };
}

async function fetchRows(sb, projectIds) {
  const rows = [];
  for (let i = 0; i < projectIds.length; i += 75) {
    const batch = projectIds.slice(i, i + 75);
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from('timesheet_entries')
        .select('id,project_id,status,hours,work_date')
        .in('project_id', batch)
        .gte('work_date', DATE_FROM)
        .lte('work_date', DATE_TO)
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }
  return rows;
}

async function approveRows(sb, projectIds) {
  const updated = [];
  const now = new Date().toISOString();

  for (let i = 0; i < projectIds.length; i += 75) {
    const batch = projectIds.slice(i, i + 75);
    const { data, error } = await sb
      .from('timesheet_entries')
      .update({
        status: 'approved',
        reviewed_by: null,
        reviewed_by_name: REVIEWER_NAME,
        reviewed_at: now,
        reviewer_notes: REVIEWER_NOTES,
      })
      .in('project_id', batch)
      .gte('work_date', DATE_FROM)
      .lte('work_date', DATE_TO)
      .neq('status', 'approved')
      .neq('status', 'rejected')
      .select('id,project_id,status,hours');
    if (error) throw error;
    updated.push(...(data || []));
  }

  return updated;
}

async function main() {
  const projectIds = loadProjectIds();
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const rows = await fetchRows(sb, projectIds);
  const before = summarize(rows);

  console.log(`Ledger projects: ${projectIds.length}`);
  console.log(`Period: ${DATE_FROM} .. ${DATE_TO}`);
  console.log(`Timesheet rows: ${rows.length}`);
  console.log(`Total hours: ${before.hours.toFixed(1)}`);
  console.log('Status breakdown:');
  for (const [status, value] of Object.entries(before.byStatus).sort()) {
    console.log(`  ${status.padEnd(12)} ${String(value.count).padStart(5)} rows ${value.hours.toFixed(1).padStart(8)} h`);
  }
  console.log(`To approve: ${before.toApprove} rows, ${before.toApproveHours.toFixed(1)} h`);

  if (!COMMIT) {
    console.log('(dry-run) Re-run with --commit to apply.');
    return;
  }

  const updated = await approveRows(sb, projectIds);
  console.log(`DONE. Approved: ${updated.length} rows.`);

  const afterRows = await fetchRows(sb, projectIds);
  const after = summarize(afterRows);
  console.log('After status breakdown:');
  for (const [status, value] of Object.entries(after.byStatus).sort()) {
    console.log(`  ${status.padEnd(12)} ${String(value.count).padStart(5)} rows ${value.hours.toFixed(1).padStart(8)} h`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
