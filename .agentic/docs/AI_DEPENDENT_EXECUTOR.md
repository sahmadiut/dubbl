# Dependent run executor

AI-038, 2026-10-29. `lib/ai/executor.ts` exports the internal
`executeRun(runId, lease, transport?, options?)` entrypoint for one already claimed
run. It neither claims nor polls, renews leases, starts a process, enables flags,
or exposes dispatch through REST/MCP. AI-036 owns that process integration;
AI-035 retains independent acceptance of all original integration criteria.

## Authority and context

One session advisory lock serializes invocations for a run, including competing
calls under the same lease. No transaction spans a provider or business call.
The existing random durable run lease still fences every action. Current
identity, policy, configuration, permission, cancellation, expiry and runtime
guards remain enforced by AI-037 and AI-032, including after asynchronous waits.

History contains only this run's user request, authorized answered text
clarifications, and freshly resolved step receipts. It never consumes saved
display arguments or result blobs, sibling conversations/runs, model narration,
private reasoning, email/phone/notes, journal lines, or attachments. Record fields
are limited to reviewed IDs, live application links/status/exact expense minor
units and currency, and an explicitly untrusted 200-character live label (contact
name, journal number or expense title). Unavailable/restricted records are
omitted. Public history is redacted and byte-bounded again by the attempt layer.

Context is rebuilt and compared immediately before the trusted transport, after
dispatch/audit waits. The raw adapter repeats this check after DNS, before sending
bytes. A changed permission envelope, scoped/deleted record or label can never
authorize sending the old context. Failed pre-send checks retain conservative
unknown usage rather than inventing a zero-cost provider receipt.

## Calls, limits, retries and restart

Only a fresh accepted provider receipt supplies original validated arguments,
catalog version and a stable operation UUID to `executeToolOperation`. The loop
does not reconstruct execution from any persisted display/history. An orphaned
accepted call goes to reconciliation; it is never replayed. Sensitive operations
remain outside the automatic catalog. Approval-looking text or clarification
cannot substitute for AI-008's separate, still-unqualified approval service.

Each provider attempt, including a retry, has a fresh key and separately charged
reservation. The run retains AI-037's original price, model/configuration,
budgets, eight-request cap, output/payload/token/cost limits and deadline through
clarification and restart. A maximum of two transient failures across the whole
run bounds retry orchestration. Only typed network/unavailable/rate-limit errors
and bounded provider timeouts qualify; arbitrary exceptions and malformed,
partial or unknown responses do not. No provider/model fallback is implemented.
Business tools have no automatic retry: current MCP error envelopes cannot prove
a read failure transient, and non-idempotent draft writes must never replay.

Restart may build another turn from terminal confirmed receipts, but cannot
replay a lost executable handoff, nontransient failure or completed final turn.
Unknown usage and uncertain effects require reconciliation. A process killed
after a confirmed draft and another provider dispatch retains the draft, both
attempt identities, original deadline and unknown reservation. Late callbacks
cannot change the recovered lease's authority.

## Clarification and outcomes

A validated completed provider response may contain exactly
`{"kind":"clarification","question":"..."}` (1..2000 characters). This is an
untrusted request for text input, never authorization. `requestRunInput` persists
and suspends it under the existing versioned AI-030 contract; existing REST/MCP
answering queues the same run. The executor consumes authorized text answers and
preserves all prior ceilings and effects. Other internal question kinds remain
fail-closed in this executor; AI-030's existing choice APIs are unchanged. A lost
question handoff is not reconstructed from a raw provider response.

All other provider final narration and URLs are discarded. Final messages contain
only server-generated finite codes. The existing REST/MCP progress reader adds
an outcome code derived from the entire run's persisted step states, independent
of pagination. Record links are rebuilt from current domain scope on each read.
Partial success, cancellation, failures, unavailable records and reconciliation
never become a claim of a posted transaction/payment. A completed no-tool turn
explicitly reports `NO_CONFIRMED_ACTION`.

## Raw adapter and remaining qualification

`run-transport.ts` resolves the run's server-chosen provider and encrypted
credential, never a model URL/credential. With live calls disabled, the default
executor closes without a reservation or network request. Injected deterministic
fixtures exercise the executor without enabling live calls. `providerPostRaw`
uses fixed POST, exact approved HTTPS endpoint, pinned public DNS, TLS hostname
verification, no redirects/proxy, abort/total timeout, 64 KiB response bounds and
fatal UTF-8 decoding. It preserves raw JSON, including duplicate keys, for the
strict protocol decoder. Administrative probes retain their parsed-object API.

Tests exercise actual REST handlers, registered linked MCP business tools and
independent disposable PostgreSQL assertions. DNS/HTTPS are mocked for raw
adapter tests, including split buffers, duplicate keys, invalid UTF-8, overflow,
redirects, compression and disclosure changes during DNS. No live account/model,
entitlement, tokenizer, actual pricing, hosting, polling/heartbeat/shutdown,
provisional streaming, browser/native-Persian UX, deployment or rollout is
qualified. Existing default-off flags and Stripe remain unchanged.
