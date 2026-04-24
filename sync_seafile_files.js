// Скрипт синхронизации файлов из Seafile в notes.files всех проектов
// Запуск: node sync_seafile_files.js

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';
const SEAFILE_URL = 'https://cloud.rbpartners.kz';
const SEAFILE_TOKEN = '30e0b5fefd5e432797820f53858dbf1640225a51';
const REPO_ID = 'c650ff5f-d8f3-4b99-be85-065015662261';

async function main() {
  console.log('=== Синхронизация файлов Seafile → Supabase notes.files ===\n');

  // 1. Получаем все проекты
  console.log('Загружаю проекты из Supabase...');
  let allProjects = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=id,name,notes&order=created_at.desc&limit=1000&offset=${offset}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const batch = await res.json();
    if (!batch.length) break;
    allProjects.push(...batch);
    offset += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`Найдено ${allProjects.length} проектов\n`);

  // Парсим notes и строим маппинг: seafile_folder_name → { supabaseId, notes }
  const folderToProject = {};
  for (const p of allProjects) {
    let notes = p.notes;
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    notes = notes || {};

    // Папка в Seafile может быть notes.id (proj_XXX) или supabase UUID
    const notesId = notes.id || '';
    if (notesId && notesId !== p.id) {
      folderToProject[notesId] = { supabaseId: p.id, notes, name: p.name };
    }
    folderToProject[p.id] = { supabaseId: p.id, notes, name: p.name };
  }

  // 2. Получаем корневые папки из Seafile
  console.log('Получаю список папок из Seafile...');
  const dirRes = await fetch(`${SEAFILE_URL}/api2/repos/${REPO_ID}/dir/?p=/`, {
    headers: { 'Authorization': `Token ${SEAFILE_TOKEN}` }
  });
  if (!dirRes.ok) {
    console.error('Ошибка:', dirRes.status);
    return;
  }
  const rootEntries = await dirRes.json();
  const folders = rootEntries.filter(e => e.type === 'dir');
  console.log(`Найдено ${folders.length} папок в Seafile\n`);

  let synced = 0, skipped = 0, errors = 0, contractsFound = 0, notFound = 0;

  for (const folder of folders) {
    const match = folderToProject[folder.name];
    if (!match) {
      console.log(`⚠️  Папка "${folder.name}" — не найден проект в Supabase`);
      notFound++;
      continue;
    }

    const { supabaseId, notes, name: projectName } = match;
    const existingFiles = Array.isArray(notes.files) ? notes.files : [];

    if (existingFiles.length > 0) {
      skipped++;
      continue;
    }

    // Получаем файлы из Seafile
    try {
      const filesRes = await fetch(`${SEAFILE_URL}/api2/repos/${REPO_ID}/dir/?p=${encodeURIComponent('/' + folder.name)}`, {
        headers: { 'Authorization': `Token ${SEAFILE_TOKEN}` }
      });
      if (!filesRes.ok) { errors++; continue; }

      const entries = await filesRes.json();
      const files = entries.filter(e => e.type === 'file').map(e => ({
        id: `sf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fileName: e.name,
        name: e.name,
        fileType: e.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
        fileSize: e.size || 0,
        storagePath: `/${folder.name}/${e.name}`,
        category: e.name.toLowerCase().match(/договор|contract|dogovor/) ? 'contract' : 'document',
        uploadedBy: 'seafile_sync',
        uploadedAt: e.mtime ? new Date(e.mtime * 1000).toISOString() : new Date().toISOString(),
        isSeafile: true,
        publicUrl: `seafile:///${folder.name}/${e.name}`,
      }));

      if (files.length === 0) { skipped++; continue; }

      const hasContract = files.some(f => f.category === 'contract');
      if (hasContract) contractsFound++;

      // Обновляем notes.files
      const updatedNotes = { ...notes, files };
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${supabaseId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ notes: JSON.stringify(updatedNotes) }),
      });

      if (updateRes.ok) {
        synced++;
        console.log(`✅ ${(projectName || supabaseId).slice(0, 60)}: ${files.length} файлов${hasContract ? ' [ДОГОВОР]' : ''}`);
      } else {
        errors++;
        console.log(`❌ ${supabaseId}: ${updateRes.status}`);
      }

      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      errors++;
      console.error(`❌ ${folder.name}:`, e.message);
    }
  }

  console.log('\n=== ИТОГО ===');
  console.log(`Синхронизировано: ${synced}`);
  console.log(`Пропущено (уже есть файлы): ${skipped}`);
  console.log(`Папок без проекта: ${notFound}`);
  console.log(`Ошибок: ${errors}`);
  console.log(`Найдено договоров: ${contractsFound}`);
}

main().catch(console.error);
