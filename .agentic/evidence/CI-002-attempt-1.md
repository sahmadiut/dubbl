# CI-002 attempt 1: architecture and functional-currency rollout

## Identity

2026-10-02 (Asia/Tehran), coding-assistant. Entry HEAD 851c4a8, clean working tree. One task selected/claimed with the controller after reading root/.agentic instructions, START_HERE, CONTROLLER, PROJECT, REPOSITORY_MAP, lead role, CI-001 dependency evidence, currency registry, release gates and relevant plan sections. Changes are uncommitted; no peer/human approval claimed.

## Implementation

- ADR-002 records retained Dubbl runtime, exact bigint minor-unit target, decimal FX direction/provenance, staged migration and versioned wire compatibility. Rounding, precision and compatibility-window decisions remain with later tasks/actual owners.
- ADR-003 records unchanged URL strategy, independent locale/currency/calendar/timezone, historical currency regimes and the actual functional-currency gate. No next-intl installation, schema change or invented official currency fact.
- lib/currency/rollout.ts: code financial readiness false; server IRR_PRODUCTION_ENABLED defaults false, exact true/false validation, premature true rejected. No runtime/owner/client environment override can pass the financial gate.
- lib/db/index.ts validates configuration before pool creation for DB-backed server consumers. lib/currency/functional-currency.ts supplies shared normalized ISO schema and rollout assertion. Organization REST PATCH uses it before any setting write and maps gate errors to 403.
- lib/mcp/tools/organization.ts adds set_organization_currency, using shared validation, manage:billing, ctx.organizationId-scoped direct DB access, journal-activity immutability and audit. Already registered organization tool module remains in index.ts. wrapTool and REST shared error mapping surface CurrencyRolloutError as 403.
- .env.example documents the disabled request flag; CURRENCY_REGIMES and RELEASE_GATES link the policy and retain pending financial gates.

Inspected actual currency schema/ISO helpers, organization route (POST accepts only name/slug, USD schema default), admin organization routes (subscription-only updates), seed (USD), auth context/role and audit helpers, converter and money code, MCP registration/errors. No other application organization.defaultCurrency writer found by rg. Existing immutability checks are retained; concurrent first posting/currency changes were not qualified by this task.

## Acceptance mapping

1. Dubbl runtime and dependencies preserved, no Bigcapital implementation/runtime transplant; ADR-002/003 document concrete existing paths and staged target boundaries.
2. Organization functional IRR selection remains disabled, with code-owned false readiness independent of tracker/environment; REST/MCP share validation, startup rejects premature true. No IRR enablement or data rewrite occurred.
3. tests/currency-rollout.test.ts supplies six regression cases: runtime/default matrix and normalized IRR rejection; operator/client/financial environment bypass attempts; malformed flags; shared schema normalization/ISO validation; real DB-module startup failure before connection; actual MCP tool handler gate and permission errors before any DB write.

## Verification

All commands from D:/Projects/dubbl with installed dependencies, local Node 23.11.0/pnpm 10.30.3. No DB fixtures needed: startup test uses unreachable synthetic URL; MCP negative paths terminate before queries.

| Command / procedure | Actual result | Limitation |
|---|---|---|
| controller validate/status/context/start | Exit 0, valid 60 tasks, CI-002 selected/claimed | Structural workflow only |
| pnpm test, final | Exit 0, 50 passed, 0 failed/skipped | Existing 44 plus six new; no successful DB-backed currency change qualified |
| pnpm typecheck, final | Exit 0 | Earlier extra MCP test used unsupported viewer role; corrected to actual member role after TS2322, rerun passed |
| pnpm lint | Exit 0, 0 errors, 167 existing warnings | Baseline warning count unchanged |
| pnpm exec eslint on eight changed TS files | Exit 0, no warnings | Final subsequent edit only corrects test role literal |
| Inline Python local ADR link/heading validation | Exit 0, seven links/anchors verified | Local documents only; no current official currency/provider facts claimed |
| git diff --check | Exit 0 | LF/CRLF notices only |
| source/diff self-review | No task-blocking issue found | Same implementing assistant, not independent review |

Full builds, dev startup, Docker, hosted CI, deployment, production migration and external provider calls were not run. No schema changes, so Drizzle generation is not applicable. No credentials read/printed. No monetary scale, legacy v1 serialization or posted value changed.

## Review and handoff

See CI-002-review-1.md for honest self-review. The gate controls functional-currency selection only: preexisting IRR organizations, foreign-IRR documents and direct SQL are not comprehensively write-gated or financially qualified. Catalog metadata/read/export remain available. Production readiness requires remaining MON/QA/release gates and actual review before a code-readiness change and operator enablement. Flag rollback does not reverse data or freeze ongoing postings. Known trial-balance and bank/GL defects remain open.

No CI-002 blocker remains. After check/submit/self-review/done and final validate/status, next task is MON-001 (money/rate boundary inventory). Stop after CI-002; changes remain uncommitted.
