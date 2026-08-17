import assert from 'node:assert/strict';
import test from 'node:test';
import { requireMailSender } from '../api/_email-utils.mjs';

function supabaseForRole(role) {
  return {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: { id: `user-${role}`, email: `${role}@example.invalid`, role },
        }),
      };
    },
  };
}

test('accountant may send invoice and AVR emails', async () => {
  const user = await requireMailSender(
    { headers: { 'x-suite-user-id': 'accountant-id' } },
    supabaseForRole('accountant'),
  );
  assert.equal(user.role, 'accountant');
});

test('ordinary project roles cannot send system accounting email', async () => {
  await assert.rejects(
    requireMailSender(
      { headers: { 'x-suite-user-id': 'partner-id' } },
      supabaseForRole('partner'),
    ),
    (error) => error?.statusCode === 403,
  );
});
