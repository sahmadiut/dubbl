# LOC-042 attempt 1: cash sale catalogs

Date: 2026-10-18. Implementer: coding-assistant (Codex). Scope: LOC-042 only,
one bounded LOC-025 child. Controller selected this task on clean master with
292 structurally valid tasks. LOC-025/007/002 retain independent acceptance.

## Implementation and contracts

Added 86 paired SalesReceipts and six paired ReceiptAttachments messages,
reaching 4,550 compatible keys per locale. See the complete
[source/exception inventory](../registries/SALES_RECEIPT_CATALOGS.md).

Extracted receipt list/detail, SalesReceiptDrawer, exact-money detail labels and
shared ReceiptAttachments copy. Table/status/filter labels, examples, count
plurals, placeholders, validation and creation/read/pagination/attachment errors
use the active translator. Status display uses finite typed keys and an
own-property check; unknown codes and caller data remain escaped data. Count
sentences use real ICU plural handling in both locales.

Creation suppresses raw service/parser prose and rejects missing/empty result
IDs before success/navigation. Attachment list/download reject failed HTTP
responses; load failures retain prior files and delete failure restores the
optimistically removed file. Detail retries clear prior errors before fetching.

No monetary logic, REST/MCP service, schema/migration, persisted unit, FX or IRR
flag changed. Existing canonical request/query/status values, org headers,
currency fallback and explicit override, exact line prices, extended-price
rounding, fractional quantities, paid-only currency-grouped bigint collection,
bank destination, nullable notes/reference and date strings are preserved.
Registered receipt MCP tools and entity attachment tools remain unchanged.
Other drawers and all previous namespaces, including Stripe, were compared to
HEAD and are unchanged under DEC-008. Shared forms remain LOC-047 ownership.

## Actual verification

Commands ran in D:/Projects/dubbl. No full build, dev server, deployment,
provider request or application database access was used. Integration used a
fresh PostgreSQL 18 cluster in a randomized temporary directory with trust
authentication bound only to 127.0.0.1 on an allocated free port and explicit
TEST_DATABASE_URL. Fixtures migrated and dropped random dubbl_ci_* databases.
The cleanup query returned zero fixture databases and pg_ctl stopped the
isolated cluster in finally. This is not PostgreSQL 16/production qualification.

| Check | Actual result |
|---|---|
| Focused receipt catalog/UI-money/wire tests | Exit 0; 21/21 passed, no skips; 7.263 seconds |
| Full unit/static suite, concurrency 4 | Exit 0; 835/835 passed, no skips; 83.076 seconds |
| Receipt and receipt UI-money REST/MCP/SQL | Exit 0; 2/2 groups passed, no skips; 22.007 seconds |
| pnpm typecheck | Exit 0 |
| pnpm i18n:check | Exit 0; 4,550 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero warnings/errors |
| pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Money inventory generation/verification | Exit 0; 417 columns, 2,240 scanned files, 1,680 consumer hashes and occurrence/source lines verified |
| Legacy money gate | Exit 0; nine regression checks passed |
| Source/ownership audit | Exit 0; previous namespaces and other drawer code unchanged; 92 paired keys; Persian-script/owned JSX/attributes checked by tests |
| Controller validation | Exit 0; valid 292-task graph |
| Fetch/divergence before commit | Exit 0; HEAD versus origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/sales-receipt-catalogs.test.ts tests/sales-receipt-ui-money.test.ts tests/sales-receipt-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/sales-receipts.test.ts tests/integration/sales-receipt-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two receipt pages> components/dashboard/sales-receipt-money-details.tsx components/dashboard/receipt-attachments.tsx components/dashboard/create-drawer.tsx i18n/sales-receipt-presentation.ts tests/sales-receipt-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
git diff --check
```

The initial focused run passed 20/21 tests. The drawer test incorrectly expected
the date placeholder while the real DatePicker contained a date. Rendering an
empty controlled date fixed the harness expectation; final focused/full suites
pass. No production behavior was changed for that test. Inventory changes are
mechanical file/hash/line updates; financial classifications/policy are unchanged.
Existing provider tests are ordinary regressions, not dedicated Stripe work.

## Handoff and limitations

See [honest self-review](LOC-042-review-1.md). Tests execute production component
and callback syntax with controlled state/navigation/portal boundaries; they do
not constitute mounted browser qualification. Persian financial wording remains
provisional. Independent parent acceptance, shared forms, native/RTL,
date/numeral adapters, live providers, hosted CI, deployment and production IRR
qualification remain open. No other child/parent is completed here.

Finish controller disposition, commit task-owned code/catalogs/tests,
scope/evidence/controller and mechanical inventory refresh, push origin/master,
verify remote SHA and clean tree, report the next controller task and stop.
