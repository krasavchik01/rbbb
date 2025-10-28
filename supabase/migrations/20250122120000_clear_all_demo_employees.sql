-- Удаление ВСЕХ демо-сотрудников из базы данных
-- Только реальные данные!

-- Удаляем всех сотрудников с русскими демо-именами
DELETE FROM public.employees 
WHERE 
  name LIKE '%Иванов%' 
  OR name LIKE '%Петров%' 
  OR name LIKE '%Сидоров%'
  OR name LIKE '%Козлов%'
  OR name LIKE '%Морозов%'
  OR name LIKE '%Анна%'
  OR name LIKE '%Михаил%'
  OR name LIKE '%Елена%'
  OR name LIKE '%Дмитрий%'
  OR name LIKE '%Ольга%'
  OR name LIKE '%Мария%'
  OR name LIKE '%Петр%'
  OR name LIKE '%Алексей%'
  OR id IN (
    -- Удаляем по конкретным ID если они известны
    'emp_demo_1',
    'emp_demo_2',
    'emp_demo_3',
    'emp_demo_4',
    'emp_demo_5'
  );

-- Оставляем комментарий в истории
COMMENT ON TABLE public.employees IS 'Все демо-данные удалены 2025-01-22. Только реальные сотрудники.';




