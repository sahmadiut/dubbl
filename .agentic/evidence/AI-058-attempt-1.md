# AI-058 implementation evidence

Date: 2026-11-02. Operator: Codex. Entry HEAD:
`5d12d76fd1cf227f54e9651ec9aea19b62cfe053`, branch master, clean tree.
One controller-selected backend child; AI-011 remains open. No push,
deployment, live provider call, build, dev server or rollout activation.

## Implementation and acceptance mapping

1. `lib/ai/operations.ts` adds own/organization quota explanations with explicit
   billing currency, optional scoped current member, server-generated UTC month
   and reset instant, full monthly per-currency observed partial token sums,
   unknown counts and settled/reserved/unresolved estimated costs. BigInt
   remaining limits include full organization/member data, cross-currency token
   use, rolling rate including cancelled attempts, and all unresolved concurrency
   including previous-month attempts. Missing/zero/exhausted constraints are
   distinct. Costs never combine currencies or enter the ledger. Full filtered
   run/state and step-state counts and duration total/sample counts are independent
   of selected run page. Three read-only repeatable-read services use safe
   projections with live authorization rechecked after reads.
2. Five REST routes under `app/api/v1/ai/operations` and five registered
   `ai-operations` MCP tools share strict described schemas/services. Own reads
   require view:ai-history; organization reads require view:ai-usage without
   transcript auditing. Own Stop requires view:ai-history; organization Stop
   requires manage:ai-policy. Shared Stop logic in run-lifecycle retains legacy
   cancellation behavior and adds exact reviewed-version conflicts and live
   authorization after run locks and before commit. Disable requires
   manage:ai-providers, checks version/authority after configuration locks,
   preserves credentials and audits the transition. It works after delegation
   withdrawal. No operation returns transcripts, arguments, tool names, domain
   references, provider diagnostics, leases or credentials. Operations stay
   excluded from model discovery; reviewed domain tool count remains seven.

Contract, units, privacy, latency meaning and follow-up boundaries:
`../docs/AI_OPERATIONS.md`. Generated capability/coverage registries reflect
112 modules, 834 tools, 597 routes and 210 pages.

## Verification

Repository root: D:\Projects\a\dubbl. Created a task-owned random
`dubbl-ai058-*` PostgreSQL 18 cluster on 127.0.0.1, random port 8826, using
trust authentication. Explicit TEST_DATABASE_URL fed the existing fixture
harness; every suite created/dropped its own random database. No application
DB or existing shared service was used, reset or stopped.

| Command | Result |
|---|---|
| Combined integration command below | 5/5 passed, no failures/skips, 30.4 seconds |
| node node_modules/typescript/bin/tsc --noEmit | Passed exit 0 after test cleanup fix |
| npm run lint | Passed exit 0, zero errors and 20 existing warnings outside owned files |
| Focused ESLint for all changed TS/MJS files/routes/tests | Passed exit 0, no warnings after using operations in lock-race tests |
| node scripts/audit-ai-capabilities.mjs | Passed: source matches generated registry |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: 7 reviewed and 827 unlisted tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine regression checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, 1447 diagnostics; qualification below |
| python .agentic/agent.py validate | Passed: 444 tasks, structurally valid |
| git diff --check | Passed |

```text
node --import tsx --test --test-concurrency=1 tests/integration/ai-operations.test.ts tests/integration/ai-run-lifecycle.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-usage-reports.test.ts tests/integration/ai-tool-registry.test.ts
```

The new integration worker exercises actual REST handlers, linked MCP and SQL:
empty/missing/zero budgets; exact >2^53 values; separate EUR/USD costs;
cross-currency remaining tokens; previous-month unresolved concurrency;
UTC reset serialization; null unfinished duration and exact finished totals;
209 matching runs over three pages with independent full outcome totals;
date boundaries; strict invalid inputs; own/organization/current-member scope;
unauthorized and foreign drill-down; usage-only auditor without history;
foreign configuration rejection; runtime-off Stop/Disable; stale versions;
completed-effect preservation; queued reservation release versus in-flight
unknown retention; credential preservation after disable; withdrawn delegation;
live custom-role/membership revocation in existing MCP closures; revocation
while Stop and Disable wait on actual SQL row locks; and single-winner
concurrent operations at an identical expectedVersion.

Early test attempts caught UTC reset values serialized as PostgreSQL session
timezone strings; explicit timestamp decoding now yields ISO UTC. A test cleanup
variable shadow was corrected. The final commands above passed after both fixes.

Money verifier qualification: current output and a temporary HEAD-source overlay
of the two changed inventoried TS files both have 1447 diagnostics, exit 1.
Ordered diagnostics are NOT identical: current adds the expected
`Source drift: lib/ai/run-lifecycle.ts` hash warning and removes one obsolete
`Pattern mismatch: lib/mcp/tools/index.ts:92 (money_name)` warning after the
registration import moved source lines. All remaining diagnostics match. No
money registry baseline was rewritten to hide this; this is not a green gate
or a new money-arithmetic failure. No schema/migration or monetary accounting
calculation changed. Temporary comparison files/logs contain no application
credentials and are outside the repository.

Final SQL inspection found zero dubbl_ci_* fixture databases. pg_ctl stopped
only the owned cluster and status reported no server running (exit 1 on this installation).
Temporary stopped data/logs remain for diagnosis.

## Review and handoff

Codex self-review is recorded in AI-058-review-1.md. No peer/human review is
claimed. AI-059 owns bilingual dashboard integration, confirmation UI and
interaction testing; AI-011 retains independent assembled acceptance. Native
Persian, browser layout/accessibility, provider qualification, deployment and
activation remain separate. Stripe and provider/usage history are preserved.
