# Verification matrix

## MON-074 inventory variants and suppliers

- Pure tests qualify canonical/dual price aliases, cents preservation, safe limits,
  null output history, int32 physical metadata/days and exact editor conversions.
- Actual migrated PostgreSQL REST/MCP fixtures exercise all eight operations,
  full unique tool registration/described schemas, two tenants, owner/viewer/
  custom-manager roles and invalid/expired API keys. Tenant/contact scoping,
  deleted history, safe-max prices, unsafe raw bigint rows and bad links are covered.
- Text SQL snapshots prove invalid inputs and unauthorized requests leave catalog,
  audit, warehouse, stock and ledger unchanged. Duplicate REST/MCP creation races
  have one winner; audit-trigger failures roll back all six adopted write services.
  Catalog operations do not create stock/ledger entries.
- Browser/session/OAuth and independent financial/security review are not claimed.
  Parent MON-024 retains combined acceptance; MON-075 through MON-078 own the
  other inventory surfaces. Full-range/IRR and generic opaque/history gates remain.

## MON-073 approval conditions

- Pure approval-conditions suite: exact six-operator comparison, full-int64
  thresholds/operands, canonical aliases, USD/IRR/JPY/KWD unscaled units,
  typed text/integer fields, malformed inputs and query parsing.
- Actual migrated PostgreSQL approval-contracts suite: every REST operation and
  all ten registered MCP tools with SDK InMemoryTransport, two tenants and
  owner/custom-manager/viewer authorization. Saved unsafe conditions and foreign
  workflow/member/document references reject without writes; atomic audit/step
  fault rollback, terminal races, non-contiguous steps and soft-delete history.
- Actual REST/MCP invoice creation: >int32 KWD totals and exact workflow thresholds
  trigger pending approval; invalid saved conditions/foreign approvers prevent
  numbering/header/line/request writes. Existing invoice CRUD/lifecycle and bill
  lifecycle regression suites exercise period locks, posting and rollback.
- Browser/session UI, network server, PostgreSQL16 and independent accounting/
  security approval are not claimed. Generic opaque/history MON-034/033 and
  combined MON-022/full-range/IRR gates remain.


## MON-072 tax periods

- tests/tax-period-wire.test.ts: minor aliases/serializer compatibility, signed
  DTOs, canonical syntax, safe bounds, >int64 aggregates, dates and basis points.
- tests/integration/tax-period-contracts.test.ts and worker: actual REST and
  registered SDK on disposable migrated PostgreSQL18; CRUD, both filing names,
  linked/standalone payment/refund, zero/max-safe values, permissions/tenants,
  frozen figures, concurrency, cash/flat-rate/EC, malformed/unsafe data, period
  and fiscal locks, currency scale/IRR gate, audit/journal rollback snapshots.
- Remaining: network/session/OAuth, PostgreSQL16, statutory policy/report parity,
  foreign EC/settlement FX, historical remediation, full-int64, global closure/
  lock concurrency and independent accounting/security/migration/IRR gates.

These are required product checks, not results. Every result is initially NOT RUN. Retain exact fixtures and actual commands in task evidence. This package only tests its controller.

| Case | Expected invariant | Owning tasks | Initial result |
|---|---|---|---|
| MONEY-IRR-01 | Persian-digit representation of 123456789 parses exactly to IRR 123456789 minor units. | MON-002 / LOC-003 | NOT RUN |
| MONEY-IRR-02 | IRR formatting has zero fractional digits in Persian UI under approved metadata. | LOC-003 / MON-009 | NOT RUN |
| MONEY-USD-01 | Existing stored USD 1250 remains USD 12.50 after widening. | MON-003 | NOT RUN |
| MONEY-MIX-01 | Mixed numeral scripts and malformed separators follow explicit strict validation; unknown characters are not silently stripped. | LOC-003 | NOT RUN |
| MONEY-BOUND-01 | Negative, zero, bigint/int32 boundaries, currencies with 0/2/3 units, rounding ties and overflow are exact. | MON-002 | NOT RUN |
| FX-01 | High-magnitude USD-to-IRR rates do not overflow int32 or pass through binary float. | MON-004 / MON-005 | NOT RUN |
| FX-02 | Inverse and triangulated rates preserve configured precision and explicit direction. | MON-005 | NOT RUN |
| FX-03 | Historical invoice rates and posted ledger values survive provider refresh unchanged. | MON-005 | NOT RUN |
| I18N-PLURAL-01 | Persian counts 0, 1 and 2 follow verified ICU/CLDR cardinal behavior; placeholders match. | LOC-002 | NOT RUN |
| DATE-01 | Known Gregorian/Persian dates round-trip across leap/year/timezone boundaries; canonical values remain unchanged. | LOC-004 | NOT RUN |
| RTL-01 | Navigation mirrors while DOM/keyboard order and focus stay logical. | RTL-001 | NOT RUN |
| RTL-02 | Currency codes, UUIDs, emails, URLs and bank references stay readable inside RTL text. | RTL-002 | NOT RUN |
| PDF-01 | Persian names, addresses and descriptions shape correctly; totals/page breaks are verified visually. | L10N-011 | NOT RUN |
| LEDGER-01 | Equivalent English/Persian input yields exactly equal journal amounts and balanced entries. | QA-001 | NOT RUN |
| CREDIT-01 | Vendor allocation cannot exceed available credit or bill balance, including concurrent retries. | PAR-002 | NOT RUN |
| LOCK-01 | Locked periods reject equivalent English/Persian API/UI submissions. | MON-007 / DATA-004 | NOT RUN |
| TENANT-01 | Organization A cannot access B branch, credit, FX, view or import objects. | PAR-007 / QA-002 | NOT RUN |
| MIGRATE-01 | Per-org/currency trial balance, AR, AP, bank and retained earnings reconcile before/after; row counts, nullability and checksums match. | MON-010 / QA-005 | NOT RUN |
| REDENOM-01 | Current/future regimes coexist without historical value rewrites. | MON-009 | NOT RUN |
| API-01 | Legacy safe numeric and new exact string contracts preserve semantics and reject unsafe legacy values. | MON-006 | NOT RUN |
| IMPORT-01 | Dry-run/errors/batch retries do not duplicate or partially corrupt postings. | DATA-001 | NOT RUN |
| EXPORT-01 | CSV/XLSX maintain exact large values, safe formula handling and authorized scope. | DATA-002 | NOT RUN |
| SEC-01 | Tokens, webhooks, uploads, identifiers, catalogs, auth/session and OCR consent meet reviewed controls. | QA-002 | NOT RUN |
| A11Y-01 | Automated and manual WCAG checks cover both locales and keyboard/screen-reader behavior. | QA-003 | NOT RUN |
| PERF-01 | Reports, imports, bundles and PDF jobs meet pre-agreed measured budgets. | QA-004 | NOT RUN |
| RESTORE-01 | Restore is demonstrated; rollback after large IRR writes avoids destructive narrowing. | QA-005 | NOT RUN |

## Coverage axes

