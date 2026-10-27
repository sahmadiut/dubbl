# AI-001 capability inventory and execution contract

## Identity

2026-10-27, Codex task_001, self-identified technical lead. Repository
`D:\Projects\a\dubbl`, branch `fresh-start`, starting HEAD
`a06c341f`. Working tree was clean at entry. No application/financial fixtures,
DB calls, credentials, provider API calls or infrastructure changes occurred.
This evidence precedes the task commit; it does not invent its eventual SHA.

## Audit result

Published `registries/AI_CAPABILITY_MATRIX.md`, generated
`registries/AI_CAPABILITIES.json`, `docs/AI_EXECUTION_CONTRACT.md`, the read-only
`scripts/audit-ai-capabilities.mjs`, and linked these from `docs/AI_AGENT_PLAN.md`.
Updated AI-001 Handoff. Static source discovery found 104 registered MCP modules,
786 operations, 556 API route files and 208 UI pages. Every module has a domain
permission/effect/gap mapping. All chat entries remain disabled pending AI-006
per-operation service/security acceptance. Existing MCP tools remain unchanged.

Inspected current registry/server error wrapping, AuthContext/session/API-key
paths, MCP token resolution, requireRole/plans/custom-role handling, site-admin
boundary, representative invoice/journal/contact/bank/payroll/project/report/
document services and handlers, existing Trigger config/jobs and package
manifest. Current MCP token resolution retains stale token-role fallback when
membership is missing and omits custom-role permissions; API-key resolution also
falls back on absent creator membership. Custom-role resolution currently reads
by role ID without organization scoping. AI-002 owns those repairs; this task
does not certify that legacy authorization is safe for agent exposure.

The architecture defines a PostgreSQL queue and separately invoked worker,
versioned state/leases/recovery, explicit uncertain effects, server-owned
identity, proposed AI permissions, finite bound previews/single-use approvals,
provider-neutral streaming/functions/error/usage contract, budgets, private
history versus aggregate usage, retention/deletion, secrets and default-off
rollout. Existing exact-money/domain/IRR/Stripe/release gates remain intact.

## Acceptance mapping

1. Matrix covers every registered MCP module and includes all discovered route/
   page paths in JSON, required domain read/write boundaries, effects, money
   contracts and explicit unsupported operations/gap owners. No capability is
   exposed by this task. Proposed first invoice slice identifies shared services
   and MCP operations and requires prerequisite lookup acceptance. The static
   inventory explicitly does not certify transitive permissions/shared-service
   parity; AI-006 must accept each enabled entry.
2. Reviewed v1 execution contract supplies run/step states, provider interface,
   approval policy, names/scopes/defaults for AI permissions, transcript
   visibility, data retention/deletion and disabled rollout. Review is Codex
   self-review, not independent peer/human security/accounting acceptance.
3. Official documentation was actually fetched on 2026-10-27 for function
   calling, data controls, supported countries and GPT-4.1 model status. Iran is
   absent from the supported-country list; intended deployment/account/model
   eligibility is unverified and GPT-4.1 is labeled deprecated. No provider/model
   is selected/enabled and no pricing is invented. The criterion permits
   unresolved choices, explicitly recorded with AI-004/005/013 live-qualification
   gates. Adapter protocol can be implemented disabled with deterministic
   fixtures; that is not provider qualification.

Official source links and dated findings are retained in the execution contract:
[function calling](https://developers.openai.com/api/docs/guides/function-calling),
[data controls](https://developers.openai.com/api/docs/guides/your-data),
[supported countries](https://developers.openai.com/api/docs/supported-countries),
[model status](https://developers.openai.com/api/docs/models/gpt-4.1).

## Verification

All commands used repository root unless stated otherwise.

| Command/procedure | Actual result | Limitation |
|---|---|---|
| `python .agentic/agent.py validate/status/next/context AI-001` | Passed; AI-001 first ready, no active task at entry | Controller structural state only |
| Initial audit invocation | Failed: TypeScript package unavailable | Clean checkout had no installed dependencies |
| `pnpm install --frozen-lockfile` | Exit 0, pnpm 10.30.3; lockfile up to date; no tracked manifest/lock changes | pnpm reported ignored optional dependency build scripts; no build authorization added |
| `node scripts/audit-ai-capabilities.mjs --write` | Exit 0; generated inventory above | Development-time TypeScript AST extraction, no runtime imports |
| `node scripts/audit-ai-capabilities.mjs` | Exit 0; source and inventory match | Does not evaluate transitive authorization/effects |
| Python inventory/source/matrix assertions | Passed: every module mapped; tuple/render/helper/project-loop anchors present; all 786 recorded source lines contain registration calls; every exposure disabled; local links resolve | Ephemeral read-only verification, no app/DB qualification |
| Python representative operation-name comparison | Found one incorrect prose example `recognize_revenue`; corrected to actual `recognize_revenue_entry` | Review correction before completion |
| Initial focused ESLint | Two errors: Next forbids local variable named `module` | Renamed variables to `moduleName` |
| `pnpm exec eslint scripts/audit-ai-capabilities.mjs` after repair | Exit 0; no errors/warnings | Focused on only executable change |
| `node --check scripts/audit-ai-capabilities.mjs` | Exit 0 | Syntax check |
| `python .agentic/agent.py validate` after changes | Exit 0, 398 structurally valid tasks | Completion reviewed separately |
| `git diff --check` | Exit 0 | Existing Git LF/CRLF notices only |

No full build, dev server, app typecheck/full lint/test suite, DB integration,
browser/screenshot, live provider, hosting or production qualification ran.
Only design/docs and a read-only audit utility changed; application authorization
or accounting behavior is not claimed repaired. TypeScript is used as a parser
from the existing dev dependency; no new dependency was added.

## Review and handoff

See separate `AI-001-review-1.md`. Next task AI-002 must implement live identity
and scoped custom-role/advisor enforcement with negative REST/MCP evidence.
Regenerate the source inventory after changing inventoried handlers. AI-003
implements persistence, AI-006 individual tool acceptance, AI-007 execution,
AI-008 approvals; AI-004/005/012/013 retain actual provider/account/deployment/
data-handling and rollout checks. AI-001 is a planning contract acceptance only.
