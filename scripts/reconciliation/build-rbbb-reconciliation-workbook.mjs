#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const inputPath = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the reconciliation JSON path as the first argument');
const report = JSON.parse(await fs.readFile(inputPath, 'utf8'));

const COLORS = {
  navy: '#12343B',
  teal: '#0B6B75',
  aqua: '#14B8A6',
  pale: '#E6F4F1',
  line: '#D7E3E1',
  text: '#183B43',
  muted: '#5D7479',
  green: '#DCFCE7',
  greenText: '#166534',
  amber: '#FEF3C7',
  amberText: '#92400E',
  red: '#FEE2E2',
  redText: '#991B1B',
  blue: '#DBEAFE',
  blueText: '#1E40AF',
  white: '#FFFFFF',
};

const DECISIONS = [
  'use_existing_project',
  'create_new_project',
  'keep_live_team',
  'apply_excel_team',
  'merge_team_manually',
  'keep_external',
  'skip',
];

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: 'Codex RBBB Reconciliation' });
const summary = workbook.worksheets.add('Summary');

function colLetter(number) {
  let value = number;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function asText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function candidateText(candidates) {
  return (candidates || [])
    .map((candidate, index) => `${index + 1}. ${candidate.name} [${candidate.score}] (${candidate.id})`)
    .join('\n');
}

function teamText(team) {
  return (team || [])
    .map((member) => {
      const name = member.employeeName || member.userName || member.sourceName || member.name || member.userId || member.employeeId || '';
      const role = member.role || member.sourceRole || '';
      return `${name}${role ? ` [${role}]` : ''}`;
    })
    .join('\n');
}

function styleTitle(sheet, lastColumn, title, subtitle) {
  sheet.showGridLines = false;
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getRange('A1').values = [[title]];
  sheet.getRange(`A1:${lastColumn}1`).format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white, size: 16 },
    verticalAlignment: 'center',
  };
  sheet.getRange(`A1:${lastColumn}1`).format.rowHeight = 30;
  sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange(`A2:${lastColumn}2`).format = {
    fill: COLORS.pale,
    font: { color: COLORS.muted, italic: true, size: 10 },
    wrapText: true,
    verticalAlignment: 'center',
  };
  sheet.getRange(`A2:${lastColumn}2`).format.rowHeight = 30;
}