MON-011 supplies API-01 foundation fixtures in `tests/money-wire.test.ts`: signed
int64 edges, conflicting aliases/malformed inputs, unchanged USD/IRR units,
exact tiny/high rates, legacy range rejection, nested bigint JSON, real shared
REST/MCP adapters and classified ORM errors. These are transport/contract
fixtures without DB access, not real endpoint-wide client or authorization
qualification. MON-012 and parent MON-006 retain those integration requirements.

MON-005 evidence qualifies FX-02 exact direction/inverse/cross arithmetic and
FX-03 saved invoice-journal preservation using synthetic database fixtures.
FX-01 high rates are parsed/derived exactly but intentionally rejected by legacy
sync when int32/six-place coexistence cannot represent them safely. Full live
high-range posting remains MON-006/007/010, not a pass inferred from storage or
helper tests. See `../evidence/MON-005-attempt-1.md` and ADR-005. The initial
matrix above remains the original requirements list, not a current dashboard.

MON-013 adds `tests/rate-wire.test.ts` and the disposable PostgreSQL
`tests/integration/fx-wire.test.ts`/worker. Actual exchange-rate REST exports use
hashed synthetic API keys/member permissions and two tenants; registered MCP
validators/handlers use direct DB access. Fixtures cover numeric/exact aliases,
bulk pre-write rejection, max/tiny rates, ID mutation tenant filters, manual
provenance clearing/audits, inverse/missing quotes and bounded conversion preview.
This qualifies the [FX slice](../registries/FX_WIRE_CONTRACTS.md), not OAuth/session,
frontend or endpoint-wide/full-range posting. MON-014/015/016 and parent
MON-012/006 retain remaining contract/integration acceptance.

Use en-US/fa-IR; LTR/RTL; Latin/Persian/Arabic-Indic input; Gregorian/Persian display; IRR/USD/EUR and a three-decimal currency; zero, negative, large and boundary amounts; desktop/mobile; old/new API clients; clean/upgrade databases. A translated UI alone does not satisfy accounting tests.

## Pull request pipeline

Owner decision DEC-005 (2026-10-02) removes screenshot capture, screenshot tests and screenshot golden comparisons throughout this matrix. Retain behavioral, layout, accessibility, accounting and PDF checks; do not block continuation on browser/screenshot tooling. Historical requirements are superseded, not recorded as passed.

Owner decision DEC-002 (2026-10-02) overrides Docker execution requirements in this matrix: omit Docker installation, builds, container tests and runtime image checks for current work. Necessary configuration/documentation may be prepared without execution. Record these checks as omitted by owner decision and unverified; do not require Docker or block solely on its absence. Other verification requirements remain in scope. Preserve existing CI support unless a concrete change is needed.

Verified lockfile install, typecheck, lint, unit tests, translation-key checks, clean and previous-release PostgreSQL migrations, integration tests, English and Persian critical E2E, accessibility scan, layout/behavior review, production Docker build and dependency/license/security scans. Apply owner scope decisions above. Match actual repository tooling; do not introduce guessed package scripts.

## Nightly / release pipeline

All supported browsers, layout/behavior review and PDF correctness checks, larger migration fixtures, report reconciliation, import stress and SBOM/image checks. Apply owner scope decisions above. Include manual native-accounting, accessibility and operational reviews where automation is insufficient. Document real omissions as blockers or approved limitations, never as passes.

MON-017 adds `tests/contact-wire.test.ts` and actual PostgreSQL contact REST/API-key
and registered MCP fixtures in `tests/integration/contact-wire.test.ts`/worker.
These cover nullable/omitted/zero/safe-max aliases, pre-write rejection and audit
snapshots, int32-plus and safe-max SQL aggregates, combined-overdue overflow,
mixed-currency rejection, foreign-ID/custom-permission denial, parent-scoped merge/soft-delete
preservation and unsafe historical ORM reads. Scope: contact CRUD/list and the
six contact tools; statements/bulk/export and full-range business consumers remain
assigned rollout/qualification tasks. No HTTP OAuth/session/browser qualification.

MON-023 adds five pure `budget-wire.test.ts` groups and the actual migrated
PostgreSQL REST/API-key/member/registered-MCP `budget-wire.test.ts` worker. Covers
signed exact/numeric aliases, safe-max conservation, pre-write rejection of later
lines/sums/dates/org refs, foreign-ID/role denial, nested-ref read isolation,
transaction rollback via injected storage failure, replacement/soft-delete/audits
and unsafe historical preservation. Calendar fixtures compare UTC/Tehran/New York
including DST/early years. Budget reports remain MON-029 and full UI/consumer
cutover MON-008; no transport/browser/production qualification is inferred.

## MON-030 public payment-link and portal contracts

`tests/public-money-wire.test.ts` covers signed safe-range aliases, USD/IRR/JPY/KWD
unit preservation, quantities/percentages, exact statement sums, unsafe prefixes
and currency disagreement. `tests/integration/public-portal-wire.test.ts` migrates
a randomly named disposable database and runs real public handlers plus MCP SDK/
client calls over InMemoryTransport. Fixtures cover eight REST/seven MCP operations,
numeric/string envelopes, strict inputs, token expiry/revocation, tenant/contact/
custom permissions, deleted/inconsistent references, quote states/replay, unsafe
raw history and preflight before activity/status writes. An activity-trigger failure
verifies transaction rollback. Browser/HTTP OAuth, providers/PDF/full ledger and
frontend display remain assigned work.

## MON-035 journal CRUD contracts

Three pure `journal-wire.test.ts` groups cover numeric/exact/dual aliases, zero
defaults, USD/IRR/JPY/KWD unit preservation, saved exact FX, conflicting syntax/
units/ranges, raw sum and FX-product overflow and lossless REST fixed-two-decimal
strings. `tests/integration/journal-wire.test.ts` migrates a disposable database
and invokes actual REST/API-key/custom-role and MCP SDK/InMemoryTransport tools.
It covers five CRUD operations, above-int32/safe-max values, invalid monetary/date/
dimension inputs with mutation/audit snapshots, both tenant directions, old/new
period locks and closed years, posted immutability, atomic create/edit rollback
via a PostgreSQL leg trigger, unsafe sums/history, base-amount read preservation,
invalid historical rates and deletion cascades. Lifecycle/import and recurring
qualification remain MON-036/037; posting/domain and HTTP OAuth/browser remain
their assigned gates. No schema or rollout change is implied.

## MON-036 journal lifecycle and import contracts

Three pure journal-import-wire groups cover decimal formats, minor aliases,
REST/MCP units, dates, safe edges, sums and preview. The migrated disposable
journal-lifecycle-wire worker invokes five REST and six registered MCP operations.
Covers legacy/exact/dual inputs, int32-plus/safe-max, saved FX/base amounts and
dimensions, both tenants, API keys/custom permissions, locks/closed years,
date/state errors, unsafe history/sums, unqualified FX, inactive historical
reversal, literal account codes, partial jobs and mutation snapshots. Forced
leg failures roll back reversal/import headers; a second-update fault rolls
back a partial recode; concurrent void calls create one mirror. HTTP/session/
OAuth/browser, full domain/scheduled workflows and recurring remain separate gates.

