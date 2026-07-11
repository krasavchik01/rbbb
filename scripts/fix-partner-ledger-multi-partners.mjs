import fs from 'node:fs/promises';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const MARKER = 'auto:partner-ledger-close-2026-06-09';
const TARGET_IDS = [
  '8e331c7d-c5ff-410a-9fd4-b1a2a7f174e4',
  '9498c171-2efb-4a0c-be5d-c58a3a2adcea',
  '27d15f79-0343-4289-ad13-0427587698a0',
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[«»"“”'`]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[ә]/g, 'а')
    .replace(/[ғ]/g, 'г')
    .replace(/[қ]/g, 'к')
    .replace(/[ң]/g, 'н')
    .replace(/[ө]/g, 'о')
    .replace(/[ұү]/g, 'у')
    .replace(/[һ]/g, 'х')
    .replace(/[і]/g, 'и')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .trim();
}

function parseNotes(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const report = JSON.parse(await fs.readFile('reports/partner-ledger-close/partner-ledger-close-report.json', 'utf8'));
const expectedPartnerByProject = new Map();
for (const row of report.rows || []) {
  if (!TARGET_IDS.includes(row.matchedProjectId)) continue;
  expectedPartnerByProject.set(row.matchedProjectId, normalizeText(row.partner));
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase
  .from('projects')
  .select('id,name,notes')
  .in('id', TARGET_IDS);
if (error) throw error;

let updated = 0;
for (const project of data || []) {
  const notes = parseNotes(project.notes);
  const team = Array.isArray(notes.team) ? notes.team : [];
  const expected = expectedPartnerByProject.get(project.id);
  const partners = team.filter((member) => member?.role === 'partner');
  const keepPartner =
    partners.find((member) => {
      const name = normalizeText(member.userName);
      return name.includes(expected) || expected.includes(name);
    }) || partners[0];

  if (!keepPartner) continue;

  notes.team = team.filter((member) => member?.role !== 'partner' || member.userId === keepPartner.userId);
  notes.updated_at = new Date().toISOString();
  notes.partnerLedgerPartnerDedup = {
    marker: MARKER,
    expectedPartner: expected,
    keptPartner: keepPartner.userName,
    appliedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('projects')
    .update({ notes: JSON.stringify(notes), updated_at: new Date().toISOString() })
    .eq('id', project.id);
  if (updateError) throw updateError;
  updated += 1;
  console.log(`fixed: ${project.name} -> ${keepPartner.userName}`);
}

console.log(JSON.stringify({ updated }, null, 2));
