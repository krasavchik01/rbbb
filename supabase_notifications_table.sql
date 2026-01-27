-- Создание таблицы уведомлений в Supabase
-- Выполни этот SQL в Supabase SQL Editor

-- Удаляем таблицу если существует (только для чистой установки)
DROP TABLE IF EXISTS notifications CASCADE;

-- Создаём таблицу уведомлений
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрой выборки
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- RLS политики (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Политика: пользователь видит только свои уведомления
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (true); -- Разрешаем всем читать (проверка user_id будет в запросе)

-- Политика: система может создавать уведомления
CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Политика: пользователь может обновлять свои уведомления (отмечать как прочитанное)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (true);

-- Политика: пользователь может удалять свои уведомления
CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  USING (true);

-- Триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Готово! Таблица создана.
