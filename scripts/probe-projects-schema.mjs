import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://mknvqsnitzaurpwnhzwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY',
);
const { data: row } = await sb.from('projects').select('*').limit(1).single();
console.log('First project columns:');
console.log(Object.keys(row).sort());
console.log('\nSample values:');
for (const k of Object.keys(row).sort()) {
  const v = row[k];
  const display = typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v;
  console.log(`  ${k.padEnd(25)} ${typeof v === 'object' ? JSON.stringify(display) : String(display)}`);
}
// Уникальные статусы
const { data: all } = await sb.from('projects').select('status');
const statuses = [...new Set(all.map(r => r.status))];
console.log('\nUnique statuses in projects:', statuses);
