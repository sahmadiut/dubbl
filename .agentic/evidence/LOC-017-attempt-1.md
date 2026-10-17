# LOC-017 attempt 1 - combined provider and data settings acceptance

## Identity and scope

2026-10-17 (Asia/Tehran), coding-assistant, D:/Projects/dubbl, master. Entry HEAD
9561a98448c8e57601ee7a6e7d99c6e27462969c; entry working tree was clean. The user
requested completing/pushing the next task and pushing all files. Controller
validate/status/next/context selected LOC-017 as the ready integration parent of
LOC-018/019/020; started it through the controller. No other task was started and
no subagents were used. Read applicable instructions, project/controller/frontend
guidance, child evidence, catalog inventories, actual UI/REST/MCP sources and
the relevant source requirements. Child completion was not parent acceptance.

## Implementation and acceptance mapping

1. Independently reviewed the complete provider/document/data slice and combined
   rendering/source-contract tests. Eight namespaces retain matching English and
   initial Persian keys; the complete catalog has 2,152 keys per locale.
   SETTINGS_PROVIDER_DATA_ACCEPTANCE.md links child inventories and explicit
   technical/user/provider/date/number exceptions. The changed empty-trash message
   accurately describes organization-wide scope outside current filters/pages.
2. Closed template CRUD and empty-trash MCP gaps with strict, described tools
   using the same direct-DB services as REST. Template writes retain permission,
   org scope, saved literal content, nullable/omitted fields and soft deletion.
   Default changes now serialize per organization and atomically clear same-type
   defaults on create and update; concurrent REST/MCP creation is checked.
   Empty trash retains delete:organization, adds explicit MCP confirmation and
   atomically purges all org trash. Injected late failure proves full rollback.
   Updated the direct-JSON registry for routes now using the shared response layer.
3. Repaired export selection: multiple selected CSV files now use their existing
   individual endpoints and one client ZIP with exact payload bytes. Dates apply
   only to transactional selections. All-export retains the server's consistent
   snapshot ZIP and now receives dates with the correct .zip filename. Request
   fixtures change only for the intentionally replaced export branch. New tests
   independently decode ZIP local headers and assert exact filenames/CSV bytes.
4. Further source inventory found billing-summary, billing-portal and Stripe
   mapping MCP gaps. Added shared services and strict tools for these existing
   operations. Mapping references must be live and org-owned; saved-field replies
   exclude provider credentials. Existing plan IDs, checkout/OAuth/network
   contracts and actual settings-page request payloads remain unchanged.
5. Persian wording remains provisional; native L10N, RTL and the wider LOC-012,
   LOC-006 and LOC-002 integrations are independent. This task does not qualify
   stored money/FX, provider availability or production IRR. No schema, migration,
   dependency, ledger amount, accounting policy or rollout flag changed.

## Owner scope instruction received during verification

After the above implementation, the owner explicitly directed that future tasks
leave Stripe unchanged because they do not use it for this project in Iran.
Retain this task's already-made changes; do not delete or disable the integration.
Recorded DEC-008, STRIPE-scope-decision-2026-10-17.md, root AGENTS.md, START_HERE
and LOC-012's handoff. A small memory update note was written under the authorized
memory extension folder. No further Stripe implementation was added after that
instruction. Subsequent commands verify existing changes. Stripe-specific future
work and gaps must not block continuation without owner reauthorization.

## Actual verification

All commands ran from D:/Projects/dubbl. A new dedicated PostgreSQL18 cluster on
127.0.0.1:55417 used trust-auth fixture user dubbl_ci. TEST_DATABASE_URL explicitly
selected it; fixtures created/dropped randomized migrated databases. PG_BIN
selected matching PostgreSQL18 backup binaries. No application database was read
or mutated. Final SQL found zero disposable databases; pg_ctl fast shutdown
stopped the dedicated server successfully.

| Command/check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-017 | Exit 0; selected one integration task; 247 valid tasks |
| Focused provider/document/data and new parent tests | Initial 21/22 passed; corrected a test's missing technical-literal exceptions; final full suite includes all 22 passing |
| `node --import tsx --test tests/integration/settings-provider-data.test.ts tests/integration/generic-import-export.test.ts` | Exit 0; 2 integration groups passed |
| `node --import tsx --test --test-concurrency=1 tests/integration/backups.test.ts tests/integration/stripe-contract.test.ts tests/integration/document-rendering.test.ts` | Exit 0; 3 integration groups passed |
| Final expanded `node --import tsx --test --test-concurrency=1 tests/integration/settings-provider-data.test.ts tests/integration/stripe-contract.test.ts` | Exit 0; 2 groups passed with new billing/portal/mapping/default-concurrency assertions |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` final | Exit 0; 649 passed, zero failures/skips; 85.609 seconds |
| `pnpm typecheck` final | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` final | Exit 0; zero errors, 75 existing warnings |
| Changed-file ESLint, computed from changed/untracked TS files | Exit 0; 23 files, one existing duplicate-disable warning in trash.ts |
| `pnpm i18n:check` | Exit 0; 2,152 compatible keys in each locale |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1,642 consumer files; source/hash/occurrence refresh only |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; all schema/hash/occurrence checks passed |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `git diff --check`; controller validation | Exit 0; repeated before disposition |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

The first parallel whole-suite/integration attempt exhausted host memory and
crashed Node processes. Rerunning with limited concurrency succeeded. An interim
unit run caught the obsolete direct-JSON route registry entry after moving empty
trash to the shared response helper; updated the registry, then the final complete
suite passed. No failed/interim result is represented as a passing check.

The PostgreSQL parent fixture uses real REST handlers, linked registered MCP and
independent SQL-text assertions for exact saved template content/defaults,
concurrency, cross-tenant non-disclosure, denied writes, live/soft-delete states,
old trash, injected purge rollback, successful purges and audit rows. Expanded
mapping assertions cover foreign/deleted references and persisted credentials
remaining unchanged. Portal success uses a local provider stub with exact saved
customer/return URL and no provider call on denied/missing-account branches.

## Review, limits and handoff

See LOC-017-review-1.md for honest self-review. Selected exports use per-entity
snapshots, unlike the single all-export snapshot. The existing trash filter omits
backups even though returned labels/global purge include them. Bulk purge can
still fail on FK constraints; it now rolls back all deletions. Audit retains the
existing best-effort policy. These are explicit limits, not hidden acceptances.

No browser click/layout/font qualification, native terminology approval, full
RTL, live provider calls, PDF visual/physical print review, build, dev server,
Docker, deployment or hosted CI was performed. Complete controller disposition,
commit all reviewed files under the user's explicit instruction, push
origin/master, verify remote SHA/clean tree, report the next task and stop.
