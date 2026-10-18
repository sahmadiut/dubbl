# LOC-034 attempt 1 - asset-category catalogs and owner font changes

Date: 2026-10-18 (Asia/Tehran). Implementer: Codex.

## Task selection and acceptance

Entry tree was clean on master. Controller validate/status/next selected LOC-024.
Inspection found 11 route TSX files totaling 5,185 lines plus four creation
drawers. Split into LOC-034..038 and started exactly one implementation child,
LOC-034. LOC-024/007/002 retain independent combined acceptance; child completion
does not complete any parent. Scope and explicit exceptions are recorded in
[asset-category inventory](../registries/ASSET_CATEGORY_CATALOGS.md).

1. Added 68 paired messages in AssetCategories (57) and AssetCategoryErrors (11).
   All authored copy in the owned route is catalog-backed: headings, titles,
   descriptions, empty states, table/dialog controls, methods/conventions,
   guidance, status, accessible edit labels and validation/request errors.
   Persian financial wording is provisional. Caller data and machine values are
   preserved. Existing namespaces remain identical except the owner's explicit
   font-preference additions (13 keys), bringing each catalog to 2,784 messages.
2. Real production template rendering and actual loader/save/edit-initialization
   callback checks pass in both locales. Tests cover canonical codes, exact low
   digits, null/default behavior, account IDs, org scope, POST/PATCH payloads,
   malformed money aliases/response shapes, translated local and request errors,
   unknown/prototype/network/HTML/JSON failures, stale read-error clearing,
   saving flags, stay-open failures and escaped caller content. Existing asset
   money/wire checks retain financial assertions; their source guard follows the
   new category presentation helper into the unchanged assetLoanJson validator.
3. Inventory, task handoff and honest self-review document provisional Persian,
   explicit formatting exceptions and independent native/RTL/parent acceptance.
   No asset REST/MCP/service/schema or money helper change was needed. Existing
   list/get/create/update/delete asset-category tools supply the same operations.

## Owner-authorized combined commit

During execution the owner explicitly requested committing all files, including
their concurrent font improvements. Included without attributing those edits to
LOC-034: font selector/previews, locale resolution/schema and persistence,
REST/MCP preference exposure, nullable users.font_family migration 0014 and
snapshot/journal, settings styling and local font assets. The Estedad asset was
copied from the exact Desktop file supplied by the owner into the referenced
public/fonts/Estedad-VF.woff2 path. All five local CSS font URLs resolve to files.

Added necessary tests/fixture updates for the font field: strict supported values,
independence from language, null clearing, malformed saved fallback, REST/MCP/SQL
persistence and server presentation resolution. Historical migration checks
exclude only the new nullable font column from original-field row hashes and
assert it is nullable, default-free and null for legacy rows. Snapshot comparison
confirms only this single column was added. Drizzle generate reports no further
schema changes. This does not close any additional controller task.

## Actual verification

All commands ran in D:/Projects/dubbl. Application databases were not read or
mutated. Integration fixtures used explicit TEST_DATABASE_URL on a newly
initialized PostgreSQL 18 cluster bound to 127.0.0.1 with randomized disposable
database names, then dropped their databases and stopped the cluster.

| Check | Actual result |
|---|---|
| Controller validation, split and start | Exit 0; valid 265-task graph |
| Category/money/wire focused suite | Exit 0; 16/16 passed; 2.078 seconds |
| Combined focused locale/catalog/category/money/wire suite | Exit 0; 34/34 passed; 2.881 seconds |
| Final full unit suite | Exit 0; 701/701 passed; no failures/skips; 50.322 seconds |
| Locale preference + migration integration suite | Final exit 0; 5/5 passed; no failures/skips; 34.616 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx + tsc --noEmit, including combined font changes |
| pnpm i18n:check | Exit 0; 2,784 compatible keys per locale |
| Changed-file ESLint, including font and fixture changes | Exit 0; no errors/warnings |
| pnpm lint | Exit 0; zero errors, 75 existing warnings |
| pnpm exec drizzle-kit generate | Exit 0; no schema changes, nothing further to migrate |
| Money inventory generation/verification | Final exit 0 after removing temporary audit script; 417 columns, 2,210 scanned files, 1,654 consumer hashes and occurrence lines verified |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog/font/snapshot ownership audit | Exit 0; no unextracted authored JSX/display attributes except documented 0.00 sample; old namespaces preserved; all paired Persian entries contain Persian script; font assets present; single nullable migration; Stripe paths untouched |
| Fetch and divergence before commit | Exit 0; HEAD and origin/master were 0 ahead/0 behind |
| Controller, local links and diff checks | Exit 0; valid 265-task graph; 458 local links across 11 changed documents; clean diff |

Commands:

```text
node --import tsx --test --test-concurrency=2 tests/asset-category-catalogs.test.ts tests/asset-loan-ui-money.test.ts tests/asset-master-wire.test.ts
node --import tsx --test --test-concurrency=2 tests/locale.test.ts tests/message-catalogs.test.ts tests/asset-category-catalogs.test.ts tests/asset-loan-ui-money.test.ts tests/asset-master-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/locale-preferences.test.ts tests/integration/money-bigint.test.ts
pnpm typecheck
pnpm i18n:check
pnpm lint
pnpm exec drizzle-kit generate
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
```

Integration commands set explicit TEST_DATABASE_URL and matching PostgreSQL 18
PG_BIN in process scope. General test suites include unchanged existing Stripe
checks; no dedicated Stripe work was performed. No full build, dev server,
provider call, Docker, browser, deployment or application migration was run.

Intermediate focused failures were a missing test bracket, a stale source guard
that required a direct assetLoanJson call, duplicate ESM/CommonJS next-intl context
in the rendering harness, and HTML escaping assertion order. These were corrected
without dropping financial assertions, then the full/focused suites passed.
The first migration integration run passed four checks but failed pg_dump client
discovery. Setting matching PG_BIN allowed a fresh full 5/5 pass, including backup
restore. No intermediate failure is represented as a passing check. Final source
and fixtures were covered by repeated static/full checks. Temporary extraction
and source-audit scripts are removed before commit.

## Review and delivery boundary

See [honest self-review](LOC-034-review-1.md). Rendering/callback checks use
controlled state/network/portal boundaries; these are not browser interaction or
asset live REST/MCP/SQL acceptance. Font preference REST/MCP/SQL and migration
fixtures did run on the disposable cluster. Native Persian, complete RTL/font/
layout, hosted CI, production providers/deployment and IRR qualification remain
independent. Stripe functionality/files are preserved under DEC-008.

Complete controller checks, submit, self-review and done. Commit all authorized
working files, including owner font/settings edits, push origin/master, verify
remote SHA and clean tree, report live next task and stop.
