# LOC-088 attempt 1 - payroll self-service catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `d0de10664093489c44e2a06b125b9c019c91428f`; clean entry tree.
Live controller validate/status/next selected LOC-088. Exactly this child was
started. Origin fetch confirmed zero ahead/zero behind. The user authorized
completion and push. No subagents. The memory controller-task skill guided the
workflow; current controller and repository source governed acceptance.

Read root instructions, START_HERE, controller/project/map/frontend guidance,
selected task/parent boundary, catalog contract, locale/source requirements and
prior payroll evidence. Inspected the self-service page, payrollJson, output/time
services and wire DTOs, real REST routes, registered MCP tools and fixtures.
No application database or its credentials were used.

## Acceptance mapping

1. Extracted all authored page copy into 42 paired `PayrollSelfService` messages.
   Catalog validation reports 7,731 compatible keys per locale. Every new Persian
   leaf contains Persian script. Four finite timesheet status and seven finite
   leave-type labels are translated. Exceptions for escaped saved data, `-`,
   counts, date/hour/money formatting and shared loading are documented in the
   [scope registry](../registries/PAYROLL_SELF_SERVICE_CATALOGS.md).
2. Real next-intl/PresentationProvider renders the production JSX in both locales.
   Callback checks exercise profile/history reads, organization headers, all
   HTTP/JSON/envelope/identity failures, storage/network failures, profile 404,
   obsolete fulfillment/rejection, save payloads, retained edits, busy release,
   optional empty-value omission and checked success feedback. The reader checks
   required displayed fields, ordered Gregorian periods, generated timestamps,
   exact aliases, physical binary32 hours, finite statuses/types and unique IDs.
   Histories and save responses must match the authenticated employee profile.
   Actual migrated REST and linked MCP output/time responses pass this reader.
3. Task handoff, catalog index, scope registry and honest Codex self-review record
   provisional Persian wording and independent parent/native/RTL acceptance.

Existing employee identity and authorization, request routes/methods/headers,
PATCH field names and optional omission, ten/five history display limits,
full payslip count, fixed-two payroll cents, stored values and canonical dates
remain. Initial profile read resolves identity before the three history reads;
all checked results are adopted together. Failed reads cannot populate partial
profile/history/form data. Explicit profile 404 shows the missing-profile state
and clears old read errors. Other errors use finite translated feedback.
Save failures retain form fields and release busy; no refresh follows a save.
No backend, schema/migration, provider, IRR flag or Stripe change. Existing MCP
tools cover all owned operations; no duplicate operation was introduced.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Final focused catalog/rendering/callback and payroll money suite | 10/10 pass, zero skips; 2.571 seconds | Controlled hooks/IO; real JSX and next-intl |
| Catalog validation | Exit 0; 7,731 compatible keys per locale | No native linguistic approval |
| Final owned-file ESLint | Exit 0; zero errors/warnings | Page, reader, focused/source-guard tests and two workers |
| Full lint | Exit 0; zero errors, 41 warnings elsewhere | Existing warnings outside task |
| Final typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Migrated payroll output/time fixtures | 2/2 pass, zero skips; 28.682 seconds | Real REST, linked MCP and independent SQL on isolated PostgreSQL 18 |
| Full unit/static suite | 1,218/1,218 pass, zero skips; 271.758 seconds | Concurrency 2; final focused checks also cover the profile-404 regression |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,395 scanned paths, 1,786 consumer hashes; nine legacy checks | Source/contract guard |
| Controller validation and diff check | Pass during implementation | Repeat after controller completion |

```text
node --import tsx --test tests/payroll-self-service-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-outputs.test.ts tests/integration/payroll-time.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/self-service/page.tsx" i18n/payroll-self-service-presentation.ts tests/payroll-self-service-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-outputs-worker.ts tests/integration/payroll-time-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Real rendering checks escaped adversarial position/policy data, exact high/low
money, canonical periods, fractional 7.5/0.25 hours, all finite enum labels,
empty/missing/loading/busy/error states and unchanged ten/five display limits.
The AST audit rejects remaining authored JSX prose and raw visible attributes.
Every added Persian leaf has a Persian-script assertion; existing namespaces
are unchanged by parsed-value comparison in both catalogs.

Output/time workers now validate successful self profile GET/PATCH, payslips,
leave balance and timesheet REST/linked MCP responses through the new reader.
Existing independent SQL, membership/role/organization isolation, ambiguous or
missing profiles, binary32 quantities, exact-money compatibility, rollback and
audit assertions remain intact.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6455 with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN targeted it; fixtures created/dropped randomized
databases. The final admin query found zero remaining dubbl_ci_* databases.
pg_ctl stopped the isolated server successfully.

The generated money inventory refresh changes task-owned consumer paths/hashes/
references and three existing schema-declaration comment encodings (replacement
character to em dash). Actual schema declarations, column types, units,
classifications and stored monetary semantics did not change.

During self-review, the explicit profile-404 branch was adjusted to clear an old
read error so the missing-profile presentation also works after a previous
failed read. The final focused regression covers this branch. A valid nullable
profile-reader assertion was also changed to await its promise. Final focused
checks, typecheck and source guards cover these changes.

## Review and handoff

See [Codex self-review](LOC-088-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian is provisional. LOC-067/008/002,
mounted browser/keyboard, full RTL/numerals/calendar, hosted CI, deployment and
production qualification remain independent. No full build, unrequested dev
server, Docker, external provider request, deployment or Stripe work ran.
Controller closure and task-owned commit/push follow completed checks; remote
synchronization is reported only after verification.
