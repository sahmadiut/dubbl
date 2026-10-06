# MON-095 attempt 1 - consolidation configuration contracts

## Identity

2026-10-06, Asia/Tehran. Operator/reviewer: codex, implementing-assistant
self-review. Entry HEAD c8d22c7ff20a60eec5527f066ff94f2873452539 on master;
working tree clean at entry. No peer/human approval or deployment is claimed.

## Implementation and bounded scope

Controller selected MON-028. Read root/nested instructions, START_HERE,
controller/project/repository map, MON-011 evidence, money manifest, applicable
task/source references, schemas, REST/MCP consolidation/accrual/revenue/recurring
writers and existing contract/integration patterns. Verified independent writers
require different accounting checks; split MON-028 into MON-095 configuration,
MON-096 reports/translation/persisted eliminations, MON-097 accruals, MON-098
revenue recognition and MON-099 remaining recurring bill/expense templates.
Children inherit MON-011; MON-096 also depends on configuration. MON-028 remains
blocked with original acceptance criteria unchanged, for combined acceptance.
Task index/source coverage updated. Exactly MON-095 implemented and completed.

Shared consolidation-config services and strict described schemas replace
independent group/member/rule handlers. Eleven operation pairs now have REST/MCP
parity: four missing group MCP CRUD tools, REST member GET and rule list/create/
delete endpoints were added. Existing registration, tool names, list projections
and dashboard envelopes remain supported. All writers require manage:reports.
Parent organization locks serialize duplicate membership checks/deletion;
configuration rows, audit and returned DTO preflight commit atomically.

Group/member reads use explicit public organization projections and current
child membership, rejecting inaccessible/deleted/revoked organizations. Unsafe
historical financial organization settings are excluded rather than decoded or
exposed. Revoked members can be unlinked by a parent manager. Foreign nested
rules and roots are inaccessible; duplicate saved members and invalid saved
currency/rule history fail classified 422. Presentation currency changes reject
saved rate/elimination history. Config currency labels never mutate member GL.

Registry CONSOLIDATION_CONFIG_CONTRACTS maps every input, output, range, envelope
and retry behavior. There are no money/FX inputs in this child; exact monetary
aliases are explicitly not applicable. Numeric counts remain counts. Report
arithmetic and persisted monetary outputs stay MON-096; MCP report loading now
uses the scoped public group loader. The old REST report writer still needs
cross-writer locking/financial qualification in MON-096. No schema/migration,
historical rewrite, money rescale, IRR flag or full-int64 enablement changed.

## Acceptance mapping

1. CONSOLIDATION_CONFIG_CONTRACTS lists all eleven pairs, public projections,
   strict names/labels/prefixes/descriptions, ISO currencies/defaults, numeric
   counts, not-applicable money/FX aliases and supported ranges. MONEY_MANIFEST,
   CI_RUNBOOK and machine inventory refreshed.
2. consolidation-config.test/worker invokes actual REST API-key routes and all
   registered tools over SDK in-memory transport in migrated PostgreSQL fixtures.
   Covers legacy USD name-only and explicit USD/JPY/KWD/IRR currency clients,
   strict/described schemas, custom roles, expired/bad keys, spoofed org header,
   all foreign root/nested paths and inaccessible/revoked/deleted members.
3. Invalid inputs/saved currencies/rules/duplicates fail without configuration
   or audit mutation. Unsafe hidden organization money remains absent from DTOs.
   Every writer's actual failing audit trigger rolls back over REST and MCP.
   Group/member/rule output faults roll back. Concurrent add permits one link;
   add/delete serializes and deleted groups reject further config writes.

## Verification

Commands ran in D:/Projects/dubbl. Disposable PostgreSQL 18 cluster bound only
127.0.0.1:55495, UTC timezone, synthetic dubbl_fixture role. Existing harness
creates/migrates/drops random dubbl_ci_ databases; faults affect only those DBs.
An initial attempt loading local .env as TEST_DATABASE_URL failed CREATEDB
permission before creating any fixture. No configured database schema/rows were
changed; its role permissions were not broadened. A separate cluster then
provided the successful fixture target without application/provider credentials.

| Actual command/check | Result | Limits |
|---|---|---|
| Controller validate/status/context, start/block/split/start | Exit 0; 149 tasks after split | Structure is not financial implementation proof |
| node --import tsx --test tests/integration/consolidation-config.test.ts (final, explicit loopback TEST_DATABASE_URL) | Exit 0; 1/1, no skips; 12257.6175 ms | All eleven actual pairs and negative/fault/race scenarios in one worker |
| pnpm test | Exit 0; 297/297, no skips | Full existing pure/unit suite |
| pnpm typecheck | Exit 0 | MDX generation + tsc; no Next build |
| pnpm lint | Exit 0; 0 errors, 127 existing warnings | No changed-file warnings |
| pnpm exec eslint lib/api/consolidation-config.ts lib/api/consolidation-config-wire.ts lib/mcp/tools/consolidation.ts tests/integration/consolidation-config*.ts app/api/v1/consolidation/groups | Exit 0; no warnings | Final changed TS checks |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1710 scanned files, 1304 consumer hashes, 25737 occurrences | Source-only inventory, not DB migration qualification |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Existing lint gate |
| git diff --check (final) | Exit 0 | Corrected an extra EOF blank line; Git LF/CRLF notices only |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master (before commit) | Exit 0; 0/0 | Current master synchronized before task commit |

Initial changed-file lint found an unused rule import; subsequent saved-rule
fixtures use it and final lint is clean. An initial diff check found extra EOF
whitespace; corrected and regenerated source hashes. No full build, Next dev,
Docker, screenshot, provider, production migration or deployment ran. The
disposable server is stopped after verification; generated local data stays in
its temporary directory, outside tracked files.

## Review and handoff

See MON-095-review-1.md for actual self-review. MON-095 has no remaining blocker.
Next selected child is MON-096; qualify report money/FX/persistence and coordinate
its writers with these locks. MON-028 retains combined acceptance after all five
children. Task-owned implementation, documentation, evidence and split metadata
are committed together; no unrelated pre-existing edits existed at entry.
