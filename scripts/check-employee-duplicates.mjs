#!/usr/bin/env node
/**
 * Анализ дубликатов в employees и в результатах timesheets-to-projects.
 *
 * Цель: понять, нет ли в БД одного и того же человека под двумя ID
 * (например «Бадамбаева Сауле» и «Сауле Бадамбаева»), и не приведёт ли
 * шаг D к тому, что один и тот же человек добавится в team[] дважды.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const norm = (s) => String(s || '').toLowerCase().replace(/[«»""''\-_().,:;]/g, ' ').replace(/\s+/g, ' ').trim();
const kzNorm = (s) => String(s || '').toLowerCase()
  .replace(/ә/g, 'а').replace(/ғ/g, 'г').replace(/қ/g, 'к').replace(/ң/g, 'н')
  .replace(/ө/g, 'о').replace(/ұ/g, 'у').replace(/ү/g, 'у').replace(/һ/g, 'х').replace(/і/g, 'и');
const cyrToLat = (s) => {
  const map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z',
    и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s',
    т:'t', у:'u', ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y',
    ь:'', э:'e', ю:'yu', я:'ya' };
  return kzNorm(s).split('').map((c) => map[c] != null ? map[c] : c).join('');
};

// Базовый ключ для дедупа: kz-normalized + sorted tokens (≥3 символа).
// Так "Бадамбаева Сауле" и "Сауле Бадамбаева" будут одинаково.
function dedupeKey(name) {
  const cyr = kzNorm(norm(name));
  const lat = cyrToLat(cyr);
  // Для каждого варианта: токены ≥3 символов, отсортированные.
  const tokensOf = (s) => s.split(' ').filter((t) => t.length >= 3).sort().join('|');
  return { cyr: tokensOf(cyr), lat: tokensOf(lat) };
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: employees, error } = await sb.from('employees').select('id,name,role,level,email');
  if (error) throw error;

  console.log(`Loaded ${employees.length} employees.\n`);

  // Группировка по dedupeKey.cyr
  const byCyr = new Map();
  const byLat = new Map();
  for (const e of employees) {
    const k = dedupeKey(e.name);
    if (k.cyr) {
      const arr = byCyr.get(k.cyr) || [];
      arr.push(e); byCyr.set(k.cyr, arr);
    }
    if (k.lat) {
      const arr = byLat.get(k.lat) || [];
      arr.push(e); byLat.set(k.lat, arr);
    }
  }

  console.log('=== Точные дубликаты по cyrillic-token-set ===');
  let foundCyr = 0;
  for (const [k, arr] of byCyr) {
    if (arr.length > 1) {
      foundCyr++;
      console.log(`  [${k}]:`);
      arr.forEach((e) => console.log(`    ${e.id}  ${e.name.padEnd(40)}  role=${e.role || '-'}  email=${e.email || '-'}`));
    }
  }
  if (foundCyr === 0) console.log('  (none)');

  console.log('\n=== «Латиница vs кириллица» (один человек двумя написаниями) ===');
  let foundCross = 0;
  // Маппим каждого emp на kzNorm-cyr→lat и сравниваем — если найдено два emp с одинаковым `lat` ключом, но один cyr-only а другой — латиница, считаем кандидатом.
  const seen = new Set();
  for (const [latKey, arr] of byLat) {
    if (arr.length > 1) {
      // Если они уже совпали по cyrKey — это просто точные дубликаты, не cross-script.
      const cyrKeys = new Set(arr.map((e) => dedupeKey(e.name).cyr));
      if (cyrKeys.size === 1) continue;  // одинаковые и так
      if (seen.has(latKey)) continue;
      seen.add(latKey);
      foundCross++;
      console.log(`  [lat=${latKey}]:`);
      arr.forEach((e) => console.log(`    ${e.id}  ${e.name.padEnd(40)}  role=${e.role || '-'}  email=${e.email || '-'}`));
    }
  }
  if (foundCross === 0) console.log('  (none)');

  // Подозрительные пары: имя начинается одинаково (фамилия совпадает) но
  // полное имя отличается. Это часто отчество длиннее/короче.
  console.log('\n=== Подозрительные: одинаковая фамилия (первые ≥6 букв) ===');
  const bySurname = new Map();
  for (const e of employees) {
    const cyr = kzNorm(norm(e.name));
    const firstToken = cyr.split(' ').filter((t) => t.length >= 6)[0];
    if (!firstToken) continue;
    const arr = bySurname.get(firstToken) || [];
    arr.push(e); bySurname.set(firstToken, arr);
  }
  let foundSur = 0;
  for (const [k, arr] of bySurname) {
    if (arr.length > 1) {
      // только если разные ID
      const ids = new Set(arr.map((e) => e.id));
      if (ids.size <= 1) continue;
      foundSur++;
      console.log(`  [${k}*]:`);
      arr.forEach((e) => console.log(`    ${e.id}  ${e.name.padEnd(40)}  role=${e.role || '-'}  status=${e.status || '-'}`));
    }
  }
  if (foundSur === 0) console.log('  (none)');

  // Из dry-run report — какие сотрудники добавляются (D)
  const reportPath = path.resolve('tmp/timesheets-to-projects.json');
  if (fs.existsSync(reportPath)) {
    const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const addedIds = new Set();
    for (const u of (r.D?.updates || [])) {
      for (const m of u.addedMembers) addedIds.add(m.userId);
    }
    console.log(`\n=== Сотрудники, добавляемые в team[] на шаге D: ${addedIds.size} уникальных ===`);
    // Из них — у скольких есть role в employees?
    let withRole = 0, withoutRole = 0;
    const fallbackToAssistant1 = [];
    for (const id of addedIds) {
      const e = employees.find((x) => x.id === id);
      if (!e) continue;
      if (e.role) withRole++;
      else { withoutRole++; fallbackToAssistant1.push(e.name); }
    }
    console.log(`  с role в employees: ${withRole}`);
    console.log(`  БЕЗ role (получат fallback 'assistant_1'): ${withoutRole}`);
    if (fallbackToAssistant1.length) {
      console.log('\n  Список сотрудников БЕЗ role:');
      fallbackToAssistant1.slice(0, 50).forEach((n) => console.log(`    - ${n}`));
      if (fallbackToAssistant1.length > 50) console.log(`    … +${fallbackToAssistant1.length - 50} more`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
