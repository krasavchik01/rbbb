#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });

const SCRIPT_VERSION = 2;
const SCRIPT_NAME = 'scripts/materialize-project-teams.mjs';
const ALLOWED_NOTE_KEYS = new Set([
  'team',
  'teamSource',
  'teamUnifiedAt',
  'teamMaterialization',
]);
const MEMBER_ID_KEYS = new Set(['userId', 'user_id', 'employeeId', 'employee_id', 'id']);
const MEMBER_NAME_KEYS = new Set([
  'userName',
  'user_name',
  'employeeName',
  'employee_name',
  'fullName',
  'full_name',
  'name',
]);
const MEMBER_ROLE_KEYS = new Set([
  'role',
  'projectRole',
  'project_role',
  'role_on_project',
  'slotKey',
  'slot_key',
]);
const MEMBER_ALIAS_KEYS = new Set([
  ...MEMBER_ID_KEYS,
  ...MEMBER_NAME_KEYS,
  ...MEMBER_ROLE_KEYS,
]);

function usage() {
  return `Usage:
  node ${SCRIPT_NAME}
  node ${SCRIPT_NAME} --limit=25
  node ${SCRIPT_NAME} --apply [--limit=25] [--allow-project-team-table]

Modes:
  default                         Read-only dry-run; writes only a local ignored report.
  --apply                         Persist the materialized teams and verify every row.

Safety options:
  --limit=N                       Deterministically process only the first N changing projects.
  --allow-project-team-table      Allow apply when legacy project_team contains rows.
  --help                          Print this help.

Apply mode requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).`;
}

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.has('--help') || args.has('-h')) return { help: true };

  const limitArg = argv.find((value) => value.startsWith('--limit='));
  let limit = null;
  if (limitArg) {
    limit = Number(limitArg.slice('--limit='.length));
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('--limit must be a positive integer');
    }
  }

  const known = new Set(['--apply', '--allow-project-team-table']);
  const unknown = argv.filter((value) => !known.has(value) && !value.startsWith('--limit='));
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);

  return {
    help: false,
    apply: args.has('--apply'),
    allowProjectTeamTable: args.has('--allow-project-team-table'),
    limit,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function stableStringify(value) {
  const serialized = JSON.stringify(canonicalize(value));
  return serialized === undefined ? '__undefined__' : serialized;
}

function hash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function normalizeIdentity(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function memberId(member) {
  return firstText(
    member?.userId,
    member?.user_id,
    member?.employeeId,
    member?.employee_id,
    member?.id,
  );
}

export function memberName(member) {
  return firstText(
    member?.userName,
    member?.user_name,
    member?.employeeName,
    member?.employee_name,
    member?.fullName,
    member?.full_name,
    member?.name,
  );
}

export function memberRole(member) {
  return firstText(
    member?.role,
    member?.projectRole,
    member?.project_role,
    member?.role_on_project,
    member?.slotKey,
    member?.slot_key,
  ).toLowerCase();
}

export function memberKey(member) {
  const id = normalizeIdentity(memberId(member));
  const role = memberRole(member);
  return id && role ? `id:${id}::role:${role}` : '';
}

function addIdentityChoice(index, key, choiceKey, displayValue) {
  if (!key || !choiceKey) return;
  const choices = index.get(key) || new Map();
  if (!choices.has(choiceKey)) choices.set(choiceKey, displayValue);
  index.set(key, choices);
}

/**
 * Builds a shared alias index before deduplication. A name-only archived row
 * may therefore be reconciled to the one employee id already present in the
 * common team, without making source order part of the identity decision.
 */
export function buildIdentityIndex(sourceRows) {
  const idsByName = new Map();
  const namesById = new Map();
  const displayIds = new Map();

  for (const sourceRow of sourceRows) {
    const member = sourceRow?.member;
    if (!isRecord(member)) continue;
    const id = memberId(member);
    const name = memberName(member);
    const normalizedId = normalizeIdentity(id);
    const normalizedMemberName = normalizeName(name);
    if (!normalizedId || !normalizedMemberName) continue;
    if (!displayIds.has(normalizedId)) displayIds.set(normalizedId, id);
    addIdentityChoice(idsByName, normalizedMemberName, normalizedId, id);
    addIdentityChoice(namesById, normalizedId, normalizedMemberName, name);
  }

  return { idsByName, namesById, displayIds };
}

function canonicalMemberRecord(member, { id, name, role }) {
  const canonical = Object.fromEntries(
    Object.entries(member).filter(([key]) => !MEMBER_ALIAS_KEYS.has(key)),
  );
  canonical.userId = id;
  canonical.userName = name;
  canonical.role = role;
  return canonical;
}

/**
 * Converts all known historical aliases to the runtime's canonical camelCase
 * shape. Missing ids may be reconciled only when the normalized name maps to
 * exactly one known id. Ambiguity is a blocker, never a first-match guess.
 */
export function canonicalizeTeamMember(member, identityIndex) {
  if (!isRecord(member)) {
    return {
      ok: false,
      issues: [{ kind: 'invalid_team_member_type', valueType: Array.isArray(member) ? 'array' : typeof member }],
    };
  }

  let id = memberId(member);
  let name = memberName(member);
  const role = memberRole(member);
  const issues = [];
  const reconciliation = {};

  if (!id && name) {
    const candidates = identityIndex.idsByName.get(normalizeName(name));
    if (candidates?.size === 1) {
      id = [...candidates.values()][0];
      reconciliation.idFromName = true;
    } else if (candidates?.size > 1) {
      issues.push({
        kind: 'team_member_ambiguous_name',
        name,
        candidateIds: [...candidates.values()],
      });
    }
  }

  if (id && !name) {
    const candidates = identityIndex.namesById.get(normalizeIdentity(id));
    if (candidates?.size === 1) {
      name = [...candidates.values()][0];
      reconciliation.nameFromId = true;
    }
  }

  if (id) {
    const normalizedId = normalizeIdentity(id);
    id = identityIndex.displayIds.get(normalizedId) || id;
    if (name) {
      const names = identityIndex.namesById.get(normalizedId);
      name = names?.get(normalizeName(name)) || name;
    }
  }

  if (!id && !issues.some((issue) => issue.kind === 'team_member_ambiguous_name')) {
    issues.push({ kind: 'team_member_without_id', name: name || null });
  }
  if (!name) issues.push({ kind: 'team_member_without_name', id: id || null });
  if (!role) issues.push({ kind: 'team_member_without_role', id: id || null, name: name || null });

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    member: canonicalMemberRecord(member, { id, name, role }),
    reconciliation,
  };
}

function parseNotes(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: {} };
  if (isRecord(raw)) return { ok: true, value: raw };
  if (typeof raw !== 'string') {
    return { ok: false, error: `Unsupported notes type: ${typeof raw}` };
  }
  try {
    const value = JSON.parse(raw);
    return isRecord(value)
      ? { ok: true, value }
      : { ok: false, error: 'Project notes JSON must contain an object' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function notesWithoutMaterializationFields(notes) {
  return Object.fromEntries(
    Object.entries(notes).filter(([key]) => !ALLOWED_NOTE_KEYS.has(key)),
  );
}

function isCanonical(notes) {
  return notes.teamSource === 'canonical' || Boolean(notes.teamUnifiedAt);
}

function readSourceTeams(project, notes) {
  const issues = [];
  const sources = [];

  if (notes.team !== undefined && notes.team !== null && !Array.isArray(notes.team)) {
    issues.push({ kind: 'invalid_notes_team', valueType: typeof notes.team });
  }
  const directTeam = Array.isArray(notes.team) ? notes.team : [];
  directTeam.forEach((member, index) => {
    sources.push({ member, source: 'notes.team', sourceIndex: index });
  });

  if (notes.auditPeriods !== undefined && notes.auditPeriods !== null && !Array.isArray(notes.auditPeriods)) {
    issues.push({ kind: 'invalid_audit_periods', valueType: typeof notes.auditPeriods });
  }
  const periods = Array.isArray(notes.auditPeriods) ? notes.auditPeriods : [];
  periods.forEach((period, periodIndex) => {
    if (!isRecord(period)) {
      issues.push({ kind: 'invalid_audit_period', periodIndex });
      return;
    }
    if (period.team !== undefined && period.team !== null && !Array.isArray(period.team)) {
      issues.push({
        kind: 'invalid_audit_period_team',
        periodIndex,
        periodId: firstText(period.id),
        valueType: typeof period.team,
      });
      return;
    }
    const periodTeam = Array.isArray(period.team) ? period.team : [];
    periodTeam.forEach((member, memberIndex) => {
      sources.push({
        member,
        source: 'auditPeriods.team',
        periodIndex,
        periodId: firstText(period.id),
        periodName: firstText(period.name),
        sourceIndex: memberIndex,
      });
    });
  });

  return {
    projectId: project.id,
    directCount: directTeam.length,
    archivedCount: sources.length - directTeam.length,
    sources,
    issues,
  };
}

export function dedupeTeam(sourceRows, identityIndex = buildIdentityIndex(sourceRows)) {
  const seen = new Map();
  const team = [];
  const duplicates = [];
  const conflictingDuplicates = [];
  const invalidMembers = [];
  const reconciledMembers = [];
  const identityConflicts = [];

  for (const [id, names] of identityIndex.namesById.entries()) {
    if (names.size <= 1) continue;
    identityConflicts.push({
      kind: 'employee_id_has_multiple_names',
      id,
      names: [...names.values()],
    });
  }

  for (const sourceRow of sourceRows) {
    const { member } = sourceRow;
    const canonicalized = canonicalizeTeamMember(member, identityIndex);
    if (!canonicalized.ok) {
      for (const issue of canonicalized.issues) {
        invalidMembers.push({
          ...sourceRow,
          member,
          ...issue,
        });
      }
      continue;
    }
    const canonicalMember = canonicalized.member;
    const key = memberKey(canonicalMember);
    if (!key) {
      invalidMembers.push({
        ...sourceRow,
        member,
        kind: 'team_member_without_canonical_key',
      });
      continue;
    }
    if (canonicalized.reconciliation.idFromName || canonicalized.reconciliation.nameFromId) {
      reconciledMembers.push({
        key,
        source: sourceRow.source,
        sourceIndex: sourceRow.sourceIndex,
        periodIndex: sourceRow.periodIndex,
        periodId: sourceRow.periodId,
        ...canonicalized.reconciliation,
      });
    }
    const existing = seen.get(key);
    if (existing) {
      const duplicate = {
        key,
        keptSource: existing.source,
        duplicateSource: sourceRow.source,
        differs: hash(existing.member) !== hash(canonicalMember),
        kept: existing.member,
        duplicate: canonicalMember,
      };
      duplicates.push(duplicate);
      if (duplicate.differs) conflictingDuplicates.push(duplicate);
      continue;
    }
    const canonicalSourceRow = { ...sourceRow, member: canonicalMember };
    seen.set(key, canonicalSourceRow);
    team.push(canonicalMember);
  }

  return {
    team,
    duplicates,
    conflictingDuplicates,
    invalidMembers,
    reconciledMembers,
    identityConflicts,
    keys: new Set(seen.keys()),
  };
}

export function projectPlan(project, runAt) {
  const parsed = parseNotes(project.notes);
  if (!parsed.ok) {
    return {
      id: project.id,
      name: project.name,
      updatedAt: project.updated_at,
      invalidNotes: parsed.error,
      change: false,
    };
  }

  const notes = parsed.value;
  const source = readSourceTeams(project, notes);
  const canonical = isCanonical(notes);
  const directRows = source.sources.filter((row) => row.source === 'notes.team');
  const archivedRows = source.sources.filter((row) => row.source === 'auditPeriods.team');
  const identityIndex = buildIdentityIndex(source.sources);
  const current = dedupeTeam(directRows, identityIndex);
  const archived = dedupeTeam(archivedRows, identityIndex);
  const combined = dedupeTeam(source.sources, identityIndex);

  if (canonical) {
    const archivedOnlyKeys = [...archived.keys].filter((key) => !current.keys.has(key));
    return {
      id: project.id,
      name: project.name,
      updatedAt: project.updated_at,
      canonical: true,
      change: false,
      source: {
        directCount: source.directCount,
        archivedCount: source.archivedCount,
        canonicalCount: current.team.length,
        archivedOnlyCount: archivedOnlyKeys.length,
        archivedOnlyKeys,
      },
      issues: source.issues,
      invalidMembers: combined.invalidMembers,
      identityConflicts: combined.identityConflicts,
      duplicates: combined.duplicates,
      conflictingDuplicates: combined.conflictingDuplicates,
      reconciledMembers: combined.reconciledMembers,
    };
  }

  const merged = combined;
  const beforeOtherNotesHash = hash(notesWithoutMaterializationFields(notes));
  const financesHash = hash(notes.finances);
  const teamBonusesHash = hash(notes.finances?.teamBonuses);
  const auditPeriodsHash = hash(notes.auditPeriods);
  const nextNotes = {
    ...notes,
    team: merged.team,
    teamSource: 'canonical',
    teamUnifiedAt: runAt,
    teamMaterialization: {
      version: SCRIPT_VERSION,
      source: SCRIPT_NAME,
      appliedAt: runAt,
      directMembers: source.directCount,
      archivedMembers: source.archivedCount,
      materializedMembers: merged.team.length,
      deduplicatedMembers: merged.duplicates.length,
      reconciledMembers: merged.reconciledMembers.length,
    },
  };

  const change = hash(notes) !== hash(nextNotes);
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updated_at,
    canonical: false,
    change,
    source: {
      directCount: source.directCount,
      archivedCount: source.archivedCount,
      materializedCount: merged.team.length,
      deduplicatedCount: merged.duplicates.length,
      reconciledCount: merged.reconciledMembers.length,
    },
    issues: source.issues,
    invalidMembers: merged.invalidMembers,
    identityConflicts: merged.identityConflicts,
    duplicates: merged.duplicates,
    conflictingDuplicates: merged.conflictingDuplicates,
    reconciledMembers: merged.reconciledMembers,
    originalNotesRaw: project.notes,
    originalNotes: notes,
    nextNotes,
    integrity: {
      originalNotesHash: hash(notes),
      nextNotesHash: hash(nextNotes),
      beforeOtherNotesHash,
      financesHash,
      teamBonusesHash,
      auditPeriodsHash,
    },
  };
}

export function collectPlanBlockers(allPlans, changingPlans) {
  const canonicalPlans = allPlans.filter((plan) => plan.canonical);
  const changingShapeIssues = changingPlans.flatMap((plan) => plan.issues || []);
  const changingInvalidMembers = changingPlans.flatMap((plan) => plan.invalidMembers || []);
  const changingConflictingDuplicates = changingPlans.flatMap((plan) => plan.conflictingDuplicates || []);
  const changingIdentityConflicts = changingPlans.flatMap((plan) => plan.identityConflicts || []);
  const canonicalArchivedOnly = canonicalPlans.filter(
    (plan) => Number(plan.source?.archivedOnlyCount || 0) > 0,
  );
  const canonicalShapeIssues = canonicalPlans.flatMap((plan) => plan.issues || []);
  const canonicalInvalidMembers = canonicalPlans.flatMap((plan) => plan.invalidMembers || []);
  const canonicalConflictingDuplicates = canonicalPlans.flatMap(
    (plan) => plan.conflictingDuplicates || [],
  );
  const canonicalIdentityConflicts = canonicalPlans.flatMap((plan) => plan.identityConflicts || []);

  const blockerCount = changingShapeIssues.length
    + changingInvalidMembers.length
    + changingConflictingDuplicates.length
    + changingIdentityConflicts.length
    + canonicalArchivedOnly.length
    + canonicalShapeIssues.length
    + canonicalInvalidMembers.length
    + canonicalConflictingDuplicates.length
    + canonicalIdentityConflicts.length;

  return {
    blockerCount,
    changingShapeIssues,
    changingInvalidMembers,
    changingConflictingDuplicates,
    changingIdentityConflicts,
    canonicalArchivedOnly,
    canonicalShapeIssues,
    canonicalInvalidMembers,
    canonicalConflictingDuplicates,
    canonicalIdentityConflicts,
  };
}

function chunks(values, size = 50) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function readAll(supabase, table, columns = '*') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function exactCount(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) return { count: null, error: error.message };
  return { count: Number(count || 0), error: null };
}

function verifyReadBack(plan, row) {
  const parsed = parseNotes(row?.notes);
  if (!parsed.ok) throw new Error(`read-back notes are invalid: ${parsed.error}`);
  const actual = parsed.value;
  const checks = {
    team: hash(actual.team) === hash(plan.nextNotes.team),
    teamSource: actual.teamSource === 'canonical',
    teamUnifiedAt: actual.teamUnifiedAt === plan.nextNotes.teamUnifiedAt,
    teamMaterialization: hash(actual.teamMaterialization) === hash(plan.nextNotes.teamMaterialization),
    otherNotes: hash(notesWithoutMaterializationFields(actual)) === plan.integrity.beforeOtherNotesHash,
    finances: hash(actual.finances) === plan.integrity.financesHash,
    teamBonuses: hash(actual.finances?.teamBonuses) === plan.integrity.teamBonusesHash,
    auditPeriods: hash(actual.auditPeriods) === plan.integrity.auditPeriodsHash,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key);
  if (failed.length > 0) throw new Error(`read-back integrity failed: ${failed.join(', ')}`);
  return checks;
}

async function updateOne(supabase, plan) {
  let query = supabase
    .from('projects')
    .update({
      notes: JSON.stringify(plan.nextNotes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', plan.id);
  query = plan.updatedAt === null || plan.updatedAt === undefined
    ? query.is('updated_at', null)
    : query.eq('updated_at', plan.updatedAt);

  const { data, error } = await query.select('id,updated_at');
  if (error) throw new Error(`update failed: ${error.message}`);
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error('optimistic-lock conflict: project changed after dry-run read');
  }

  const { data: readBack, error: readError } = await supabase
    .from('projects')
    .select('id,notes,updated_at')
    .eq('id', plan.id)
    .single();
  if (readError) throw new Error(`read-back failed: ${readError.message}`);
  const checks = verifyReadBack(plan, readBack);
  return { updatedAt: readBack.updated_at, checks };
}

async function verifyAppliedPlans(supabase, plans) {
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  const verified = [];
  for (const idChunk of chunks(plans.map((plan) => plan.id))) {
    const { data, error } = await supabase
      .from('projects')
      .select('id,notes,updated_at')
      .in('id', idChunk);
    if (error) throw new Error(`final verification read failed: ${error.message}`);
    for (const row of data || []) {
      const plan = byId.get(row.id);
      if (!plan) continue;
      try {
        verifyReadBack(plan, row);
      } catch (error) {
        throw new Error(`final verification failed for project ${plan.id} (${plan.name || 'unnamed'}): ${error instanceof Error ? error.message : String(error)}`);
      }
      verified.push(row.id);
    }
  }
  if (verified.length !== plans.length) {
    throw new Error(`final verification expected ${plans.length} projects, received ${verified.length}`);
  }
  return verified.length;
}

async function writeReport(reportPath, report) {
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const fallbackKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY;
  const key = serviceKey || fallbackKey;
  if (!url || !key) throw new Error('Supabase credentials are missing');
  if (options.apply && !serviceKey) {
    throw new Error('Apply mode requires SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runAt = new Date().toISOString();
  const stamp = runAt.replace(/[:.]/g, '-');
  const outputDir = path.resolve('reports', 'team-materialization');
  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `team-materialization-${stamp}-${options.apply ? 'apply' : 'dry-run'}.json`);

  const [projects, projectsCount, projectTeamCount] = await Promise.all([
    readAll(supabase, 'projects', 'id,name,notes,updated_at'),
    exactCount(supabase, 'projects'),
    exactCount(supabase, 'project_team'),
  ]);
  if (projectsCount.error) throw new Error(`projects count failed: ${projectsCount.error}`);
  if (projectsCount.count !== projects.length) {
    throw new Error(`Incomplete projects read: exact count ${projectsCount.count}, fetched ${projects.length}`);
  }

  const allPlans = projects.map((project) => projectPlan(project, runAt));
  const invalidNotes = allPlans.filter((plan) => plan.invalidNotes);
  const canonical = allPlans.filter((plan) => plan.canonical);
  const allChanging = allPlans
    .filter((plan) => plan.change)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const changing = options.limit ? allChanging.slice(0, options.limit) : allChanging;
  const safety = collectPlanBlockers(allPlans, changing);
  const planHash = hash(changing.map((plan) => ({
    id: plan.id,
    updatedAt: plan.updatedAt,
    originalNotesHash: plan.integrity.originalNotesHash,
    nextNotesHash: plan.integrity.nextNotesHash,
  })));

  const report = {
    schemaVersion: 1,
    scriptVersion: SCRIPT_VERSION,
    generatedAt: runAt,
    mode: options.apply ? 'apply_planned' : 'dry_run',
    options,
    planHash,
    credentials: {
      serviceRole: Boolean(serviceKey),
      completeReadVerified: projectsCount.count === projects.length,
    },
    liveCounts: {
      projects: projectsCount,
      projectTeam: projectTeamCount,
    },
    summary: {
      projectsFetched: projects.length,
      invalidNotes: invalidNotes.length,
      alreadyCanonical: canonical.length,
      canonicalWithArchivedOnlyMembers: canonical.filter((plan) => Number(plan.source?.archivedOnlyCount || 0) > 0).length,
      allChangingProjects: allChanging.length,
      selectedChangingProjects: changing.length,
      truncatedByLimit: changing.length !== allChanging.length,
      directMembers: changing.reduce((sum, plan) => sum + Number(plan.source?.directCount || 0), 0),
      archivedMembers: changing.reduce((sum, plan) => sum + Number(plan.source?.archivedCount || 0), 0),
      materializedMembers: changing.reduce((sum, plan) => sum + Number(plan.source?.materializedCount || 0), 0),
      deduplicatedMembers: changing.reduce((sum, plan) => sum + Number(plan.source?.deduplicatedCount || 0), 0),
      reconciledMembers: changing.reduce((sum, plan) => sum + Number(plan.source?.reconciledCount || 0), 0),
      changingShapeIssues: safety.changingShapeIssues.length,
      changingInvalidMembers: safety.changingInvalidMembers.length,
      changingConflictingDuplicates: safety.changingConflictingDuplicates.length,
      changingIdentityConflicts: safety.changingIdentityConflicts.length,
      canonicalShapeIssues: safety.canonicalShapeIssues.length,
      canonicalInvalidMembers: safety.canonicalInvalidMembers.length,
      canonicalConflictingDuplicates: safety.canonicalConflictingDuplicates.length,
      canonicalIdentityConflicts: safety.canonicalIdentityConflicts.length,
      totalSafetyBlockers: safety.blockerCount,
    },
    invalidNotes: invalidNotes.map(({ id, name, invalidNotes: error }) => ({ id, name, error })),
    canonicalAudit: canonical.map((plan) => ({
      id: plan.id,
      name: plan.name,
      source: plan.source,
      issues: plan.issues,
      invalidMembers: plan.invalidMembers,
      identityConflicts: plan.identityConflicts,
      duplicates: plan.duplicates,
      conflictingDuplicates: plan.conflictingDuplicates,
      reconciledMembers: plan.reconciledMembers,
    })),
    // This is the rollback backup. Keep the full raw and parsed original notes.
    changingProjects: changing,
    progress: {
      applied: [],
      failed: [],
      finalVerified: 0,
    },
  };

  // The report/backup is durable before any apply gate or live update runs.
  await writeReport(reportPath, report);

  if (!options.apply) {
    console.log(JSON.stringify({
      mode: report.mode,
      reportPath,
      planHash,
      liveCounts: report.liveCounts,
      summary: report.summary,
      warning: serviceKey ? null : 'Dry-run used a public key; service-role dry-run is required before apply.',
    }, null, 2));
    return;
  }

  if (projectTeamCount.error) {
    throw new Error(`Cannot verify project_team before apply: ${projectTeamCount.error}. Backup: ${reportPath}`);
  }
  if (projectTeamCount.count > 0 && !options.allowProjectTeamTable) {
    throw new Error(
      `Safety stop: project_team contains ${projectTeamCount.count} row(s). `
      + `Reconcile them first or rerun with --allow-project-team-table. Backup: ${reportPath}`,
    );
  }
  if (invalidNotes.length > 0) {
    throw new Error(`Safety stop: ${invalidNotes.length} project(s) have invalid notes. Backup: ${reportPath}`);
  }
  if (safety.blockerCount > 0) {
    throw new Error(
      `Safety stop: ${safety.blockerCount} team materialization blocker(s): `
      + `${safety.changingShapeIssues.length} changing shape issue(s), `
      + `${safety.changingInvalidMembers.length} changing invalid member issue(s), `
      + `${safety.changingConflictingDuplicates.length} changing conflicting duplicate(s), `
      + `${safety.changingIdentityConflicts.length} changing identity conflict(s), `
      + `${safety.canonicalArchivedOnly.length} canonical project(s) with archived-only members, `
      + `${safety.canonicalShapeIssues.length} canonical shape issue(s), `
      + `${safety.canonicalInvalidMembers.length} canonical invalid member issue(s), `
      + `${safety.canonicalConflictingDuplicates.length} canonical conflicting duplicate(s), `
      + `${safety.canonicalIdentityConflicts.length} canonical identity conflict(s). Backup: ${reportPath}`,
    );
  }

  report.mode = 'applying';
  await writeReport(reportPath, report);
  let currentPlan = null;
  let failureStage = 'row_update';
  try {
    for (const plan of changing) {
      currentPlan = plan;
      const result = await updateOne(supabase, plan);
      report.progress.applied.push({ id: plan.id, name: plan.name, ...result });
      await writeReport(reportPath, report);
      currentPlan = null;
    }
    failureStage = 'final_verification';
    report.progress.finalVerified = await verifyAppliedPlans(supabase, changing);
    report.mode = 'applied_and_verified';
    report.completedAt = new Date().toISOString();
    await writeReport(reportPath, report);
  } catch (error) {
    report.mode = 'apply_failed';
    report.failedAt = new Date().toISOString();
    report.progress.failed.push({
      stage: failureStage,
      projectId: currentPlan?.id || null,
      projectName: currentPlan?.name || null,
      error: error instanceof Error ? error.message : String(error),
    });
    await writeReport(reportPath, report);
    throw new Error(`${error instanceof Error ? error.message : String(error)}. Backup: ${reportPath}`);
  }

  console.log(JSON.stringify({
    mode: report.mode,
    reportPath,
    planHash,
    applied: report.progress.applied.length,
    finalVerified: report.progress.finalVerified,
    summary: report.summary,
  }, null, 2));
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]).toLowerCase() : '';
const modulePath = path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (executedPath === modulePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
