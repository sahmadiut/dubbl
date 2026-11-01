# AI-055 filtered usage reports and complete exports

## Identity and scope

2026-11-01 (Asia/Tehran), Codex, D:/Projects/a/dubbl, master. Entry HEAD
8e34d269; entry tree was clean. Controller selected AI-011. Actual source
inspection established missing pagination/filter/export services and separate
site-session, form, quota/operations and UI obligations. Created required
AI-055..059 children and split AI-011 using the controller; its original criteria
remain unchecked for independent combined acceptance. Implemented only AI-055.
No delegation, push, build, dev server, deployment or activation.

Read root/nested instructions, START_HERE, controller, project/map/frontend/backend
role guidance, AI-011, product-experience and usage contracts and current
AI-005 reporting, REST/MCP, identity and fixture services. Memory supplied the
one-task/local-commit workflow; task and Git state were verified live.

## Implementation and acceptance mapping

1. `lib/ai/usage-reports.ts` adds strict own/organization reporting with
   date/user/provider/model/currency/price/state filters. Current credential,
   membership and role are re-resolved before queries and before disclosure.
   Own scope rejects another user. Organization predicates always bind every
   attempt, including filters referencing foreign users/prices/providers. No
   site scope or organization-ID query override exists; no transcript access.

2. SQL groups by user/provider/model/currency/immutable price version. Stable
   ordering, 1..100 groups/page, exact group counts, `hasNextPage`, and full
   filtered per-currency totals are independent of the selected page. Count,
   totals and groups use a read-only repeatable-read snapshot per request;
   independent page/export requests observe fresh data. Count/token strings,
   numeric SQL sums and BigInt decimal formatting preserve values above 2^53.
   Reserved/in-flight/unknown/settled/cancelled counts and estimated held,
   unresolved and settled costs stay distinct. All-null category sums stay
   null, partial sums carry category-specific unknown counts. Cached/reasoning
   are subsets and must not be counted twice. No currency conversion occurs.

3. New GET `/api/v1/ai/usage/report` and `/api/v1/ai/usage/export`, plus registered
   `get_ai_usage_page` and `export_ai_usage`, call the same direct-DB services.
   Exports reject pagination and return complete matching JSON up to 10000
   groups; larger exports fail with 413 and require narrower filters. REST
   success has private/no-store headers and a fixed attachment name for export.
   Existing `/usage` and `get_ai_usage` remain intact. Only the pre-existing
   test's expected registered-tool count changed from five to seven. Refreshed
   actual capability/coverage registries: both new tools remain outside the
   seven-tool automatic chat catalog. No metadata snapshots or secrets selected.

4. `tests/integration/ai-usage-reports.test.ts` and its worker exercise actual
   migrations, SQL data, REST handlers, linked MCP SDK and live authorization.
   Cases include empty data, five single-group pages, a page beyond the last,
   identical full totals/export groups, exact date boundaries, two currencies,
   immutable versions, every attempt state, all-null and partial observations,
   UUID normalization, combined filters, invalid input, own/organization/foreign
   scope, unauthenticated access, custom-role revocation and membership removal.
   Exact 10000-group export succeeds; 10001 matching groups fails without a
   partial export on both transports; narrowing filters succeeds. A large cost
   `900719925474099300.000000000800` and input sum `9007199254741003` remain exact.
   Sentinel metadata and foreign/out-of-period rows never appear in exports.

Contract: [AI_USAGE_REPORTS](../docs/AI_USAGE_REPORTS.md). Source coverage/index
link all children and preserve parent acceptance. No schema/migration change.

## Fixture and verification

Created a new randomized `dubbl-ai055-*` temporary PostgreSQL 18 cluster, trust
authenticated only on 127.0.0.1 with a random ephemeral port. Set an explicit
loopback TEST_DATABASE_URL for the existing fixture harness, which creates/drops
random per-test databases. Never used application DATABASE_URL or provider
credentials for tests; child workers receive fixture URLs and provider calls
are disabled. Authentication session acquisition is stubbed; current SQL
membership, role and credential checks are real. No live provider was called.

| Executed check | Actual result |
|---|---|
| Focused reports/usage/tool-registry integration command | Initial 3/3 passed in 16.5s |
| Final combined command below | 5/5 passed in 33.0s; zero failures/skips/cancellations |
| node node_modules/typescript/bin/tsc --noEmit | Passed after correcting transaction access-mode option and fixture union narrowing |
| npm run lint | Passed: zero errors, 20 existing warnings |
| ESLint on all seven owned TypeScript files | Passed without warnings |
| node scripts/audit-ai-capabilities.mjs | Passed: 110 modules, 827 tools, 589 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed automatic tools, 820 unlisted |
| node .agentic/scripts/verify_legacy_money.mjs | Passed nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1; 1447 existing diagnostics, not a green gate |
| Current/HEAD money comparison using Node stdin subprocesses | Exact ordered stderr matches; both exit 1, 1447 diagnostics |
| python .agentic/agent.py validate; git diff --check | Passed |

Final combined command:

```text
node --import tsx --test --test-concurrency=1 tests/integration/ai-usage-reports.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-tool-registry.test.ts tests/integration/ai-provider-attempts.test.ts
```

The HEAD money comparison ran the verifier twice with spawnSync, once normally
and once with readFileSync overlays for tracked changed paths from `git show
HEAD:path`, and compared normalized ordered stderr exactly. No money registry
was rewritten to hide diagnostics. PowerShell adds native-error wrapper lines
to redirected stderr; raw Node subprocess stderr, rather than wrapper line
count, establishes the unchanged baseline.

Final SQL inspection found zero `dubbl_ci_*` databases. pg_ctl stopped the
owned cluster and status reported no server running. Stopped temporary files
remain for local diagnosis; no shared database or service was stopped.

## Review and handoff

Codex self-review is recorded separately in AI-055-review-1.md. No independent
human or native-language review is claimed. No UI/catalog changes were made,
so bilingual component interaction and catalog validation do not apply to this
backend slice. Site-session aggregates, quota/operational services, forms and
bilingual UI belong to AI-056..059. AI-011 retains independent assembled
acceptance. Provider/worker production behavior, deployment and activation
remain separate gates. Next controller task should be AI-056; do not start it
within this one-task continuation.
