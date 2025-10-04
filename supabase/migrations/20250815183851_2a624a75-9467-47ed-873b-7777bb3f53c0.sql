-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  brand_color TEXT DEFAULT '#3B82F6',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignees UUID[] DEFAULT '{}',
  reporter UUID REFERENCES public.employees(id),
  priority TEXT DEFAULT 'med' CHECK (priority IN ('low', 'med', 'high', 'critical')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked')),
  due_at TIMESTAMP WITH TIME ZONE,
  estimate_h INTEGER DEFAULT 0,
  spent_h INTEGER DEFAULT 0,
  labels TEXT[] DEFAULT '{}',
  checklist JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  comments JSONB DEFAULT '[]',
  parent_task_id UUID REFERENCES public.tasks(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create project_team table  
CREATE TABLE IF NOT EXISTS public.project_team (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_on_project TEXT NOT NULL DEFAULT 'Other' CHECK (role_on_project IN ('PM', 'Supervisor', 'Assistant', 'Auditor', 'IT', 'Legal', 'Tax', 'Designer', 'Other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations for authenticated users" ON public.companies FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON public.tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON public.project_team FOR ALL TO authenticated USING (true);

-- Insert default companies
INSERT INTO public.companies (name, brand_color) VALUES 
('RB Partners IT Audit', '#3B82F6'),
('Russell Bedford A+ Partners', '#10B981'),
('Parker Russell', '#8B5CF6'),
('Fin Consulting', '#F59E0B'),
('Andersonkz', '#EF4444')
ON CONFLICT (name) DO NOTHING;