## MON-037 recurring journal contracts

Three pure recurring-journal-wire groups cover canonical minor aliases, malformed/
conflicting/unsafe amounts and sums, balanced one-sided legs, immutable canonical
dates, nullable partial fields and fixed 1:1 FX. The migrated disposable
recurring-journal-wire worker invokes every REST operation and eight registered MCP
tools through the actual SDK. Covers four currency scales, legacy/exact/dual,
int32-plus/safe-max, retained currency edits, API-key/custom-permission/two-tenant
isolation, foreign/inactive dimensions, soft deletion, locks/closed years, paused
catch-up, concurrent runs, forced create/edit leg failures, failure after generated
entries before final schedule update, malformed/unsafe retained history and cross-org
maintenance. SQL snapshots assert amounts, schedules, journal rows and audit counts.
HTTP/session/OAuth/browser, full currency-aware domain math and cross-template
number-allocation/reference/lock races retain their separate qualification gates.

## MON-038 invoice read contracts

Four pure invoice-read-wire groups cover numeric/string units across four currency
scales, nested money versus quantities/percentages, safe extremes, historical scope,
exact signed base rounding/products/scales/null rates, summary totals/aging and
invalid filters. The migrated disposable invoice-reads worker invokes three real
REST and three registered MCP read operations via SDK/InMemoryTransport. Covers
int32-plus/safe-max headers/lines/summary, API keys/custom read-only roles, both
tenants, soft deletion, foreign contact/account/tax/payment references, allocated
document units, raw unsafe header/line/contact/allocation/history, filter/sort/page,
issue-date/missing/future/foreign rates, display-product/currency-scale limits,
mixed-currency and unsafe summaries. Exact text snapshots verify no invoice/line/
payment/allocation/rate/journal/audit changes from successful or rejected reads.
Auth-key last-used metadata is excluded. HTTP/session/OAuth/browser and write/
lifecycle/full-domain qualification remain assigned tasks; schema and flags stay unchanged.

## MON-039 invoice CRUD write contracts

Three pure contract groups cover major/minor aliases across USD/JPY/IRR/KWD,
canonical strings/conflicts, scientific numeric spelling, signed tie rounding,
distinct create/edit price order, quantities, tax/discount, individual safe-max,
oversized gross products and header/tax sums. The migrated disposable PostgreSQL
worker calls actual authenticated REST create/patch/delete and registered MCP
create/update/delete via SDK/InMemoryTransport. Verifies legacy/exact/dual clients,
currency/terms/omission defaults, price tiers/overrides/inactive/window fallback,
all foreign dimensions, custom role denial, foreign IDs, old/new locks, sent/
approval-pending protection, unsafe header/line/snapshot preflight, inactive retained
history, int32-plus/safe-max amounts, credit warnings/hard blocks/mixed currencies/
unsafe rows, plan/multicurrency limits and same-service concurrent numbering.
Text snapshots cover invoice/line/number/approval rows and audit counts. Forced
line and approval failures prove full create/replacement rollback. Existing invoice
read worker also passes after write-route/tool changes. HTTP/session/OAuth/browser,
external-writer races, full posting/inventory/approval lifecycle and production
qualification remain separate gates. Fixtures create/drop only random databases.

MON-040 adds `tests/invoice-lifecycle-wire.test.ts` and the disposable migrated
PostgreSQL `tests/integration/invoice-lifecycle.test.ts`/worker. Actual invoice
send/void/write-off/recovery/interest/approval REST exports and registered MCP SDK
callbacks verify numeric/exact/dual aliases, currency scales, permissions/two-org
isolation, unsafe saved money/snapshots, locks, saved-FX preservation/reversal,
original stock/FIFO cost restoration, approval steps/generic request parity,
concurrent duplicate send/void and forced rollback of monetary/stock/number/
approval effects. See the lifecycle registry/evidence for exact limits. Email/PDF/
provider, external writer/configuration races, full-domain/settlement/reporting,
HTTP/session/OAuth/browser and production financial gates remain unqualified.


MON-041 adds `tests/quote-wire.test.ts` (transport price units, aliases, signed
rounding, ranges, exact remaining allocation and read scoping) and disposable
migrated PostgreSQL `tests/integration/quotes.test.ts` / `quotes-worker.ts`.
Actual authenticated handlers and nine SDK-registered tools cover legacy/exact/
dual clients, USD/IRR/JPY/KWD, price tiers/fallback, header edits, line replacement,
locks, role/two-tenant isolation, unsafe saved values, milestone/percentage/final
billing, concurrent send/conversion/numbering and injected transaction failures.
No provider email, browser/session/OAuth, PDF or financial release approval is
claimed. MON-019 retains combined receivable integration acceptance.


MON-042 adds five `tests/credit-wire.test.ts` groups and disposable migrated
PostgreSQL `tests/integration/credits.test.ts` / `credits-worker.ts`. Fourteen
actual authenticated REST operations and fourteen SDK-registered MCP tools cover
legacy/exact/dual prices and amounts, USD/IRR/JPY/KWD minor preservation, summary
int32-plus/unsafe/mixed totals, whitelisted edits, foreign/new/saved dimensions,
custom permission denial and two-tenant isolation, locked old/new/posting dates,
unsafe stored values, pure note offsets/customer-deposit application, saved FX
reversal, average/FIFO return/void, races and injected rollback. Complete table
snapshots include headers/lines/numbering/journals/carriers/stock/bank/chart and
audit counts; auth key last-used metadata is excluded. Invoice write/lifecycle
workers supply regression coverage. MON-021/024/007 and QA retain settlement FX,
external writer/configuration and complete accounting/inventory qualification;
provider/email/PDF, HTTP/session/OAuth/browser and production gates are unclaimed.

MON-043 adds five `tests/sales-receipt-wire.test.ts` groups and migrated disposable
PostgreSQL `tests/integration/sales-receipts.test.ts` / `sales-receipts-worker.ts`.
Seven actual authenticated REST operations and seven registered MCP SDK tools
verify numeric/exact/dual major-price aliases, currency scales, whitelisted draft
CRUD, nested money aliases, all foreign line/cash dimensions, custom permissions,
two-tenant isolation, old/new locked dates, safe maximum and unsafe stored values,
complete revenue/tax/cash recognition, changed-rate saved reversal, average/FIFO
and zero-cost stock/warehouse restoration, missing/corrupt issue history, mixed
REST/MCP duplicate post/void and first-sequence numbering. Fault injection and
complete snapshots cover sequence/header/line/ledger/bank/chart/stock/warehouse
and audit effects. Invoice lifecycle/credit workers provide shared-helper regression.
External writer/configuration coordination, historical unlinked inventory/base
currency policy, full-int64 domain, frontend/PDF/provider and financial/IRR release
qualification remain assigned gates, not implied by these fixtures.

## MON-044 recurring invoice contracts

