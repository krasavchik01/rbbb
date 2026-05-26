-- Заменяем глобальный boolean-флаг `recent_activity_enabled` массивом ролей,
-- которым админ хочет показывать блок «Последние активности» на дашборде.
-- Дефолт: ген. директор, заместитель и партнёр — как договорились.
-- Старая колонка recent_activity_enabled остаётся в БД для обратной совместимости,
-- но кодом больше не используется. При желании её можно удалить отдельной миграцией.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS recent_activity_visible_roles TEXT[]
    NOT NULL DEFAULT ARRAY['ceo', 'deputy_director', 'partner'];

COMMENT ON COLUMN app_settings.recent_activity_visible_roles IS
  'Список ролей (UserRole), которым показывается блок «Последние активности» на дашборде. Пустой массив = скрыт у всех.';
