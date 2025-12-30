-- ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ - запустите ТОЛЬКО ЭТОТ скрипт
-- Копируйте ВСЁ и запускайте в Supabase SQL Editor

-- Шаг 1: Удаляем таблицу если есть
DROP TABLE IF EXISTS work_papers CASCADE;

-- Шаг 2: Создаем таблицу заново
CREATE TABLE work_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  template_id UUID,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'not_assigned',
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

-- Шаг 3: Создаем индексы
CREATE INDEX idx_work_papers_project_id ON work_papers(project_id);
CREATE INDEX idx_work_papers_status ON work_papers(status);
CREATE INDEX idx_work_papers_assigned_to ON work_papers(assigned_to);

-- Шаг 4: Включаем RLS
ALTER TABLE work_papers ENABLE ROW LEVEL SECURITY;

-- Шаг 5: Создаем политики (САМЫЕ ПРОСТЫЕ - разрешаем ВСЁ)
CREATE POLICY "work_papers_select" ON work_papers FOR SELECT USING (true);
CREATE POLICY "work_papers_insert" ON work_papers FOR INSERT WITH CHECK (true);
CREATE POLICY "work_papers_update" ON work_papers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "work_papers_delete" ON work_papers FOR DELETE USING (true);

-- Шаг 6: Уведомляем PostgREST
NOTIFY pgrst, 'reload schema';
