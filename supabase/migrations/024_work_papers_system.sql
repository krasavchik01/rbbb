-- Миграция: Система рабочих документов для аудита
-- Создает таблицы для методологий, шаблонов и рабочих документов

-- 1. Таблица методологий
CREATE TABLE IF NOT EXISTS methodologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0',
  category TEXT, -- 'audit', 'consulting', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true
);

-- 2. Таблица разделов методологии
CREATE TABLE IF NOT EXISTS methodology_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  methodology_id UUID NOT NULL REFERENCES methodologies(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- 'A', 'B', 'J', 'K', etc.
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES methodology_sections(id) ON DELETE CASCADE, -- для вложенности
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(methodology_id, code)
);

-- 3. Таблица шаблонов рабочих документов
CREATE TABLE IF NOT EXISTS work_paper_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES methodology_sections(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- 'J-1', 'J-30', 'A1', etc.
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT, -- стандартная цель документа
  procedures_template JSONB, -- массив стандартных процедур
  structure_definition JSONB NOT NULL, -- КЛЮЧЕВОЕ ПОЛЕ: структура документа
  default_assignee_role TEXT, -- 'assistant', 'supervisor', 'manager', 'partner', 'tax'
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, code)
);

-- 4. Таблица рабочих документов в проектах
CREATE TABLE IF NOT EXISTS work_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL, -- ссылка на projects (может быть в другой таблице)
  template_id UUID NOT NULL REFERENCES work_paper_templates(id) ON DELETE RESTRICT,
  code TEXT NOT NULL, -- 'J-1', 'J-30', etc.
  name TEXT NOT NULL,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'awaiting_review', 'completed', 'rejected')),
  data JSONB DEFAULT '{}', -- КЛЮЧЕВОЕ ПОЛЕ: фактические данные, введенные пользователем
  review_history JSONB DEFAULT '[]', -- массив объектов с reviewer_id, timestamp, comment, status
  assigned_to UUID REFERENCES auth.users(id),
  reviewer_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, code)
);

-- 5. Расширение таблицы tasks (если существует)
-- Добавляем связь с рабочими документами
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    -- Проверяем, существует ли колонка
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'work_paper_id') THEN
      ALTER TABLE tasks ADD COLUMN work_paper_id UUID REFERENCES work_papers(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_methodology_sections_methodology_id ON methodology_sections(methodology_id);
CREATE INDEX IF NOT EXISTS idx_methodology_sections_parent_id ON methodology_sections(parent_id);
CREATE INDEX IF NOT EXISTS idx_work_paper_templates_section_id ON work_paper_templates(section_id);
CREATE INDEX IF NOT EXISTS idx_work_papers_project_id ON work_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_work_papers_template_id ON work_papers(template_id);
CREATE INDEX IF NOT EXISTS idx_work_papers_status ON work_papers(status);
CREATE INDEX IF NOT EXISTS idx_work_papers_assigned_to ON work_papers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_papers_reviewer_id ON work_papers(reviewer_id);

-- GIN индексы для JSONB полей
CREATE INDEX IF NOT EXISTS idx_work_papers_data ON work_papers USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_work_paper_templates_structure ON work_paper_templates USING GIN (structure_definition);

-- RLS (Row Level Security) политики
ALTER TABLE methodologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE methodology_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_paper_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_papers ENABLE ROW LEVEL SECURITY;

-- Политики для methodologies (все могут читать активные, только админы могут редактировать)
CREATE POLICY "Anyone can view active methodologies" ON methodologies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage methodologies" ON methodologies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' IN ('ceo', 'deputy_director', 'admin'))
    )
  );

-- Политики для methodology_sections (все могут читать)
CREATE POLICY "Anyone can view methodology sections" ON methodology_sections
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage methodology sections" ON methodology_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' IN ('ceo', 'deputy_director', 'admin'))
    )
  );

-- Политики для work_paper_templates (все могут читать)
CREATE POLICY "Anyone can view work paper templates" ON work_paper_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage work paper templates" ON work_paper_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' IN ('ceo', 'deputy_director', 'admin'))
    )
  );

-- Политики для work_papers (сложная логика доступа)
-- Пользователь может видеть документы проектов, где он в команде
CREATE POLICY "Users can view work papers from their projects" ON work_papers
  FOR SELECT USING (
    -- Проверяем, что пользователь в команде проекта
    -- Это упрощенная версия, в реальности нужно проверить через таблицу projects/team
    assigned_to = auth.uid() 
    OR reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' IN ('ceo', 'deputy_director', 'partner', 'manager_1', 'manager_2', 'manager_3'))
    )
  );

-- Пользователь может редактировать документы, где он назначен исполнителем
CREATE POLICY "Assigned users can update their work papers" ON work_papers
  FOR UPDATE USING (assigned_to = auth.uid() AND status IN ('not_started', 'in_progress', 'rejected'));

-- Ревьюер может обновлять статус и добавлять комментарии
CREATE POLICY "Reviewers can review work papers" ON work_papers
  FOR UPDATE USING (
    reviewer_id = auth.uid() 
    AND status = 'awaiting_review'
  );

-- Менеджеры и партнеры могут видеть все документы своих проектов
CREATE POLICY "Managers can view all work papers in their projects" ON work_papers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role' IN ('ceo', 'deputy_director', 'partner', 'manager_1', 'manager_2', 'manager_3'))
    )
  );

-- Функция для автоматического создания рабочих документов из шаблона
CREATE OR REPLACE FUNCTION create_work_papers_from_template(
  p_project_id UUID,
  p_methodology_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_work_paper_id UUID;
  v_count INTEGER := 0;
  v_team_member RECORD;
  v_assigned_user_id UUID;
BEGIN
  -- Проходим по всем шаблонам методологии
  FOR v_template IN 
    SELECT 
      wpt.*,
      ms.code as section_code
    FROM work_paper_templates wpt
    JOIN methodology_sections ms ON wpt.section_id = ms.id
    WHERE ms.methodology_id = p_methodology_id
    ORDER BY ms.order_index, wpt.order_index
  LOOP
    -- Определяем, кому назначить документ (упрощенная логика)
    -- В реальности нужно брать из команды проекта
    v_assigned_user_id := NULL;
    
    -- Создаем рабочий документ
    INSERT INTO work_papers (
      project_id,
      template_id,
      code,
      name,
      status,
      assigned_to,
      data
    ) VALUES (
      p_project_id,
      v_template.id,
      v_template.code,
      v_template.name,
      'not_started',
      v_assigned_user_id,
      '{}'::jsonb
    )
    ON CONFLICT (project_id, code) DO NOTHING
    RETURNING id INTO v_work_paper_id;
    
    IF v_work_paper_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Комментарии к таблицам
COMMENT ON TABLE methodologies IS 'Методологии аудита (KPMG, Russell Bedford, etc.)';
COMMENT ON TABLE methodology_sections IS 'Разделы методологии (A, B, J, K, etc.)';
COMMENT ON TABLE work_paper_templates IS 'Шаблоны рабочих документов';
COMMENT ON TABLE work_papers IS 'Рабочие документы в проектах';
COMMENT ON COLUMN work_paper_templates.structure_definition IS 'JSON структура документа для динамического рендеринга';
COMMENT ON COLUMN work_papers.data IS 'JSON данные, введенные пользователем в документ';
COMMENT ON COLUMN work_papers.review_history IS 'История ревью с комментариями и статусами';

