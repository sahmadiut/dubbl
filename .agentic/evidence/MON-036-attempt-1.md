# MON-036 attempt 1 - journal lifecycle and import contracts

## Identity

2026-10-02–03, Asia/Tehran. Operator codex; entry HEAD
`67d941d775ceac82f9ea1fcb875122888dda1a9a`, clean working tree. Changes remain
uncommitted. Self-review only; no independent peer/human accounting, migration,
security or deployment approval is asserted.

Read root/nested instructions, START_HERE, project/repository map/controller,
selected task and dependency evidence, ADR-006, journal CRUD/money registries and
actual REST/MCP/automation/import source. Controller selected and started exactly
MON-036. No delegation, extra task, build, dev server or deployment.

## Implementation

- journal-lifecycle.ts shares org-scoped direct-DB post/void/recode/scheduling.
  Header locks and conditional updates prevent duplicate posting/reversals;
  responses serialize inside transactions. Saved FX is selected as SQL text and
  DTOs preserve REST historical decimal strings with raw Minor/rate metadata.
- MCP post_entry now checks period/closed-year locks and active scoped dimensions;
  post/void MCP now log audits. Void mirrors raw stored values without another
  FX conversion, preserves dimensions/rate metadata and atomically links both
  posted headers. Reversal keeps transport-specific reference/description behavior.
- Existing historical inactive/deleted refs may be mirrored/retained if org-owned;
  new post/target/import choices require active refs. journal-references gained
  explicit historical mode and dimension-only validation without fake accounts.
- Recode validates targets even on empty selections, scope/date/filter shape,
  original dimensions and locks. Locks selected headers/lines, updates dimensions
  atomically and audits changes. It never decodes monetary columns. Changed lines
  must carry qualified saved FX, preventing DB-trigger repair of null history.
- Scheduling validates canonical dates/order, original/target locks and unreversed
  state, sharing locked header mutation and audit. Scheduled execution is unchanged.
- journal-import-wire.ts retains explicit REST fixed-two-decimal versus MCP cents
  inputs. Both accept canonical debitAmountMinor/creditAmountMinor, reject conflicts
  and unsupported ranges before job creation, and use bigint group sums. Exact
  decimal parsing rejects junk/extra precision/signs instead of parseFloat rounding;
  formatted text retains valid historical US/European thousands and symbols.
  Large numeric decimals require text before JSON can lose a cent.
- journal-import.ts preflights groups/account scopes/locks and atomically writes
  each header/legs; failures cannot leave orphan headers. Independent groups retain
  partial-job counts/status/errors. Account matching is literal case-insensitive
  equality, with wildcard/ambiguity rejection. Imports enforce manage:entries and
  posted imports additionally require post:entries; all successful jobs audit.
- New registered preview_journal_entries gives MCP parity with REST preview using
  the explicit cents contract, row and summary exact aliases. Existing entry/import
  tool registration suffices; no new tool file or HTTP self-call.
- Updated API/money documentation, test matrix, money manifest and conservative
  machine inventory. JOURNAL_LIFECYCLE_WIRE_CONTRACTS documents every adopted
  boundary, units/aliases, range, invalid-history behavior and remaining gates.

## Acceptance mapping

1. The new lifecycle registry inventories five REST/six MCP operations, header/
   count versus monetary envelopes, fixed REST decimal/MCP cents units, exact
   aliases, formats/date preprocessing, raw automated/manual amounts, saved FX,
   value/sum/rate/numeric-decimal limits and legacy partial-job semantics.
2. Real API-key/custom-role REST handlers and registered MCP SDK/client operations
   over InMemoryTransport execute on a fully migrated disposable PostgreSQL DB.
   Legacy/exact/dual clients, int32-plus/safe-max values, both tenant directions,
   arbitrary org header override, roles/permissions and account/dimension scopes
   are asserted. Auth rejection uses invalid API keys; no session/OAuth assertion.
