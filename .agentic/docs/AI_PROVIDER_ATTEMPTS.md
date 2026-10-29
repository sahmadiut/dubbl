# Durable metered provider attempts

AI-037, 2026-10-29. Internal single-turn execution in
`lib/ai/provider-attempts.ts`, consumed by the pending AI-038 loop. This is not a
public dispatch API or a running worker. AI-035 independently accepts integration;
AI-036 owns polling, heartbeats/shutdown and provisional observation.

## Calling contract

`executeProviderAttempt(runId, lease, key, history, transport, options)` receives
server-owned UUIDs, a freshly built public history and a trusted raw transport.
History is not REST/MCP/model input to this primitive. The loop must reload live
record disclosure permissions and minimize field-level context before calling.
Defense-in-depth redaction runs before request construction. AI-034 fixes the
request's instructions, stateless serial functions and strict reviewed schemas.
No endpoint, credential, provider/model switch, arbitrary URL or request options
can come from model text. A transport must bound bytes, strictly decode UTF-8 and
honor abort. No network transport, credential decryption or live-call activation
is supplied by this task; the only transports executed are deterministic fixtures.

Each NEW attempt key creates one reservation and attempt in the same transaction.
An existing identical key returns `recorded`, with metadata only; changed requests
conflict. A recorded receipt never reconstructs executable arguments or a saved
provider response. The function exposes calls only in the winning fresh accepted
receipt, after all output is validated and its stable associations commit.

## Persistence and fencing

Migration `0023_pink_captain_cross.sql` adds `ai_provider_attempt` and
`ai_provider_call`. Composite foreign keys bind usage, run, organization and owner.
Unique constraints bind attempt key, ordinal, usage identity, call ID and stable
operation key. Metadata contains request/response digests, byte count, random
dispatch lease, finite status codes and configuration/policy/model/timeout/tool
snapshots. The original exact price/rates and budget version receipts remain in
`ai_usage_attempt`; actual budget ceilings are additionally saved on the first
provider attempt and reused. Prompts, raw responses, model narration, diagnostics,
reasoning and executable arguments are never persisted in these new tables.

Lock order is conversation share -> run update -> organization budget advisory
lock -> attempt/usage rows. Usage reservation and dispatch accept an internal
transaction for composition; their public administrative callers keep the prior
behavior. No transaction is held over a provider request or business tool call.
Identity, configuration/policy, runtime/kill switch, cancellation, deadline and
lease are checked again after lock/FK waits. A digest of the live permission
envelope prevents an access change from transmitting already-built context even
when some tools remain discoverable. The loop must still supply correct initial
record-level disclosure; an unchanged permission set alone cannot establish that.

Dispatch commits content-free audit/event and `in_flight` usage atomically with
the provider-attempt transition. Only its originating reservation invocation can
dispatch it; competing callers and successors cannot replay the key. Provider
and tool work cannot overlap within a run. An accepted call must have a terminal
tool receipt before another provider attempt. Actual tool preparation checks the
saved catalog version and canonical argument digest against the original supplied
arguments, then independently enforces AI-032's live execution authority.

## Ceilings, settlement and recovery

Eight requests is a hard per-run ceiling counting every usage attempt, including
cancelled/unknown attempts. Retries need new keys and new reservations. The
original price, provider/model/configuration, output ceiling and budget envelope
cannot expand through restart or a policy increase. Stricter current budgets
remain additional restrictions. Organization/user month, run, rate and concurrency
checks use exact integer token and cost atoms in explicit billing currency.
Conservative full-context reservations make no tokenizer or invoice claim.
Requests count toward the run's cumulative 1 MiB payload ceiling. AI-034 also
caps each request/response at 64 KiB and output at 4096 tokens or lower model limits.
The timeout is bounded by configuration, remaining deadline and remaining lease;
AI-036's process integration still owns renewal. The primitive has no retry loop.
Only explicitly typed transient transport failures and timeout are retryable;
malformed/partial/unknown protocol output and arbitrary transport exceptions are
not. External abort is non-retryable here. AI-038 must impose bounded retry policy.

Every dispatched attempt settles known/partial usage independently of output
validity, revocation, kill switch or stale lease. Unknown usage retains reservation
and concurrency, including observed lower bounds above a reservation. A result
after cancellation/recovery may settle usage but cannot publish calls or change
run authority. Stop, erasure, content expiry and both recovery paths close pending
attempts: undispatched reservations become zero-charge cancelled; dispatched work
becomes abandoned and unknown without erasing known charges. A fresh process
can start a separately charged provider attempt only under the existing ceilings.
No automatic tool replay occurs, including for orphaned accepted calls: AI-038
must fail/reconcile a lost executable handoff rather than use display payloads.

Only complete validated call IDs are retained for durable duplicate detection.
Bindings contain canonical argument digests and catalog versions, never replay
payloads. Untrusted final text is discarded; neither provider success nor a URL
becomes a business result. Real existing progress/usage REST and MCP readers show
only their current permission-checked receipts. Internal provider events appear as
the existing generic `changed` event and expose no attempt/lease/private context.

## Remaining acceptance

AI-038 owns actual dependent-turn orchestration, disclosure-aware history, raw
transport integration, sensitive-operation approval refusal/integration, durable
clarification/resume, bounded retries and grounded final summaries. AI-035 retains
all of its original criteria. AI-036 owns process scheduling and provisional
observation, and the higher parents independently accept integration. Fixtures
qualify neither a live provider/account/model/tokenizer nor hosting, deployment,
native Persian UX or production rollout. No default-off setting is changed.
