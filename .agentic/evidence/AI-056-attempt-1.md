# AI-056 site-session AI usage reports and exports

## Identity and scope

2026-11-02 (Asia/Tehran), Codex, D:/Projects/a/dubbl, master. Entry HEAD
4fdb08c3; entry working tree was clean. Live controller selected AI-056 and
Codex claimed it. Implemented only this bounded child of AI-011. Memory was
used for the one-task/local-commit workflow; controller, instructions and source
were verified live. No delegation, push, build, dev server or deployment.

Read root instructions, START_HERE, controller context including project/map
and backend role, AI-056, AI-055 and its evidence/review, usage budgets/reports,
product-experience requirements, and actual usage, authorization, REST/MCP,
schema and test-fixture code. AI-011 retains its assembled acceptance.

## Implementation and acceptance mapping

1. Added separate site-session services in `lib/ai/site-usage.ts` and GET
   `/api/v1/admin/ai/usage` and `/api/v1/admin/ai/usage/export`. Extracted shared
   read-only aggregation from `lib/ai/usage-reports.ts`, retaining existing
   own/organization authorization and wire behavior. Site inputs add an optional
   organization UUID filter, omit caller-controlled scope, and preserve strict
   dates, user/provider/model/currency/price/state filters. Site grouping/sort
   starts with organization UUID. Full per-currency totals and exact strings
   are independent of the selected page. All-null and partially known token
   categories retain uncertainty; billing currencies are never combined.

   `lib/api/require-site-admin.ts` now exposes a server-bound site-session
   reference using the existing NextAuth/current-session/site-flag checks.
   WeakMap binding and a frozen context prevent fabricated references. No
   organization membership or dummy tenant is needed. Current expiry,
   session revocation and database site-admin flag are checked before queries
   and before disclosure. All Authorization headers are denied by the new
   site-only boundary, including alongside a valid admin cookie. Existing
   scoped API-key administration remains scoped. Site-only reads select only
   usage grouping/metric columns, never snapshots, transcripts or secrets.

   Reports use one read-only repeatable-read snapshot, 1..100 groups/page,
   positive UTC windows up to 93 days, and deterministic group pagination.
   Complete JSON exports accept at most 10000 groups and otherwise fail with
   413 without partial data or a success attachment header. Successful REST
   responses use private/no-store; export filename is ai-site-usage.json.

2. Added `get_ai_site_usage_page` and `export_ai_site_usage` in the registered
   `ai-site-usage` module. A separate `createSiteMcpServer`/`registerSiteTools`
   path registers exactly these operations. POST `/api/v1/admin/ai/mcp` uses
   stateless JSON MCP over the same current cookie-session boundary, rejects
   explicit cross-origin requests and grants no wildcard CORS or OAuth upgrade.
   Organization MCP servers never register the site operations. Tools use
   `wrapTool()` with a typed site context and consistent error serialization;
   organization wrapper behavior is preserved. Both tools call shared direct
   DB services. Updated actual capability/coverage inventories and explicitly
   excluded this module from automatic chat; the seven-tool allowlist is intact.

   `tests/integration/ai-site-usage.test.ts` and its worker exercise actual
   migrations, PostgreSQL queries, REST handlers, HTTP JSON MCP transport,
   linked MCP clients and database-backed identity checks. Cases include:
   a site admin without any organization membership; empty data; four pages
   across two organizations/currencies; full totals independent of page;
   complete exports; unknown/null categories; large exact token and cost sums;
   exact UUID/filter/date boundaries; invalid fields and pagination; foreign
   Origin; unauthenticated/non-admin/expired/revoked sessions; forged site
   contexts; valid API keys and OAuth tokens owned by a site admin still
   denied global access; ordinary org MCP discovery/calls denied site tools;
   no global override through own/organization REST; revoked existing MCP
   closures; and revocation after real SQL aggregation before disclosure on
   both REST operations, both linked tools and both HTTP MCP operations.
   Exactly 10000 groups export completely; 10001+ fails on REST/linked/HTTP
   MCP and narrowing by organization succeeds. Sentinel snapshots and
   out-of-window rows never appear. The USD cost total
   900719925474099300.000000000601 and token sum 9007199254741006 stay exact.