function styleStatusRange(range) {
  range.conditionalFormats.add('containsText', {
    text: 'confirmed',
    format: { fill: COLORS.green, font: { color: COLORS.greenText, bold: true } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'conflict',
    format: { fill: COLORS.red, font: { color: COLORS.redText, bold: true } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'needs',
    format: { fill: COLORS.amber, font: { color: COLORS.amberText, bold: true } },
  });
  range.conditionalFormats.add('containsText', {
    text: 'mismatch',
    format: { fill: COLORS.red, font: { color: COLORS.redText, bold: true } },
  });
}

function addReviewSheet({ name, title, subtitle, headers, rows, widths, statusHeader = 'Status', decisionHeader = 'Decision' }) {
  const sheet = workbook.worksheets.add(name);
  const lastColumn = colLetter(headers.length);
  styleTitle(sheet, lastColumn, title, subtitle);
  const matrix = [headers, ...rows];
  const endRow = 4 + rows.length;
  sheet.getRange(`A4:${lastColumn}${endRow}`).values = matrix;
  const headerRange = sheet.getRange(`A4:${lastColumn}4`);
  headerRange.format = {
    fill: COLORS.teal,
    font: { bold: true, color: COLORS.white, size: 10 },
    wrapText: true,
    verticalAlignment: 'center',
    borders: { preset: 'outside', style: 'thin', color: COLORS.teal },
  };
  headerRange.format.rowHeight = 34;
  if (rows.length > 0) {
    const body = sheet.getRange(`A5:${lastColumn}${endRow}`);
    body.format = {
      font: { color: COLORS.text, size: 9 },
      verticalAlignment: 'top',
      wrapText: true,
      borders: {
        insideHorizontal: { style: 'thin', color: COLORS.line },
        bottom: { style: 'thin', color: COLORS.line },
      },
    };
    body.format.rowHeight = 42;
    const table = sheet.tables.add(`A4:${lastColumn}${endRow}`, true, `${name.replace(/[^A-Za-z0-9]/g, '')}Table`);
    table.style = 'TableStyleMedium2';
    const statusIndex = headers.indexOf(statusHeader);
    if (statusIndex >= 0) styleStatusRange(sheet.getRange(`${colLetter(statusIndex + 1)}5:${colLetter(statusIndex + 1)}${endRow}`));
    const decisionIndex = headers.indexOf(decisionHeader);
    if (decisionIndex >= 0) {
      const decisionRange = sheet.getRange(`${colLetter(decisionIndex + 1)}5:${colLetter(decisionIndex + 1)}${endRow}`);
      decisionRange.dataValidation = { rule: { type: 'list', values: DECISIONS } };
      decisionRange.conditionalFormats.add('containsBlanks', {
        format: { fill: COLORS.amber, font: { color: COLORS.amberText } },
      });
    }
  }
  sheet.freezePanes.freezeRows(4);
  widths.forEach((width, index) => {
    sheet.getRange(`${colLetter(index + 1)}:${colLetter(index + 1)}`).format.columnWidth = width;
  });
  return sheet;
}

const rbiHeaders = [
  'Source Key', 'File', 'Sheet', 'Row', 'Client', 'Audit Type', 'Company',
  'Old Match', 'Old Best Project', 'Old Score', 'Current Match', 'Current Candidates',
  'Conflicts', 'Live Team', 'Excel Team', 'Live RBI Marker', 'Status', 'Recommendation',
  'Decision', 'Approved Project ID', 'Review Comment',
];

function rbiMatrix(rows) {
  return rows.map((row) => [
    row.sourceKey, row.sourceFile, row.sourceSheet, row.sourceRow, row.clientName, row.auditType,
    row.company, row.oldMatchType, row.oldBestProjectName, row.oldBestScore, row.currentMatchType,
    candidateText(row.currentCandidates), asText(row.conflicts), teamText(row.existingTeam),
    teamText(row.proposedTeam), row.liveRbiMarker, row.status, row.recommendation,
    row.decision, row.approvedProjectId, row.reviewComment,
  ]);
}

const rbiWidths = [28, 24, 20, 8, 28, 20, 22, 13, 32, 10, 13, 50, 40, 38, 38, 12, 22, 26, 24, 32, 36];
addReviewSheet({
  name: 'RBI Match Conflicts',
  title: 'RBI — конфликты сопоставления проекта',
  subtitle: `${report.rbi.matchConflicts.length} строк. Выберите существующий проект либо зафиксируйте skip/create decision; live-БД не изменяется.`,
  headers: rbiHeaders,
  rows: rbiMatrix(report.rbi.matchConflicts),
  widths: rbiWidths,
});
addReviewSheet({
  name: 'RBI Team Conflicts',
  title: 'RBI — конфликты команд',
  subtitle: `${report.rbi.teamConflicts.length} строк; 15 также присутствуют в match-conflict наборе. Сравниваются live- и Excel-команды.`,
  headers: rbiHeaders,
  rows: rbiMatrix(report.rbi.teamConflicts),
  widths: rbiWidths,
});
addReviewSheet({
  name: 'RBI Not Found',
  title: 'RBI — проекты не найдены',
  subtitle: `${report.rbi.notFound.length} строк. Создание проекта возможно только после явного решения create_new_project.`,
  headers: rbiHeaders,
  rows: rbiMatrix(report.rbi.notFound),
  widths: rbiWidths,
});

const kenzheHeaders = [
  'No', 'Client', 'Audit Type', 'Year', 'Period', 'Historical Match', 'Historical Confidence',
  'Current Match', 'Current Candidates', 'Evidence Project', 'Partner Match', 'Shared Marker',
  'Approved Rows', 'Approved Hours', 'Known Unmatched', 'Status', 'Recommendation',
  'Decision', 'Approved Project ID', 'Review Comment',
];
const kenzheRows = report.kenzhekulov.rows.map((row) => [
  row.sourceNo, row.clientName, row.auditType, row.auditYear, row.periodRaw,
  row.historicalMatchProjectName, row.historicalMatchConfidence, row.currentMatchType,
  candidateText(row.currentCandidates), row.evidenceProjectName, row.partnerMatch, row.sharedCloseMarker,
  row.approvedLedgerRows, row.approvedLedgerHours, row.explicitHistoricalUnmatched,
  row.status, row.recommendation, row.decision, row.approvedProjectId, row.reviewComment,
]);
addReviewSheet({
  name: 'Kenzhekulov',
  title: 'Реестр Кенжекулова — source-specific evidence',
  subtitle: 'Общий partner-ledger marker не считается доказательством. Подтверждение требует совпадения проекта и партнёра.',
  headers: kenzheHeaders,
  rows: kenzheRows,
  widths: [7, 30, 22, 9, 20, 34, 14, 14, 50, 34, 12, 12, 12, 14, 12, 22, 28, 24, 32, 36],
});

const timesheetHeaders = [
  'Employee', 'Root File', 'Root SHA-256', 'Root Rows', 'Root Hours', 'Root Dates',
  'Raw File', 'Raw SHA-256', 'Raw Rows', 'Raw Hours', 'Raw Dates',
  'Drive Rows', 'Drive Hours', 'Live Rows', 'Live Hours', 'Live Statuses',
  'Root Strict Match', 'Root Compact Match', 'Raw Strict Match', 'Raw Compact Match',
  'Drive Strict Match', 'Drive Compact Match', 'Drive Status', 'Status', 'Recommendation',
];
const timesheetRows = report.timesheetFiles.rows.map((row) => [
  row.employeeName, row.root.file, row.root.sha256, row.root.rows, row.root.hours,
  `${row.root.minDate} — ${row.root.maxDate}`,
  row.raw.file, row.raw.sha256, row.raw.rows, row.raw.hours, `${row.raw.minDate} — ${row.raw.maxDate}`,
  row.driveDraft.rows, row.driveDraft.hours, row.liveBatchV3.rows, row.liveBatchV3.hours,
  Object.entries(row.liveBatchV3.statuses || {}).map(([status, count]) => `${status}: ${count}`).join('\n'),
  `${row.comparisons.rootToLive.strictMatched}/${row.root.rows}`,
  `${row.comparisons.rootToLive.compactMatched}/${row.root.rows}`,
  `${row.comparisons.rawToLive.strictMatched}/${row.raw.rows}`,
  `${row.comparisons.rawToLive.compactMatched}/${row.raw.rows}`,
  `${row.comparisons.driveToLive.strictMatched}/${row.driveDraft.rows}`,
  `${row.comparisons.driveToLive.compactMatched}/${row.driveDraft.rows}`,
  row.driveStatus, row.status, row.recommendation,
]);
addReviewSheet({
  name: 'Timesheet Files',
  title: 'Timesheet-файлы — сравнение версий',
  subtitle: 'Root/raw/Drive/live сравниваются отдельно. Совпадение имени файла не считается доказательством импорта.',
  headers: timesheetHeaders,
  rows: timesheetRows,
  widths: [28, 28, 22, 10, 12, 22, 32, 22, 10, 12, 22, 10, 12, 10, 12, 20, 14, 14, 14, 14, 14, 14, 24, 24, 32],
  decisionHeader: '__none__',
});

const deltaHeaders = ['Employee', 'Comparison', 'Direction', 'Date', 'Hours', 'Project', 'Notes', 'Sheet', 'Row', 'Status'];
const deltaRows = [];
for (const fileRow of report.timesheetFiles.rows) {
  for (const [comparisonName, comparison] of Object.entries(fileRow.comparisons)) {
    for (const row of comparison.sourceOnlyRows || []) {
      deltaRows.push([fileRow.employeeName, comparisonName, 'source_only', row.workDate, row.hours, row.projectName, row.notes, row.sourceSheet, row.sourceRow, row.status]);
    }
    for (const row of comparison.liveOnlyRows || []) {
      deltaRows.push([fileRow.employeeName, comparisonName, 'live_only', row.workDate, row.hours, row.projectName, row.notes, row.sourceSheet, row.sourceRow, row.status]);
    }
  }
}
addReviewSheet({
  name: 'Timesheet Deltas',
  title: 'Timesheet-файлы — построчные расхождения',
  subtitle: 'Строгий fingerprint: employee + date + hours + project + notes. Эти строки объясняют каждое несовпадение версий.',
  headers: deltaHeaders,
  rows: deltaRows,
  widths: [28, 18, 14, 12, 10, 44, 50, 22, 9, 12],
  decisionHeader: '__none__',
});

const externalHeaders = ['Source Key', 'File', 'Sheet', 'Row', 'Client', 'Person', 'Role', 'Recommendation', 'Decision', 'Review Comment'];
const externalRows = report.rbi.externalPeople.map((row) => [
  row.sourceKey, row.sourceFile, row.sourceSheet, row.sourceRow, row.clientName,
  row.sourceName, row.sourceRole, row.recommendation, row.decision, row.reviewComment,
]);
addReviewSheet({
  name: 'External People',
  title: 'RBI — внешние и ГПХ участники',
  subtitle: 'Эти люди не создаются как внутренние employees автоматически и не получают доступ к системе.',
  headers: externalHeaders,
  rows: externalRows,
  widths: [28, 24, 20, 8, 30, 28, 18, 24, 22, 36],
  statusHeader: '__none__',
});

const dictionaryRows = [
  ['confirmed_applied', 'Live evidence подтверждает применение; повторная запись запрещена.'],
  ['needs_project_match', 'Нужно выбрать существующий проект или skip/create decision.'],
  ['team_conflict', 'Проект найден, но live- и Excel-команды расходятся.'],
  ['create_candidate', 'Проект не найден; создание возможно только после явного решения.'],
  ['source_version_mismatch', 'Локальная root-версия не совпадает с доказанной Drive/live версией.'],
  ['insufficient_evidence', 'Недостаточно source-specific доказательств.'],
  ['use_existing_project', 'Связать строку с указанным существующим project ID.'],
  ['create_new_project', 'Разрешить отдельному будущему apply-процессу создать проект.'],
  ['keep_live_team', 'Оставить текущую live-команду.'],
  ['apply_excel_team', 'Заменить/дополнить команду по Excel после отдельной проверки.'],
  ['merge_team_manually', 'Собрать итоговую команду вручную.'],
  ['keep_external', 'Сохранить человека как внешнего без employee login.'],
  ['skip', 'Не применять исходную строку.'],
];
addReviewSheet({
  name: 'Data Dictionary',
  title: 'Справочник статусов и решений',
  subtitle: `Источник: ${path.relative(process.cwd(), inputPath)}. Заполнение Decision не изменяет live-БД.`,
  headers: ['Value', 'Meaning'],
  rows: dictionaryRows,
  widths: [30, 90],
  statusHeader: '__none__',
  decisionHeader: '__none__',
});

summary.showGridLines = false;
styleTitle(summary, 'H', 'RBBB — единый реестр сверки импортов', `Read-only снимок: ${report.observedAt}. Никаких изменений live-БД.`);
summary.getRange('A4:C4').values = [['Контрольный показатель', 'Значение', 'Что означает']];
summary.getRange('A4:C4').format = { fill: COLORS.teal, font: { bold: true, color: COLORS.white }, wrapText: true };
const metrics = [
  ['RBI match conflicts', null, 'Неоднозначный выбор проекта'],
  ['RBI team conflicts', null, 'Расхождение live- и Excel-команд'],
  ['Пересечение конфликтов', report.rbi.reviewSummary.overlap, 'Строки присутствуют в обоих conflict-наборах'],
  ['RBI not found', null, 'Проект не найден'],
  ['Уникальных RBI строк review', null, 'Match + team без двойного счёта + not found'],
  ['RBI marker projects live', report.live.rbiMarkedProjects, 'Подтверждённая live baseline'],
  ['RBI assigned members live', report.live.rbiAssignedMembers, 'Подтверждённая live baseline'],
  ['Кенжекулов source rows', null, 'Все строки исходного анализа'],
  ['Кенжекулов confirmed', null, 'Есть source-specific project + partner evidence'],
  ['Кенжекулов review', null, 'Нет достаточного source-specific evidence'],
  ['Approved timesheets live', report.live.approvedTimesheetRows, 'Только status=approved'],
  ['Approved hours live', report.live.approvedTimesheetHours, 'Часы status=approved'],
  ['Shared ledger marker projects', report.live.sharedLedgerMarkedProjects, 'Не относится только к Кенжекулову'],
  ['Shared ledger approved rows', report.live.sharedLedgerApprovedRows, 'Не относится только к Кенжекулову'],
  ['Shared ledger approved hours', report.live.sharedLedgerApprovedHours, 'Не относится только к Кенжекулову'],
];
summary.getRange(`A5:C${4 + metrics.length}`).values = metrics;
summary.getRange('B5').formulas = [[`=COUNTA('RBI Match Conflicts'!$A$5:$A$${4 + report.rbi.matchConflicts.length})`]];
summary.getRange('B6').formulas = [[`=COUNTA('RBI Team Conflicts'!$A$5:$A$${4 + report.rbi.teamConflicts.length})`]];
summary.getRange('B8').formulas = [[`=COUNTA('RBI Not Found'!$A$5:$A$${4 + report.rbi.notFound.length})`]];
summary.getRange('B9').formulas = [['=B5+B6-B7+B8']];
summary.getRange('B12').formulas = [[`=COUNTA('Kenzhekulov'!$A$5:$A$${4 + report.kenzhekulov.rows.length})`]];
summary.getRange('B13').formulas = [[`=COUNTIF('Kenzhekulov'!$P$5:$P$${4 + report.kenzhekulov.rows.length},"confirmed_applied")`]];
summary.getRange('B14').formulas = [['=B12-B13']];
summary.getRange(`A5:C${4 + metrics.length}`).format = {
  font: { color: COLORS.text, size: 10 },
  borders: { insideHorizontal: { style: 'thin', color: COLORS.line } },
  verticalAlignment: 'center',
  wrapText: true,
};
summary.getRange(`B5:B${4 + metrics.length}`).format = { font: { bold: true, color: COLORS.navy, size: 11 }, numberFormat: '#,##0.0' };
summary.getRange('A22:H22').merge();
summary.getRange('A22').values = [['Как работать с реестром']];
summary.getRange('A22:H22').format = { fill: COLORS.navy, font: { bold: true, color: COLORS.white } };
summary.getRange('A23:H27').merge(true);
summary.getRange('A23:A27').values = [[
  '1. Начните с RBI Match Conflicts и RBI Team Conflicts.\n2. Заполните Decision, Approved Project ID и Review Comment.\n3. Для RBI Not Found используйте create_new_project только после проверки клиента и периода.\n4. В Kenzhekulov общий marker не является доказательством одного реестра.\n5. Timesheet Files и Timesheet Deltas показывают, почему повторный импорт запрещён.',
], [''], [''], [''], ['']];
summary.getRange('A23:H27').format = { fill: COLORS.pale, font: { color: COLORS.text, size: 11 }, wrapText: true, verticalAlignment: 'top' };
summary.getRange('A:A').format.columnWidth = 34;
summary.getRange('B:B').format.columnWidth = 16;
summary.getRange('C:C').format.columnWidth = 54;
summary.getRange('D:H').format.columnWidth = 14;
summary.freezePanes.freezeRows(4);

const summaryCheck = await workbook.inspect({
  kind: 'table',
  sheetId: 'Summary',
  range: 'A1:H27',
  include: 'values,formulas',
  tableMaxRows: 30,
  tableMaxCols: 8,
  maxChars: 8000,
});
console.log(summaryCheck.ndjson);
const formulaErrors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan',
  maxChars: 4000,
});
console.log(formulaErrors.ndjson);

