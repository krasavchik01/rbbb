-- Добавляем настройку видимости блока «Последние активности» на дашборде.
-- Сам блок показывается только директорам и партнёрам (логика в коде),
-- этот флаг позволяет админу полностью скрыть его даже для них.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS recent_activity_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN app_settings.recent_activity_enabled IS
  'Показывать ли блок «Последние активности» на главной (включает/выключает для всех ролей, у которых он вообще доступен)';
