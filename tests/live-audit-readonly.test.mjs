import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('live audit contains no Supabase mutation calls', () => {
  const source = fs.readFileSync(
    new URL('../scripts/audit-rbbb-live-state.mjs', import.meta.url),
    'utf8',
  );

  for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
    assert.equal(source.includes(forbidden), false, `forbidden call: ${forbidden}`);
  }
  assert.equal(source.includes('--commit'), false);
});
