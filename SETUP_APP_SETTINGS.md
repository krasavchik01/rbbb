# Настройка глобальных настроек приложения

## Проблема
Настройки офиса (адрес, координаты) сохраняются, но не применяются для всех пользователей.

## Решение

Настройки **уже глобальные** в коде, но нужно создать таблицу в Supabase.

### 1. Создайте таблицу `app_settings` в Supabase

Выполните этот SQL в Supabase SQL Editor:

```sql
-- Создаем таблицу глобальных настроек приложения
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_demo_users BOOLEAN DEFAULT true,
  office_location_enabled BOOLEAN DEFAULT false,
  office_latitude DOUBLE PRECISION DEFAULT 43.238949,
  office_longitude DOUBLE PRECISION DEFAULT 76.945465,
  office_radius_meters INTEGER DEFAULT 100,
  office_address TEXT DEFAULT '',
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставляем дефолтную запись (если её еще нет)
INSERT INTO public.app_settings (id, show_demo_users, office_location_enabled, office_latitude, office_longitude, office_radius_meters, office_address)
SELECT
  gen_random_uuid(),
  true,
  false,
  43.238949,
  76.945465,
  100,
  ''
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- Включаем RLS (Row Level Security)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать настройки
CREATE POLICY "Allow public read access to app_settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Политика: только админы могут изменять (ОТКЛЮЧЕНА для простоты - можно включить позже)
-- Сейчас все могут изменять через API (можно ограничить позже)
CREATE POLICY "Allow all update access to app_settings"
  ON public.app_settings
  FOR UPDATE
  USING (true);
```

### 2. Проверка работы

После создания таблицы:

1. Зайдите как **admin** в настройки
2. Заполните адрес офиса и координаты
3. Нажмите "Сохранить настройки офиса"
4. Выйдите и зайдите как другой пользователь (например CEO)
5. Проверьте настройки - адрес должен быть тот же

### 3. Как это работает

- Настройки сохраняются в **одну** запись в таблице `app_settings`
- Все пользователи читают настройки из этой **одной** записи
- При изменении настроек обновляется **эта же** запись
- Кеш автоматически инвалидируется через event `appSettingsChanged`

### 4. Если не работает

Проверьте в консоли браузера (F12) при сохранении:
- Должно быть: `Сохраняем настройки в Supabase, id: ...`
- Должно быть: `Результат обновления: ...`
- Не должно быть ошибок

Если ошибка "Не удалось получить настройки для обновления":
- Значит таблица `app_settings` пуста
- Выполните INSERT из SQL выше
