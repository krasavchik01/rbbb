-- Создание таблицы для глобальных настроек приложения
-- Эта таблица будет содержать одну запись с настройками для всей системы

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Показывать ли демо-пользователей на странице входа
  show_demo_users BOOLEAN NOT NULL DEFAULT true,

  -- Настройки геолокации офиса
  office_location_enabled BOOLEAN NOT NULL DEFAULT false,
  office_latitude DECIMAL(10, 8) DEFAULT 43.238949, -- Алматы, Казахстан
  office_longitude DECIMAL(11, 8) DEFAULT 76.945465,
  office_radius_meters INTEGER DEFAULT 100,
  office_address TEXT DEFAULT '',

  -- Режим обслуживания
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT DEFAULT '',

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем единственную запись с настройками по умолчанию
INSERT INTO app_settings (
  show_demo_users,
  office_location_enabled,
  office_latitude,
  office_longitude,
  office_radius_meters,
  office_address,
  maintenance_mode,
  maintenance_message
) VALUES (
  true,  -- show_demo_users
  false, -- office_location_enabled
  43.238949, -- office_latitude (Алматы)
  76.945465, -- office_longitude
  100, -- office_radius_meters
  '', -- office_address
  false, -- maintenance_mode
  '' -- maintenance_message
)
ON CONFLICT DO NOTHING;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();

-- Включаем Row Level Security (RLS)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать настройки
CREATE POLICY "Allow public read access to app_settings"
  ON app_settings
  FOR SELECT
  TO public
  USING (true);

-- Политика: только аутентифицированные пользователи могут обновлять
-- (в будущем можно ограничить только админами)
CREATE POLICY "Allow authenticated users to update app_settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Комментарии
COMMENT ON TABLE app_settings IS 'Глобальные настройки приложения';
COMMENT ON COLUMN app_settings.show_demo_users IS 'Показывать демо-пользователей на странице входа';
COMMENT ON COLUMN app_settings.office_location_enabled IS 'Включена ли проверка геолокации для отметки прихода';
COMMENT ON COLUMN app_settings.office_latitude IS 'Широта офиса';
COMMENT ON COLUMN app_settings.office_longitude IS 'Долгота офиса';
COMMENT ON COLUMN app_settings.office_radius_meters IS 'Радиус от офиса в метрах для валидации';
COMMENT ON COLUMN app_settings.office_address IS 'Адрес офиса для отображения пользователям';
