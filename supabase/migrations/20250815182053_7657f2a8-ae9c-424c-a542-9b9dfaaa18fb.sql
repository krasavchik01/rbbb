-- Создание enum типов
CREATE TYPE public.project_status AS ENUM (
  'draft', 'pre_approval', 'partner_assigned', 'pm_assigned', 
  'team_assembled', 'in_progress', 'qa_review', 'client_signoff', 
  'closed', 'archived'
);

CREATE TYPE public.employee_status AS ENUM ('active', 'probation', 'terminated');
CREATE TYPE public.employee_role AS ENUM (
  'IT', 'Аудиторы', 'Налоговики', 'Оценщики', 'Академия', 
  'Закупки', 'Юридический отдел', 'HR', 'Руководство'
);
CREATE TYPE public.app_role AS ENUM (
  'leadership', 'deputy_director', 'partner', 'pm', 
  'procurement', 'hr', 'employee'
);
CREATE TYPE public.task_status AS ENUM (
  'backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'
);
CREATE TYPE public.priority_level AS ENUM ('low', 'med', 'high', 'critical');
CREATE TYPE public.risk_level AS ENUM ('low', 'med', 'high');
CREATE TYPE public.project_team_role AS ENUM (
  'PM', 'Supervisor', 'Assistant', 'Auditor', 'IT', 
  'Legal', 'Tax', 'Designer', 'Other'
);
CREATE TYPE public.risk_status AS ENUM ('open', 'mitigating', 'closed');

-- Таблица компаний
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand_color TEXT NOT NULL DEFAULT '#3B82F6',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Обновляем таблицу сотрудников
ALTER TABLE public.employees DROP COLUMN IF EXISTS role;
ALTER TABLE public.employees DROP COLUMN IF EXISTS level;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS roles employee_role[] DEFAULT '{}';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status employee_status DEFAULT 'active';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS app_role app_role DEFAULT 'employee';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Обновляем таблицу проектов
DROP TABLE IF EXISTS public.projects CASCADE;
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  status project_status NOT NULL DEFAULT 'draft',
  partner_id UUID REFERENCES public.employees(id),
  pm_id UUID REFERENCES public.employees(id),
  start_date DATE,
  due_date DATE,
  risk_level risk_level DEFAULT 'low',
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Команда проекта
CREATE TABLE public.project_team (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_on_project project_team_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, employee_id)
);

