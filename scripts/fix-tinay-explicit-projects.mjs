#!/usr/bin/env node
/**
 * One-off production data fix for Қасымбек Тинай Асқарқызы.
 *
 * Root cause: her imported rows had project_name/project_id from ТОО «Проект-ЭнС»,
 * while notes carried the explicit real project label ("Проект: ...").
 *
 * Dry-run:
 *   node scripts/fix-tinay-explicit-projects.mjs
 * Apply:
 *   node scripts/fix-tinay-explicit-projects.mjs --commit
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ARGS = new Set(process.argv.slice(2));
const COMMIT = ARGS.has('--commit');
const OUT_DIR = path.resolve('reports/tinay-timesheet-fix');

function readSupabaseConfig() {
  const clientTs = fs.readFileSync('src/integrations/supabase/client.ts', 'utf8');
  const url = clientTs.match(/SUPABASE_URL = "([^"]+)"/)?.[1];
  const key = clientTs.match(/SUPABASE_PUBLISHABLE_KEY = "([^"]+)"/)?.[1];
  if (!url || !key) throw new Error('Cannot read Supabase config from client.ts');
  return { url, key };
}

function parseNotes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function stringifyNotes(notes) {
  return JSON.stringify(notes);
}

function hasTeamMember(notes, employeeId) {
  const team = Array.isArray(notes.team) ? notes.team : [];
  return team.some((m) => (m?.userId || m?.id || m?.employeeId) === employeeId);
}

function addTeamMember(notes, employee) {
  const team = Array.isArray(notes.team) ? notes.team : [];
  return {
    ...notes,
    team: [
      ...team,
      {
        userId: employee.id,
        userName: employee.name,
        role: 'assistant_1',
        bonusPercent: 2,
        assignedAt: new Date().toISOString(),
        assignedBy: 'fix-tinay-explicit-projects',
      },
    ],
  };
}

const TINAY_WHATSAPP = '87763770717';
const TARGETS = [
  {
    key: 'kae',
    notesIncludes: 'Проект: АО КАЕ',
    projectId: '17cf64ff-5f6d-4c81-b5eb-20c9fad79344',
    projectName: 'АО КАЕ / Казахстан ASELSAN Инжиниринг',
  },
  {
    key: 'crown-star',
    notesIncludes: 'Crown Star',
    projectId: '68b792cf-5e4e-4438-ba4a-e6bc9a82345d',
    projectName: 'ТОО "Crown Star" за 2025 год',
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { url, key } = readSupabaseConfig();
  const sb = createClient(url, key);

  const { data: employees, error: employeeError } = await sb
    .from('employees')
    .select('*')
    .eq('whatsapp', TINAY_WHATSAPP);
  if (employeeError) throw employeeError;
  if (!employees || employees.length !== 1) {
    throw new Error(`Expected exactly one Tinay employee, got ${employees?.length || 0}`);
  }
  const employee = employees[0];

  const allEntries = [];
  for (const target of TARGETS) {
    const { data, error } = await sb
      .from('timesheet_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .ilike('notes', `%${target.notesIncludes}%`)
      .order('work_date', { ascending: true });
    if (error) throw error;
    for (const row of data || []) allEntries.push({ target, row });
  }

  const toUpdate = allEntries.filter(({ target, row }) => {
    return row.project_id !== target.projectId || row.project_name !== target.projectName;
  });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(OUT_DIR, `${ts}-${COMMIT ? 'commit' : 'dry-run'}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    mode: COMMIT ? 'commit' : 'dry-run',
    employee: { id: employee.id, name: employee.name, whatsapp: employee.whatsapp },
    targets: TARGETS,
    rowsMatched: allEntries.length,
    rowsToUpdate: toUpdate.length,
    rows: toUpdate.map(({ target, row }) => ({ targetKey: target.key, before: row, after: { project_id: target.projectId, project_name: target.projectName } })),
  }, null, 2));

  const byTarget = new Map();
  for (const item of toUpdate) {
    const g = byTarget.get(item.target.key) || { rows: 0, hours: 0, from: null, to: null, projectName: item.target.projectName };
    g.rows += 1;
    g.hours += Number(item.row.hours || 0);
    g.from = !g.from || item.row.work_date < g.from ? item.row.work_date : g.from;
    g.to = !g.to || item.row.work_date > g.to ? item.row.work_date : g.to;
    byTarget.set(item.target.key, g);
  }

  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  console.log(`Employee: ${employee.name}`);
  console.log(`Rows matched: ${allEntries.length}`);
  console.log(`Rows to update: ${toUpdate.length}`);
  for (const [key, g] of byTarget.entries()) {
    console.log(`${key}: ${g.rows} rows, ${Math.round(g.hours * 100) / 100}h, ${g.from}..${g.to}, -> ${g.projectName}`);
  }
  console.log(`Backup/report: ${backupPath}`);

  // Ensure Tinay is visible in project team for all target projects after relink.
  const teamPatches = [];
  for (const target of TARGETS) {
    const { data: project, error: projectError } = await sb
      .from('projects')
      .select('id,name,notes')
      .eq('id', target.projectId)
      .single();
    if (projectError) throw projectError;
    const notes = parseNotes(project.notes);
    if (!hasTeamMember(notes, employee.id)) {
      teamPatches.push({ project, notes: addTeamMember(notes, employee) });
    }
  }
  console.log(`Team patches needed: ${teamPatches.length}`);

  if (!COMMIT) {
    console.log('Dry-run only. Re-run with --commit to apply.');
    return;
  }

  let updated = 0;
  for (const { target, row } of toUpdate) {
    const { error } = await sb
      .from('timesheet_entries')
      .update({ project_id: target.projectId, project_name: target.projectName })
      .eq('id', row.id);
    if (error) throw new Error(`Failed to update ${row.id}: ${error.message}`);
    updated += 1;
  }

  let teamUpdated = 0;
  for (const patch of teamPatches) {
    const { error } = await sb
      .from('projects')
      .update({ notes: stringifyNotes(patch.notes) })
      .eq('id', patch.project.id);
    if (error) throw new Error(`Failed to patch project team ${patch.project.id}: ${error.message}`);
    teamUpdated += 1;
  }

  console.log(`Updated timesheet rows: ${updated}`);
  console.log(`Updated project teams: ${teamUpdated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
