-- Добавление реальных сотрудников в БД

-- Сначала очищаем таблицу от тестовых данных (опционально)
-- DELETE FROM public.employees WHERE id LIKE 'emp_%';

-- Вставляем реальных сотрудников
INSERT INTO public.employees (id, name, email, role, level, whatsapp) VALUES
-- Партнеры
('partner_1', 'Рахметбек Бердимуратов', 'rakhmetbek@rbpartners.kz', 'partner', '3', '+77071234567'),
('partner_2', 'Айжан Сатпаева', 'aizhan@rbpartners.kz', 'partner', '3', '+77071234568'),

-- Руководители проектов
('pm_1', 'Асель Нурбекова', 'asel@rbpartners.kz', 'project_manager', '2', '+77071234569'),
('pm_2', 'Данияр Токаев', 'daniyar@rbpartners.kz', 'project_manager', '2', '+77071234570'),

-- Специалисты по налогам
('tax_1', 'Гульнара Абдиева', 'gulnara@rbpartners.kz', 'tax_specialist', '2', '+77071234571'),
('tax_2', 'Ерлан Мухамедов', 'erlan@rbpartners.kz', 'tax_specialist', '2', '+77071234572'),
('tax_3', 'Жанна Кадырова', 'zhanna@rbpartners.kz', 'tax_specialist', '1', '+77071234573'),

-- IT аудиторы
('it_1', 'Алмат Кенжебеков', 'almat@rbpartners.kz', 'it_auditor', '2', '+77071234574'),
('it_2', 'Диана Тулегенова', 'diana@rbpartners.kz', 'it_auditor', '1', '+77071234575'),

-- Ассистенты
('asst_1', 'Айгерим Садыкова', 'aigerim@rbpartners.kz', 'assistant', '1', '+77071234576'),
('asst_2', 'Нуржан Байтурсынов', 'nurzhan@rbpartners.kz', 'assistant', '1', '+77071234577'),

-- Дизайнеры
('design_1', 'Мадина Ералиева', 'madina@rbpartners.kz', 'designer', '2', '+77071234578'),

-- Администраторы
('admin_1', 'Администратор Системы', 'admin@rbpartners.kz', 'admin', '3', '+77071234579'),

-- Менеджеры
('mgr_1', 'Сауле Исламова', 'saule@rbpartners.kz', 'manager', '2', '+77071234580'),

-- Отдел закупок
('procurement_1', 'Алия Жумабекова', 'procurement@rbpartners.kz', 'employee', '2', '+77071234581'),

-- Заместитель директора
('deputy_1', 'Бакытжан Омаров', 'deputy@rbpartners.kz', 'manager', '3', '+77071234582'),

-- Генеральный директор
('ceo_1', 'Нурлан Рахметов', 'ceo@rbpartners.kz', 'admin', '3', '+77071234583')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  level = EXCLUDED.level,
  whatsapp = EXCLUDED.whatsapp,
  updated_at = now();

-- Комментарий
COMMENT ON TABLE public.employees IS 'Обновлено реальными сотрудниками RB Partners';

