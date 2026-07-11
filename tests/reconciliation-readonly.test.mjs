import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('reconciliation collector contains no mutation path', () => {
  const source = fs.readFileSync(
    new URL('../scripts/reconciliation/collect-rbbb-reconciliation.mjs', import.meta.url),
    'utf8',
  );
  for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(', '--commit']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('collector does not invoke legacy import scripts', () => {
  const source = fs.readFileSync(
    new URL('../scripts/reconciliation/collect-rbbb-reconciliation.mjs', import.meta.url),
    'utf8',
  );
  for (const forbidden of [
    'import-timesheets.mjs',
    'close-partner-ledger-projects.mjs',
    'dryrun-rbi-project-enrichment.mjs',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('bonus payment registry reader contains no mutation path', () => {
  const source = fs.readFileSync(
    new URL('../src/lib/bonusPayments.ts', import.meta.url),
    'utf8',
  );
  for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
