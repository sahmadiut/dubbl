# MON-012 combined exact REST and MCP boundary contracts

2026-10-10, Asia/Tehran. This parent independently joins MON-011 and all four
completed rollout children. The linked inventories enumerate each operation,
input/output envelope, units, aliases, permissions and supported business range.
Their individual contracts remain authoritative; completion does not expand them.

| Complete inventory | Boundary ownership | Representation and supported range |
|---|---|---|
| [FX](FX_WIRE_CONTRACTS.md), MON-013 | REST rate collection/detail; currency/rate/preview MCP tools | REST numeric millionths, MCP decimal numeric input, quote_per_base rateExact; positive int32 millionths, lossless six-decimal coexistence. Unsupported tiny/high rates reject before rate/audit writes. Inverse read precision and legacy-only conversion limits remain explicit. |
| [Core accounting](CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md), MON-014 | Six linked inventories: contacts, GL, receivables, procurement/payables, payments/expenses/banking, organization/tax/approval | Declared currency minor money, currency major document prices and legacy fixed-two journal/import fields remain separate. Named Minor/Exact strings agree with supported numeric fields. Signed safe integers and tighter sign/product/total/FX/business bounds apply before mutation; full-int64 thresholds do not imply full-int64 posting. |
| [Auxiliary/reporting](AUXILIARY_REPORT_INTEGRATION_CONTRACTS.md), MON-015 | Seven linked inventories: budgets, inventory, payroll, assets/loans, projects/CRM/pricing, consolidation/schedules, reports/dashboard | Named money aliases retain stored units; physical quantities, counts, basis points and opaque filters stay separate. SQL text/bigint reports preserve sums; all exposed numeric money must coexist safely. Decimal payroll FX provenance retains its own adoption policy. |
| [Public/opaque/export](PUBLIC_BOUNDARY_INTEGRATION_CONTRACTS.md), MON-016 | Five linked inventories: public capability JSON, providers, backup, import/export, opaque/signing/rendering | Token/tenant grants, native provider shapes, immutable original payloads, explicit versioned snapshots and source-specific CSV units are preserved. Opaque int64 strings are not monetary write aliases. Safe bridge/provider limits and incomplete recovery graph rejection remain as documented. |

The shared primitives are documented in [ADR-006](../docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md).
No inferred locale/magnitude/header negotiation, historical rescale, generic
alias insertion, numeric-client removal or invented sunset date. Malformed or
conflicting aliases fail validation; unsupported valid values and unsafe retained
money fail with LEGACY_NUMERIC_RANGE/422. Org/role/period-lock/audit/idempotency
policies remain those of the owning operation. Best-effort audits and external
provider-after-commit limitations are not turned into stronger guarantees.

## Account detail closure discovered by this parent

GET /api/v1/accounts/[id] and MCP get_account now share lib/api/account-detail.ts.
The account UUID is organization scoped, with no monetary input. The existing
authenticated account-read policy is preserved (no new view:data requirement).
MCP uses a full strict described schema and wrapTool with direct DB access.
Foreign/missing accounts return 404; malformed IDs/unknown MCP controls reject.

Posted non-deleted journals owned by the current organization contribute, including
inactive account history. Foreign-entry references, deleted journals and drafts
are excluded. A repeatable-read read-only snapshot obtains source values as SQL
text, sums with bigint and projects only safe Numbers plus matching totalDebitsMinor,
totalCreditsMinor and balanceMinor. REST retains its account/data/pagination
envelopes, whole-history totals, entryCount, search/date/entry-type filters and sort;
detail debitAmount, creditAmount and running balance receive Minor companions.
Stable source ordering is date, entry number, entry ID and line ID. Amount sorting
uses bigint comparisons. Natural sign is debit minus credit for asset/expense,
credit minus debit otherwise. Counts/entry numbers are not money. Source, displayed
running balances and gross totals must fit +/-9007199254740991 even if other values
cancel. MCP summary does not expose running balances. Account metadata currency
does not rescale base-ledger units. Existing metadata create/edit/merge operations
carry no monetary input or output and retain their contracts.

## Existing UBL export closure

GET /api/v1/invoices/[id]/ubl and new MCP export_invoice_ubl share invoice-ubl.ts.
Both require view:data and an owned live UUID, with owned contact/tax references,
no monetary input and a repeatable-read read-only projection. Existing required
supplier/customer names/countries and nonempty lines still fail with 422; REST
retains error/details and its XML attachment envelope. MCP returns xml, filename,
currencyCode and totalMinor. All saved header/line money is checked before output.
XML prices/totals format bigint minor units at the saved currency scale, retaining
every safe unit through the maximum safe integer: USD/EUR two, IRR/JPY zero, KWD
three decimals. Physical quantity hundredths and tax basis points keep their own
units. The existing combined tax percentage uses an exact half-up integer ratio.
No new tax validation, Peppol acceptance or statutory compliance is claimed.

## Direct response and JSON ownership audit

[EXACT_BOUNDARY_DIRECT_JSON.json](EXACT_BOUNDARY_DIRECT_JSON.json) lists every
remaining direct NextResponse.json API route and its reviewed response-family
policy/contract. The source closure regression detects additions/removals and
requires reviewed ownership. These direct replies are metadata, reference/access/
text/count/URL/error envelopes, or native provider/guarded backup forwarding.
Account GET money and UBL XML were the missed monetary projections and are now
guarded. Invoice compliance returns existing warning text only. Fiscal-year
close/reopen expose status metadata, with no monetary wire input/output; their
internal Number-based year-end workflow remains MON-007/accounting qualification
and is not a newly supported large-value posting path.

[Opaque JSON ownership](OPAQUE_PUBLIC_INTEGRATION_CONTRACTS.md) closes all persisted
JSONB declarations and non-JSONB forwarding. MONEY_BOUNDARIES.json scans every
REST/MCP/source consumer with hashes, units, schema and remaining migration owners;
it is lexical evidence, not transitive financial proof. The four inventories above
cover monetary operations using shared guarded JSON and domain-specific DTOs.

## Independent combined acceptance

exact-boundary-integration.test.ts executes actual API-key handlers, registered
full MCP SDK and migrated disposable PostgreSQL. Eight legacy 1250/exact 3000000000
scenarios compose EUR invoices in USD books at exact 0.8 and same-currency IRR,
JPY, KWD. Independent bigint expectations reconcile recognition GL, account detail,
P&L, revenue budget, fixed-two CSV, version 2 backup, public payment/portal statement,
HTML and currency-scaled UBL. Changing a reference quote preserves posted FX/report
history. Whole-public-table snapshots exclude only API-key usage bookkeeping and
prove no mutation for malformed/conflicting/unsafe amounts, unsupported rate/budget,
invalid credentials, empty grants, foreign IDs/tokens and locked posting.
Genuinely unsafe persisted SQL int64 rejects authenticated/public/export/backup/
render/UBL reads. Account regressions qualify exact maximum-safe totals, pagination/
filters, foreign/deleted/draft exclusion, unsafe aggregate and unsafe source rows.
The four existing child-parent suites and FX fixture supplement deeper operations;
UBL pure fixtures qualify exact safe-edge text and tax ratio behavior.

## Remaining qualification

MON-006 retains its own parent acceptance. MON-007/008 retain number-domain/full-int64
consumer cutover; migration, accounting, security, localization, IRR enablement and
release gates remain independent. No schema/history rescale or production flags
change. No application DB, dev server/build, browser, live provider or deployment
is used. Existing UBL customization declarations remain historical output metadata;
this work establishes monetary serialization, not standards certification.
