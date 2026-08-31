import type { Page, Route } from '@playwright/test';
import type { UserRole } from '../../src/types/roles';

export const DEMO_PROJECT_ID = 'demo-project-001';
export const DEMO_EMPLOYEE_IDS = {
  ceo: 'demo-ceo',
  partner: 'demo-partner',
  manager: 'demo-manager',
  assistant: 'demo-assistant',
  procurement: 'demo-procurement',
};

const now = '2026-07-12T00:00:00.000Z';

export const demoEmployees = [
  { id: DEMO_EMPLOYEE_IDS.ceo, name: 'Алия Генеральный директор', email: 'ceo@demo.invalid', role: 'ceo', level: '1', whatsapp: '+7 700 000 00 01', created_at: now, updated_at: now },
  { id: DEMO_EMPLOYEE_IDS.partner, name: 'Демо Партнёр', email: 'partner@demo.invalid', role: 'partner', level: '1', whatsapp: '+7 700 000 00 02', created_at: now, updated_at: now },
  { id: DEMO_EMPLOYEE_IDS.manager, name: 'Демо Менеджер', email: 'manager@demo.invalid', role: 'manager', level: '1', whatsapp: '+7 700 000 00 03', created_at: now, updated_at: now },
  { id: DEMO_EMPLOYEE_IDS.assistant, name: 'Демо Ассистент', email: 'assistant@demo.invalid', role: 'assistant', level: '1', whatsapp: '+7 700 000 00 04', created_at: now, updated_at: now },
  { id: DEMO_EMPLOYEE_IDS.procurement, name: 'Демо Закупки', email: 'procurement@demo.invalid', role: 'procurement', level: '1', whatsapp: '+7 700 000 00 05', created_at: now, updated_at: now },
];

const demoTeam = [
  { userId: DEMO_EMPLOYEE_IDS.partner, userName: 'Демо Партнёр', role: 'partner', bonusPercent: 25 },
  { userId: DEMO_EMPLOYEE_IDS.manager, userName: 'Демо Менеджер', role: 'manager_1', bonusPercent: 10 },
  { userId: DEMO_EMPLOYEE_IDS.assistant, userName: 'Демо Ассистент', role: 'assistant_1', bonusPercent: 3 },
];

export const demoProjectNotes = {
  name: 'АО Демонстрационный клиент — аудит 2026',
  clientName: 'АО Демонстрационный клиент',
  companyName: 'RBI Audit Kazakhstan',
  ourCompany: 'RBI Audit Kazakhstan',
  status: 'В работе',
  type: 'financial_audit',
  description: 'Аудит финансовой отчётности за 2026 год',
  contract: {
    number: 'DEMO-2026-001',
    date: '2026-01-15',
    subject: 'Аудит финансовой отчётности',
    serviceStartDate: '2026-01-15',
    serviceEndDate: '2026-12-20',
    currency: 'KZT',
    amountWithoutVAT: 48_000_000,
    amountWithVAT: 53_760_000,
  },
  amountWithoutVAT: 48_000_000,
  amountWithVAT: 53_760_000,
  currency: 'KZT',
  start_date: '2026-01-15',
  deadline: '2026-12-20',
  completionPercent: 62,
  team: demoTeam,
  teamIds: demoTeam.map((member) => member.userId),
  auditPeriods: [{
    id: 'period-2026',
    name: 'Годовой аудит 2026',
    type: 'year',
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    deadline: '2026-12-20',
    status: 'in_progress',
    createdBy: 'demo-procurement',
    createdAt: '2026-01-15',
    updatedAt: '2026-01-15',
    team: demoTeam,
  }],
  stages: [{ id: 'stage-2026', name: 'Годовой аудит', auditPeriodId: 'period-2026', amountWithoutVAT: 48_000_000, amountWithVAT: 53_760_000 }],
  finances: {
    amountWithoutVAT: 48_000_000,
    preExpensePercent: 30,
    bonusPercent: 10,
    teamBonuses: {
      [DEMO_EMPLOYEE_IDS.partner]: { amount: 840_000, percent: 25, role: 'partner' },
      [DEMO_EMPLOYEE_IDS.manager]: { amount: 336_000, percent: 10, role: 'manager_1' },
      [DEMO_EMPLOYEE_IDS.assistant]: { amount: 100_800, percent: 3, role: 'assistant_1' },
    },
  },
  tasks: [
    { id: 'demo-task-1', title: 'Планирование аудита', status: 'done' },
    { id: 'demo-task-2', title: 'Полевые процедуры', status: 'in_progress' },
  ],
  files: [{
    id: 'demo-file-1',
    name: 'Договор_DEMO-2026-001.pdf',
    size: 248_320,
    type: 'application/pdf',
    storagePath: `/${DEMO_PROJECT_ID}/Договор_DEMO-2026-001.pdf`,
    uploadedAt: '2026-01-15T08:30:00.000Z',
    uploadedBy: DEMO_EMPLOYEE_IDS.procurement,
    source: 'seafile',
  }],
};

