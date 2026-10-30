# Disclosure-safe run observation

AI-040, 2026-10-30. `GET /api/v1/ai/runs/{id}/observation?after=0` and
`get_ai_run_observation({runId, after?})` call the same database service in
`lib/ai/run-progress.ts`. They require current organization membership,
`view:ai-history`, run ownership and an active conversation. REST responses,
including errors, use `Cache-Control: private, no-store`. Inputs are strict;
`after` is an integer from 0 through 2147483647, with zero as the default.
Neither operation is in the model-callable tool catalog.

## Display contract

The response has three separate fields:

- `provisional`: a finite server-generated status, with `state` equal to
  `provisional` or `unavailable`, `source: server_status` and no record links.
  Possible codes are `WAITING_FOR_EXECUTION`, `PREPARING_RESPONSE`,
  `WAITING_FOR_RESPONSE`, `PROCESSING`, `OBSERVATION_DELAYED`, `STOP_REQUESTED`
  and `NO_PROVISIONAL_CONTENT`. A stale lease or elapsed deadline is observed as
  delayed; the reader never renews the lease or maintains the run. Terminal and
  suspended runs have no provisional content. These codes do not establish
  business success, worker availability, queue position or an ETA.
- `confirmed`: the existing progress contract, including persisted run/outcome
  state and at most 20 ordered step summaries. Currently accessible record
  references come only from live domain rows and persisted step receipts. An
  uncertain step remains explicitly uncertain. Expense amounts use exact decimal
  minor-unit strings and an explicit currency code; USD uses cents. Original
  requests, saved input/result payloads, labels and provider narration are absent.
- `delivery`: `mode: snapshot_poll`, `replace: true`, `next` execution version,
  `executionChanged` and `cursorReset`. Use `confirmed.observation.pollAfterMs`
  for polling guidance. Worker availability stays `unknown`.

Always replace the entire displayed snapshot, including removing restricted
records and clearing unavailable provisional content. `executionChanged: false`
is only a statement about execution notifications: permissions, deletion and
domain state can change without advancing that version. It is never a cache
validator or permission to retain previously returned business details.

On first read or cursor loss, pass zero or omit `after`. A future cursor, or a
nonzero cursor whose notification was removed, sets `cursorReset: true` and
returns the same fresh bounded snapshot. No historical text replay is needed.
The existing paginated progress and content-free event operations remain
available independently. A late grant change yields 409; fetch a new snapshot.
History permission loss yields 403, and unavailable/foreign/non-owned/expired
conversation content yields 404. Clients should clear unavailable displayed data.

## Validation and authority boundary

The current provider adapter buffers complete bounded raw JSON. Observation is
a polling stream of safe persisted milestones; it does not expose raw token
deltas or arbitrary assistant prose. This is deliberate: an untrusted model can
echo secrets, private reasoning, raw arguments or invented business claims into
otherwise valid final text. Merely labeling that text provisional cannot make
it safe. No raw provider text is saved or returned by this operation, and no
new promise of token streaming or freeform answer delivery is made. Structured
clarification continues through the existing separately authorized input API.

Whole-response protocol validation still precedes accepting any tool call.
Observation reads the existing provider attempt state, never partial calls or
model URLs. Its provisional state has no execution key. Reconnecting cannot
submit, claim, dispatch, retry, settle, cancel, approve, resume or reconcile work,
and reads work when runtime/provider calls are off. In-flight effects retain the
existing cancellation, receipt and no-replay behavior.

The shared reader locks conversation then run, refreshes authorization after
writer waits, bounds step history, checks domain scope on every read and rejects
expiry or changed grants before releasing a response. Its final grant check runs
after domain records resolve: a table writer delaying those reads cannot release
records under grants revoked during the wait. REST returns 409 and MCP returns
an error without record details; the next snapshot uses current permissions.
No new persistence, migration, usage reservation, deadline, price or ceiling is
introduced.

## Qualification

The disposable integration exercises the actual polling worker, strict REST
handler, registered linked MCP tools and PostgreSQL queries. It covers raw
partial-response failure, hostile valid narration, active dependent drafts,
runtime-off reconnect with whole-database mutation checks, same-cursor grant/
record changes, foreign scope, actual writer waits, expiry, stale leases,
20-step bounds, long input and cancellation during the actual expense INSERT.
Existing worker/executor/protocol fixtures cover additional raw faults,
clarification, ceiling preservation and recovery.

AI-036 combined local acceptance additionally exercises fresh-process
clarification/resume, known-effect crash/recovery, graceful stop and reconnect
without replay, plus late grant revocation during domain reads through both REST
and MCP. See [acceptance evidence](../evidence/AI-036-attempt-1.md).

This implementation does not activate AI. AI-033/031/023/007 retain independent
integration acceptance. Live provider/account/model/tokenizer/
price, deployed process/supervisor, PostgreSQL16/hosted CI, UI/native-Persian,
token streaming, deployment and rollout qualification remain outside this task.
