# MON-012 attempt 1 - combined exact API and MCP boundary rollout

## Identity

2026-10-10, Asia/Tehran. Operator: coding-assistant, self-review only.
Entry master HEAD eea34513cb872782a9accd45b022eea75aa42fce, clean working tree.
The user authorized completing and pushing the next task. Live validation/status/
next selected MON-012 with MON-011 and all four rollout children done; no active
or review task existed. Claimed this one parent and preserved its original criteria.
Changes were uncommitted when this evidence was written.

A dedicated synthetic trust-authenticated PostgreSQL 18 cluster ran on loopback
127.0.0.1:55412 with max_locks_per_transaction=256 and jit=off. Explicit
TEST_DATABASE_URL selected it; runners migrated and dropped randomly named fixture
databases and gave each worker only its disposable DATABASE_URL. Application DB
and .env were not read or altered. Final disposable database count was 0 and pg_ctl
successfully stopped this cluster. Temporary cluster files are retained.

## Implementation and audit result

Read applicable instructions, controller/project/repository map, selected and
dependency tasks/evidence, ADR-006, all four parent operation registries and actual
REST/MCP/DB/serializer/report/export/rendering paths. Existing completed domain
services already implement most of the rollout; no duplicate implementation added.

- EXACT_API_BOUNDARY_CONTRACTS joins the FX/core/auxiliary/public operation
  inventories, exact/numeric units, supported ranges and remaining owners.
  EXACT_BOUNDARY_DIRECT_JSON inventories all 89 remaining direct NextResponse.json
  route files by reviewed reply-family policy. Source scan found 554 API route
  files, 531 v1 route files and 103 MCP tool/index files after the new registration.
  Source closure and recursive operation-registry links have automated checks.
- Added independent exact-boundary-integration harness/worker. Eight scenarios
  compose real API-key REST, full registered SDK MCP and migrated PostgreSQL:
  numeric 1250/exact 3000000000, EUR invoices in USD books at 0.8, and same-currency
  IRR/JPY/KWD. Independent bigint expectations connect FX, GL, account detail,
  P&L, revenue budgets, CSV, version 2 backup, public capability reads, HTML and UBL.
- Account detail remained an unadopted projection: REST used Number accumulation
  and direct JSON; MCP coerced SQL sums to Number. Both now share account-detail.ts,
  scoped SQL-text/bigint arithmetic, repeatable-read read-only queries and explicit
  safe numeric/Minor projections. Source/aggregate unsafe values return classified
  422. REST pagination/filter/whole-history totals are preserved; amount sorting is
  exact. Foreign-entry references, drafts and deleted journals no longer contribute.
  MCP get_account registers its complete strict described input schema.
- Existing UBL route/generator used fixed /100/toFixed money and lacked a matching
  MCP operation. Shared invoice-ubl.ts and registered export_invoice_ubl now project
  owned live data with view:data and scoped contact/tax references. All money is
  guarded before output. XML formats bigint money at the saved currency scale;
  combined tax ratio uses exact half-up integers. The REST XML attachment and
  existing required-field error/details envelope remain. No new statutory rules.
- Updated money manifest, test matrix, money README and lexical source inventory.
  No schema/migration, historical rescale, application DB or production flag change.

## Acceptance mapping

1. EXACT_API_BOUNDARY_CONTRACTS links complete inventories for every adopted
   FX/core/auxiliary/public operation and documents the two discovered projection
   closures. It distinguishes currency major/minor, legacy fixed-two fields,
   scaled FX, basis points, physical quantities, counts, literal opaque/native
   payloads and versioned snapshots. Safe-number coexistence, int32 FX/provider
   limits and internal unqualified fiscal-year posting are explicit. Direct JSON
   source closure and recursive registry resolution pass; persisted JSON ownership
   stays covered by the completed opaque integration registry/tests.
2. The new independent combined handler/full-SDK fixture passes all eight legacy/
   exact scenarios. Persisted document units, converted recognition GL, natural-sign
   asset/revenue account balances, P&L and budget actuals reconcile. CSV retains
   fixed-two text while Minor strings, public statements, backup and rendering
   preserve saved currency units. UBL REST/MCP XML agrees at zero/two/three decimals.
   Updating reference FX leaves recognition/report history unchanged. Five deeper
   FX/core/auxiliary/public/ledger regression suites also pass.
