-- Добавляем колонку updated_at если её нет
ALTER TABLE public.work_papers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Обновляем схему
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');