Four `tests/recurring-invoice-wire.test.ts` groups assert alias/currency-scale
agreement, canonical syntax, exact signed price-first/quantity-hundredth rounding,
products/taxes/sums/ranges, saved DTO guards and schedule/header/FX rejection.
`tests/integration/recurring-invoices.test.ts` migrates disposable PostgreSQL and
invokes actual authenticated dedicated/generic REST handlers and eight registered
SDK tools. Fixtures cover legacy/exact/dual clients, tenant/role/type/deletion
isolation, preview/update/pause, zero terms, safe max, concurrent catch-up, saved
exact FX, locks/missing rates/foreign/deleted references, second-occurrence rollback,
template-line/journal-line/schedule faults and failed auto-send email after posting.
Invoice lifecycle and recurring journal integration workers are regression checks.
No successful provider delivery, browser/session/OAuth, full domain or production
accounting/IRR qualification is inferred.


## MON-045 bulk invoice contracts

- Pure groups: decimal-major/minor aliases, USD/JPY/IRR/KWD, signed extended-price
  rounding, gross/sum/range rejection, flat grouping/header agreement and exact
  safe-limit reminder formatting.
- Actual REST routes and registered SDK tools on migrated disposable PostgreSQL:
  legacy/exact/dual imports/preview, grouping, custom-role/API-key/org scoping,
  invalid-money-before-job, partial business errors, number/header/line rollback,
  atomic recognition journals/saved FX, duplicate/concurrent send and whole-batch
  rollback, annotation-only paid balances/locks/retries, unsafe saved history and
  reminder preflight/skips/local delivery failure without provider traffic.
- Unit regression, adjacent invoice write/lifecycle/recurring integration,
  typecheck/lint and source-inventory verification. No build/dev server.
- No settlement/report/full-int64, browser/session/OAuth, successful SMTP/provider,
  broad quoted-CSV or production/IRR qualification is inferred. MON-021 owns
  annotation interaction with payment/allocation/reversal/bank/FX/report writers.

## MON-046 bill read contracts

- Pure DTO/filter/base-display/status-count fixtures cover aliases, stored currency
  units, signed ties, unsafe header/line/contact/rate/product history, SQL-text sums,
  min/max cancellation guards and mixed currencies per status.
- Actual REST API-key handlers and registered MCP SDK tools on migrated disposable
  PostgreSQL cover list/detail/count envelopes, every status, above-int32/safe-max/
  signed money, pagination/filter validation, read-only custom roles, conflicting
  organization headers, foreign/deleted parents and nested contact/account/tax
  references. SQL-text snapshots prove successful/rejected reads do not mutate
  bill/line/contact/rate/ledger/stock/allocation business state.
- Historical issue-date FX excludes foreign/future rates; missing rates return
  nulls; available cross-scale/unsafe-product displays fail visibly. Adjacent actual
  invoice reads and their pure fixtures verify the shared display adapter.
- Full-int64, CRUD/lifecycle/settlement/procurement, browser/session/OAuth, providers,
  deployment, native accounting and functional IRR remain separate qualification.
  Typecheck/lint/inventory verification apply; no build/dev server.

## MON-047 bill CRUD write contracts

- Pure fixtures cover legacy/exact/dual major/minor prices, USD/JPY/IRR/KWD
  scales, quantity/discount/tax units, extended signed rounding, reverse-charge
  net payable, defaults and price/product/tax/sum range rejection.
- Actual authenticated REST handlers and registered MCP SDK tools on disposable
  migrated PostgreSQL cover create/edit/delete, legacy/exact compatibility,
  API-key/custom-role/tenant isolation, all foreign reference types, historical
  inactive/deleted references, source PO/receipt dimensions, duplicate strategies,
  approval submission state, old/new date locks/closed years, saved-money safety,
  concurrent first numbering/duplicate creates, numbering capacity and soft delete.
- SQL-text bill/line/link/sequence plus audit/ledger/stock/allocation snapshots
  verify failed operations leave no changes. Injected line, link, header delete
  and audit constraints prove whole-operation rollback. CRUD creates no ledger,
  stock or payment allocations; retained PO links stay on deleted headers.
- Adjacent bill read integration, full unit regression, typecheck/lint and source
  inventory verification apply. No build/dev. Lifecycle/approval execution,
  settlement, full-int64, production/IRR, browser/session/OAuth/provider and human
  financial/security/migration gates are not inferred from these fixtures.

## MON-048 bill lifecycle contracts

- Pure contracts: safe tax/recoverability/reverse-charge ratios, quantity rounding,
  int32 tallies, exact price tolerances, reason schema and recognition/payable barriers.
- Real REST/API-key/custom-role and registered MCP SDK fixtures: numeric/exact/dual
  bill clients, receive/approve/reject/void, large safe amounts, saved FX and cross-
  scale conversion, sub-minor inventory/GL residual agreement, tax/AP agreement,
  average/FIFO/warehouse stock and saved-value reversal, consumed-FIFO refusal.
- Actual existing goods-receipt handler creates the tested accrual; lifecycle fixtures
  cover matched GRNI/tax/PPV revaluation, partial bills, PO quantities/receipt stamps,
  no second stock receipt, tolerances and original accrual restoration on void.
- Workflow assignment, nonconsecutive steps, generic REST/MCP actions, direct pending
  approval, cancellation, tenant/read-only/invalid credentials, unsafe saved money,
  foreign account, inconsistent headers, missing FX/accounts, date locks/closed years,
  existing settlements/orphan journals and pay recognition barriers are exercised.
- SQL-text snapshots compare all relevant bill/ledger/stock/warehouse/GRNI/PO/approval/
  audit state; journal-line/header/audit/stock failures prove whole-operation rollback.
  Concurrent receive/void has one successful operation and no duplicates.
- Full unit regression, adjacent bill reads/writes/invoice lifecycle integration,
  typecheck/lint and inventory/legacy gates apply. No build/dev. Settlement races,
  foreign GRNI, legacy remediation, full-int64, browser/session/OAuth/provider,
  production migrations, human financial/security/IRR qualification remain separate.

## MON-049 purchase order contracts

- Pure fixtures: major/minor/dual aliases, USD/JPY/IRR/KWD scales, extended signed
  rounding, discounts/exclusive tax, retained PATCH no-tax/discount semantics,
  range/date/email/schema rejection, exact partial residuals and counts guards.
- Actual REST/API-key/custom-role and full registered MCP SDK fixtures: every PO
  operation, compatible envelopes/aliases, above-int32/safe-max/signed values,
  supplier/dimension/tenant isolation, saved corruption, period locks/closed years,
  empty/malformed bodies, supplier filters, mixed/unsafe/offsetting counts.
- Partial/full conversion and void preserve net/tax residuals, first bill pointer,
  reservations, reverse-charge due and quantities. Actual linked GRNI accrual
  tests prevent receipt reuse/double recognition and release posted/unposted
  reservations. Converted bill edits reject; unknown legacy partial history fails.
- SQL-text snapshots cover PO/bill/line/link/sequence state and audit/ledger/stock/
  email effects. Injected PO/bill line, link, tally and audit failures prove atomic
  rollback. Concurrent first creates/send/convert/delete have no duplicate effects.
- Email-failure fixtures explicitly blank provider credentials, retain sent state,
  report 502 and persist failed logs without PDF; audit failure prevents delivery.
