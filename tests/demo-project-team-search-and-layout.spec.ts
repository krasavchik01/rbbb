import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  DEMO_EMPLOYEE_IDS,
  DEMO_PROJECT_ID,
  demoProject,
  loginAsDemoRole,
  waitForDemoApp,
  type DemoNetworkJournal,
} from './helpers/demo-fixtures';

const ALT_PARTNER = {
  id: 'demo-partner-reserve',
  name: 'Резервный Партнёр',
  email: 'reserve.partner@demo.invalid',
  role: 'partner',
  level: '1',
  whatsapp: '+7 700 000 00 06',
  created_at: '2026-07-12T00:00:00.000Z',
  updated_at: '2026-07-12T00:00:00.000Z',
};

const DONOR_PROJECT_ID = 'demo-project-template-donor';
const EMPLOYEE_SEARCH_PLACEHOLDER = /Поиск по (?:имени|ФИО).*(?:почте|email).*роли/i;

function seedPartnerTemplate(network: DemoNetworkJournal) {
  network.tableRows.employees.push({ ...ALT_PARTNER });

  const donor = JSON.parse(JSON.stringify(demoProject)) as Record<string, any>;
  const notes = JSON.parse(String(donor.notes)) as Record<string, any>;
  const donorTeam = [
    {
      userId: ALT_PARTNER.id,
      userName: ALT_PARTNER.name,
      userEmail: ALT_PARTNER.email,
      role: 'partner',
      bonusPercent: 25,
    },
    {
      userId: DEMO_EMPLOYEE_IDS.procurement,
      userName: 'Демо Закупки',
      userEmail: 'procurement@demo.invalid',
      role: 'manager_1',
      bonusPercent: 10,
    },
    {
      userId: DEMO_EMPLOYEE_IDS.ceo,
      userName: 'Алия Генеральный директор',
      userEmail: 'ceo@demo.invalid',
      role: 'assistant_1',
      bonusPercent: 3,
    },
  ];

  notes.name = 'ТОО Донор шаблона — аудит 2025';
  notes.clientName = 'ТОО Донор шаблона';
  notes.description = 'Проект только для проверки явного шаблона команды';
  notes.contract = {
    ...notes.contract,
    number: 'DEMO-TEMPLATE-2025',
    subject: 'Аудит отдельного клиента',
  };
  notes.team = donorTeam;
  notes.teamIds = donorTeam.map((member) => member.userId);
  notes.auditPeriods = [{
    ...notes.auditPeriods[0],
    id: 'period-template-2025',
    name: 'Годовой аудит 2025',
    year: 2025,
    team: donorTeam,
  }];
  notes.finances = {
    ...notes.finances,
    teamBonuses: {},
  };

  donor.id = DONOR_PROJECT_ID;
  donor.name = notes.name;
  donor.description = notes.description;
  donor.partner_id = ALT_PARTNER.id;
  donor.manager_id = DEMO_EMPLOYEE_IDS.procurement;
  donor.start_date = '2025-01-10';
  donor.deadline = '2025-12-15';
  donor.notes = JSON.stringify(notes);
  network.tableRows.projects.push(donor);
}

function targetProjectPatches(network: DemoNetworkJournal) {
  return network.mutationRequests.filter((request) => {
    if (request.method !== 'PATCH' || !request.url.includes('/rest/v1/projects')) return false;
    return new URL(request.url).searchParams.get('id') === `eq.${DEMO_PROJECT_ID}`;
  });
}

function targetPatchNotes(network: DemoNetworkJournal) {
  const request = targetProjectPatches(network).at(-1);
  expect(request, 'expected the selected project to be patched').toBeTruthy();
  const payload = JSON.parse(request?.body || '{}') as Record<string, any>;
  return typeof payload.notes === 'string'
    ? JSON.parse(payload.notes) as Record<string, any>
    : payload.notes as Record<string, any>;
}

function memberIds(team: Array<Record<string, any>> | undefined) {
  return (team || []).map((member) => String(member.userId || member.user_id || member.id || ''));
}

function externallyUpdateDemoProject(
  network: DemoNetworkJournal,
  mutateNotes: (notes: Record<string, any>) => Record<string, any>,
) {
  const projectIndex = network.tableRows.projects.findIndex((candidate) => (
    String((candidate as Record<string, any>).id) === DEMO_PROJECT_ID
  ));
  expect(projectIndex).toBeGreaterThanOrEqual(0);
  const project = network.tableRows.projects[projectIndex] as Record<string, any>;
  const notes = JSON.parse(String(project.notes || '{}')) as Record<string, any>;
  network.tableRows.projects[projectIndex] = {
    ...project,
    notes: JSON.stringify(mutateNotes(notes)),
    updated_at: '2026-07-26T12:00:00.000Z',
  };
}

