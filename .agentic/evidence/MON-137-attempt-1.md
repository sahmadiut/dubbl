# MON-137 recurring invoice UI money - attempt 1

## Identity

2026-10-11 (Asia/Tehran), coding-assistant, D:\Projects\dubbl, master.
Entry HEAD: 0b04723e007d3661d491527343d066e920080722; entry tree clean.
Controller validate/status/next selected MON-137, which was started normally.
Implementation and evidence were uncommitted when written; no invented commit.

## Implementation

- RecurringDrawer sends explicit currencyCode and unitPriceExact major strings.
  Default USD matches both recurring create services, independently of customer
  or org currency. Currency selection is available. Unsupported FX is not sent.
  Exact prices permit 18 fractional digits; empty price is zero, empty quantity
  is one, and explicit zero quantity remains zero. Missing org/customer/name,
  malformed prices/quantities, unsafe amounts/products/sums, unavailable taxes
  and missing line descriptions prevent creation. Submit reparses exact lines.
- LineItemsEditor has a recurringInvoice policy using the adopted stored-line
  and generation calculators. Both price and quantity are rounded before the
  extended amount: USD 0.005 x 3 is 3 minor units; USD 1 x 1.234 is 123. Standard
  invoice, receipt, credit and payable policies retain their own calculators.
- recurring-invoice-ui.ts validates saved unitPriceMinor against the safe numeric
  raw units, with strict numeric-only compatibility fallback. Bigint gross products
  and sums preserve low digits. Saved currency drives detail formatting, and
  fractional physical hundredth quantities remain visible.
- RecurringInvoiceMoneyDetails renders exact unit prices, gross amounts/totals,
  optional saved discounts and an explicit before-discounts-and-tax label.
  Templates do not store final tax amounts; generation uses current tax rates.
  Upcoming cards adopt currencyCode and lineTotalMinor and retain the API's gross
  amount definition. List summary is counts only, with no mixed-currency sums.
- List/drawer remount by org, detail reads use org/id context and abort on cleanup,
  preview fetches abort with the parent list read, obsolete paginated responses
  are ignored, and invalid money produces English alerts instead of USD/zero
  fallbacks. Existing frequency, start/end, reference, notes, autoSend, pause,
  resume, delete, search, filters, sorting and pagination remain.
- CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST name the consumers, exact contract,
  compatibility/nonmoney units and remaining integration owners. Regenerated
  MONEY_BOUNDARIES hashes/source lines cover changed and new source consumers.

## Acceptance mapping

1. Exact input/arithmetic/display/adopted fields: drawer, shared editor policy,
   saved detail component/helper and upcoming list cards; registry ownership row
   and MON-137 sections name every scoped monetary consumer. Existing REST/MCP
   operations already implement this contract; no transport/schema changes needed.
2. Four pure/rendered test groups cover 0/2/3 currency scales, signed ties,
   stored quantity rounding, safe low digits, product/sum overflow, malformed
   prices/quantities/aliases, unknown currency/tax, saved numeric fallback,
   fractional quantity and accessible English rendering. Real REST/MCP/SQL fixture
   verifies exact payloads, saved reads, gross upcoming values and generated
   invoice totals across USD/JPY/synthetic IRR/KWD. It checks explicit default USD
   even with other org/contact defaults, notes/reference/account/tax/schedule
   persistence, two future dates/cap, paused no-op, resume and schedule advancement.
   Existing recurring suite checks automation, posting FX, locks, tenant/role,
   rollback, concurrency, aliases and saved unsafe history.
3. Nonmoney signed int32 quantity hundredths, discount/tax basis points, counts
   and canonical dates remain explicit. Numeric safe-money compatibility is
   retained and validated without rescaling. No line-edit UI exists; PATCH edits
   headers only. MON-131, MON-129, MON-007 and MON-008 remain separate integration
   tasks with other pending consumers. No IRR production gate is changed.

## Verification

All commands from repository root; no full build, dev server or Docker.

| Command | Result | Limits |
|---|---|---|
| node --import tsx --test tests/recurring-invoice-ui-money.test.ts | Exit 0, 4/4 | Pure adapters and React SSR; browser effects not executed |
| node --import tsx --test --test-concurrency=1 tests/integration/recurring-invoice-ui-money.test.ts tests/integration/recurring-invoices.test.ts | Exit 0, 2/2 | Migrated disposable PostgreSQL 18, real authenticated REST/registered MCP/SQL |
| pnpm test | Exit 0, 436/436 | Complete unit suite |
| pnpm typecheck | Exit 0 after corrected fixture | MDX + tsc --noEmit; no build |
| pnpm exec eslint scoped pages/drawer/editor/helper/component/tests | Exit 0, no warnings | Nine scoped TS/TSX files |
| pnpm lint | Exit 0, zero errors and 103 existing warnings | Scoped files have no warnings |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0 | 415 columns, 2002 scanned files, 1497 consumers, 28573 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Independent Drizzle classification, hashes and source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy-money guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Structural validation |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql fixture-database count; pg_ctl fast stop | Zero databases; exit 0 | Dedicated synthetic cluster emptied and stopped |

Initial integration fixture incorrectly treated generation's numeric count as an
array; the first typecheck read the same old fixture and reported that mistake.
Corrected to assert the returned count and inspect generated invoices through
unique references in SQL. Initial concurrent existing regression also timed out
under overlapping verification. Final serial integration run passed both suites
(95s/62s including migration). Initial scoped lint found one ref-cleanup warning;
generation advances at effect setup and the final scoped lint is clean.

Dedicated temporary trust-authenticated synthetic PostgreSQL 18 cluster on
127.0.0.1:55447, role dubbl_ci, loopback only, max_locks_per_transaction=256,
jit=off. TEST_DATABASE_URL explicitly selected it. Wrapper fixtures created and
dropped randomly named databases; the application .env DB was not used. No real
customer data or provider calls. Synthetic IRR fixtures do not enable production IRR.

## Review and limitations

Honest coding-assistant self-review is in MON-137-review-1.md. DEC-005 allows
behavioral/data assertions and source layout review without screenshots.
No live browser-effects, hosted CI/PostgreSQL 16, provider delivery, production
migration, full-int64 business path or independent accounting/linguistic/release
qualification is claimed. Future tax changes can change generated tax amounts.
Templates have no saved FX; existing posting/FX behavior remains authoritative.

## Handoff

Implementation and verification complete. Finish controller acceptance/submission/
self-review/done, task-owned commit/push and remote-SHA/clean-tree verification.
Stop after MON-137. Integration parents retain their independent acceptance.
