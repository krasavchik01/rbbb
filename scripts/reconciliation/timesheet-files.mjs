import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { normalizeText, parseExcelDate, parseHours, rowFingerprint } from './core.mjs';

export const TIMESHEET_FILE_TARGETS = [
  {
    employeeId: 'd1dbb59d-113c-4d9a-8a65-06f441bcf0a9',
    employeeName: 'Аманов Онгар',
    rootFile: 'Аманов Онгар.xlsx',
    rawFile: 'tmp/timesheets-raw/Аманов Онгар.xlsx',
  },
  {
    employeeId: 'ba3d0a39-e789-4eed-8890-64dca41dbdd9',
    employeeName: 'Сауле Бадамбаева',
    rootFile: 'Бадамбаева Сауле(1).xlsx',
    rawFile: 'tmp/timesheets-raw/Бадамбаева Сауле.xlsx',
  },
  {
    employeeId: '481df253-c011-46c1-bcda-04ea31690a1f',
    employeeName: 'Сартаева Гаухар Шыныбековна',
    rootFile: 'Сартаева Гаухар(1).xlsx',
    rawFile: 'tmp/timesheets-raw/Сартаева Гаухар.xlsx',
  },
];

export function cleanExpectedEmployeeName(fileName) {
  return path.basename(fileName)
    .replace(/\.xlsx?$/i, '')
    .replace(/\(\d+\)\s*$/i, '')
    .trim();
}

function findHeaderRow(matrix) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const cells = (matrix[rowIndex] || []).map((cell) => normalizeText(cell));
    if (
      cells.some((cell) => cell.includes('сотрудник'))
      && cells.some((cell) => cell.includes('дата'))
      && cells.some((cell) => cell.includes('час'))
    ) {
      return rowIndex;
    }
  }
  return -1;
}

function mapHeaders(header) {
  const columns = {};
  header.forEach((cell, index) => {
    const value = normalizeText(cell);
    if (value.includes('сотрудник')) columns.employee = index;
    else if (value.includes('дата')) columns.date = index;
    else if (value === 'проект' || (value.includes('проект') && !value.includes('катег'))) columns.project = index;
    else if (value.includes('час')) columns.hours = index;
    else if (value.includes('примеч') || value.includes('коммент')) columns.notes = index;
  });
  return columns;
}

function nameMatches(actual, expected) {
  const actualText = normalizeText(actual);
  const expectedTokens = normalizeText(expected).split(' ').filter((token) => token.length >= 3);
  return expectedTokens.length > 0 && expectedTokens.every((token) => actualText.includes(token));
}

function compactFingerprint(row) {
  return rowFingerprint({ ...row, projectName: '', notes: '' });
}

export function parseSheetRows(matrix, { employeeId, expectedEmployeeName, sheetName }) {
  const headerRow = findHeaderRow(matrix);
  if (headerRow < 0) return [];
  const columns = mapHeaders(matrix[headerRow] || []);
  if (columns.employee == null || columns.date == null || columns.hours == null) return [];
  const rows = [];
  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const source = matrix[index] || [];
    const employeeName = String(source[columns.employee] || '').trim();
    if (!employeeName || !nameMatches(employeeName, expectedEmployeeName)) continue;
    const workDate = parseExcelDate(source[columns.date]);
    const hoursRaw = source[columns.hours];
    let hours = parseHours(hoursRaw);
    let hoursInferred = false;
    if (hours == null && (hoursRaw === '' || hoursRaw == null || Number(hoursRaw) === 0)) {
      hours = 8;
      hoursInferred = true;
    }
    if (!workDate || hours == null) continue;
    const row = {
      employeeId,
      employeeName,
      workDate,
      hours,
      hoursInferred,
      projectName: String(source[columns.project] || '').trim(),
      notes: String(source[columns.notes] || '').trim(),
      sourceSheet: sheetName,
      sourceRow: index + 1,
    };
    row.fingerprint = rowFingerprint(row);
    row.compactFingerprint = compactFingerprint(row);
    rows.push(row);
  }
  return rows;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function parseWorkbookRows(filePath, target) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const rows = [];
  const sheets = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const parsed = parseSheetRows(matrix, {
      employeeId: target.employeeId,
      expectedEmployeeName: cleanExpectedEmployeeName(filePath),
      sheetName,
    });
    if (parsed.length > 0) {
      rows.push(...parsed);
      sheets.push({ name: sheetName, rows: parsed.length, range: sheet['!ref'] || '' });
    }
  }
  return { filePath, sha256: sha256(filePath), sheets, rows };
}

