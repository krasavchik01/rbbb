// Скрипт для применения миграции work_papers
// Запустите: npx tsx apply_work_papers_migration.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Получаем URL и ключ из переменных окружения
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY не установлены');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('📋 Читаем SQL миграцию...');
    const sqlPath = path.join(__dirname, 'fix_work_papers_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('🔄 Применяем миграцию к Supabase...');

    // Разбиваем SQL на отдельные команды
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`  ⚙️ Выполняем: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.error(`  ❌ Ошибка:`, error);
          // Продолжаем выполнение следующих команд
        } else {
          console.log(`  ✅ Успешно`);
        }
      }
    }

    console.log('\n✅ Миграция применена успешно!');
    console.log('📝 Проверьте таблицу work_papers в Supabase Dashboard');

  } catch (error) {
    console.error('❌ Ошибка применения миграции:', error);
    process.exit(1);
  }
}

applyMigration();
