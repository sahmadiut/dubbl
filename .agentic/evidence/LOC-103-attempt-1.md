# LOC-103 attempt 1

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Clean entry tree at
ae69c14a, one local commit ahead of origin/master: the owner's already-committed
toast-font fix. The owner requested the next task completed and pushed; that
existing commit remains intact and will be included in the branch push.

Controller selected LOC-070. Source inspection found 34 report TSX components,
including the 286-line directory and 90-line shared primitives. Split LOC-070
into LOC-103..114 using the controller after writing/validating the children.
Index/source traceability and parent handoff retain independent combined
acceptance. A one-off source inventory checked all 34 components are assigned
exactly once; no child depends on its parent. Later slices depend on LOC-103.
Controller then selected and started LOC-103; only that child is completed here.

## Acceptance mapping

1. Added 73 ReportDirectory and six ReportNavigation paired messages: document
   title, seven categories/descriptions, all 29 report cards/descriptions, shared
   back link and cash/accrual prompt/labels/tooltips. Loading remains delegated
   to BrandLoader; ReportHelp preserves escaped caller-supplied content.
   Existing catalog namespaces and original English directory copy are unchanged.
   [Scope registry](../registries/REPORT_DIRECTORY_CATALOGS.md) inventories
   ownership, exceptions, provisional Persian wording and every remaining slice.
2. Four production JSX tests render both locales through real next-intl and
   PresentationProvider, Link, Section, Button and tooltip controls. Tests check
   all hrefs/order/categories/copy, document title, selected-button behavior,
   exact accrual/cash callback values, tooltip props, caller escaping, shared
   loading accessible name and source/Persian-script assertions. Relevant
   migrated REST/linked MCP/independent SQL report fixtures pass. No monetary,
   basis, date, API/tool/query, export, auth or organization contracts change.
3. Task handoff, combined reporting split/ownership registry, message registry,
   this evidence and honest self-review retain LOC-104..114 and independent
   LOC-070/008/002/native/RTL/output/release acceptance. No parent criterion is
   checked. Persian financial terminology remains provisional.

## Implementation and preserved behavior

Typed finite translation keys replace report title/description literals in the
directory. All 29 routes, icons, category membership and ordering are preserved.
The shared basis toggle retains input/output values accrual/cash and selected
styling. Tooltip copy is asserted in production props because its portal is
closed during SSR. This is controlled-effect rendering, not browser interaction.

This slice introduces no data operation and requires no new MCP tool. Existing
report services/tools retain direct scoped DB access through AuthContext and
wrapTool. No service, REST/MCP schema, exported header/data/template, DB schema/
migration, money/FX, ledger, authorization, currency/IRR flag or Stripe source
changes. The pre-existing toast fix is a separate earlier commit.

## Actual verification

Commands ran from the repository root. No full build or dev server ran.

| Command / procedure | Observed result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/report-directory-catalogs.test.ts tests/financial-statement-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | Final 32/32 pass, zero skips; 5.516 seconds |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/financial-statement-ui.test.ts tests/integration/report-dashboard-integration.test.ts | 2/2 pass, zero skips; 29.615 seconds |
| pnpm typecheck | Pass; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass; 8,854 compatible leaves per locale |
| pnpm exec eslint on the directory, shared components and new test | Pass; no findings |
| pnpm lint | Pass; zero errors, 24 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns, 2,429 scanned files and 1,820 checked consumer hashes/lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Compare existing catalog namespaces, directory copy and inventory metadata with HEAD | Existing messages and English copy unchanged; schema metadata unchanged; five changed consumer paths all task-owned |
| One-off split coverage check | 34 current TSX components assigned once across 12 children |
| python .agentic/agent.py validate; git diff --check | Final pass; 341 structurally valid tasks |

The PostgreSQL 18 cluster used a unique OS-temp directory, loopback
127.0.0.1:6473, trust auth and max_locks_per_transaction=256. Fixtures migrated
randomized dubbl_ci_* databases and dropped them. The final admin query found
zero remaining fixture databases; pg_ctl stopped the cluster. Application
.env/database credentials were unused.

An initial five-test run passed. The planning-only controller-state assertion
was removed from permanent product tests to avoid coupling them to future task
completion; the one-off coverage check retained the planning evidence. The final
four product tests and full focused command above pass. Diff checking found
extra EOF blank lines in two planning documents; these were removed before
final verification. No unresolved test failure remains.

## Review and handoff

See [Codex self-review](LOC-103-review-1.md). Next is LOC-104, income and executive
report catalogs. LOC-070 remains queued for independent combined acceptance after
its children; LOC-008/002 are also open. No full unit/integration suite, native
linguistic/full RTL/calendar/numerals/browser, hosted CI, adjacent output,
provider, deployment or production qualification is claimed. Commit/push and
remote parity are confirmed separately after controller closure.