const previewDir = path.resolve('tmp/codex-reconciliation/previews');
await fs.mkdir(previewDir, { recursive: true });
const previewRanges = {
  Summary: 'A1:H27',
  'RBI Match Conflicts': 'A1:U24',
  'RBI Team Conflicts': 'A1:U24',
  'RBI Not Found': 'A1:U24',
  Kenzhekulov: 'A1:T24',
  'Timesheet Files': 'A1:Y7',
  'Timesheet Deltas': 'A1:J30',
  'External People': 'A1:J20',
  'Data Dictionary': 'A1:B17',
};
for (const [sheetName, range] of Object.entries(previewRanges)) {
  const preview = await workbook.render({ sheetName, range, scale: 0.8, format: 'png' });
  await fs.writeFile(path.join(previewDir, `${sheetName.replace(/[^A-Za-z0-9]+/g, '-')}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const reportBase = path.basename(inputPath, '.json');
const reportOutput = path.resolve('reports/reconciliation', `${reportBase}.xlsx`);
const finalOutput = path.resolve('outputs/rbbb-reconciliation', 'RBBB-Import-Reconciliation-2026-07-12.xlsx');
await fs.mkdir(path.dirname(reportOutput), { recursive: true });
await fs.mkdir(path.dirname(finalOutput), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(reportOutput);
await fs.copyFile(reportOutput, finalOutput);
console.log(JSON.stringify({ inputPath, reportOutput, finalOutput, previewDir }, null, 2));
