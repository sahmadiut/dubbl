# Bank import wire contracts (MON-064)

2026-10-04, Asia/Tehran. Implementing-assistant self-review, safe numeric
coexistence only. No production, independent financial/security or IRR approval.

## Operations and envelopes

All operations use `lib/api/bank-imports.ts`, direct Drizzle with `AuthContext`.
REST uses guarded JSON input and `jsonResponse`; MCP uses `wrapTool`, strict
described schemas, and a separately registered tool for each operation.

| REST boundary | MCP tool | Input and output |
|---|---|---|
| POST bank-accounts/:id/transactions/import, mode=preview | preview_bank_statement_import | Live bank UUID; content or legacy csv alias, fileName, optional format/mapping. Returns `{preview}`. |
| Same POST, mode=commit (default) | import_bank_statement | Same statement input. Returns 201 `{import}`, preview plus imported, duplicateCount and importId. |
| POST bulk/bank-transactions/preview | preview_bank_transaction_import | fileName (optional), source (default custom), mapped rows. Returns preview, validCount, totalCount with per-row valid/errors. |
| POST bulk/bank-transactions/import | import_bank_transactions | Same bulk input. Returns 201 `{job,duplicates}`; job totalRows/processedRows/errorRows count rows. |
| GET bank-imports/:id | get_bank_statement_import | Owned import UUID; returns `{import}` with live bank and first 100 transactions. |
| GET bank-accounts/:id/import-profile | get_bank_import_profile | Live bank UUID; returns `{profile}` settings or null. |
| PUT same import-profile | save_bank_import_profile | Complete replacement settings with defaults; returns `{profile}`. |
| DELETE same import-profile | delete_bank_import_profile | Live bank UUID; returns `{success:true}`. |

Statement previews/commits and both bulk operations require `manage:banking`.
Import detail/profile reads require authenticated organization access, matching
existing read policy. Profile writes require `manage:banking`. Parents must be
live and organization-owned; API-key organization overrides spoofed org headers.
Foreign/missing/deleted parents are 404. Missing permission is 403, invalid or
expired API keys 401. Input/date/alias errors are 400; supported-range/history
compatibility and locked dates are 422. Unexpected DB failures are 500 and roll
back writes. SDK schema errors may be MCP protocol text; shared errors are JSON.

## Monetary contracts

| Boundary/field | Units and aliases |
|---|---|
| CSV/TSV/QIF/OFX/QFX/QBO/CAMT/MT amounts and balances | Decimal major-unit text, converted exactly using bank currency scale. Fractional minor units reject; no rounding. |
| BAI2 detail amount | Already integer currency minor units; no multiplication by 100. File integers may have padding/sign; BAI type-code credit/debit policy supplies direction. |
| CSV amount / amountExact / amountMinor | Existing localized decimal-major amount; additive canonical ASCII decimal-major amountExact and canonical signed integer-minor amountMinor. Every supplied alias must agree. Mapping supports these headers. |
| CSV balance / balanceMinor | Localized decimal-major balance and additive canonical signed integer-minor balanceMinor. Both blank means null; aliases agree. |
| Bulk amount / amountExact / amountMinor | Legacy numeric/text amount is decimal major units; amountExact is canonical decimal-major text; amountMinor is canonical signed minor-unit text. Aliases agree. Split debit/credit are decimal major, converted individually and netted with bigint. |
| Statement preview/commit transaction/duplicate amount, transaction balance | Safe signed numeric minor units plus amountMinor/balanceMinor. Nullable/absent balances have null aliases. |
| Statement openingBalance/closingBalance | Nullable signed numeric minor units plus nullable openingBalanceMinor/closingBalanceMinor. |
| Bulk preview data | Existing amount retains input decimal-major value/type. Split columns produce a safe decimal-major Number and are removed as before. Date normalizes; bankAccountCode remains the supplied literal name. Add amountExact, amountMinor and currencyCode; minor-only inputs need no invented legacy major amount. |
| Import detail bank/history/transactions | Bank balance/threshold, import opening/closing balance, transaction amount/balance retain stored numeric minor units with named Minor strings. Opaque raw metadata keeps its original units. |
| Profiles/jobs/counts | No monetary fields. Counts remain numeric counts, never Minor aliases. |

Every stored/read minor value and exposed/derived balance must fit
`[-9007199254740991,9007199254740991]`. Minor aliases validate canonical signed
int64 syntax then reject outside this coexistence range before committed effects.
No exact-only/full-int64 operation or magnitude-selected representation exists.
Decimal Numbers are accepted only below `2^(52-ceil(log2(10^scale)))`, and must
convert with no fractional minor unit. Larger values require text/minor aliases;
this cannot recover already-rounded JSON Numbers. Legacy split preview Numbers
must round-trip exactly, using the same conservative bound. Computations use
bigint; no floating-point money products/sums or schema changes.

