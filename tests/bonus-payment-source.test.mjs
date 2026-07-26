import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const bonusesPage = fs.readFileSync(new URL('../src/pages/Bonuses.tsx', import.meta.url), 'utf8');
const bonusLedger = fs.readFileSync(new URL('../src/lib/bonusLedger.ts', import.meta.url), 'utf8');
const ceoSummary = fs.readFileSync(
  new URL('../src/components/projects/CEOSummaryTable.tsx', import.meta.url),
  'utf8',
);

test('bonuses page reads the final payment registry', () => {
  assert.match(bonusesPage, /loadBonusPayments/);
  assert.match(bonusesPage, /buildBonusLedger/);
  assert.match(bonusLedger, /payment_date/);
  assert.match(bonusLedger, /row\.status === 'approved'/);
  assert.doesNotMatch(bonusesPage, /buildBonusPaymentIndex/);
});

test('bonuses page does not imitate payment through project notes', () => {
  assert.doesNotMatch(bonusesPage, /const markBonusPaid/);
  assert.doesNotMatch(bonusesPage, /const unmarkBonusPaid/);
  assert.doesNotMatch(bonusesPage, /\{ paidAt: new Date/);
  assert.doesNotMatch(bonusesPage, /markPaid:\s*async/);
  assert.doesNotMatch(bonusesPage, /unmarkPaid:\s*async/);
});

test('CEO summary exposes no payment mutation actions', () => {
  assert.doesNotMatch(ceoSummary, /markPaid\?:/);
  assert.doesNotMatch(ceoSummary, /unmarkPaid\?:/);
  assert.doesNotMatch(ceoSummary, /actions\.markPaid/);
  assert.doesNotMatch(ceoSummary, /actions\.unmarkPaid/);
});

test('CEO summary labels calculated money as planned, not paid', () => {
  assert.doesNotMatch(ceoSummary, /label="Выплачено \/ запланировано"/);
  assert.match(ceoSummary, /label="Плановый бонусный фонд"/);
});
