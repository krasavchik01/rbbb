import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(
  new URL('../src/pages/ProjectCommandCenter.tsx', import.meta.url),
  'utf8',
);
const inlineDetailSource = fs.readFileSync(
  new URL('../src/components/projects/ProjectInlineDetail.tsx', import.meta.url),
  'utf8',
);

test('the unified ledger replaces the separate executive dashboard', () => {
  assert.doesNotMatch(
    pageSource,
    /import\s*\{[^}]*\bExecutivePortfolioOverview\b[^}]*\}\s*from\s*['"]@\/components\/projects\/ExecutivePortfolioOverview['"]/s,
  );
  assert.equal(
    (pageSource.match(/<ExecutivePortfolioOverview\b/g) || []).length,
    0,
    'the separate CEO overview must not be mounted',
  );
  assert.match(pageSource, /aria-label="Единый свод проектов"/);
  assert.match(pageSource, /data-testid="project-ledger-row"/);
  assert.match(pageSource, /Единый свод · один проект = одна строка/);
});

test('project states are exactly all, working, ready for bonuses and closed', () => {
  const typeBlock = pageSource.match(/type ProjectViewFilter\s*=([\s\S]*?);/)?.[1] || '';
  const typeValues = [...typeBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(typeValues, ['all', 'working', 'ready_bonus', 'closed']);

  const stateFilterBlock = pageSource.match(/<ProjectFilterField label="Состояние проекта">([\s\S]*?)<\/ProjectFilterField>/)?.[1] || '';
  const stateOptions = [...stateFilterBlock.matchAll(/<SelectItem value="([^"]+)">\s*([^<]+?)\s*<\/SelectItem>/g)]
    .map((match) => ({ value: match[1], label: match[2].trim() }));
  assert.deepEqual(stateOptions, [
    { value: 'all', label: 'Все' },
    { value: 'working', label: 'В работе' },
    { value: 'ready_bonus', label: 'Готовы к бонусам' },
    { value: 'closed', label: 'Закрытые' },
  ]);
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
    inlineDetailSource,
    /<BonusFact label="Распределено" value=\{formatMoney\(allocated\)\}/,
  );
  assert.doesNotMatch(
    inlineDetailSource,
    /<BonusFact label="Выплачено" value=\{formatMoney\(allocated\)\}/,
  );
  assert.match(inlineDetailSource, /data-testid="project-bonus-summary"/);
  assert.match(inlineDetailSource, /Выплачено \{formatMoney\(paid\)\}/);
  assert.match(pageSource, /Бонусный пул:[\s\S]{0,120}executiveSummary\.plannedBonusPool/);
  assert.match(pageSource, /Выплачено:[\s\S]{0,120}executiveSummary\.paidFromRegistry/);
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
  assert.match(pageSource, /const bonusLockedReason = !canEditBonusDraft[\s\S]{0,650}paymentLedger\.rowCount > 0/);
  assert.match(pageSource, /const compactBonusLockReason = !canEditBonusDraft[\s\S]{0,500}paymentLedger\.rowCount > 0/);
});

test('CEO projects page does not mount separate visual dashboards', () => {
  assert.doesNotMatch(pageSource, /import \{ ExecutivePortfolioVisuals \}/);
  assert.equal((pageSource.match(/<ExecutivePortfolioVisuals\b/g) || []).length, 0);
  assert.equal((pageSource.match(/<ProjectWorkloadChart\b/g) || []).length, 0);
  assert.equal((pageSource.match(/<ProjectPortfolioPulse\b/g) || []).length, 0);
  assert.match(pageSource, /Договор, компания, вся команда, сроки, часы, статус и бонус каждого находятся внутри одной строки проекта/);
  assert.match(pageSource, /canSeeBonusSummary[\s\S]{0,250}бонус каждого/);
});

test('compact portfolio totals use exclusive business states without a workload dashboard', () => {
  assert.match(pageSource, /if \(row\.status === 'pending_payment_approval'\) acc\.readyBonus \+= 1/);
  assert.match(pageSource, /else if \(row\.baseReadiness\.level === 'attention'\) acc\.attention \+= 1/);
  assert.match(pageSource, /else acc\.inWork \+= 1/);
  assert.match(pageSource, /plannedBonusPool:\s*summary\.plannedBonusPool/);
  assert.match(pageSource, /paidFromRegistry:\s*paymentRegistrySummary\.paidAmount/);
  assert.doesNotMatch(pageSource, /const workloadItems = useMemo/);
});
