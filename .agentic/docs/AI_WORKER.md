# Explicit polling worker

AI-039, 2026-10-30. Internal startup command from the repository root:

```text
pnpm ai:worker
```

This invokes `node --import tsx scripts/ai-worker.ts`, separately from Next.js.
It opens no HTTP listener and runs no build/dev server or migrations. The operator
or qualified host supplies DATABASE_URL and the existing server environment.
No environment file is loaded implicitly. It refuses startup before importing
the database when AI_RUNTIME_ENABLED or AI_PROVIDER_CALLS_ENABLED is absent/false,
or AI_RUNTIME_KILL_SWITCH is true. Existing defaults remain off. This command and
local synthetic checks do not qualify a provider/account/model/host or authorize
enabling those gates; existing AI-012/013 and release gates still apply.

## Scheduling and ownership

`lib/ai/worker.ts` exports `runWorker` for trusted process composition. Normal
startup injects no provider. Deterministic tests inject a server-owned raw
transport; there is no client/model/REST/MCP option for doing so. The process
uses existing direct-DB lifecycle and executor services, not HTTP self-calls.

Defaults: poll every 1000 ms, maintain every 5000 ms, heartbeat every 5000 ms,
at most two executions per process. Internal settings are strictly bounded
(poll/maintenance 20..30000 ms, heartbeat 20..10000 ms, concurrency 1..2,
drain 0..30000 ms). The CLI uses the defaults; settings are not model inputs.
The database still enforces one running run per owner/organization and two per
organization across processes. A global transactional claim lock serializes
admission, and SKIP LOCKED avoids rows held by user actions. Capacity filters
precede the oldest-first bounded 100-row scan: a busy tenant/owner's backlog
cannot hide eligible requests from another tenant/owner. There is no invented
queue position, ETA, completion percentage or worker-availability API.

Every claim gets a new random lease. The existing executor session lock prevents
duplicate loops under the same lease. Renewals are serial per run; they lock
conversation then run, reload live authority after waits, use fresh wall time,
and never revive an expired/replaced lease or extend the original run deadline.
Renewal failure aborts the provider controller and starts no business action.
Current configuration, permissions, policy, cancellation and runtime checks
remain enforced at every provider/tool boundary. Maintenance recovers expired
leases and purges bounded expired content without automatically replaying any
uncertain write. Original prices, attempts, payload/token/cost ceilings and
clarification deadlines remain persisted in the executor services.

## Stop, shutdown and recovery

SIGINT/SIGTERM stop admission and abort provider requests immediately. The runner
waits up to its default ten-second drain for started work, continuing fenced
heartbeats during that drain so a business transaction can settle. It does not
cancel/roll back a domain write already executing. Confirmed writes remain in
receipts, and a failed/stopped continuation reports partial results truthfully.
Unknown provider usage remains conservatively charged and requires reconciliation.
After the drain, renewal timers stop; unfinished work is returned as a finite
count, and no replacement execution is started by this runner.

The production CLI additionally forces process exit fifteen seconds after a stop
signal, including a stuck DB claim/maintenance/heartbeat. Normal drained exit is
zero; unfinished work, a forced exit, unavailable configuration or startup failure
exit nonzero. Existing DB connection/query timeouts also remain in force. A host
must allow this termination/recovery contract; no actual supervisor is deployed
or qualified here. A hard process kill may leave an executing step uncertain.
The next explicitly started worker runs maintenance; it retains operation keys,
known effects, original deadline and settled/unknown charges. It never replays
lost call arguments or uncertain effects. Reconciliation and new authorization
remain separate obligations. Shutdown itself is not a user cancellation request.

Only finite content-free AI_WORKER_* event names are printed. Events expose no
run IDs, prompts, arguments, secrets, raw exceptions or private reasoning. Existing
REST/MCP progress/input/events remain observation/answer contracts; connecting
or reconnecting never starts this process or dispatches effects. Provisional
streaming remains AI-040; AI-036/033/031/023/007 retain independent acceptance.

## Qualification

Local checks use explicit loopback TEST_DATABASE_URL with randomized disposable
databases and deterministic providers. They exercise real polling, dependent
MCP-backed exact-money draft writes, REST/MCP progress, clarification/resume,
competing workers, live heartbeat/expiry/lock waits, cancellation/kill/config/
budget/rate denial, blocked business writes, bounded drain, separate-process
graceful stop and kill/restart. Windows process tests use IPC to trigger the same
AbortController shutdown path because Windows SIGTERM terminates a child directly;
POSIX signal delivery and the deployed host/supervisor still need qualification.
Live provider entitlement, prices/tokenizers, hosting, PostgreSQL16/hosted CI,
provisional streaming, browser/native-Persian UX and rollout are unqualified.
