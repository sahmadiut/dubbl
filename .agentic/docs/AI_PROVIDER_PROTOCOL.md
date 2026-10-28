# Bounded provider protocol

AI-034, 2026-10-28. `lib/ai/provider-protocol.ts` is a pure internal protocol
boundary, with deterministic tests in `tests/ai-provider-protocol.test.ts`. It
performs no network calls, database operations, permission checks or business
actions. It is not exposed through REST, MCP or model tool discovery. AI-035
must consume it within the metered fenced executor; AI-036 owns process startup,
polling and provisional observation. AI-033/031/023/007 retain independent acceptance.

## Request construction

`createResponsesTurn` accepts a server-selected model capability projection,
requested output ceiling, freshly discovered reviewed tool names and minimized
public history. These are trusted caller inputs, not a client/model API. The
worker must revalidate live identity, tool permissions, immutable configuration
snapshots, runtime/kill switch, cancellation, deadline and lease before action.
Credentials and endpoints remain in the transport adapter.

The builder fixes instructions, stateless storage, non-streamed transport and
serial application function calls. It denies unknown options, unsupported
capabilities/models, unreviewed/duplicate names, forged roles, incomplete or
reused call/result pairs, unsafe objects and oversized/deep history. Limits are
64 KiB UTF-8 for the whole request including schemas, 64 history items, depth 24,
and 16..4096 output tokens subject to lower model/context ceilings. Future tools
that exceed this schema subset must be explicitly qualified before adoption.
Pre-serialization traversal also caps data nodes at 8192 and cumulative key/string
characters at 64 KiB, so cyclic or exponentially shared objects cannot expand
without bound before the final byte check.

Function definitions reuse the actual catalog's JSON schemas with nested strict
objects and all properties required. Optional nonnullable arguments use null for
omission and regain original domain defaults after decoding. Nullable arguments
retain null. This projection changes no REST/MCP/domain schema or exact money
carrier. Domain validation still runs after restoration and again at dispatch.
The immutable request and decoder bind the original model/tool set/ceilings.

The returned reservation covers the entire approved context: input ceiling equals
context minus output, with the requested output ceiling separately recorded.
There is no qualified tokenizer; this does not promise that the encoded request
fits a particular provider's context. A provider can reject it. AI-035 must reserve
before dispatch, enforce run ceilings and retain all unknown charges; context
rejection cannot trigger an unmetered retry or another provider/model.

## Complete output and usage

`turn.decode(rawJson, previousCallIds)` requires the original raw UTF-8 JSON text,
not an already parsed response. The caller must bound and validate UTF-8 at the
transport boundary before decoding. The existing `providerPost` connection-test
helper parses JSON and therefore is not directly suitable: AI-035 must preserve
raw text in its run transport adapter before using this decoder. Duplicate keys,
including escaped spellings and nested argument keys, are rejected before
JSON.parse can discard them. Byte and depth limits match requests.

The decoder requires the exact selected model, completed status, unique item/call
IDs, no incomplete/error state, valid usage and at most one serial function call.
Every output item and all arguments are validated before returning any call.
Unknown/partial statuses, hosted tools, explicit reasoning items, refusals,
annotations, logprob payloads, unknown call/message fields, invalid money/date
arguments and replayed IDs fail closed. This intentionally supports a narrow
protocol subset; reasoning models/streaming/refusal presentation require explicit
future qualification. No provider diagnostic or unsupported content is retained
in the result. Call IDs are untrusted correlation IDs, not operation/approval keys.
AI-035 must persist their binding to stable server operation keys and supply every
previously seen run call ID on each turn, including IDs outside the public history.

Usage is extracted independently from complete valid JSON even when content,
model, status or ceilings are rejected. Safe integer totals become canonical
strings. Missing counts stay null; missing subsets are unknown, never zero.
Invalid subsets are discarded conservatively while known totals survive.
Invalid JSON or oversized/deep bodies yield entirely unknown usage. The trusted
executor must settle or retain its reservation for *every* attempt, including
invalid results, partial counts and observed over-ceiling usage. This pure module
does not perform that settlement. `status: valid` establishes only protocol
validity, never execution authorization or confirmed business success.

Accepted output text is named `untrustedText`. It is neither a persisted safe
summary nor a confirmed result/link. The executor must redact/minimize content,
derive success and links from real tool receipts, check current disclosure
permissions, and apply the separate approval boundary before sensitive work.
Output text can contain false claims or instructions and must never grant authority.

## Source and qualification boundaries

Protocol shape was checked against official OpenAI documentation on 2026-10-28:
[function calling](https://developers.openai.com/api/docs/guides/function-calling).
Its strict object/nullability requirements, serial call control and call/result
correlation informed the implementation. The pure boundary is an application
restriction, not the whole Responses API. The full response reference fetch was
unavailable; no reference completeness or live compatibility is claimed.

No live provider/model, account availability, pricing, tokenizer, streaming,
rate-limit behavior or hosting target is qualified by these fixtures. No provider
is selected or activated. Runtime and live-call settings remain unchanged.
AI-035 owns durable metering/tool execution/clarification; AI-036 owns the explicit
polling process, heartbeat/shutdown, recovery and provisional observation. Neither
a browser connection nor a protocol receipt may replay a business effect.
