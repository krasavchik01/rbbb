# Настройка управления компаниями

## SQL миграция для Supabase

Запустите этот SQL код в Supabase SQL Editor:

```sql
-- Создаём таблицу компаний в app_settings (JSONB)
-- Если app_settings ещё нет, создайте её через SETUP_APP_SETTINGS.md

-- Добавляем колонку companies в app_settings
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS companies JSONB DEFAULT '[]'::jsonb;

-- Заполняем начальными данными (если таблица пустая или companies пустой)
UPDATE public.app_settings
SET companies = '[
  {
    "id": "mak",
    "name": "ТОО МАК",
    "fullName": "Товарищество с ограниченной ответственностью \"МАК\"",
    "inn": "000000000000",
    "isActive": true
  },
  {
    "id": "aplus",
    "name": "A+Partners",
    "fullName": "A+Partners Group",
    "inn": "000000000001",
    "isActive": true
  },
  {
    "id": "rb-academy",
    "name": "RB Academy",
    "fullName": "RB Academy",
    "inn": "000000000002",
    "parentCompanyId": "aplus",
    "isActive": true
  },
  {
    "id": "rb-partners",
    "name": "RB Partners",
    "fullName": "RB Partners",
    "inn": "000000000003",
    "parentCompanyId": "aplus",
    "isActive": true
  },
  {
    "id": "it-audit",
    "name": "IT Audit",
    "fullName": "IT Audit",
    "inn": "000000000004",
    "parentCompanyId": "aplus",
    "isActive": true
  },
  {
    "id": "parkerrussell",
    "name": "PARKERRUSSELL",
    "fullName": "PARKERRUSSELL",
    "inn": "000000000005",
    "isActive": true
  },
  {
    "id": "andersonkz",
    "name": "Andersonkz",
    "fullName": "Andersonkz",
    "inn": "000000000006",
    "isActive": true
  }
]'::jsonb
WHERE companies IS NULL OR companies = '[]'::jsonb;

COMMENT ON COLUMN public.app_settings.companies IS 'Список компаний группы';
```

## Альтернативный вариант: Отдельная таблица

Если хотите хранить компании в отдельной таблице (более гибкий вариант):

```sql
-- Создаём таблицу companies
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  inn TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  director_id UUID REFERENCES public.employees(id),
  director_name TEXT,
  parent_company_id TEXT REFERENCES public.companies(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS политики
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Все могут читать компании" ON public.companies
  FOR SELECT USING (true);

CREATE POLICY "Только admin, hr, procurement могут добавлять компании" ON public.companies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'procurement', 'ceo')
    )
  );

CREATE POLICY "Только admin, hr, procurement могут обновлять компании" ON public.companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'procurement', 'ceo')
    )
  );

CREATE POLICY "Только admin может удалять компании" ON public.companies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = auth.uid()
      AND role IN ('admin', 'ceo')
    )
  );

-- Индексы
CREATE INDEX IF NOT EXISTS idx_companies_parent ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(is_active);

-- Начальные данные
INSERT INTO public.companies (id, name, full_name, inn, is_active) VALUES
  ('mak', 'ТОО МАК', 'Товарищество с ограниченной ответственностью "МАК"', '000000000000', true),
  ('aplus', 'A+Partners', 'A+Partners Group', '000000000001', true),
  ('rb-academy', 'RB Academy', 'RB Academy', '000000000002', true),
  ('rb-partners', 'RB Partners', 'RB Partners', '000000000003', true),
  ('it-audit', 'IT Audit', 'IT Audit', '000000000004', true),
  ('parkerrussell', 'PARKERRUSSELL', 'PARKERRUSSELL', '000000000005', true),
  ('andersonkz', 'Andersonkz', 'Andersonkz', '000000000006', true)
ON CONFLICT (id) DO NOTHING;

-- Устанавливаем родительские компании
UPDATE public.companies SET parent_company_id = 'aplus' WHERE id IN ('rb-academy', 'rb-partners', 'it-audit');
```

## Выбор подхода

- **JSONB в app_settings**: Проще, меньше таблиц, быстрее для чтения
- **Отдельная таблица**: Более гибко, лучше для сложных связей, проще делать запросы

Рекомендую использовать **отдельную таблицу** для будущего расширения функционала.
