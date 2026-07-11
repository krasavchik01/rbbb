#!/usr/bin/env node
/**
 * Авто-назначение партнёров проектам по партнёру из таймщитов.
 *
 * Идея: для каждого проекта БЕЗ партнёра в notes.team[] смотрим, какие
 * partner_raw указаны у его таймщит-строк. Если по проекту все строки (или
 * подавляющее большинство) указывают на одного и того же сотрудника с
 * role='partner' — проставляем его автоматически. Конфликты и неуверенные
 * случаи кладём в отчёт, чтобы зам.дир добил вручную в /assign-partners.
 *
 * Маппинг partner_raw → employee делаем токен-сетом нормализованных строк
 * (KZ-буквы, разный порядок имён, без отчества). Использует ту же логику,
 * что в scripts/check-employee-duplicates.mjs.
 *
 * Использование:
 *   node scripts/auto-assign-partners-from-timesheets.mjs           # dry-run
 *   node scripts/auto-assign-partners-from-timesheets.mjs --commit  # реально
 *
 * Маркер для отката (в notes.team[].assignedBy):
 *   'auto:timesheet-match-2026-05-29'
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const ASSIGNED_BY = 'auto:timesheet-match-2026-05-29';
const COMMIT = process.argv.includes('--commit');
// Порог уверенности: ≥80% строк должны указывать на одного и того же.
const CONFIDENCE = 0.8;

// ── normalization (как в check-employee-duplicates.mjs) ────────────────────
const kzNorm = (s) => String(s || '').toLowerCase()
  .replace(/ә/g, 'а').replace(/ғ/g, 'г').replace(/қ/g, 'к').replace(/ң/g, 'н')
  .replace(/ө/g, 'о').replace(/ұ/g, 'у').replace(/ү/g, 'у').replace(/һ/g, 'х').replace(/і/g, 'и');
const clean = (s) => kzNorm(String(s || '').toLowerCase()
  .replace(/[«»""''\-_().,:;]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

// Токены ≥3 символов, отсортированные → ключ для матча.
// "Бадамбаева Сауле" и "Сауле Бадамбаева" дают один ключ.
function tokenSet(name) {
  return clean(name)
    .split(' ')
    .filter((t) => t.length >= 3)
    .sort()
    .join('|');
}

// Нечёткий поиск: если есть точный матч по токен-сету — берём его.
// Если нет — ищем «subset»: токены partner_raw ⊆ токены employee.
// Это решает кейс «Адилжан Кенжекулов» ⊆ «Кенжекулов Адилжан Абдикалыкович».
function matchEmployee(rawName, partnerEmps) {
  const rawKey = tokenSet(rawName);
  if (!rawKey) return null;

  // Точный матч по токен-сету.
  const exact = partnerEmps.find((e) => e._key === rawKey);
  if (exact) return { emp: exact, kind: 'exact' };

  // Subset: токены partner_raw ⊆ токены employee.
  const rawTokens = rawKey.split('|');
  const subsetMatches = partnerEmps.filter((e) =>
    rawTokens.every((t) => e._tokens.includes(t)),
  );
  if (subsetMatches.length === 1) return { emp: subsetMatches[0], kind: 'subset' };
  if (subsetMatches.length > 1) return { emp: null, kind: 'ambiguous', candidates: subsetMatches };

  return null;
}

// ── main ───────────────────────────────────────────────────────────────────

function getTeam(notesRaw) {
  try {
    const parsed = typeof notesRaw === 'string' ? JSON.parse(notesRaw) : notesRaw;
    return Array.isArray(parsed?.team) ? parsed.team : [];
  } catch {
    return [];
  }
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Сотрудники с ролью partner.
  const { data: emps, error: empErr } = await sb
    .from('employees')
    .select('id,name,role')
    .eq('role', 'partner');
  if (empErr) throw empErr;

  // Готовим индекс по токен-сету.
  const partnerEmps = emps.map((e) => {
    const key = tokenSet(e.name);
    return { ...e, _key: key, _tokens: key.split('|') };
  });
  console.log(`Партнёров в системе: ${partnerEmps.length}`);

  // 2. Все проекты.
  const projs = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await sb.from('projects').select('id,name,notes').range(f, f + 999);
    if (!data || data.length === 0) break;
    projs.push(...data);
    if (data.length < 1000) break;
  }
  const noPartner = projs
    .map((p) => ({ ...p, team: getTeam(p.notes) }))
    .filter((p) => !p.team.some((m) => m?.role === 'partner'));
  console.log(`Проектов без партнёра: ${noPartner.length}`);

  // 3. Таймщиты — только те, что относятся к проектам без партнёра.
  const noPartnerIds = new Set(noPartner.map((p) => p.id));
  const tsRows = [];
  for (let f = 0; ; f += 1000) {
    const { data } = await sb
      .from('timesheet_entries')
      .select('project_id,partner_raw')
      .not('partner_raw', 'is', null)
      .range(f, f + 999);
    if (!data || data.length === 0) break;
    tsRows.push(...data);
    if (data.length < 1000) break;
  }
  const tsForUnassigned = tsRows.filter((r) => r.project_id && noPartnerIds.has(r.project_id));
  console.log(`Таймщит-строк с partner_raw по проектам без партнёра: ${tsForUnassigned.length}`);

  // 4. Группируем partner_raw по проектам.
  const byProject = new Map(); // projectId → Map<partnerRaw, count>
  for (const r of tsForUnassigned) {
    const raw = (r.partner_raw || '').trim();
    if (!raw) continue;
    let m = byProject.get(r.project_id);
    if (!m) { m = new Map(); byProject.set(r.project_id, m); }
    m.set(raw, (m.get(raw) || 0) + 1);
  }
  console.log(`Проектов с partner_raw в таймщитах: ${byProject.size}`);

  // 5. Для каждого проекта: выбираем topPartnerRaw, проверяем уверенность,
  //    маппим на employee.
  const decisions = []; // { projectId, projectName, partnerEmp, confidence, kind, rawCount, raw, total }
  const unmatched = []; // { projectId, projectName, raw, count, reason, candidates? }

  for (const proj of noPartner) {
    const counts = byProject.get(proj.id);
    if (!counts) {
      unmatched.push({ projectId: proj.id, projectName: proj.name, raw: null, count: 0, reason: 'no_timesheets' });
      continue;
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, c]) => s + c, 0);
    const [topRaw, topCount] = sorted[0];
    const conf = topCount / total;

    if (conf < CONFIDENCE) {
      unmatched.push({
        projectId: proj.id, projectName: proj.name, raw: topRaw, count: topCount,
        reason: 'low_confidence', total, conf,
      });
      continue;
    }

    const m = matchEmployee(topRaw, partnerEmps);
    if (!m) {
      unmatched.push({
        projectId: proj.id, projectName: proj.name, raw: topRaw, count: topCount,
        reason: 'no_employee_match',
      });
      continue;
    }
    if (m.kind === 'ambiguous') {
      unmatched.push({
        projectId: proj.id, projectName: proj.name, raw: topRaw, count: topCount,
        reason: 'ambiguous_employee', candidates: m.candidates.map((c) => c.name),
      });
      continue;
    }
    decisions.push({
      projectId: proj.id,
      projectName: proj.name,
      partnerEmp: m.emp,
      kind: m.kind,
      raw: topRaw,
      rawCount: topCount,
      total,
      conf,
    });
  }

  // 6. Отчёт.
  console.log(`\n=== ИТОГ ===`);
  console.log(`К авто-назначению: ${decisions.length}`);
  console.log(`Не получилось:    ${unmatched.length}`);

  // Сводка по reason
  const reasons = {};
  for (const u of unmatched) reasons[u.reason] = (reasons[u.reason] || 0) + 1;
  console.log('Почему не получилось:', reasons);

  // Сводка по партнёрам — кому сколько достанется
  const byPartner = {};
  for (const d of decisions) {
    const k = d.partnerEmp.name;
    if (!byPartner[k]) byPartner[k] = { count: 0, examples: [] };
    byPartner[k].count++;
    if (byPartner[k].examples.length < 3) byPartner[k].examples.push(d.projectName);
  }
  console.log('\nПо партнёрам:');
  Object.entries(byPartner)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, v]) => {
      console.log(`  ${name.padEnd(45)} → ${String(v.count).padStart(4)} проектов  (напр.: ${v.examples.join(' · ')})`);
    });

  // Примеры «не сматчилось»
  console.log('\nПримеры неуверенных / без матча (топ-10):');
  unmatched
    .filter((u) => u.reason !== 'no_timesheets')
    .slice(0, 10)
    .forEach((u) => {
      console.log(`  [${u.reason}] ${u.projectName?.slice(0, 50) || '(no name)'} — raw="${u.raw || ''}" cnt=${u.count}${u.candidates ? ' candidates=[' + u.candidates.join(', ') + ']' : ''}`);
    });

  if (!COMMIT) {
    console.log('\n(dry-run) Запусти с --commit чтобы реально проставить партнёров.');
    return;
  }

  // 7. COMMIT — обновляем notes.team[] в БД.
  console.log('\n=== COMMIT MODE ===');
  const PROJECT_PARTNER_BONUS = 25;
  let ok = 0;
  let fail = 0;
  for (const d of decisions) {
    // Перечитываем проект, чтобы не словить race.
    const { data: cur, error: fetchErr } = await sb
      .from('projects')
      .select('notes')
      .eq('id', d.projectId)
      .single();
    if (fetchErr || !cur) { fail++; continue; }
    let parsed = {};
    try { parsed = typeof cur.notes === 'string' ? JSON.parse(cur.notes) : (cur.notes || {}); } catch {}
    const team = Array.isArray(parsed.team) ? parsed.team : [];
    // На всякий случай удаляем партнёра, если он откуда-то появился между checks.
    const withoutPartner = team.filter((m) => m?.role !== 'partner');
    withoutPartner.push({
      userId: d.partnerEmp.id,
      userName: d.partnerEmp.name,
      role: 'partner',
      bonusPercent: PROJECT_PARTNER_BONUS,
      assignedAt: new Date().toISOString(),
      assignedBy: ASSIGNED_BY,
    });
    const newNotes = { ...parsed, team: withoutPartner, updated_at: new Date().toISOString() };
    const { error: updErr } = await sb
      .from('projects')
      .update({ notes: JSON.stringify(newNotes), updated_at: new Date().toISOString() })
      .eq('id', d.projectId);
    if (updErr) {
      fail++;
      console.error(`FAIL ${d.projectId} (${d.projectName?.slice(0, 40)}): ${updErr.message}`);
    } else {
      ok++;
      if (ok % 50 === 0) process.stdout.write(`  ${ok}/${decisions.length}\r`);
    }
  }
  console.log(`\nDONE. Назначено: ${ok}. Ошибок: ${fail}.`);
  console.log(`\nОткат (по маркеру assignedBy='${ASSIGNED_BY}'):`);
  console.log(`  Запусти rollback-скрипт или вручную через /assign-partners → «Снять».`);
}

main().catch((e) => { console.error(e); process.exit(1); });
