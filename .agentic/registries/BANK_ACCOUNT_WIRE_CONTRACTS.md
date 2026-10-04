# Bank account contracts (MON-062)

2026-10-04, Asia/Tehran. Actual source: bank-account-wire.ts, bank-accounts.ts,
four bank account route files, bank-accounts MCP tools, bank-ledger.ts and
bank-balance-alerts.ts. ADR-006 numeric coexistence applies. This is a bounded
contract adoption, not MON-021 combined financial qualification.

## Operations

| REST | MCP | Inputs / return |
|---|---|---|
| GET /api/v1/bank-accounts | list_bank_accounts | No operation input; {bankAccounts}, each with chartAccount |
| POST /api/v1/bank-accounts | create_bank_account | Required accountName; optional metadata, balance/balanceMinor, GL UUID; {bankAccount}, HTTP 201 |
| GET /api/v1/bank-accounts/:id | get_bank_account | UUID; {bankAccount} with chartAccount |
| PATCH /api/v1/bank-accounts/:id | update_bank_account | UUID plus optional metadata, balance/balanceMinor, isActive; {bankAccount} |
| DELETE /api/v1/bank-accounts/:id | delete_bank_account | UUID; {success:true}, soft deletion retains history |
| GET /api/v1/bank-accounts/:id/validate-balance | validate_bank_balance | UUID; statement diagnostics described below |
| PATCH /api/v1/bank-accounts/:id/balance-alert | set_bank_balance_alert | UUID plus threshold/thresholdMinor; alert state described below |

MCP receives bankAccountId in its strict input object, with AuthContext supplied
at server creation. All operations directly use shared DB services and wrapTool;
no HTTP self-calls. The existing set_bank_balance_alert tool moves from bank-rules
to bank-accounts and is registered once. Its role and numeric threshold units are
preserved. The new REST alert route has the same operation and permissions.

## Units, aliases and supported range

Balances and thresholds are signed integer currency minor units: USD 1250 means
1250 cents, JPY/IRR 1250 means 1250 units, KWD 1250 means 1.250 major units. No
currency conversion or historical rescaling. CurrencyCode is normalized ISO;
creation defaults USD, checking and #0f766e. Omitted PATCH fields retain their
values, including those creation defaults. Nullable metadata clears with null.

Numeric balance / threshold remain supported. balanceMinor / thresholdMinor
accept canonical signed ASCII int64 strings and must exactly agree with any
numeric alias. No fractions, exponents, leading zeros, negative zero, whitespace,
localized numerals, coerced strings or unknown fields. Creation balance defaults
zero. Alert requires at least one threshold alias; null clears and dual nulls
agree. balance does not accept null. All money consumed by CRUD/diagnostics must
fit +/-9007199254740991. A canonical exact int64 outside this coexistence range
rejects with 422 LEGACY_NUMERIC_RANGE before committed mutation. No advertised
full-int64 numeric CRUD, dynamic magnitude negotiation or bigint JSON fallback.

Account output retains numeric balance, nullable lowBalanceThreshold and adds
balanceMinor / nullable lowBalanceThresholdMinor. List/detail retain the
chartAccount relation after checking its ownership/type/currency. Write responses
retain their prior {bankAccount} envelope without a relation. Alert output retains
bankAccountId, accountName, lowBalanceThreshold, currentBalance and adds
currencyCode, lowBalanceThresholdMinor, currentBalanceMinor.

Diagnostics retain accountBalance, transactionSum, transactionCount,
latestTransactionBalance, lastImportClosingBalance, lastImportDate, isBalanced,
issues and add currencyCode and matching *Minor aliases to every money value.
Nullable balances have null aliases; counts stay numeric. SQL sums/min/max/count
use text, then bigint range checks: no int32 cast or floating sum. Unsafe operands
cannot cancel into an apparently safe sum. Differences use bigint and require
safe numeric range. Currency-mismatched transactions/import closing data and
foreign import ownership reject. Latest running/closing values are selected
deterministically. isBalanced compares the account statement balance to available
running/closing statement balances only; an empty statement remains true. It
does not assert that transactionSum or GL equals the statement balance. Issues
identify the saved currency and minor units rather than assuming cents.

