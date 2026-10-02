# MON-023 attempt 1 - exact budget CRUD adoption

## Identity

2026-10-02, Asia/Tehran. Operator: codex. HEAD remains
`c2383090e08358065aa76f61768a88a346813a3a`. Entry includes uncommitted MON-017
work completed earlier in this session; preserved it. The owner sent `continue`
after that task's completion, authorizing the next task. All changes remain
uncommitted. Synthetic disposable PostgreSQL 18.6 fixtures, self-review only;
no independent human/accounting, production or deployment approval.

## Implementation and bounded scope

Controller selected MON-015. Read its scope and existing money/API instructions,
ADR-006, manifest/evidence, schema, budget REST/MCP and date/distribution helpers;
also inspected CRM and source listings to verify independent auxiliary writers.
Split oversized MON-015 into MON-023 budget CRUD, MON-024 inventory/costing,
MON-025 payroll, MON-026 assets/loans, MON-027 projects/CRM/pricing, MON-028
consolidation/configuration and MON-029 reports/dashboards. Parent original
acceptance is retained; children inherit MON-011, index/source coverage updated,
79-task graph validates. Only MON-023 is implemented; budget-vs-actual is explicitly
outside this CRUD slice, remaining MON-029 with the original report implementation.

- `lib/api/budget-wire.ts`: described shared request schemas, signed cents/string
  aliases, exact agreement/safe-number bridging, bigint period sums/distribution,
  date validation and bounded generated work. `totalMinor`/`amountMinor` preserve
  integer units. Missing amounts/explicit-total precedence/empty periods retain
  existing semantics. All monetary values and final period sums must fit signed
  JS-safe range; valid unsupported int64 strings fail with classified 422.
- `lib/api/budget-write.ts`: direct Drizzle shared REST/MCP creation/update/delete,
  org/not-deleted predicates, preflight all lines/dates/aliases/sums/account/fiscal
  references before writes, atomic header/line/period transactions and post-commit
  existing best-effort audit. Reads reject existing foreign-org nested references;
  metadata/replacement/deletion load monetary history first, rejecting unsafe values.
- Replaced duplicated REST/MCP mutation implementations with the shared services.
  Guarded JSON and unchanged header-only envelopes; detail GET keeps numeric fields
  and adds exact aliases. MCP schemas/descriptions state units, bounds and semantics.
  Report registration/logic remains unchanged. No new public operation or HTTP
  self-call, schema change, migration or IRR flag change.
- `lib/budget-periods.ts`: Gregorian date-only generator now uses UTC calendar
  construction/access/arithmetic, avoiding timezone/DST shifts and years-0..99
  constructor offsets. English labels, ordering, period clipping and legacy frontend
  `distributeAmount` behavior remain. New server distribution uses bigint separately.
- Added five pure contract groups, real PostgreSQL REST/API-key/member/registered-MCP
  fixtures, operation inventory, API docs/README/manifest/test matrix/source inventory.

Supported CRUD amounts/sums are -9007199254740991 through 9007199254740991;
500 lines/10000 total periods bound work. Numeric/alias parsing is canonical,
without Number conversion of amount strings. Explicit total remains allowed to
differ from supplied period sum, preserving current behavior, but the period sum
must still be representable. Unsafe historical values cannot be rounded or silently
erased by line replacement. Budget currency remains implicit organization context;
no currency snapshot/rescale or historical IRR correctness is inferred. Report and
frontend amount arithmetic remain unqualified at large values and assigned work.

## Acceptance mapping

1. BUDGET_WIRE_CONTRACTS documents all five REST/five MCP adopted operations,
   actual cents/string aliases, positive/negative ranges, omissions/defaults,
   distribution, total precedence, calendar/size limits, existing envelopes,
   org/role/ref predicates, transaction/audit behavior and report/consumer exclusions.
   Shared schemas describe every input field; public API docs/tool descriptions
   match the contract. Neither money/currency units nor posted history change.
2. `tests/budget-wire.test.ts` covers numeric/exact/dual/default signed clients,
   both safe edges, above-int32 values, exact cancellation/allocation, syntax/conflict/
   unsupported-range/date/size errors, DTO safety and UTC/Tehran/New York calendar
   equality including DST/early years. The actual PostgreSQL worker invokes REST
   exports through real hashed API keys/member auth and all five adopted registered
   MCP validators/handlers with two orgs. Tests old/exact clients, member denial,
   foreign IDs and foreign/not-owned account/fiscal references, nested read guards,
   tenant lists, exact persisted values/period conservation and audits.
