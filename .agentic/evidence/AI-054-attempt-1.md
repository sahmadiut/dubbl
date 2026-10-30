# AI-054 approved saved-contact invoice email delivery

## Identity and scope

2026-10-31 (Asia/Tehran), Codex, D:/Projects/a/dubbl. Entry HEAD 22cd08cf,
master, initially clean. Controller selected AI-054 after completed AI-052/053.
Read repository rules, controller/project/backend guidance, dependency evidence,
decision/consumption contracts, shared rendering/delivery and current SQL paths.
Completed this bounded child only. No delegation, push or Stripe edits.
AI-050/044/008 retain independent combined acceptance; AI-051 owns worker/resume.

## Implementation and acceptance mapping

1. Added trusted executeApprovedInvoiceEmail taking only run/lease/batch/item
   UUIDs, rejecting other domains before consumption. Only a fresh one-time
   consumption return forwards the original document ID. Shared invoice rendering
   preflight, exact money formatting, document email renderer and prepared SMTP/
   platform transport derive the saved single mailbox, subject, content and dates.
   Recipient/content overrides, custom message, attachment and links are absent.
   No public/model dispatcher, queue/resume transition or rollout activation.

2. Migration 0027_concerned_xorn.sql creates ai_action_delivery, the ordinary
   domain-log ai_attempt marker and composite keys. Unique consumption/log keys
   and scoped FKs bind one durable attempt to its original operation and domain
   log. Composite uniques were ordered before referencing foreign keys. Before
   dispatch, log and attempt commit uncertain; AI metadata contains only UUIDs,
   digest, state and UTC creation time. Domain logs retain the email content.
   Current SMTP config participates only in the opaque resource digest.

   The final read-committed transaction locks rendered resources, absent policy/
   credential rows and quota logs before run locks, rechecks exact decision,
   selection, resource/policy/adapter/argument/operation bindings, live identity,
   permissions/configuration, retention, runtime, deadline and lease, rerenders
   and compares the immutable envelope digest, and prepares the shared transport.
   Final live/time checks follow the audit SQL wait, immediately before the single
   send call. Locks serialize ordinary resource/authority writers through that
   call. Uncertain AI logs retain quota reservations; only the current attempt's
   reservation is excluded from its original quota/resource comparison.

3. Transport acceptance retains confirmed state and bounded invoice/log UUIDs.
   Explicit platform rejection and SMTP rejection of all recipients are failed;
   unknown transport errors/lost acknowledgements remain uncertain and require
   reconciliation. The adapter stores no raw error/provider response/credentials
   in AI metadata. A lost success COMMIT acknowledgement observes the durable
   receipt. Known confirmation after later SQL failure can be retained separately;
   recovered/replaced step fences cannot be overwritten. Stop before dispatch
   prevents sending; Stop during an already-started boundary retains its actual
   receipt. Killed workers leave uncertain attempts for maintenance, never resend.
   Existing REST/MCP resend rejects every AI attempt log, even when AI metadata
   is later erased; its persistent domain marker requires a fresh reviewed
   proposal. Ordinary existing logs default false and retain their resend flow.

4. Real SQL harness uses session-backed REST approval, actual batch revision,
   consumption and lease claiming, shared recognized invoice services, and SMTP/
   platform transport stubs. Fixture-only SQL queues approved runs; it does not
   qualify AI-051. Cases cover concurrent/repeated calls, wrong adapter/override
   rejection, exact saved recipient/subject/HTML, no attachment, USD and
   2147483648 IRR rendering, explicit platform and SMTP rejection, lost transport
   acknowledgement, quota reservation, and ordinary resend refusal. Post-consume
   SQL waits race recipient, invoice notes, permission, membership removal,
   business policy, AI config, SMTP config, quota, runtime, lease, deadline and
   Stop. Expiry while waiting on the final audit INSERT prevents sending. Stop
   after dispatch waits for the acknowledged result and retains confirmation.
   A real committed result with injected lost COMMIT acknowledgement is observed
   without repeat. Separate workers are killed both before dispatch and after
   simulated provider acceptance, followed by fresh-process recovery and refusal
   of old-lease dispatch/resend. Migration application is exercised in every
   randomized disposable database.

Detailed contract and limitations: ../docs/AI_EMAIL_EXECUTION.md.

## Executed verification

Installed Node 23.11.0 / PostgreSQL 18. Created a task-owned randomized cluster
on 127.0.0.1:4385. Explicit TEST_DATABASE_URL feeds randomized dubbl_ci_* databases;
each test migrates/drops only its new database. No application database was used.

| Check | Actual result |
|---|---|
| npx drizzle-kit generate | Generated 0027_concerned_xorn.sql, snapshot and journal; applied successfully by all final SQL suites |
| node --import tsx --test --test-concurrency=1 tests/integration/ai-email-execution.test.ts tests/integration/ai-action-consumption.test.ts tests/integration/ai-action-adapters.test.ts tests/integration/ai-action-decisions.test.ts tests/integration/ai-journal-execution.test.ts tests/integration/ai-settlement-execution.test.ts tests/integration/document-rendering.test.ts | Passed 7/7 in 189.6 seconds; final email acceptance 36.2 seconds |
| Final node node_modules/typescript/bin/tsc --noEmit | Passed, exit 0 |
| npm run lint | Passed, exit 0: zero errors, 20 existing warnings outside owned changes |
| node scripts/audit-ai-capabilities.mjs --write, then verification without --write | Passed; only resend description refreshed, counts unchanged: 110 modules/824 tools/586 routes/210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed, seven reviewed automatic/817 unlisted tools unchanged |
| node .agentic/scripts/verify_legacy_money.mjs | Passed, nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1, identical ordered 1447-error HEAD baseline, zero added/removed |
| python .agentic/agent.py validate; git diff --check | Passed before submission |

Money inventory refresh preserves existing annotations/classifications/unrelated
consumers and updates only owned hashes, occurrences, references, scanned new
source paths and the three shifted email schema source links. A temporary
readFileSync shim supplies HEAD inventory/owned source to the unchanged verifier;
its complete ordered error list equals the final current list. This remains an
existing failing inventory gate, not a green qualification claim.

Initial trials corrected a stale lock-query test expectation, a member-removal
fixture (legacy member has invoice grants; viewer is not a schema role), and a
recovery assertion that selected an old superseded/skipped step. An initial
typecheck found an optional date parameter, which was corrected before the final
checks. Early inventory comparison scripts needed explicit UTF-8/large-buffer
capture and preservation of preexisting multi-field schema annotations. No
failed trial is reported as passing. Final checks use the corrected source;
no application/test changes followed the final regression suite.

Final SQL confirmed zero remaining dubbl_ci_* databases. Stopped the task-owned
cluster; pg_ctl status reports no server running. No full build, dev server,
application DB mutation, real external delivery, deployment or activation.

## Review and handoff

Codex self-review is recorded separately in AI-054-review-1.md. Global table
locks trade throughput for correctness and are held through the external
acknowledgement wait, so Stop and writers may wait during an in-flight send.
Confirmed means transport acceptance, not inbox delivery/read. Lost or unknown
outcomes never authorize retry. No live-provider, deployed-worker, performance,
UI/native Persian, deployment or production activation is qualified.
AI-050/044/008 integration and AI-051 resume/worker orchestration remain open.
