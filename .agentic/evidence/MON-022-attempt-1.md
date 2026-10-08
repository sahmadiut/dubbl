# MON-022 attempt 1 - organization and tax configuration integration

## Identity and scope

2026-10-09, Asia/Tehran. Operator coding-assistant (Codex), D:/Projects/dubbl,
master, entry HEAD 977fe1a079f352c0ac5caab3b6a352808f609b93, clean working tree.
User requested complete and push next task. Controller validate/status/next/context
selected MON-022, the ready integration parent of completed MON-070..073; claimed
with start --owner coding-assistant. Exactly one bounded task, no delegation.

Read root/nested AGENTS, START_HERE, controller/project/repository map/backend
role, task/dependency attempt and self-review evidence, ADR-006, source migration/
API compatibility sections, money manifest, child wire registries and actual
organization/tax/approval services, handlers, tools, consumers and fixture helpers.
Used the local Dubbl controller task skill for scoped completion and push workflow.

## Result

Existing child services and tools meet the parent contracts; no runtime duplicate
or schema migration is needed. Added an independent combined integration fixture
and configuration registry, updated test matrix/manifest and refreshed lexical
inventory for the two new fixture files. Child evidence stays immutable.

The combined worker uses registerAllTools with real SDK clients: all 33 relevant
tools register once, full input schemas reject unknown keys and every top-level
field is described. Actual REST handlers use API-key hashing, memberships/custom
roles and spoofed tenant headers; MCP uses scoped AuthContext/InMemoryTransport.

Settings preserve minor-unit 1250 and exact aliases, pre-journal currency switches
retain values, profile retries skip existing rates and jurisdiction upsert/read
parity holds. Actual tax/components and currency-filtered approval configure
legacy major-price REST and exact minor-price MCP invoices in USD/JPY/KWD. Both
produce subtotal 3000000000, tax 300000000, total 3300000000. Editing the rate to
2000 basis points cannot rewrite saved invoice tax. REST/MCP approval and send
produce exact balanced recognition with identity FX.

Period creation and cross-transport filing freeze VAT/net 600000000 and matching
clearing GL. Two numeric/exact settlements of 300000000 each close output VAT
and suspense to zero, with bank balance -600000000 in every currency's unchanged
base minor units. Refiling rejects unchanged. Legacy IRR configuration reads and
mileage edits preserve 1250; currency selection and filing stay gated.

Foreign-ID reads, denied roles, malformed/conflicting/unsafe aliases and unknown
tenant or unsupported settings fields fail without domain mutation. SQL-text
snapshots cover organization/accounts/tax configuration/periods/frozen boxes/
approval configuration/actions/invoices/numbering/GL/audit. A check constraint
injects real audit failures; mileage, rate/workflow patches, filing status/boxes/
control creation/journal and settlement all roll back. Lifecycle delegates retain
their child audit policy; no new document-wide atomic audit guarantee is inferred.

## Acceptance mapping

1. CONFIGURATION_INTEGRATION_CONTRACTS.md indexes all four detailed registries,
   operations/envelope differences, units, numeric/Minor or string/valueMinor
   aliases, safe compatibility and signed int64 threshold ranges. The remaining
   core configuration inventory distinguishes non-money basis points/days/method/
   scheme/switch fields and read-only threshold. Other domains retain explicit owners.
2. New combined fixture plus current reruns of all four child operation suites
   exercise actual REST/MCP legacy/exact clients, complete child operations,
   authorization, organization isolation and cross-domain financial persistence.
   Adjacent invoice lifecycle also passes. Completion is not inferred from children.
3. Current tests verify strict invalid/unsupported input rejection, safe/unsafe
   stored/derived output behavior, complete snapshot rollback on audit faults,
   aliases/unit preservation, canonical conditions/int64 bounds and no bigint
   serialization crash. Child suites retain locks, history and concurrency cases.

## Verification

Commands from repository root with installed dependencies/existing ignored
generated Next/MDX sources. PostgreSQL18 initdb/pg_ctl created synthetic trust-auth
cluster C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon022-pg-4f3baec8ba2348b2832a2dbf70a32e70,
bound only to 127.0.0.1:55422. Explicit synthetic TEST_DATABASE_URL drove random
dubbl_ci_* databases, each applying current committed migrations and dropped
afterward. Configured .env/application database was not read, migrated or reset.
No credentials or real customer data recorded; no provider requests occurred.

| Actual command/check | Result | Limit |
|---|---|---|
| Controller validate/status/next/context/start | Exit 0; valid 173-task graph, MON-022 selected | Structure only |
| Initial four child integration files, --test-concurrency=2 | 4/4 pass, none skipped | Current child verification |
| New configuration-integration.test.ts | 1/1 pass | Actual handlers/SDK, no network server |
| Final node --import tsx --test --test-concurrency=2 tests/integration/configuration-integration.test.ts tests/integration/organization-settings.test.ts tests/integration/tax-rate-contracts.test.ts tests/integration/tax-period-contracts.test.ts tests/integration/approval-contracts.test.ts tests/integration/invoice-lifecycle.test.ts | Exit 0; 6/6 pass, none skipped | Six migrated disposable databases; organization session/email test seams |
| pnpm test | Exit 0; 359/359 pass, none skipped | Pure/transport suite |
| pnpm typecheck | Final exit 0 | No build; existing generated sources |
| npx eslint tests/integration/configuration-integration.test.ts tests/integration/configuration-integration-worker.ts | Exit 0, clean | Changed TS only |
| pnpm lint | Exit 0; zero errors, 106 existing warnings | All warnings outside the added fixtures |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1879 paths, 1407 consumers, 26773 occurrences | Initial check correctly detected new fixture paths; regenerated metadata only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; columns/hashes/lines match | Lexical inventory, not transitive dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | Legacy import lint gate |
| git diff --check | Exit 0 | Git CRLF conversion notices only |
| psql fixture database count, pg_ctl -m fast -w stop | Count 0; server stopped, temporary path note removed | Temp cluster files remain outside repository |

No build/dev server, Docker, schema generation, configured/production migration,
browser/screenshots, deployment or IRR flag change. No failed product assertion
was weakened; the initial inventory drift was resolved by including new fixture paths.

## Review and handoff

Actual implementing-assistant self-review in MON-022-review-1.md; no independent
peer/human/statutory/accounting/security approval. No bounded blocker remains.
Complete controller criteria/submit/self-review/done, validate, commit task-owned
files and push origin/master as authorized. Verify remote SHA/clean tree and stop.
Expected next MON-024; use controller output as authority. Full-int64 document,
historical currency/remediation, genuine session/network/browser/PostgreSQL16,
cash/EC/flat-rate policy, post-commit seed atomicity and financial/production gates
retain their existing scope and are not inferred from this integration acceptance.
