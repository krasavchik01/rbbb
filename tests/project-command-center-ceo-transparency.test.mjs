import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(
  new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url),
  'utf8',
);
const overviewSource = fs.readFileSync(
  new URL('../src/components/projects/ExecutivePortfolioOverview.tsx', import.meta.url),
  'utf8',
);

test('executive portfolio overview is imported and rendered only for executives', () => {
  assert.match(
    pageSource,
    /import\s*\{[^}]*\bExecutivePortfolioOverview\b[^}]*\}\s*from\s*['"]@\/components\/projects\/ExecutivePortfolioOverview['"]/s,
  );
  assert.equal(
    (pageSource.match(/<ExecutivePortfolioOverview\b/g) || []).length,
    1,
    'the CEO overview must have one source-of-truth render',
  );
  assert.ok(
    /(?:\{|:)\s*isExecutive\s*(?:&&|\?)\s*\(\s*(?:<>\s*)?<ExecutivePortfolioOverview\b[^>]*summary=\{executiveSummary\}[^>]*\/>/s.test(pageSource),
    'ExecutivePortfolioOverview must be mounted behind the isExecutive guard',
  );
  assert.match(overviewSource, /aria-label="Картина бизнеса генерального директора"/);
});

test('CEO decision cards activate real ready-for-bonus and bonus-attention filters', () => {
  for (const view of ['ready_bonus', 'bonus_attention']) {
    assert.match(pageSource, new RegExp(`\\| '${view}'`));
    assert.match(pageSource, new RegExp(`viewFilter === '${view}'`));
    assert.match(overviewSource, new RegExp(`onApplyView\\('${view}'\\)`));
  }
});

test('a project exposes a direct route to its bonus workspace', () => {
  const hasBonusWorkspaceAnchor = /id=\{?[`'"]bonus-workspace(?:-|[`'"])/.test(pageSource);
  const hasDirectBonusAction = /onClick=\{\(\) => openBonusWorkspace\(row\.id\)\}/.test(pageSource)
    || /href=\{?[`'"]#bonus-workspace/.test(pageSource);

  assert.ok(
    hasBonusWorkspaceAnchor || hasDirectBonusAction,
    'expected a bonus-workspace anchor or an explicit project bonus action',
  );
});

test('project draft bonuses are labelled as allocated, not falsely paid', () => {
  assert.match(
    pageSource,
    /function allocatedDraftBonuses\([^)]*\)[\s\S]{0,240}totalPaidBonuses/,
  );
  assert.match(
    pageSource,
    /Распределено(?: команде)?:<\/span>\s*<span[^>]*>\{displayMoney\((?:paidBonuses|allocatedBonuses)\)\}<\/span>/,
  );
  assert.doesNotMatch(
    pageSource,
    /Выплачено:<\/span>\s*<span[^>]*>\{displayMoney\((?:paidBonuses|allocatedBonuses)\)\}<\/span>/,
  );
  assert.match(overviewSource, /label="Распределено команде"/);
  assert.match(overviewSource, /label="Фактически выплачено"[\s\S]{0,180}summary\.paidFromRegistry/);
});

test('CEO totals load one unified timesheet snapshot and the final bonus registry', () => {
  assert.match(
    pageSource,
    /import\s*\{[^}]*\bloadTimesheetHoursSnapshot\b[^}]*\}\s*from\s*['"]@\/lib\/timesheets['"]/s,
  );
  assert.equal(
    (pageSource.match(/\bloadTimesheetHoursSnapshot\s*\(/g) || []).length,
    1,
    'the command center must not run parallel full timesheet reads',
  );
  assert.match(pageSource, /setHoursTotals\(snapshot\.byProject\)/);
  assert.match(pageSource, /snapshot\.approvedByEmployeeProject/);
  assert.match(pageSource, /snapshot\.pendingByEmployeeProject/);

  assert.match(
    pageSource,
    /import\s*\{[^}]*\bloadBonusPayments\b[^}]*\bsummarizeBonusPaymentRegistry\b[^}]*\}\s*from\s*['"]@\/lib\/bonusPayments['"]/s,
  );
  assert.equal(
    (pageSource.match(/\bloadBonusPayments\s*\(/g) || []).length,
    1,
    'the CEO overview must load the payment registry once',
  );
  assert.match(pageSource, /summarizeBonusPaymentRegistry\(paymentRows, portfolioProjectIds\)/);
  assert.match(pageSource, /approvedForPayment:\s*paymentRegistrySummary\.approvedUnpaidAmount/);
  assert.match(pageSource, /paidFromRegistry:\s*paymentRegistrySummary\.paidAmount/);
});

test('financial status transitions and bonus drafts fail closed when source data is unverified', () => {
  assert.match(pageSource, /const requiresVerifiedHours = nextStatus === 'pending_payment_approval' \|\| nextStatus === 'completed'/);
  assert.match(pageSource, /requiresVerifiedHours && \(hoursLoading \|\| hoursError \|\| !hoursComplete\)/);
  assert.match(pageSource, /paymentRegistryLoading[\s\S]{0,500}Excel не выгружен/);
  assert.match(pageSource, /const bonusEditingLocked = groupedBonusRow[\s\S]{0,300}paymentLedger\.paidAmount > 0/);
});