function toCounts(collection) {
  const counts = new Map();
  for (const value of collection || []) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}

export function compareFingerprintSets(source, live) {
  const sourceCounts = toCounts(source);
  const liveCounts = toCounts(live);
  const sourceOnly = [];
  const liveOnly = [];
  let matched = 0;
  for (const key of new Set([...sourceCounts.keys(), ...liveCounts.keys()])) {
    const sourceCount = sourceCounts.get(key) || 0;
    const liveCount = liveCounts.get(key) || 0;
    matched += Math.min(sourceCount, liveCount);
    for (let index = 0; index < Math.max(0, sourceCount - liveCount); index += 1) sourceOnly.push(key);
    for (let index = 0; index < Math.max(0, liveCount - sourceCount); index += 1) liveOnly.push(key);
  }
  return { matched, sourceOnly: sourceOnly.sort(), liveOnly: liveOnly.sort() };
}

function normalizeDraftRows(drafts, target) {
  return drafts
    .filter((row) => row.employeeId === target.employeeId)
    .map((source, index) => {
      const row = {
        employeeId: target.employeeId,
        employeeName: source.employeeName || target.employeeName,
        workDate: String(source.workDate || '').slice(0, 10),
        hours: Number(source.hours) || 0,
        projectName: source.projectName || '',
        notes: source.notes || '',
        sourceSheet: 'Drive draft',
        sourceRow: index + 1,
      };
      row.fingerprint = rowFingerprint(row);
      row.compactFingerprint = compactFingerprint(row);
      return row;
    });
}

function normalizeLiveRows(timesheets, target) {
  return timesheets
    .filter(
      (row) => row.employee_id === target.employeeId && row.import_batch_id === '2026-06-04-drive-bulk-v3',
    )
    .map((source, index) => {
      const row = {
        employeeId: target.employeeId,
        employeeName: source.employee_name || target.employeeName,
        workDate: String(source.work_date || '').slice(0, 10),
        hours: Number(source.hours) || 0,
        projectName: source.project_name || '',
        notes: source.notes || '',
        sourceSheet: 'live batch v3',
        sourceRow: index + 1,
        status: source.status || '',
      };
      row.fingerprint = rowFingerprint(row);
      row.compactFingerprint = compactFingerprint(row);
      return row;
    });
}

function summarizeRows(rows) {
  const dates = rows.map((row) => row.workDate).filter(Boolean).sort();
  return {
    rows: rows.length,
    hours: Number(rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0).toFixed(1)),
    minDate: dates[0] || '',
    maxDate: dates.at(-1) || '',
    projects: new Set(rows.map((row) => normalizeText(row.projectName)).filter(Boolean)).size,
  };
}

