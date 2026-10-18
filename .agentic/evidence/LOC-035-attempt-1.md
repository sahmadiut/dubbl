# LOC-035 attempt 1 - fixed asset catalogs

Date: 2026-10-18 (Asia/Tehran). Implementer: Codex.

## Selection and scope

Controller validate/status/next selected LOC-035 for resume on master. The only
entry working-tree change was its existing in-progress/owner/history metadata;
it is retained in this task's completion. Exactly one bounded child is completed.
LOC-024/007/002 and sibling tasks retain independent acceptance. Stripe is
unchanged under DEC-008.

## Acceptance evidence

1. Added 176 paired `FixedAssets` messages (3,776 total keys per locale).
   List/detail, creation drawer, depreciation/rollback, capitalization, CWIP,
   impairment, revaluation and disposal copy, confirmations, previews and errors
   use catalogs. Full sentences and ICU plurals handle counts, months and
   interpolated amounts. [Inventory](../registries/FIXED_ASSET_CATALOGS.md) records
   explicit exceptions. Persian wording is provisional pending native review.
2. Real production templates render under PresentationProvider in both locales.
   Actual production callbacks preserve methods, routes, organization headers,
   exact Minor strings, codes, nulls, optional fields, confirmations and redirects.
   Failure coverage includes HTTP, network, HTML/JSON, malformed shapes, corrupt
   money aliases, input ranges, cancelled reads/confirmations, absent organization,
   saving flags, stay-open dialogs and escaped caller content. Exact-money guards
   continue through unchanged assetLoanJson; aggregate calculations remain bigint.
   HTTP errors use reviewed status or operation fallbacks; unknown prose is hidden.
   CWIP read errors surface; stale effects are ignored and creation cannot leave
   saving active when no organization exists.
3. Inventory, handoff and honest self-review record native/RTL/browser/parent
   boundaries. Existing catalogs and unrelated drawer bodies were compared against
   HEAD and are identical. No REST/MCP, service, money adapter, schema or migration
   changes were needed. Existing asset tools cover the unchanged operations.

## Actual verification

All commands ran in D:/Projects/dubbl. Integration fixtures used explicit
TEST_DATABASE_URL on a newly initialized PostgreSQL 18 cluster bound to 127.0.0.1,
with randomized disposable databases created/dropped by the fixtures. The cluster
was stopped after the suite. No application database was used.

| Check | Result |
|---|---|
| Focused catalog/money/wire suite | 18/18 passed, no skips; 6.796 seconds |
| Full unit/static suite | 781/781 passed, no skips; 79.578 seconds |
| Existing asset-master/depreciation/CWIP/valuation/combined asset-loan REST/MCP integrations | 5/5 passed, no skips; 56.961 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 3,776 compatible keys per locale |
| Changed-file ESLint | Exit 0; no warnings/errors in owned sources/tests |
| Final pnpm lint | Exit 0; zero errors, 72 existing warnings outside owned files |
| Money inventory generation/verification | Exit 0; 417 columns, 2,227 scanned files, 1,669 consumer hashes and all occurrence/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog ownership audit | Exit 0; explicit display exceptions only, every paired Persian message contains Persian script, existing namespaces and unrelated drawers unchanged |
| Pre-commit fetch/divergence | Exit 0; master and origin/master 0 ahead/0 behind |
| Controller, local links and diff checks | Exit 0 after evidence and handoff were written |

Commands:

```text
node --import tsx --test --test-concurrency=2 tests/fixed-asset-catalogs.test.ts tests/asset-loan-ui-money.test.ts tests/asset-master-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/asset-master.test.ts tests/integration/asset-depreciation.test.ts tests/integration/asset-cwip.test.ts tests/integration/asset-valuation.test.ts tests/integration/asset-loan-integration.test.ts
pnpm typecheck
pnpm i18n:check
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Intermediate failures: the first detail render harness discarded tooltip
attributes; forwarding the actual title fixed the assertion. An initial lint run
overlapped temporary-script removal and failed with ENOENT; the complete rerun
passed after cleanup. Final focused and full suites passed.

No full build, dev server, mounted browser check, hosted CI wait, deployment or
production qualification was performed. Rendering tests inline portals and
control hook state; they are not interactive browser acceptance. Native Persian,
RTL and independent LOC-024/007/002 acceptance remain open.
