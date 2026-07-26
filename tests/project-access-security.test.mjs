import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const accessSource = read('src/lib/projectAccessControl.ts');
const commandCenterSource = read('src/pages/ProjectCommandCenter.tsx');
const workspaceSource = read('src/pages/ProjectWorkspace.tsx');
const apiSource = read('api/project-access-settings.mjs');
const migrationSource = read('supabase/migrations/20260726000000_restrict_app_settings_updates_to_admin.sql');

test('bonus visibility is hard-limited to CEO and admin even if settings are tampered with', () => {
  assert.match(accessSource, /BONUS_VISIBILITY_ROLES[^=]*= \['ceo', 'admin'\]/);
  assert.match(accessSource, /section === 'bonuses' && !BONUS_VISIBILITY_ROLES\.includes\(role\)\) return false/);
  assert.match(accessSource, /source\.bonuses[\s\S]{0,180}BONUS_VISIBILITY_ROLES/);
});

test('admin access writes use a verified server endpoint and RLS removes the broad update policy', () => {
  assert.match(apiSource, /await requireAdmin\(req, supabase\)/);
  assert.match(apiSource, /const BONUS_ROLES = new Set\(\['ceo', 'admin'\]\)/);
  assert.match(migrationSource, /DROP POLICY IF EXISTS "Allow authenticated users to update app_settings"/);
  assert.match(migrationSource, /employee\.role::text = 'admin'/);
});

test('restricted roles cannot infer bonus differences from filters or finance totals', () => {
  assert.match(commandCenterSource, /viewFilter === 'bonus_attention'[\s\S]{0,100}&& canSeeBonusSummary/);
  assert.match(workspaceSource, /canSeeBonuses \? `Итого расходы:[\s\S]{0,250}` : `Операционные расходы:/);
});
