# MON-010 money migration qualification

## Gate status

**Awaiting human accounting/database review.** MON-010 now implements the minimum
strict localized-input boundary required by its MONEY cases, resolving the
previous automated qualification failure without removing any requirement.
LOC-003 retains product-wide UI adoption, localized formatting and numeral
preference integration. The canonical machine-facing parser remains ASCII-only.
Neither tracker edits nor this registry may enable production IRR;
`lib/currency/rollout.ts` retains its false financial gate.

## Localized qualification boundary

`lib/money/localized.ts` accepts Latin, Persian or Arabic-Indic digits, with one
script per value and explicit `ascii` or `arabic` separators. Optional groups
must have three digits after a 1-3 digit first group. ASCII leading signs are
allowed. Whitespace, bidi controls, currency labels, exponents, misplaced signs,
malformed grouping and unknown characters fail; no arbitrary characters are
stripped. Exact `parseMajor` then applies the selected currency scale, explicit
rounding and signed int64 bounds. No input path infers rial/toman conversion.

`tests/localized-money.test.ts` verifies the grammar, script equivalence, signed
int64/safe-number edges, 0/2/3 currency scales, rounding and malformed inputs.
The historical migration fixture now seeds its IRR opening from Persian input;
its independent SQL oracle still requires literal 123456789 before/after replay.
This is boundary qualification, not a claim of completed Persian UI integration.
The deprecated `lib/money.ts` parser is preserved for compatibility and is not
the localized boundary. A source search finds no product call sites for it;
the separate import/export parser retains its own existing strict contracts.

## Reproducible preservation oracle

`tests/integration/money-migration-qualification.test.ts` starts at committed
checkpoint `0004_faithful_paper_doll`, seeds four synthetic organizations (USD,
IRR, JPY, KWD), runs the actual migration CLI to current, then repeats it.
The fixtures use the same account codes across tenants, opening balances,
partially paid invoices/bills, linked payment allocations, a bank account,
revenue/expense closure to retained earnings and a historical period lock.

Independent PostgreSQL text projections check:

- Every account's debit, credit and signed balance, grouped by organization and
  saved currency; no unlike currencies are summed.
- AR 21000, AP 5001 and retained earnings 14998 minor units per tenant, each
  reconciled against its GL control account.
- Bank stored balance and GL balance equal opening minus 1001 minor units.
- USD/JPY/KWD opening 1250 stays 1250; synthetic IRR opening 123456789 stays
  123456789. Each tenant's debit and credit totals are opening plus 54008.
- Eleven original tables retain every original column's value, SHA-256 row
  checksum, count and null count. Capturing the historical column list permits
  additive schema metadata while keeping historical values in the comparison.
- Journal-account tenant and currency ownership remains intact.

After a successful bigint migration, nine separately rolled-back mutations must
fail preservation: balanced doubling of all journal values, AR drift, AP drift,
bank drift, retained earnings drift, currency reassignment, changed narrative,
deleted locks and a foreign-tenant account. Balanced entries alone are insufficient.
After rollback, the unchanged fixture must pass again.

This supplements existing all-195-column widening/checksum/nullability/int64,
lock-timeout rollback, backup/restore, FX precision/history, currency-regime,
authenticated REST/registered MCP accounting/report and functional-currency
selection fixtures. It does not replace their independent assertions.

## Required matrix disposition

| Case | Current result | Evidence / remaining work |
|---|---|---|
| MONEY-IRR-01 | PASS, boundary/persistence | Strict `parseLocalizedMajor` yields 123456789 for Latin/Persian/Arabic-Indic digits; historical IRR fixture persists Persian input and verifies independent literal SQL balances across migration/replay. |
| MONEY-IRR-02 | PASS, adapter-level | Persian `formatMoney` output has zero fractional parts; full Persian UI integration remains LOC-003. |
| MONEY-USD-01 | PASS | Historical USD 1250 and row values survive actual widening/replay; decimal display remains 12.50. |
| MONEY-MIX-01 | PASS, boundary | Explicit separator and single-script grammar rejects malformed/unknown/bidi/mixed input before exact conversion. Canonical wire parsing and deprecated unused compatibility helper remain separate. |
| MONEY-BOUND-01 | PASS, primitive/storage scope | Existing exact-money and bigint fixtures cover signed int64, safe numeric rejection, 0/2/3 scales, rounding and overflow. General v1 full-int64 operation support is not implied. |
| FX-01..03 | See attempt evidence | Exact FX and provider/history fixtures; synthetic providers only. |
| MIGRATE-01 | PASS, synthetic rehearsal | New per-org/currency financial oracle plus existing widening, migration and backup fixtures. |
| REDENOM-01 | See attempt evidence | Existing immutable regime coexistence fixture; synthetic future factors only, no official cutover. |

## Review and next action

Read the original [attempt evidence](../evidence/MON-010-attempt-1.md) and
[findings](../evidence/MON-010-review-1.md) as historical failed-gate evidence.
The new [attempt](../evidence/MON-010-attempt-2.md) and
[self-review](../evidence/MON-010-review-2.md) record the corrective boundary and
actual rerun results. No requirement or review is waived. Obtain attributable
human accounting/database review before closing MON-010. Production IRR
enablement is a separate reviewed code/configuration change, even after tracker
completion.

No production database, build, dev server, browser, live provider, official
redenomination activation, independent human sign-off or hosted CI is qualified
by these local synthetic tests.