export const demoProject = {
  id: DEMO_PROJECT_ID,
  name: demoProjectNotes.name,
  description: demoProjectNotes.description,
  status: 'active',
  partner_id: DEMO_EMPLOYEE_IDS.partner,
  manager_id: DEMO_EMPLOYEE_IDS.manager,
  company_id: 'demo-company-1',
  project_type: 'financial_audit',
  start_date: '2026-01-15',
  deadline: '2026-12-20',
  kpi_percentage: 62,
  notes: JSON.stringify(demoProjectNotes),
  created_at: '2026-01-15T08:00:00.000Z',
  updated_at: now,
};

export const demoTimesheets = [
  { id: 'ts-approved-1', employee_id: DEMO_EMPLOYEE_IDS.assistant, employee_name: 'Демо Ассистент', project_id: DEMO_PROJECT_ID, project_name: demoProject.name, work_date: '2026-06-10', hours: 8, status: 'approved', notes: 'Аудиторские процедуры', position: 'Ассистент 1', section: 'Аудит', source: 'demo', created_at: now, updated_at: now },
  { id: 'ts-approved-2', employee_id: DEMO_EMPLOYEE_IDS.manager, employee_name: 'Демо Менеджер', project_id: DEMO_PROJECT_ID, project_name: demoProject.name, work_date: '2026-06-10', hours: 6, status: 'approved', notes: 'Ревью рабочих документов', position: 'Менеджер 1', section: 'Аудит', source: 'demo', created_at: now, updated_at: now },
  { id: 'ts-submitted-1', employee_id: DEMO_EMPLOYEE_IDS.assistant, employee_name: 'Демо Ассистент', project_id: DEMO_PROJECT_ID, project_name: demoProject.name, work_date: '2026-06-11', hours: 4, status: 'submitted', notes: 'Подготовка выборки', position: 'Ассистент 1', section: 'Аудит', source: 'demo', created_at: now, updated_at: now },
];

const demoTasks = [
  { id: 'demo-task-1', title: 'Планирование аудита', description: 'Подготовить общий план', status: 'done', priority: 'high', project_id: DEMO_PROJECT_ID, assignees: [DEMO_EMPLOYEE_IDS.manager], reporter: DEMO_EMPLOYEE_IDS.partner, due_at: '2026-03-01', created_at: now, updated_at: now },
  { id: 'demo-task-2', title: 'Полевые процедуры', description: 'Завершить тестирование', status: 'in_progress', priority: 'medium', project_id: DEMO_PROJECT_ID, assignees: [DEMO_EMPLOYEE_IDS.assistant], reporter: DEMO_EMPLOYEE_IDS.manager, due_at: '2026-09-30', created_at: now, updated_at: now },
];

