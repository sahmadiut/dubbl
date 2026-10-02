# AUD-002 baseline capture runbook

Prepared 2026-10-02. This is a reproducible capture specification, not observed accounting output. Current evidence: `../evidence/AUD-002-attempt-1.md`.

## Environment prerequisites

Owner scope update, 2026-10-02: DEC-002 omits Docker installation, builds and tests from current execution. Necessary Docker files may be written and inspected without testing. Docker absence is not a blocker. This supersedes Docker execution prerequisites in attempt 1; no production container result is claimed.

Use Node 22 and pnpm 10.30.3, matching CI/Docker and package.json. The current host has Node 23.11.0 and installed dependencies; it does not establish frozen-install reproducibility. Docker and psql were not found on PATH. Local ports 3000 and 5432 accept TCP connections; service identity and database isolation remain unverified.

Root AGENTS.md prohibits full builds and requires an explicit request to run the dev server. Do not run Dockerfile builds under that restriction: the Dockerfile executes `pnpm build`. An existing local app can be read without restarting it. Its health route returns static `{ "status": "ok" }` and does not prove DB readiness.

DEC-003 (2026-10-02): the owner confirmed that the existing local `dubbl` database configured in .env is for testing and authorized necessary queries. Use that target without requiring another database or asking again about its test status. Read-only connection checks succeeded: PostgreSQL 18.6, database timezone Asia/Tehran. Load credentials through DATABASE_URL; do not record them in artifacts. Check migration state before applying committed migrations with `pnpm db:migrate` where needed. `lib/db/seed.ts` prefers the dev user's organization, then any owner's organization; use identifiable scoped fixtures instead of assuming this seed creates isolation. Compose's web profile performs db:push, seed and dev automatically, so it is unsuitable for this controlled migration baseline.

## Synthetic fixture specification

Create a dedicated organization named AUD-002 Baseline with USD, Gregorian dates, a January fiscal-year start and an explicit UTC organization timezone where supported. Use only synthetic contacts. Record the generated organization ID in sanitized capture evidence. All amounts below are integer cents; use application workflows so journal, document and bank records agree.

Use 2025-12-01 for opening entries, 2025-12-02 for the invoice/bill, 2025-12-03 for settlements and 2025-12-31 for report captures. Give both documents a 2025-12-31 due date and zero tax. Disable automatic jobs for this fixture to prevent time-dependent changes.

| Event | Debit | Credit |
|---|---|---|
| Owner contributes cash | Bank 100000 | Contributed capital 100000 |
| Issue synthetic customer invoice | Accounts receivable 20000 | Sales revenue 20000 |
| Receive partial invoice payment | Bank 5000 | Accounts receivable 5000 |
| Post synthetic supplier bill | Operating expense 8000 | Accounts payable 8000 |
| Make partial bill payment | Accounts payable 3000 | Bank 3000 |

Expected unclosed trial balance: bank debit 102000, AR debit 15000, expense debit 8000, AP credit 5000, capital credit 100000, revenue credit 20000. Debits and credits each total 125000. Expected aged AR total 15000; aged AP total 5000; bank ledger and bank account balance 102000. Assets 117000 equal liabilities 5000 plus capital 100000 plus current earnings 12000.

Before closing, retained earnings is 0 and current earnings is 12000. Capture this distinction rather than treating current earnings as posted retained earnings. Then close the fixture fiscal year through the existing authorized workflow and capture again: retained earnings credit 12000, revenue/expense balances 0, trial balance debit and credit totals each 117000. AR/AP and bank balances remain unchanged. Do not close another organization's year.

These are independently calculated expectations. Attempt 3 now contains actual direct-handler captures for synthetic organization `27c074b2-7c89-4d43-9b97-cfeb7d6cb406`; see `../evidence/AUD-002-attempt-3.md`. Use account code 2100 for AP, as required by existing posting helpers, and receive draft bills rather than approving them. Two discrepancies remain (trial-balance debit/credit presentation and bank API balance versus GL). HTTP capture is now recorded in attempt 4. Screenshots are omitted under DEC-005. Startup was performed by the owner; no agent-start or clean-install reproducibility claim is made.

To reproduce the direct-handler capture on the authorized local test target: `node --env-file=.env --import tsx .agentic/scripts/capture_baseline.mjs`. Each run creates a new synthetic organization, retains its records and revokes its temporary credential. This is not a Next.js startup or HTTP benchmark. Exit 1 indicates failed comparison or an incomplete workflow; inspect the unique JSON artifact printed by the script.

## Capture procedure

1. Use the existing authorized test database from .env and create an identifiable fixture organization; record runtime versions without requiring Docker. Record actual migration and frozen-install outcomes. Start development only after an explicit request. Omit production Docker reproduction per DEC-002 and label Docker support untested.
2. Record each created document/payment/journal identifier and posting status. Retrieve org-scoped JSON from `/api/v1/reports/trial-balance?asAt=2025-12-31`, `/api/v1/reports/aged-receivables?asAt=2025-12-31`, `/api/v1/reports/aged-payables?asAt=2025-12-31` and `/api/v1/reports/balance-sheet?asAt=2025-12-31`. Verify endpoint parameters against current source before executing. Capture bank balances through the banking UI/API. Retain sanitized response artifacts before and after fiscal closure.
3. Screenshot capture and screenshot tests are omitted by owner decision DEC-005. Retain synthetic accounting JSON and actual HTTP timing evidence; browser connection or screenshot tooling does not gate continuation.
4. Record first request separately from warm requests. For each report and selected page, measure at least five warm requests and report individual timings and median; distinguish HTTP latency from browser rendering. A single health probe is not a performance qualification.
5. Record provider availability individually. Stripe, S3, Trigger.dev, email and FX feeds need explicit configuration and actual checks before being marked passed. Keep credentials out of evidence. Document unavailable providers rather than inferring readiness from optional environment variables.

After actual captures satisfy the full task scope, append a new attempt, update the task handoff, check supported criteria and perform an honest review through the controller. Do not mark AUD-002 done based on this runbook.
