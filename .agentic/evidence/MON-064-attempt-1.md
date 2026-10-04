# MON-064 attempt 1 - exact bank import contracts

## Identity

2026-10-04, Asia/Tehran. Operator codex, implementing assistant; self-review only.
Entry HEAD 9d48c05, clean master tracking origin/master. User requested the next
task and commit/push after completion. Controller validate/status/context selected
MON-064, claimed with owner codex. No delegation or independent/human approval.

## Implementation and inspected scope

Read root/nested instructions, START_HERE, controller, project/map, backend role,
selected task and neighboring import tasks, MON-011 foundations, MON-063 evidence,
ADR-006, money manifest/README and source migration/API compatibility sections.
Inspected statement importer, bank schemas, bulk preview/import, detail route,
generic preprocessing, bank rules, read services, direct-DB MCP registration and
PostgreSQL fixture harness. Profile table had no runtime consumers/API/tools.

Findings: statement/bulk money used float parsing or hardcoded two-decimal scale,
malformed amounts could become zero, BAI2 minor units were multiplied by 100,
CAMT/MT debit balances lost signs, imports wrote history/rows/balance separately,
within-file statement duplicates and concurrent retries were unprotected, bulk
preview lacked banking permission, and autoReconcile rule imports marked rows
reconciled without journals. Import detail needed additive aliases and nested
ownership checks. Generic money/date helpers retain their separately assigned scope.

Added bank-import-wire.ts and bank-imports.ts. Four existing import/preview/detail
routes now use shared guarded JSON/direct-DB services. Added profile GET/PUT/DELETE
on the existing table; eight strict described MCP tools register once in index.ts,
use AuthContext/wrapTool and never self-call HTTP. Existing parser detection and
twelve formats remain; importer.ts now holds pure parsing/dedupe without DB access.
Two existing read helpers are exported/reused without changing MON-063 read behavior.

Decimal input remains text through exact bank currency-scale conversion. Canonical
amountExact/amountMinor and CSV balanceMinor aliases agree before writes. Statement
responses/detail add Minor strings to safe signed numeric minor amounts; bulk
preview preserves existing major-unit amount meaning/type, adds exact major/minor
aliases and reports row errors. Counts/jobs/profiles remain non-money. Bigint sums/
running balances validate supported +/-9007199254740991 coexistence. Numeric major
input has a conservative precision bound; no full-int64 business contract or dynamic
negotiation. USD/JPY/KWD/IRR new inputs honor their scales; stored integers never rescale.

Parser guards cover malformed money/grouping/junk, canonical aliases, unsupported
dates/quotes/row widths, same-currency native and CSV fields, multi-account files,
CAMT signs and MT debit/reversal/balance signs. BAI2 detail amounts remain integer
minor units and require dated groups. Supported date formats use deterministic
Gregorian parsing without host timezone fallback. Profiles explicitly control CSV
separators/date order/delimiter/split signs, with UTF-8 decoded text and UTC only;
exact aliases retain ASCII syntax. Native formats retain their own syntax.

Organization/bank locks serialize adopted writers with bank CRUD; statement rows,
history, bank balance and audit are atomic. Bulk rows/per-account histories/job/
audit are one transaction. Invalid batches now reject atomically instead of leaving
partial writes/error jobs; preview retains per-row errors. Bulk keeps the existing
no-bank-balance-update policy. Dedupe retains existing hash fields and includes
within-file/current/concurrent repeats. Retry can add history/audit/jobs but cannot
duplicate adopted bank rows. All-duplicate replay leaves the current bank balance;
overlapping rows participate in explicit opening-balance running calculations.

No import posts ledger or payments. Rules retain suggestions, guarded safe integer
numeric thresholds and owned references; they leave status unreconciled until actual
posting. Other rule writers/posting and general reference/configuration races retain
their tasks. Detail guards import/org/bank/row/currency and known references before
disclosure. Generic opaque history and arbitrary identifiers are not remediated.

BANK_IMPORT_WIRE_CONTRACTS documents every input/output/alias/unit/range, error,
permission, parsing/profile limit, compatibility correction and retry policy.
Updated money README/manifest, TEST_MATRIX and generated MONEY_BOUNDARIES inventory.
No schema change/migration generation, stored rescaling, production IRR change,
configured database migration, build, dev startup, Docker or deployment.

## Acceptance mapping

