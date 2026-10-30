# AI-041 attempt 1 - permission-scoped journal posting previews

## Identity

2026-10-30, Codex, D:/Projects/a/dubbl, master, starting HEAD 28551441.
Entry tree was clean. Controller validate/status/next selected AI-008. Source
inspection showed that it spans domain previews, durable selected batches,
decisions and sensitive execution. Split it into AI-041..044, preserving every
original parent criterion and its independent combined acceptance. Completed
only AI-041. No sub-agent, peer or human review is claimed.

## Implementation and acceptance mapping

1. Shared scoped read: lib/ai/action-preview.ts supplies previewJournalPost;
   POST /api/v1/ai/previews/journal-post and registered MCP preview_ai_journal_post
   use it. Input accepts only entryId and optional expectedResourceVersion. Live
   credential, use:ai, view:data and post:entries checks occur before and after
   database reads. Current organization, nondeleted draft/manual status and
   active scoped dimensions are enforced. Actual REST/MCP tests cover foreign,
   missing/deleted records, foreign/inactive accounts, each revoked permission,
   deleted membership and unauthenticated access. A real ACCESS EXCLUSIVE table
   lock delays line loading while view:data is revoked; the awaited preview is
   withheld by the final live authorization check.

2. Business display: the bounded object contains action/label key, target link
   and reference, before/after status, date/memo/reference, complete account
   lines and dimensions, saved FX, exact SQL-text minor amounts and bigint
   totals separately per currency, empty recipients, posting/reversal effects
   and scheduled reversal date. USD 1250 and IRR 1250 remain 1250 in each group.
   Existing safe-number workflow limits are enforced before domain DTO numeric
   conversion; 9007199254740991 remains exact, 9007199254740992 is rejected.
   Currency tags must be canonical and known. Active journal workflow presence
   and latest scoped business-request status are observed without names/actors.
   Conditions are explicitly not_evaluated; even approved status never changes
   authority:preview_only or canApprove:false. No direct posting service call.

3. Snapshot and recovery: a repeatable-read/read-only transaction builds the
   snapshot. SHA-256 binds adapter/action, actor/org, entry ID, full saved
   header/lines, displayed account details and observed approval state. Direct
   line edits without updatedAt changes, account-label edits, header edits and
   request-status changes invalidate an expected fingerprint. Omission refreshes
   observation only. A five-minute display window is returned; this unkeyed
   fingerprint and its expiry are not a capability or durable approval. Finite
   denied/not-found/stale/unsupported/too-large/invalid/locked codes include
   recovery keys. REST uses private,no-store on success and errors.

4. Focused verification: actual REST, linked registered MCP and independent SQL
   assert no journal-header/line changes and no AI run/step/approval/event,
   business-approval or audit creation on preview and repeated observation.
   Tests cover forged scope/approval/action arguments, malformed JSON/query/UUID,
   unsupported posted/void/automated/reversal records, period locks, imbalance,
   currency errors, count/character/UTF-8 payload limits, FX database guard and
   permission revocation during a real read wait. Existing raw-adapter runtime
   and tool-registry suites and pure protocol tests preserve default-off/sensitive
   denial. The seven automatic tools are unchanged. Updated capability/coverage
   inventories classify this client preview tool as excluded from ordinary chat.

See docs/AI_ACTION_PREVIEWS.md for the explicit adapter/qualification boundary.
AI-042 owns additional finite sensitive adapters and persisted exact batches;
AI-043 decisions; AI-044 approved dispatch. Existing postJournal does not itself
enforce business-workflow conditions; future AI dispatch must integrate those
conditions rather than infer approval from this observation.

## Verification

All commands ran at D:/Projects/a/dubbl with installed Node v23.11.0. Explicit
TEST_DATABASE_URL selected the synthetic PostgreSQL18 cluster at 127.0.0.1:55491.
It was stopped at entry; started it using its established loopback options.
Each harness migrated and dropped a randomized dubbl_ci_* database. Verified zero
remaining fixture databases and stopped the cluster after checks. No application
database, credentials, provider endpoint or external service was used.

| Check | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/ai-action-preview.test.ts tests/integration/ai-tool-registry.test.ts tests/integration/ai-runtime-acceptance.test.ts | 3/3 passed, 28.2 seconds |
| node --import tsx --test tests/integration/ai-action-preview.test.ts after adding the permission-revocation read-wait case | Passed, 5.1 seconds |
| node --import tsx --test tests/ai-provider-protocol.test.ts | 11/11 passed |
| npx tsc --noEmit | Passed, including final fixture refinements |
| npx eslint on all changed application/test/script paths | Passed, zero warnings/errors after final refinements |
| npm run lint | Passed, zero errors; 20 existing warnings outside changed paths |
| node scripts/audit-ai-capabilities.mjs and node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed after regeneration: 110 modules, 817 tools, 579 routes, 210 pages; seven automatic reviewed tools |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine regression checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Failed, 1447 error lines; existing stale inventory remains a failed gate |
| Money-verifier HEAD-input comparison | Same 1447 count/exit 1. All schema and inventoried consumer inputs are unchanged except tools/index.ts. Reading that one input virtually from Git HEAD moves one stale money_name pattern error from line 97 back to line 200; no money behavior changed. Output is not claimed byte-identical. |
| python .agentic/agent.py validate and git diff --check | Passed |

During implementation, an initial task split accidentally reused AI-039/040.
Controller validation rejected the resulting dependency cycle; both completed
records were restored exactly from the clean entry HEAD before a valid split
using the new AI-041..044 IDs. Neither completed task nor its evidence changed.
One fixture initially tried to seed an FX alias disagreement; the existing
database trigger correctly rejected it. Converted that case to assert rejection
and unchanged valid preview. Final checks above pass.

No schema changed, so migration generation was unnecessary. No full unit suite,
build, dev server, browser/native-Persian qualification, live provider request,
deployment, activation, Stripe work or push occurred. This child does not supply
durable proposals, decisions, batch selection or sensitive execution. The money
inventory baseline and wider provider/release gates remain explicitly open.

## Review and handoff

Codex self-review is recorded in AI-041-review-1.md. Complete this bounded child
with a scoped local commit; report AI-042 and stop. AI-008 remains open with all
original criteria unchecked until independent combined integration acceptance.
