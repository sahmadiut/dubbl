# Scheduled bookkeeping and auto-reversal consumer cutover (MON-164)

2026-10-13, Asia/Tehran. Bounded child of MON-159; final MON-159 and MON-008
acceptance remain open. No new public operation, schema, migration or production flag.

## Actual consumer composition

| Entry point | Adopted implementation and public parity | Stored units and guards |
|---|---|---|
| trigger/scheduled.ts bookkeepingTask -> processBookkeepingMaintenance -> processDepreciation | lib/api/asset-depreciation.ts depreciateAssetForMaintenance reuses load/history/post/record, as do REST single/batch depreciation and registered MCP asset tools; [depreciation contract](ASSET_DEPRECIATION_WIRE_CONTRACTS.md) | Fixed legacy integer cents are preserved in every base. Bigint rational method/convention rounding and final residuals; organization/asset/period locks; one charge per month and scoped audit. Retains skip for absent posting accounts, CWIP, usage-based assets and future service dates. Corrupt/revalued/unsafe history is rejected rather than repriced. |
| Same maintenance -> processLoanPayments | lib/api/loans.ts postLoanPayment, shared REST/MCP; [loan contract](LOAN_WIRE_CONTRACTS.md) | Saved safe integer cents/ordered allocations; explicit schedule target and domain replay; base-currency bank/GL and period checks. Catch-up stops at first rejected target; prior successful periods stay committed. Cached bank balances retain the adopted domain policy. |
| Same maintenance -> processRevenueRecognition | lib/api/revenue-schedules.ts recognizeRevenueEntry, shared REST/MCP; [revenue contract](REVENUE_WIRE_CONTRACTS.md) | Fixed-two cents allocation with final-period remainder. Issued source, tenant references, saved total/history and two-decimal same-base guards. Explicit period target prevents racing callers from advancing another period. Unsupported cross-currency/scale history stays unrecognized. |
| trigger/auto-reverse.ts autoReverseTask -> processAutoReversals | lib/api/auto-reverse.ts; original creation/post/date/read use existing REST/MCP journal tools; [journal lifecycle](JOURNAL_LIFECYCLE_WIRE_CONTRACTS.md) | Organization then journal locks, due-date recheck, period/fiscal-year guard on reversal date, tenant-owned historical references, safe nonnegative saved amounts and qualified exact FX. Mirrors amounts, descriptions, accounts, dimensions and all FX fields without reapplying rates. Links/audit/legs commit together. |

maintenance-context.ts resolves an actual uncustomized owner on a live organization
for domain permissions/audit attribution. Missing owner/deleted organization cannot
authorize writes. Invalid bookkeeping targets increment the existing skipped count;
other assets/loans/schedules continue. Each loan/revenue period is independently
atomic. A worker racing a manual operation may count successful target replay as
processed, but cannot double-post or consume a different target. Depreciation
deduplicates inside its transaction and reports whether it created a charge.

Auto-reversal accepts historically inactive references belonging to the original
organization. The original period can already be closed; the new reversal date
must be open. Missing lines, unsafe/negative/both-sided money, unsupported FX,
unbalanced saved journals, foreign dimensions/accounts and dates before the
original fail unchanged. The legacy database FX trigger requires
`legacy_scaled_1e6:transaction` provenance; unsupported metadata is rejected,
never silently regenerated. Raw balanced automated GL legs are mirrored verbatim;
manual multi-currency journals retain the existing journal balance policy.
Failed entries remain due for retry. Count-only envelopes are preserved.

## Verification ownership

`tests/integration/background-bookkeeping*` executes actual maintenance on migrated
disposable PostgreSQL. USD/JPY/KWD/synthetic IRR assets preserve raw cents, including
the maximum safe integer and low digits. Actual REST/MCP creates feed scheduled
posting; both transports read saved results. Loan/revenue catch-up preserves final
remainders; real manual/cron races, target replay and overlapping reversals cannot duplicate history.
SQL-text snapshots verify every stored row without bigint JSON coercion. Negative
history/tenant/period/owner/currency cases and injected audit failures stay unchanged. Existing domain fixtures
independently reverify method/convention and lifecycle contracts.

`tests/background-bookkeeping.test.ts` guards exact/shared service adoption and
actual Trigger delegates. [MONEY_MANIFEST](MONEY_MANIFEST.md) maps ownership;
[MONEY_BOUNDARIES](MONEY_BOUNDARIES.json) records actual source hashes/lines.

MON-165 owns FX revaluation and remaining recurrence/payroll/accrual/payment/report/
alert/costing composition. MON-160 owns public rendering/export/provider closure.
The bookkeeping orchestrator invokes adopted bank reconciliation and budget/balance
alerts; its nonempty downstream acceptance stays MON-165/159. No provider call,
Trigger deployment, application database, full build/dev server, production IRR/
full-int64 qualification or independent accounting review is claimed.
