import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const appSource = read('src/App.tsx');
const sidebarSource = read('src/components/AppSidebar.tsx');
const mobileNavigationSource = read('src/components/MobileNavigation.tsx');
const roleAccessSource = read('src/lib/roleAccess.ts');

function bonusPresentationSource() {
  const files = [
    'src/pages/Bonuses.tsx',
    'src/lib/bonusLedger.ts',
    ...fs.readdirSync(path.join(root, 'src/components'), { recursive: true })
      .map(String)
      .filter((file) => /bonus/i.test(file) && /\.(?:ts|tsx)$/.test(file))
      .map((file) => path.join('src/components', file)),
  ];
  return files.filter((file) => fs.existsSync(path.join(root, file))).map(read).join('\n');
}

test('the bonus ledger route is a real CEO/admin page rather than a project-filter redirect', () => {
  assert.match(appSource, /const Bonuses = lazy\(\(\) => import\(['"]@\/pages\/Bonuses['"]\)\)/);
  const routeIndex = appSource.indexOf('path="/bonuses"');
  assert.notEqual(routeIndex, -1, 'missing /bonuses route');
  const routeBlock = appSource.slice(routeIndex, routeIndex + 500);
  assert.match(routeBlock, /<ProtectedRoute allowedRoles=\{ROLE_GROUPS\.executive\}>/);
  assert.match(routeBlock, /<Bonuses\s*\/>/);
  assert.doesNotMatch(routeBlock, /<Navigate\b/);
  assert.match(roleAccessSource, /executive:\s*\['ceo', 'admin'\]/);
  assert.match(roleAccessSource, /'\/bonuses': ROLE_GROUPS\.executive/);
});

test('desktop and mobile navigation expose the bonus ledger only to the executive role group', () => {
  for (const source of [sidebarSource, mobileNavigationSource]) {
    assert.match(
      source,
      /(?:url|to):\s*['"]\/bonuses['"][\s\S]{0,160}allowedRoles:\s*ROLE_GROUPS\.executive/,
    );
  }
});

test('the executive page exposes reconciled KPI, chart and employee-source surfaces', () => {
  const source = bonusPresentationSource();
  for (const testId of [
    'bonus-dashboard',
    'bonus-kpi-planned',
    'bonus-kpi-approved',
    'bonus-kpi-paid',
    'bonus-kpi-unregistered',
    'bonus-reconciliation',
    'bonus-status-chart',
    'bonus-top-employees-chart',
    'bonus-employee-table',
    'bonus-project-sources',
  ]) {
    assert.ok(source.includes(testId), `missing ${testId} executive bonus surface`);
  }
  assert.match(source, /loadBonusPayments/);
  assert.match(source, /teamBonuses/);
  assert.match(source, /Сверка сошлась/);
});

test('each employee has a printable receipt with project sources and handwritten acceptance fields', () => {
  const source = bonusPresentationSource();
  assert.match(source, /bonus-employee-row-/);
  assert.match(source, /Распечатать ведомость:/);
  assert.match(source, /bonus-print-slip/);
  assert.match(source, /window\.print\s*\(/);
  assert.match(source, /@media\s+print/);
  assert.match(source, /Ведомость выплаты бонуса/);
  assert.match(source, /Сумму .*получил\(а\)/);
  assert.match(source, /Подпись/);
  assert.match(source, /Дата/);
});
