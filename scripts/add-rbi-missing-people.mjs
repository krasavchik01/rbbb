#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';
const REVIEW_PATH = path.join(process.cwd(), 'reports', 'rbi-project-enrichment-dryrun', 'people-review.json');
const OUT_DIR = path.join(process.cwd(), 'reports', 'rbi-project-enrichment-dryrun');
const COMMIT = process.argv.includes('--commit');

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return compact(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/й/g, 'и')
    .replace(/ы/g, 'и')
    .replace(/[ә]/g, 'а')
    .replace(/[ғ]/g, 'г')
    .replace(/[қ]/g, 'к')
    .replace(/[ң]/g, 'н')
    .replace(/[ө]/g, 'о')
    .replace(/[ұү]/g, 'у')
    .replace(/[һ]/g, 'х')
    .replace(/[і]/g, 'и')
    .replace(/[«»"“”'`№]/g, ' ')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalKey(name) {
  const parts = normalizeText(name).split(' ').filter(Boolean).sort();
  return parts.join('|');
}

function roleFromSource(sourceRoles) {
  if (sourceRoles.includes('partner')) return { role: 'partner', level: '1' };
  if (sourceRoles.includes('project_leader')) return { role: 'manager', level: '1' };
  if (sourceRoles.some((role) => role.startsWith('tax_specialist'))) return { role: 'tax_specialist', level: '1' };
  return { role: 'employee', level: '1' };
}

function chooseCanonical(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = canonicalKey(row.name);
    if (!key) continue;
    const current = byKey.get(key);
    if (!current || row.count > current.count || (row.count === current.count && row.name.length > current.name.length)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function csvEscape(value) {
  const s = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  return [
    columns.map((c) => csvEscape(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvEscape(c.get(row))).join(',')),
  ].join('\n');
}

async function main() {
  const rows = JSON.parse(await fs.readFile(REVIEW_PATH, 'utf8'));
  const candidates = chooseCanonical(rows);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: employees, error } = await sb.from('employees').select('id,name,role,level,email').order('name');
  if (error) throw error;

  const existingKeys = new Set(employees.map((employee) => canonicalKey(employee.name)));
  const planned = [];
  const skipped = [];

  for (const row of candidates) {
    const key = canonicalKey(row.name);
    if (existingKeys.has(key)) {
      skipped.push({ name: row.name, count: row.count, reason: 'already_exists_by_name_key' });
      continue;
    }
    const { role, level } = roleFromSource(row.sourceRoles);
    planned.push({
      name: row.name,
      role,
      level,
      email: null,
      password: null,
      whatsapp: null,
      sourceCount: row.count,
      sourceRoles: row.sourceRoles,
      sourceExamples: row.examples || [],
    });
    existingKeys.add(key);
  }

  let inserted = [];
  if (COMMIT && planned.length > 0) {
    const payload = planned.map(({ sourceCount, sourceRoles, sourceExamples, ...employee }) => employee);
    const { data, error: insertError } = await sb.from('employees').insert(payload).select('id,name,role,level,email');
    if (insertError) throw insertError;
    inserted = data || [];
  }

  await fs.writeFile(path.join(OUT_DIR, 'people-add-results.csv'), toCsv(planned, [
    { header: 'name', get: (row) => row.name },
    { header: 'role', get: (row) => row.role },
    { header: 'level', get: (row) => row.level },
    { header: 'source_count', get: (row) => row.sourceCount },
    { header: 'source_roles', get: (row) => row.sourceRoles },
    { header: 'examples', get: (row) => row.sourceExamples },
    { header: 'committed', get: () => COMMIT },
  ]), 'utf8');

  await fs.writeFile(path.join(OUT_DIR, 'people-add-results.json'), JSON.stringify({
    committed: COMMIT,
    planned,
    inserted,
    skipped,
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    committed: COMMIT,
    planned: planned.length,
    inserted: inserted.length,
    skipped: skipped.length,
    byRole: planned.reduce((acc, row) => {
      acc[row.role] = (acc[row.role] || 0) + 1;
      return acc;
    }, {}),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
