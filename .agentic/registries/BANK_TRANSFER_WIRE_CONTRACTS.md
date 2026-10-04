# Bank transfer wire contracts (MON-067)

2026-10-04, Asia/Tehran. Direct-DB shared services in `lib/api/bank-transfers.ts`,
strict described schemas in `bank-transfer-wire.ts`, registered MCP tools in
`tools/bank-transfers.ts`. Safe numeric coexistence; no full-int64 or IRR rollout.

## Operations and envelopes

| REST POST | MCP tool | Successful result |
|---|---|---|
| `/api/v1/bank-transfers` | `record_bank_transfer` | `{journalEntryId}` |
| `/api/v1/bank-transactions/{id}/match-transfer` | `match_transfer` | `{journalEntryId,counterTransactionId,mirrorCreated}`; MCP also retains `transactionId` |

Both REST statuses remain 201. Both require `manage:banking` and the authenticated
organization. API keys inherit the creator's role/custom permissions; a spoofed
organization header does not change scope. MCP uses AuthContext and wrapTool;
no HTTP self-calls. Old duplicate tool registrations were removed. Unknown
fields and malformed IDs/dates/money reject; no implicit exact mode/header.

## Standalone inputs and units

Required fromBankAccountId/toBankAccountId are distinct active live owned bank
UUIDs in the same ISO currency. Required date is real Gregorian YYYY-MM-DD.
Optional memo is nullable, maximum 10000 characters; blank/null becomes no
reference. No currency override or cross-currency cash transfer is supported.

At least one monetary alias is required. REST numeric `amount` retains decimal
**major** units, USD 12.50; MCP numeric `amount` retains integer **minor** units,
USD 1250 cents. `amountExact` is a nonnegative exact decimal major string (20 whole
digits, up to 18 fractional digits, ASCII, no exponent/leading zero/whitespace).
`amountMinor` is a canonical signed int64 integer string; transfer magnitude
must be positive. Negative/zero or values rounding to zero fail. Major aliases
agree exactly before rounding once to currency minor units (nearest, ties toward
positive infinity); minor aliases agree with the rounded result. Numeric decimal
input uses its JSON Number spelling and cannot recover precision lost by clients.

USD 12.50 / JPY 1250 / KWD 1.250 / IRR 1250 each represent 1250 minor units.
Supported input/saved/converted money and journal totals are safe integers up to
9007199254740991 in absolute magnitude; larger otherwise valid exact input is
422 before committed effects. Normal output keeps only its existing journal ID;
no silent unit/type or response-envelope change. Audits add amountMinor next to
numeric minor-unit amount and record source/target IDs, paired movements/group,
base/currency and exact rate.

Each standalone invocation intentionally creates a NEW transfer. Concurrent
independent invocations serialize and produce distinct journal numbers/pairs.
There is no replay key or response replay; callers must inspect before retrying
after an uncertain success. Matching is the exclusive operation described below.

## Statement matching inputs and state

Path ID / MCP transactionId is a source statement UUID. Required
targetBankAccountId is another active live owned bank UUID of the same currency.
Optional nullable counterTransactionId must identify an unlinked unreconciled
nonzero target-bank statement with exactly opposite signed amount. Omission/null
creates one synthetic mirror with the source's date and opposite amount. No
amount/date overrides are accepted. Null saved statement currency inherits bank
currency; explicit currency must match its parent, including the counter line.

Both statement dates must be open; the single journal uses the source date.
Different existing statement dates are retained (bank clearing may differ).
Existing amount, date, running balance, description, reference and sourceType
are retained. Both legs receive the same journal and transferGroupId, reciprocal
transferTransactionId and reconciled status. Positive source is the receiving
bank (debit); negative source is the sending bank (credit). Generated movements
are sourceType transfer, without import/running-balance provenance.

Excluded/reconciled/zero, journal/session/transfer-linked lines fail. Existing
live cash payment and bank-created expense audit history fail, even if a legacy
undo cleared the line's journal. Imported statement ownership/currency is checked.
Tenant lookup happens before money decoding, including unsafe foreign values.
Same source/counter, wrong counter bank/sign/magnitude/currency, missing/foreign/
deleted/inactive banks or references fail before commit. Repeated matches fail;
concurrent source/counter/opposite-direction matches leave one successful posting.

## Posting, balances and atomicity

Organization -> bank -> movement locks serialize these services with adopted
account/import/categorization/document-matching writers. Bank GL auto-allocation
occurs inside the transaction. Every bank GL must be active/live/owned, correctly
denominated with its account-type asset/liability band and exclusively linked,
including deleted or foreign bank claims. Same GL links are rejected.

Resolve historical exact bank-to-organization-base FX as of the source/standalone
date through the transaction executor. Same currency is identity. Missing,
unqualified, future-only, reciprocal requiring more than six exact decimal
places, or otherwise unrepresentable positive int32-millionths rates fail 422.
Bigint ratios apply both currencies' minor scales; each of the two base legs
rounds to the same positive safe amount. A zero rounded base amount or overflow
fails. One bank_transfer journal debits receiving GL and credits sending GL;
there are no P&L/tax/payment/document legs. Lines save exact rate, quote_per_base,
version/status/provenance and compatible numeric exchangeRate. Migration triggers
retain their existing lossless dual-write/provenance policy.

Cached bank balance and provider running balance are statement snapshots; these
operations preserve them, matching the existing contracts. New signed movements
affect movement aggregates and GL balances, not a fabricated provider balance.
No new opening balance posting or retroactive running-balance recalculation.
Tests assert exact signed paired sums, each bank's GL direction/base amount and
unchanged cached/existing running balances. Diagnostic differences remain visible.

Bank self-linking, numbering, journal/lines, two movement inserts or existing
movement links and audit share one transaction. Audit fault injection rolls back
everything, including auto-created GL accounts. Success serialization is guarded
before commit. Unauthorized/malformed/business/range failures leave SQL-text
financial/audit snapshots unchanged. REST 400 validation/state, 401 auth, 403
permission, 404 missing/foreign and 422 range/currency/FX/period errors use the
existing shared mapping; internal/audit failure is 500. MCP returns wrapTool errors.

## Qualification and handoff

Pure schemas plus actual exported REST handlers and registered SDK tools on
disposable migrated PostgreSQL 18 cover legacy/exact/dual clients, four currency
scales, safe maxima, directions, paired/mirror matches, auth/custom permissions,
tenant isolation, invalid history/GL/period/range, fault rollback and concurrent
exclusive matching. No browser/session/OAuth, provider, PostgreSQL 16, production,
independent financial/security or IRR enablement proof is implied.

MON-068 owns undo/session reconciliation and must consume one shared transfer
journal and reciprocal links without reposting, changing preserved imported
balances or relabelling noncash history. Generic old undo is not newly qualified.
Legacy synthetic sourceType transfer with manually cleared links rejects; stale
history requires its assigned remediation. Other rules/bulk operations remain
MON-069 and combined payment/expense/banking acceptance remains MON-021.
No schema, migration files, flags or historical unit changes.
