-- Проверяем текущие RLS политики таблицы projects
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'projects';

-- Проверяем существующие политики
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'projects';

-- ИСПРАВЛЕНИЕ: разрешаем все операции для всех (как в других таблицах)
-- Если RLS включён — добавляем разрешающие политики
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- Если хочешь оставить RLS включённым, используй вместо строки выше:
-- ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "allow_all_projects" ON public.projects;
-- CREATE POLICY "allow_all_projects" ON public.projects
--   FOR ALL
--   TO anon, authenticated
--   USING (true)
--   WITH CHECK (true);
