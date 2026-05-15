-- ЯДЕРНЫЙ ВАРИАНТ - полный сброс
-- Запусти в Supabase SQL Editor

-- 1. Удаляем таблицу полностью
DROP TABLE IF EXISTS public.work_papers CASCADE;

-- 2. Создаем заново с МИНИМАЛЬНОЙ структурой
CREATE TABLE public.work_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'not_assigned',
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 3. ОТКЛЮЧАЕМ RLS временно
ALTER TABLE public.work_papers DISABLE ROW LEVEL SECURITY;

-- 4. Даем права
GRANT ALL ON public.work_papers TO anon;
GRANT ALL ON public.work_papers TO authenticated;
GRANT ALL ON public.work_papers TO service_role;

-- 5. Тестовая вставка
INSERT INTO public.work_papers (project_id, code, name, status)
VALUES (gen_random_uuid(), 'TEST-1', 'Test Procedure', 'not_assigned');

-- 6. Проверяем что вставилось
SELECT * FROM public.work_papers;

-- 7. Перезагружаем PostgREST
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');
