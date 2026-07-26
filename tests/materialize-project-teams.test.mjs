import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectPlanBlockers,
  projectPlan,
} from '../scripts/materialize-project-teams.mjs';

const RUN_AT = '2026-07-27T00:00:00.000Z';

function makeProject(id, notes) {
  return {
    id,
    name: `Project ${id}`,
    notes,
    updated_at: '2026-07-26T00:00:00.000Z',
  };
}

test('materializes historical aliases into the canonical camelCase member shape', () => {
  const finances = {
    teamBonuses: {
      employee_1: { amount: 125_000, percent: 12.5 },
    },
  };
  const plan = projectPlan(makeProject('aliases', {
    finances,
    auditPeriods: [{
      id: 'period-1',
      team: [{
        employee_id: 'employee_1',
        full_name: 'Иван Иванов',
        role_on_project: 'manager_1',
        bonusPercent: 12.5,
      }],
    }],
  }), RUN_AT);

  assert.equal(plan.change, true);
  assert.equal(plan.invalidMembers.length, 0);
  assert.deepEqual(plan.nextNotes.team, [{
    userId: 'employee_1',
    userName: 'Иван Иванов',
    role: 'manager_1',
    bonusPercent: 12.5,
  }]);
  assert.deepEqual(plan.nextNotes.finances, finances);
  assert.deepEqual(plan.nextNotes.auditPeriods, plan.originalNotes.auditPeriods);
});

test('reconciles one name-only duplicate to the unique id and deduplicates it exactly', () => {
  const plan = projectPlan(makeProject('reconciled', {
    team: [{ userId: 'employee_1', userName: 'Иван Иванов', role: 'partner' }],
    auditPeriods: [{
      id: 'period-1',
      team: [{ user_name: 'иван  иванов', project_role: 'partner' }],
    }],
  }), RUN_AT);

  assert.equal(plan.nextNotes.team.length, 1);
  assert.deepEqual(plan.nextNotes.team[0], {
    userId: 'employee_1',
    userName: 'Иван Иванов',
    role: 'partner',
  });
  assert.equal(plan.reconciledMembers.length, 1);
  assert.equal(plan.duplicates.length, 1);
  assert.equal(plan.duplicates[0].differs, false);
  assert.equal(collectPlanBlockers([plan], [plan]).blockerCount, 0);
});

test('does not guess when a name-only member matches more than one employee id', () => {
  const plan = projectPlan(makeProject('ambiguous-name', {
    team: [
      { userId: 'employee_1', userName: 'Алексей Иванов', role: 'partner' },
      { userId: 'employee_2', userName: 'Алексей Иванов', role: 'manager_1' },
    ],
    auditPeriods: [{
      id: 'period-1',
      team: [{ userName: 'Алексей Иванов', role: 'assistant_1' }],
    }],
  }), RUN_AT);

  assert.ok(plan.invalidMembers.some((issue) => issue.kind === 'team_member_ambiguous_name'));
  assert.ok(collectPlanBlockers([plan], [plan]).blockerCount > 0);
});

test('blocks unresolved members without an id and members without an explicit project role', () => {
  const plan = projectPlan(makeProject('invalid-members', {
    team: [
      { userName: 'Нет идентификатора', role: 'assistant_1' },
      { userId: 'employee_2', userName: 'Нет роли' },
    ],
  }), RUN_AT);

  const kinds = new Set(plan.invalidMembers.map((issue) => issue.kind));
  assert.equal(kinds.has('team_member_without_id'), true);
  assert.equal(kinds.has('team_member_without_role'), true);
  assert.equal(collectPlanBlockers([plan], [plan]).changingInvalidMembers.length, 2);
});

test('blocks differing duplicate records instead of silently keeping the first period', () => {
  const plan = projectPlan(makeProject('conflicting-duplicate', {
    team: [{
      userId: 'employee_1',
      userName: 'Иван Иванов',
      role: 'partner',
      bonusPercent: 10,
    }],
    auditPeriods: [{
      id: 'period-1',
      team: [{
        employee_id: 'employee_1',
        employee_name: 'Иван Иванов',
        role_on_project: 'partner',
        bonusPercent: 15,
      }],
    }],
  }), RUN_AT);

  assert.equal(plan.conflictingDuplicates.length, 1);
  assert.equal(plan.conflictingDuplicates[0].differs, true);
  assert.equal(collectPlanBlockers([plan], [plan]).changingConflictingDuplicates.length, 1);
});

test('keeps canonical projects immutable but blocks archived-only participants', () => {
  const plan = projectPlan(makeProject('canonical-with-archive', {
    teamSource: 'canonical',
    teamUnifiedAt: '2026-07-20T00:00:00.000Z',
    team: [{ userId: 'employee_1', userName: 'Основной участник', role: 'partner' }],
    auditPeriods: [{
      id: 'period-1',
      team: [{ userId: 'employee_2', userName: 'Только в архиве', role: 'assistant_1' }],
    }],
  }), RUN_AT);

  assert.equal(plan.change, false);
  assert.equal('nextNotes' in plan, false);
  assert.equal(plan.source.archivedOnlyCount, 1);
  assert.equal(collectPlanBlockers([plan], []).canonicalArchivedOnly.length, 1);
});

test('all 528 already-canonical projects remain idempotent no-ops', () => {
  const plans = Array.from({ length: 528 }, (_, index) => {
    const employeeId = `employee_${index + 1}`;
    const member = {
      userId: employeeId,
      userName: `Сотрудник ${index + 1}`,
      role: 'assistant_1',
    };
    return projectPlan(makeProject(`canonical_${index + 1}`, {
      teamSource: 'canonical',
      teamUnifiedAt: '2026-07-20T00:00:00.000Z',
      team: [member],
      auditPeriods: [{ id: 'archive', team: [{ ...member }] }],
    }), RUN_AT);
  });

  assert.equal(plans.length, 528);
  assert.equal(plans.every((plan) => plan.change === false && !('nextNotes' in plan)), true);
  assert.equal(collectPlanBlockers(plans, []).blockerCount, 0);
});
