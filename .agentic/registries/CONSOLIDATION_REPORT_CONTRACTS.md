# Consolidation report and translation contracts

MON-096, 2026-10-06 (Asia/Tehran). Shared configuration authorization from
MON-095; technical self-review only, no accounting or production approval.

## Boundaries

| REST | Registered MCP operation | Input | Output / side effects |
|---|---|---|---|
| GET /api/v1/consolidation/groups/:id/report | get_consolidation_report | UUID id/groupId; optional startDate/endDate | Existing full worksheet plus exact aliases and translation.rates; read-only |
| POST /api/v1/consolidation/groups/:id/report | recalculate_consolidation_report | Same query/tool fields | persisted:true plus identical worksheet; replace all entries for group/period end and audit atomically |

Dates are inclusive, canonical real Gregorian YYYY-MM-DD (0001 through 9999).
Defaults are January 1 of the current UTC year and today UTC. The start must
not follow the end. REST query and MCP schemas reject unknown fields. POST
retains query-based dates and has no money, FX or JSON-body inputs. There is no
consolidation-rate write operation in the existing slice: rate resolution is
read-only. No implicit representation switch or request header negotiation.

## Units, aliases and ranges

All report monetary values are signed integer **fixed cents**, retaining this
legacy surface's units for USD, JPY, KWD and IRR. Functional currency is the
saved member override, otherwise organization default, otherwise presentation.
Group/members explicitly carry presentation/functional ISO currencies. Member
GL balances are interpreted in those existing functional units. Neither the
alias suffix nor currency metadata rescales stored ledger/document integers.
Documents used for intercompany caps retain their own currencyCode before
translation. All output amounts below are presentation-currency fixed cents.

Every listed number gains a sibling `<field>Minor` canonical ASCII integer
string with identical value, including zero and negative values:

| Output section | Monetary fields with exact aliases |
|---|---|
| consolidatedPnL | totalRevenue, totalExpenses, netIncome |
| consolidatedPnL.byEntity[] | revenue, expenses, netIncome |
| consolidatedBalanceSheet | totalAssets, totalLiabilities, totalEquity, balanceCheck |
| consolidatedBalanceSheet.byEntity[] | assets, liabilities, equity |
| Both account arrays | total; byEntity remains orgId-to-number map, with separate byEntityMinor orgId-to-string map |
| translation | totalCta |
| translation.byEntity[] | cta |
| elimination | totalEliminated, totalVariance |
| elimination.entries[] | eliminated, variance (also on skipped entries) |

Legacy and exact clients receive one additive DTO. Every returned numeric and
exact monetary alias is limited to [-9007199254740991, 9007199254740991]. A
larger final field, including nested/entity/CTA/elimination values or int64
overflow, returns classified LEGACY_NUMERIC_RANGE / 422 before mutation. There
is no exact-only/full-int64 output mode. SQL SUMs are read as decimal text and
all sums, natural balances, products, CTA, prefix drawdown and cap arithmetic
use bigint. Intermediates may exceed safe-number/int64 range and cancel exactly;
only exposed results must fit. No raw source amount is coerced through Number.

translation.rates[] records each resolved baseCurrency, quoteCurrency,
rateType, effectiveDate, source, inverse, rateDirection=quote_per_base,
rateExact (normalized positive decimal string) and rate (positive int32
millionths). rateType is closing for assets/liabilities, average for
revenue/expenses, historical for equity. Numeric FX compatibility requires
exact representability at six decimal places in [1, 2147483647] millionths.
Unsupported high/tiny/overprecise rates fail 422 rather than rounding aliases.
Rates never receive a *Minor monetary alias.

Resolution: same currency is exactly 1; otherwise latest saved group/type/base
rate on or before endDate wins (updatedAt/id break date ties); otherwise use
the parent's qualified historical direct/inverse exchange rate. Each report
has its own cache and transactional snapshot, with deterministically sorted
rate metadata. Qualified exact saved group rates must agree with legacy
aliases/format/direction. An unmigrated pending/null-exact group rate can be
losslessly reconstructed from its positive int32 millionths. Other invalid or
quarantined group history fails 422 without falling through to fallback.
Missing/unqualified fallback rates fail MissingExchangeRateError / 422.

Conversion applies the exact rational rate directly to fixed cents, then
rounds once per account/document leg to nearest integer, ties toward positive
infinity, preserving v1 Math.round semantics (including -0.5 to 0). Cap halving
uses the same explicit integer rule. It does not use ISO major/minor rescaling.

## Scope, persistence and compatibility

Both transports load the owned live group and public member projections in
the same transaction as computation. Every member requires current caller
membership and a live organization. Invalid saved currencies/duplicate links
fail 422; revoked/inaccessible members fail 403; foreign/deleted roots fail
404; invalid UUID/dates fail 400. REST authenticates the API key/session and
ignores spoofed organization headers; MCP retains server AuthContext. GL joins
require both entry and account organization to match the member. Document cap
joins require the document and linked contact to have the same member owner.

GET uses a repeatable-read read-only snapshot and never audits or persists.
POST/new MCP recalculation require manage:reports, parent period/fiscal-year
lock checks and the same parent organization lock as configuration writers.
MON-028 additionally acquires SHARE locks on period_lock/fiscal_year tables before
the first serializable snapshot, protecting absent rows and observing in-flight
lock/year inserts before computation. These locks can delay period/year edits
across organizations; bounded serialization/deadlock retries remain. See
[combined contracts](CONSOLIDATION_AUXILIARY_INTEGRATION_CONTRACTS.md).
They compute/preflight inside a serializable transaction, replace **all** saved
entries for the group/endDate (including stale deleted/skipped/zero rules),
validate inserted values, then audit. Other dates and member ledgers are
untouched. Audit/output/storage faults roll back the deletion and insertion.
Serialization/deadlock conflicts retry at most twice after initial attempt.
Repeated/concurrent successes have one current row per nonzero supported rule;
each successful operation has an audit, rather than sharing an idempotency key.
Different windows with the same endDate replace that period's worksheet.

Per-entity CTA is injected even when opposite CTAs cancel to a zero group sum.
investment_equity is explicitly skipped as the configuration contract's
existing unimplemented stub; misconfigured ar_ap type matches remain flagged.
The existing symmetric invoice/bill cap assumption, prefix matching, fallback
when no positive cap exists, overlapping/custom-rule behavior and informational
variance remain accounting limitations. balanceCheck is returned for review;
this task does not certify arbitrary configurations or redesign eliminations.
English dashboard fields and GET/POST envelopes stay additive. No schema,
migration, rate writes, posted-history rewrite or IRR flag change.

Actual operation fixtures: tests/integration/consolidation-report.test.ts and
worker, with prior configuration regression; pure contracts:
tests/consolidation-report-wire.test.ts. See MON-096 evidence for exact results.
