-- Таблица для хранения доступа пользователей к компаниям
-- Заменяет localStorage хранилище на серверное

CREATE TABLE IF NOT EXISTS user_company_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  company_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;

-- Все аутентифицированные пользователи могут читать (нужно для фильтрации проектов)
CREATE POLICY "Anyone can read user_company_access"
  ON user_company_access FOR SELECT
  USING (true);

-- Все аутентифицированные пользователи могут изменять (админ/CEO настраивают доступ)
CREATE POLICY "Anyone can insert user_company_access"
  ON user_company_access FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update user_company_access"
  ON user_company_access FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete user_company_access"
  ON user_company_access FOR DELETE
  USING (true);

-- Триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_user_company_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_company_access_updated_at
  BEFORE UPDATE ON user_company_access
  FOR EACH ROW
  EXECUTE FUNCTION update_user_company_access_updated_at();
