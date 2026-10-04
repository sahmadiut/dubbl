# Tax period contracts (MON-072)

Bounded REST/MCP adoption under MON-022 and ADR-006. Money is signed integer
organization base-currency minor units (USD cents); numeric v1 fields retain
units and additive canonical ASCII *Minor strings preserve the same integers.
No statutory policy, schema, currency scale, rate or production flag change.

## Operations and envelopes

| REST | MCP | Inputs / outputs |
|---|---|---|
| GET /api/v1/tax-periods | list_tax_periods | No input; taxPeriods full headers with frozen lines; newest start date first, UUID tie-break; lines sort by sortOrder/UUID. |
| GET /api/v1/tax-periods/:id | get_tax_period | id / taxPeriodId UUID; taxPeriod full header with frozen lines. |
| POST /api/v1/tax-periods | create_tax_period | name/startDate/endDate/type, optional notes; taxPeriod created open header, REST 201. |
| PUT /api/v1/tax-periods/:id | update_tax_period | id / taxPeriodId and partial create fields; taxPeriod updated header; omission retains, notes null clears; only open records. |
| DELETE /api/v1/tax-periods/:id | delete_tax_period | id / taxPeriodId; success true; only open records, lines cascade. |
| POST /api/v1/tax-periods/:id/file, mode=file (default) | file_tax_period | id / taxPeriodId, optional filedReference/basis/flatRatePercent; taxPeriod header, clearingJournalEntryId, net/netMinor, outputVat/outputVatMinor, inputVat/inputVatMinor, basis, currencyCode and filedLines. |
| Same filing route | file_vat_return | Same operation; preserves compact taxPeriodId/status in place of taxPeriod header; same journal/totals/basis/currency/lines. Both existing names remain supported. |
| POST /api/v1/tax-periods/:id/file, mode=settle | record_vat_settlement | bankGlAccountId, amount and/or amountMinor, optional isRefund/date/reference; REST id required, MCP optional taxPeriodId (omitted: legacy standalone posting). settlementJournalEntryId/null, amount/amountMinor, isRefund, currencyCode; linked calls also return taxPeriod header. |

Headers retain id/organizationId/name/startDate/endDate/type/status/filedAt/
filedBy/filedReference/notes/createdAt/updatedAt. Frozen lines retain id/
taxPeriodId/boxNumber/label/amount/isCalculated/sourceDescription/sortOrder and
add amountMinor. Dates are Gregorian YYYY-MM-DD; timestamps serialize ISO UTC;
UUIDs, counts, ordering and basis points are not money. List/get read saved
figures without recomputing filed boxes. Writes return headers without lines.

## Units, validation and supported range

- Every money value, saved subtotal, aggregate, box difference, journal leg and
  balanced posting-side total must fit +/-9007199254740991. Settlement input is
  nonnegative up to that maximum. Exact strings first parse signed int64, then
  reject unsupported coexistence with 422 before committed mutation. SQL sums
  are text to bigint, never Number-coerced, including totals above int64.
  Opposite EC subtotals cannot mask unsafe individual stored amounts.
- amount/amountMinor may appear separately or together with exact agreement.
  Both are minor units: USD 1250 stays 1250, KWD 1250 stays 1250. No /100,
  rescaling, guessed FX or public representation switch. Strings reject
  whitespace, exponent, leading zero, plus, fraction, negative zero and localized
  digits. Numeric unsafe/nonfinite/fractional/negative-zero amounts reject.
- Strings are bounded to 10000 characters; name nonempty. type is monthly,
  quarterly or annual. Gregorian dates require start <= end, including merged
  partial patches; frequency does not impose a statutory calendar. Unknown
  fields/tenant overrides/unrelated exact aliases reject. Malformed/non-object
  JSON cannot trigger filing; valid {} retains legacy default filing.
- basis accrual/cash, omitted uses org vatScheme with accrual fallback.
  flatRatePercent is positive numeric int32 basis points up to 2147483647,
  1000=10%; no money/FX string alias. It retains zero filing boxes 1/4 without
  turnover computation. Zero-net filing retains an empty posted clearing header.
