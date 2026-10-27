# AI-002 live identity and permission enforcement

2026-10-27. Codex task_002, security implementation and self-review. Starting
HEAD `9c55db9644d0ef1bbda767b811787eebfe98882c`, branch `fresh-start`, clean tree.
No deployment, provider calls, full build or dev server. No Stripe files changed.

## Implemented boundary

- REST API keys and MCP access tokens require current scoped membership; removed
  creators cannot fall back to member/token roles. MCP uses current scoped custom
  roles, including an empty permission array. Missing/mismatched roles fail closed.
- `ExecutionIdentity` stores only a server-created credential ID or authenticated
  session actor, issue/expiry times and organization; no raw bearer secret or role
  snapshot. `resolveExecutionIdentity` refreshes credential, user, live organization,
  membership/custom role or active accepted advisor grant. `authorizeExecution`
  additionally checks server-owned organization and a known operation permission.
  Unknown permission names deny even an owner. Domain services still validate
  resource IDs and periods; discovery filtering does not authorize an operation.
- Authenticated contexts retain a private WeakMap credential binding. `wrapTool`
  revalidates it before each handler and refreshes existing closure contexts. A
  deleted/expired credential, removed member, revoked session/advisor or altered
  identity scope fails before handler execution. Custom-role permission edits
  take effect in an already connected MCP server.
- Session authentication and site-admin session gates require current users,
  authenticated issue/expiry timestamps and no later/equal revocation. Sessions
  lacking issuance metadata fail closed. API/MCP credentials retain their existing
  organization scope and do not become global site administration credentials.
- External auditors and tax advisors have `view:data` only. Accountants/bookkeepers
  additionally receive explicit routine entry/contact/invoice/bill/expense/payment
  permissions, without posting/approval/period-lock, payroll, role, security or
  organization administration. Grants must be active, accepted and not revoked.
- OAuth authorization-code exchange/refresh require current scoped membership and
  valid custom roles, instead of minting credentials from a missing-member fallback.
  Auth errors become `invalid_grant`; expired credentials include equality boundary.

## Compatibility and dependent-task contract

API keys continue pinning scope to their stored organization and ignoring the
UI `x-organization-id` header. This existing behavior is deliberately retained;
foreign headers cannot select another tenant. An explicit server-required
organization mismatch rejects. Strict MCP input schemas reject forged organization
fields, while real domain queries reject foreign resource IDs.

Legacy internal trusted contexts without transport bindings still work; they do
not claim credential authentication. AI execution must resolve server-created
references and call `authorizeExecution` before each dispatch/retry/resumed approval.
AI-003 owns durable persistence, AI-006 the operation allowlist and real service
dispatch, AI-007 the run/resume worker, and AI-008 concrete approval execution.
Those runtimes do not yet exist: this task supplies and qualifies their identity
boundary, without claiming a working run or approval feature. No live-provider,
browser/JWT sign-in, independent human-security or production acceptance is claimed.

## Checks

Passed:

- `pnpm exec fumadocs-mdx`, then `pnpm exec tsc --noEmit` (and final incremental
  typecheck after implementation review).
- `pnpm lint`: zero errors, 20 existing warnings outside this change. Focused
  ESLint of all new/changed TypeScript paths also passed.
- `node scripts/audit-ai-capabilities.mjs`: existing inventory matches source;
  no tool/route registration drift (104 modules, 786 tools, 556 routes, 208 pages).
- `TEST_DATABASE_URL=<isolated loopback cluster> node --import tsx --test
  tests/integration/execution-identity.test.ts`: passed, including final unknown
  permission/owner case. Uses real SQL, REST handlers and registered MCP tools.
- Sequential integration regression invocation for `locale-preferences.test.ts`,
  `opaque-admin.test.ts`, `shell-auth-settings.test.ts`: all three passed. Includes
  site-admin session forwarding and real REST/MCP/persistence checks. Re-ran
  identity and opaque-admin suites after live-organization guards: both passed.
- `python .agentic/agent.py validate` and `git diff --check`: passed. Controller
  validation is structural evidence, not a substitute for behavior tests.

The optional all-files pure suite `node --import tsx --test --test-concurrency=1
tests/*.test.ts` was started and made progress through unrelated catalog cases,
with no observed failure before interruption. It was stopped deliberately after
the relevant required checks completed; it is **incomplete, not a passing full
suite**. Only the verified owned test process and its child processes were stopped.

The focused identity worker verifies read-only custom roles on REST/MCP; live role
edits and empty permissions; unknown operation permission denial even for owners;
foreign custom-role IDs and resource IDs; forged model organization arguments;
credential-pinned headers and explicit organization mismatch; current site-admin
versus organization-owner authority; advisor writes/revocation; revoked/expired
sessions including missing issuance metadata; MCP expiry/deletion during an existing
connection; API-key expiry/deletion/removal of creator; persisted-reference rechecks;
and refresh-token exchange after membership removal. SQL confirms only the three
intended contact writes happened. Auth session issuance itself is stubbed with
authenticated claims, not a browser/JWT end-to-end qualification.

## Test environment

The copied checkout contains no ignored `.env`. A read-only config lookup of the
prior checkout established that its database is loopback; its role lacks CREATEDB.
An initial disposable-fixture attempt failed `permission denied to create database`
before any application mutations. Rather than change that role or application DB,
started a separate temporary PostgreSQL 18 cluster with installed `initdb`/`pg_ctl`,
trust auth restricted to `127.0.0.1:55482`. Tests create/drop randomized databases
through the existing fixture harness. No application DB was migrated/reset/written,
no account privilege was changed, and no credential values were printed or committed.
The temporary cluster was stopped after checks; the server reported zero leftover
`dubbl_ci_*` databases before shutdown. Its local scratch files are outside Git.
