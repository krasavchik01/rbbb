/**
 * Скрипт для выполнения миграции добавления ролей в Supabase
 * 
 * Запуск: node run-migration.js
 * 
 * Требуется: SUPABASE_SERVICE_ROLE_KEY в переменных окружения
 * или введите ключ вручную при запросе
 */

const https = require('https');

const SUPABASE_URL = "https://mknvqsnitzaurpwnhzwn.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const SQL = `
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
`.trim();

function executeSQL() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    
    const postData = JSON.stringify({ sql: SQL });
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data });
        } else {
          reject({ statusCode: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Альтернативный способ через прямой SQL запрос
async function runMigration() {
  console.log('🚀 Запуск миграции добавления ролей в Supabase...\n');
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Ошибка: SUPABASE_SERVICE_ROLE_KEY не найден');
    console.log('\n📝 Инструкция:');
    console.log('1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Выберите проект: mknvqsnitzaurpwnhzwn');
    console.log('3. Перейдите в Settings → API');
    console.log('4. Скопируйте "service_role" ключ');
    console.log('5. Выполните: SUPABASE_SERVICE_ROLE_KEY=ваш_ключ node run-migration.js');
    console.log('\nИли выполните SQL напрямую в SQL Editor:');
    console.log('---');
    console.log(SQL);
    console.log('---');
    process.exit(1);
  }
  
  try {
    await executeSQL();
    console.log('✅ Миграция успешно выполнена!');
    console.log('✅ Все роли добавлены в ENUM app_role');
  } catch (error) {
    console.error('❌ Ошибка выполнения миграции:', error);
    console.log('\n📝 Альтернативный способ:');
    console.log('1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Перейдите в SQL Editor');
    console.log('3. Скопируйте и выполните SQL:');
    console.log('---');
    console.log(SQL);
    console.log('---');
  }
}

runMigration();