- Adjacent bill write/read/lifecycle regression, full units, lint/typecheck and
  source inventory/legacy checks apply. No build/dev/Docker or live provider.
  Other procurement writers, foreign receipt FX, full-int64, migration/release,
  independent financial/security/native-language/IRR gates remain separate.

## MON-050 purchase requisition contracts

- Pure exact price aliases, numeric/exact/dual agreement, currency scales, signed
  extension ties, subminor residuals, zero tax, safe prices/products/sums, int32
  quantities, date/canonical syntax and corrupt saved balance rejection.
- Actual migrated PostgreSQL handlers and full registered MCP SDK: all CRUD,
  submission/approve/reject/conversion, numeric/exact/dual clients, signed/large
  safe values, JPY/KWD, no-supplier conversion refusal, exact copied line amounts.
- Actual API-key/custom-role resolution, conflicting org header, read-only role,
  invalid key, foreign ID/contact/account/tax/converted PO refusal before disclosure.
- SQL-text snapshots prove unchanged business rows/numbering/audit/ledger/stock/
  email after input/history/lock failures and injected line/header/status/audit
  constraints. Concurrent first numbering, decisions and conversion plus PO create
  prevent duplicate numbers/orders. Sequence exhaustion rejects before mutation.
- Adjacent PO integration, full units, typecheck/lint and source/legacy inventory.
  No build/dev/production qualification; independent financial/security/migration/
  browser/session/OAuth/IRR and parent procurement gates remain assigned.

## MON-051 supplier debit-note contracts

- Pure REST major/MCP minor/exact/dual price units, extension/discount/tax ratios,
  USD/JPY/IRR/KWD scales, malformed/conflicting/unsafe aliases and header balances.
- Actual migrated PostgreSQL handlers/full MCP SDK cover CRUD/send/apply/void,
  numeric/exact clients, above-int32 and safe-max values, saved KWD FX after quote
  changes, standard VAT, complete average/FIFO warehouse return and restoration.
- API-key/custom-role/foreign organization and reference checks on every selected
  operation, conflicting org header, bounded dates/list queries and mass assignment.
- SQL-text snapshots establish unchanged business tables after rejected values,
  unsafe history, consumed FIFO, partial stock, differing FX and period/year locks.
  Injected line/journal/allocation/stock/void-audit failures prove rollback.
- Concurrent first/subsequent numbering, send/full application/void, allocation
  unwind, bill void coordination and email-failure retained sent state are covered.
- Adjacent bill lifecycle/credit integration, full units, lint/typecheck, inventory
  and legacy-money checks apply. Full-int64/partial-GRNI-specialized tax/settlement
  cross-writer/provider/session/OAuth/production/independent financial/IRR gates remain.

## MON-054 procurement setting contracts

Pure procurement-settings-wire tests assert integer numeric basis points 0..100000,
500 = 5%, boolean controls, invalid type/range/coercion/history and legacy unknown
key stripping. Actual migrated PostgreSQL procurement-settings fixtures invoke
GET/PATCH/compatible PUT plus registered MCP SDK read/update tools with API-key
and custom-role authorization. Assert defaults without writes, numeric response/
timestamp parity, 0/false/omission/empty upsert, tenant/currency isolation, denied
writes and invalid/expired keys, negative inputs without settings/audit effects,
concurrent initial/existing partial saves, repeats/row identity, scoped audits,
unsupported stored controls and explicit repair, matching tolerance/GRN behavior
and injected audit rollback of existing update and initial insert. Adjacent bill
lifecycle and purchase-order fixtures, units, typecheck/lint and inventory checks
apply. No browser/session/OAuth/production/independent financial or IRR readiness
is inferred. See PROCUREMENT_SETTING_WIRE_CONTRACTS and MON-054 evidence.

## MON-053 bill bulk contracts

Pure tests/bill-bulk-wire.test.ts covers legacy/exact/dual prices, formatted amount
overrides, signed rounding, four currency scales, alias disagreement, safe limits,
int32 quantity boundaries, grouping/collisions/header sums and template aliases.
Actual tests/integration/bill-bulk.test.ts runs real REST/API-key/registered MCP
SDK operations in randomly created, migrated and dropped PostgreSQL databases.
Fixtures exercise readback aliases, no-write preview, scoped roles/invalid keys,
cross-tenant/literal/ambiguous/deleted/inactive references, grouped formats/counts,
malformed/range preflight, partial/repeated imports, period/closed-year barriers,
line/audit rollback with sequence/header snapshots, concurrent numbering,
supplied-number collisions/exhaustion and zero ledger/stock/payment effects.
Adjacent bill CRUD/read and invoice bulk workers supply regression coverage.
No provider/browser/session/OAuth, full-int64, production/IRR or independent
financial approval is claimed. See BILL_BULK_WIRE_CONTRACTS and MON-053 evidence.

## MON-052 goods receipt contracts

- Exact physical quantities/dual aliases, int32 hundredths, whole stock, signed
  rounding, safe minor costs/products and output aliases without currency rescale.
- Migrated PostgreSQL actual REST/MCP registry with API-key/custom-role auth;
  receive/list/detail/create-bill, conflict org headers, roles and foreign IDs/
  supplier/PO-line/item/warehouse/account/journal validation, strict list/dates.
- Exact GL and warehouse/average/FIFO receipts, zero values, above-int32/safe-max
  costs, USD/JPY/KWD/EUR scales, saved FX, same-rate full GRNI clearing, nonstock
  expense/AP recognition and void. Changed FX, partial/unknown FX, tracked stock,
  unsafe cost/products/stock totals, indivisible FIFO and negative residuals reject.
- SQL-text business snapshots prove no committed mutation after input/lock/history
  failures or injected audit/stock errors. Concurrent full receive and mixed REST/
  MCP create-bill have one winner; active draft links prevent repeat billing.
- Adjacent bill lifecycle/PO/debit-note integration, units, lint/typecheck and
  inventory/legacy checks apply. Broader residual/partial FX, other inventory
  writers, full-int64, production and independent financial/security/IRR gates remain.

## MON-055 payment read contracts

Three pure groups verify signed exact minor aliases, USD/IRR/JPY/KWD unchanged
units, nullable contact/bank values, paired allocations, unsupported history,
foreign nested relations and bounded list inputs. Disposable migrated PostgreSQL
fixtures call actual list/detail REST exports with synthetic API keys/custom
read-only roles and registered MCP SDK tools. Assertions cover empty/list/detail
legacy/exact parity, signed/zero/above-int32/safe-max values, stable pagination,
filters, read-only access, invalid/expired auth, foreign/deleted/missing IDs,
all five polymorphic allocation types, unknown/missing/foreign documents,
foreign journal/statement links, unsafe int64 saved money and immutable SQL-text
business snapshots. Same-tenant inactive/deleted history and noncash carrier
pairs remain readable. Adjacent credit/debit-note fixture regressions run.
No payment mutation/GL settlement, HTTP/session/OAuth/provider or full-int64/IRR
qualification is inferred. See PAYMENT_READ_WIRE_CONTRACTS and MON-055 evidence.


## MON-057 payment reversal contracts

