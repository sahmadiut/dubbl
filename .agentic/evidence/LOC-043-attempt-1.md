# LOC-043 attempt 1 - sales credit note catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Entry HEAD:
`63d4e8d35fcb9eb666caa82d9fb6e48d412b353d`. Entry working tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next/context selected LOC-043; started only that task as
coding-assistant. No subagents were used. LOC-025/007/002 and siblings retain
their independent work and acceptance.

Read root/.agentic instructions, START_HERE, controller, PROJECT/REPOSITORY_MAP,
frontend role, LOC-043/025, dependency context, catalog contract, LOC-042 scope
and evidence, locale source sections, current UI/money helpers, REST/MCP
contracts and existing integration fixtures. Applied the memory controller
skill for bounded scope, verification and authorized push. DEC-008 preserves
Stripe. No build, dev server, deployment or application database access.

## Acceptance mapping

1. Added 102 paired `CreditNotes` messages; catalogs contain 4,652 compatible
   keys per locale. Extracted the two credit note pages, owned CreditNoteDrawer
   copy and CreditNoteMoneyDetails. The typed presentation helper translates
   finite status codes and returns unknown codes as escaped data. Complete
   ownership and exceptions are in [scope](../registries/CREDIT_NOTE_CATALOGS.md).
2. Real React/next-intl/PresentationProvider rendering and original production
   callbacks verify both locales, plurals, hostile interpolation, exact saved
   money, canonical requests, invoice eligibility, negative reads, pagination,
   creation, application and cancellation. Existing wire/UI-money tests and
   real REST/MCP/SQL groups verify financial behavior. Details below.
3. Scope, task handoff, this evidence and honest self-review retain provisional
   Persian wording, shared-form ownership and independent parent/native/RTL
   acceptance. No parent or sibling criterion is checked by this task.

## Implementation and preserved contracts

Translated list title/columns, empty guidance, summaries, status tabs/tooltips,
filters, sorting, count and errors; detail loading/recipient/status/date/notes,
invoice application and cancellation copy; drawer fields, validation and
outcomes; exact-money headings and totals. Count uses ICU plurals. Existing
money strings, currency codes and date-only values are interpolated intact.

List/summary/detail/invoice reads, amount validation, create/apply/void failures
use reviewed localized fallbacks instead of arbitrary server, HTML, network or
parser prose. Creation validates a nonempty string credit-note ID before
success/close/navigation. Cancellation denial/network failure now gets a
translated outcome. Existing abort, organization/filter-context, active-instance
and load-more protections remain; prior rows survive pagination failure.

REST paths, headers, query values, status/filter/sort codes, drawer/document
types, CSS, navigation and page size 50 are preserved. Create retains the USD
default, explicit currency selector, nullable reference/notes, exact decimal
prices, stored quantity hundredths, extended-price rounding, 18 price fraction
digits and revenue/sales-tax context. Apply retains customer/currency/status/
positive-balance eligibility and exact bounds, sending `{invoiceId, amountMinor}`.
All nine existing credit-note MCP tools use shared org-scoped Drizzle services,
strict described schemas and wrapTool; no operation or route was added.

Explicit exceptions include caller content, names/codes, document numbers,
unknown statuses, illustrative INV/CN identifiers and USD examples, punctuation,
canonical dates, existing exact money format, quantity display and decimal input
grammar. Shared forms, pickers, footer internals, amount input, send dialog and
email history keep their separate ownership. Other drawers and every prior
message namespace were compared with HEAD and are unchanged, including Stripe.
There are no schema/migration, service, financial-unit, FX or IRR-flag changes.

## Actual verification

Commands ran in D:/Projects/dubbl. The DB tests used a fresh PostgreSQL 18
cluster in a random temporary directory, trust authentication bound only to
127.0.0.1 on an allocated port, with explicit TEST_DATABASE_URL. Fixtures
migrated and dropped random dubbl_ci_* databases. Cleanup SQL returned zero
fixture databases and pg_ctl stopped the cluster in finally. This is not
PostgreSQL 16 or production qualification.

| Check | Actual result |
|---|---|
| Focused catalog/UI-money/wire tests | Exit 0; 21/21 passed, no skips; 14.023 seconds |
| Full unit/static suite, concurrency 2 | Exit 0; 846/846 passed, no skips; 423.524 seconds |
| Credit lifecycle and UI-money REST/MCP/SQL | Exit 0; 2/2 groups passed, no skips; 81.478 seconds |
| Final pnpm typecheck | Exit 0 |
| pnpm i18n:check | Exit 0; 4,652 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero errors/warnings |
| pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Money inventory generation/verification | Exit 0; 417 columns, 2,242 scanned files, 1,681 consumer hashes and occurrence/source lines verified |
| Legacy money gate | Exit 0; nine regression checks passed |
| Ownership/source audit | Exit 0; earlier namespaces and all other drawers unchanged; 102 paired keys, Persian script and owned JSX/display attributes checked |
| Inventory diff audit | Exit 0; unchanged schema classifications; only owned consumers and new test refreshed |
| Controller validation | Exit 0; valid 292-task graph |
| Fetch/divergence before commit | Exit 0; HEAD versus origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/credit-note-catalogs.test.ts tests/credit-note-ui-money.test.ts tests/credit-wire.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/credits.test.ts tests/integration/credit-note-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two credit-note pages> components/dashboard/credit-note-money-details.tsx components/dashboard/create-drawer.tsx i18n/credit-note-presentation.ts tests/credit-note-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
git diff --check
```

The initial focused run passed 19/21: the harness selected the search effect
instead of summary and incorrectly expected a redundant numeric amount field.
Corrected those assertions to use the actual summary effect and canonical
amountMinor-only payload; production financial behavior was not changed.
Exploratory inventory assertions initially omitted catalog consumers and the
list's inferred invoice reference disappearing after copy extraction. The
final bounded audit accounts for these mechanical scanner results and passes;
schema classifications and financial policy are unchanged. Existing provider
tests in the full suite are ordinary regressions, not dedicated Stripe work.

## Review and handoff

See [honest self-review](LOC-043-review-1.md). Controlled component state,
navigation and portal boundaries do not establish mounted browser qualification.
Native Persian wording, RTL, date/numeral adapters, shared forms, independent
LOC-025/007/002 acceptance, live providers, hosted CI, deployment and production
IRR qualification remain open. No full build or dev server was run.

Finish controller disposition, commit only task-owned UI/catalog/helper/test,
scope/evidence/controller and mechanical inventory changes, push origin/master,
verify remote SHA and clean tree, then report next task and stop.
