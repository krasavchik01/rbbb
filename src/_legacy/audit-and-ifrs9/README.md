# Архив: аудит и МСФО 9 / ECL

**Перенесено сюда: 2026-05-22** по решению CEO.

## Почему

CEO: «Усложнил с аудитом и процедурами МСФО, это нагружает систему. Не нравится. Удали полностью у всех аудит процедуры и МСФО 9. Просто чтобы задачи ставились в рамках проекта или нет».

## Что здесь

| Папка | Что |
|---|---|
| `lib/auditTemplates.ts` | `ALL_AUDIT_TEMPLATES` — справочник аудиторских шаблонов документов |
| `lib/auditMethodology.ts` | `RUSSELL_BEDFORD_AUDIT_METHODOLOGY` — методология аудита (фазы, элементы) |
| `lib/auditProceduresLibrary.ts` | `ALL_PROCEDURE_TEMPLATES_WITH_KZ` — библиотека аудиторских процедур |
| `lib/ifrs9Calculator.ts` | Расчёты ECL по МСФО 9 |
| `types/audit.ts` | TS-типы для аудиторских процедур, стадий, областей |
| `pages/Audit.tsx` | Страница «Аудит МСА» (была на /audit) |
| `pages/IFRS9.tsx` | Страница «МСФО 9 / ECL» (была на /ifrs9) |
| `components/TemplateManager.tsx` | UI для управления шаблонами процедур |
| `components/TaskDistribution.tsx` | Массовое распределение задач по аудиторским процедурам |

## Что важно знать

- **Папка исключена** из `tsconfig.app.json` через `exclude` — TypeScript её не проверяет, Vite не компилирует в бандл.
- Если когда-нибудь надо вернуть — убрать exclude в tsconfig, переместить файлы обратно, вернуть импорты:
  - `git log --diff-filter=D --name-only -- "src/lib/auditMethodology.ts"` найдёт коммиты удаления.
  - Соответствующие закомментированные импорты в `src/pages/ProjectWorkspace.tsx`, `src/pages/Projects-simple.tsx`, `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/components/AppHeader.tsx`.

## Что НЕ перенесено (и почему)

- `src/types/methodology.ts` — это **generic** типы для проектов (ProjectTemplate, ProcedureElement, ProjectData). Используются в ProjectWorkspace независимо от аудита. **Не аудит-специфично**.
- Поле `notes.methodology` в `projects` JSONB — это generic поле. Если в БД лежат старые данные аудит-методологии — они там лежат как orphaned JSON, ничего не делают, но не мешают.

## Связанные коммиты

- `984a29b` — убрал из навигации (sidebar/header/routes).
- `7ecc05e` — вырезал автоподстановку методологии в ProjectWorkspace и счётчик шаблонов в Projects-simple.
- **этот коммит** — перенёс файлы сюда.
