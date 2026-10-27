# AI-004 provider configuration evidence

Date: 2026-10-27. Implementer: Codex task_004, recovered and reviewed by Codex
task_004_recovery after the first agent stopped at a usage limit. This is technical
self-review, not independent peer/human security, geographic/account eligibility
or production approval.

## Delivered scope

- Two additive provider/catalog tables with generated migration
  `0017_skinny_rockslide.sql`, snapshot and journal. Organization/provider uniqueness,
  one default per org, timeout/version and paired ciphertext/key-version constraints.
- Shared `lib/ai/providers.ts` services used directly by REST and nine MCP management
  operations. Organization identity is server-derived and live-revalidated. Only
  current site-admin sessions may manage/read the global catalog; organization
  ownership/API keys/OAuth credentials cannot gain platform authority. Delegation
  bounds organization model, timeout and provider choices. Optimistic versions and
  org advisory locks protect replacement and default switching.
- AES-256-GCM credential writes use separately supplied external versioned key
  material and organization/configuration AAD. Credential reads/writes return masks,
  not plaintext/ciphertext. Rotation changes the credential reference; revocation
  removes ciphertext and disables configuration, including after delegation is
  withdrawn. Audits contain only entity/version metadata. Invalid credential-body
  JSON is sanitized before generic logging can expose raw parser diagnostics.
- External exact HTTPS endpoint policy, no URL credentials/query/fragment/custom
  port/IP literals; public DNS validation and pinned address with TLS hostname
  verification; mixed/private/reserved addresses and equivalent IPv6 spellings
  denied; no redirect following, bounded DNS and whole-request timeout, 64KiB
  request/response limits, sanitized errors. Connection test submits constant text
  only with `store:false`, no tools/parallel calls, and validates completed status,
  exact selected model and nonnegative usage; raw output/diagnostics never escape.
- All provider administration operations are explicitly marked by
  `AI_PROVIDER_ADMIN_TOOLS` and `PROVIDER_ADMIN_CHAT_ALLOWED=false` for exclusion
  from AI-006's future ordinary-chat registry. They remain administrative MCP tools;
  no ordinary chat registry exists yet and this task does not pretend to add one.
- Updated capability inventory: 106 modules, 799 tools, 565 route files, 208 pages.
  Added `docs/AI_PROVIDER_CONFIGURATION.md` for external policies/key rotation,
  endpoint/settings operations and later runtime/qualification boundaries.

## Acceptance mapping

1. Platform catalog and delegated org settings: real REST/MCP/SQL tests prove
   owner/API-key platform rejection, current site-admin creation/read/update,
   unknown field rejection, viewer/foreign-org denial, model/timeout validation,
   stale writes, one-default switching, provider disable/delegation withdrawal and
   live permission revocation on an already-created MCP server.
2. Encryption/masking/rotation/revocation: tests prove ciphertext differs from the
   fixture secret, AAD cross-org decrypt fails, absent key material fails closed,
   key-version rotation changes reference, REST/MCP return masks, and audit rows
   contain no fixture credential. Revocation clears persisted secrets and disables
   the configuration. Fixture keys exist only in isolated test processes.
3. Connection/transport guards: deterministic DNS/HTTPS fixtures exercise opted-out
   zero-request behavior, successful sanitized result, redirects, 401/429 responses,
   malformed/oversized JSON, wrong model, timeouts, private/mixed DNS, equivalent
   IPv6 reserved spellings, and endpoint URL restrictions. No external request
   occurred. These are adapter/transport engineering tests, never live qualification.
4. Shared services and parity: operation-specific strict described schemas under
   `/api/v1/ai/provider-catalog` and `/api/v1/ai/provider-configs`, registered in
   `lib/mcp/tools/index.ts`, direct DB access and `wrapTool`. Platform catalog has
   dedicated read operation as well as delegated catalog listing. Chat exclusion
   markers are explicit; AI-006 must consume them.

## Commands and observed results

All commands ran from `D:\Projects\a\dubbl`.

- Initialized a fresh temporary PostgreSQL 18 cluster, bound only to
  `127.0.0.1:55485`, with task-specific temporary directory. Each existing test
  harness created/migrated/dropped its own random `dubbl_ci_*` database. No
  application database writes, privilege changes or resets occurred.
- `TEST_DATABASE_URL=<isolated loopback server> node --import tsx --test
  tests/integration/ai-providers.test.ts`: passed, including final rerun after
  credential JSON sanitization; fixture-only DNS/HTTPS, real REST/MCP/SQL.
- Same isolated server, `node --import tsx --test
  tests/integration/ai-providers.test.ts tests/integration/execution-identity.test.ts
  tests/integration/ai-persistence.test.ts`: 3 passed, 0 failed.
- Focused ESLint over provider services/schema/MCP/REST/tests: passed.
- `npx drizzle-kit generate`: no remaining schema changes; existing generated
  migration applies successfully in the disposable suites.
- `node scripts/audit-ai-capabilities.mjs --write`, then no-argument check: passed,
  source matches inventory. Initial expected drift after adding a new operation was
  refreshed, not suppressed.
- `git diff --check` and `python .agentic/agent.py validate`: passed.
- Initial typecheck found unsupported HTTPS RequestOptions field and a test callback
  type mismatch; corrected while retaining explicit pinned address/family.
- `npx tsc --noEmit`: passed after the initial typing repairs; final incremental
  rerun after the last credential-parser guard also passed, exit 0.
- `npm run lint`: passed, exit 0, 0 errors and 20 pre-existing warnings in
  unrelated files. No new provider-code warnings.
- Reviewed installed Node HTTPS typings and official
  [HTTPS request documentation](https://nodejs.org/api/https.html#httpsrequesturl-options-callback)
  and [authenticated encryption API](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options).

## Limitations and cleanup

No production provider/model selected, credentials provisioned, provider calls
enabled, network request sent, app DB migrated, dev server started, full build,
deployment, UI, streaming/generation worker or approval/budget runtime claimed.
Connection tests require an external exact opt-in; settings alone do not activate
AI. Actual provider/account eligibility, data handling, model capability evidence
and rollout qualification remain unresolved per AI-001 and AI-013. AI-005/007 must
wire policy/budget/run orchestration; AI-006 must enforce chat-tool exclusions;
AI-010 owns administration UI/localization. External key loss requires credential
replacement; retiring old key versions needs operational coordination with backups.

The prior task agent's leftover loopback PG55484 cluster was identified by its
exact task-owned temporary path, verified to have no disposable databases and
stopped. The recovery cluster is stopped after verification. Ignored `.env.local`
with the separately fixed AUTH_SECRET remains untouched and untracked.
