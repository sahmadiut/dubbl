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

MON-005 evidence qualifies FX-02 exact direction/inverse/cross arithmetic and
FX-03 saved invoice-journal preservation using synthetic database fixtures.
FX-01 high rates are parsed/derived exactly but intentionally rejected by legacy
sync when int32/six-place coexistence cannot represent them safely. Full live
high-range posting remains MON-006/007/010, not a pass inferred from storage or
helper tests. See `../evidence/MON-005-attempt-1.md` and ADR-005. The initial
matrix above remains the original requirements list, not a current dashboard.

Use en-US/fa-IR; LTR/RTL; Latin/Persian/Arabic-Indic input; Gregorian/Persian display; IRR/USD/EUR and a three-decimal currency; zero, negative, large and boundary amounts; desktop/mobile; old/new API clients; clean/upgrade databases. A translated UI alone does not satisfy accounting tests.

## Pull request pipeline

Owner decision DEC-005 (2026-10-02) removes screenshot capture, screenshot tests and screenshot golden comparisons throughout this matrix. Retain behavioral, layout, accessibility, accounting and PDF checks; do not block continuation on browser/screenshot tooling. Historical requirements are superseded, not recorded as passed.

Owner decision DEC-002 (2026-10-02) overrides Docker execution requirements in this matrix: omit Docker installation, builds, container tests and runtime image checks for current work. Necessary configuration/documentation may be prepared without execution. Record these checks as omitted by owner decision and unverified; do not require Docker or block solely on its absence. Other verification requirements remain in scope. Preserve existing CI support unless a concrete change is needed.

Verified lockfile install, typecheck, lint, unit tests, translation-key checks, clean and previous-release PostgreSQL migrations, integration tests, English and Persian critical E2E, accessibility scan, layout/behavior review, production Docker build and dependency/license/security scans. Apply owner scope decisions above. Match actual repository tooling; do not introduce guessed package scripts.

## Nightly / release pipeline

All supported browsers, layout/behavior review and PDF correctness checks, larger migration fixtures, report reconciliation, import stress and SBOM/image checks. Apply owner scope decisions above. Include manual native-accounting, accessibility and operational reviews where automation is insufficient. Document real omissions as blockers or approved limitations, never as passes.
