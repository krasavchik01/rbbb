-- Меняем тип колонки assigned_to на text вместо uuid
-- Это нужно потому что в project.team используются строковые ID вроде "manager_1", "partner_1"
ALTER TABLE public.work_papers
  ALTER COLUMN assigned_to TYPE text USING assigned_to::text,
  ALTER COLUMN assigned_mc TYPE text USING assigned_mc::text,
  ALTER COLUMN reviewer_id TYPE text USING reviewer_id::text;

-- Обновляем схему
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');
