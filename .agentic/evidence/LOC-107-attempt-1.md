# LOC-107 attempt 1 - Aging, payment and vendor report catalogs

2026-10-22, Codex, D:/Projects/dubbl, master. Seven existing
dirty files were the unfinished LOC-107 implementation (five pages and both
catalogs). Controller validate/status/next selected LOC-107; started as codex.
Owner requested finishing/committing this task and then the next, without push.
No subagents, build or dev server were used.

## Acceptance mapping

1. Completed the existing extraction with 59 paired AgingVendorReports messages.
   Finished bucket labels, day units, document type/status badges and finite
   failures. Existing namespaces compare structurally equal to HEAD. All new
   Persian prose passes a Persian-script assertion. Ownership and explicit
   caller/date/numeric/CSV exceptions are in AGING_VENDOR_REPORT_CATALOGS.md.
2. Six focused tests render production JSX/readers and real shared controls with
   next-intl/PresentationProvider; only page hooks, IO and animation are controlled.
   They cover both locales, exact large/currency-scale values, CSV source units,
   canonical buckets/types, known/unknown badges, escaping, filters, navigation,
   date callbacks, loading/empty/failure states, failed HTTP/JSON/envelope/money/
   network reads before adoption, missing organization and stale cleanup.
3. Registry, task handoff, this evidence and separate honest self-review retain
   provisional Persian wording and independent LOC-070/008/002/native/RTL gates.

## Actual verification

All commands ran at repository root.

| Command | Result |
|---|---|
| node --import tsx --test tests/aging-vendor-report-catalogs.test.ts | 6/6 pass, zero skips |
| node --import tsx --test --test-concurrency=1 tests/aging-vendor-report-catalogs.test.ts tests/ledger-report-catalogs.test.ts tests/analytical-report-ui.test.ts tests/ledger-aging-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 47/47 pass, zero skips |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/ledger-aging-ui.test.ts tests/integration/document-analytics.test.ts tests/integration/payment-performance.test.ts | 3/3 pass, zero skips; real REST/MCP and SQL assertions |
| pnpm typecheck | Pass, fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass, 9,040 compatible keys per locale |
| pnpm lint | Zero errors; 24 existing warnings plus one new helper warning subsequently removed and checked with focused eslint |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass, 417 columns, 1,826 consumers; only scanned paths/consumer metadata changed; schema classifications unchanged |
| node .agentic/scripts/verify_legacy_money.mjs | Nine checks pass |
| Structured catalog comparison; git diff --check | Existing namespaces unchanged; whitespace check passes |

PostgreSQL 18 runs on a unique OS-temp cluster at 127.0.0.1:6487 with trust
authentication and max_locks_per_transaction=256. Each suite migrates and drops
a randomly named disposable database. The cluster is retained temporarily for
the owner's second authorized task; final cleanup is recorded there. No
application environment credentials/database or schema/migration changes.

Initial test attempts identified harness module-context and invalid empty-state
fixtures, and a Windows stdin encoding problem affecting six newly written
Persian values. Corrected static shared-control imports, valid empty fixtures
and Unicode-safe writes; final script/render checks pass. No product money or
service validation was weakened.

## Review and handoff

See LOC-107-review-1.md. Request paths/queries/headers, export columns/filenames,
canonical bucket and type values, exact-money readers and currency scale remain
unchanged. Existing MCP tools cover these operations; no operation is added.
Stripe remains untouched. Full suite, mounted browser, hosted CI, deployment,
native Persian, full RTL/calendar/numerals and adjacent output qualification are
not claimed. Next bounded task is LOC-108; commit SHA is reported after closure.