-- Таблица задач
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignees UUID[] DEFAULT '{}',
  reporter UUID REFERENCES public.employees(id),
  priority priority_level DEFAULT 'med',
  status task_status DEFAULT 'backlog',
  due_at TIMESTAMP WITH TIME ZONE,
  estimate_h NUMERIC(5,2),
  spent_h NUMERIC(5,2) DEFAULT 0,
  labels TEXT[] DEFAULT '{}',
  checklist JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  comments JSONB DEFAULT '[]',
  parent_task_id UUID REFERENCES public.tasks(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Риски проекта
CREATE TABLE public.issue_risks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity priority_level DEFAULT 'med',
  owner UUID REFERENCES public.employees(id),
  status risk_status DEFAULT 'open',
  due_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Лог активности
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.employees(id),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Политики RLS (временно разрешаем все для аутентифицированных пользователей)
CREATE POLICY "Allow all for authenticated users" ON public.companies FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.project_team FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.issue_risks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.activity_log FOR ALL TO authenticated USING (true);

-- Триггеры обновления timestamp
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_issue_risks_updated_at
  BEFORE UPDATE ON public.issue_risks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Вставляем демоданные компаний
INSERT INTO public.companies (name, brand_color, active) VALUES
  ('RB Partners IT Audit', '#3B82F6', true),
  ('Russell Bedford A+ Partners', '#10B981', true),
  ('Parker Russell', '#F59E0B', true),
  ('Fin Consulting', '#EF4444', true),
  ('Andersonkz', '#8B5CF6', true);

-- Вставляем демоданные сотрудников
INSERT INTO public.employees (name, full_name, company_id, roles, grade, email, phone, location, status, hire_date, app_role) 
SELECT 
  emp.name,
  emp.name as full_name,
  c.id,
  ARRAY[
    CASE 
      WHEN random() < 0.3 THEN 'Руководство'::employee_role
      WHEN random() < 0.2 THEN 'IT'::employee_role
      WHEN random() < 0.2 THEN 'Аудиторы'::employee_role
      WHEN random() < 0.15 THEN 'Налоговики'::employee_role
      WHEN random() < 0.1 THEN 'HR'::employee_role
      ELSE 'Оценщики'::employee_role
    END
  ],
  CASE 
    WHEN random() < 0.1 THEN 'Senior'
    WHEN random() < 0.3 THEN 'Middle'
    ELSE 'Junior'
  END,
  LOWER(REPLACE(emp.name, ' ', '.')) || '@' || REPLACE(LOWER(c.name), ' ', '') || '.com',
  '+7' || LPAD((random() * 9000000000)::bigint::text, 10, '0'),
  CASE 
    WHEN random() < 0.4 THEN 'Москва'
    WHEN random() < 0.3 THEN 'СПб'
    WHEN random() < 0.2 THEN 'Казань'
    ELSE 'Удаленно'
  END,
  'active'::employee_status,
  CURRENT_DATE - (random() * 1000)::int,
  CASE 
    WHEN random() < 0.1 THEN 'leadership'::app_role
    WHEN random() < 0.05 THEN 'deputy_director'::app_role
    WHEN random() < 0.15 THEN 'partner'::app_role
    WHEN random() < 0.2 THEN 'pm'::app_role
    WHEN random() < 0.1 THEN 'procurement'::app_role
    WHEN random() < 0.1 THEN 'hr'::app_role
    ELSE 'employee'::app_role
  END
FROM (
  VALUES 
    ('Анна Иванова'), ('Михаил Петров'), ('Елена Сидорова'), ('Дмитрий Козлов'),
    ('Ольга Морозова'), ('Сергей Волков'), ('Мария Козлова'), ('Александр Новиков'),
    ('Татьяна Федорова'), ('Игорь Смирнов'), ('Наталья Попова'), ('Владимир Лебедев'),
    ('Светлана Соколова'), ('Андрей Орлов'), ('Юлия Васильева'), ('Роман Николаев'),
    ('Екатерина Павлова'), ('Максим Григорьев'), ('Ирина Степанова'), ('Алексей Романов')
) AS emp(name)
CROSS JOIN public.companies c
WHERE random() < 0.8; -- Не все сотрудники во всех компаниях

-- Создаем демо проекты
INSERT INTO public.projects (code, name, company_id, status, description, risk_level, start_date, due_date, partner_id, pm_id)
SELECT 
  'PRJ-' || LPAD((ROW_NUMBER() OVER())::text, 3, '0'),
  proj.name,
  c.id,
  (ARRAY['draft', 'pre_approval', 'partner_assigned', 'pm_assigned', 'team_assembled', 'in_progress', 'qa_review'])[FLOOR(random() * 7 + 1)]::project_status,
  proj.description,
  (ARRAY['low', 'med', 'high'])[FLOOR(random() * 3 + 1)]::risk_level,
  CURRENT_DATE + (random() * 30 - 15)::int,
  CURRENT_DATE + (random() * 90 + 30)::int,
  (SELECT id FROM public.employees e WHERE e.company_id = c.id AND e.app_role IN ('partner', 'leadership') ORDER BY random() LIMIT 1),
  (SELECT id FROM public.employees e WHERE e.company_id = c.id AND e.app_role = 'pm' ORDER BY random() LIMIT 1)
FROM (
  VALUES 
    ('Аудит ИТ-инфраструктуры', 'Комплексный аудит информационных систем компании'),
    ('Внедрение ERP системы', 'Проект по внедрению корпоративной ERP системы'),
    ('Налоговая оптимизация', 'Анализ и оптимизация налоговой нагрузки'),
    ('Оценка стоимости бизнеса', 'Независимая оценка рыночной стоимости компании'),
    ('Автоматизация учета', 'Цифровизация процессов финансового учета'),
    ('Консалтинг по МСФО', 'Консультации по переходу на международные стандарты'),
    ('ИТ-безопасность', 'Аудит и повышение уровня информационной безопасности')
) AS proj(name, description)
CROSS JOIN public.companies c
WHERE random() < 0.6;

-- Создаем команды проектов
INSERT INTO public.project_team (project_id, employee_id, role_on_project)
SELECT 
  p.id,
  e.id,
  (ARRAY['Supervisor', 'Assistant', 'Auditor', 'IT', 'Legal'])[FLOOR(random() * 5 + 1)]::project_team_role
FROM public.projects p
CROSS JOIN LATERAL (
  SELECT id FROM public.employees e 
  WHERE e.company_id = p.company_id 
  AND e.app_role IN ('employee', 'pm')
  ORDER BY random() 
  LIMIT 3
) e
WHERE random() < 0.8;

-- Создаем демо задачи
INSERT INTO public.tasks (project_id, title, description, assignees, reporter, priority, status, due_at, estimate_h)
SELECT 
  p.id,
  task.title,
  task.description,
  ARRAY[e.id],
  p.pm_id,
  (ARRAY['low', 'med', 'high'])[FLOOR(random() * 3 + 1)]::priority_level,
  (ARRAY['backlog', 'todo', 'in_progress', 'in_review', 'done'])[FLOOR(random() * 5 + 1)]::task_status,
  CURRENT_DATE + (random() * 30)::int,
  (random() * 40 + 4)::numeric(5,2)
FROM public.projects p
CROSS JOIN (
  VALUES 
    ('Бриф клиента', 'Сбор и анализ требований клиента'),
    ('План проекта', 'Разработка детального плана выполнения проекта'),
    ('Матрица рисков', 'Идентификация и анализ проектных рисков'),
    ('Анализ текущего состояния', 'Оценка существующих процессов и систем'),
    ('Разработка рекомендаций', 'Формирование предложений по улучшению'),
    ('Тестирование решений', 'Проверка работоспособности предложенных решений'),
    ('Подготовка отчета', 'Оформление итогового отчета по проекту'),
    ('Презентация результатов', 'Представление результатов работы клиенту')
) AS task(title, description)
CROSS JOIN LATERAL (
  SELECT id FROM public.employees e 
  WHERE e.company_id = p.company_id 
  ORDER BY random() 
  LIMIT 1
) e
WHERE random() < 0.7;