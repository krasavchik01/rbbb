#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  classifyKenzhekulovEvidence,
  classifyProjectCandidates,
  classifyRbiRow,
  normalizeText,
  scoreProject,
  sourceKey,
  summarizeRbiReview,
} from './core.mjs';
import { buildTimesheetFileEvidence } from './timesheet-files.mjs';

const SOURCES = {
  rbi: 'reports/rbi-project-enrichment-dryrun/dryrun.json',
  rbiCommit: 'reports/rbi-project-enrichment-dryrun/commit-results.json',
  rbiPeople: 'reports/rbi-project-enrichment-dryrun/people-add-results.json',
  kenzhekulov: 'reports/kenzhekulov-projects/analysis.json',
  reimport: 'tmp/reimport-drafts.json',
};

const RBI_MARKER = 'auto:rbi-project-enrichment-2026-07-02';
const LEDGER_CLOSE_MARKER = 'auto:partner-ledger-close-2026-06-09';
const LEDGER_APPROVAL_MARKER = 'auto:partner-ledger-timesheet-approval-2026-06-09';
const KNOWN_KENZHEKULOV_UNMATCHED = ['БОЗОЙ', 'АО КТК', 'Мирбуш', 'ТОО ТИМ', 'ТОО TGAlfarabi'];

function parseNotes(raw) {
  if (raw && typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

async function loadJson(relativePath) {
  const absolutePath = path.resolve(relativePath);
  let raw;
  try {
    raw = await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new Error(`Required reconciliation source is missing: ${relativePath}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

function buildCandidates(entry, projects) {
  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      score: scoreProject(entry, project),
      project,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'ru'))
    .slice(0, 5);
}

function publicCandidates(candidates) {
  return candidates.map(({ id, name, status, score }) => ({ id, name, status, score }));
}

function teamFromProject(project) {
  return Array.isArray(project?._notes?.team) ? project._notes.team : [];
}

function rbiRecommendation({ matchConflict, teamConflict, matchType, externalPeople, applied }) {
  if (matchType === 'not_found') return 'review_create_or_skip';
  if (matchConflict) return 'choose_existing_project';
  if (teamConflict) return 'merge_team_manually';
  if (Array.isArray(externalPeople) && externalPeople.length > 0) return 'keep_external';
  return applied ? 'confirmed_no_action' : 'verify_live_application';
}

function buildRbiRows(results, projects) {
  return results.map((result) => {
    const entry = result.entry || {};
    const identity = sourceKey(entry.file, entry.sheet, entry.row);
    const historical = classifyRbiRow(result);
    const candidates = buildCandidates(entry, projects);
    const currentMatchType = classifyProjectCandidates(candidates);
    const bestCurrent = currentMatchType === 'not_found' ? null : candidates[0]?.project;
    const liveTeam = teamFromProject(bestCurrent);
    const applied = bestCurrent?._notes?.rbiEnrichment?.marker === RBI_MARKER;
    return {
      sourceKey: identity,
      sourceFile: entry.file || '',
      sourceSheet: entry.sheet || '',
      sourceRow: Number(entry.row) || 0,
      clientName: entry.clientName || '',
      auditType: entry.auditType || '',
      auditPeriod: entry.auditPeriod || '',
      company: entry.company || '',
      oldMatchType: result.matchType || '',
      oldBestProjectId: result.bestProject?.id || '',
      oldBestProjectName: result.bestProject?.name || '',
      oldBestScore: Number(result.bestProject?.score) || 0,
      currentMatchType,
      currentCandidates: publicCandidates(candidates),
      matchConflict: historical.matchConflict,
      teamConflict: historical.teamConflict,
      existingTeam: liveTeam,
      proposedTeam: result.mappedPeople || [],
      conflicts: result.conflicts || [],
      externalPeople: result.externalPeople || [],
      liveRbiMarker: applied,
      status: historical.status,
      recommendation: rbiRecommendation({
        ...historical,
        matchType: result.matchType,
        externalPeople: result.externalPeople,
        applied,
      }),
      decision: '',
      approvedProjectId: '',
      reviewComment: '',
    };
  });
}

function buildExternalPeople(rbiRows) {
  const rows = [];
  for (const rbiRow of rbiRows) {
    for (const person of rbiRow.externalPeople || []) {
      rows.push({
        sourceKey: rbiRow.sourceKey,
        sourceFile: rbiRow.sourceFile,
        sourceSheet: rbiRow.sourceSheet,
        sourceRow: rbiRow.sourceRow,
        clientName: rbiRow.clientName,
        sourceName: person.cleanName || person.sourceName || person.name || '',
        sourceRole: person.sourceRole || person.role || 'external',
        recommendation: 'keep_external',
        decision: '',
        reviewComment: '',
      });
    }
  }
  return rows;
}

function buildKenzhekulovRows(analysisRows, projects, timesheets) {
  const knownUnmatched = new Set(KNOWN_KENZHEKULOV_UNMATCHED.map(normalizeText));
  return analysisRows.map((row) => {
    const entry = {
      clientName: row.clientName,
      auditType: row.auditType,
      auditPeriod: row.periodRaw,
      reportDate: row.auditYear ? String(row.auditYear) : '',
      starts: [],
      ends: [],
    };
    const candidates = buildCandidates(entry, projects);
    const currentMatchType = classifyProjectCandidates(candidates);
    const best = currentMatchType === 'not_found' ? null : candidates[0]?.project;
    const proposedPartner = (row.teamProposed || []).find((member) => member.role === 'partner');
    const liveTeam = teamFromProject(best);
    const partnerMatch = Boolean(
      proposedPartner?.employeeId
      && liveTeam.some((member) => (member.userId || member.employeeId) === proposedPartner.employeeId),
    );
    const nameMatch = Boolean(best && candidates[0]?.score >= 65);
    const sharedMarker = best?._notes?.partnerLedgerClose?.marker === LEDGER_CLOSE_MARKER;
    const projectLedgerRows = best
      ? timesheets.filter(
        (timesheet) => timesheet.project_id === best.id && timesheet.reviewer_notes === LEDGER_APPROVAL_MARKER,
      )
      : [];
    const status = classifyKenzhekulovEvidence({ sharedMarker, partnerMatch, nameMatch });
    const explicitUnmatched = knownUnmatched.has(normalizeText(row.clientName));
    return {
      sourceNo: String(row.no || ''),
      clientName: row.clientName || '',
      auditType: row.auditType || '',
      auditYear: row.auditYear || '',
      periodRaw: row.periodRaw || '',
      proposedTeam: row.teamProposed || [],
      historicalMatchProjectId: row.matchedProjectId || '',
      historicalMatchProjectName: row.matchedProjectName || '',
      historicalMatchConfidence: row.matchConfidence || '',
      currentMatchType,
      currentCandidates: publicCandidates(candidates),
      evidenceProjectId: best?.id || '',
      evidenceProjectName: best?.name || '',
      partnerMatch,
      nameMatch,
      sharedCloseMarker: sharedMarker,
      approvedLedgerRows: projectLedgerRows.filter((item) => item.status === 'approved').length,
      approvedLedgerHours: Number(
        projectLedgerRows
          .filter((item) => item.status === 'approved')
          .reduce((sum, item) => sum + (Number(item.hours) || 0), 0)
          .toFixed(1),
      ),
      explicitHistoricalUnmatched: explicitUnmatched,
      status: explicitUnmatched ? 'needs_project_match' : status,
      recommendation: explicitUnmatched
        ? 'review_create_or_match'
        : status === 'confirmed_applied' ? 'confirmed_no_action' : 'verify_source_specific_evidence',
      decision: '',
      approvedProjectId: '',
      reviewComment: '',
    };
  });
}

dotenv.config({ path: '.env', quiet: true });
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase read credentials are missing');

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

const [rbiReport, rbiCommit, rbiPeople, kenzhekulovAnalysis, reimportEvidence] = await Promise.all(
  Object.values(SOURCES).map(loadJson),
);

assertEqual(rbiReport.summary?.sourceRows, 467, 'RBI source rows');
assertEqual(rbiReport.summary?.exact, 228, 'RBI exact rows');
assertEqual(rbiReport.summary?.probable, 50, 'RBI probable rows');
assertEqual(rbiReport.summary?.conflict, 66, 'RBI match conflicts');
assertEqual(rbiReport.summary?.notFound, 123, 'RBI not-found rows');

const [rawProjects, employees, timesheets] = await Promise.all([
  readAll('projects', 'id,name,status,partner_id,manager_id,notes'),
  readAll('employees', 'id,name,email,role,level'),
  readAll(
    'timesheet_entries',
    'id,employee_id,employee_name,project_id,project_name,work_date,hours,status,source,import_batch_id,notes,reviewer_notes',
  ),
]);

const projects = rawProjects.map((project) => ({ ...project, _notes: parseNotes(project.notes) || {} }));
const rbiReviewSummary = summarizeRbiReview(rbiReport.results || []);
assertEqual(rbiReviewSummary.matchConflicts, 66, 'RBI match-conflict review rows');
assertEqual(rbiReviewSummary.teamConflicts, 72, 'RBI team-conflict review rows');
assertEqual(rbiReviewSummary.overlap, 15, 'RBI conflict overlap');
assertEqual(rbiReviewSummary.additionalTeamConflicts, 57, 'RBI additional team conflicts');
assertEqual(rbiReviewSummary.notFound, 123, 'RBI not-found review rows');
assertEqual(rbiReviewSummary.uniqueReviewRows, 246, 'RBI unique review rows');

const rbiRows = buildRbiRows(rbiReport.results || [], projects);
const rbiMatchConflicts = rbiRows.filter((row) => row.matchConflict);
const rbiTeamConflicts = rbiRows.filter((row) => row.teamConflict);
const rbiNotFound = rbiRows.filter((row) => row.oldMatchType === 'not_found');
const externalPeople = buildExternalPeople(rbiRows);
const kenzhekulovRows = buildKenzhekulovRows(kenzhekulovAnalysis.rows || [], projects, timesheets);
assertEqual(kenzhekulovRows.length, 52, 'Kenzhekulov source rows');
const timesheetFileRows = buildTimesheetFileEvidence({ reimportEvidence, timesheets });
assertEqual(timesheetFileRows.length, 3, 'Timesheet file comparison rows');

const sharedLedgerRows = timesheets.filter((row) => row.reviewer_notes === LEDGER_APPROVAL_MARKER);
const result = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  mode: 'select-only',
  sourceFiles: SOURCES,
  live: {
    projects: projects.length,
    employees: employees.length,
    timesheetRows: timesheets.length,
    approvedTimesheetRows: timesheets.filter((row) => row.status === 'approved').length,
    approvedTimesheetHours: Number(
      timesheets
        .filter((row) => row.status === 'approved')
        .reduce((sum, row) => sum + (Number(row.hours) || 0), 0)
        .toFixed(1),
    ),
    rbiMarkedProjects: projects.filter((project) => project._notes?.rbiEnrichment?.marker === RBI_MARKER).length,
    rbiAssignedMembers: projects.reduce(
      (sum, project) => sum + teamFromProject(project).filter((member) => member.assignedBy === RBI_MARKER).length,
      0,
    ),
    sharedLedgerMarkedProjects: projects.filter(
      (project) => project._notes?.partnerLedgerClose?.marker === LEDGER_CLOSE_MARKER,
    ).length,
    sharedLedgerApprovedRows: sharedLedgerRows.filter((row) => row.status === 'approved').length,
    sharedLedgerApprovedHours: Number(
      sharedLedgerRows
        .filter((row) => row.status === 'approved')
        .reduce((sum, row) => sum + (Number(row.hours) || 0), 0)
        .toFixed(1),
    ),
  },
  rbi: {
    sourceSummary: rbiReport.summary,
    reviewSummary: rbiReviewSummary,
    committedProjectsInSavedReport: Array.isArray(rbiCommit.committed) ? rbiCommit.committed.length : 0,
    insertedPeopleInSavedReport: Array.isArray(rbiPeople.inserted) ? rbiPeople.inserted.length : 0,
    rows: rbiRows,
    matchConflicts: rbiMatchConflicts,
    teamConflicts: rbiTeamConflicts,
    notFound: rbiNotFound,
    externalPeople,
  },
  kenzhekulov: {
    sourceRows: kenzhekulovRows.length,
    historicalClaim: {
      updatedLedgerRows: 47,
      uniqueProjects: 41,
      approvedRows: 697,
      approvedHours: 5129.8,
      unmatchedProjects: KNOWN_KENZHEKULOV_UNMATCHED,
    },
    rows: kenzhekulovRows,
  },
  timesheetFiles: {
    reimportGeneratedAt: reimportEvidence.generatedAt || '',
    rows: timesheetFileRows,
  },
};

const outDir = path.resolve('reports/reconciliation');
await fs.mkdir(outDir, { recursive: true });
const stamp = result.observedAt.replace(/[:.]/g, '-');
const out = path.join(outDir, `rbbb-reconciliation-${stamp}.json`);
await fs.writeFile(out, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({
  out,
  observedAt: result.observedAt,
  live: result.live,
  rbi: result.rbi.reviewSummary,
  kenzhekulov: {
    sourceRows: result.kenzhekulov.sourceRows,
    confirmedApplied: result.kenzhekulov.rows.filter((row) => row.status === 'confirmed_applied').length,
    needsReview: result.kenzhekulov.rows.filter((row) => row.status !== 'confirmed_applied').length,
  },
  timesheetFiles: result.timesheetFiles.rows.map((row) => ({
    employeeName: row.employeeName,
    rootRows: row.root.rows,
    rawRows: row.raw.rows,
    driveRows: row.driveDraft.rows,
    liveRows: row.liveBatchV3.rows,
    status: row.status,
  })),
}, null, 2));