export const demoFiles = [{
  id: 'demo-file-1',
  name: 'Договор_DEMO-2026-001.pdf',
  type: 'file',
  size: 248_320,
  mtime: 1_768_457_400,
  path: `/${DEMO_PROJECT_ID}/Договор_DEMO-2026-001.pdf`,
  storagePath: `/${DEMO_PROJECT_ID}/Договор_DEMO-2026-001.pdf`,
  source: 'seafile',
}];

type RequestEntry = { method: string; url: string; body: string | null };

export type DemoNetworkJournal = {
  requests: RequestEntry[];
  mutationRequests: RequestEntry[];
  productionMutations: RequestEntry[];
  unhandledRequests: RequestEntry[];
  blockedExternalAssets: RequestEntry[];
  unknownTables: string[];
  tableRows: Record<string, unknown[]>;
};

const baseTableRows: Record<string, unknown[]> = {
  projects: [demoProject],
  employees: demoEmployees,
  timesheet_entries: demoTimesheets,
  tasks: demoTasks,
  notifications: [{ id: 'demo-notification-1', user_id: DEMO_EMPLOYEE_IDS.ceo, title: 'Проект требует внимания', message: demoProject.name, type: 'project', read: false, action_url: `/project/${DEMO_PROJECT_ID}`, created_at: now }],
  attendance: [{ id: 'demo-attendance-1', employee_id: DEMO_EMPLOYEE_IDS.assistant, date: '2026-07-11', check_in: '2026-07-11T09:00:00.000Z', check_out: '2026-07-11T18:00:00.000Z', status: 'present', created_at: now, updated_at: now }],
  bonuses: [],
  companies: [{ id: 'demo-company-1', name: 'RBI Audit Kazakhstan', active: true, brand_color: '#0B6B75', created_at: now, updated_at: now }],
  app_settings: [{ id: 'default', show_demo_users: false, office_location_enabled: false, office_latitude: null, office_longitude: null, office_radius_meters: null, office_address: 'Алматы', maintenance_mode: false, maintenance_message: '', recent_activity_enabled: true, recent_activity_visible_roles: ['ceo', 'admin'], companies: [], created_at: now, updated_at: now }],
  tenders: [],
  work_paper_templates: [],
  project_files: [],
  project_amendments: [],
  project_data: [],
  user_preferences: [],
  smtp_settings: [],
  roles: [],
  user_roles: [],
  check_ins: [],
};

function cloneTableRows(): Record<string, unknown[]> {
  return JSON.parse(JSON.stringify(baseTableRows)) as Record<string, unknown[]>;
}

function entryFor(route: Route): RequestEntry {
  const request = route.request();
  return { method: request.method(), url: request.url(), body: request.postData() };
}

function tableFromUrl(url: URL): string {
  const marker = '/rest/v1/';
  const index = url.pathname.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length).split('/')[0]) : '';
}

function rowMatchesUrl(candidate: unknown, url: URL): boolean {
  const row = candidate as Record<string, unknown>;
  for (const [key, rawValue] of url.searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
    if (rawValue.startsWith('eq.')) {
      const expected = rawValue.slice(3);
      if (String(row[key] ?? '') !== expected) return false;
    }
    if (rawValue.startsWith('in.(')) {
      const values = rawValue.slice(4, -1).split(',');
      if (!values.includes(String(row[key] ?? ''))) return false;
    }
  }
  return true;
}

function filterRows(rows: unknown[], url: URL): unknown[] {
  return rows.filter((candidate) => rowMatchesUrl(candidate, url));
}

