import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const boundary = fs.readFileSync(new URL('../src/components/WidgetErrorBoundary.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('stale asset recovery reloads without rewriting the route on iOS', () => {
  assert.doesNotMatch(html, /__suite_refresh/);
  assert.doesNotMatch(boundary, /searchParams\.set\(['"]__suite_refresh/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(boundary, /window\.location\.reload\(\)/);
});

test('stale asset recovery tolerates blocked browser storage', () => {
  assert.match(html, /try \{[\s\S]*sessionStorage\.getItem/);
  assert.match(html, /window\.name/);
  assert.match(boundary, /try \{[\s\S]*sessionStorage\.getItem/);
  assert.match(boundary, /window\.name/);
});

test('preload recovery is registered before the application entry and is forced', () => {
  assert.ok(html.indexOf('vite:preloadError') < html.indexOf('/src/main.tsx'));
  assert.match(html, /recover\(event\.payload \|\| event, true\)/);
  assert.ok(html.indexOf('recover(event.payload || event, true)') < html.indexOf('event.preventDefault()', html.indexOf('vite:preloadError')));
  assert.match(html, /suite-asset-recovery/);
  assert.match(html, /Нужно обновить страницу/);
});

test('the critical projects route is bundled with the application shell', () => {
  assert.match(app, /import Projects from ['"]@\/pages\/Projects['"]/);
  assert.doesNotMatch(app, /lazy\(\(\) => import\(['"]@\/pages\/Projects['"]\)\)/);
  assert.match(app, /<WidgetErrorBoundary fullPage label="приложение">[\s\S]*<Routes>/);
  assert.match(main, /<WidgetErrorBoundary fullPage label="запуск приложения">[\s\S]*<AuthProvider>/);
});

test('deployment caches immutable assets but always revalidates the application shell', () => {
  const headers = vercel.headers || [];
  assert.ok(headers.some((rule) => rule.source === '/assets/(.*)' && rule.headers?.some((header) => /immutable/.test(header.value))));
  assert.ok(headers.some((rule) => rule.headers?.some((header) => /no-store/.test(header.value))));
});