function compareRows(sourceRows, liveRows) {
  const strict = compareFingerprintSets(
    sourceRows.map((row) => row.fingerprint),
    liveRows.map((row) => row.fingerprint),
  );
  const compact = compareFingerprintSets(
    sourceRows.map((row) => row.compactFingerprint),
    liveRows.map((row) => row.compactFingerprint),
  );
  const sourceOnlyRows = unmatchedRows(sourceRows, liveRows, 'fingerprint');
  const liveOnlyRows = unmatchedRows(liveRows, sourceRows, 'fingerprint');
  const compactSourceOnlyRows = unmatchedRows(sourceRows, liveRows, 'compactFingerprint');
  const compactLiveOnlyRows = unmatchedRows(liveRows, sourceRows, 'compactFingerprint');
  return {
    strictMatched: strict.matched,
    strictSourceOnly: strict.sourceOnly.length,
    strictLiveOnly: strict.liveOnly.length,
    compactMatched: compact.matched,
    compactSourceOnly: compact.sourceOnly.length,
    compactLiveOnly: compact.liveOnly.length,
    sourceOnlyRows: sourceOnlyRows.map(publicRow),
    liveOnlyRows: liveOnlyRows.map(publicRow),
    compactSourceOnlyRows: compactSourceOnlyRows.map(publicRow),
    compactLiveOnlyRows: compactLiveOnlyRows.map(publicRow),
  };
}

function unmatchedRows(sourceRows, comparisonRows, key) {
  const available = toCounts(comparisonRows.map((row) => row[key]));
  const unmatched = [];
  for (const row of sourceRows) {
    const value = row[key];
    const remaining = available.get(value) || 0;
    if (remaining > 0) available.set(value, remaining - 1);
    else unmatched.push(row);
  }
  return unmatched;
}

function publicRow(row) {
  return {
    workDate: row.workDate,
    hours: row.hours,
    projectName: row.projectName,
    notes: row.notes,
    sourceSheet: row.sourceSheet,
    sourceRow: row.sourceRow,
    status: row.status || '',
  };
}

export function buildTimesheetFileEvidence({ reimportEvidence, timesheets }) {
  return TIMESHEET_FILE_TARGETS.map((target) => {
    const root = parseWorkbookRows(path.resolve(target.rootFile), target);
    const raw = parseWorkbookRows(path.resolve(target.rawFile), target);
    const driveRows = normalizeDraftRows(reimportEvidence.drafts || [], target);
    const liveRows = normalizeLiveRows(timesheets, target);
    const rootComparison = compareRows(root.rows, liveRows);
    const rawComparison = compareRows(raw.rows, liveRows);
    const driveComparison = compareRows(driveRows, liveRows);
    const rootExactlyCovered = rootComparison.strictSourceOnly === 0;
    const rawExactlyCovered = rawComparison.strictSourceOnly === 0;
    const driveExactlyCovered = driveComparison.strictSourceOnly === 0;
    const driveStatus = driveExactlyCovered && driveComparison.strictLiveOnly === 0
      ? 'exact_drive_batch_match'
      : driveComparison.strictLiveOnly === 0
        ? 'live_subset_after_cleanup'
        : 'drive_live_mismatch';
    return {
      employeeId: target.employeeId,
      employeeName: target.employeeName,
      root: {
        file: target.rootFile,
        sha256: root.sha256,
        sheets: root.sheets,
        ...summarizeRows(root.rows),
      },
      raw: {
        file: target.rawFile,
        sha256: raw.sha256,
        sheets: raw.sheets,
        ...summarizeRows(raw.rows),
      },
      driveDraft: summarizeRows(driveRows),
      liveBatchV3: {
        ...summarizeRows(liveRows),
        statuses: Object.fromEntries(
          [...new Set(liveRows.map((row) => row.status))]
            .sort()
            .map((status) => [status, liveRows.filter((row) => row.status === status).length]),
        ),
      },
      comparisons: {
        rootToLive: rootComparison,
        rawToLive: rawComparison,
        driveToLive: driveComparison,
      },
      exactCoverage: { root: rootExactlyCovered, raw: rawExactlyCovered, drive: driveExactlyCovered },
      driveStatus,
      status: rootExactlyCovered ? 'confirmed_exact_root_import' : 'source_version_mismatch',
      recommendation: rootExactlyCovered ? 'no_reimport' : 'keep_live_and_review_version_delta',
    };
  });
}