Pure `payment-reversal-wire.test.ts` checks exact safe-limit subtraction/addition,
no clamping, nonnegative operands and overflow. Actual `payment-reversals.test.ts`
invokes REST/API-key/custom-role and registered MCP SDK operations against a
random disposable fully migrated PostgreSQL database. Numeric/exact-created
payments, received/made/multi/partial, safe-max/above-int32, four currency scales,
saved FX after quote edits, dimensions/inactive bank, legacy null sourceId,
paired note reapply/void and prepayment restoration retain their amounts/history.
Rounded zero control legs reverse verbatim; all-application unwind permits new
settlement. Tenant/auth/UUID/lock/fiscal/bank/provider/corrupt/unsafe history and
injected final audit failures preserve complete business SQL-text snapshots.
Competing deletes produce one success, one 404, one reversal and one audit.
Six payment/credit/debit/bill lifecycle regression workers run alongside the slice.
No real HTTP/session/OAuth/provider, full-int64/financial/IRR, external-writer
concurrency or generalized retained residual-carrying qualification is implied.

## MON-056 payment settlement contracts

`tests/payment-settlement-wire.test.ts` covers canonical aliases, complete/distinct
allocation constraints, currency minor scales, safe output limits and cumulative
carrying residuals. `tests/integration/payment-settlements.test.ts` invokes real
REST pay/create exports with synthetic API keys/custom permissions and registered
SDK tools against disposable migrated PostgreSQL. It verifies partial/final and
multi-document received/made cash, header/payment aliases, roles/isolation/retry
isolation, bank linkage/currency, locked/closed dates, saved recognition after FX
edits, both gain/loss directions, USD/IRR/JPY/KWD scales, zero rounded carrying,
reverse-charge payable, split/clearing-only GRNI AP, changed invoice recognition,
note/prepayment carriers, unsafe SQL history, output FX
overflow, mandatory audit rollback, first-number concurrency, competing requests
and identical retries. SQL-text business snapshots exclude API-key usage metadata.
Payment-read, credit, debit-note and bill-lifecycle integration regressions run
alongside it. No real HTTP/session/OAuth, live provider, configured-target migration,
IRR or full-int64 qualification is inferred. See settlement registry and evidence.


## MON-059 scheduled payment contracts

- Pure wire fixtures: legacy/exact minor aliases, canonical syntax, safe max and
  overflow rejection, USD/JPY/KWD/IRR preservation and exact form scale/tie rounding.
- Disposable migrated PostgreSQL: actual REST and MCP SDK list/detail/CRUD/process,
  key expiry, permissions, organization isolation, unsafe/null/foreign/deleted
  relations, statuses/date locks/closed years, stale balance and partial success.
- Inject final mandatory audit failure: schedule/payment/allocation/GL/bill/number
  and audit snapshots unchanged; failures remain pending. Retry/concurrent REST/MCP
  process and concurrent cancellation cannot duplicate cash. Future/cancelled/deleted/
  completed and legacy failed/processing rows are excluded. EUR cash retains currency,
  scheduled date, recognition carrying and payment-date FX; missing FX/cash rejects.
- Typecheck/lint and payment batch/settlement/reversal/read/bill lifecycle regressions.
- Broader browser/session/OAuth/provider, full-int64, nonadopted writer concurrency,
  ambiguous legacy recovery, financial/migration/security/IRR gates remain assigned.

## MON-058 payment batch contracts

Pure batch schema/arithmetic fixtures distinguish legacy decimal-major immediate
allocations from integer-minor stored items, including exact aliases, rational
agreement, positive ties, currency scales, malformed aliases and safe limits.
Actual REST exports use synthetic API keys/custom roles and registered SDK tools
against disposable migrated PostgreSQL. Fixtures cover immediate received/made
and multiple/partial documents, normalized retries, stored create/list/detail/edit/
submission and remittance data/send-skipped operations. Tenant/auth/bank/UUID/
date/period/fiscal/state/amount/currency/reference/aggregate/unsafe-history failures
preserve SQL-text business snapshots; forced final batch audits roll back earlier
cash/GL/numbering/balances/status. Competing submissions produce one completion
without duplicate payments. Live settlement provenance qualifies remittance;
malformed, draft, old unlinked, foreign and reversed history fail. Exact safe-max
formatting and escaped HTML are checked; no real email is sent. Four currency
scales retain stored minor units. Payment settlement/read/reversal, credit,
debit-note and bill-lifecycle regressions apply. Provider, actual HTTP/session/
OAuth, full-int64, broader financial/security/migration/release and IRR gates remain.

## MON-060 expense CRUD contracts

- Pure schemas/amount ratios: REST major versus MCP minor, alias agreement,
  canonical syntax, positive ties, safe max, USD/JPY/KWD/IRR units and mileage
  metadata. Exact editor prefill and summary fractions, sums above numeric range,
  differing-currency summaries and currency scale presentation.
- Disposable migrated PostgreSQL: real REST/API-key and MCP SDK list/detail/counts/
  create/update/delete; legacy/exact/dual clients, invalid/expired keys, custom
  permissions, tenant override/foreign claims and every stored reference.
- Invalid/unsafe header/line/mileage/sum, tax/receipt/reference/date/state/mass
  assignment fail without committed effects. Old/new locks, two-tier bypass and
  closed years apply. Final audit and line-insert faults roll back all writes;
  concurrent edit/delete serialize without orphaned lines. Existing IDs retain
  metadata, rejected edits and soft deletion work, repeated delete is 404.
- SQL text count bounds/mixed currencies; safe-max numeric/string JSON; public
  user profiles omit authentication secrets; foreign users/approver/journal fail.
- Adjacent payment/read/reversal/batch/schedule/bill lifecycle/credit/debit-note
  regressions, typecheck/lint and lexical/legacy inventories. Broader lifecycle,
  bank/restore writers, old create-drawer mileage math, performance, browser/locale/
  provider/session/OAuth/financial/security/migration/full-int64/IRR remain assigned.


## MON-061 expense claim lifecycle contracts

- Pure tests: tests/expense-lifecycle.test.ts verifies inclusive/partial/blocked/
  reverse-charge VAT, exact half ties, safe maximum/overflow and strict canonical
  pay dates/rejection inputs.
- tests/integration/expense-lifecycle.test.ts launches the actual route/MCP worker
  on a migrated randomly named disposable PostgreSQL database. Six operations,
  registered SDK schemas, API-key/custom roles, organization isolation, legacy/
  exact saved money, future/invalid/locked dates, two-tier bypass and fiscal closure.
- Exact approval tax legs/dimensions; EUR loss and JPY gain/currency scales; max-safe
  approval/payment/reversal; missing/tiny/nonrepresentable inverse FX; compound tax;
  mismatch/unsafe/foreign/inactive saved amounts/references; base changes and
  ambiguous/draft/missing-provenance history. Saved reversal preserves all sides,
  rates and dimensions without live rate lookup; repeated cycles select own audit.
- Real SQL audit faults assert no committed status/account/number/journal/reversal
  changes. Parallel double approval, REST/MCP pay, double reversal, edit/submit
  and recall/approve assert serialized state and no duplicate financial effects.