async function fulfillSupabase(
  route: Route,
  journal: DemoNetworkJournal,
  tableRows: Record<string, unknown[]>,
) {
  const requestEntry = entryFor(route);
  journal.requests.push(requestEntry);
  const request = route.request();
  const method = request.method().toUpperCase();
  const url = new URL(request.url());

  if (url.pathname.includes('/auth/v1/user')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null }) });
    return;
  }

  const table = tableFromUrl(url);
  if (!table) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    return;
  }

  if (!(table in tableRows) && !journal.unknownTables.includes(table)) journal.unknownTables.push(table);
  const sourceRows = tableRows[table] || [];
  const rows = filterRows(sourceRows, url);

  if (!['GET', 'HEAD'].includes(method)) {
    journal.mutationRequests.push(requestEntry);
    const body = request.postDataJSON?.() as Record<string, unknown> | undefined;
    let responseRows: unknown[] = [];

    if (method === 'PATCH' || method === 'PUT') {
      const patch = body || {};
      responseRows = sourceRows
        .filter((row) => rowMatchesUrl(row, url))
        .map((row) => ({ ...(row as Record<string, unknown>), ...patch }));
      tableRows[table] = sourceRows.map((row) => (
        rowMatchesUrl(row, url)
          ? { ...(row as Record<string, unknown>), ...patch }
          : row
      ));
    } else if (method === 'POST') {
      const candidates = Array.isArray(body) ? body : [body || {}];
      responseRows = candidates.map((candidate, index) => ({
        id: (candidate as Record<string, unknown>).id || `mock-${table}-mutation-${Date.now()}-${index}`,
        ...(candidate as Record<string, unknown>),
      }));
      tableRows[table] = [...sourceRows, ...responseRows];
    } else if (method === 'DELETE') {
      tableRows[table] = sourceRows.filter((row) => !rowMatchesUrl(row, url));
    }

    await route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(0, responseRows.length - 1)}/${responseRows.length}` },
      body: JSON.stringify(responseRows),
    });
    return;
  }

  const accept = request.headers()['accept'] || '';
  const wantsObject = accept.includes('application/vnd.pgrst.object+json');
  const limit = Number(url.searchParams.get('limit')) || rows.length;
  const selected = rows.slice(0, limit);
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': selected.length ? `0-${selected.length - 1}/${rows.length}` : '*/0' },
    body: method === 'HEAD' ? '' : JSON.stringify(wantsObject ? (selected[0] || null) : selected),
  });
}

async function fulfillApplicationApi(route: Route, journal: DemoNetworkJournal) {
  const requestEntry = entryFor(route);
  journal.requests.push(requestEntry);
  const request = route.request();
  const method = request.method().toUpperCase();
  const url = new URL(request.url());
  if (!['GET', 'HEAD'].includes(method)) journal.mutationRequests.push(requestEntry);

  if (url.pathname.includes('/api/project-access-settings') && method === 'POST') {
    const body = request.postDataJSON() as { projectAccess?: Record<string, string[]> };
    const settingsRow = (journal.tableRows.app_settings[0] || {}) as Record<string, unknown>;
    const rawCompanies = settingsRow.companies;
    const envelope = rawCompanies && typeof rawCompanies === 'object' && !Array.isArray(rawCompanies)
      ? { ...(rawCompanies as Record<string, unknown>) }
      : { companies: Array.isArray(rawCompanies) ? rawCompanies : [] };
    const projectAccess = body.projectAccess || {};
    journal.tableRows.app_settings[0] = {
      ...settingsRow,
      companies: { ...envelope, __suiteASettings: 1, projectAccess },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, projectAccess }),
    });
    return;
  }

  if (url.pathname.includes('/api/1c/sync')) {
    if (url.searchParams.get('resource') === 'inbox') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          records: [{
            id: '10000000-0000-4000-8000-000000000001',
            source: '1С Бухгалтерия RB',
            kind: 'invoice',
            external_id: 'invoice-demo-77',
            normalized_record: {
              kind: 'invoice', externalId: 'invoice-demo-77', number: 'СЧ-77',
              date: '2026-08-20', amount: 1_250_000, currency: 'KZT',
              contractNumber: '24/10-49', organizationName: 'RBI Audit Kazakhstan',
              organizationBin: '123456789012', counterpartyName: 'АО Демонстрационный клиент',
              counterpartyBin: '210987654321',
            },
            match_status: 'unmatched',
            match_reason: 'contract_not_found',
            match_candidates: [DEMO_PROJECT_ID],
            auto_scope: 'project',
            manual_scope: null,
          }],
          nextCursor: null,
          hasMore: false,
          truncated: false,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        status: {
          configured: true,
          pullEnabled: true,
          pushEnabled: true,
          mode: 'pull_and_push',
          lastSyncAt: '2026-08-18T09:30:00.000Z',
          lastSuccessAt: '2026-08-18T09:30:00.000Z',
          lastErrorAt: null,
          lastError: '',
          source: '1С Бухгалтерия RB',
          received: 24,
          matched: 23,
          unmatchedCount: 1,
          unmatchedSummary: { 'invoice:contract_not_found': 1 },
          updatedProjects: 12,
          unmatched: [],
          history: [],
        },
      }),
    });
    return;
  }

  if (url.pathname.includes('/api/seafile/list')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: demoFiles }) });
    return;
  }
  if (url.pathname.includes('/api/seafile/download-url')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://download.demo.invalid/contract.pdf' }) });
    return;
  }
  if (url.pathname.includes('/api/files/')) {
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: 'demo file' });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [], projects: [demoProject], tasks: demoTasks, entries: [] }),
  });
}

export async function installDemoNetwork(page: Page): Promise<DemoNetworkJournal> {
  // Every browser page receives its own mutable database snapshot. This keeps
  // PATCH persistence realistic across reloads without leaking state between
  // Playwright tests, which run fully in parallel.
  const tableRows = cloneTableRows();
  const journal: DemoNetworkJournal = {
    requests: [],
    mutationRequests: [],
    productionMutations: [],
    unhandledRequests: [],
    blockedExternalAssets: [],
    unknownTables: [],
    tableRows,
  };

  await page.route('**/*', async (route) => {
    const requestEntry = entryFor(route);
    const url = new URL(requestEntry.url);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      await route.continue();
      return;
    }
    if (['GET', 'HEAD'].includes(requestEntry.method.toUpperCase())) {
      journal.blockedExternalAssets.push(requestEntry);
      const contentType = url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css';
      await route.fulfill({ status: 200, contentType, body: '' });
      return;
    }
    journal.unhandledRequests.push(requestEntry);
    if (!['GET', 'HEAD'].includes(requestEntry.method.toUpperCase())) {
      journal.productionMutations.push(requestEntry);
    }
    await route.abort('blockedbyclient');
  });

  await page.route('**://*.supabase.co/**', route => fulfillSupabase(route, journal, tableRows));
  await page.route('**/api/**', route => fulfillApplicationApi(route, journal));
  return journal;
}

export async function loginAsDemoRole(page: Page, role: UserRole) {
  const journal = await installDemoNetwork(page);
  await page.goto('/');
  const roleEmployeeIds: Partial<Record<UserRole, string>> = {
    ceo: DEMO_EMPLOYEE_IDS.ceo,
    partner: DEMO_EMPLOYEE_IDS.partner,
    manager_1: DEMO_EMPLOYEE_IDS.manager,
    assistant_1: DEMO_EMPLOYEE_IDS.assistant,
    procurement: DEMO_EMPLOYEE_IDS.procurement,
  };
  await page.evaluate(({ currentRole, employeeId }) => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({
      id: employeeId,
      email: `${currentRole}@demo.invalid`,
      name: `Демо ${currentRole}`,
      role: currentRole,
      department: 'Демонстрация',
      position: currentRole,
    }));
  }, { currentRole: role, employeeId: roleEmployeeIds[role] || `demo-${role}` });
  return journal;
}

export async function waitForDemoApp(page: Page) {
  await page.waitForFunction(
    () => document.body.innerText.trim() !== 'Загрузка...',
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(100);
}
