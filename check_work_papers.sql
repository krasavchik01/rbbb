-- Проверка таблицы work_papers
-- Запустите это в Supabase SQL Editor чтобы проверить что всё создалось

-- 1. Проверяем что таблица существует
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'work_papers';

-- 2. Проверяем колонки таблицы
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_papers'
ORDER BY ordinal_position;

-- 3. Проверяем политики RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'work_papers';

-- 4. Проверяем что RLS включен
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'work_papers';

-- 5. Тестовая вставка (раскомментируйте если хотите протестировать)
-- INSERT INTO work_papers (project_id, code, name, status)
-- VALUES (gen_random_uuid(), 'TEST-1', 'Тестовая процедура', 'not_assigned')
-- RETURNING *;
