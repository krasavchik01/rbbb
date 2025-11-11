-- Простая версия миграции - выполни каждую команду отдельно

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager_1';

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager_2';

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager_3';