3. Whole-public-table snapshots, excluding only API-key usage bookkeeping, prove
   no mutation for malformed/conflicting/unsafe invoice/budget aliases, unsupported
   tiny FX, invalid credentials, empty grants, foreign IDs/tokens, locked posting,
   missing UBL country and unsupported MCP controls. Stored SQL int64
   9007199254740993 rejects invoice, backup, payment-link, CSV, HTML and UBL reads
   through their owning REST/MCP routes. Account tests preserve maximum-safe gross
   totals and running pagination/filter balances; unsafe aggregates and source rows
   fail explicitly instead of rounded serialization. No bigint JSON crash or
   inferred monetary/unit conversion is used.

## Verification

All commands ran from D:\Projects\dubbl. Integration commands used only the
explicit synthetic loopback server described above.

| Command / procedure | Actual result | Limit |
|---|---|---|
| node --import tsx --test tests/integration/exact-boundary-integration.test.ts | Final exit 0; 1/1 integration, eight scenarios passed | Actual handlers/API-key auth/full MCP SDK; no HTTP dev server |
| node --import tsx --test --test-concurrency=2 tests/integration/fx-wire.test.ts tests/integration/core-accounting-integration.test.ts tests/integration/auxiliary-report-integration.test.ts tests/integration/public-boundaries-integration.test.ts tests/integration/ledger-detail.test.ts | Exit 0; 5/5 passed | FX and all four slice/ledger composition regressions; no inference that every historical child suite was rerun |
| pnpm test | Final exit 0; 371/371 passed | Includes UBL safe-edge/tax and two inventory closure tests |
| pnpm typecheck | Final exit 0; MDX/tsc passed | No full build |
| pnpm exec eslint on all twelve changed/new TS source/test files | Final exit 0; no warnings/errors | Focused source check |
| pnpm lint | Exit 0; 0 errors/104 existing warnings | Existing repository warnings remain |
| python .agentic/scripts/money_inventory.py --write, then without write | Final exit 0; 415 columns, 1936 sources, 1435 consumers, 27295 occurrences | Lexical ownership/drift, not transitive financial proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0; columns/hashes/source lines verified | Source closure |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; all 9 regressions passed | No new grandfathered arithmetic |
| python .agentic/agent.py validate | Exit 0; 177 tasks structurally valid | Controller integrity only |
| git diff --check | Final exit 0 | Whitespace |
| Synthetic pg_database count / pg_ctl stop | 0 fixture DBs / exit 0, stopped | Dedicated cluster files retained |

Early fixture runs corrected setup/assertions: required account 1200, journal
schema has no original-debit/credit columns, empty CSV is header-only, identity
rates validate 1:1 before range checks, and MCP contact create has no addresses
input. Country metadata was seeded as a nonmonetary UBL prerequisite. Initial
typechecks caught bigint passed to number-only presentation adapters; corrected
the fixture and validated numeric UBL input before bigint formatting. Unused
imports and a trailing blank line were removed. Final checks above passed against
finished sources; intermediate failures are not represented as passes.

## Review and qualification limits

See MON-012-review-1.md for actual self-review. No separate peer/human review,
accounting/security/linguistic approval, browser/PDF visual fit, live provider,
standards certification, deployment or full-int64 qualification is claimed.
The linked child contracts and their narrow sign/product/FX/provider bounds remain
authoritative. Account detail reads whole account history, as existing REST did;
this task has no production-volume performance qualification. Fiscal-year close/
reopen expose only metadata at the wire, while internal Number-based closing
remains MON-007/accounting work and is not advertised as a newly qualified
large-value posting path. UBL retains existing country/party/template structure
and customization declarations; monetary correctness is not Peppol acceptance.
MON-006 retains independent parent acceptance; MON-007/008, QA-005, migration,
accounting, localization, production IRR and release gates retain their criteria.

## Handoff

Complete the evidence-backed check/submit/self-review/done flow, scoped authorized
commit/push, remote master SHA and clean-tree checks; report next task and stop.
No scoped blocker remains. Expected next parent after closure: MON-006.