- isRefund defaults false; date defaults today's UTC date. Linked reference
  defaults to filedReference/name; explicit reference wins. Payment debits
  suspense 2240/credits bank; refund reverses. Zero validates state/ownership/
  date but creates no journal or audit, including additive MCP support.

## Calculation, state and atomicity

Filing locks live org and owned period before figures/posting. Posted,
non-deleted GL movements on owned live 2200/1500 use the inclusive date range.
Cash retains CASH_SOURCE_TYPES-or-bank-leg heuristic, not payment allocation
accounting. GL amounts are carried in base units; foreign document tags do not
rescale them. Negative saved debit/credit legs reject. Box 1 = credits-debits,
box 4 = debits-credits, box 2 = 0, box 3 = box 1, box 5 = box 3-box 4.

Boxes 8/9 retain the existing VAT-registered cross-border contact heuristic and
document date/status/deleted filters, without positive EU classification.
They retain document-date selection for both requested recognition bases.
Qualifying contacts must be owned. Only base-currency document subtotals qualify;
foreign values reject instead of summing unlike units or guessing historical FX.
Missing controls imply zero movement and are created atomically. Existing
controls must be active/live, correctly typed and base-denominated.

The same box 1/4 values create signed clearing legs to 2200/1500/2240.
Journal header/sourceId, lines, identity FX history, seven frozen lines, period
status/actor/reference and required audit commit together. Identity dual-write
is 1000000/rateExact "1", quote_per_base, exact status/version/provenance.
Org locks serialize numbering, which is int32-bounded. Both filing names share
the service; concurrent/repeated filing rejects after the first success without
an extra journal. Filed/amended periods cannot be edited/deleted; no new amendment
workflow or historical repair. Saved line/date guards also precede linked writes.

Settlement locks org and optional period; linked open periods reject, filed/
amended qualify. Bank must be owned/live/active, asset/subType bank and base
denomination. Foreign settlement FX is unsupported. Audit/journal writes commit
together; sourceId links new history without rewriting standalone history.
Filing/settlement call existing two-tier advisor/period and closed-fiscal-year
checks on posting dates. Metadata CRUD posts no ledger movement and retains
no posting-date lock requirement.

## Scope, compatibility and retries

Actual REST auth and server AuthContext supply tenant/actor. Writes require
manage:tax-config; reads retain authenticated access. Foreign/missing periods
and unavailable banks return 404; auth/permission 401/403; schema/state 400;
period lock/unsupported saved money/units 422. MCP uses wrapTool. Existing IRR
functional posting remains disabled by the financial gate.

Corrections: malformed JSON cannot silently file; losing filing races cannot
leave extra journals; filed dates cannot be rewritten; open periods cannot
receive linked settlements; arbitrary/non-bank/inactive/deleted/foreign-currency
banks reject; required audits are transactional; unlike-unit and unsafe EC sums
reject. New update/delete tools close existing operation parity. Numeric fields
and filing names remain compatible; exact fields are additive.

Create and standalone/linked settlement retain no generic request idempotency
key. Repeated positive settlements post separate cash journals. No outstanding
cap, sign-versus-box policy, payment record, bank movement, automatic reconciliation
or reversal workflow is invented. Distinct overlapping periods retain GL movement
semantics including prior clearing entries. Org locks cover adopted writers;
unadopted global fiscal closure/lock/chart/report concurrency stays unqualified.

## Qualification and remaining gates

Pure schemas/DTOs and actual REST handlers plus registered SDK clients on
disposable migrated PostgreSQL18 verify numeric/exact aliases, two tenants,
API-key/custom-role permissions, >int32 values, max-safe settlements, over-safe/
over-int64 aggregates, unsafe saved values, currencies, EC ownership/units,
frozen reads, filing races, cash/flat-rate/payable/refund behavior, date locks and
full SQL rollback under audit/journal faults. SDK uses InMemoryTransport; no
genuine network/session/OAuth, provider, UI or statutory authority qualification.

Full-int64 consumers, historical FX/malformed-data remediation, reports MON-029,
combined MON-022 and independent financial/security/migration/IRR production
gates remain separate. Unused legacy journal-automation tax helpers and report
calculations are not qualified here. No full build, dev server, production DB
migration, deployment or statutory-rate refresh occurred.
