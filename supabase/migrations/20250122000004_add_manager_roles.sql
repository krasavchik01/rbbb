-- Добавление новых ролей менеджеров в ENUM app_role
-- Выполнить в Supabase Dashboard -> SQL Editor

DO $$ 
BEGIN
  -- Добавляем manager_1, manager_2, manager_3 если их еще нет
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager_1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager_1';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager_2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager_2';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager_3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager_3';
  END IF;
END $$;

-- Комментарий: После выполнения этой миграции новые роли manager_1, manager_2, manager_3 будут доступны в системе

