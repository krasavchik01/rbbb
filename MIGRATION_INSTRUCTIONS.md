# Инструкция по выполнению миграции добавления ролей

## Проблема
В Supabase ENUM `app_role` отсутствуют роли для аудиторской компании:
- `supervisor_1`, `supervisor_2`, `supervisor_3`
- `tax_specialist_1`, `tax_specialist_2`
- `assistant_1`, `assistant_2`, `assistant_3`
- `contractor`, `hr`, `accountant`, `ceo`, `deputy_director`

## Решение

### Способ 1: Через Supabase Dashboard (РЕКОМЕНДУЕТСЯ)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите проект: **mknvqsnitzaurpwnhzwn**
3. Перейдите в **SQL Editor** (в левом меню)
4. Скопируйте и вставьте следующий SQL:

```sql
-- Добавляем недостающие роли для аудиторской компании в ENUM app_role
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'supervisor_3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'supervisor_3';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'supervisor_2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'supervisor_2';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'supervisor_1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'supervisor_1';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tax_specialist_1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'tax_specialist_1';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tax_specialist_2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'tax_specialist_2';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistant_3' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'assistant_3';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistant_2' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'assistant_2';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistant_1' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'assistant_1';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'contractor' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'contractor';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hr' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'hr';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accountant' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'accountant';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ceo' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'ceo';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deputy_director' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'deputy_director';
  END IF;
END $$;
```

5. Нажмите **RUN** (или F5)
6. Дождитесь успешного выполнения

### Способ 2: Через Node.js скрипт

1. Установите Node.js (если еще не установлен)
2. Получите Service Role Key из Supabase Dashboard:
   - Settings → API → service_role key
3. Выполните:
```bash
SUPABASE_SERVICE_ROLE_KEY=ваш_ключ node run-migration.js
```

## Проверка

После выполнения миграции импорт сотрудников должен работать без ошибок с ролями:
- Супервайзер 1/2/3
- Налоговый специалист 1/2
- Ассистент 1/2/3
- ГПХ (Подрядчик)
- HR специалист
- Бухгалтер
- CEO
- Заместитель директора

