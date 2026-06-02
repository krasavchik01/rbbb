import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);

const { data: projects } = await sb.from('projects').select('id, name, partner_id, manager_id, notes').limit(500);
console.log('Total projects:', projects.length);

let withPartnerCol = 0, withPartnerInNotes = 0, withTeam = 0, withPartnerInTeam = 0;
const examples = [];
const partnersInNotes = new Set();
for (const p of projects) {
  if (p.partner_id) withPartnerCol++;
  let notes = null;
  try { notes = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes; } catch {}
  if (!notes) continue;
  const team = Array.isArray(notes.team) ? notes.team : [];
  if (team.length) withTeam++;
  const partnerInTeam = team.find(t => {
    const r = (t.role || t.position || '').toString().toLowerCase();
    return r.includes('партнер') || r.includes('партнёр') || r === 'partner';
  });
  if (partnerInTeam) {
    withPartnerInTeam++;
    partnersInNotes.add(partnerInTeam.name || partnerInTeam.userId || JSON.stringify(partnerInTeam));
  }
  if (notes.partner || notes.partnerId || notes.partner_id) withPartnerInNotes++;
  if (examples.length < 3 && team.length) examples.push({ id: p.id, name: p.name, team });
}

console.log('partner_id column filled:', withPartnerCol);
console.log('notes.partner* filled:', withPartnerInNotes);
console.log('projects with team[]:', withTeam);
console.log('projects with partner in team[]:', withPartnerInTeam);
console.log('\nUnique partners found in team[]:');
for (const p of partnersInNotes) console.log(' -', p);
console.log('\nExamples of team[]:');
for (const e of examples) {
  console.log(`\n[${e.name}]`);
  for (const t of e.team) console.log('  ', JSON.stringify(t));
}

// Employees: partners
const { data: emps } = await sb.from('employees').select('id, full_name, role, level').limit(500);
console.log('\nEmployees with role/level containing "партнер" or "partner":');
for (const e of emps || []) {
  const blob = `${e.role || ''} ${e.level || ''}`.toLowerCase();
  if (blob.includes('партнер') || blob.includes('партнёр') || blob.includes('partner')) {
    console.log(' -', e.full_name, '|', e.role, '|', e.level, '|', e.id);
  }
}
