import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'App.tsx');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['node_modules', 'dist', '_legacy'].includes(name)) continue;
      out.push(...walk(p));
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function normalizeTarget(target) {
  return target.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function routeToRegExp(route) {
  const normalized = normalizeTarget(route);
  if (normalized === '*') return null;
  const escaped = normalized
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([^/]+)/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

test('literal internal navigation targets point to registered App routes', () => {
  const appSource = readFileSync(APP, 'utf8');
  const routePaths = [...appSource.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((m) => m[1]);
  const routeMatchers = routePaths.map(routeToRegExp).filter(Boolean);

  const patterns = [
    /navigate\(\s*["'](\/[^"'`]+)["']/g,
    /\bto=\{?["'](\/[^"'`]+)["']\}?/g,
    /\burl:\s*["'](\/[^"'`]+)["']/g,
    /\bhref=\{?["'](\/[^"'`]+)["']\}?/g,
    /window\.location\.href\s*=\s*["'](\/[^"'`]+)["']/g,
  ];

  const failures = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const source = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const raw = match[1];
        if (!raw.startsWith('/') || raw.startsWith('//')) continue;
        if (raw.includes('${') || raw.includes(':')) continue;
        const target = normalizeTarget(raw);
        if (routeMatchers.some((re) => re.test(target))) continue;
        failures.push(`${rel}:${lineNumber(source, match.index ?? 0)} -> ${raw}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});

test('legacy survey and template workflows are not exposed in primary UI', () => {
  const checkedFiles = [
    'src/components/AppSidebar.tsx',
    'src/components/Layout.tsx',
    'src/components/MobileNavigation.tsx',
  ];

  const forbiddenMarkers = [
    '/survey',
    '/project-survey',
    '/project-survey-results',
    '/import-timesheet',
    '/template-constructor',
    "url: '/create-project'",
    'to="/create-project"',
    'navigate(\'/create-project\')',
    'navigate("/create-project")',
    'ProjectSurveyBanner',
    'Опрос и команды',
    'Создать шаблон',
  ];

  const failures = [];
  for (const rel of checkedFiles) {
    const source = readFileSync(path.join(ROOT, rel), 'utf8');
    for (const marker of forbiddenMarkers) {
      if (source.includes(marker)) failures.push(`${rel} exposes ${marker}`);
    }
  }

  assert.deepEqual(failures, []);
});

test('legacy routes redirect to active product workflows instead of rendering legacy pages', () => {
  const appSource = readFileSync(APP, 'utf8');
  const expectations = [
    ['path="/survey"', 'to="/projects"'],
    ['path="/project-survey"', 'to="/projects"'],
    ['path="/project-survey-results"', 'to="/projects"'],
    ['path="/import-timesheet"', 'to="/timesheets"'],
    ['path="/template-constructor/:id"', 'to="/create-project-procurement"'],
    ['path="/create-project"', 'to="/create-project-procurement"'],
  ];

  for (const [route, target] of expectations) {
    const routeIndex = appSource.indexOf(route);
    assert.notEqual(routeIndex, -1, `${route} route should remain as safe redirect`);
    const routeSnippet = appSource.slice(routeIndex, routeIndex + 220);
    assert.ok(routeSnippet.includes(target), `${route} should redirect to ${target}`);
  }

  assert.equal(appSource.includes('<SurveyHub />'), false);
  assert.equal(appSource.includes('<TemplateConstructor />'), false);
  assert.equal(appSource.includes('<CreateProjectFromTemplate />'), false);
});
