import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const auth = fs.readFileSync(new URL('../src/contexts/AuthContext.tsx', import.meta.url), 'utf8');
const deadlineHook = fs.readFileSync(new URL('../src/hooks/useDeadlineNotifications.ts', import.meta.url), 'utf8');

test('auth restoration tolerates restricted browser storage and stalled access queries', () => {
  assert.match(auth, /function safeStorageGet/);
  assert.match(auth, /function safeStorageSet/);
  assert.match(auth, /function safeStorageRemove/);
  assert.match(auth, /ACCESS_LOOKUP_TIMEOUT_MS = 10_000/);
  assert.match(auth, /withTimeout\([\s\S]*getUserAllowedCompanyIds/);
  assert.doesNotMatch(auth, /(?<!window\.)localStorage\.(?:getItem|setItem|removeItem)/);
});

test('browser notification permission is not requested automatically on page load', () => {
  assert.doesNotMatch(deadlineHook, /requestNotificationPermission/);
});
