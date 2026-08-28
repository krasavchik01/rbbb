#!/usr/bin/env node
/**
 * Idempotently assigns the canonical partner for every project whose own
 * company is «ЧК Rusell/Russell».  The project is the source of truth:
 * partner_id is maintained for legacy views and notes.team for HUB.
 *
 * Usage:
 *   node scripts/assign-russel-projects-to-shyngys.mjs          # read-only
 *   node scripts/assign-russel-projects-to-shyngys.mjs --apply  # persist
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Не найдены учётные данные Supabase. Нужны .env / VITE_SUPABASE_URL и ключ доступа.');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_PARTNER = {
  id: '3ceb66d6-1ecf-4ab2-8a98-aa2436b9d0fd',
  name: 'Шынгыс Сартаев',
  email: 's.sartayev@rbpartners.kz',
};

function readNotes(raw) {
  if (raw && typeof raw === 'object') return { ...raw };
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normal(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .replace(/[^a-zа-я0-9]+/giu, '');
}

function isRusselCompany(value) {
  const normalized = normal(value);
  return normalized === 'чкrusell'
    || normalized === 'чкrussell'
    || normalized === 'чкрассел'
    || normalized === 'чкруссел';
}

function projectCompany(notes) {
  return notes.companyName
    || notes.company
    || notes.ourCompany
    || notes.company_name
    || '';
}

function memberRole(member) {
  return String(member?.role || member?.role_on_project || '').trim().toLowerCase();
}

function memberId(member) {
  return member?.userId || member?.user_id || member?.employeeId || member?.employee_id || member?.id || '';
}

function nextNotesForProject(notes) {
  const currentTeam = Array.isArray(notes.team) ? notes.team : [];
  const withoutPartners = currentTeam.filter((member) => memberRole(member) !== 'partner');
  const withoutDuplicateShyngys = withoutPartners.filter((member) => memberId(member) !== TARGET_PARTNER.id);
  const now = new Date().toISOString();
  return {
    ...notes,
    team: [
      {
        userId: TARGET_PARTNER.id,
        userName: TARGET_PARTNER.name,
        userEmail: TARGET_PARTNER.email,
        name: TARGET_PARTNER.name,
        role: 'partner',
        bonusPercent: 25,
        assignedAt: now,
        assignedBy: 'bulk:chkrussel-partner-2026-08-28',
      },
      ...withoutDuplicateShyngys,
    ],
    teamSource: 'canonical',
    teamUnifiedAt: notes.teamUnifiedAt || now,
    partnerId: TARGET_PARTNER.id,
    partnerName: TARGET_PARTNER.name,
  };
}

async function readAllProjects() {
  const projects = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('projects')
      .select('id,name,partner_id,notes')
      .range(from, from + 999);
    if (error) throw new Error(`Не удалось прочитать projects: ${error.message}`);
    projects.push(...(data || []));
    if (!data || data.length < 1000) return projects;
  }
}

const projects = await readAllProjects();
const targets = projects
  .map((project) => ({ project, notes: readNotes(project.notes) }))
  .filter(({ notes }) => isRusselCompany(projectCompany(notes)));

const changes = targets.filter(({ project, notes }) => {
  const team = Array.isArray(notes.team) ? notes.team : [];
  const partners = team.filter((member) => memberRole(member) === 'partner');
  return project.partner_id !== TARGET_PARTNER.id
    || partners.length !== 1
    || memberId(partners[0]) !== TARGET_PARTNER.id;
});

const result = {
  mode: apply ? 'apply' : 'dry-run',
  company: 'ЧК Rusell',
  partner: TARGET_PARTNER.name,
  matchedProjects: targets.length,
  alreadyCanonical: targets.length - changes.length,
  toUpdate: changes.length,
  examples: changes.slice(0, 12).map(({ project, notes }) => ({
    id: project.id,
    name: project.name,
    currentCompany: projectCompany(notes),
    currentPartnerId: project.partner_id,
    currentPartners: (Array.isArray(notes.team) ? notes.team : [])
      .filter((member) => memberRole(member) === 'partner')
      .map((member) => member?.userName || member?.name || memberId(member)),
  })),
};

if (!apply) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const failed = [];
for (const { project, notes } of changes) {
  const { error } = await supabase
    .from('projects')
    .update({
      partner_id: TARGET_PARTNER.id,
      notes: nextNotesForProject(notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id);
  if (error) failed.push({ id: project.id, name: project.name, error: error.message });
}

console.log(JSON.stringify({
  ...result,
  updated: changes.length - failed.length,
  failed,
}, null, 2));

if (failed.length > 0) process.exitCode = 1;