async function searchEmployee(page: Page, trigger: Locator, query: string, employeeName: string) {
  await trigger.click();
  const search = page.getByPlaceholder(EMPLOYEE_SEARCH_PLACEHOLDER).last();
  await expect(search).toBeVisible();
  await search.fill(query);
  const option = page.getByRole('option', { name: new RegExp(employeeName, 'i') }).last();
  await expect(option).toBeVisible();
  await option.click();
}

async function selectDemoProject(page: Page) {
  const checkbox = page.getByRole('checkbox', {
    name: `Выбрать проект ${demoProject.name}`,
    exact: true,
  });
  await expect(checkbox).toBeVisible();
  await checkbox.check();
  await expect(page.getByText('Выбрано записей: 1', { exact: true })).toBeVisible();
}

test.describe('project filters and explicit team assignment', () => {
  test('1500px summary keeps every primary filter labelled, readable and inside the viewport', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'ceo');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const filters = page.getByTestId('project-primary-filters');
    await expect(filters).toBeVisible();
    for (const label of [
      'Поиск',
      'Наша компания',
      'Партнёр',
      'Бизнес-сезон',
      'Дата с',
      'Дата по',
      'Состояние проекта',
      'Срок проекта',
      'Сортировка',
    ]) {
      await expect(filters.getByText(label, { exact: true })).toBeVisible();
    }
    for (const forbiddenLabel of [
      'Календарный период',
      'Наличие периодов',
      'Тип периода',
      'Вид Excel',
    ]) {
      await expect(filters.getByText(forbiddenLabel, { exact: true })).toHaveCount(0);
    }
    await expect(filters).not.toContainText(/audit period/i);

    const controls = filters.locator('input, button[role="combobox"]');
    expect(await controls.count()).toBeGreaterThanOrEqual(9);
    const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(180);
      expect(box.height).toBeGreaterThanOrEqual(36);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(1500);
    }

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      filters: (() => {
        const element = document.querySelector('[data-testid="project-primary-filters"]');
        return element ? element.scrollWidth - element.clientWidth : Number.POSITIVE_INFINITY;
      })(),
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.filters).toBeLessThanOrEqual(1);
    expect(network.productionMutations).toEqual([]);
  });

  test('320px bulk actions wrap without horizontal overflow after selecting a project', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    await selectDemoProject(page);

    const bulkActions = page.getByTestId('project-bulk-actions');
    await expect(bulkActions).toBeVisible();
    const overflow = await page.evaluate(() => {
      const bulk = document.querySelector('[data-testid="project-bulk-actions"]');
      return {
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bulk: bulk ? bulk.scrollWidth - bulk.clientWidth : Number.POSITIVE_INFINITY,
      };
    });
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.bulk).toBeLessThanOrEqual(1);

    for (const testId of ['bulk-partner-select', 'bulk-team-template-select', 'bulk-leader-select']) {
      const control = bulkActions.getByTestId(testId);
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.width || 0).toBeGreaterThanOrEqual(220);
      expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(320);
    }
    expect(network.productionMutations).toEqual([]);
  });

  test('partner search by email changes only the partner and preserves both existing teams', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    seedPartnerTemplate(network);
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    await selectDemoProject(page);

    await searchEmployee(page, page.getByTestId('bulk-partner-select'), ALT_PARTNER.email, ALT_PARTNER.name);
    await page.getByRole('button', { name: 'Назначить только партнёра', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(/состав будет сохранён.*команд/i);
    await dialog.getByRole('button', { name: 'Назначить 1', exact: true }).click();

    await expect.poll(() => targetProjectPatches(network).length).toBe(1);
    const notes = targetPatchNotes(network);
    const projectTeamIds = memberIds(notes.team);
    expect(projectTeamIds).toEqual(expect.arrayContaining([
      ALT_PARTNER.id,
      DEMO_EMPLOYEE_IDS.manager,
      DEMO_EMPLOYEE_IDS.assistant,
    ]));
    expect(projectTeamIds).not.toContain(DEMO_EMPLOYEE_IDS.partner);
    expect(projectTeamIds).not.toContain(DEMO_EMPLOYEE_IDS.procurement);
    expect(projectTeamIds).not.toContain(DEMO_EMPLOYEE_IDS.ceo);

    const periodTeamIds = memberIds(notes.auditPeriods?.[0]?.team);
    expect(periodTeamIds).toEqual(expect.arrayContaining([
      DEMO_EMPLOYEE_IDS.partner,
      DEMO_EMPLOYEE_IDS.manager,
      DEMO_EMPLOYEE_IDS.assistant,
    ]));
    expect(periodTeamIds).not.toContain(ALT_PARTNER.id);

    expect(network.productionMutations).toEqual([]);
  });

  test('leader search by role and project-member search by full name both assign the chosen employee', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    await selectDemoProject(page);

    await searchEmployee(page, page.getByTestId('bulk-leader-select'), 'procurement', 'Демо Закупки');
    await page.getByTestId('bulk-assign-leader').click();
    await page.getByTestId('confirm-bulk-leader').click();
    await expect.poll(() => targetProjectPatches(network).length).toBe(1);
    expect(memberIds(targetPatchNotes(network).team)).toContain(DEMO_EMPLOYEE_IDS.procurement);

    const projectRow = page.getByTestId('project-summary-shell').locator(`tr[data-project-id="${DEMO_PROJECT_ID}"]`);
    await searchEmployee(
      page,
      projectRow.getByRole('button', {
        name: new RegExp(`Добавить (?:участника проекта|сотрудника в команду проекта) ${demoProject.name}`),
      }),
      'Алия Генеральный директор',
      'Алия Генеральный директор',
    );

    await expect.poll(() => targetProjectPatches(network).length).toBe(2);
    const notes = targetPatchNotes(network);
    const addedMember = notes.team?.find((member: Record<string, any>) => (
      String(member.userId || member.id) === DEMO_EMPLOYEE_IDS.ceo
    ));
    expect(addedMember).toBeTruthy();
    expect(network.productionMutations).toEqual([]);
  });

  test('a saved partner team replaces the project team only through the explicit template action', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    seedPartnerTemplate(network);
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);
    await selectDemoProject(page);

    await page.getByTestId('bulk-team-template-select').click();
    await page.getByRole('option', { name: new RegExp(`Команда партнёра: ${ALT_PARTNER.name}`) }).click();
    await page.getByTestId('bulk-assign-team').click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(/заменит единый состав/i);
    await dialog.getByTestId('confirm-bulk-team').click();

    await expect.poll(() => targetProjectPatches(network).length).toBe(1);
    const notes = targetPatchNotes(network);
    expect(memberIds(notes.team)).toEqual([
      ALT_PARTNER.id,
      DEMO_EMPLOYEE_IDS.procurement,
      DEMO_EMPLOYEE_IDS.ceo,
    ]);
    expect(memberIds(notes.auditPeriods?.[0]?.team)).toEqual(expect.arrayContaining([
      DEMO_EMPLOYEE_IDS.partner,
      DEMO_EMPLOYEE_IDS.manager,
      DEMO_EMPLOYEE_IDS.assistant,
    ]));
    expect(network.productionMutations).toEqual([]);
  });

  test('status change preserves a team, period, finances and files saved after the screen loaded', async ({ page }) => {
    const network = await loginAsDemoRole(page, 'deputy_director');
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.goto('/projects');
    await waitForDemoApp(page);

    const externalMember = {
      userId: DEMO_EMPLOYEE_IDS.procurement,
      userName: 'Демо Закупки',
      userEmail: 'procurement@demo.invalid',
      role: 'supervisor_3',
      bonusPercent: 7,
    };
    externallyUpdateDemoProject(network, (notes) => ({
      ...notes,
      ourCompany: 'ТОО МАК — свежее назначение',
      team: [...(notes.team || []), externalMember],
      auditPeriods: (notes.auditPeriods || []).map((period: Record<string, any>, index: number) => (
        index === 0 ? { ...period, team: [...(period.team || []), externalMember] } : period
      )),
      finances: {
        ...(notes.finances || {}),
        bonusPoolOverrideAmount: 777_777,
        bonusPoolManuallyAdjusted: true,
      },
      files: [...(notes.files || []), { id: 'external-file', name: 'Свежий файл.pdf' }],
    }));

    const status = page.getByRole('combobox', { name: `Изменить статус проекта ${demoProject.name}` });
    await expect(status).toBeVisible();
    await status.click();
    await page.getByRole('option', { name: 'Планирование', exact: true }).click();

    await expect.poll(() => targetProjectPatches(network).length).toBe(1);
    const notes = targetPatchNotes(network);
    expect(notes.status).toBe('planning');
    expect(notes.ourCompany).toBe('ТОО МАК — свежее назначение');
    expect(memberIds(notes.team)).toContain(DEMO_EMPLOYEE_IDS.procurement);
    expect(memberIds(notes.auditPeriods?.[0]?.team)).toContain(DEMO_EMPLOYEE_IDS.procurement);
    expect(notes.finances).toMatchObject({
      bonusPoolOverrideAmount: 777_777,
      bonusPoolManuallyAdjusted: true,
    });
    expect(notes.files).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'external-file' })]));
    expect(network.productionMutations).toEqual([]);
  });

});
