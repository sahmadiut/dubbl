# MON-010 money migration qualification

## Gate status

**Not passed.** Automated preservation checks are available, but the first
acceptance criterion also requires localized MONEY cases whose implementation
is assigned to LOC-003. That task depends on MON-010. This is an ordering conflict,
not permission to mark a failing requirement passed. MON-010 also requires actual
human accounting/database review. Neither tracker edits nor this registry may
enable production IRR; `lib/currency/rollout.ts` retains its false financial gate.

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
| MONEY-IRR-01 | FAIL | `parseMajor` accepts canonical ASCII only; equivalent Persian digits throw. Strict normalization belongs to LOC-003. |
| MONEY-IRR-02 | PASS, adapter-level | Persian `formatMoney` output has zero fractional parts; full Persian UI integration remains LOC-003. |
| MONEY-USD-01 | PASS | Historical USD 1250 and row values survive actual widening/replay; decimal display remains 12.50. |
| MONEY-MIX-01 | NOT SATISFIED | Canonical exact parser rejects malformed input, but the deprecated `lib/money.ts` parser accepts `12oops` as 1200. No shared localized boundary/script policy is implemented. This is not a claim that current endpoints call that deprecated parser. |
| MONEY-BOUND-01 | PASS, primitive/storage scope | Existing exact-money and bigint fixtures cover signed int64, safe numeric rejection, 0/2/3 scales, rounding and overflow. General v1 full-int64 operation support is not implied. |
| FX-01..03 | See attempt evidence | Exact FX and provider/history fixtures; synthetic providers only. |
| MIGRATE-01 | PASS, synthetic rehearsal | New per-org/currency financial oracle plus existing widening, migration and backup fixtures. |
| REDENOM-01 | See attempt evidence | Existing immutable regime coexistence fixture; synthetic future factors only, no official cutover. |

## Review and next action

Read [attempt evidence](../evidence/MON-010-attempt-1.md) and
[implementing-agent findings](../evidence/MON-010-review-1.md).
Resolve the localized-input ordering conflict explicitly: either implement the
required boundary before this gate or approve a planning correction that retains
those cases under LOC-003 before locale/IRR release. No requirement is waived by
this document. Re-run the affected checks, then obtain attributable human
accounting/database review before closing MON-010. Production IRR enablement is
a separate reviewed code/configuration change, even after tracker completion.

No production database, build, dev server, browser, live provider, official
redenomination activation, independent human sign-off or hosted CI is qualified
by these local synthetic tests.
