-- Обновление кеша схемы Supabase
-- Запустите это если таблица создана но Supabase её не видит

-- 1. Уведомляем PostgREST об изменениях в схеме
NOTIFY pgrst, 'reload schema';

-- 2. Альтернативный способ - пересоздаем таблицу с FORCE
DROP TABLE IF EXISTS work_papers CASCADE;

CREATE TABLE work_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  template_id UUID,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'not_assigned' CHECK (status IN ('not_assigned', 'assigned', 'in_progress', 'review', 'completed', 'not_started', 'awaiting_review', 'rejected')),
  data JSONB DEFAULT '{}',
  review_history JSONB DEFAULT '[]',
  assigned_to UUID,
  reviewer_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, code)
);

-- Индексы
CREATE INDEX idx_work_papers_project_id ON work_papers(project_id);
CREATE INDEX idx_work_papers_template_id ON work_papers(template_id);
CREATE INDEX idx_work_papers_status ON work_papers(status);
CREATE INDEX idx_work_papers_assigned_to ON work_papers(assigned_to);
CREATE INDEX idx_work_papers_reviewer_id ON work_papers(reviewer_id);
CREATE INDEX idx_work_papers_data ON work_papers USING GIN (data);

-- RLS
ALTER TABLE work_papers ENABLE ROW LEVEL SECURITY;

-- Политики (УПРОЩЕННЫЕ - разрешаем всё авторизованным пользователям)
CREATE POLICY "Enable all for authenticated users" ON work_papers
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Комментарии
COMMENT ON TABLE work_papers IS 'Рабочие документы (аудиторские процедуры) в проектах';

-- Снова уведомляем об изменениях
NOTIFY pgrst, 'reload schema';
