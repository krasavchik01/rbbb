import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyProjectCompany } from '../scripts/lib/project-retention.mjs';

const kept = [
  'ТОО МАК',
  'МАК',
  'ТОО МКФ',
  'ТОО RB Partners IT Audit',
  'IT Audit',
  'ТОО Academy',
  'ЧК Rusell',
  'Russell Bedford A+ Partners Ltd',
  'ЧК',
  '',
  null,
  'Консорциум',
  'Паркер КЗ, консорциум совместно с ТОО Anderson Qazaqstan',
  'ЧК (Концорсиум ЧК+МАК+Андерсон КЗ)',
  'Главный МАК, в тендере участвовали в консорциуме МАК+Андерсон КЗ',
];

for (const company of kept) {
  test(`keeps ${String(company) || 'missing company'}`, () => {
    assert.equal(classifyProjectCompany(company).action, 'keep');
  });
}

const removed = [
  'Паркер КЗ',
  'ТОО Parker Казахстан',
  'Parker Consulting & Appraisal',
  'Андерсон КЗ',
  'ТОО Anderson Qazaqstan',
  'Anderson Consulting',
];

for (const company of removed) {
  test(`deletes ${company}`, () => {
    assert.equal(classifyProjectCompany(company).action, 'delete');
  });
}

test('keeps an unknown value instead of guessing', () => {
  assert.deepEqual(classifyProjectCompany('Филиал Фин кз'), {
    action: 'keep',
    reason: 'unrecognized_company',
  });
});
