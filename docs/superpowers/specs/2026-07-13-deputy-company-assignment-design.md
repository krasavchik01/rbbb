# Deputy Company Assignment Design

## Goal

Projects without a company remain visible to an administrator or deputy director even when their normal company scope is restricted. Those roles can assign or replace the project's company without receiving contract, file, payment, or deletion rights.

## Design

- Keep existing allowed-company filtering for assigned projects.
- Add a narrow exception for CEO, administrator, and deputy director: a project with no company identifier or company name remains visible.
- Add a standalone company assignment card in the project workspace. It uses the active company catalog, writes `companyId`, `companyName`, `company`, and `ourCompany` through the existing project update path, and records no financial changes.
- Permit the new card only to CEO, administrator, and deputy director. Procurement retains its existing contract editor rights; ordinary roles remain read-only.

## Validation

- Unit-test the visibility rule for a deputy with an allowed-company scope and a project without a company.
- Browser-test that a deputy sees the assignment control, while an assistant does not.
- Run typecheck and the focused role tests.