3. DB/audit snapshots are unchanged after bad later lines, conflicts, unsupported
   sums/strings, invalid dates, foreign refs and authorization failures. Injected
   period-storage failure verifies full create/update rollback on both transports,
   including old IDs/header timestamp/children/audits. Metadata-only edits retain
   IDs; empty replacement clears children; soft-delete retains amounts/periods.
   Raw unsafe historical value remains unchanged after REST/MCP get/update/replace/
   delete rejection, with no extra audit. Numeric detail fields and exact aliases
   round-trip without bigint JSON crashes or silent precision loss.

## Verification

Commands ran in `D:/Projects/dubbl` unless noted.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller start/split/validate/status | Exit 0; 79-task graph valid | Structural state, not product qualification |
| `node --import tsx --test tests/budget-wire.test.ts` | Exit 0; 5/5 groups | Pure contracts plus actual separate-process timezone comparison |
| `node --import tsx --test tests/integration/budget-wire.test.ts tests/integration/contact-wire.test.ts` | Final exit 0; 2/2 workers | Real migrated disposable PostgreSQL 18.6 REST/MCP; contact regression retained |
| Final `npm test` | Exit 0; 96/96 | Includes previous/new contract suites after final runtime guards/read-scope changes |
| Final `npx tsc --noEmit` | Exit 0 | Existing generated Next/MDX artifacts; no full build |
| Final `npm run lint` | Exit 0; 0 errors/167 existing warnings | Earlier fixture prefer-const error fixed; final description-only edit additionally has clean targeted lint |
| `npx eslint` all changed budget runtime/tests, then final tool/worker | Exit 0; clean | Actual affected-file coverage |
| `python -m unittest discover -s .agentic/tests -v` | Final exit 0; 32 run, 31 pass/1 Windows symlink privilege skip | Final run sets TEMP/TMP to unique `D:/Temp/dubbl-mon023-controller-*`; source/live tasks unchanged |
| `python .agentic/scripts/money_inventory.py --write`, then without `--write` | Exit 0; 410 columns, 1320 scanned files, 1104 consumers, 21454 occurrences | Conservative source inventory, not report/full-domain verification |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | Drizzle columns and source hashes/lines match |
| `git diff --check` | Exit 0 | Git LF/CRLF notices only |
| Separate PostgreSQL initdb/pg_ctl start, disposable DB create/drop, pg_ctl stop | Exit 0 | Synthetic cluster at loopback port 55442; configured DB/roles untouched |

Initial full/targeted lint found a never-reassigned fixture variable declared `let`;
changed it to `const`, final lint passes. Initial controller suite had one failure
from `[Errno 28] No space left on device` on C:, without a graph defect. Inspected
drives (C: 492 MiB free, D: 174062 MiB free at that check), reran the whole suite
using a unique D: temp root, and all runnable tests passed. No controller test or
dependency gate was weakened.

Cleanup of the stopped MON-017 temporary PostgreSQL directory was rejected by
automatic approval review as `blocked by policy`, without a more detailed reason.
Left it in place and continued using a new fixture cluster; no bypass attempted.
MON-023's fixture cluster is stopped and its data directory retained as well.
Cleanup is not a financial/task-completion blocker; no configured DB was altered.

No full build, Next dev server, Docker, schema generation, configured/production
migration, live provider, deployment or independent review ran. The broader
migration regression suite was not repeated; both operation fixtures run committed
migrations on their own disposable DBs. HTTP/OAuth/session/browser/PostgreSQL-16,
concurrency/replay, full-range report/domain/UI and IRR qualification remain pending
their assigned tasks. Existing accounting defects remain assigned release work.

## Review and handoff

See MON-023-review-1. Self-review approved this CRUD slice; no remaining scoped
blocker. MON-015 retains final combined auxiliary/report acceptance, with other
children unfinished. Next controller-ready task after completion is MON-016 by
phase/priority/ID ordering. All work remains uncommitted, including MON-017.
