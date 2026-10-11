# CI repair - combined expense reimbursement fixture clock

2026-10-11, Asia/Tehran. Operator: coding-assistant; self-review only.
The user explicitly requested checking GitHub CI before pushing MON-134 and
including the repair in the same push. Entry HEAD
132196c997ab37e05c91068f94cd525b92481ba5.

## Observed failure

Read the fork's live CI run with `gh run list --repo sahmadiut/dubbl --branch
master` and `gh run view 38096415249 --repo sahmadiut/dubbl --log-failed`.
Run: https://github.com/sahmadiut/dubbl/actions/runs/38096415249
Failed job: PostgreSQL Migration Fixtures, job 114343121924.
Unit tests, lint, typecheck and controller passed. Integration had 141/142
passing tests; build/Docker/migration downstream jobs were skipped.

The failing MON-021 payment/expense/bank worker called pay_expense_claim with
its earlier captured `today`; the service returned status 400, "Reimbursement
cannot predate approval". The failing request was logged shortly after UTC
midnight. Source review found `today` captured once at the start of the scenario,
while approval separately uses the current application clock for its GL date.
The observed timing and code identify the fixture's UTC rollover race.

## Repair and verification

Only tests/integration/payment-expense-bank-integration-worker.ts changes.
Use Node's existing Date mock pattern to freeze this synthetic worker at
2026-10-11T12:00:00Z and reset it in finally. Preserve every product approval/
payment date guard. Add an explicit snapshot-backed rejection of a reimbursement
on 2026-10-10 before approval. All four synthetic currency scenarios still run.

`TEST_DATABASE_URL` explicitly targeted the dedicated synthetic loopback server
127.0.0.1:55434. Harness-created random databases were migrated and dropped.
`node --import tsx --test tests/integration/payment-expense-bank-integration.test.ts`
passed, 1/1, exit 0. Existing expense lifecycle integration independently passed
alongside invoice/editor integration, 3/3 total, exit 0. Changed-file ESLint and
TypeScript passed; repository unit tests passed 391/391 and lint had zero errors.

This is a bounded local repair, verified on Node 23/PostgreSQL 18, not an assertion
that a replacement GitHub Node 22/PostgreSQL 16 CI run has passed. No application
database, product clock, stored history, financial rule or deployment was changed.
Historical MON-021 completed evidence is untouched.