- Regression workers: MON-060 CRUD, MON-056/057 settlement/reversal,
  MON-042/051 carriers and MON-048 bill lifecycle. These preserve domain handoffs;
  MON-021 retains combined acceptance.
- Limits: PostgreSQL 18.6 local synthetic fixture only; not PostgreSQL 16, clean
  install, browser/OAuth/session, generic reference/configuration writer races,
  compound-tax or old history remediation, full-int64 or production/independent
  financial/security/provider/IRR qualification. No build or dev server.

## MON-062 bank accounts

| Area | Executed coverage | Limits |
|---|---|---|
| Wire | Signed safe edges, canonical aliases/conflicts/nulls, strict metadata, omission/defaults, no currency rescaling | Safe numeric coexistence, no full-int64 CRUD |
| Actual REST/MCP | Live PostgreSQL routes and SDK tools, API-key/custom-role/org/deleted isolation, GL ownership/type/currency/claims | No browser/session HTTP or production proof |
| Diagnostics | 5-billion sum, unsafe sums/individual cancellation/differences, foreign import/GL, mixed currency, nullable balances | Statement comparison only; no GL reconciliation claim |
| Atomicity/history | Real audit trigger faults roll back create/update/delete/alert in both transports; parallel GL allocation/claim/delete; statement and opening history guards | Other legacy bank writers retain their own tasks |
| Alerts | Exact USD/JPY/KWD/IRR messages, full int64 historical text, bad currency isolation, inactive/deleted/equal thresholds, org recipients and daily sequential dedupe | No provider email or concurrent-job delivery guarantee |
| Regression | Payment settlement and reversal integration; full pure suite; typecheck and lint | Existing 155 lint warnings; no full build/dev |

## MON-063 bank transaction reads

| Area | Executed coverage | Limits |
|---|---|---|
| Wire | Strict UUID/status/page/limit/offset validation, sign/null/safe-edge aliases, opaque metadata units, audit agreement, exact 1%/5% ratios | Numeric coexistence +/-9007199254740991 |
| Actual REST/MCP | Six GET handlers and six SDK tools, stable list/pages/empty filters, API-key expiry/org spoofing/custom roles, missing/foreign/deleted parents, unique names and schema descriptions | No browser/OAuth session |
| Nested scope | Foreign GL/contact/journal/import/transfer references and orphan dimensions reject; foreign audit entity event excluded; users sanitized | Generic reference writers remain separate |
| Match/units | Incoming invoices/outgoing bills, payment meta, opposite-sign transfers, same-currency filters; exact complete net journal (5-billion gross and net), unsafe combined and mixed-line rejection | Base-currency journal suggestions only; sampled candidate sets |
| Imports/duplicates/history | Nullable/large/signed import balances, metadata units; safe numeric SQL duplicate aliases/date strings; unsafe stored money/raw JSON/audit aliases reject | At most 20 imports/100 duplicate pairs; opaque history not remediated |
| Read invariants | Read-only repeatable-read services and accounting DB snapshots for successful/negative reads, USD/JPY/KWD/IRR units unchanged | No posting/import/reconciliation correctness claim |
| Regression | MON-062 bank account and MON-056 payment settlement integration; all 186 pure cases sequentially; typecheck/lint | Concurrent default pure run hit existing startup timeout; final sequential run passed |

PostgreSQL 18 synthetic disposable databases only; not clean install/PostgreSQL
16/provider/production, full-int64, independent financial/security or IRR rollout.
No build/dev/schema edit/migration of the configured database. MON-021 combined
acceptance and MON-064..069 writer contracts remain assigned.

## MON-064 bank imports

| Area | Executed coverage | Limits |
|---|---|---|
| Pure parser/wire | All twelve formats; safe signed edges, aliases/conflicts, grouping/signs, USD/JPY/KWD/IRR scales, profiles, invalid dates/row widths/quotes, BAI2 minor units, native debit balances | Lightweight text parser, no binary/full ISO validation |
| Actual REST/MCP | Statement/bulk preview/commit, import detail and profile GET/PUT/DELETE; all twelve formats, API-key expiry/org spoofing/custom roles, missing/foreign/deleted parents and references | PostgreSQL 18 synthetic migrated databases; no browser/session/OAuth |
| Compatibility | Statement numeric minor money plus aliases; bulk preview preserves legacy major amount/type and adds exact major/minor; stored bank/history/row bounds; exact alias-only input | Safe Number coexistence only; no full-int64 |
| Atomicity/retry | Within-file/sequential/concurrent duplicates; all-duplicate balance unchanged; overlap with opening balance; locked later account/date and SQL trigger faults roll back rows/history/jobs/audit/balance | Row idempotency, retries add history; legacy writer races separate |
| Rules/profiles | Owned rule suggestions stay unreconciled without journals; foreign rule references reject; saved separators/date order/debit sign, replacement/delete and invalid profiles | Actual rule posting/auto-reconciliation remains MON-069 |
| Regression | MON-062/063 bank workers; all 189 pure cases; typecheck and lint | No full build/dev/deployment/production IRR approval |

Broader resumable/object/source imports remain DATA-001/MON-033. MON-021 retains
combined financial acceptance. No stored rescaling or configured database migration.

## MON-065 bank categorization

- `tests/bank-categorization-wire.test.ts`: strict allocation aliases, safe bounds,
  malformed/conflicting values and expense major/minor rounding/currency scales.
- `tests/integration/bank-categorization.test.ts` and worker: actual exported
  REST and five MCP SDK operations on migrated disposable PostgreSQL, duplicate
  registration checks, legacy/exact inputs, API keys/custom permissions/header
  spoofing, foreign/missing/deleted references, split/tax sums, compound rejection,
  FX/amount overflow, JPY/KWD/IRR scale conversion, saved-FX corrections without
  live quotes, corrupted-history rejection, period/fiscal locks, paid claim linkage,
  duplicate-approval/creation guards, partial bulk results, failed-write snapshots
  (including self-link/control/journal/expense/audits) and concurrent adopted writers.
- Adjacent bank account/read/import and expense CRUD/lifecycle suites provide
  regression coverage. Synthetic PostgreSQL 18 only; browser, session/OAuth,
  provider, PostgreSQL 16, production and independent financial gates remain open.
  MON-066..069 and MON-021 retain other bank and combined acceptance.

## MON-066 bank document matching

- Pure described schemas cover numeric/exact/dual minor aliases, strict targets,
  canonical syntax, duplicate allocations and exact safe-limit/overflow sums.
- Migrated PostgreSQL actual authenticated REST handlers and registered SDK tools
  cover all new matching/read operations, owner/custom banking-only/viewer roles,
  two organizations, spoofed org headers and invalid/expired keys.
- Financial snapshots assert unchanged state on rejected money/history/scope,
  partial/overpayment/direction/currency, inactive/shared GL and period/fiscal locks.
  Qualified cash/credit/debit/prepayment, reverse-charge payable, USD/JPY/KWD/IRR
  scales, safe maximum, saved carrying vs later cash FX and absent live quote pass.