3. Wire errors leave entries/legs/jobs/audits unchanged in snapshot fixtures.
   Unsafe history/sums and null reversal/recode FX fail without repair. Mirrors
   preserve raw amounts and saved tiny rates without products/reconversion.
   Forced PostgreSQL insert errors roll back reversal and each imported header;
   a sequence-controlled fault after one recode update rolls back the whole
   operation. Concurrent voids produce one mirror. Business-invalid groups
   deliberately keep job metadata/errors while writing no financial rows for
   those groups, preserving existing partial-import behavior.

## Verification

All commands ran in D:/Projects/dubbl. Synthetic PostgreSQL 18.6 cluster at
`D:/Temp/dubbl-mon036-pg-90a3822612e443deaf5659a497d556c5`, loopback port 55445,
password-free fixture role dubbl_ci. Explicit TEST_DATABASE_URL points to this
cluster. Tests migrate/drop only randomly named dubbl_ci_* databases; application
DATABASE_URL/.env credentials were not read/printed/persisted or used. Cluster
stopped at end; temp cluster directory retained, not recursively removed.

| Actual command/procedure | Observed result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; 87-task graph valid, MON-036 selected | Structural state only |
| node --import tsx --test tests/journal-import-wire.test.ts | Exit 0; 3/3 groups | Pure decimal/alias/sum/preview/date helpers |
| npm test | Exit 0; 104/104 | Full units before final historical-reference/preview refinements; these subsequently covered below |
| Final node --import tsx --test tests/journal-import-wire.test.ts tests/integration/journal-lifecycle-wire.test.ts tests/integration/journal-wire.test.ts tests/integration/contact-wire.test.ts tests/integration/budget-wire.test.ts tests/integration/public-portal-wire.test.ts | Exit 0; 8/8 (three pure groups, five migrated workers) | Actual handlers/SDK, not HTTP/session/OAuth/browser |
| Final npm run typecheck | Exit 0; MDX and tsc | No build |
| npm run lint | Exit 0; 0 errors/159 warnings | Full lint before last historical-ref/preview refinements; warnings decreased from previous 167 by unused-import cleanup |
| Final targeted npx eslint on all adopted REST, services, references, MCP, unit/worker/test files | Exit 0; clean | After final implementation/fixture changes |
| money_inventory.py --write, then reproducibility scan | Exit 0; 410 columns/1338 scanned files/1110 consumer files/21626 occurrences | Conservative lexical inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle exports, hashes and occurrence lines agree |
| psql version/count and pg_ctl -m fast -w stop | PostgreSQL 18.6, 0 fixture databases, exit 0/server stopped | Synthetic local cluster only |
| git diff --check | Exit 0 | Line-ending conversion notices only |

Initial fixture failures were corrected, not counted as passes: PostgreSQL text
rate scale differed from an assumed zero suffix; assert normalized identity form.
Unauthenticated session paths cannot run outside Next request scope; negative auth
uses invalid API keys rather than claiming session behavior. Synthetic null-FX
history injection requires disabling both sync and exact-input guard triggers
inside a disposable transaction, then re-enabling them; normal writes keep both
guards. Expanded final fixture run passes after these corrections.

No schema/migration/rollout flag change, full build, Next dev, Docker, configured
DB migration, production/provider request, browser or human review. Full domain
balance/FX conversion and currency-aware imports are not claimed. Post retains
creation's balance policy; imports keep USD/1:1 and fixed legacy decimal units.
Cross-request import retry idempotency, concurrent MAX+1 allocation across
different entries/jobs, reference/lock races, interrupted job finalization and
best-effort audit durability retain domain/QA gates. Scheduled auto-reversal and
shared document reversal helpers are unchanged. These limits are documented,
not hidden completion claims or blockers for this bounded contract slice.

## Review and handoff

Actual self-review: MON-036-review-1.md. No remaining MON-036 blocker. Next is
MON-037 recurring templates/generation; MON-018 retains combined integration,
MON-007/QA retains domain/scheduled qualification. Changes uncommitted for review.
