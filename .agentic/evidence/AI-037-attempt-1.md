# AI-037 attempt 1 - durable fenced metered provider attempts

## Identity and scope

2026-10-29, Codex self-operated in D:/Projects/a/dubbl, branch master, starting
HEAD 1c681984. Entry tree was clean. This attempt completes only AI-037. The
controller selected AI-035; source inspection verified its usage reservations
lacked a provider dispatch lease record, atomic attempt association and durable
call binding. AI-035 was split through the controller into required AI-037
(single-turn persistence/metering) and AI-038 (actual dependent loop). Every
original AI-035 criterion remains unchecked for independent integration acceptance.
AI-033/031/023/007 remain open; AI-036 owns process/observation qualification.

No peer/human review, push, live provider call, provider entitlement, pricing,
hosting or rollout qualification is claimed. No application database or ignored
environment setting was read/changed. No Stripe file, behavior or rollout flag was
changed. A task-owned PostgreSQL18 cluster at loopback port 55493 used synthetic
local fixtures and explicit TEST_DATABASE_URL. The harness creates, migrates and
drops randomized dubbl_ci_* databases; it never resets its connection target.

## Implementation and acceptance mapping

1. lib/ai/provider-attempts.ts implements executeProviderAttempt with a trusted
   injected raw transport. Reserve atomically saves provider metadata, immutable
   model/config/policy/tool/permission snapshot and a charged usage identity.
   Dispatch atomically commits random lease binding, in-flight usage and content-free
   audit/event; repeat keys never dispatch and changed requests conflict. Run
   counts include cancelled/unknown usage rows, with a hard eight-attempt ceiling.
   Original price, output limit and full org/user budget ceilings remain pinned;
   live restrictions still apply. Token/cost arithmetic stays exact bigint atoms
   in explicit billing currency. Full-context reservation claims no tokenizer.
   Request bytes consume the cumulative run payload budget, while protocol and
   timeout enforce request/output/model/deadline/lease limits. Internal optional
   usage transactions preserve the prior administrative service API behavior.

2. AI-034 validates the whole raw response before any call is exposed. Validated
   call IDs bind to generated operation UUIDs, catalog versions and the same
   canonical argument digest used by AI-032. Existing tool preparation checks
   this binding and forbids overlap with active provider attempts. Another turn
   cannot bypass an unconsumed accepted call or unfinished tool. Saved metadata
   has no executable args, prompt, response, diagnostic or model narration. Only
   the winning fresh accepted receipt carries original validated calls; recorded
   keys never reconstruct them. Model final text is discarded and no provider
   narration/URL becomes a business result. Live authority is checked again after
   row/advisory/FK waits, including the original attempt's permission envelope.
   Known/partial usage settles despite content rejection or authority loss;
   missing/unknown usage keeps conservative charge and concurrency. Stop, erasure,
   content expiry and both recovery paths close pending attempts without erasing
   known charges or replaying old keys. Late callbacks cannot restore authority.
   Only finite normalized transport failures can be marked transient; there is no
   retry loop. AI-038 must implement bounded retry orchestration.

3. Migration 0023 adds two scoped tables, unique identities, bounded metadata,
   call/operation associations and composite usage/run scope constraints. Drizzle
   generated the migration/snapshot; review reordered its new referenced unique
   constraint before the foreign key, repairing generator DDL ordering. Clean
   application, upgrade from 0022 and repeated migration pass. Four task-owned
   money-inventory classifications were added without regenerating legacy
   consumers. The budget snapshot is explicitly a mixed monetary envelope with
   exact 10^-12 major billing-currency atoms, not accounting minor units.

## Verification

All commands ran from repository root with existing dependencies. No full build,
dev server, Docker, deployment, live provider or background worker was started.