1. Registry operation/money/profile tables and strict described tool schemas cover
   all eight operations and formats; supported ranges and legacy major/minor
   response meanings are explicit. No undocumented exact-only/full-range claim.
2. Actual exported REST handlers and MCP SDK linked transports on current migrated
   PostgreSQL cover previews/commits/detail/profile read/save/delete, all twelve
   formats, numeric/text/exact clients, USD/JPY/KWD/IRR units, valid/expired/bad API
   keys, custom roles, foreign/missing/deleted parents, org-header spoofing and
   known nested reference isolation. Pure parser fixtures additionally cover
   alias disagreement, grouping/sign/scale/safe edges and explicit profile syntax.
3. Financial DB snapshots verify unchanged state for previews and rejected operations;
   unsupported later values, mixed currencies, locked later account/date and real
   SQL trigger faults roll back transactions/history/jobs/audit/balances. Concurrent
   statement retries insert once, within-file/repeated statement/bulk rows dedupe,
   overlap preserves running balances and all-duplicate replay cannot rewind a bank.
   Numeric coexistence, aliases and bigint serialization are exercised at safe edges.

## Actual verification

Commands ran from D:/Projects/dubbl with installed dependencies/generated sources.
PostgreSQL 18 synthetic trust-auth fixture at loopback 55474:
D:/Temp/dubbl-mon064-pg-8da4cd49ab1249b7a28e903bd0119083. initdb succeeded;
hidden pg_ctl startup exited 0. Explicit synthetic TEST_DATABASE_URL only; harness
creates/migrates/drops random disposable databases. Provider keys blank, configured
.env target/credentials not read or used. Final psql disposable DB count 0;
pg_ctl fast/wait shutdown succeeded. Cluster files retained outside repository.

| Actual command/procedure | Observed result | Coverage/limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 119-task graph, selected/claimed MON-064 | Orchestration only |
| node --import tsx --test --test-concurrency=1 tests/*.test.ts | Exit 0, 189/189 | Whole pure suite |
| Final node --import tsx --test tests/bank-import-wire.test.ts | Exit 0, 3/3 | Final date/profile/exact alias/parser fixes |
| node --import tsx --test --test-concurrency=1 tests/integration/bank-imports.test.ts tests/integration/bank-transaction-reads.test.ts tests/integration/bank-accounts.test.ts | Exit 0, 3/3 | Actual new contracts and banking regressions |
| Final standalone bank-imports integration | Exit 0, 1/1 | Final major-preview compatibility, host-independent dates/native sign guards; all-format adapters, rollback/retry fixtures |
| pnpm typecheck; final npx tsc --noEmit | Exit 0, no diagnostics | MDX/TypeScript, no build |
| pnpm lint | Exit 0, 0 errors/148 existing warnings | Whole repository |
| Final explicit changed-source/routes/tests npx eslint | Exit 0, clean | Every touched runtime/fixture TS file |
| money_inventory.py --write; money_inventory.py | Exit 0, 410 columns/1500 scanned paths/1221 consumer hashes/23938 occurrences | Generated source coverage only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, metadata/hashes/occurrences verified | Loader as documented |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine regression checks passed | No allowance increase |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0/0 before commit | Authorized publication preparation |
| git diff --check | Exit 0 | Harmless LF/CRLF notices |

Initial checks exposed and fixed implementation issues: camelCase minor CSV headers
were mistaken for major headers; MCP tool() overload required the existing strict
registerTool API; initial fixture helper incorrectly assumed protocol validation
errors were JSON; one unused fixture binding warned. Final focused/integration/type/
lint checks pass. Later review caught legacy bulk preview major units, profile exact
alias syntax and host-local date fallback; fixed without weakening assertions. Real
trigger faults are deliberately asserted as 500 while snapshots prove complete rollback.

No full build/dev/Docker, browser/OAuth/session HTTP, provider/binary file decoding,
full ISO/BAI validation, PostgreSQL 16/clean-install or production qualification.
No request-key replay, guarantee against separate legacy writers, generic resumable/
source mapping/object import qualification, historical remediation, full-int64 or
independent accounting/security/IRR approval. MON-021 retains combined acceptance.

## Review and handoff

Actual implementing-assistant self-review: MON-064-review-1.md. No bounded task
blocker. Close via controller, commit/push as authorized, stop after MON-064.
Next task MON-065 exact bank categorization contracts; DATA-001/MON-033 retain
broader import work and MON-066..069 other banking operations.
