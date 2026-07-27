import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.vercel.local', override: false });

const employeeId = '615aae11-42ec-49af-9933-f2a85bcb864a';
const employeeEmail = 'rbzakupki@rbpartners.kz';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadEmployee() {
  const { data, error } = await supabase
    .from('employees')
    .select('id,email,role,level,updated_at')
    .eq('id', employeeId)
    .ilike('email', employeeEmail);

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(`Expected exactly one guarded procurement employee, found ${data?.length || 0}`);
  }
  return data[0];
}

const before = await loadEmployee();

if (before.role !== 'procurement' || String(before.level || '') !== '1') {
  const { data, error } = await supabase
    .from('employees')
    .update({
      role: 'procurement',
      level: '1',
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
    .ilike('email', employeeEmail)
    .select('id,email,role,level,updated_at');

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(`Guarded procurement role update changed ${data?.length || 0} rows`);
  }
}

const after = await loadEmployee();
if (after.role !== 'procurement' || String(after.level || '') !== '1') {
  throw new Error('Procurement role verification failed');
}

console.log(JSON.stringify({
  id: after.id,
  email: after.email,
  previousRole: before.role,
  role: after.role,
  level: after.level,
  verified: true,
}));
