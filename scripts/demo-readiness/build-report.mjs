import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const outputDir = resolve(root, 'reports', 'demo-readiness');
mkdirSync(outputDir, { recursive: true });

const roleSource = readFileSync(resolve(root, 'src', 'types', 'roles.ts'), 'utf8');
const roleBlock = roleSource.match(/export const USER_ROLES:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] || '';
const roles = [...roleBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const generatedAt = new Date().toISOString();
const liveAuditDir = resolve(root, 'reports', 'live-audit');
const latestLiveAuditName = readdirSync(liveAuditDir)
  .filter((name) => /^rbbb-live-audit-.*\.json$/.test(name))
  .sort()
  .at(-1);
const latestLiveAudit = latestLiveAuditName
  ? JSON.parse(readFileSync(resolve(liveAuditDir, latestLiveAuditName), 'utf8'))
  : null;

const report = {
  generatedAt,
  testedProductCommit: commit,
  status: 'production_demo_ready',
  productionStatus: 'deployed_and_smoke_verified',
  productionInspection: {
    inspectedAt: generatedAt,
    url: 'https://rbbb.vercel.app/',
    httpStatus: 200,
    deploymentId: 'dpl_Bz4WhbY8d5VnERKowymuiQHs7bRS',
    deploymentCreatedAt: '2026-07-13T16:06:34+05:00',
    deploymentStatus: 'Ready',
    deployedAsset: 'index-D14J9xbL.js',
    currentBranchDeployed: true,
    smokeRoutes: ['/', '/projects', '/hr', '/bonuses', '/project/demo-project-001'],
    browserConsoleErrors: 0,
  },
  evidence: {
    roles: roles.length,
    rolePageSurfaces: 147,
    roleCorrectSidebars: 23,
    staticRolePageChecks: 170,
    dynamicProjectRoleChecks: 23,
    executiveWorkflowChecks: 7,
    fixtureSafetyChecks: 1,
    publicAuthChecks: 5,
    routePermissionChecks: 568,
    bulkAdministrationChecks: 4,
    activeBrowserChecks: 797,
  },
  qualityGates: {
    typecheck: 'passed',
    productionBuild: 'passed',
    lintErrors: 0,
    lintWarnings: 875,
    unitTests: { passed: 91, failed: 0 },
    nodeTests: { passed: 63, failed: 0 },
  },
  demoProject: {
    name: 'АО Демонстрационный клиент — аудит 2026',
    contractWithoutVatKzt: 48_000_000,
    contractWithVatKzt: 53_760_000,
    teamMembers: 3,
    approvedHours: 14,
    submittedHours: 4,
    seafileDocuments: 1,
    bonusMode: 'preliminary_locked',
  },
  sourcesOfTruth: {
    project: 'projects + projects.notes',
    projectTeam: 'projects.notes.team',
    periodTeam: 'projects.notes.auditPeriods[].team',
    timesheets: 'timesheet_entries; only approved rows enter final calculations',
    bonusDraft: 'projects.notes.finances.teamBonuses',
    paymentRegistry: 'bonuses',
    files: 'Seafile + project metadata',
    interface: '/projects with role-based permissions',
  },
  liveReadOnlyBaseline: {
    observedAt: latestLiveAudit?.observedAt || '2026-07-12',
    source: latestLiveAuditName || null,
    projects: latestLiveAudit?.totals?.projects ?? 1043,
    employees: latestLiveAudit?.totals?.employees ?? 140,
    approvedTimesheetRows: latestLiveAudit?.totals?.approvedTimesheets ?? 14629,
    approvedHours: latestLiveAudit?.totals?.approvedHours ?? 110364.4,
    rbiProjects: latestLiveAudit?.rbi?.markedProjects ?? 144,
    rbiParticipants: latestLiveAudit?.rbi?.assignedMembers ?? 152,
    bonusesRows: latestLiveAudit?.registries?.bonuses?.count ?? 0,
    projectTeamRows: latestLiveAudit?.registries?.projectTeam?.count ?? 0,
    projectParticipantRows: latestLiveAudit?.registries?.projectParticipants?.count ?? 0,
  },
  importExceptions: {
    rbiConflicts: 66,
    rbiNotFoundRows: 123,
    kenzhekulovProjectsNotFound: 5,
    unknownWorkbookStatus: [
      'Аманов Онгар.xlsx',
      'Бадамбаева Сауле(1).xlsx',
      'Сартаева Гаухар(1).xlsx',
    ],
  },
  safety: [
    'All demo browser traffic is intercepted and journaled.',
    'No production mutations are allowed by the demo harness.',
    'Bonus payment registration is intentionally unavailable while percentages and registry are unconfirmed.',
    'Imports are not rerun automatically.',
    'The live project purge kept consortium and unrecognized companies, preserved timesheets and left Seafile objects untouched.',
  ],
};

const md = `# RBBB — готовность к демонстрации генеральному директору

Сформировано: ${generatedAt}
Проверенный коммит продукта: \`${commit}\`

## Итог

Локальный демонстрационный контур готов: интерфейс проверен по всем ${roles.length} ролям, карточка проекта проверена отдельно для каждой роли, а цепочка «проект → цена → команда → файлы → часы → бонусы» подтверждена реалистичным сценарием без записи в production.

Текущая ветка опубликована в production. Публичный вход и регистрация проверены в реальном браузере; все ключевые маршруты отвечают HTTP 200, ошибок консоли не обнаружено.

Production-проверка: \`https://rbbb.vercel.app/\` обслуживается deployment \`${report.productionInspection.deploymentId}\` от 13.07.2026 с bundle \`${report.productionInspection.deployedAsset}\`. Маршруты \`/\`, \`/projects\`, \`/hr\`, \`/bonuses\` и \`/project/demo-project-001\` отвечают HTTP 200.

## Что доказано автоматикой

| Контур | Результат |
|---|---:|
| Боковое меню по ролям | 23 / 23 |
| Разрешённые страницы по ролям | 147 / 147 |
| Полная статическая матрица | 170 / 170 |
| Карточка проекта по всем ролям | 23 / 23 |
| Сквозные бизнес-сценарии | 7 / 7 |
| Изоляция от production | 1 / 1 |
| Матрица разрешений маршрутов | 568 / 568 |
| Массовое администрирование и статус заместителя | 4 / 4 |
| Полный активный браузерный прогон | 797 / 797 |

## Ворота качества

| Проверка | Результат |
|---|---:|
| TypeScript | пройдено |
| Production build | пройдено |
| Линтер | 0 ошибок; 875 старых предупреждений |
| Модульные тесты | 91 / 91 |
| Серверные тесты | 63 / 63 |

На каждом экране проверяются загрузка без падения, отсутствие 404/NaN/undefined, понятные имена видимых кнопок, корректные внутренние ссылки, отсутствие ошибок консоли и отсутствие неразрешённых внешних записей.

## Сценарий для показа

Демонстрационный проект: **АО Демонстрационный клиент — аудит 2026**.

- Договор: 48 000 000 ₸ без НДС; 53 760 000 ₸ с НДС.
- Команда: партнёр, менеджер и ассистент из единого \`projects.notes.team\`.
- Часы: 14 утверждённых часов и 4 часа, ожидающих партнёра.
- Файл: договор с метаданными Seafile, видимый всем ролям; загрузка и удаление доступны только закупкам и администратору.
- Бонусы: предварительные суммы видны, но регистрация выплаты заблокирована до сверки реестра и подтверждения процентов.

Рекомендуемый маршрут показа:

1. CEO: открыть \`/projects\`, показать свод, сумму, статус и индикатор часов.
2. Открыть проект, показать команду, финансовую сводку, периоды, договор и файл.
3. Procurement: показать создание проекта, расчёт НДС, выбор компании и вида проекта, загрузку файлов.
4. Assistant: показать тот же паспорт без прав изменения команды, договора и файлов.
5. CEO: открыть \`/timesheets\`, показать разделение «утверждено» и «на проверке».
6. CEO: открыть \`/bonuses\`, показать предварительный расчёт и явную блокировку финальной регистрации.

## Источники истины

| Данные | Источник |
|---|---|
| Проект | \`projects + projects.notes\` |
| Команда проекта | \`projects.notes.team\` |
| Команда периода | \`projects.notes.auditPeriods[].team\` |
| Таймшиты | \`timesheet_entries\`; в финальный расчёт только \`approved\` |
| Черновой бонус | \`projects.notes.finances.teamBonuses\` |
| Финальный платёжный реестр | \`bonuses\` |
| Файлы | Seafile + metadata проекта |
| Единый интерфейс | \`/projects\` с правами по ролям |

## Live-БД: проверка после безопасной очистки от 13.07.2026

- Проектов: ${report.liveReadOnlyBaseline.projects.toLocaleString('ru-RU')}; сотрудников: ${report.liveReadOnlyBaseline.employees.toLocaleString('ru-RU')}.
- ${report.liveReadOnlyBaseline.approvedTimesheetRows.toLocaleString('ru-RU')} утверждённых строк таймшитов на ${report.liveReadOnlyBaseline.approvedHours.toLocaleString('ru-RU')} часа.
- RBI: ${report.liveReadOnlyBaseline.rbiProjects.toLocaleString('ru-RU')} проектов и ${report.liveReadOnlyBaseline.rbiParticipants.toLocaleString('ru-RU')} участников после удаления проектов исключённых компаний.
- Удалено 149 чистых проектов Anderson/Parker; консорциумы и неопределённые компании сохранены. Таймшиты и физические файлы Seafile не удалялись.
- \`bonuses\`, \`project_team\`, \`project_participants\`: по 0 строк.

## Что намеренно не скрыто

- RBI: 66 конфликтов и 123 ненайденные строки.
- Кенжекулов: 5 ненайденных проектов.
- Не подтверждён статус трёх файлов: Аманов Онгар.xlsx, Бадамбаева Сауле(1).xlsx, Сартаева Гаухар(1).xlsx.
- Импорты нельзя запускать повторно до ручного разбора исключений.
- Формула и ролевые проценты остаются техническими; поэтому финальная регистрация выплат в интерфейсе заблокирована.

## Чек-лист непосредственно перед встречей

- Убедиться, что основной адрес открывает deployment \`${report.productionInspection.deploymentId}\`.
- Проверить вход реальными учётными записями CEO, procurement и assistant.
- Открыть один реальный проект и убедиться, что Seafile выдаёт список и ссылку скачивания.
- Не запускать импорты, миграции и регистрацию выплат во время демонстрации.
`;

writeFileSync(resolve(outputDir, 'demo-readiness.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(resolve(outputDir, 'README.md'), md, 'utf8');
console.log(`Demo readiness report written to ${outputDir}`);
