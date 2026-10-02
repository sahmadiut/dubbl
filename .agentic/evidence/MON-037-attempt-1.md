# MON-037 attempt 1 - recurring journal contracts

## Identity

2026-10-03, Asia/Tehran. Operator: codex. Entry HEAD
`6c4915534f7d40f68e76e4db3dd636a64b3b1b1d`, clean working tree at entry.
Changes remain uncommitted. Self-review only; no independent peer, human,
accounting or deployment approval is asserted.

Read root/nested instructions, START_HERE/controller/project/repository map,
selected task, backend role, MON-011/035 dependency evidence and self-reviews,
ADR-006, money manifest, source migration/API sections, current recurring schema,
REST/MCP/generation and existing journal helpers/fixtures. Controller selected
MON-037; exactly this child task was implemented. MON-018 keeps final integration.

## Implementation

- Added recurring-journal-wire.ts: shared described schemas, canonical amount
  aliases with exact numeric agreement, safe Number bridges and bigint sum guards,
  one-sided balanced legs, canonical/ordered dates and bounded occurrence caps.
  Strict leg inputs reject dimensions/FX fields that templates cannot save.
- Schema inspection verified no configurable FX storage in recurring templates.
  Fixed exchangeRate 1000000/rateExact "1"/quote_per_base aliases explicitly
  describe existing verbatim posting; unsupported nonidentity rates fail before
  mutation. Generated journal lines explicitly persist identity FX/provenance.
  Currency tags never rescale amounts or claim base-currency conversion.
- Added direct-DB shared CRUD/toggle services. Create header/legs and full edit
  replacement are atomic; edits/status/toggles lock tenant/type/nondeleted parent.
  Tenant-owned active accounts/centers are validated before writes; historical
  reads allow inactive same-org dimensions but reject foreign FKs. Await audits.
- Every recurring-journals REST operation uses guarded JSON and shared services.
  MCP tools keep wrapTool/org context and share these services; added update and
  pause-toggle parity tools through existing registration (eight tools total).
  PATCH preserves omitted fields and saved currency; null clears optional headers.
- Recurring-generate preflights saved dates/currency/amounts/sums/dimensions/counts,
  then commits each template's entire catch-up and schedule in one transaction.
  Parent row locking rechecks status/current legs and prevents duplicate runs of
  that template. Invalid history fails visibly instead of dropping legs or
  consuming the schedule. Existing locked/closed-date skip/consume policy remains.
  Generic document generation is unchanged apart from SQL type filtering instead
  of loading unrelated template kinds before filtering in JavaScript.
- Added operation/range/unit inventory RECURRING_JOURNAL_WIRE_CONTRACTS, API docs,
  money README, test matrix, current manifest and refreshed machine inventory.
  No schema/migration/configured DB/rollout flag change.

## Acceptance mapping

1. The registry documents all seven REST handlers, eight MCP tools and journal
   generation/maintenance boundaries, response envelopes, safe numeric/exact
   aliases, fixed rate semantics, supported line/sum/date/count ranges and errors.
   It records ignored shared-schema quantity/unitPrice/tax/discount fields and
   exclusions instead of implying those belong to this journal input contract.
2. The actual migrated PostgreSQL worker calls imported REST handlers with real
   API keys/custom roles and all registered tools via MCP SDK InMemoryTransport.
   Covers legacy/exact/dual, four currency scales, int32-plus/safe-max values,
   retained currency, header/leg edits, every read/write/status/run operation,
   denied write/read authentication, two tenants and foreign/inactive dimensions.
3. SQL snapshots include exact textual amounts, template headers/legs, generated
   journal headers/lines and audit counts. Invalid aliases/amounts/rates/sums/dates/
   dimensions leave all these unchanged. Forced SQL leg errors roll back header
   creation/replacement; a schedule-update trigger failing after generated entries
   rolls back whole catch-up. Concurrent runs create only three due entries once.
   Unsafe stored amounts and safe individual amounts with unsafe sums fail reads
   and generation with 422 without consuming their schedule. Locked/closed dates,
   soft-delete preservation and cross-org maintenance are verified.

## Verification

All commands ran in D:/Projects/dubbl. Created a synthetic PostgreSQL 18.6 cluster
at D:/Temp/dubbl-mon037-pg-907cec10599d4a52a8cdf7259d5ae116, loopback port 55446,
password-free dubbl_ci role. Explicit TEST_DATABASE_URL pointed only there; tests
migrate/drop random dubbl_ci_* databases, never the configured application target.
No .env credentials were opened, printed or persisted. Final fixture count was
zero and pg_ctl fast/wait stop succeeded. Temporary cluster data is retained.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0; 87-task graph valid, MON-037 selected | Tracker structure only |
| Initial and corrected focused recurring unit/DB run | Final 4/4 pass | Actual handlers/SDK, no HTTP/session/OAuth/browser |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0; 107/107 pass | Full repository units, reduced process concurrency |
| Final six selected integration workers with --test-concurrency=1 | Exit 0; 6/6 pass | Recurring, journal CRUD/lifecycle, contacts, budgets, public portal on migrated disposable DBs |
| Final `npm run typecheck` | Exit 0 | MDX generation plus tsc; existing generated Next sources, no build |
| Final `npm run lint` | Exit 0; 0 errors/159 existing warnings | Full repository lint, same warning count as MON-036 |
| Final targeted eslint on every adopted helper/route/tool/unit/integration file | Exit 0; clean | After all code/fixture changes |
| Money inventory --write, reproducibility scan and verify_money_inventory.mjs | Exit 0; 410 columns, 1343 scanned files, 1113 consumers, 21670 occurrences | Conservative lexical inventory; hashes/lines/Drizzle match |
| PostgreSQL version / fixture DB count / pg_ctl stop | 18.6 / 0 / exit 0 | No temporary server left running |
| git diff --check | Exit 0; LF/CRLF notices only | Uncommitted changes |

Initial checks were not counted as passes. Zod v4 optional create-default currency
leaked into PATCH; replaced the optional currency schema with a default-free one
and verified metadata-only edits retain IRR. The DB FX sync trigger marks explicit
identity writes as exact rather than the initially assumed valid label; writer and
fixture now use that actual status. Typecheck caught unsafe access to union-shaped
fixture legs; explicit property narrowing fixes it without weakening runtime types.

A parallel full-check attempt exhausted Windows memory: two unit child processes
failed allocation, full lint exited 1 without diagnostics, and PostgreSQL recovered
from backend exception 0xC000012D with six workers failing connection/reset/recovery.
This was not recorded as a pass. Re-ran full units and DB workers with concurrency 1;
all passed, then ran final typecheck and lint with reduced simultaneous load.

No full build, Next dev, Docker, schema generation, configured-DB migration,
deployment, live provider, browser or human review was run. Template atomicity does
not mean whole-org run atomicity: earlier templates can commit before a later failure.
Full base-currency/exact-domain math, cross-template MAX+1 numbering, reference/lock
races, operational batch limits and best-effort audit durability retain MON-007/QA
or other boundary qualification. Foreign currency tags at identity preserve existing
behavior; they do not authorize production IRR accounting.

## Review and handoff

See MON-037-review-1.md for the actual self-review. No remaining MON-037 blocker. MON-018 retains combined journal
integration after children; follow controller selection for the next task. Changes
remain uncommitted for review.
