-- ИСПРАВЛЕНИЕ: Создание таблицы work_papers если её нет
-- Запустите этот SQL в Supabase SQL Editor

-- Проверяем и создаем таблицу work_papers
CREATE TABLE IF NOT EXISTS work_papers (
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

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_work_papers_project_id ON work_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_work_papers_template_id ON work_papers(template_id);
CREATE INDEX IF NOT EXISTS idx_work_papers_status ON work_papers(status);
CREATE INDEX IF NOT EXISTS idx_work_papers_assigned_to ON work_papers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_papers_reviewer_id ON work_papers(reviewer_id);

-- GIN индекс для JSONB поля
CREATE INDEX IF NOT EXISTS idx_work_papers_data ON work_papers USING GIN (data);

-- RLS (Row Level Security)
ALTER TABLE work_papers ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view work papers from their projects" ON work_papers;
DROP POLICY IF EXISTS "Assigned users can update their work papers" ON work_papers;
DROP POLICY IF EXISTS "Reviewers can review work papers" ON work_papers;
DROP POLICY IF EXISTS "Managers can view all work papers in their projects" ON work_papers;
DROP POLICY IF EXISTS "Anyone can insert work papers" ON work_papers;
DROP POLICY IF EXISTS "Managers can manage work papers" ON work_papers;

-- Политика для просмотра (все авторизованные пользователи)
CREATE POLICY "Anyone authenticated can view work papers" ON work_papers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Политика для вставки (все авторизованные пользователи)
CREATE POLICY "Anyone authenticated can insert work papers" ON work_papers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Политика для обновления (все авторизованные пользователи)
CREATE POLICY "Anyone authenticated can update work papers" ON work_papers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Политика для удаления (все авторизованные пользователи)
CREATE POLICY "Anyone authenticated can delete work papers" ON work_papers
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Комментарии
COMMENT ON TABLE work_papers IS 'Рабочие документы (аудиторские процедуры) в проектах';
COMMENT ON COLUMN work_papers.data IS 'JSON данные документа';
COMMENT ON COLUMN work_papers.status IS 'Статус выполнения процедуры';
