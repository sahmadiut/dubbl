# MON-006 attempt 1 - final API and serialization compatibility

## Identity

2026-10-10, Asia/Tehran. Actual operator: coding-assistant, self-review only.
Entry master HEAD ead4a736733eb9e8e1a8c202072b24b778d4c709, clean working tree.
The user authorized completing and pushing the next task. Live validate/status/
next selected MON-006 after MON-004/011/012 completed. Claimed this one parent
and preserved its three original acceptance criteria. This evidence was written
before committing the changes.

Dedicated synthetic PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon006-pg-5483919b4d05416ca67fe6aef494c0ca,
127.0.0.1:55406, trust-authenticated synthetic dubbl_ci role, loopback only,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL selected
this server. Harnesses created/migrated/dropped random dubbl_ci_* databases and
gave workers their disposable DATABASE_URL. No application database or .env was
read or changed. Final fixture database count was zero and pg_ctl stopped this
cluster successfully. Temporary cluster files remain.

## Implementation and source review

Read root/nested instructions, controller/project/repository map, selected and
dependency tasks/evidence, source migration/API compatibility sections, ADR-006,
complete boundary inventory, shared wire/REST/MCP adapters, ORM, journal and
invoice schemas, actual handlers/full tool registration and integration harnesses.
The completed rollout already supplies the required runtime behavior. No duplicate
service, public operation, application schema/migration or flag change was needed.

- Added independent serialization-compatibility harness/worker, rather than
  inferring parent acceptance from child completion. Scratch PostgreSQL bigint/
  numeric values travel as SQL text through money/rate input, DTO, explicit exact
  REST JSON and shared MCP wrapper; safe legacy projections and incompatible
  ORM/numeric bridges are checked separately. Nine signed values, four currencies
  and three rates exercise 108 combinations, including both int64 edges and
  values above JS precision, 10^-18 and the maximum 20/18 rate. This demonstrates
  primitive transport capacity, not full-int64 public business capability.
- Actual API-key REST invoice handlers and full registered SDK MCP create/read
  128 documents: USD/IRR/JPY/KWD; 1250, -1250, 3000000000 and both signed safe
  edges. Numeric major, agreeing numeric/minor dual, exact major and exact minor
  prices retain the raw integer. Exact major/minor cover safe edges where numeric
  major decimal spelling is not necessarily exact. Expected major text uses an
  independent integer formula; raw stored totals agree with both transports.
- Selected document/line/audit/organization snapshots verify no changes for
  malformed/conflicting/out-of-int64/unsupported large input through both clients.
  Four genuinely unsafe retained SQL values fail REST/MCP reads with classified
  compatibility errors and unchanged storage. Locale/exact-looking headers do
  not negotiate a different mode, alter numeric output or bypass range checks.
  Spoofed organization headers do not change the API key's organization.
- New SERIALIZATION_COMPATIBILITY_CONTRACTS joins the foundation and complete
  endpoint inventories, current safe bounds, currency versus fixed-two units,
  numeric/exact client behavior and pending authorized deprecation window.
  Updated ADR-006 with a current adoption note while preserving its historical
  foundation discussion. Updated money README/manifest/test matrix and refreshed
  lexical inventory for the two new fixture sources.

## Acceptance mapping

1. **No bigint JSON serialization crash.** The new migrated SQL-text/adapter
   fixture round-trips nested bigint through exact REST/MCP serialization and
   legacy-safe adapters. Incompatible legacy values and unsafe/nonfinite Numbers
   become classified failures instead of rounded Numbers/null. No global BigInt
   prototype patch is present. The actual public handler/full-SDK fixture and
   independent MON-012 combined event regression pass without serialization errors.
2. **Supported old/new clients.** New parent fixtures preserve numeric major,
   agreeing dual, decimal-major string and raw minor string semantics in four
   currencies, positive/negative money and exact signed safe edges. The rerun
   combined event fixture connects eight legacy/exact recognition scenarios to
   FX, GL/account detail, P&L/budget, CSV, snapshot, public reads, HTML and UBL.
   FX/journal/core/auxiliary/public suites add deeper envelopes and authorization,
   grants, tenant, lock and audit policy. Complete linked operation inventories
   retain their explicit business limits and deprecation policy.
3. **No silent truncation/unit change.** Stored integer units agree with both
   clients. Unsupported valid signed int64 inputs fail LEGACY_NUMERIC_RANGE/422
   before document/audit/organization mutations; malformed or conflicting aliases
   fail validation. Genuinely unsafe retained SQL values fail reads, remain stored
   unchanged and cannot be bypassed by locale or undocumented headers. Exact
   transport/storage capability is explicitly separated from the still guarded
   number-domain/public business range. Existing combined snapshots additionally
   cover whole-public-table failure state excluding API-key usage bookkeeping.

## Verification

All commands ran from D:/Projects/dubbl; integration commands used only the
synthetic server above. No build, dev server, Docker, live provider or deployment.

| Command / procedure | Actual result | Limit |
|---|---|---|
| node --import tsx --test tests/integration/serialization-compatibility.test.ts | Exit 0; 1/1 passed | New independent parent storage/adapter/actual-client fixture |
| node --import tsx --test --test-concurrency=2 tests/integration/exact-boundary-integration.test.ts tests/integration/fx-wire.test.ts tests/integration/journal-wire.test.ts tests/integration/core-accounting-integration.test.ts tests/integration/auxiliary-report-integration.test.ts tests/integration/public-boundaries-integration.test.ts | Exit 0; 6/6 passed | Actual boundary-family/event/FX/journal regressions; no claim every historical suite was rerun |
| pnpm test | Exit 0; 371/371 passed | Existing money-wire, ORM, UBL and source inventory closure included |
| pnpm typecheck | Exit 0; MDX/tsc passed | No full build |
| pnpm exec eslint tests/integration/serialization-compatibility.test.ts tests/integration/serialization-compatibility-worker.ts | Exit 0; clean | Both new source files |
| pnpm lint | Exit 0; 0 errors, 104 existing warnings | Matches current prior-task warning baseline |
| python .agentic/scripts/money_inventory.py --write, then without write | Exit 0; 415 columns, 1938 sources, 1436 consumers, 27357 occurrences | Lexical source ownership, not transitive financial proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; refreshed columns/hashes/source lines verified | Drift validation |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9/9 regressions passed | Existing legacy arithmetic gate |
| python .agentic/agent.py validate | Exit 0; 177 tasks valid | Controller structure only |
| git diff --check | Exit 0 | Line-ending notices only |
| psql fixture database count / pg_ctl fast stop | 0 databases / exit 0, stopped | Dedicated local cluster; files retained |

The first inventory verification reported expected drift after adding the new
fixture files. Refreshed the source inventory and reran both inventory checks
successfully. No integration, unit, typecheck or lint repair was needed. Local
PostgreSQL 18/Node runtime verification does not establish hosted CI/PostgreSQL 16
results. No full CI run, accounting/human/linguistic/security approval or visual
PDF/browser qualification is claimed.

## Review and handoff

Actual self-review is MON-006-review-1.md. No unresolved scoped blocker.
Complete evidence-backed controller checks/submission/self-review/done, commit
task-owned changes, perform the authorized origin/master push and compare remote
SHA/clean-tree state. Stop after MON-006; expected next task is MON-007 core
accounting consumer cutover. Number-domain/full-int64, migration, accounting,
security, localization, production IRR and release gates remain independent.
