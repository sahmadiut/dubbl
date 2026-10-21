# LOC-091 attempt 1 - payroll tax liability catalogs

2026-10-21 (Asia/Tehran), Codex. Base `e01758aa` on master. User requested
one next task completed and pushed. Controller selected and started LOC-091.
Inspected AGENTS/START_HERE, project/map/role/controller docs, task and parent,
LOC-007 dependency review, prior payroll evidence, catalog contract, referenced
source sections, page, money adapters, tax payment/report REST routes, services,
wire schemas, registered MCP tools and integration fixtures.

An existing one-line font-mono change in settings/members/page.tsx is preserved
and excluded from this commit. The generated money inventory will retain that
file's committed entry; index verification checks the actual staged snapshot.

## Acceptance mapping and resulting behavior

1. Extracted authored page copy into 52 paired `PayrollTaxLiabilities` messages,
   with 7,929 compatible keys per locale. Every Persian value contains Persian
   script. [Scope and explicit exceptions](../registries/PAYROLL_TAX_LIABILITY_CATALOGS.md)
   cover statutory IDs, saved data, canonical dates, fixed-two cent amounts,
   shared controls and separate output/RTL/native ownership.
2. Production JSX renders through real next-intl/PresentationProvider in both
   locales. Controlled hook/IO checks invoke actual table renderers, payment,
   field and agency callbacks. They cover exact low/high cents, sums exceeding
   Number.MAX_SAFE_INTEGER, outstanding clamp, paid/pending currency behavior,
   escaping, jurisdiction/bucket values, missing storage/org, HTTP/JSON/envelope/
   money failures, atomic reads, obsolete replies, form validation, retry reuse,
   changed-input retry reset and malformed-success retention. Migrated fixtures
   accept actual REST and linked MCP envelopes through the new reader alongside
   independent SQL and authorization/posting assertions.
3. Task handoff, registry/catalog index and honest Codex self-review record the
   provisional Persian and independent LOC-067/008/002/native/RTL gates.

The page now checks payment envelopes before adoption and success feedback;
liability reads reuse the existing analytics reader. Read failures clear history
and hide totals with translated feedback, release loading, and never expose raw
diagnostics. Both reads adopt atomically; cleanup ignores obsolete replies.
Storage failure/missing org also exits loading. Posting failures retain fields
and the retry key. Existing exact cents, bigint sums/clamp, statutory identifiers,
URLs, methods, headers, payload fields/defaults and optional omission rules remain.
Server authorization, posting, idempotency, dates/locks and all stored data remain.
Existing MCP tools cover every operation; there is no introduced user operation.

## Actual verification

All commands ran from D:/Projects/dubbl. No full build or dev server ran.

| Check | Actual result | Boundary |
|---|---|---|
| Focused catalogs/rendering/callback, payment wire, money and catalog foundation | 24/24 pass, zero skips; 11.023 seconds | Production templates, real translations; controlled hooks/IO |
| Migrated payroll payment/output fixtures | 3/3 pass, zero skips; 50.093 seconds | Real REST/linked MCP, SQL, posting/auth and legacy preservation |
| pnpm typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 7,929 keys in each locale | ICU/key contracts, not native linguistic approval |
| Owned-file ESLint | Exit 0, zero errors/warnings | Page, reader, focused/source-guard tests and payment worker |
| Full lint | Exit 0, zero errors, 27 existing warnings outside owned files | OS-temp lint cache |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,401 scanned paths, 1,792 consumer hashes; nine legacy checks | Working source before excluding unrelated settings hash |
| Staged snapshot and new registry/evidence links | All 1,792 consumer hashes match index blobs; schema unchanged; links resolve | Only seven task-owned consumer entries changed |
| Controller validation and diff check | Pass during implementation | Repeat after closure |

```text
node --import tsx --test tests/payroll-tax-liability-catalogs.test.ts tests/payroll-ui-money.test.ts tests/payroll-payment-wire.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-payments.test.ts tests/integration/payroll-outputs.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/tax-liabilities/page.tsx" i18n/payroll-tax-liability-presentation.ts tests/payroll-tax-liability-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-payments-worker.ts
pnpm lint --cache --cache-location <OS-temp>/dubbl-loc091-eslint.cache
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Tests used process-scoped TEST_DATABASE_URL/PG_BIN with an isolated OS-temp
PostgreSQL 18 cluster at 127.0.0.1:6457, trust authentication and
max_locks_per_transaction=256. Fixtures created/dropped randomized databases;
final admin query found zero dubbl_ci_* databases. pg_ctl stopped the cluster
successfully. No application database or credentials were used.

Staged snapshot verification used git cat-file --batch to compare LF-normalized
SHA-256 values for every inventory consumer with its actual index blob. All
1,792 match. Parsed catalogs differ only by the new 52-key namespace, and schema
columns/classifications remain unchanged. The staged settings source and its
inventory entry match HEAD while the unrelated local font edit is preserved.
The full working-source inventory gates passed before excluding that unrelated
entry; rerunning against the dirty settings file would report its local drift.

The first catalog-write attempt hit the Windows pipe Unicode limitation;
its Persian-script assertion rejected the in-memory data before any catalog
write. A UTF-8 file writer fixed it. Final key validation, rendering, typecheck
and lint use the corrected source/catalogs. A documentation patch failed its
context check without writing files and was reapplied with exact context.

## Review and limits

See [Codex self-review](LOC-091-review-1.md). This is self-review, not independent
peer/human/native/statutory approval. Persian terminology, LOC-067/008/002 parent
integration, complete RTL/calendar/numerals, mounted browser/keyboard, hosted CI,
deployment and production qualification remain separate. No schema, migration,
service/auth, monetary storage, provider, IRR flag or Stripe change was made.
The full unit suite and full payroll-parent integration were not run; focused
checks match this one-page slice. Commit/push and actual remote parity follow
controller closure and staged-snapshot checks.
