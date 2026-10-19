# LOC-055 attempt 1 - Landed cost catalogs

2026-10-19 (Asia/Tehran), Codex. Live controller selected this bounded purchasing
child from clean master at `331129fc` (LOC-054). LOC-026/007/002 retain independent
integration acceptance. No unrelated changes existed at entry.

## Implementation and acceptance mapping

1. Extracted all authored copy in both landed-cost pages and the inline creation
   form into 62 paired LandedCosts messages. Titles, tables, statuses/methods,
   component controls, loading/read/empty/not-found states, reference/amount
   summaries, validation and operation outcomes use typed keys. See
   [scope and explicit exceptions](../registries/LANDED_COST_CATALOGS.md).
2. Real bilingual production rendering and original-callback tests verify exact
   amounts, escaped caller data, option/status codes, requests, editing/defaults,
   failure localization and preservation of failed forms. Existing migrated
   PostgreSQL workers independently exercise real REST/registered MCP/SQL landed
   cost behavior and procurement money contracts. Executed checks appear below.
3. The registry, this evidence and task Handoff record provisional Persian wording
   and independent parent/native/RTL acceptance. Honest self-review is separate.

Reads now check HTTP and basic envelopes, preserve existing state on failure and
display a translated fallback. Errors use finite reviewed messages without raw
server/parser/HTTP/JSON prose. Creation validates saved identity before resetting
or closing, allocation validates requested identity/status, and deletion validates
success. No general runtime row schema or stale-read redesign is claimed.

The existing exact amount parser, two-decimal input semantics, saved bigint money
display, raw allocation bases, dates, IDs, nullable fields, methods, organization
headers, source routes and bodyless lifecycle requests remain unchanged. Existing
org-scoped direct-DB MCP tools cover all current operations. No financial service,
REST/MCP, schema, migration, FX, worker, IRR flag or Stripe code changed.

## Executed verification

All commands ran from D:/Projects/dubbl with installed dependencies.

| Gate | Actual result |
|---|---|
| `node --import tsx --test tests/landed-cost-catalogs.test.ts` | 6/6 passed; no skips |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 945/945 passed; zero failures/skips |
| `pnpm typecheck` | Passed |
| `pnpm i18n:check` | Passed; 5,776 compatible keys per locale |
| Changed-file ESLint over both routes, helper and focused test | Passed; zero errors/warnings |
| `pnpm lint` | Passed; zero errors, 68 warnings in unchanged files |
| Disposable migrated PostgreSQL tests below | 3/3 passed; no skips |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned source/consumer metadata |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed; 417 columns, 1,697 consumer hashes |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| JSON comparison against HEAD | Existing catalog namespaces and all 417 financial column policies unchanged; consumer differences limited to owned routes/helper/catalogs/test |
| `python .agentic/agent.py validate` | Passed; 292 structurally valid tasks |
| `git diff --check` | Passed |

Integration command with explicit loopback TEST_DATABASE_URL:

```text
node --import tsx --test --test-concurrency=1 tests/integration/inventory-valuation.test.ts tests/integration/procurement-ui-money.test.ts
```

A new temporary PostgreSQL 18 trust-auth cluster ran on 127.0.0.1:55455. Fixtures
created, migrated and dropped randomized databases. All real REST/registered MCP/
SQL workers passed, including landed-cost/FIFO and historical migration checks.
The server stopped cleanly. No application database or .env credentials were used.

## Review and handoff limits

See [self-review](LOC-055-review-1.md). Controlled production rendering/callbacks
do not qualify mounted-browser, fonts or complete RTL layout. Persian financial
wording remains provisional. LOC-026/007/002, shared purchasing navigation/forms
(LOC-056), native/RTL acceptance, hosted CI, deployment and production IRR
qualification remain independent. No full build, dev server, provider request or
deployment ran. Stripe remains unchanged under DEC-008; routine full-suite tests
are not dedicated provider work.

Complete evidence/review/done and the authorized scoped commit/push, verify
origin/master SHA and clean tree, report the live next task and stop.
