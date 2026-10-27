# AI-006 attempt 1: reviewed tool registry and guarded dispatch

Date: 2026-10-27. Implementer/reviewer: Codex task_006, self-review only.
Baseline: fresh-start at 948b92fd33065bcb878d811157227eeae2c9fdfa, clean tree.
No deployment, live-provider qualification, production activation or human approval.

## Implemented scope and acceptance

1. `lib/ai/tool-catalog.ts` explicitly reviews seven registered operations: list/get
   contacts, list/get journals, list/get expense claims and new expense draft creation.
   Each has strict schema, domain permission, MCP/shared-service mapping, schema version,
   resource-version behavior, money/effect/retry/approval contract and result cap.
   Neither module names nor model text can enable an operation. Ordinary chat cannot
   discover provider, pricing/budget/policy/role/credential/security tools, SQL, shell,
   arbitrary code/URL tools, posting/payment/sending/deletion or approval operations.

2. `ai_tool_policy` and generated migration 0019 implement organization and agent
   restrictions with explicit opt-in, unique scope, bounded allowlists, CAS updates and
   transactional actor audit. Missing/disabled policies deny all tools. Authenticated
   REST policy administration and discovery have three corresponding registered MCP
   operations. Policy administration is not in the model catalog.

3. `lib/ai/tool-registry.ts` receives trusted server scope, resolves the original live
   credential/member/custom role, intersects current actor/org/agent grants, validates
   unknown/nested fields and exact input contracts, and rechecks before dispatch. It
   executes actual registered MCP callbacks through linked in-process transport, not
   HTTP, SQL strings, copied domain logic or mocked business handlers. Existing
   `wrapTool` rechecks live identity; domain services preserve resource scope, locks,
   existing limits/approvals, exact money and initiating-user audit.
   Only the reviewed new draft is a write: it causes no journal/payment/stock/outbound
   or approval effect. Numeric major/minor aliases, arbitrary receipt URLs and existing
   resource mutation are not accepted by its stricter agent schema.

4. MCP errors and error payloads are never successful actions. Ambiguous writes become
   uncertain, with no automatic retry. All outputs are explicitly untrusted data, never
   policy. Disclosure over 32KiB is omitted; a known created expense UUID is retained
   without turning a committed write into a retryable failure. Input is capped at 64KiB;
   list and draft batches are bounded to 25. Dispatch audits contain no raw arguments.

5. `AI_TOOL_COVERAGE.json` exhaustively classifies the current inventory: 108 modules,
   807 tools, 570 route files and 208 pages. Seven tool operations are reviewed and
   800 are unlisted. Routes are not generic dispatch endpoints and page action coverage
   is never inferred from a matching domain. `audit-ai-tool-coverage.mjs` checks reviewed
   names against actual registrations and reproducibly generates these dispositions.
   AI-014..021 track finite domain candidate slices and remaining classification gaps,
   dependent on AI-006/008. Their creation does not implement those capabilities.
   Updated current matrix/source coverage/index; older evidence remains unchanged.

## Actual verification

Commands ran in D:/Projects/a/dubbl. No full build or dev server was run.

- `npx drizzle-kit generate`: generated 0019_normal_purple_man.sql and snapshot;
  subsequent invocation reported no schema changes. Migration applied successfully
  by the focused disposable integration harness.
- `npx tsc --noEmit`: initial full process exit0; final incremental process exit0
  after final production/test changes.
- `npm run lint`: exit0, zero errors and 20 pre-existing unrelated warnings.
- Focused ESLint over both new routes, catalog/registry, schema/MCP module, two tests
  and coverage script: exit0, no warnings/errors.
- `node --import tsx --test tests/integration/ai-tool-registry.test.ts
  tests/integration/execution-identity.test.ts tests/integration/ai-persistence.test.ts
  tests/integration/ai-providers.test.ts tests/integration/ai-usage.test.ts` with explicit
  loopback TEST_DATABASE_URL: **5/5 passed**, none skipped.
- `node scripts/audit-ai-capabilities.mjs --write` then check: source inventory matches.
- `node --import tsx scripts/audit-ai-tool-coverage.mjs --write` then check: matches.
- `python .agentic/agent.py validate`: valid, 406 tasks after adding eight follow-ups.
- `git diff --check`: passed.

The new real REST/MCP/SQL worker tests all seven reviewed operations against real
registered callbacks/services. It verifies default-deny and both-policy requirement,
CAS conflicts, admin denials, actual strict published schemas, provider/usage/policy
exclusions, prototype/unknown tool rejection, forged user/org/approval/URL fields,
invalid dates/currencies/numeric/noncanonical/unsafe money, foreign references,
period locks, exact 1250 minor units, draft-only effects, initiating-user audit,
current policy edits, custom-role narrowing, credential deletion, removed membership,
cross-org server scope, untrusted injected contact text and bounded result omission.
Actual tool errors (e.g. foreign contact not found) are verified as failed outcomes.

Initial new-suite failures found an audit entity-ID UUID mismatch and a BigInt
refinement executing after a failed regex. Both were fixed and the suite rerun passed.
A fixture attempted to assert a free-plan API denial despite existing self-hosted
unlimited behavior; replaced with a valid live credential-revocation test. Existing
plan/Stripe behavior was preserved, not changed or claimed qualified by this task.

Database safety: isolated PostgreSQL18 task cluster on loopback55487, not the app DB.
Every harness database was dropped; SQL count of leftover dubbl_ci_* databases was0.
Task cluster was stopped with pg_ctl after path verification. No DB credentials or
local AUTH_SECRET were printed, changed or staged. No Stripe file was modified.

## Limits and next actions

This is a reviewed subset, **not full-site AI coverage**, runtime activation or live
provider acceptance. AI-007 owns durable run/step identity, operation keys, cancellation,
kill switch, deadlines and reconciliation. It must use the trusted configured agent
key and must not retry uncertain draft creation. AI-008 owns actual sensitive approval
proofs; no approval argument can enable a sensitive tool here. AI-014..021 require
their own independent implementation/evidence. AI-013 must reconcile outstanding
capability/provider/runtime gaps before any support/rollout claim. Human/native/
accounting/security/release approvals and production IRR gates remain unchanged.
