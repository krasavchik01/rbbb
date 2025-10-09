-- Исправление проблемы с UUID
-- Удаляем старую таблицу и создаём правильную

-- Удалить старую таблицу
DROP TABLE IF EXISTS project_data CASCADE;

-- Создать новую таблицу с правильными типами
CREATE TABLE project_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL UNIQUE,
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
  
  -- Метаданные (created_by теперь TEXT!)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT  -- Изменили с UUID на TEXT!
);

-- Индексы
CREATE INDEX idx_project_data_project_id ON project_data(project_id);
CREATE INDEX idx_project_data_template_id ON project_data(template_id);
CREATE INDEX idx_project_data_created_by ON project_data(created_by);

-- Функция автообновления
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер
CREATE TRIGGER update_project_data_updated_at
    BEFORE UPDATE ON project_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS политики
ALTER TABLE project_data ENABLE ROW LEVEL SECURITY;

-- Простая политика - разрешить всё для авторизованных
DROP POLICY IF EXISTS "Allow all for authenticated users" ON project_data;
CREATE POLICY "Allow all for authenticated users"
  ON project_data
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Разрешить всё для анонимных (для локальной аутентификации)
CREATE POLICY "Allow all for anon users"
  ON project_data
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Комментарии
COMMENT ON TABLE project_data IS 'Данные проектов на основе шаблонов';
COMMENT ON COLUMN project_data.created_by IS 'ID пользователя (текстовый)';

