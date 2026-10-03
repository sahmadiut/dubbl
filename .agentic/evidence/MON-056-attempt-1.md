# MON-056 attempt 1 - payment settlement contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD b89fdc0,
clean master working tree. User requested the next task and commit/push after
full completion. Controller validate/status/context selected MON-056, started
with coding-assistant ownership. Read root/nested instructions, START_HERE,
controller, project/map/backend role, MON-011 evidence, ADR-006, source migration/
compatibility sections, manifest and preceding payment/carrier/lifecycle handoffs.
Self-review only; no independent human/accounting or deployment authorization.

## Implementation

Shared payment-settlement-wire/payment-settlements replaces duplicate standalone
creation and invoice/bill pay REST/MCP writers. Positive safe numeric amount and
canonical amountMinor aliases agree, including allocations. Dates/UUIDs, bounded
distinct full-cover allocations and explicit currency/contact/direction validate
before posting. Numeric money retains original document minor units, with matching
string aliases on payment/allocation/contact/document responses. Larger valid
int64 inputs fail 422; no rescaling, precision recovery or exact-only negotiation.

MCP document pay now creates actual payment/allocation/journal records, using
manage:payments instead of the former invoice/bill balance-only annotation paths.
Date is required in REST and optional UTC-today in MCP. Standalone results retain
{payment}; pay retains {invoice,payment}/{bill,payment}, adding metadata/aliases.

Organization/document/recognition/history row locks serialize adopted writers,
first numbering and retries. Scope and current balances are checked under lock.
Recognition must be live/unreversed/posted, with matching source/date, owned
accounts, balanced safe amounts and consistent exact FX. Invoice recognition must
cover its header payable. Review found matched-receipt bills can split AP across
bill and bill_grni entries or use clearing alone; combine both qualified journals
instead of settling only main/tax AP. Reverse-charge bills subtract actual payable,
not tax-inclusive total. No draft, void, deleted, overpaid or unrecognized document
becomes a settlement success.

Release saved AR/AP carrying cumulatively using exact bigint ratios and rounding,
including the final residual. Validate earlier allocations/paid/carrying history.
Credit/debit notes and prepayment applications remain noncash carriers, qualified
against their saved journals and matching/proportional FX. Missing or ambiguous
legacy history, differing carrier FX/rounding and balance-only annotations fail
visibly instead of guessing or repairing posted history.

Payment cash uses historical exact payment-date FX through the same transaction,
with explicit source/destination minor scales. Historical recognition does not
reload current issue-date quotes. Bank account must be active/live/owned and match
document currency; cash uses its linked active asset GL (created/linked within the
transaction) or GL 1100. Cash, per-document control and FX gain 4910/loss 5930
balance exactly. Saved journal FX coexists losslessly with legacy millionths;
audit records rate/base/source/effective-date/provider/inverse provenance and
recognition carrying values. Statement bank balance is not a new cash accumulator.

Every sequence/payment/allocation/bank-link/journal/balance/status/paidAt/audit
write and output preflight shares one transaction. Mandatory audit failure rolls
back money and numbering. Optional body/tool idempotencyKey or matching REST
Idempotency-Key normalizes amount aliases and allocation order; an authorized
repeat returns original JSON, changed operation/data returns 409. Keys are scoped
to the organization across these operations. The settlement audit row stores the
durable retry/provenance record; retaining it is required. No reference guessing.

Changed three REST exports, payments/invoices/bills registered MCP callbacks,
two new service/wire files and historical-rate resolver executor typing (accepts
transaction query interface without a cast). Added pure and PostgreSQL fixtures,
settlement registry, public docs, manifest/matrix and refreshed lexical inventory.
No schema, migration, currency regime or rollout flag changed.

## Acceptance mapping

1. PAYMENT_SETTLEMENT_WIRE_CONTRACTS inventories all six boundaries, envelopes,
   positive minor aliases, date/UUID/null/default/count/text/key inputs, safe money/
   converted sum/FX/numbering ranges, recognition/carrier/bank constraints,
   permissions/locks/errors, retries and unsupported history. Public docs and
   described MCP fields agree with actual source.
