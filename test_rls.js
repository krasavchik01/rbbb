import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fixing project_files RLS...');

    // В Supabase REST API нет прямого способа выполнять произвольный SQL (без включенного RPC)
    // Поэтому мы создадим RPC функцию или просто проверим, что вставляем правильно.
    // Так как в policies было USING (true), закупки ДОЛЖНЫ видеть файлы.
    // Проблема скорее всего в UI компонентах. 
    // Мы проверим, есть ли файлы вообще.

    const { data, error } = await supabase.from('project_files').select('*').limit(5);
    console.log('Sample files:', data);
    console.log('Error:', error);
}

run();
