-- Добавляем колонку password в employees для хранения паролей
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password text;
