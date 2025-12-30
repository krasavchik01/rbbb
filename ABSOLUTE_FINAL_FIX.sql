-- АБСОЛЮТНО ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ
-- Запусти это в Supabase SQL Editor

-- Проверяем схему таблицы
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'work_papers';

-- Если таблица в схеме 'public' - пересоздаем с явным указанием схемы
DROP TABLE IF EXISTS public.work_papers CASCADE;

CREATE TABLE public.work_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'not_assigned'::text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.work_papers ENABLE ROW LEVEL SECURITY;

-- Максимально открытая политика
CREATE POLICY "work_papers_all_access" ON public.work_papers
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Грантим права
GRANT ALL ON public.work_papers TO postgres;
GRANT ALL ON public.work_papers TO anon;
GRANT ALL ON public.work_papers TO authenticated;
GRANT ALL ON public.work_papers TO service_role;

-- Принудительно обновляем PostgREST
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');

-- Проверяем что всё создалось
SELECT * FROM public.work_papers LIMIT 1;
