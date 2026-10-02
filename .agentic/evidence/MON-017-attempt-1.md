# MON-017 attempt 1 - contact exact boundary adoption

## Identity

2026-10-02, Asia/Tehran. Operator: codex. Entry HEAD
`c2383090e08358065aa76f61768a88a346813a3a`, clean working tree at entry.
Changes remain uncommitted. Synthetic disposable PostgreSQL 18.6 fixtures,
not the configured `dubbl` database; self-review only, no independent human,
accounting, production or deployment approval.

## Implementation and bounded scope

Controller validate/status/context selected MON-014. Read root/nested instructions,
START_HERE, controller, project/repository map, backend role, MON-011/013 evidence,
ADR-006, money manifest/source migration/API sections and actual routes/tools.
Verified independent core writers for contacts, journals, receivables, payables,
banking/payments/expenses and organization/tax configuration. Split per controller:
MON-017 through MON-022 inherit MON-011; MON-014 retains all original criteria and
depends on the children. Task index/source coverage updated, no cycle or silent
scope removal. Started and implemented only MON-017. 72 tasks after splitting.

- `lib/api/contact-wire.ts` defines described nullable numeric/string credit fields,
  canonical nonnegative int64 validation, exact dual-alias agreement and safe-number
  pre-write conversion. Missing/null/zero remain distinct. A valid unsupported exact
  value is classified 422; malformed/conflicting input is validation failure.
- Collection and ID REST handlers preserve response envelopes/numeric limits, add
  `creditLimitMinor`, and use guarded JSON. Creation accepts credit aliases too.
  The list returns balance aliases from PostgreSQL text sums and bigint addition,
  replacing int32 casts/Number arithmetic. Mixed document/contact currencies and
  unsafe individual/combined totals fail with 422. Nothing is rescaled or converted.
- MCP contact create/update accept the same aliases using direct Drizzle/wrapTool;
  list/get return them. Schema/descriptions state units, null behavior and range.
  MCP create now normalizes/validates ISO codes as REST does. Both mutations audit;
  REST audit calls are awaited while retaining the best-effort helper.
- ID updates/soft-deletes scope both lookup and mutation to org/not-deleted rows.
  Review found merge children without organization columns relied only on contact
  IDs. Both REST/MCP now guard bank transactions via accounts, batch items via
  batches and tags via tags. MCP also transfers people, matching REST. Transactional
  deduplication/soft-delete, target credit limit and document amounts are preserved.
- Added pure contracts and real PostgreSQL REST/API-key/custom-role/registered-MCP
  fixtures. Added CONTACT_WIRE_CONTRACTS, public API docs, money README, manifest,
  test matrix and refreshed source inventory. Three REST files and all six contact
  tool operations are inventoried, including nonmonetary merge/delete.

Numeric business/ORM support remains 0 through 9007199254740991 for limit writes;
full int64 consumers remain MON-007/008. Unsafe history fails before modification
and is not rounded/repaired. Signed safe historical reads are preserved. Entire
REST pages with incompatible currency amounts fail rather than returning misleading
combined totals. Currency-grouped reporting is not newly implemented. No feature
flag, schema, migration or production database change.

## Acceptance mapping

1. CONTACT_WIRE_CONTRACTS inventories six REST and six MCP operations: input/output
   aliases and envelopes, actual existing units, nullable/omitted fields, safe ranges,
   errors, auth/org/resource/currency-plan policy, unchanged metadata/relations,
   merge/audit behavior and explicit exclusions. Source demonstrates alias agreement
   without Number parsing or currency rescaling; tool descriptions and public docs
   match the bounded contract.
2. `tests/contact-wire.test.ts` has three groups covering old/exact/dual inputs,
   omitted/null/zero/safe-max/above-int32 limits, USD/IRR/JPY/KWD unchanged integers,
   canonical syntax/conflicts/ranges, safe output and exact aggregate overflow.
   `tests/integration/contact-wire.test.ts` calls the actual worker on a freshly
   migrated disposable DB. It exercises all six registered MCP operations and all
   six REST exports with real hashed synthetic API keys/custom-role/member auth,
   two orgs, legacy/exact clients, foreign-ID denial and read-only denial. Merge
   fixtures include deliberately cross-org child FKs; foreign amounts/references
   stay unchanged, scoped children/people move and tags deduplicate.
3. Contact/audit snapshots remain equal after invalid create/update requests on
   both transports, range conflicts, int64 syntax/range errors and auth denials.
   Real list SQL totals exceed int32, reach safe-max, reject combined-overdue overflow
   and reject differing document currencies. Deleted/draft/foreign-org documents
   are excluded. Unsafe historical ORM reads reject REST/MCP list/get/update/delete/
   merge before writes; raw SQL verifies original amount/name/deleted state and
   unchanged audits. Numeric fields plus exact aliases round-trip without bigint
   JSON crashes; mutation envelopes remain compatible.

## Verification

All commands ran in `D:/Projects/dubbl`.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start/split | Exit 0; 72-task graph valid | Structural workflow validity only |
| `node --import tsx --test tests/contact-wire.test.ts` | Exit 0; 3/3 | Pure alias/aggregate groups |
| `node --import tsx --test tests/integration/contact-wire.test.ts` | Final exit 0; 1/1 worker with numerous assertions | Disposable migrated PostgreSQL 18.6; real REST exports/registered tools, no HTTP OAuth/session transport |
| `npm test` after merge code changes | Exit 0; 91/91 | Last ISO create-schema normalization additionally covered by final integration/typecheck/targeted lint |
| `npx tsc --noEmit` after final runtime/fixture changes | Exit 0 | Existing generated Next/MDX files; no full build |
| `npm run lint` | Exit 0; 0 errors/167 existing warnings | Full run after merge edits; final ISO normalization has clean targeted lint |
| `npx eslint` changed runtime/tests, then final contacts tool/worker | Exit 0; clean | Includes new helper, three routes and all new tests |
| `python -m unittest discover -s .agentic/tests -v` | 32 run, 31 pass/1 Windows symlink-privilege skip; exit 0 | Controller only; 72-task graph resolves |
| `python .agentic/scripts/money_inventory.py --write`, then without `--write` | Exit 0; 410 columns/1,315 scanned files/1,099 consumers/21,364 occurrences | Source coverage only, not every-domain qualification |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | Actual Drizzle columns/consumer hashes/occurrence lines |
| `git diff --check` | Exit 0 after whitespace cleanup | LF/CRLF notices only |
| Separate PostgreSQL initdb/pg_ctl start, fixture DB create/drop, pg_ctl stop | Exit 0 | Synthetic trust-auth cluster bound to 127.0.0.1:55441; configured target/roles untouched |

One intermediate integration run failed because its second merge fixture expected
a moved tag row to survive even though the target already carried that tag. Kept
the correct deduplication behavior and corrected the fixture to assert retained
target tag/deleted duplicate; final fixtures pass. Initial diff check found two
trailing-whitespace lines introduced while editing; removed and verified clean.

No full build, Next dev server, Docker, schema generation, migration on the
configured/production DB, live financial provider, deployment or broader financial
release qualification was run. Full migration regression suite was not repeated;
the new operation fixture invokes committed migrations on its own disposable DB.
PostgreSQL 16/HTTP/session/browser/concurrent-merge and independent human reviews
remain unverified. Existing baseline accounting defects remain assigned work.

## Review and handoff

See MON-017-review-1 for actual self-review findings. No remaining scoped blocker.
MON-014 remains an integration parent waiting for its other children. The controller's
next ready task after completion is MON-015 by phase/priority/ID ordering; no manual
competing progress counter or priority override. All changes are uncommitted.
