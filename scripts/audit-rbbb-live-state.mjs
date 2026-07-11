#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Supabase read credentials are missing');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function readAll(table, columns, apply = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns).range(from, from + 999);
    query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function parseNotes(raw) {
  if (raw && typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

const [projects, employees, approved, ledgerTimesheets] = await Promise.all([
  readAll('projects', 'id,name,status,partner_id,manager_id,notes'),
  readAll('employees', 'id,name,email,role,level'),
  readAll('timesheet_entries', 'id,hours,status', (query) => query.eq('status', 'approved')),
  readAll(
    'timesheet_entries',
    'id,project_id,status,hours,reviewer_notes',
    (query) => query.eq('reviewer_notes', 'auto:partner-ledger-timesheet-approval-2026-06-09'),
  ),
]);

let badNotes = 0;
let rbiProjects = 0;
let rbiMembers = 0;
let ledgerProjects = 0;
let duplicateTeamKeys = 0;

for (const project of projects) {
  const notes = parseNotes(project.notes);
  if (!notes) {
    badNotes += 1;
    continue;
  }

  const team = Array.isArray(notes.team) ? notes.team : [];
  if (notes.rbiEnrichment?.marker === 'auto:rbi-project-enrichment-2026-07-02') rbiProjects += 1;
  if (notes.partnerLedgerClose?.marker === 'auto:partner-ledger-close-2026-06-09') ledgerProjects += 1;
  rbiMembers += team.filter(
    (member) => member?.assignedBy === 'auto:rbi-project-enrichment-2026-07-02',
  ).length;

  const seen = new Set();
  for (const member of team) {
    const teamKey = `${member?.userId || member?.employeeId || ''}|${member?.role || ''}`;
    if (teamKey !== '|' && seen.has(teamKey)) duplicateTeamKeys += 1;
    seen.add(teamKey);
  }
}

async function countTable(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? { error: error.message } : { count };
}

const result = {
  observedAt: new Date().toISOString(),
  totals: {
    projects: projects.length,
    employees: employees.length,
    approvedTimesheets: approved.length,
    approvedHours: Number(
      approved.reduce((sum, row) => sum + (Number(row.hours) || 0), 0).toFixed(1),
    ),
    badProjectNotes: badNotes,
  },
  rbi: {
    markedProjects: rbiProjects,
    assignedMembers: rbiMembers,
    duplicateTeamKeys,
  },
  partnerLedger: {
    markedProjects: ledgerProjects,
    approvedRows: ledgerTimesheets.filter((row) => row.status === 'approved').length,
    approvedHours: Number(
      ledgerTimesheets
        .filter((row) => row.status === 'approved')
        .reduce((sum, row) => sum + (Number(row.hours) || 0), 0)
        .toFixed(1),
    ),
    statusCounts: Object.fromEntries(
      Object.entries(
        ledgerTimesheets.reduce((counts, row) => {
          const status = row.status || 'missing';
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right)),
    ),
  },
  registries: {
    bonuses: await countTable('bonuses'),
    projectTeam: await countTable('project_team'),
    projectParticipants: await countTable('project_participants'),
  },
};

const outDir = path.resolve('reports/live-audit');
await fs.mkdir(outDir, { recursive: true });
const out = path.join(
  outDir,
  `rbbb-live-audit-${result.observedAt.replace(/[:.]/g, '-')}.json`,
);
await fs.writeFile(out, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ out, ...result }, null, 2));
