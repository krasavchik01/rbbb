#!/usr/bin/env node
/**
 * Read-only Supabase Auth readiness audit.
 *
 * Checks whether every employees row can be migrated to strict backend JWT auth:
 * - employee has email;
 * - employee email has Supabase Auth user;
 * - Auth user has role metadata compatible with employees.role/level;
 * - obvious duplicate/orphan Auth records are visible.
 *
 * This script does not create, update, or delete any rows/users.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const getArgValue = (name) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
};

const asJson = args.has('--json');
const showDetails = args.has('--show-details');
const writeReport = args.has('--write-report');
const selfTest = args.has('--self-test');
const reportPath = resolve(repoRoot, getArgValue('--report-path') || 'reports/auth-readiness-audit.json');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USER_ROLES = new Set([
  'ceo',
  'deputy_director',
  'company_director',
  'procurement',
  'partner',
  'project_leader',
  'manager_1',
  'manager_2',
  'manager_3',
  'supervisor_3',
  'supervisor_2',
  'supervisor_1',
  'tax_specialist_1',
  'tax_specialist_2',
  'assistant_3',
  'assistant_2',
  'assistant_1',
  'contractor',
  'academy',
  'hr',
  'accountant',
  'admin_staff',
  'admin',
]);

function normalizeLevel(level) {
  return level === '2' || level === '3' ? level : '1';
}

function normalizeUserRole(role, level, fallback = 'assistant_1') {
  if (role && USER_ROLES.has(role)) return role;

  const normalizedLevel = normalizeLevel(level);
  switch (role) {
    case 'assistant':
      return `assistant_${normalizedLevel}`;
    case 'manager':
      return `manager_${normalizedLevel}`;
    case 'supervisor':
      return `supervisor_${normalizedLevel}`;
    case 'tax_specialist':
      return `tax_specialist_${normalizedLevel}`;
    case 'project_manager':
      return 'project_leader';
    case 'employee':
      return 'assistant_1';
    case 'it_admin':
      return 'admin';
    default:
      return fallback;
  }
}

function maskEmail(email) {
  if (!email || !String(email).includes('@')) return email || null;
  const [rawLocal, rawDomain] = String(email).toLowerCase().split('@');
  const local = rawLocal.length <= 2 ? `${rawLocal[0] || '*'}*` : `${rawLocal.slice(0, 2)}***${rawLocal.slice(-1)}`;
  const [domainName, ...rest] = rawDomain.split('.');
  const maskedDomain = domainName.length <= 2 ? `${domainName[0] || '*'}*` : `${domainName[0]}***${domainName.slice(-1)}`;
  return `${local}@${maskedDomain}${rest.length ? `.${rest.join('.')}` : ''}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicEmployee(employee) {
  return {
    id: employee.id,
    email: maskEmail(employee.email),
    dbRole: employee.role || null,
    level: employee.level || null,
    normalizedDbRole: normalizeUserRole(employee.role, employee.level),
  };
}

function publicAuthUser(user) {
  const rawRole = user.app_metadata?.role || user.user_metadata?.role || user.role || null;
  return {
    id: user.id,
    email: maskEmail(user.email),
    metadataRole: rawRole,
    normalizedMetadataRole: rawRole ? normalizeUserRole(rawRole) : null,
    emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
    createdAt: user.created_at || null,
  };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const bucket = map.get(key) || [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

function requireEnv() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(`Missing required env for read-only audit: ${missing.join(', ')}`);
  }
}

async function listAllAuthUsers(supabase) {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  return users;
}

async function fetchEmployees(supabase) {
  const { data, error } = await supabase
    .from('employees')
    .select('id,email,role,level,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function countLegacyPasswordRows(supabase) {
  // Optional signal only. If the column is absent or blocked, do not fail the audit.
  const { data, error } = await supabase.from('employees').select('id,password').not('password', 'is', null);
  if (error) {
    return { available: false, count: null, reason: error.message };
  }
  return { available: true, count: data?.length || 0 };
}

function buildAudit(employees, authUsers, legacyPasswordRows) {
  const employeesByEmail = groupBy(employees, (employee) => normalizeEmail(employee.email));
  const authUsersByEmail = groupBy(authUsers, (user) => normalizeEmail(user.email));

  const missingEmailEmployees = employees.filter((employee) => !normalizeEmail(employee.email));
  const duplicateEmployeeEmails = [...employeesByEmail.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([email, rows]) => ({ email: maskEmail(email), count: rows.length, employees: rows.map(publicEmployee) }));
  const duplicateAuthEmails = [...authUsersByEmail.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([email, rows]) => ({ email: maskEmail(email), count: rows.length, authUsers: rows.map(publicAuthUser) }));

  const missingAuthUsers = [];
  const missingRoleMetadata = [];
  const roleMismatches = [];
  const unconfirmedAuthUsers = [];

  for (const employee of employees) {
    const email = normalizeEmail(employee.email);
    if (!email) continue;

    const authMatches = authUsersByEmail.get(email) || [];
    if (!authMatches.length) {
      missingAuthUsers.push(publicEmployee(employee));
      continue;
    }

    const authUser = authMatches[0];
    const rawAuthRole = authUser.app_metadata?.role || authUser.user_metadata?.role || authUser.role || null;
    const normalizedDbRole = normalizeUserRole(employee.role, employee.level);
    const normalizedAuthRole = rawAuthRole ? normalizeUserRole(rawAuthRole) : null;

    if (!rawAuthRole) {
      missingRoleMetadata.push({ employee: publicEmployee(employee), authUser: publicAuthUser(authUser) });
    } else if (normalizedAuthRole !== normalizedDbRole) {
      roleMismatches.push({ employee: publicEmployee(employee), authUser: publicAuthUser(authUser) });
    }

    if (!authUser.email_confirmed_at && !authUser.confirmed_at) {
      unconfirmedAuthUsers.push({ employee: publicEmployee(employee), authUser: publicAuthUser(authUser) });
    }
  }

  const orphanAuthUsers = authUsers
    .filter((user) => {
      const email = normalizeEmail(user.email);
      return email && !employeesByEmail.has(email);
    })
    .map(publicAuthUser);

  const blockers = {
    missingEmailEmployees: missingEmailEmployees.length,
    duplicateEmployeeEmails: duplicateEmployeeEmails.length,
    duplicateAuthEmails: duplicateAuthEmails.length,
    missingAuthUsers: missingAuthUsers.length,
    missingRoleMetadata: missingRoleMetadata.length,
    roleMismatches: roleMismatches.length,
    unconfirmedAuthUsers: unconfirmedAuthUsers.length,
  };

  const readyForStrictJwt = Object.values(blockers).every((count) => count === 0);

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only',
    readyForStrictJwt,
    totals: {
      employees: employees.length,
      authUsers: authUsers.length,
      orphanAuthUsers: orphanAuthUsers.length,
      employeesWithLegacyPassword: legacyPasswordRows,
    },
    blockers,
    details: {
      missingEmailEmployees: missingEmailEmployees.map(publicEmployee),
      duplicateEmployeeEmails,
      duplicateAuthEmails,
      missingAuthUsers,
      missingRoleMetadata,
      roleMismatches,
      unconfirmedAuthUsers,
      orphanAuthUsers,
    },
    nextSteps: readyForStrictJwt
      ? [
          'Run a real login smoke test for several roles.',
          'Enable REQUIRE_SUPABASE_JWT=true in a staging/preview environment first.',
          'After staging passes, enable strict JWT in production.',
        ]
      : [
          'Create/link missing Supabase Auth users for employee emails.',
          'Put the final app role into app_metadata.role or user_metadata.role for every Auth user.',
          'Fix role mismatches so Auth metadata matches employees.role/level.',
          'Re-run this audit before enabling REQUIRE_SUPABASE_JWT=true.',
        ],
  };
}

function summarize(audit) {
  const lines = [];
  lines.push('Supabase Auth readiness audit (read-only)');
  lines.push(`Generated: ${audit.generatedAt}`);
  lines.push('');
  lines.push(`Employees: ${audit.totals.employees}`);
  lines.push(`Auth users: ${audit.totals.authUsers}`);
  lines.push(`Orphan Auth users without employee row: ${audit.totals.orphanAuthUsers}`);
  if (audit.totals.employeesWithLegacyPassword.available) {
    lines.push(`Employees with legacy password field filled: ${audit.totals.employeesWithLegacyPassword.count}`);
  } else {
    lines.push('Employees legacy password count: unavailable/non-blocking');
  }
  lines.push('');
  lines.push(`Ready for REQUIRE_SUPABASE_JWT=true: ${audit.readyForStrictJwt ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('Blockers:');
  for (const [name, count] of Object.entries(audit.blockers)) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('Next steps:');
  for (const step of audit.nextSteps) lines.push(`- ${step}`);

  if (showDetails) {
    lines.push('');
    lines.push('Masked details:');
    lines.push(JSON.stringify(audit.details, null, 2));
  } else {
    lines.push('');
    lines.push('Use --show-details for masked per-user details, or --write-report to save JSON report.');
  }

  return lines.join('\n');
}

function runSelfTest() {
  const employees = [
    { id: 'emp-1', email: 'admin@example.com', role: 'admin', level: null },
    { id: 'emp-2', email: 'manager@example.com', role: 'manager', level: '2' },
    { id: 'emp-3', email: 'missing@example.com', role: 'assistant', level: '1' },
    { id: 'emp-4', email: 'norole@example.com', role: 'partner', level: null },
  ];
  const authUsers = [
    { id: 'auth-1', email: 'admin@example.com', app_metadata: { role: 'admin' }, user_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' },
    { id: 'auth-2', email: 'manager@example.com', app_metadata: { role: 'manager_1' }, user_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' },
    { id: 'auth-4', email: 'norole@example.com', app_metadata: {}, user_metadata: {}, email_confirmed_at: null },
    { id: 'auth-5', email: 'orphan@example.com', app_metadata: { role: 'assistant_1' }, user_metadata: {}, email_confirmed_at: '2026-01-01T00:00:00Z' },
  ];

  const audit = buildAudit(employees, authUsers, { available: true, count: 2 });
  assert.equal(audit.readyForStrictJwt, false);
  assert.equal(audit.blockers.missingAuthUsers, 1);
  assert.equal(audit.blockers.missingRoleMetadata, 1);
  assert.equal(audit.blockers.roleMismatches, 1);
  assert.equal(audit.blockers.unconfirmedAuthUsers, 1);
  assert.equal(audit.totals.orphanAuthUsers, 1);
  assert.match(summarize(audit), /Ready for REQUIRE_SUPABASE_JWT=true: NO/);
  console.log('auth readiness self-test passed');
}

async function main() {
  if (selfTest) {
    runSelfTest();
    return;
  }

  requireEnv();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [employees, authUsers, legacyPasswordRows] = await Promise.all([
    fetchEmployees(supabase),
    listAllAuthUsers(supabase),
    countLegacyPasswordRows(supabase),
  ]);

  const audit = buildAudit(employees, authUsers, legacyPasswordRows);

  if (writeReport) {
    await writeFile(reportPath, JSON.stringify(audit, null, 2));
  }

  if (asJson) {
    console.log(JSON.stringify(showDetails ? audit : { ...audit, details: undefined }, null, 2));
  } else {
    console.log(summarize(audit));
    if (writeReport) console.log(`\nReport saved: ${reportPath}`);
  }

  process.exitCode = audit.readyForStrictJwt ? 0 : 2;
}

main().catch((error) => {
  console.error(`Auth readiness audit failed: ${error.message}`);
  process.exitCode = 1;
});