## GL, history, authorization and atomicity

Creation and PATCH automatically ensure a GL link. Explicit GL UUIDs must be
owned, active, undeleted, unclaimed even by deleted bank accounts, match currency
and match the asset/liability type from bandFor. Standard-account reuse also
requires active matching currency/type; a mismatched preferred code remains
reserved and a new compatible code is allocated. Writes serialize on the
organization and target bank rows. Bank row, automatically created/link GL,
validated response and awaited audit commit together. Any range/reference/audit
failure rolls everything back. Concurrent adopted creation cannot share GL;
concurrent soft deletion succeeds once. A repeated create still creates a distinct
account; no request-key idempotency contract is added.

Changing currency/type/GL link rejects any statement transaction, statement
import, payment or journal line on the existing GL, including opening balances
and retained history. Currency changes also require zero old/new balances and
zero/null threshold. An empty account can change currency/type and receives a
matching new GL when no explicit replacement link is provided. Existing GL
history is never rewritten or moved. Invalid/foreign saved GL links fail closed.

balance is the existing bank statement balance, not an opening GL posting. This
slice preserves that behavior; set_opening_balances remains the separate GL
operation in MON-022. Metadata/statement edits, soft deletion and alert settings
post no journal, so have no posting date or period-lock bypass. Opening GL and
other dated postings retain their own period gates. The known AUD-002 bank
statement/GL discrepancy remains a financial qualification item; diagnostics
do not hide it or claim to reconcile it.

Live parent lookup always uses id, authenticated organization and deletedAt.
Reads retain existing authenticated access. Bank CRUD writes require
manage:banking; alert writes require manage:bank-rules. Existing resource and
multi-currency plan checks remain on creation; currency selection on PATCH is
also checked. API keys and custom permissions use the real auth adapter; supplied
organization headers cannot override key scope. Malformed input is 400,
unavailable/foreign parent 404, role/plan denial 403, invalid/expired key 401,
unsupported saved money/references 422, unexpected audit failure 500. No schema,
migration, deployment, currency-unit or IRR flag change occurs here.

## Scheduled low-balance notification formatting

Existing maintenance selects active undeleted accounts with balance < non-null
threshold. Its SQL text projections and toMajorDecimal preserve full signed
int64 amounts and currency scale in plain English messages. This text-only job
has no numeric output money contract. Invalid saved currency skips that account
without stopping valid accounts. Recipients remain the account's organization
owners/admins; in-app notifications and preference-controlled email use the
existing notification service. Sequential retries deduplicate per account/day;
concurrent-job exactly-once delivery and email/provider delivery are not qualified
here. Counts keep the existing checked/alerted semantics (checked is low-account
candidate count). Unsupported CRUD historical values are not silently repaired.

## Executed qualification

tests/bank-accounts.test.ts and tests/integration/bank-accounts-worker.ts invoke
actual exported REST handlers and MCP SDK transports against disposable migrated
PostgreSQL. Cover signed safe endpoints, strict syntax/aliases/metadata, PATCH
omission, USD/JPY/KWD/IRR stored-unit preservation, role/API-key/tenant isolation,
matching/unclaimed GL, statement/opening history, empty currency change, null
alerts, 5-billion sum, unsafe sums/operands/differences/saved thresholds, foreign
GL/import and mixed currency, SQL audit faults, concurrent create/claim/delete,
plan denial, exact low-balance messages/full-int64 historical formatting,
inactive/deleted/equal thresholds and sequential alert deduplication. SDK schemas
also assert monetary/write input field descriptions. Payment settlement/reversal
regressions pass. No running Next server, browser, provider or production proof.