| Check | Actual result | Scope/limitation |
|---|---|---|
| node --import tsx --test tests/integration/ai-provider-attempts.test.ts | 2/2 passed on final source/tests | Real migration upgrade/idempotency and deterministic REST/MCP/SQL execution |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-usage.test.ts tests/integration/ai-tool-operations.test.ts tests/integration/ai-run-lifecycle.test.ts tests/integration/ai-run-input.test.ts tests/integration/ai-persistence.test.ts tests/integration/ai-run-progress.test.ts | 6/6 passed; AI usage also rerun after original-ceiling composition, passed | Existing business/lifecycle/clarification/provenance regression; no live provider |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 10/10 passed | Actual reviewed catalog, pure protocol |
| npx tsc --noEmit | Passed on final source/tests after generated-artifact repair | No build/dev server; see repair below |
| npx eslint over all changed source/test/schema files | Passed, zero warnings/errors on final files | Scoped source verification |
| npm run lint | Exit0, zero errors/20 existing warnings outside task files | Final scoped lint covers later finite transport-error normalization refinement |
| npx drizzle-kit generate | No schema changes, nothing to migrate on second run | Generated schema/snapshot drift check |
| node scripts/audit-ai-capabilities.mjs | Passed | 109 modules, 815 tools, 577 routes, 210 pages unchanged |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed | Exactly seven reviewed business tools unchanged |
| node .agentic/scripts/verify_legacy_money.mjs | 9 checks passed | Existing money regression gate |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1; 1447 existing errors | NOT a green global money gate; exact comparison with clean HEAD described below |
| python -m unittest discover -s .agentic/tests -q -k test_split_releases_slot_and_parent_returns_after_child_completion | 1 passed, 14.217 seconds | Focused controller graph regression, not exhaustive controller/runtime qualification |
| python .agentic/agent.py validate; git diff --check | Passed before submission; completion revalidated | Structural/diff checks |

The provider integration checks competing identical keys (one invocation/charge
and one actionable receipt), changed-key input conflicts, stable actual MCP tool
operation/digest binding, real linked REST/MCP progress/usage parity, scope and
grounded record links, duplicate call IDs, malformed later output, partial usage
above reservation, oversized JSON, timeout and transient/nontransient errors,
spoofed exception codes and wrong transport types. It covers original price/output
limits, live and original budget ceilings, rate/concurrency/cost/token failures,
payload and request caps, stale leases, cancellation, revocation, erasure, and
permission/config/kill-switch/budget changes across real PostgreSQL lock waits.
A separate process is killed after dispatch commits; another process recovers,
rejects replay of the old key, makes a separately charged request and proves
original reservation/ordinal/deadline preservation through independent SQL.

Development verification first found a test harness mistake: statically importing
the executor loaded authentication before its module mock. Moving runtime imports
after mock registration fixed it; all final integration runs passed. Scoped lint
also found an unused test import, which was removed. Earlier typechecks passed;
a later repeat encountered malformed ignored .next/dev/types routes/validator
artifacts containing trailing duplicate fragments. `next typegen` (its local CLI
explicitly documents no full build) regenerated canonical route definitions. The
two malformed dev artifacts were backed up outside the workspace, then refreshed
from that output with relative imports adjusted for the extra dev directory.
No tracked tsconfig, Next source/config or dev process was changed.
The final ordinary typecheck passed with the repaired generated artifacts. The
task-owned PostgreSQL cluster was stopped after all fixture checks completed.

For the money-gate comparison, a clean `git archive HEAD` snapshot was extracted
under a unique D:/temp directory and linked to existing dependencies. The exact
verifier was run in both HEAD and current roots, capturing native diagnostics.
Both exited 1 with exactly 1447 identical error lines. Four new schema-column
classifications remove this task's additions to the missing-column diagnostics;
all old failures remain visible. No bulk inventory refresh or suppressed verifier
rule was used. This is baseline nonregression evidence, not a passing money gate.

## Handoff and remaining boundaries

The actual loop remains AI-038: load live permission-safe record context, preserve
bounded raw UTF-8 in a real disabled transport adapter, dispatch fresh validated
calls through AI-032, integrate durable clarification/answers, implement bounded
transient retries and publish grounded final outcomes. Orphaned accepted handoffs
must fail/reconcile; saved display payloads never authorize replay. Sensitive
tools remain outside the reviewed catalog and need the separate approval boundary.
The single-turn primitive neither finalizes a run nor polls/renews leases. No
provider/model/account/tokenizer, PostgreSQL16, hosted CI, browser/native Persian,
deployment or production acceptance is inferred. The full unit suite and
exhaustive controller suite were not run. Complete the independent parents only
after their own integration acceptance, with default-off settings preserved.
