import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __setSeafileAccessSupabaseFactoryForTests,
  assertCanAccessSeafileOwner,
} from '../api/_seafile-access.mjs';

function fakeSupabase({ employees = [], projects = [], projectTeam = [] } = {}) {
  const rowsByTable = {
    employees,
    projects,
    project_team: projectTeam,
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.ilikeFilters = [];
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    ilike(field, value) {
      this.ilikeFilters.push({ field, value });
      return this;
    }

    rows() {
      return (rowsByTable[this.table] || []).filter((row) => {
        const eqMatch = this.filters.every(({ field, value }) => String(row[field] || '') === String(value || ''));
        const ilikeMatch = this.ilikeFilters.every(({ field, value }) => {
          const expected = String(value || '').replace(/%/g, '').toLowerCase();
          return String(row[field] || '').toLowerCase() === expected;
        });
        return eqMatch && ilikeMatch;
      });
    }

    async maybeSingle() {
      return { data: this.rows()[0] || null, error: null };
    }

    async limit(count) {
      return { data: this.rows().slice(0, count), error: null };
    }
  }

  return {
    auth: {
      async getUser() {
        return { data: { user: null } };
      },
    },
    from(table) {
      return new Query(table);
    },
  };
}

function reqFor(user) {
  return {
    headers: {
      'x-user-id': user.id,
      'x-user-role': user.role,
      'x-user-name': encodeURIComponent(user.name || ''),
    },
  };
}

test.afterEach(() => {
  __setSeafileAccessSupabaseFactoryForTests(null);
});

test('project team member can read Seafile project files from notes.team', async () => {
  __setSeafileAccessSupabaseFactoryForTests(() => fakeSupabase({
    employees: [{ id: 'employee-1', email: 'e1@example.com', name: 'Employee One', role: 'employee', level: '1' }],
    projects: [{
      id: 'project-a',
      name: 'Project A',
      partner_id: null,
      manager_id: null,
      notes: JSON.stringify({
        team: [{ userId: 'employee-1', userName: 'Employee One', role: 'assistant_1' }],
      }),
    }],
  }));

  const result = await assertCanAccessSeafileOwner(
    reqFor({ id: 'employee-1', role: 'employee', name: 'Employee One' }),
    { projectId: 'project-a' },
    { mode: 'read' },
  );

  assert.equal(result.access, 'project');
  assert.equal(result.mode, 'read');
});

test('project team member cannot write Seafile project files', async () => {
  __setSeafileAccessSupabaseFactoryForTests(() => fakeSupabase({
    employees: [{ id: 'employee-1', email: 'e1@example.com', name: 'Employee One', role: 'employee', level: '1' }],
    projects: [{
      id: 'project-a',
      name: 'Project A',
      partner_id: null,
      manager_id: null,
      notes: JSON.stringify({
        team: [{ userId: 'employee-1', userName: 'Employee One', role: 'assistant_1' }],
      }),
    }],
  }));

  await assert.rejects(
    () => assertCanAccessSeafileOwner(
      reqFor({ id: 'employee-1', role: 'employee', name: 'Employee One' }),
      { projectId: 'project-a' },
      { mode: 'write' },
    ),
    (error) => error?.statusCode === 403 && /No permission/.test(error.message),
  );
});

test('procurement can write Seafile project files by role', async () => {
  __setSeafileAccessSupabaseFactoryForTests(() => fakeSupabase({
    employees: [{ id: 'proc-1', email: 'proc@example.com', name: 'Procurement User', role: 'procurement', level: '1' }],
    projects: [{ id: 'project-a', name: 'Project A', partner_id: null, manager_id: null, notes: '{}' }],
  }));

  const result = await assertCanAccessSeafileOwner(
    reqFor({ id: 'proc-1', role: 'procurement', name: 'Procurement User' }),
    { projectId: 'project-a' },
    { mode: 'write' },
  );

  assert.equal(result.access, 'role');
  assert.equal(result.mode, 'write');
});
