# MON-031 payment provider and webhook wire contracts

Verified 2026-10-08; implementation and fixtures, not live provider qualification.
Parent MON-016 retains combined opaque/provider integration acceptance.

## Units and supported ranges

Stripe native signed event JSON, provider requests/responses and outgoing opaque
payloads keep their field names. No generic exact-alias injection, global bigint
patch, currency conversion or historical amount rescaling is performed.
Provider objects are validated after signature verification without modification.
Arbitrary provider `metadata` string fields remain opaque, even if named amount.

`lib/integrations/stripe/money.ts` pins this application's same-scale zero/two
decimal currency profile. USD 1250 means 12.50 USD; JPY 1250 means 1250 JPY.
Provider/ISO mismatches (including ISK, UGX, MGA), three-decimal currencies and
unqualified codes (including IRR) reject rather than use the previous blanket
100 scaling. This is an application support policy, not a claim of account or
regional availability. Posting requires the organization's functional currency;
fee balance transactions must share the event currency. Payout banks must have
the same currency and belong to the organization. Explicit FX posting remains
unqualified and unsupported in these integration handlers.

Stripe documents currency-specific representations and HUF/TWD payout
divisibility rules: [supported currencies](https://docs.stripe.com/currencies).
The local profile enforces HUF/TWD payout values divisible by 100. Checkout uses
an application ceiling of 99,999,999 minor units; this is deliberately conservative,
not Stripe's universal maximum. Account/network minimums, lower limits and live
availability are still enforced by Stripe. Checked the official documentation
on 2026-10-08; no live payment was submitted.

Native integer amounts and signed fees/net balances must be finite safe integer
Numbers, at most +/-9,007,199,254,740,991; nonnegative payment totals are required.
Fractional `unit_amount_decimal` values and disagreeing integer/decimal prices
reject. Canonical int64 strings outside the numeric coexistence range also
reject before consuming a number-based workflow. Currency scales never change
saved legacy amounts. Dates remain UTC seconds or Gregorian date-only values;
quantities/counts and pagination remain numeric physical units.

## Boundary inventory

| Boundary / counterpart | Inputs and authorization | Output and monetary contract |
|---|---|---|
| POST `/api/pay/[token]/checkout`; MCP `create_invoice_checkout` | Public bearer invoice link; MCP requires `manage:invoices` and matching organization. Saved payable invoice only, no amount overrides. | `{checkoutUrl}`; provider `unit_amount` is the saved balance, 1..99,999,999, and private `amountMinor` metadata snapshots it. Invoice totals already include tax, so no additional automatic tax is applied. |
| POST `/api/v1/billing/checkout`; MCP `create_billing_checkout` | `manage:billing`, current org. Strict type seats/storage, plan pro or starter/growth/scale, monthly/annual. Configured Price validated before customer creation. | `{url}` or `{updated:true}`. Uses native Price IDs and existing provider subscription/proration/automatic-tax behavior; no client monetary inputs or aliases. |
| POST `/api/stripe/webhook` | Original text and Stripe signature using `STRIPE_WEBHOOK_SECRET`; checkout/subscription native objects. | `{received:true}`. Invoice checkout requires paid payment mode, PI ID, org/invoice/token, saved currency and exact current due amount; optional snapshot string must agree. Unpaid events do not settle. |
| POST `/api/integrations/stripe/webhook` | Original text and Connect signature using `STRIPE_CONNECT_WEBHOOK_SECRET`; integration resolved by verified account. | `{received:true}` / skipped. Unknown accounts/events skip. Failed monetary events produce failed diagnostic sync logs, acknowledge, and use the existing retry job. Deauthorization retains native disconnect behavior. |
| POST `/api/v1/integrations/stripe/import`; MCP `import_stripe_csv` | `manage:integrations`, owned live integration. Multipart file/type/integrationId for REST; raw CSV/type/integrationId for MCP. | `{imported,skipped,errors}`. Major decimal columns are parsed exactly; additive `Amount Minor`, `Fee Minor`, `Net Minor` canonical integer columns agree when both forms exist. No rounding. Charge fees are posted with the charge's currency. |
| POST `/api/v1/integrations/stripe/sync`; MCP `trigger_stripe_sync`; `runInitialSync` | Owned live integration and `manage:integrations`. REST accepts strict UUID only; MCP days 1..90, integer. Stored initialSyncDays is physical config. | Immediate success envelope; background operation consumes the same validated handlers. Per-object failures log without committing that object's financial changes; initial-sync completion retains the existing attempt-completed semantics, not proof every row succeeded. |
| `retryFailedStripeEvents` | Internal scheduler; scoped integration from failed logs; account-scoped native event retrieval. | Numeric retried/succeeded/failed/exhausted counts. Same processor and guards as signed events; diagnostic retry-count updates remain intentional. |
| POST `/api/v1/integrations/stripe/reconcile`; MCP `reconcile_stripe_balance` | `manage:integrations`, owned live UUID, integer days 1..90 (no coercion or clamping). Service independently checks org before provider call. | `matched,totalChecked,missingLocal`; missing rows include safe signed `amount`, agreeing `amountMinor`, explicit `currencyCode`, source ID/type and UTC created seconds. REST adds success:true. Read-only, provider query cap 500. |
| REST Stripe status; MCP list/status/sync-log/health/entity-mappings | Existing org-scoped reads. Integration config, event IDs, timestamps, diagnostic counts. | Config/counts retain units. Explicit local mapping money fields amount/feeRefund/reversedAmount and subscription item amounts gain `*Minor`; arbitrary native payload metadata stays opaque. Guarded serialization rejects unsafe stored Numbers. |
| `fireWebhookEvent`, `deliverWebhook`, retry task | Trusted domain payload, active live webhook; no incoming user monetary schema. | Existing event/org envelope and payload, safe bigint becomes the identical numeric value. Unsafe numeric money rejects before delivery insertion/queuing/fetch. Existing exact strings remain strings; no inferred aliases or rescaling. |
| REST webhook CRUD/subscribe/unsubscribe/deliveries/test; MCP list/create/update/delete/list-deliveries/test | Existing org-scoped config routes; mutation permission `manage:webhooks`, now mirrored by MCP. No client amount input. | Config and delivery records; test payload is unchanged. Delivery reads/test use guarded JSON. Payload is opaque with the units established by its originating domain. |

Configuration/OAuth connect/callback/disconnect/settings and admin cancellation
transport native IDs, tokens, account mappings, plans and day/count settings,
not monetary values. Existing config endpoints/tools remain intact. There is no
MCP impersonation of a signed Stripe inbound webhook or internal scheduler.

## Processor operations and transaction guarantees

`processStripeEvent` covers charge succeeded/refunded/expired, dispute
created/closed, payout paid/failed/canceled/updated (canceled/reversed), invoice
paid/voided/payment_failed, payment-intent payment_failed, transfers
created/reversed, credit notes created/updated/voided, customer
created/updated/deleted and subscription created/updated/deleted. External
provider cents/minor integers, refund arrays, fee balances, invoice subtotal/paid,
credit-note total/subtotal/lines and subscription prices are validated before
financial commit. Local balance differences use bigint with checked numeric
conversion. Credit-note subtotals cannot exceed totals; checkout paid+due must
conserve total. Signed fees/net and fee-detail amounts retain their signs.

All direct handlers, signed events, CSV rows, initial sync and retry enter a
shared org-serialized DB transaction. Contacts, chart accounts, numbering,
journals/lines, credits, payments, banking and dedup maps commit together or roll
back, including invalid fees discovered in a subsequent provider retrieval.
Number allocation uses the caller's transaction. Fresh integration/account/bank
ownership is checked; mapped contacts/credits/journals cannot cross orgs, and
linked journal mutation dates are checked against period/fiscal locks. Metadata
events conservatively honor the same lock policy. Provider diagnostics remain
outside the financial transaction. Existing notification hooks are best effort;
external network failures and delivery semantics are not made atomically
transactional with Stripe.

CSV preflight parses every selected row and its currency before any import.
Malformed monetary/date inputs reject the full file. Rows with nonmatching ID
prefixes remain ignored; dates absent in legacy exports retain the current UTC
fallback. Per-row business/period/provider failures return errors and roll back
that row; earlier valid rows may commit. CSV is a single-line quoted-field
parser; multiline fields and formatted/localized monetary syntax are unsupported.

Invoice settlement verifies scoped org/invoice/token/currency and actual paid
total, locks the invoice, and atomically writes payment/allocation/balances.
Duplicate PI deliveries and concurrent repeats are idempotent. A changed balance
rejects for manual reconciliation rather than recording the new balance as the
old provider payment. No changes to previously recorded payments are made.

Outgoing JSON recursively sorts object keys while preserving array order and
opaque units, then signs exactly the bytes sent with HMAC-SHA256. The initial
stored payload is the parsed canonical body, so PostgreSQL JSONB key ordering
cannot change retry bytes. Unsafe/nonfinite payloads fail before insertion;
safe bigint values do not crash serialization. Inactive/deleted destinations
are not delivered. No new delivery-payload version is advertised.

## Verification and limits

`tests/stripe-money.test.ts` and `tests/integration/stripe-contract*.ts` exercise
actual REST/API-key and registered MCP transports, two tenants/custom denied
roles, legacy/exact CSVs and maximum safe values, all-file rejection snapshots,
post-fetch rollback, positive monetary lifecycles and balanced posted journals,
USD/JPY fee units, ownership/period rejection, concurrent deduplication,
signature failures/duplicate Connect events, invalid subscription prices,
initial sync, failed-event retry, paid/stale/mismatched checkout and canonical
HMAC retry bytes. Stripe API calls and outgoing fetch are mocked; no actual
provider requests or payments occur. Related invoice/payment/public-portal
integration fixtures protect shared numbering and existing tools.

No schema/migration, production database operation, IRR gate change, full build,
dev server, browser qualification or live provider/account certification.
