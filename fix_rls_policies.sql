-- ИСПРАВЛЕНИЕ RLS политик для work_papers
-- Копируйте и запускайте в Supabase SQL Editor

-- Удаляем все старые политики
DROP POLICY IF EXISTS "Enable all for authenticated users" ON work_papers;
DROP POLICY IF EXISTS "Anyone authenticated can view work papers" ON work_papers;
DROP POLICY IF EXISTS "Anyone authenticated can insert work papers" ON work_papers;
DROP POLICY IF EXISTS "Anyone authenticated can update work papers" ON work_papers;
DROP POLICY IF EXISTS "Anyone authenticated can delete work papers" ON work_papers;

-- Создаем простые политики которые разрешают ВСЁ для авторизованных пользователей
CREATE POLICY "allow_all_authenticated_select" ON work_papers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_all_authenticated_insert" ON work_papers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_all_authenticated_update" ON work_papers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_authenticated_delete" ON work_papers
  FOR DELETE
  TO authenticated
  USING (true);
