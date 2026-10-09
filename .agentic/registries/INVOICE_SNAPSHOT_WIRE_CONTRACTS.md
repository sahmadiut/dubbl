# MON-124 invoice party snapshot contracts

2026-10-10, Asia/Tehran. Actual REST handlers, full linked MCP SDK and migrated
disposable PostgreSQL fixtures. Child of MON-034; parent acceptance stays open.

| Boundary | Inputs and permissions | Output |
|---|---|---|
| GET `/invoices/:id/snapshot`; `get_invoice_snapshot` | Live organization-owned UUID; `view:data`; MCP accepts only `invoiceId` | `{sender,recipient}` saved JSON objects or null |
| PATCH `/invoices/:id/snapshot`; `update_invoice_snapshot` | Same UUID; `manage:invoices`; one or both nonempty correction objects; MCP additionally requires `invoiceId` | Same envelope after an atomic locked merge and correction audit |

The shared wire schemas reject unknown top-level and nested fields, empty bodies
or party objects, malformed JSON, invalid UUIDs and non-text correction values.
Sender accepts name, address, taxId, registrationNumber, phone, email, countryCode;
recipient accepts name, email, address, taxNumber. Name is nonempty text; other
fields may be text or null. Every new text value is at most 10,000 characters.
Email/country/identifier fields retain text semantics, with no new format coercion.

## Units, aliases and supported historical range

Corrections accept **no money, FX, count or currency input**. Sender/recipient
snapshots contain party identity, not a defined monetary schema. Historical extra
keys are opaque and stay intact through reads, merges and audit before/after
payloads. No key-name heuristic, rescaling, alias creation or agreement rule is
applied to old fields named amount, amountMinor or rate. Canonical full-int64
strings, tiny exact FX strings and identifiers such as `001250` retain their exact
text. This is literal JSON preservation, not a new full-int64 financial consumer.

Historical envelopes must be JSON objects or null. Nested safe Numbers, booleans,
arrays and nulls preserve JSON semantics; finite Numbers have absolute value at
most 9007199254740991 and must round-trip the stored decimal value. Snapshots are
selected as SQL text; a string-aware numeric token check compares normalized
decimal coefficients/exponents before JSON.parse. Thus `1.0000000000000001` and
`9007199254740990.5` fail even though pg would decode them to safe-range Numbers.
Equivalent trailing-zero/exponent forms such as `0.2900` remain supported. Decimal
metadata remains decimal. Unsafe/nonfinite or lossy Numbers fail with 422
`LEGACY_NUMERIC_RANGE`; no conversion to strings can repair already lost precision.
Unsupported historical root shapes also fail with that code.
Both parties are preflighted even if only one is being corrected. Existing unsafe
history is rejected and retained; it is never remediated by a correction request.

Reads/corrections project only status and party JSON. Unrelated invoice money is
not decoded or exposed by this boundary, so it cannot silently round, overflow or
prevent access to otherwise supported party snapshots. Stored currency, totals,
lines and posting history stay unchanged.

## Isolation, history and atomicity

Both transports use the same direct Drizzle service. AuthContext supplies the
organization and user; spoofed organization headers/fields cannot redirect it.
Foreign, soft-deleted and absent invoices return 404. Permission failures are 403,
invalid REST authentication 401, validation errors 400. Reads require `view:data`,
consistent with the existing general data permission; custom grants override
legacy roles. Reads return saved party JSON without querying today's contact.

Draft corrections return 400. Any existing signed signature blocks correction
with 409, even if expired. Pending/declined/expired signatures are not a signed
history barrier. The transaction locks the organization first, matching invoice
lifecycle writers and avoiding parent audit-FK/child-row deadlocks, then the scoped
invoice and its signature
rows in UUID order. Invoice locks serialize concurrent corrections and prevent
lost merges. Signature locks conflict with the current public signing UPDATE:
if signing commits first, correction sees signed status and rejects; if correction
holds the lock first, signing waits until that correction commits. The fixture
holds a real signing row lock and proves the waiting correction rejects after
signing commits. Public token/SSR/signing validation remains MON-126.

Correction result serialization is checked before update. The update and awaited
`update_snapshot` invoice audit insert share one transaction; an audit failure
rolls back the correction and updatedAt. Audit contains literal before/after
objects, context user/org and available REST request metadata. Each accepted
request writes one audit, including repeated identical corrections; there is no
replay key or ledger posting. This textual correction does not change financial
dates or amounts and adds no period-lock override.

## Ownership and verification

`tests/integration/invoice-snapshots-worker.ts` exercises both actual REST handlers
and the full tool registry over linked MCP SDK transport: historical exact and
legacy values, null snapshots, text corrections, strict nested schemas, malformed
JSON, draft/signed history, two tenants and denied custom grants, missing/deleted
rows, unsafe nested history, unrelated unsafe money, concurrent field merges,
real signature lock contention, held organization/child lock order and injected audit rollback. Failure snapshots
compare invoice, signature and audit tables as SQL text.

Initial automatic snapshot capture at send time remains the completed invoice
lifecycle service. Existing domain rules/layout/report filters keep their domain
registries. MON-125 owns remaining audit/opaque/admin forwarding, MON-126 owns
signing token and signature operations, MON-127 owns SSR/PDF bridges; MON-034
retains complete cross-domain inventory and combined acceptance. No schema,
migration, stored-history rewrite, provider call, production IRR enablement or
deployment is introduced here.
