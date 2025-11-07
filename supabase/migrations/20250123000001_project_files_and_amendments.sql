-- Миграция для расширенной функциональности управления проектами
-- 1. Таблица для файлов проекта
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL, -- Ссылка на проект (может быть в notes как JSON)
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL, -- Путь в Supabase Storage
  category TEXT CHECK (category IN ('contract', 'scan', 'document', 'screenshot', 'other')),
  uploaded_by TEXT NOT NULL, -- user_id
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_uploaded_by ON project_files(uploaded_by);

-- 2. Таблица для доп соглашений
CREATE TABLE IF NOT EXISTS project_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  number TEXT NOT NULL, -- Номер доп соглашения
  date DATE NOT NULL,
  description TEXT,
  file_url TEXT, -- URL файла доп соглашения (если есть)
  created_by TEXT NOT NULL, -- user_id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_project_amendments_project_id ON project_amendments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_amendments_created_by ON project_amendments(created_by);

-- 3. Включаем RLS для безопасности
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_amendments ENABLE ROW LEVEL SECURITY;

-- Политики для project_files
-- Просмотр: команда проекта и выше
CREATE POLICY "Allow project team to view files"
  ON project_files FOR SELECT
  USING (true); -- TODO: Добавить проверку участия в команде проекта

-- Загрузка: отдел закупок при создании, потом команда проекта
CREATE POLICY "Allow procurement and team to upload files"
  ON project_files FOR INSERT
  WITH CHECK (true); -- TODO: Добавить проверку роли

-- Удаление: только тот, кто загрузил, или админ
CREATE POLICY "Allow file owner or admin to delete files"
  ON project_files FOR DELETE
  USING (
    uploaded_by = auth.uid()::text 
    OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role IN ('admin', 'ceo'))
  );

-- Политики для project_amendments
-- Просмотр: команда проекта и выше
CREATE POLICY "Allow project team to view amendments"
  ON project_amendments FOR SELECT
  USING (true);

-- Добавление: только отдел закупок
CREATE POLICY "Allow procurement to create amendments"
  ON project_amendments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE id = auth.uid()::text 
      AND app_role IN ('procurement', 'admin', 'ceo')
    )
  );

-- Обновление/удаление: только тот, кто создал, или админ
CREATE POLICY "Allow amendment creator or admin to modify"
  ON project_amendments FOR UPDATE
  USING (
    created_by = auth.uid()::text 
    OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role IN ('admin', 'ceo'))
  );

CREATE POLICY "Allow amendment creator or admin to delete"
  ON project_amendments FOR DELETE
  USING (
    created_by = auth.uid()::text 
    OR EXISTS (SELECT 1 FROM employees WHERE id = auth.uid()::text AND role IN ('admin', 'ceo'))
  );

-- Комментарии
COMMENT ON TABLE project_files IS 'Файлы проектов (договоры, сканы, документы, скриншоты)';
COMMENT ON TABLE project_amendments IS 'Дополнительные соглашения для действующих проектов';

