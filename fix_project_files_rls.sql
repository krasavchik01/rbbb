-- Фикс RLS политик для файлов проектов, чтобы их видел отдел закупок, администраторы, партнёры и менеджеры
-- А также члены команды проекта

-- 1. Удаляем старые политики для просмотра
DROP POLICY IF EXISTS "Allow project team to view files" ON project_files;
DROP POLICY IF EXISTS "Allow authorized roles to view files" ON project_files;

-- 2. Создаем новую политику, разрешающую просмотр:
--    - Администраторам, CEO, Зам. директора, Отделу закупок, Партнёрам и Менеджерам
--    - Всем членам команды проекта
CREATE POLICY "Allow authorized roles to view project files" 
  ON project_files FOR SELECT 
  USING (
    -- Проверка по глобальной роли
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid()::text 
      AND (
        role IN ('admin', 'ceo', 'procurement', 'partner', 'deputy_director')
        OR role LIKE 'manager_%'
        OR role LIKE 'supervisor_%'
      )
    )
    OR 
    -- Проверка по участию в команде проекта
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_files.project_id
      AND (
        p.created_by = auth.uid()
        OR auth.uid()::text = ANY(p.team::text[])
        -- Если команда хранится в jsonb notes.team
        OR (p.notes->'team') @> jsonb_build_array(jsonb_build_object('userId', auth.uid()::text))
      )
    )
  );

-- 3. Политика на загрузку (INSERT)
DROP POLICY IF EXISTS "Allow authorized roles to upload files" ON project_files;
CREATE POLICY "Allow authorized roles to upload files" 
  ON project_files FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid()::text 
      AND (
        role IN ('admin', 'ceo', 'procurement', 'partner')
        OR role LIKE 'manager_%'
      )
    )
  );

-- 4. Политика на удаление (DELETE)
DROP POLICY IF EXISTS "Allow owners and admins to delete files" ON project_files;
CREATE POLICY "Allow owners and admins to delete files" 
  ON project_files FOR DELETE 
  USING (
    auth.uid()::text = uploaded_by 
    OR EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid()::text 
      AND role IN ('admin', 'ceo', 'procurement')
    )
  );
