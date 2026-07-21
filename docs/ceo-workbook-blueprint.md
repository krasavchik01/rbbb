# CEO Workbook Blueprint — legacy Excel → SUITE-A

> Source reviewed: `Таблица Шолпанай.xlsx` (read-only).  
> The source contains operationally sensitive client, employee and financial data and is **not** copied into this repository.

## What the legacy workbook really does

The workbook is a manual CEO command center for a portfolio of projects. It makes one question immediately answerable for every project:

```text
Which client/project is this → under which contract and company → what is the contract amount
→ what bonus pool is planned → which people are assigned in which roles
→ how much each person is due → what GPH/pre-expense was incurred
→ what the remaining gross income is.
```

It is not merely a partner report. It is a portfolio and bonus-allocation ledger.

## Workbook architecture found

- **22 sheets total**:
  - 11 visible calculation/showcase sheets grouped by CEO/partner/direction;
  - 11 hidden manually maintained source sheets.
- The hidden source sheets contain raw project inputs.
- Each visible sheet renders a normalized financial/role matrix from the corresponding source sheet.
- Visible calculation sheets contain approximately **1,400–3,000 formulas each**.

### Hidden source record

The source model repeatedly contains these fields:

```text
Project/client name
Contract number
Contract date
Contract subject
Service delivery deadline
Amount without VAT
Our company
Partner
Project lead
Supervisor 3 / 2 / 1
Tax specialist 1 / 2
Assistant 3 / 2 / 1
GPH / contractor(s)
GPH amount
Status
```

Some sheets have legacy variations in staff-role columns and multiple GPH columns. SUITE-A must normalize those into canonical role/team records rather than reproduce those column variants.

### Visible CEO matrix

Each project row presents:

```text
№
Project
Project type
Contract amount without VAT
Status
Bonus percentage
Total bonus pool

Partner + amount
Project lead + amount
Supervisor 3 + amount
Supervisor 2 + amount
Supervisor 1 + amount
Tax specialist 1 + amount
Tax specialist 2 + amount
Assistant 3 + amount
Assistant 2 + amount
Assistant 1 + amount

GPH + GPH amount
Total bonuses
Difference between planned and actual bonus payments
Pre-expense
Total costs
Amount without VAT − GPH − pre-expense
Gross income
```

## Formula logic recovered

### 1. Project bonus pool

```text
bonus_pool = (contract_amount_without_VAT − GPH − pre_expense) × project_bonus_percent
```

The workbook uses the post-cost amount as the bonus basis (`AH`) and then calculates the total pool (`G`) from that basis and the project percentage (`F`).

### 2. Standard role allocation model

The default fixed shares in the reviewed workbook are:

| Role | Share of bonus pool |
|---|---:|
| Partner | 29% |
| Project lead | 24% |
| Supervisor 3 | 15% |
| Supervisor 2 | 10% |
| Supervisor 1 | 6% |
| Tax specialist 1 | 3% |
| Tax specialist 2 | 3% |
| Assistant 3 | 4% |
| Assistant 2 | 4% |
| Assistant 1 | 2% |

For an occupied role:

```text
role_bonus = role_share × bonus_pool
```

For an empty role the legacy workbook returns `0`.

### 3. Financial reconciliation

```text
planned_bonus_total = Σ role bonus amounts
bonus_delta = planned_bonus_total − actual_paid_bonus_total
costs = GPH + pre_expense
gross_income = contract_amount_without_VAT − costs
```

## Why Excel still feels clearer than the current product

Excel keeps the **full causal chain in one horizontal row**:

```text
project → amount → bonus pool → assigned people → each payment → costs → remaining income
```

That is the key UX quality we must preserve, but SUITE-A must surpass it by adding:

- contract evidence and secure file opening;
- company, client, subject, service, stage and linked period as distinct objects;
- approved timesheets and actual workload;
- statuses and deadline risks;
- business season (October → September);
- role-based editing and server-side authorization;
- validation instead of silent formula/column errors;
- one source of truth instead of dozens of hidden manual tabs.

## Non-negotiable SUITE-A CEO view

### Portfolio row / desktop smart table

```text
Company | Client | Project | Subject | Service | Contract | Stage → Period
Deadline | Status | Contract amount | Cost basis | Bonus pool
Planned/paid bonuses | Gross income | Partner | Project lead | Team load | Risk
```

Each column must support Excel-like filtering/sorting. Finance columns are shown only to authorized roles.

### Project drawer/card inside the summary

```text
Identity
Company → client → project → business season

Contract
Number/date → subject → service → dates → amount → secured files

Delivery
Stage → linked period → deadline → status → timesheets → assigned team

Finance
Contract amount → GPH → pre-expense → cost basis → bonus pool
→ planned allocation → actual payments → delta → gross income

Integrity
Missing company/subject/service/contract amount/file
Stage without period; period without stage; duplicated stage-period link
Bonus allocation/contract-cost reconciliation issues
```

### CEO analytics

1. Portfolio health: active/completed/overdue/near-deadline/no-contract/no-money.
2. Financial waterfall: contract amount → GPH/pre-expense → bonus basis → planned/paid bonuses → gross income.
3. Team view: approved hours, pending hours, projects in progress, projects closed, assignment by person.
4. Partner/leader view: portfolio, bonus pool, planned vs paid, closure count, risks.
5. Business-season comparison: October–September, not calendar year.

## Data model mapping

| Legacy workbook | Canonical SUITE-A source |
|---|---|
| Project/client name | project + partner/client entity |
| Contract number/date/subject/deadline/amount | `projects.notes.contract` + canonical contract read model |
| Our company | `project.company` / `projects.notes.company` with integrity flag if missing |
| Role columns | `projects.notes.team`; period override: `notes.auditPeriods[].team` |
| GPH / GPH amount | `notes.finances.contractors` / `totalContractorsAmount` |
| Pre-expense | `notes.finances.preExpenseAmount` |
| Bonus percent/pool/allocation | `notes.finances` + canonical calculation, not a hard-coded UI value |
| Actual bonus payment | `bonuses` where present, otherwise explicitly “not confirmed” |
| Project timing | stage + linked audit period + contract service dates |
| Work actually performed | approved `timesheet_entries` |

## Explicit product rules derived from the workbook

1. `0` is not equivalent to missing data. “Not entered” must stay visible as “Не указано”.
2. A period is never a replacement for contract subject/service/project.
3. A role allocation is a **plan** until payment is confirmed.
4. Team name in a grid must lead to actual role, period scope and approved hours.
5. GPH/pre-expense are always visible in the same finance waterfall as bonus pool and gross income for CEO/authorized finance roles.
6. Fixed role shares must be policy/configuration with version history, not magic columns or hard-coded formulas.
7. Historical records must be surfaced as integrity warnings, not silently converted or mass-edited.

## Delivery order

1. CEO project passport and integrity warnings — in progress.
2. Finance waterfall + planned vs paid bonus reconciliation — next.
3. Per-column smart filters using one normalized summary row — next.
4. CEO portfolio/team/season analytics driven by real timesheets — next.
5. Role-policy configuration and server-enforced permission checks — after the read model is stable.
6. Historical data cleanup only as a reviewed preview, never a blind import/migration.
