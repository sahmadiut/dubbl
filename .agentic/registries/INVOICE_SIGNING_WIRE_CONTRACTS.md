# MON-126 invoice signing contracts

2026-10-10, Asia/Tehran. Shared direct-DB services in
`lib/api/invoice-signatures.ts`, strict inputs in `invoice-signature-wire.ts`.
No schema change, stored-unit change or representation negotiation.

| Actual boundary | Inputs and authorization | Outputs |
|---|---|---|
| POST `/api/v1/invoices/:id/signature`, `request_invoice_signature` | Owned live invoice UUID, manage:invoices; signerName trimmed 1-1000 chars, email max 320 chars, optional future ISO instant with UTC/offset. Strict fields; MCP additionally takes invoiceId. | 201 REST / MCP `{signature,emailSent}`; additive emailSent false without SMTP. Random 32-byte base64url token, pending status, unchanged signer metadata, normalized UTC expiry or null. |
| GET same route, `get_invoice_signature` | Owned live invoice UUID, view:data; MCP strict invoiceId only. | `{signatures}`, all saved records ordered requestedAt descending then UUID descending. Timestamps serialize ISO UTC; no monetary fields or inferred aliases on signature records. |
| POST `/api/v1/invoices/:id/signature/resend`, `resend_signature_request` | Owned live invoice UUID, manage:invoices; REST no body or strict empty object, MCP strict invoiceId only. | `{success:true,resentTo}` (resentTo additive on REST); newest active pending request. Expired, explicitly expired, signed and declined excluded. No status, token, expiry or signature changes. |
| SSR `/sign/:token` | Exact opaque capability token, ASCII alphanumeric/underscore/hyphen, 1-256 chars. Owning invoice and organization must be live; contact must belong to invoice organization. | Existing signer/invoice/date/status UI and canvas only while active pending. Scoped projected summary internally adds subtotalMinor/taxTotalMinor/totalMinor/amountPaidMinor/amountDueMinor. Uses saved recipient name when present, otherwise scoped contact name. Unsupported history displays accessible error without a canvas. Missing/invalid/deleted capability returns Next notFound. |
| POST `/api/sign/:token` | Same capability; strict `{signatureDataUrl}` only. At most 1 MiB of canonical base64 PNG data-URL text, PNG signature/IHDR/nonzero dimensions/IEND envelope. Raw JSON max 1049000 chars. Headers retain first forwarded IP or real IP and user agent as untrusted metadata. | `{signature}` preserves the existing record envelope. Pending becomes signed once, records data URL and UTC signedAt. Any repeated/declined/expired submission rejects; it never overwrites prior signature proof. |

No signing operation accepts money inputs. Summary validation uses stored signed
minor-unit integers with matching canonical `*Minor` strings: safe range
-9007199254740991 through 9007199254740991 for all five header amounts.
Transitional ORM rejects wider history with 422 LEGACY_NUMERIC_RANGE. Strings in
historical party JSON remain opaque; no rescaling or alias inference. SQL-text
JSON token preflight rejects unsafe/precision-losing decimals before pg decoding;
party envelopes must be objects or null. This preflight applies to request/list/
resend/public read/sign, rather than decoding unrelated contact credit limits or
invoice lines. Those other fields retain their own domain owners. Signing does
not post a ledger entry or change invoice amounts/status; existing live invoice
statuses, including draft, remain supported.

Exact display separates bigint whole and string fractional parts using frozen
currency metadata. USD 1250 displays $12.50; IRR 1250 displays 1,250; KWD 1250
displays 1.250. Negative subunits and both safe-integer endpoints retain every
minor unit. Unknown currencies fail visibly rather than defaulting to USD.
This child covers the signing summary only; MON-127 retains general SSR/PDF.

## State, isolation and failure behavior

Authenticated input cannot override organization. Permission, UUID/schema and
owned live invoice checks precede writes. Historical deleted/inactive contacts
may supply their scoped name; cross-organization references fail 422 without
exposing the other contact. Public capabilities derive organization from their
invoice, then recheck it after lock waits. Soft-deleted organizations/invoices
invalidate capabilities. Missing/foreign authenticated invoice returns 404;
invalid credentials return 401, denied grants 403. Strict input failures are
400; unsupported raw JSON/history numeric tokens are 422. Expiry must be in the
future at request creation after locks. Submission rejects explicit expired
status and expiresAt <= current instant, alongside signed/declined (400).
Resend without active pending is 404, without SMTP 400.

Request/resend/sign acquire organization, then invoice, then applicable signature
locks in a DB transaction, matching snapshot corrections/lifecycle. Reads use a
read-only repeatable-read snapshot. Concurrent submissions recheck signature
status and expiry after locks; only one can update a pending record. Snapshot
corrections that win first commit before signing; corrections after signing
reject 409. Neither signing nor requesting rewrites snapshots or prior signature
records. Corrections retain their existing transactional before/after audit;
signature records retain signedAt/IP/user-agent proof metadata. No new accounting
audit/period-lock policy is inferred for this nonposting existing operation.

Request validates invoice money, scope, snapshot precision and output before
email. Output checks and database writes are transaction scoped. Email exceptions
roll back the new signature row. Resend holds locks through delivery, so signing
cannot race its pending check. SMTP send is an external side effect: a provider
acceptance followed by commit failure can still leave an already-delivered link;
no transactional outbox, automatic replay or exactly-once delivery is claimed.
HTML interpolations escape signer name, invoice number and URL. Fixture SMTP
calls are recorded in-process; no actual email/provider connection is made.
PNG envelope validation does not decode images or establish authentic identity,
legal validity of a signature, complete PNG integrity or upload/malware screening.

## Actual acceptance

`tests/integration/invoice-signatures.test.ts` migrates a random disposable
loopback PostgreSQL database, then invokes actual REST handlers, async SignPage
and React static rendering, shared services and full-registry linked SDK MCP.
Only SMTP delivery is replaced; a fixture React global supports tsx's JSX runtime.
Coverage includes real legacy/exact invoice writers, saved minor-unit aliases,
zero/two/three-decimal currencies and signed endpoints; strict errors/unchanged
DB+delivery snapshots; two tenants/custom-role denial/deleted records; each unsafe
header/opaque decimal; public capability/status/expiry; SMTP escaping/selection/
rollback; two actual signers and concurrent snapshot correction; explicit lock
wait and expiry recheck; deleted organization. Existing snapshot fixtures provide
the opposite signed-history correction lock regression. Browser transport,
real SMTP, identity/security/accounting approval, full-int64 business support,
production migration, production IRR and MON-034 combined acceptance stay open.
