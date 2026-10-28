# AI-034 attempt 1 - bounded complete provider protocol

## Identity and scope

2026-10-28, Codex self-operated in D:/Projects/a/dubbl, branch fresh-start,
starting commit 5f5b733c. Entry tree was clean. No separate peer/human review is
claimed. No application environment, Stripe, database, credential, provider
configuration or rollout setting changed. No push is included in this task.

The controller selected AI-033. Inspection verified the existing fenced tool
operation boundary but no complete provider protocol consumer or worker loop.
AI-033 was split through the controller into AI-034 (protocol), AI-035 (durable
metered executor) and AI-036 (polling/recovery/provisional observation). This
attempt completes only AI-034. All original AI-033 criteria remain unchecked,
and AI-033/031/023/007 retain independent integration acceptance. Source coverage
and task index document each required child without changing release gates.

## Implementation and acceptance mapping

1. lib/ai/provider-protocol.ts supplies createResponsesTurn, an internal pure
   function over projected server model capabilities, reviewed current tool names
   and minimized public history. Strict unknown-option/role/capability rejection,
   complete call/result pairing, replay checks and immutable request snapshots
   prevent caller text from selecting privileged request options. Storage and
   streaming are false; application function dispatch is serial. Actual reviewed
   catalog schemas compile to nested strict objects with nullable omission for
   optional fields, then restore original domain defaults/null semantics on decode.
   Exact money remains string minor units. Limits include 64 KiB UTF-8 whole
   request/response, depth 24, 64 history items, 8192 data nodes and bounded
   pre-serialization character traversal, 20 unique historical calls and at most
   one new call per response. Output is 16..4096 tokens within model/context
   ceilings. Full-context reservation ceilings are returned without pretending
   to have a qualified tokenizer or a persisted billing reservation.

2. The request-bound decoder requires original raw JSON text and checks duplicate
   keys including escaped spellings before JSON.parse loses them. Full output
   validation precedes returning any call: exact model, completed status, unique
   item/call IDs, whole strict arguments, approved names and usage/output ceilings.
   A second call, malformed later item, unknown/partial status, hosted tool,
   explicit reasoning, refusal, annotations/logprobs or invalid date/money blocks
   the entire response. No partial calls or invalid content appear in its receipt.
   Usage extraction is independent: observed safe counts survive invalid output,
   partial counts remain null, invalid subsets stay unknown and over-ceiling
   observed counts are retained. Invalid/oversized JSON yields unknown usage so
   the future executor must retain its charged reservation. No settlement or
   free-usage assertion occurs in this module. Accepted text is explicitly
   untrustedText, with no confirmed record/link/success field or execution authority.

3. tests/ai-provider-protocol.test.ts exercises the actual seven reviewed catalog
   schemas and deterministic supplier lookup -> dependent detail -> exact draft
   -> untrusted final text turns. Adversarial cases cover option/role/capability
   injection, immutable snapshots, optional/default/null restoration, strict nested
   arguments, greatest safe exact minor units, invalid canonical dates, duplicate
   escaped keys, forged org/approval arguments, replay, malformed/late/partial
   items, private output, missing/partial/inconsistent/over-ceiling usage,
   multibyte/deep/oversized data, getter/toJSON avoidance and exponentially shared
   or sparse request objects. AI_PROVIDER_PROTOCOL.md specifies the internal
   contract and every remaining integration boundary.

Official function-calling documentation was searched and fetched on 2026-10-28:
https://developers.openai.com/api/docs/guides/function-calling . Its strict schema,
serial control and call/result correlation details informed the projection. The
full response reference fetch failed due to size; live compatibility and reference
completeness are not claimed. No provider/model/account is selected or qualified.

## Verification

All commands ran from the repository root; dependencies already existed.

| Command/check | Actual result | Limitation |
|---|---|---|
| node --import tsx --test tests/ai-provider-protocol.test.ts | 10/10 passed, including final source/tests | Deterministic pure protocol, no live provider |
| npx tsc --noEmit | Passed; final repeat covers final source/tests | No build |
| npx eslint lib/ai/provider-protocol.ts tests/ai-provider-protocol.test.ts | Passed, zero warnings/errors, including final source/tests | Scoped files |
| npm run lint | Exit0, zero errors/20 existing warnings outside task files | Final scoped lint additionally covers later review refinements |
| node scripts/audit-ai-capabilities.mjs | Passed without inventory writes | 109 modules, 815 tools, 577 routes, 210 pages unchanged |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed without inventory writes | Exactly 7 reviewed business tools unchanged |
| node .agentic/scripts/verify_legacy_money.mjs | 9 checks passed | Existing regression gate |
| python -m unittest discover -s .agentic/tests -q -k test_split_releases_slot_and_parent_returns_after_child_completion | 1 passed, 156.974 seconds | Focused controller graph regression only |
| python .agentic/agent.py validate; git diff --check | Passed before submission, completion revalidated | Structural/diff checks |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Started, then stopped for broad unrelated UI test duration | Incomplete; NOT a full-suite pass |

Development checks found and repaired TypeScript control-flow narrowing around
the throwing helper and two unused-schema-projection variable warnings. An audit
invocation without the tsx loader failed resolving tool-catalog imports; the
documented loader invocation passed. Final checks above use the repaired code.
Review also added traversal bounds and deduplication of history plus durable
seen-call IDs so overlap does not spuriously exhaust the unique-ID ceiling.

No schema/migration, public REST/MCP or database service changed. Disposable
database integrations are not required to verify this pure boundary and were not
run; actual worker/REST/MCP/database integration remains mandatory in AI-035/036
and the parents. Global money inventory, exhaustive controller tests, browser/UI,
native Persian, hosted CI and live/provider/hosting qualification were not run or
claimed. No full build, dev server, Docker, deployment or activation occurred.

## Handoff

AI-035 must consume this boundary in its actual durable metered provider loop,
preserve raw UTF-8 response text before JSON parsing, persist call-to-operation
bindings, recheck live authority before actions, reserve/settle every attempt,
retain unknown charges and original limits through crash/clarification, minimize
public context and publish only permission-checked grounded tool receipts.
The existing connection-test providerPost helper returns parsed JSON and cannot
directly preserve duplicate-key evidence; its run adapter integration is pending.
AI-036 owns the explicit polling process, heartbeat/shutdown, fault recovery and
provisional observation. No running worker or live-provider acceptance is implied.
