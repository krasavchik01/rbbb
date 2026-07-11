import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyKenzhekulovEvidence,
  classifyProjectCandidates,
  classifyRbiRow,
  normalizeText,
  parseExcelDate,
  parseHours,
  rowFingerprint,
  scoreProject,
  sourceKey,
  summarizeRbiReview,
} from '../scripts/reconciliation/core.mjs';

test('normalizes quotes, Kazakh letters and whitespace without mojibake', () => {
  assert.equal(normalizeText(' ТОО «Қыран»  '), 'тоо кыран');
});

test('builds stable source identity', () => {
  assert.equal(
    sourceKey('1 кв Проекты 2024_RBI.xlsx', 'Проекты 1 кв 2024', 19),
    '1 кв проекты 2024 rbi.xlsx::проекты 1 кв 2024::19',
  );
});

test('fingerprint is stable across numeric hour formatting', () => {
  const base = {
    employeeId: 'e1',
    workDate: '2026-01-02',
    hours: 8,
    projectName: 'ТОО «FinQ»',
    notes: '',
  };
  assert.equal(rowFingerprint(base), rowFingerprint({ ...base, hours: '8.00' }));
});

test('keeps match and team conflicts visible as independent flags', () => {
  assert.deepEqual(
    classifyRbiRow({ matchType: 'conflict', conflicts: ['partner differs'] }),
    { status: 'needs_project_match', matchConflict: true, teamConflict: true },
  );
});

test('summarizes overlapping review populations', () => {
  const rows = [
    { matchType: 'conflict', conflicts: ['x'] },
    { matchType: 'conflict', conflicts: [] },
    { matchType: 'exact', conflicts: ['x'] },
    { matchType: 'not_found', conflicts: [] },
  ];
  assert.deepEqual(summarizeRbiReview(rows), {
    matchConflicts: 2,
    teamConflicts: 2,
    overlap: 1,
    additionalTeamConflicts: 1,
    notFound: 1,
    uniqueReviewRows: 4,
  });
});

test('uses the historical RBI score bands', () => {
  assert.equal(classifyProjectCandidates([{ score: 64 }]), 'not_found');
  assert.equal(classifyProjectCandidates([{ score: 82 }, { score: 71 }]), 'probable');
  assert.equal(classifyProjectCandidates([{ score: 105 }, { score: 92 }]), 'exact');
  assert.equal(classifyProjectCandidates([{ score: 104 }, { score: 96 }]), 'conflict');
});

test('does not match projects only by a legal entity token', () => {
  assert.equal(
    scoreProject(
      { clientName: 'ТОО ТИМ', auditType: '', auditPeriod: '', starts: [], ends: [] },
      { name: 'ТОО Aidarly Mining', notes: {} },
    ),
    0,
  );
});

test('parses Excel serial dates and valid hours', () => {
  assert.equal(parseExcelDate(45589), '2024-10-24');
  assert.equal(parseHours('8.00'), 8);
  assert.equal(parseHours('10:00 - 18:30'), 8.5);
  assert.equal(parseHours(25), null);
});

test('does not attribute a shared ledger marker to Kenzhekulov by itself', () => {
  assert.equal(
    classifyKenzhekulovEvidence({ sharedMarker: true, partnerMatch: false, nameMatch: false }),
    'insufficient_evidence',
  );
});

test('confirms Kenzhekulov evidence only when partner and project match', () => {
  assert.equal(
    classifyKenzhekulovEvidence({ sharedMarker: true, partnerMatch: true, nameMatch: true }),
    'confirmed_applied',
  );
});