Contract details: [AI_USAGE_REPORTS](../docs/AI_USAGE_REPORTS.md).
No schema or migration change, financial mutation, provider call or Stripe edit.

## Verification

Created a new randomized dubbl-ai056-* temporary PostgreSQL 18 cluster on a
random loopback-only port, trust authentication. Tests used an explicit
TEST_DATABASE_URL with the existing create/drop-random-database fixture harness;
application DATABASE_URL and provider credentials were not used. Worker URLs
pointed only to fixture databases; provider calls were disabled. Only session
acquisition is stubbed; browser/JWT/login qualification is not claimed.

| Check executed from repository root | Actual result |
|---|---|
| Initial site/scoped report integration run | 2/2 passed |
| Combined regression command below | 18/18 passed in 42.4s; no failures/skips/cancellations |
| Final site/scoped report integration after final source edit | 2/2 passed in 16.6s |
| node node_modules/typescript/bin/tsc --noEmit | Final passed, exit 0 |
| npm run lint | Passed, zero errors and 20 existing warnings |
| ESLint on all 13 owned TS/MJS files | Passed, no warnings |
| node scripts/audit-ai-capabilities.mjs | Passed: 111 modules, 829 tools, 592 routes, 210 pages |
| node --import tsx scripts/audit-ai-tool-coverage.mjs | Passed: seven reviewed tools, 822 unlisted; site module excluded |
| node .agentic/scripts/verify_legacy_money.mjs | Passed all nine checks |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 1; 1447 stale inventory diagnostics; not a green gate |
| Current/HEAD money-inventory comparison using Node subprocess/TS-source overlays | Both exit 1 with 1447 diagnostics; stale line references differ as described below |
| python .agentic/agent.py validate; git diff --check | Passed |

Combined regression command:

```text
node --import tsx --test --test-concurrency=1 tests/integration/ai-site-usage.test.ts tests/integration/ai-usage-reports.test.ts tests/integration/ai-usage.test.ts tests/integration/ai-tool-registry.test.ts tests/integration/opaque-admin.test.ts tests/money-wire.test.ts
```

This covers five disposable-database tests and thirteen wire/adapter tests,
including existing global site-admin handlers, scoped opaque API/MCP forwarding,
usage budgets/reconciliation and reviewed tool dispatch. Initial typecheck caught
a required fixture defaultModel and backward compatibility for explicitly
supplied wrapTool type parameters; both were corrected before passing checks.

Money diagnostics are not ordered-identical to HEAD. The exact set comparison
adds `Pattern mismatch: lib/mcp/tools/index.ts:200 (money_name)` and removes
`Pattern mismatch: lib/mcp/errors.ts:33 (wire)` because edits move lines in
these already-stale registered consumers. Other diagnostics match. No money
inventory file was rewritten or baseline equality claimed; the 1447-diagnostic
gate remains open. New functionality performs no financial calculation beyond
the previously tested exact usage aggregation and preserves legacy serialization.

Final SQL inspection found zero dubbl_ci_* databases. Stopped only the owned
cluster with pg_ctl; status reported no server running (expected exit 1).
Stopped temporary files remain for local diagnosis. No shared service stopped.

## Review and handoff

Codex self-review is in AI-056-review-1.md; no independent human/peer review.
No UI/catalog changes, so rendered bilingual/native Persian checks do not apply
to this backend child. AI-057 price/budget forms are next; AI-058/059 and AI-011
assembled acceptance remain open. No live-provider, production authentication,
performance/deployment qualification or rollout activation is claimed. Site MCP
is a same-origin session integration, not an external OAuth client service.
