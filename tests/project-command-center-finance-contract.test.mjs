import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modelSource = fs.readFileSync(new URL('../src/lib/projectCommandCenterModel.ts', import.meta.url), 'utf8');
const cardSource = fs.readFileSync(new URL('../src/components/projects/ProjectCommandCard.tsx', import.meta.url), 'utf8');
const blueprintSource = fs.readFileSync(new URL('../docs/ceo-workbook-blueprint.md', import.meta.url), 'utf8');

test('command center read-model exposes CEO finance waterfall without converting missing amount to zero', () => {
  assert.match(modelSource, /finance: \{/);
  assert.match(modelSource, /plannedBonusPool: number \| null/);
  assert.match(modelSource, /confirmedPaidBonuses: number \| null/);
  assert.match(modelSource, /bonusDelta: number \| null/);
  assert.match(modelSource, /function positiveMoney\(value: unknown\): number \| null/);
  assert.match(modelSource, /if \(!amountWithoutVAT\) \{\s*return \{\s*amountWithoutVAT: null/s);
  assert.match(modelSource, /if \(amount === null\) warnings\.push\(warning\('missing_contract_amount'/);
  assert.match(modelSource, /contract: \{[\s\S]*amountWithoutVAT: amount,[\s\S]*contractFileCount,/);
});

test('command card renders Excel-derived financial waterfall for authorized CEO roles', () => {
  assert.match(cardSource, /Финансовый waterfall CEO/);
  assert.match(cardSource, /Сумма без НДС/);
  assert.match(cardSource, /ГПХ \/ подряд/);
  assert.match(cardSource, /Предрасход/);
  assert.match(cardSource, /База бонуса/);
  assert.match(cardSource, /Пул бонусов/);
  assert.match(cardSource, /План распределён/);
  assert.match(cardSource, /Подтверждено выплачено/);
  assert.match(cardSource, /Разница план\/факт/);
  assert.match(cardSource, /Грязный доход/);
  assert.match(cardSource, /Недоступно для вашей роли/);
});

test('CEO workbook blueprint remains the product contract for the finance slice', () => {
  assert.match(blueprintSource, /bonus_pool = \(contract_amount_without_VAT − GPH − pre_expense\) × project_bonus_percent/);
  assert.match(blueprintSource, /planned_bonus_total = Σ role bonus amounts/);
  assert.match(blueprintSource, /`0` is not equivalent to missing data/);
});
