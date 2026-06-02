#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mknvqsnitzaurpwnhzwn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbnZxc25pdHphdXJwd25oenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjE2NzUsImV4cCI6MjA2OTUzNzY3NX0.vK2JrnJJrlwag7zOMJBgPWbUnodwsYBouFxViu5PZFY';

const IN_DIR = path.resolve('tmp/timesheets-raw');
const OUT_JSON = path.resolve('tmp/timesheets-dryrun.json');
const OUT_REPORT = path.resolve('tmp/timesheets-report.txt');

// Date window for import — outside this range = typos to ignore
const DATE_MIN = '2024-10-01';
const DATE_MAX = '2026-05-31';

// Manual filename → DB employee name overrides for known married-name changes
// or other special cases where automatic matcher fails.
const FILENAME_OVERRIDES = {
  'Тулепбергенова Мая': 'Кенжебек Мая Тельманкызы', // смена фамилии
};

const ARGS = new Set(process.argv.slice(2));
const COMMIT = ARGS.has('--commit');

const norm = (s) => String(s || '').toLowerCase().replace(/[«»""''\-_().,:;]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length >= 2);

// Normalize Kazakh-specific letters to Russian equivalents for matching
// (file might have Турлығазина while DB has Турлыгазина)
const kzNorm = (s) => String(s || '').toLowerCase()
  .replace(/ә/g, 'а').replace(/ғ/g, 'г').replace(/қ/g, 'к').replace(/ң/g, 'н')
  .replace(/ө/g, 'о').replace(/ұ/g, 'у').replace(/ү/g, 'у').replace(/һ/g, 'х').replace(/і/g, 'и');

// Cyrillic → Latin transliteration (GOST/passport style) to bridge
// "Жорабеков Жанибек" ↔ "Zhorabekov Zhanibek"
const cyrToLat = (s) => {
  const map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z',
    и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s',
    т:'t', у:'u', ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y',
    ь:'', э:'e', ю:'yu', я:'ya' };
  return kzNorm(s).split('').map((c) => map[c] != null ? map[c] : c).join('');
};

// Build a normalized token set: includes kz-normalized cyrillic AND its latin transliteration
function nameTokens(s) {
  const cyr = kzNorm(norm(s));
  const cyrTokens = cyr.split(' ').filter((t) => t.length >= 2);
  const latTokens = cyrToLat(cyr).split(' ').filter((t) => t.length >= 2);
  return new Set([...cyrTokens, ...latTokens]);
}

