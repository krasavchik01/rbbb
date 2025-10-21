-- Очистка ВСЕХ существующих сотрудников
DELETE FROM public.employees;

-- Добавление ТОЛЬКО реальных сотрудников (5 основных)
INSERT INTO public.employees (id, name, email, role, level, whatsapp) VALUES
-- CEO
('ceo_1', 'Нурлан Рахметов', 'ceo@rbpartners.kz', 'admin', '3', '+77011234567'),

-- Заместитель директора
('deputy_1', 'Бакытжан Омаров', 'deputy@rbpartners.kz', 'manager', '3', '+77011234568'),

-- Отдел закупок
('procurement_1', 'Алия Жумабекова', 'procurement@rbpartners.kz', 'employee', '2', '+77011234569'),

-- Партнер
('partner_1', 'Рахметбек Бердимуратов', 'partner@rbpartners.kz', 'partner', '3', '+77011234570'),

-- Руководитель проекта
('pm_1', 'Асель Нурбекова', 'pm@rbpartners.kz', 'project_manager', '2', '+77011234571')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  level = EXCLUDED.level,
  whatsapp = EXCLUDED.whatsapp,
  updated_at = now();

-- Комментарий
COMMENT ON TABLE public.employees IS 'Только реальные сотрудники (5 основных)';

