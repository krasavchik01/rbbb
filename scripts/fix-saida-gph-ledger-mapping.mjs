import fs from 'node:fs/promises';
import 'dotenv/config';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const MARKER = 'auto:partner-ledger-close-2026-06-09';
const SOURCE_FILE = 'Проекты Кенжекулов.xlsx';

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

const workbook = XLSX.readFile(SOURCE_FILE, { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: false });
const saidaClients = new Set();
for (const row of grid) {
  const client = compact(row[1]);
  const manager = compact(row[7]);
  if (client && manager.includes('Саида (ГПХ)')) {
    saidaClients.add(client);
  }
}

const report = JSON.parse(await fs.readFile('reports/partner-ledger-close/partner-ledger-close-report.json', 'utf8'));
const targetRows = (report.rows || []).filter((row) => row.commitAllowed && saidaClients.has(row.clientName));
const targetIds = [...new Set(targetRows.map((row) => row.matchedProjectId).filter(Boolean))];

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase
  .from('projects')
  .select('id,name,notes')
  .in('id', targetIds);
if (error) throw error;

let updated = 0;
for (const project of data || []) {
  const notes = parseNotes(project.notes);
  const team = Array.isArray(notes.team) ? notes.team : [];
  const nextTeam = team.filter((member) => {
    const isWrongSaida =
      member?.role === 'project_leader' &&
      /Бекболова Саийда/i.test(String(member?.userName || '')) &&
      member?.assignedBy === MARKER;
    return !isWrongSaida;
  });

  const row = targetRows.find((item) => item.matchedProjectId === project.id);
  const close = notes.partnerLedgerClose || {};
  const externalPeople = Array.isArray(close.externalPeople) ? close.externalPeople : [];
  if (!externalPeople.some((person) => person?.name === 'Саида (ГПХ)')) {
    externalPeople.push({
      name: 'Саида (ГПХ)',
      role: 'project_leader',
      source: 'ledger-manager-column',
    });
  }

  notes.team = nextTeam;
  notes.partnerLedgerClose = {
    ...close,
    externalPeople,
  };
  notes.saidaGphMappingFix = {
    marker: MARKER,
    sourceFile: SOURCE_FILE,
    sourceClient: row?.clientName || null,
    appliedAt: new Date().toISOString(),
    action: 'removed Bekbolova Saiyda project_leader; kept Saida (GPH) as external person',
  };
  notes.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('projects')
    .update({ notes: JSON.stringify(notes), updated_at: new Date().toISOString() })
    .eq('id', project.id);
  if (updateError) throw updateError;
  updated += 1;
  console.log(`fixed: ${project.name}`);
}

console.log(JSON.stringify({
  saidaLedgerRows: targetRows.length,
  uniqueProjects: targetIds.length,
  updated,
}, null, 2));