function parseDate(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' || /^\d+(\.\d+)?$/.test(String(raw))) {
    const n = Number(raw);
    if (n > 20000 && n < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + n * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    y = y.length === 2 ? '20' + y : y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

function parseHours(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw > 0 && raw <= 24 ? raw : null;
  const s = String(raw).trim();
  // Time range like "10:00 - 18:00" or "10:00-18:30"
  const m = s.match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const start = +m[1] + (+m[2]) / 60;
    const end = +m[3] + (+m[4]) / 60;
    const diff = end - start;
    return diff > 0 && diff <= 24 ? diff : null;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : null;
}

function classifyProject(projectRaw) {
  const s = String(projectRaw || '').trim();
  if (!s) return { kind: 'empty', cleaned: '' };
  if (/Административн/i.test(s)) return { kind: 'admin', cleaned: s };
  if (/Без проекта/i.test(s)) return { kind: 'noproject', cleaned: s };
  if (/Отсутств|Отпуск|больничн/i.test(s)) return { kind: 'absence', cleaned: s };
  if (/^[-=*]{3,}/.test(s)) return { kind: 'sep', cleaned: s };
  return { kind: 'project', cleaned: s };
}

function buildProjectIndex(projects) {
  const idx = [];
  for (const p of projects) {
    const n = norm(p.name);
    if (!n) continue;
    idx.push({ id: p.id, name: p.name, status: p.status, normalized: n, tokens: tokens(p.name) });
  }
  return idx;
}

function matchProject(text, projectIndex) {
  const t = norm(text);
  if (!t) return null;
  // exact normalized
  let best = projectIndex.find((p) => p.normalized === t);
  if (best) return best;
  // includes (text contains project name OR project name contains text — short wins)
  best = projectIndex
    .filter((p) => p.normalized.length >= 10 && (t.includes(p.normalized) || p.normalized.includes(t)))
    .sort((a, b) => a.normalized.length - b.normalized.length)[0];
  if (best) return best;
  // token-based: >=50% project tokens present in text
  const textTokens = new Set(tokens(text));
  const scored = projectIndex
    .map((p) => {
      const matched = p.tokens.filter((tk) => textTokens.has(tk)).length;
      return { p, score: p.tokens.length > 0 ? matched / p.tokens.length : 0, matched };
    })
    .filter((x) => x.matched >= 2 && x.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.matched - a.matched);
  return scored[0]?.p || null;
}

function matchEmployee(name, employees) {
  const fileTokens = nameTokens(name);
  if (fileTokens.size < 1) return null;
  // exact normalized (kz-normalized cyrillic)
  const fileNormCyr = kzNorm(norm(name));
  let best = employees.find((e) => kzNorm(norm(e.name)) === fileNormCyr);
  if (best) return best;
  // Surname (longer) match is required — given name alone (e.g. "Мая", "Дана")
  // is too common to identify a person uniquely.
  const candidates = employees.map((e) => {
    const dbTokens = nameTokens(e.name);
    const sharedTokens = [...fileTokens].filter((t) => dbTokens.has(t));
    const longestShared = sharedTokens.reduce((m, t) => Math.max(m, t.length), 0);
    return { e, shared: sharedTokens.length, longestShared, dbSize: dbTokens.size };
  }).filter((x) => x.shared >= 2 && x.longestShared >= 6);
  if (candidates.length === 1) return candidates[0].e;
  if (candidates.length > 1) {
    candidates.sort((a, b) => b.shared - a.shared || b.longestShared - a.longestShared || a.dbSize - b.dbSize);
    return candidates[0].e;
  }
  // fallback: unique surname-only match (single token >= 6 chars)
  const fileArr = [...fileTokens].filter((t) => t.length >= 6);
  for (const tok of fileArr) {
    const matches = employees.filter((e) => nameTokens(e.name).has(tok));
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i].map((c) => String(c || '').toLowerCase());
    if (r.some((c) => c.includes('сотрудник')) && r.some((c) => c.includes('дата')) && r.some((c) => c.includes('часы'))) {
      return i;
    }
  }
  return -1;
}

function mapHeaders(headerRow) {
  const map = {};
  headerRow.forEach((cell, i) => {
    const c = String(cell || '').toLowerCase().trim();
    if (c.includes('сотрудник')) map.employee = i;
    else if (c === 'дата' || c.includes('дата')) map.date = i;
    else if (c === 'проект' || (c.includes('проект') && !c.includes('катег'))) map.project = i;
    else if (c.includes('должн')) map.position = i;
    else if (c.includes('катег') || c.includes('секц')) map.section = i;
    else if (c.includes('часы') || c.includes('час ')) map.hours = i;
    else if (c.includes('локац')) map.location = i;
    else if (c.includes('руковод')) map.manager = i;
    else if (c.includes('партн')) map.partner = i;
    else if (c.includes('примеч') || c.includes('коммент')) map.notes = i;
  });
  return map;
}

function parseFile(filePath, fileName, employees, projectIndex) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find((n) => /time|таймщ|щит/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const headerIdx = findHeaderRow(all);
  if (headerIdx < 0) return { rows: [], warnings: ['no header row found'] };
  const headers = all[headerIdx];
  const cols = mapHeaders(headers);
  if (cols.employee == null || cols.date == null || cols.hours == null) {
    return { rows: [], warnings: ['required columns missing: ' + JSON.stringify(cols)] };
  }

  // expected employee from filename (e.g. "Касымбек Тинай.xlsx" → "Касымбек Тинай")
  const expectedEmp = fileName.replace(/\.xlsx$/i, '').trim();
  const expectedTokens = nameTokens(expectedEmp);

  const out = [];
  const warnings = [];
  let auxRowsSkipped = 0;
  let refSkipped = 0;

  for (let i = headerIdx + 1; i < all.length; i++) {
    const r = all[i];
    if (!r || r.length === 0) continue;
    const empRaw = String(r[cols.employee] || '').trim();
    if (!empRaw) continue;
    if (empRaw.includes('#REF')) { refSkipped++; continue; }

    // Skip rows where employee in row != expected (auxiliary lists at bottom)
    const empT = nameTokens(empRaw);
    let sharedTokens = 0;
    for (const t of empT) if (expectedTokens.has(t)) sharedTokens++;
    if (sharedTokens === 0) { auxRowsSkipped++; continue; }

    const dateRaw = r[cols.date];
    const hoursRaw = r[cols.hours];
    const projectRaw = String(r[cols.project] || '').trim();
    const notesRaw = String(r[cols.notes] || '').trim();
    const sectionRaw = String(r[cols.section] || '').trim();
    const positionRaw = String(r[cols.position] || '').trim();
    const locationRaw = String(r[cols.location] || '').trim();
    const managerRaw = String(r[cols.manager] || '').trim();
    const partnerRaw = String(r[cols.partner] || '').trim();

    const work_date = parseDate(dateRaw);
    const hours = parseHours(hoursRaw);
    if (!work_date) { warnings.push(`row ${i + 1}: bad date "${dateRaw}"`); continue; }
    if (hours == null) { warnings.push(`row ${i + 1}: bad hours "${hoursRaw}"`); continue; }

    const cls = classifyProject(projectRaw);

    let resolvedProjectId = null;
    let resolvedProjectName = projectRaw;
    let projectSource = 'direct';

    if (cls.kind === 'project') {
      const hit = matchProject(projectRaw, projectIndex);
      if (hit) {
        resolvedProjectId = hit.id;
        resolvedProjectName = hit.name;
      }
    } else if (cls.kind === 'admin' || cls.kind === 'noproject') {
      // try to resolve from notes
      if (notesRaw) {
        const hit = matchProject(notesRaw, projectIndex);
        if (hit) {
          resolvedProjectId = hit.id;
          resolvedProjectName = hit.name;
          projectSource = 'notes';
        }
      }
      if (!resolvedProjectId) {
        resolvedProjectName = cls.kind === 'admin' ? '__ADMIN__' : '__NO_PROJECT__';
        projectSource = cls.kind;
      }
    } else if (cls.kind === 'absence') {
      resolvedProjectName = '__ABSENCE__';
      projectSource = 'absence';
    }

    out.push({
      sourceFile: fileName,
      sourceRow: i + 1,
      employee_name_raw: empRaw,
      work_date,
      hours,
      project_raw: projectRaw,
      project_id: resolvedProjectId,
      project_name: resolvedProjectName,
      project_source: projectSource,
      section: sectionRaw,
      position: positionRaw,
      location: locationRaw,
      manager_raw: managerRaw,
      partner_raw: partnerRaw,
      notes: notesRaw,
      project_kind: cls.kind,
    });
  }

  return { rows: out, warnings, auxRowsSkipped, refSkipped, expectedEmp };
}

async function main() {
  console.log('Loading employees + projects from Supabase…');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: employees } = await sb.from('employees').select('id,name,role');
  // paginate projects (might be >1000)
  let projects = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('projects').select('id,name,status').range(from, from + 999);
    if (error) throw error;
    projects.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  console.log(`Loaded ${employees.length} employees, ${projects.length} projects`);
  const projectIndex = buildProjectIndex(projects);

  const files = fs.readdirSync(IN_DIR).filter((f) => f.endsWith('.xlsx')).sort();
  console.log(`Processing ${files.length} xlsx files…`);

  const all = [];
  const fileStats = [];
  const allWarnings = [];

  for (const f of files) {
    const res = parseFile(path.join(IN_DIR, f), f, employees, projectIndex);
    const baseName = f.replace(/\.xlsx$/i, '');
    const overrideName = FILENAME_OVERRIDES[baseName];
    let emp = null;
    if (overrideName) {
      emp = employees.find((e) => kzNorm(norm(e.name)) === kzNorm(norm(overrideName))) || null;
    }
    if (!emp) emp = matchEmployee(res.expectedEmp || baseName, employees);
    const rowsWithEmp = res.rows.map((r) => ({
      ...r,
      employee_id: emp?.id || null,
      employee_db_name: emp?.name || null,
    }));
    all.push(...rowsWithEmp);
    fileStats.push({
      file: f,
      rows: res.rows.length,
      employee_matched: !!emp,
      employee_db: emp?.name || null,
      employee_id: emp?.id || null,
      aux_skipped: res.auxRowsSkipped || 0,
      ref_skipped: res.refSkipped || 0,
      warnings: res.warnings?.length || 0,
    });
    if (res.warnings?.length) allWarnings.push({ file: f, warnings: res.warnings.slice(0, 5) });
  }

  // Filter by import date window
  const beforeFilter = all.length;
  const allFiltered = all.filter((r) => r.work_date >= DATE_MIN && r.work_date <= DATE_MAX);
  const droppedByDate = beforeFilter - allFiltered.length;
  // Replace `all` going forward with filtered view
  all.length = 0;
  all.push(...allFiltered);

  // Aggregations
  const totalHours = all.reduce((s, r) => s + r.hours, 0);
  const matchedProjectRows = all.filter((r) => r.project_id);
  const matchedHours = matchedProjectRows.reduce((s, r) => s + r.hours, 0);
  const matchedEmpRows = all.filter((r) => r.employee_id);
  const matchedEmpHours = matchedEmpRows.reduce((s, r) => s + r.hours, 0);
  const adminRows = all.filter((r) => r.project_kind === 'admin');
  const absenceRows = all.filter((r) => r.project_kind === 'absence');
  const unmatchedProjectRows = all.filter((r) => r.project_kind === 'project' && !r.project_id);
  const unmatchedEmpFiles = fileStats.filter((f) => !f.employee_matched);

  // Per-employee aggregation
  const perEmp = {};
  for (const r of all) {
    const k = r.employee_db_name || r.employee_name_raw;
    if (!perEmp[k]) perEmp[k] = { hours: 0, rows: 0, matched_emp: !!r.employee_id, projects: new Set() };
    perEmp[k].hours += r.hours;
    perEmp[k].rows++;
    if (r.project_id) perEmp[k].projects.add(r.project_name);
  }

  // Per-month aggregation
  const perMonth = {};
  for (const r of all) {
    const m = r.work_date.slice(0, 7);
    perMonth[m] = (perMonth[m] || 0) + r.hours;
  }

  // Date range
  const dates = all.map((r) => r.work_date).filter(Boolean).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // Conflicts: day > 24h per employee
  const dayHours = {};
  for (const r of all) {
    const k = `${r.employee_db_name || r.employee_name_raw}|${r.work_date}`;
    dayHours[k] = (dayHours[k] || 0) + r.hours;
  }
  const overloadedDays = Object.entries(dayHours).filter(([, h]) => h > 16);
  const tooManyDays = Object.entries(dayHours).filter(([, h]) => h > 24);

  // Write dry-run JSON
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ all, fileStats, summary: { totalRows: all.length, totalHours, matchedHours, matchedEmpHours, minDate, maxDate } }, null, 2),
  );

  // Text report
  const report = [];
  report.push('='.repeat(80));
  report.push('TIMESHEETS DRY-RUN REPORT');
  report.push('='.repeat(80));
  report.push(`Files processed: ${files.length}`);
  report.push(`Date range: ${minDate} … ${maxDate}`);
  report.push(`Total rows: ${all.length}`);
  report.push(`Total hours: ${totalHours.toFixed(1)}`);
  report.push('');
  report.push('--- Employee matching ---');
  report.push(`Matched to DB: ${fileStats.filter((f) => f.employee_matched).length}/${files.length}`);
  if (unmatchedEmpFiles.length) {
    report.push('UNMATCHED files (need manual mapping):');
    unmatchedEmpFiles.forEach((f) => report.push(`  - ${f.file} (${f.rows} rows)`));
  }
  report.push('');
  report.push('--- Project matching ---');
  report.push(`Project rows total: ${all.filter((r) => r.project_kind === 'project').length}`);
  report.push(`  matched: ${matchedProjectRows.length}`);
  report.push(`  unmatched: ${unmatchedProjectRows.length}`);
  report.push(`Admin rows: ${adminRows.length} (resolved via notes: ${adminRows.filter((r) => r.project_id).length})`);
  report.push(`Absence rows: ${absenceRows.length}`);
  report.push('');
  report.push('--- Hours by month ---');
  Object.entries(perMonth).sort().forEach(([m, h]) => report.push(`  ${m}: ${h.toFixed(1)}h`));
  report.push('');
  report.push('--- Per-employee summary (top 30 by hours) ---');
  Object.entries(perEmp)
    .sort((a, b) => b[1].hours - a[1].hours)
    .slice(0, 30)
    .forEach(([k, v]) => report.push(`  ${v.matched_emp ? '✓' : '✗'} ${k.padEnd(35)} ${v.hours.toFixed(1).padStart(7)}h  ${v.rows.toString().padStart(4)} rows  ${v.projects.size} projects`));
  report.push('');
  report.push('--- Conflicts ---');
  report.push(`Days >16h (warn): ${overloadedDays.length}`);
  report.push(`Days >24h (CRITICAL): ${tooManyDays.length}`);
  if (tooManyDays.length) tooManyDays.slice(0, 10).forEach(([k, h]) => report.push(`  ${k}  ${h.toFixed(1)}h`));
  report.push('');
  report.push('--- Top 20 unmatched projects (samples) ---');
  const unmatchedSamples = {};
  unmatchedProjectRows.forEach((r) => {
    unmatchedSamples[r.project_raw] = (unmatchedSamples[r.project_raw] || 0) + r.hours;
  });
  Object.entries(unmatchedSamples)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([n, h]) => report.push(`  ${h.toFixed(1).padStart(7)}h  ${n.slice(0, 100)}`));

  // Employees that need to be created (have rows but no DB match, AND have >0 rows in window)
  const toCreateMap = new Map();
  for (const r of all) {
    if (r.employee_id) continue;
    const key = r.employee_name_raw.trim();
    if (!key) continue;
    if (!toCreateMap.has(key)) toCreateMap.set(key, { name: key, rows: 0, hours: 0 });
    const e = toCreateMap.get(key);
    e.rows++; e.hours += r.hours;
  }
  const toCreate = [...toCreateMap.values()].sort((a, b) => b.hours - a.hours);

  report.push('');
  report.push('--- Employees to AUTO-CREATE (no DB match, role=employee, level=1) ---');
  report.push(`Total: ${toCreate.length} employees`);
  toCreate.forEach((e) => report.push(`  ${e.hours.toFixed(1).padStart(7)}h  ${e.rows.toString().padStart(4)} rows  ${e.name}`));
  report.push('');
  report.push(`--- Date filter ---`);
  report.push(`Window: ${DATE_MIN} … ${DATE_MAX}`);
  report.push(`Dropped (outside window): ${droppedByDate} rows`);

  fs.writeFileSync(OUT_REPORT, report.join('\n'));
  console.log('\n' + report.join('\n'));
  console.log(`\nDry-run written:\n  ${OUT_JSON}\n  ${OUT_REPORT}`);

  if (!COMMIT) {
    console.log('\n(dry-run) Re-run with --commit to actually create employees and insert rows.');
    return;
  }

  // COMMIT MODE — create missing employees, then insert all rows
  console.log('\n=== COMMIT MODE ===');
  const batchId = `${new Date().toISOString().slice(0, 10)}-drive-bulk`;
  console.log(`import_batch_id: ${batchId}`);

  // Step 1: create missing employees
  if (toCreate.length) {
    console.log(`Creating ${toCreate.length} employees…`);
    const newEmpRows = toCreate.map((e) => ({
      id: crypto.randomUUID(),
      name: e.name,
      role: 'employee',
      level: '1',
    }));
    const { error: e1 } = await sb.from('employees').insert(newEmpRows);
    if (e1) {
      console.error('FAILED to create employees:', e1);
      return;
    }
    // Map newly created back into our rows
    for (const r of all) {
      if (r.employee_id) continue;
      const match = newEmpRows.find((ne) => ne.name === r.employee_name_raw.trim());
      if (match) r.employee_id = match.id;
    }
  }

  // Step 2: delete any prior batch with this id (idempotent re-run)
  const { error: e2 } = await sb.from('timesheet_entries').delete().eq('import_batch_id', batchId);
  if (e2) console.warn('cleanup error (continuing):', e2.message);

  // Step 3: insert rows in chunks
  const insertRows = all.map((r) => ({
    employee_id: r.employee_id || null,
    employee_name: r.employee_db_name || r.employee_name_raw,
    project_id: r.project_id || null,
    project_name: r.project_name === '__ADMIN__' || r.project_name === '__NO_PROJECT__' || r.project_name === '__ABSENCE__' ? r.project_raw : r.project_name,
    work_date: r.work_date,
    hours: r.hours,
    section: r.section || null,
    position: r.position || null,
    location: r.location || null,
    manager_raw: r.manager_raw || null,
    partner_raw: r.partner_raw || null,
    notes: r.notes || null,
    source: 'import',
    status: 'submitted',
    import_batch_id: batchId,
  }));

  console.log(`Inserting ${insertRows.length} rows in chunks of 500…`);
  let inserted = 0;
  for (let i = 0; i < insertRows.length; i += 500) {
    const chunk = insertRows.slice(i, i + 500);
    const { error } = await sb.from('timesheet_entries').insert(chunk);
    if (error) {
      console.error(`Chunk ${i}-${i + chunk.length} FAILED:`, error.message);
      console.error('First failing row:', JSON.stringify(chunk[0]).slice(0, 500));
      process.exit(1);
    }
    inserted += chunk.length;
    process.stdout.write(`  ${inserted}/${insertRows.length}\r`);
  }
  console.log(`\nDONE. Inserted ${inserted} rows with import_batch_id=${batchId}`);
  console.log(`Rollback: DELETE FROM timesheet_entries WHERE import_batch_id = '${batchId}';`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
