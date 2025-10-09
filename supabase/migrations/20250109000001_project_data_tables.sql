-- Миграция для хранения данных проектов на основе шаблонов
-- Безопасно: создаётся только если таблицы не существуют

-- Таблица для хранения заполненных данных проектов
CREATE TABLE IF NOT EXISTS project_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL UNIQUE, -- ID проекта из projects таблицы
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  
  -- Данные паспорта (JSON)
  passport_data JSONB DEFAULT '{}'::jsonb,
  
  -- Данные процедур по этапам (JSON)
  stages_data JSONB DEFAULT '{}'::jsonb,
  
  -- Статус выполнения (JSON)
  completion_status JSONB DEFAULT '{"totalElements": 0, "completedElements": 0, "percentage": 0}'::jsonb,
  
  -- История изменений (JSON Array)
  history JSONB DEFAULT '[]'::jsonb,
  
  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Индексы для быстрого поиска
  CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Индекс для быстрого поиска по project_id
CREATE INDEX IF NOT EXISTS idx_project_data_project_id ON project_data(project_id);

-- Индекс для поиска по шаблону
CREATE INDEX IF NOT EXISTS idx_project_data_template_id ON project_data(template_id);

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автообновления updated_at
DROP TRIGGER IF EXISTS update_project_data_updated_at ON project_data;
CREATE TRIGGER update_project_data_updated_at
    BEFORE UPDATE ON project_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) политики
ALTER TABLE project_data ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи видят только свои данные проектов или проекты своей компании
CREATE POLICY "Users can view their own project data"
  ON project_data
  FOR SELECT
  USING (
    auth.uid() = created_by
    OR 
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_data.project_id::uuid
      AND (
        projects.created_by = auth.uid()
        OR auth.uid() IN (SELECT unnest(projects.team))
      )
    )
  );

-- Политика: пользователи могут вставлять свои данные
CREATE POLICY "Users can insert their own project data"
  ON project_data
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Политика: пользователи могут обновлять свои данные или данные проектов в которых участвуют
CREATE POLICY "Users can update their own project data"
  ON project_data
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR 
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_data.project_id::uuid
      AND auth.uid() IN (SELECT unnest(projects.team))
    )
  );

-- Политика: только создатель может удалять данные
CREATE POLICY "Users can delete their own project data"
  ON project_data
  FOR DELETE
  USING (auth.uid() = created_by);

-- Комментарии к таблице
COMMENT ON TABLE project_data IS 'Хранит заполненные данные проектов на основе шаблонов методологий';
COMMENT ON COLUMN project_data.project_id IS 'ID связанного проекта';
COMMENT ON COLUMN project_data.template_id IS 'ID шаблона методологии';
COMMENT ON COLUMN project_data.passport_data IS 'Данные паспорта проекта (кастомные поля)';
COMMENT ON COLUMN project_data.stages_data IS 'Данные процедур по этапам';
COMMENT ON COLUMN project_data.completion_status IS 'Статус выполнения проекта';
COMMENT ON COLUMN project_data.history IS 'История изменений';