- Forced bank audit failures roll back new settlements/existing-payment/journal
  links; statement, document, payment and journal races enforce exclusive matching.
- Adjacent payment settlement and bank account/read/import/categorization workers,
  units, types, lint and inventory guards qualify the bounded change. MON-067..069,
  MON-021, full-int64/provider/OAuth/production/independent financial gates remain.

## MON-067 bank transfers

- Pure bank-transfer-wire tests qualify REST decimal major / MCP integer minor
  inputs, agreeing exact aliases, safe maximum, currency scales/ties and malformed
  money/date/UUID/unknown-field rejection.
- Actual exported REST handlers and MCP SDK tools in bank-transfers-worker use
  migrated disposable PostgreSQL 18, API keys, invalid/expired keys, custom bank/
  viewer roles and two organizations with spoofed organization headers.
- Signed incoming/outgoing mirror and existing-counter pairs have one balanced
  journal, exact historical/base FX, reciprocal IDs/group, correct per-bank GL
  directions and unchanged cached/existing running balances.
- SQL-text snapshots prove no financial/audit changes on wrong scope/state/
  sign/amount/currency/import/history/GL/date/range/FX; injected final audit faults
  roll back self-linking, numbering, journal/pair creation and existing links.
- Concurrent same-source/common-counter/opposite-direction/category-vs-transfer
  fixtures permit one successful exclusive match. Concurrent standalone requests
  produce distinct transfers; repeat-create semantics are explicitly documented.
- Read/account/import/categorization/document-match regression suites retain their
  own qualification. No browser/provider/OAuth/PostgreSQL16/production/human
  accounting proof; MON-068/069 and MON-021 retain remaining/combined acceptance.

## MON-068 bank reconciliation

- Pure reconciliation-wire/display groups exercise signed numeric/exact/dual
  aliases, canonical syntax, safe bounds, dates/IDs/strict fields and exact
  negative fractional/large USD/JPY/KWD/IRR presentation.
- Actual exported REST and SDK MCP in bank-reconciliations-worker qualify all
  eight operations with API keys, custom bank/viewer roles, invalid/expired keys,
  two tenants and spoofed org headers on migrated disposable PostgreSQL 18.
- Session completion requires all accounted lines, exact statement and GL proof;
  undo reopens completed sessions. SQL-text snapshots prove no committed effects
  for unsafe balances/sums/differences/history, unmatched/foreign/noncash values,
  invalid IDs/dates/periods, duplicate/overlapping windows and explicit ID errors.
- Exact reversals preserve saved FX, accounts/dimensions and retained allocations;
  bank-created cash restores invoice/bill balances, existing cash/manual journals
  detach, bank expenses soft-delete, adjustment synthetic and proven transfer
  synthetic legs remove, real statement dates/balances remain unchanged.
- Final audit faults roll back sessions, adjustments, marks, exclusions, cash,
  expense, coding and transfer undo. Concurrent undo/completion/opposite transfer
  fixtures leave one successful exclusive transition. Current FX changes do not
  alter foreign cash reversal. Sessions protect bank currency identity.
- Relevant account/coding/matching/transfer/expense/payment reversal/settlement
  regression suites remain separately qualified. No browser/provider/OAuth,
  PostgreSQL16, independent financial/security, production or IRR gate claim.

## MON-069 bank rules and automatic cash

- Four pure groups cover canonical signed thresholds/equality/ranges/AND/OR,
  strict partial updates, safe limits, fixed dual aliases, corrupt saved JSON,
  exact decimal-percent half-up allocation/caps/remainder and signed conservation.
- Migrated disposable PostgreSQL18 REST/API-key/custom-role/two-tenant/spoofed-org
  and registered SDK MCP worker exercises all eight operations, REST keyword vs
  MCP pattern/keyword suggestions, safe maximum and large splits, USD/JPY/KWD/IRR,
  active scoped top-level/split references, single/split posting, saved FX/tax,
  undo, dryRun without mutation, pending/excluded/zero/link eligibility and repeats.
- SQL-text snapshots prove rejection/rollback for malformed/exact-range input,
  stored JSON/foreign references/unsafe DB money, date locks and mandatory audit
  failures in CRUD/application and automatic links. Concurrent applications and
  manual coding create one journal; concurrent auto matching links cash once.
- Auto fixtures separate per-bank GL, require signed exact equality, skip ties/
  foreign manual FX/opposite sign/near amounts, reject inconsistent saved FX,
  and link existing received/made payments without document resettlement; undo
  retains existing cash. Eight banking/payment regressions pass separately.
- No browser/screenshot/provider/OAuth/PostgreSQL16/production/independent human
  accounting/security claim. MON-021 retains combined integration acceptance.

## MON-070 organization settings

- Four pure groups qualify mileage canonical aliases, null/fallback, unchanged
  USD/JPY/KWD/IRR units, safe bigint/numeric DTOs, malformed/unsafe ranges,
  partial controls and country/business-type/currency rollout policy.
- Disposable migrated PostgreSQL actual GET/POST/PATCH and mileage GET/PUT,
  registered SDK MCP all five operations and registerAllTools exercise numeric,
  exact and dual clients, maximum safe/above-int32 amounts, member/custom-role
  permissions, expired/invalid keys and spoofed tenant headers.
- SQL-text snapshots prove rejection and rollback for malformed JSON/money,
  unknown aliases/fields, foreign/missing/deleted orgs, unsafe saved money,
  invalid merged business type, journal-history/IRR guards and actual audit faults.
  Concurrent partial writes preserve fields; PEPPOL, onboarding, null/fallback,
  saved thresholds and actual post-commit default account/tax seeds are covered.
- Session list/create handlers use stubbed session identity and outbound email;
  actual memberships, plan/slug/provisioning/audit logic remains real. No genuine
  session/OAuth/email/browser/PostgreSQL16/independent financial/security proof.
  Expense CRUD/lifecycle regressions cover the adjacent mileage consumers.
  MON-022 retains combined configuration acceptance after all four children.

## MON-071 bounded tax configuration

- Four pure groups cover lossless numeric basis points in legacy/exact modes,
  int32/recovery bounds, partial patches, strict unsupported alias handling,
  profile country validation and corrupt saved DTOs.
- Disposable migrated PostgreSQL18 actual REST/API-key/custom-role and registered
  SDK MCP tests cover all ten rate/profile/jurisdiction operations, two tenants,
  spoofed org headers, expired/invalid auth, scoped active component references,
  int32 maximum, retained fields/component replacement and country resolution.
- SQL snapshots prove no mutation for invalid input, foreign references, corrupt
  saved rates/components/jurisdictions and audit faults in rate CRUD, profile
  batches and jurisdiction save/delete. Concurrent defaults, repeated profile
  applies and NULL-key upserts retain deterministic single-write behavior.
- Organization-settings/onboarding tax-seed and bank-rule PostgreSQL regressions
  pass separately. No browser/session/OAuth/provider/current-law/PostgreSQL16 or
  independent human accounting/security qualification. MON-072/029 retain
  tax-period money/filing/settlement and reports; MON-022 combined acceptance.
