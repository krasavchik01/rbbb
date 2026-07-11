-- Safely ensure employees.password exists and refresh Supabase schema cache.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password text;

-- Ask PostgREST to reload schema cache so the new column becomes visible immediately.
NOTIFY pgrst, 'reload schema';
