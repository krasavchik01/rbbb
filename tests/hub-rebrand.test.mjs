import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('all customer-facing product surfaces use the HUB brand', () => {
  const brandedFiles = [
    'index.html',
    'public/manifest.json',
    'src/components/AppHeader.tsx',
    'src/components/AppSidebar.tsx',
    'src/pages/Index.tsx',
    'src/pages/Register.tsx',
    'src/pages/ForgotPassword.tsx',
    'src/pages/ResetPassword.tsx',
    'src/pages/Bonuses.tsx',
    'src/components/settings/EmailSettingsPanel.tsx',
    'src/lib/emailService.ts',
    'src/services/emailService.ts',
    'api/_email-utils.mjs',
    'api/request-password-reset.mjs',
    'api/test-smtp.mjs',
  ];

  for (const path of brandedFiles) {
    const source = read(path);
    assert.match(source, /HUB/, `${path} must show the HUB brand`);
    assert.doesNotMatch(source, /SUITE-A/, `${path} still exposes the old product name`);
  }
});

test('all operational public links point to the HUB domain', () => {
  for (const path of [
    'api/request-password-reset.mjs',
    'api/cron/deadline-reminders.mjs',
    'src/lib/emailService.ts',
  ]) {
    const source = read(path);
    assert.match(source, /https:\/\/hub\.rbpartners\.kz/, `${path} must use the HUB domain`);
    assert.doesNotMatch(source, /https:\/\/rbbb\.vercel\.app/, `${path} still uses the legacy public address`);
  }
});

test('browser and installable-app icons carry the HUB initial', () => {
  const favicon = read('public/favicon.svg');
  assert.match(favicon, />H<\/text>/);
  assert.doesNotMatch(favicon, />RB<\/text>/);
});
