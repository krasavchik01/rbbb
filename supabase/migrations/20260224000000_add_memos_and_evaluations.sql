-- Migration to add service_memos and project_evaluations tables

-- Service Memos Table
CREATE TABLE IF NOT EXISTS service_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'other',
  overall_status TEXT DEFAULT 'in_progress',
  current_stage_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Service Memo Workflow Stages
CREATE TABLE IF NOT EXISTS service_memo_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID REFERENCES service_memos(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  department TEXT NOT NULL,
  department_label TEXT,
  status TEXT DEFAULT 'pending',
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Evaluations Table
CREATE TABLE IF NOT EXISTS project_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  evaluated_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE service_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_memo_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies for service_memos
CREATE POLICY "Anyone authenticated can view memos" ON service_memos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create their own memos" ON service_memos
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own memos or admins can update any" ON service_memos
  FOR UPDATE USING (
    auth.uid() = created_by OR 
    EXISTS (SELECT 1 FROM employees WHERE id = auth.uid() AND role = 'admin')
  );

-- Policies for service_memo_workflow
CREATE POLICY "Anyone authenticated can view workflow" ON service_memo_workflow
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Relevant users can update workflow stages" ON service_memo_workflow
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert workflow stages" ON service_memo_workflow
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for project_evaluations
CREATE POLICY "Users can view evaluations they are involved in or as management" ON project_evaluations
  FOR SELECT USING (
    evaluator_id = auth.uid() OR
    (NOT is_anonymous AND evaluated_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM employees WHERE id = auth.uid() AND role IN ('ceo', 'deputy_director', 'admin'))
  );

CREATE POLICY "Users can insert their own evaluations" ON project_evaluations
  FOR INSERT WITH CHECK (evaluator_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_memos_created_by ON service_memos(created_by);
CREATE INDEX IF NOT EXISTS idx_service_memo_workflow_memo_id ON service_memo_workflow(memo_id);
CREATE INDEX IF NOT EXISTS idx_project_evaluations_project_id ON project_evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_evaluations_evaluated_user ON project_evaluations(evaluated_user_id);
