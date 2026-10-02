# Verification matrix

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