2. Actual REST exports use synthetic API keys, memberships/custom roles and
   spoofed organization headers; registered SDK tools use captured contexts.
   Fixtures cover numeric/exact/dual aliases, received/made single/multiple cash,
   USD/IRR/JPY/KWD scales, partial/final/rounded carrying, gains/losses in both
   directions, edited issue FX, reverse-charge payable, split/clearing-only GRNI
   recognition shapes, note/prepayment carriers and bank auto-linking. Auth,
   expired/invalid keys, read-only/payment-only roles, foreign/missing IDs and
   retry scope/permission isolation are asserted. Regression workers pass.
3. Negative fixtures retain SQL-text snapshots of business tables, excluding
   API-key last-used bookkeeping. Malformed/conflicting/unsafe aliases, SQL unsafe
   history, converted overflow, duplicate/mismatched/overpaid allocations, invalid
   dates/status/recognition/carrier history, foreign/inactive banks/accounts,
   locked dates/closed fiscal years and missing FX fail without committed writes.
   Injected SQL audit rejection rolls back all writes. Concurrent first payment
   numbering is unique; competing over-settlements accept one, repeated keys
   produce one payment/allocation/audit/result. Saved outputs keep numeric types
   and exact strings without bigint JSON crashes.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18.6 cluster D:/Temp/dubbl-mon056-pg-33e7a68586834156bf66eeaf9df56286,
loopback port 55466, trust-auth dubbl_ci test role, hidden pg_ctl launch. Explicit
TEST_DATABASE_URL selected only this server. Harness created/migrated/dropped
random fixture databases; configured local/production target and .env credentials
were not inspected or used. Stripe worker key was blank.

| Command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119-task graph, MON-056 | Structural only |
| node --import tsx --test tests/payment-settlement-wire.test.ts | Exit 0; 3/3 | Pure schema/exact arithmetic groups |
| npm test | Exit 0; 172/172 | Pure suite; final DB-only review changes additionally covered below |
| Final node --import tsx --test tests/integration/payment-settlements.test.ts tests/integration/payment-reads.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts | Exit 0; 5/5 | Actual handlers/SDK/PostgreSQL; no real HTTP session/OAuth |
| Final pnpm typecheck | Exit 0; MDX and tsc --noEmit | Installed/generated environment; no build |
| pnpm lint | Exit 0; 0 errors/155 existing warnings | Before final recognition review additions |
| Final affected npx eslint (12 TS paths); then final service/worker after review typing changes | Exit 0; clean | Final affected source has no warnings/errors |
| money_inventory.py --write; verify_money_inventory.mjs | Exit 0; 410 columns/1451 paths/1196 consumer hashes/23194 occurrences verified | Lexical metadata, not financial qualification |
| verify_legacy_money.mjs | Exit 0; 9 regression checks | No new deprecated helper adoption |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Push follows task closure |
| git diff --check; controller validate | Exit 0 | Line-ending notices only; structural validation |
| Fixture DB count, pg_ctl -m fast -w stop | Zero remaining fixture DBs; shutdown exit 0 | Temporary cluster retained outside repo |

Initial typecheck identified optional-result narrowing, a nonexistent contact
isActive field and fixture imports; corrected them. Initial integration used the
wrong applyCredit export and a non-dk invalid key that selected unavailable session
request context; corrected synthetic fixtures. Foreign missing documents initially
hit missing control-account validation first; moved document loading ahead of
account resolution so both transports preserve 404. FX setup initially collided
with a USD contact credit limit; cleared the synthetic limit before foreign docs.
Added prepayment, overflow/loss/first-number/scope and GRNI fixtures in review.
Final GRNI typecheck initially found an untyped snapshots array and union fixture
billNumber; added explicit result typing/narrowing. All final checks above pass.
Injected audit failures intentionally produce REST 500/MCP errors and full rollback;
they are verified expected failures, not successful settlement or hidden errors.

No build, dev server, Docker, browser/session/OAuth, provider, schema generation,
configured-target migration, deployment, independent review or IRR enablement.
Legacy batch/schedule/bank/config/lock writer concurrency, carrier FX expansion,
full-int64 domain and overall financial/migration/security/release gates remain
their assigned tasks; MON-021 combined acceptance is not completed here.

## Review and handoff

See MON-056-review-1 for implementing-assistant self-review. No slice blocker.
Close acceptance/submit/self-review/done, validate staged content, commit and push
as requested. Stop after MON-056; next task MON-057 payment reversal contracts.
