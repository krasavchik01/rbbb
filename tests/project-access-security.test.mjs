import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getRequestUser, requireAdmin } from '../api/_email-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const accessSource = read('src/lib/projectAccessControl.ts');
const commandCenterSource = read('src/pages/ProjectCommandCenter.tsx');
const inlineDetailSource = read('src/components/projects/ProjectInlineDetail.tsx');
const workspaceSource = read('src/pages/ProjectWorkspace.tsx');
const apiSource = read('api/project-access-settings.mjs');
const migrationSource = read('supabase/migrations/20260726000000_restrict_app_settings_updates_to_admin.sql');

test('bonus visibility is hard-limited to CEO and admin even if settings are tampered with', () => {
  assert.match(accessSource, /BONUS_VISIBILITY_ROLES[^=]*= \['ceo', 'admin'\]/);
  assert.match(accessSource, /section === 'bonuses' && !BONUS_VISIBILITY_ROLES\.includes\(role\)\) return false/);
  assert.match(accessSource, /source\.bonuses[\s\S]{0,180}BONUS_VISIBILITY_ROLES/);
});

test('admin access writes use a verified server endpoint and RLS removes the broad update policy', () => {
  assert.match(apiSource, /await requireAdmin\(req, supabase, \{ jwtOnly: true \}\)/);
  assert.match(apiSource, /const BONUS_ROLES = new Set\(\['ceo', 'admin'\]\)/);
  assert.match(migrationSource, /DROP POLICY IF EXISTS "Allow authenticated users to update app_settings"/);
  assert.match(migrationSource, /employee\.role::text = 'admin'/);
});

function authSupabase({ authUser = null, employee = null } = {}) {
  return {
    auth: {
      async getUser() {
        return { data: { user: authUser } };
      },
    },
    from(table) {
      assert.equal(table, 'employees');
      return {
        select() { return this; },
        ilike() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: employee }; },
      };
    },
  };
}

test('self-editable auth metadata cannot grant a privileged role without an employee row', async () => {
  const supabase = authSupabase({
    authUser: {
      id: 'auth-only',
      email: 'auth-only@example.invalid',
      app_metadata: { role: 'admin', level: '3' },
      user_metadata: { role: 'admin', level: '3' },
    },
  });

  const user = await getRequestUser(
    { headers: { authorization: 'Bearer valid-token' } },
    supabase,
  );

  assert.equal(user.authMethod, 'jwt');
  assert.equal(user.role, '');
  assert.equal(user.level, null);
});

test('project access mutation rejects a spoofable legacy admin header but accepts a JWT employee admin', async () => {
  const employee = {
    id: 'admin-id',
    email: 'admin@example.invalid',
    role: 'admin',
    level: '1',
  };

  await assert.rejects(
    requireAdmin(
      { headers: { 'x-suite-user-id': 'admin-id' } },
      authSupabase({ employee }),
      { jwtOnly: true },
    ),
    (error) => error.statusCode === 401,
  );

  const legacyUser = await requireAdmin(
    { headers: { 'x-suite-user-id': 'admin-id' } },
    authSupabase({ employee }),
  );
  assert.equal(legacyUser.authMethod, 'legacy_header');

  const user = await requireAdmin(
    { headers: { authorization: 'Bearer valid-token' } },
    authSupabase({
      authUser: { id: 'auth-admin', email: 'admin@example.invalid' },
      employee,
    }),
    { jwtOnly: true },
  );
  assert.equal(user.role, 'admin');
  assert.equal(user.authMethod, 'jwt');
});

test('restricted roles cannot infer bonus differences from filters or finance totals', () => {
  assert.doesNotMatch(commandCenterSource, /<SelectItem value="bonus_attention"/);
  assert.doesNotMatch(commandCenterSource, /viewFilter === 'bonus_attention'/);
  assert.match(commandCenterSource, /!canSeeBonuses \|\| numberColumnMatches\(bonusValue, filters\.bonus\)/);
  assert.match(commandCenterSource, /canSeeBonuses: canSeeBonusSummary/);
  assert.match(workspaceSource, /canSeeBonuses \? `Итого расходы:[\s\S]{0,250}` : `Операционные расходы:/);
});

test('team and hours visibility also gates table columns, search and filters', () => {
  assert.match(commandCenterSource, /const coverageTeamText = canSeeTeam/);
  assert.match(commandCenterSource, /canSeeTeam && <ProjectFilterField label=/);
  assert.match(commandCenterSource, /canSeeTeam && <TableHead className="min-w-\[230px\]">/);
  assert.match(commandCenterSource, /canSeeHours && <TableHead className="min-w-\[150px\]">/);
  assert.match(commandCenterSource, /!canSeeTeam \|\| textColumnMatches\(partnerText/);
  assert.match(commandCenterSource, /!canSeeHours \|\| numberColumnMatches\(hourValue/);
});

test('employee bonuses remain visible independently from the ordinary team section', () => {
  assert.match(inlineDetailSource, /showBonuses && bonuses \?/);
  assert.match(inlineDetailSource, /bonusEmployees=\{bonuses\.employees\}/);
  assert.match(inlineDetailSource, /showTeam && <TeamMemberLedger/);
});
