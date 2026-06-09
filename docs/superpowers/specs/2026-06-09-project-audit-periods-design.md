# Project Audit Periods Design

## Goal

Projects that represent the same client engagement must not appear as duplicate rows only because the audit period differs. The app should keep one project as the main engagement and allow partners to create and manage audit periods inside it.

Example:

- Main project: `TOO Oil Construction Company - audit`
- Periods: `2022 year`, `2023 year`, `2024 year`, `6 months 2024`, `9 months 2024`, `FY 2024`

Each period can have its own partner, status, deadline, tasks, documents, team, progress, and optionally financial allocation.

## Current Context

The project currently stores team assignment in `notes.team[]`, and the partner is derived from the team member whose role is `partner`. The current mass partner assignment screen works at project level. The project summary screen therefore shows duplicated project rows when imports create separate projects for different periods of the same client engagement.

The existing v3 type model already has a `ProjectStage` concept with start date, end date, amount, and year. This is close to the needed shape, but the product language should be `Audit periods` because partners need to manage business periods, not only contract stages.

## Recommended Approach

Add audit periods as a nested project structure stored with the project data, initially in project `notes`/front-end model to match the current storage style. Do not create separate top-level projects for each audit period.

Use one canonical project row in summary tables. Show a compact badge such as `3 periods`. Expanding the row or opening the project shows the period list.

## Data Model

Add `auditPeriods` to the project notes/front-end project model.

Each period should contain:

- `id`: stable id
- `name`: display name, for example `2024 year` or `9 months 2024`
- `type`: `six_months`, `nine_months`, `year`, or `custom`
- `startDate`: ISO date
- `endDate`: ISO date
- `year`: optional numeric year for filtering
- `partnerId`: optional partner user id
- `partnerName`: optional denormalized name for display
- `status`: period workflow status
- `deadline`: optional date
- `taskIds` or nested task metadata, depending on existing task wiring
- `documentIds` or document metadata, depending on existing document wiring
- `team`: optional period-specific team if a period differs from the main project team
- `amountWithoutVAT`: optional amount allocation
- `createdBy`, `createdAt`, `updatedAt`

The main project can still have a default partner/team. A period partner overrides the main partner for work that belongs to that period.

## UI Behavior

In `Свод по проектам`, duplicate period rows should be replaced by one project row. The row shows:

- main project name without the noisy `за период ...` suffix
- company
- overall finance/status/deadline summary
- team summary
- period badge, for example `3 periods`

When the project row is expanded, show period rows:

- period name
- partner
- status
- deadline
- task count
- document count
- quick action to open the period

Inside the project workspace, add a `Периоды` section where authorized partners can:

- add a period
- choose type: 6 months, 9 months, year, custom
- set start/end dates
- assign a partner
- edit deadline/status
- open period tasks/documents

## Permissions

Partners can add and edit periods inside projects they are responsible for. CEO, deputy director, and admin can manage periods across projects. Other team members can view periods for projects they are allowed to access.

If a partner is assigned only to one period, they should see and approve work for that period. If the project has no period-specific partner, fall back to the main project partner.

## Timesheets And Approval

Timesheet entries should be able to reference an optional `auditPeriodId`. Partner approval should use:

1. period partner, when the entry has an `auditPeriodId` and that period has `partnerId`
2. main project partner, when no period partner exists
3. current fallback logic when neither exists

This keeps multi-year projects from sending all hours to one partner when different periods belong to different partners.

## Import And Duplicate Cleanup

For existing duplicate projects, provide a cleanup path:

1. detect likely duplicates by normalized client/project name and company
2. extract period text such as `2022-2024`, `2024`, `6 months`, or `9 months`
3. choose one canonical project
4. move extracted periods into `auditPeriods`
5. preserve old project ids in period metadata for traceability
6. review before deleting or hiding duplicates

The first implementation can avoid destructive deletion. It can hide or group duplicates after creating periods, then a later cleanup can remove obsolete duplicate rows after verification.

## Error Handling

Period dates must be valid, and `endDate` must be after or equal to `startDate`. The UI should prevent overlapping periods only when they have the same period type and year; custom overlaps may be valid and should warn instead of blocking.

If period creation fails, the project should remain unchanged and the user should see a clear toast. If duplicate cleanup cannot confidently match a period, it should leave the source project untouched.

## Testing

Add focused tests for:

- parsing and displaying audit periods from project notes
- deriving the effective partner from period first, then project fallback
- rendering one summary row for duplicate-like project data
- creating and editing a period in the project workspace
- timesheet approval routing when `auditPeriodId` is present

## Out Of Scope

This design does not require a full database schema migration on the first pass. It also does not require deleting existing duplicate projects immediately. Destructive merge/delete should happen only after a reviewed migration or cleanup report.