USD text 12.50, JPY text 1250, KWD text 1.250 and IRR text 1250 each normalize to
minor integer 1250. Historic integer 1250 is never rescaled. This corrects new
non-two-decimal imports; historical bad imports need separate remediation.

## Parsing and profiles

Format detection and the twelve existing format names remain. Quoted CSV/TSV
columns and mappings remain supported; mismatched row widths, unterminated
quotes, missing dates, malformed grouping/junk/exponents, unsupported dates and
alias disagreements reject rather than becoming zero or being skipped. Multiline
CSV cells are unsupported and reject. Statement content is limited to ten million
characters; bulk rows to ten thousand. Source alias mapping/upload streaming and
generic import/export remain MON-033/DATA-001; bulk receives already mapped rows.

Without a saved profile, valid US/European grouping, leading currency symbols/
matching ISO prefixes, negative signs and parentheses remain supported. Legacy
comma-only detection considers one/two trailing digits decimal and otherwise
grouping; ambiguous three-digit decimal-comma amounts need an explicit profile.
CSV currency columns and native statement currencies must agree with the bank;
cross-currency and detected multi-account statements reject. CAMT signs must be
CRDT/DBIT; debit balances are negative. MT debit/reversal signs are retained and
both opening/closing balance currencies validate. BAI2 requires a dated group,
keeps existing code-range direction classification and rejects multiple accounts.
These lightweight parsers do not claim comprehensive ISO/BAI validation or binary
file decoding, continuation/remittance expansion or arbitrary multi-statement support.

Profiles were previously schema-only, with no callers/API/tool. The new per-bank
GET/PUT/DELETE and tools operate the existing table without a migration. PUT
atomically replaces all profiles for that bank; reads use latest updatedAt/id for
legacy multiples. Unsupported legacy settings fail visibly until replaced/deleted.
CSV/TSV settings support explicit dot/comma decimal separator, distinct dot/comma/
space/empty grouping separator, comma/semicolon/tab/pipe delimiter, YYYY-MM-DD,
MM/DD/YYYY or DD/MM/YYYY ordering and split debit sign (true: credit minus debit,
false: debit minus credit). Exact aliases keep ASCII syntax regardless of profile.
UTC/decoded UTF-8 are the supported timezone/encoding; dates remain Gregorian
date-only values without host timezone conversion. Native other formats ignore CSV
profile syntax. English named dates normalize deterministically; bulk retains
supported source-date formats and rejects formats that would need host Date parsing.

## Atomicity, retry and accounting

Organization and bank row locks serialize adopted import/profile writes and
coordinate adopted bank CRUD. All rows, history, audit, final statement balance
and bulk job commit together. Malformed/unsafe later rows and DB faults cannot
leave earlier imports or a processing job behind. Bulk commit now rejects the
entire invalid batch instead of retaining the old partial writes/error job;
preview still supplies per-row validation errors. Preview is read-only repeatable
read; bulk successful rows normalize identically in both transports.

Existing dedupe hashing is retained: bank UUID, external transaction/line IDs,
date, signed minor amount, normalized description/reference. Duplicates include
existing and within-file rows. Concurrent/repeated calls skip duplicate bank
transactions; retries may create new history/job/audit records, so this is row
idempotency, not a request-key replay of the original response. No unique DB
index or guarantee against unrelated legacy writers is claimed. Legitimate
identical rows without distinct external references remain indistinguishable.

Statement commit retains explicit line/closing balances and the historical
fallback (derive opening from saved balance minus fresh transaction sum). When
opening is supplied, existing overlapping rows participate in running balances
but are not inserted again. All-duplicate replay leaves current bank balance
unchanged, preventing stale closing-balance rollback. Bulk imports keep the
existing no-bank-balance-update policy. No import posts ledger/payment entries.

Rules retain suggestion matching, with supported integer monetary thresholds
guarded before evaluation and matched GL/contact/tax references scoped. Imports
leave status unreconciled even for autoReconcile rules; formerly they claimed
reconciled without posting a journal. Actual auto-reconciliation/posting, broader
rule contracts and races with other reference/period configuration writers remain
MON-065..069/MON-021. Locks are checked on fresh statement dates, not already
imported duplicates; previews do not claim period eligibility.

Detail limits remain 100 rows, now ordered by date/id. Import organization and
bank ownership, row bank/currency, GL/contact/tax/journal/reconciliation and plain
dimension/transfer references validate before disclosure; opaque arbitrary raw
identifiers are not remediated. Safe JSON checks run inside snapshots/transactions.
Production IRR, historical remediation, independent financial gates, generic
resumable/object imports and overall bank reconciliation remain their assigned tasks.
