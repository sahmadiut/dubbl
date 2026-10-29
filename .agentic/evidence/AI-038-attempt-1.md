# AI-038 attempt 1 - dependent provider/tool execution

2026-10-29, Codex in D:/Projects/a/dubbl, branch master, starting HEAD 6728be33.
Entry tree clean. One controller-selected task only; AI-035/033/031/023/007 remain
open. Self-operated verification, no independent reviewer or human approval.

## Implementation and acceptance

1. `lib/ai/executor.ts` serializes one claimed run using a session advisory lock,
   then consumes AI-037 provider attempts and AI-032 real registered MCP tool
   operations. Fresh accepted original arguments/catalog versions/operation UUIDs
   are the only executable handoff. Orphans reconcile; saved display data never
   authorizes replay. Current identity/configuration/policy/cancellation/kill
   switch and immutable cumulative limits remain enforced by existing services.
   Sensitive operations are excluded until AI-008's separate approval service is
   qualified. Closing a run also closes pending provider authority while retaining
   known charges and unknown reservations. No transaction spans an external call.

2. History contains this run's redacted request, permission-checked answered text
   and minimized live receipts/labels. No result blobs, saved call arguments,
   sibling runs, private reasoning or email/phone/notes/attachments are forwarded.
   Rebuild/compare guards run after dispatch waits and again after DNS, before
   transmission. Strict bounded clarification intent uses AI-030's durable input,
   versioned answer and same-run resume; original deadline and ceilings persist.
   Other model final narration and URLs are discarded. Final messages contain
   finite server codes; REST/MCP progress adds receipt-derived whole-run final/
   partial outcome codes and revalidates real record links on every read.

3. Only typed transient provider failures/timeouts retry, with new charged attempt
   identities, at most two transient failures across the persisted run and eight
   total requests. No fallback/model switch or automatic business-tool retry.
   The current MCP error contract cannot prove a read failure transient, so reads
   fail closed rather than retry. `run-transport.ts` resolves only server-owned
   endpoint/model/credential and retains the default-off live gate. `providerPostRaw`
   preserves bounded raw JSON, rejects malformed UTF-8, redirects and compression,
   and retains pinned public DNS/TLS/abort/timeout controls. Administrative probes
   retain their parsed-object API. No schema change or migration is needed.

See [executor contract](../docs/AI_DEPENDENT_EXECUTOR.md) for exact contracts and
deliberate limits, including text-only clarification in this executor. Existing
AI-030 choice APIs are unchanged and fail closed if supplied to this executor.

## Verification

Existing dependencies; explicit TEST_DATABASE_URL to the task-owned PostgreSQL18
cluster at 127.0.0.1:55493. Harness creates/migrates/drops randomized dubbl_ci_*
databases without resetting the connection target. No application database,
ignored environment file, Stripe functionality/file, runtime flag, external
provider/account, build, dev server, Docker or deployment was changed/run.
HTTPS/DNS are mocked in the raw integration fixture; enabling its synthetic
in-process live gate cannot send a real request through the mocked transport.

| Check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/{ai-executor,ai-provider-attempts,ai-providers,ai-tool-operations,ai-run-input,ai-run-progress,ai-run-lifecycle,ai-persistence,ai-usage}.test.ts (explicit paths on Windows) | 10/10 passed; executor rerun after final safe-close refinement |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed; final executor safe-close refinement rechecked |
| npx eslint over every changed TS file | Passed, zero warnings/errors; final executor refinement rechecked |
| npm run lint | Zero errors, 20 existing warnings outside changed files |
| npm test | 1547/1549 passed; two confirmed baseline failures below |
| node --import tsx scripts/validate-messages.ts | Passed, 10776 keys in each production locale |
| node scripts/audit-ai-capabilities.mjs; node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed; 109 modules, 815 tools, 577 routes, 210 pages; seven reviewed business tools unchanged |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks passed |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit1, 1447 unchanged baseline errors; exact clean-HEAD comparison below |
| python .agentic/agent.py validate; git diff --check | Passed; completion state revalidated separately |

The executor fixture submits through the real REST route, executes dependent
list/get contact and expense draft operations through actual linked registered
MCP tools, verifies stable persisted associations and independently reads SQL
`total_amount::text = '1250'`, draft status and application links. Existing REST/
MCP progress matches, and deletion hides old links. It tests structured question,
redaction, answer idempotency, same-run resume/deadline, eight-attempt exhaustion,
forged sensitive calls, malformed later output, unknown charges, bounded transient
retries, permission changes, cancellation after a confirmed draft, orphaned calls,
competing loop invocations and a default-off adapter with zero reservations.
Raw tests cover split buffers, duplicate keys, invalid UTF-8, overflow, redirects,
compression, permission revocation and record deletion during DNS, with zero
transmission of stale disclosure. An actual child executor is killed after a
committed draft and another provider dispatch; a fresh process recovers, preserves
the deadline/two attempts/settled-and-unknown charges, and executes no duplicate
business/provider action. Existing integration regressions additionally cover
lock waits, config/policy/kill/budget/rate/token/cost failures, cancellation and
uncertain committed-write recovery.

Initial new integration verification found a fixture ordering assumption:
unordered step selection sometimes selected a contact as the draft receipt.
Ordering by createdAt/id fixed the fixture; subsequent complete runs passed.
Initial typecheck found a combined-union narrowing issue and an overly broad
test MCP argument type; both were fixed before final passing checks.
The final capability audit detected the updated MCP progress description;
regeneration changed only that description in AI_CAPABILITIES.json. The subsequent
capability and tool-coverage drift checks passed with unchanged counts/allowlist.

## Verified pre-existing failures

Full unit suite failures reproduce in a separate clean `git archive HEAD` snapshot
using the same dependency installation, with no task edits:

- settings-integration-catalogs.test.ts: expected 20 settings entries, actual 21.
- whole-catalog-integration.test.ts: expected 10702 catalog keys, actual 10776.

The money verifier's raw stderr has 1447 lines on both clean HEAD and this change,
with identical SHA-256
`4a7aea0c802bc5ab799928372bab04729eeff35b70a4a49974ffd2c47ed36186`.
No new inventory error, missing schema column or consumer drift was introduced.
These global checks are NOT green and are not waived or repaired by AI-038.

## Handoff and limits

Next is AI-035's independent integration acceptance; leave its original criteria
unchecked until that task verifies them. AI-036 owns polling, lease renewal,
shutdown and provisional observation. No live provider entitlement, tokenizer,
pricing, hosting, process scheduling, browser/native-Persian UX, production or
rollout qualification is inferred from deterministic fixtures. Commit is local;
no push was requested.
