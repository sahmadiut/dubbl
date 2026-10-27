# AI-010 attempt 1 - provider and tool-policy administration

## Identity

2026-10-27, Codex task-010, self-operated in D:/Projects/a/dubbl, branch fresh-start.
Baseline HEAD: 572180f88a9201e0d2de54827a1cb4d6c5d6adef. Initial tree contained only
AI-010's existing in-progress/owner/history change. Resumed it without overwriting
the start record. This evidence describes implementation before its commit.

## Implementation

- Added /admin/ai with site-wide provider catalog forms: approved endpoint,
  organization delegation, enablement, timeout, multiple models with dated
  capabilities, and default model. Added existing-panel navigation.
- Added /settings/ai for delegated organization provider/model/timeout/default
  configuration, masked credential status, rotation, revocation and connection
  tests; organization and named-agent tool policies have independent forms.
- Both screens call existing AI-004/006 shared REST management services, whose
  operation-specific MCP tools remain available. No REST/schema/migration change
  or extra ordinary-chat capability was required. The reviewed seven names now
  live in one browser-safe module consumed by both policy UI and registry.
- Browser DTO parsers validate response envelopes and discard credential/key
  fields. Credential input is uncontrolled, never placed in React state/storage,
  and cleared before submitting. Raw API/provider/network diagnostics are never
  displayed in sensitive settings errors.
- Read each section under its own server permission, hide its forms on denial,
  reload after revocation, preserve edits on conflicts with an explicit reload,
  and block a stale form from submitting after active organization changes.
  Delegation withdrawal preserves credential revocation, as the service permits.
- English/Persian catalogs cover forms, statuses, help, tools and bounded errors;
  machine IDs, model IDs, dates, versions and provider endpoint values remain
  canonical. Labels wrap inputs, logical spacing is used, endpoint/ID inputs use
  LTR, and user-controlled provider labels are escaped and isolated with bdi.
- Refreshed generated inventories: 210 pages, 574 API routes, 812 tools, seven
  reviewed chat operations. The new management pages grant no chat authority.

## Acceptance mapping

1. CatalogForm/ConfigForm/PolicyForm and AiManagement implement the management
   controls using existing shared APIs. Tests exercise actual form callbacks,
   exact version/default payloads, credential clearing before dispatch, revocation
   after delegation withdrawal, and policy subject separation. Existing real
   REST/MCP/SQL provider tests cover encryption, rotation, default switching,
   connection test guards and unavailable/invalid endpoint paths.
2. Browser workspace tests independently exercise site catalog, provider-only,
   policy-only and chat-only sections. Extended the real provider integration
   worker with live custom-role grants: provider-only can read configs/catalog
   but cannot read platform catalog/policy; policy-only can read/write policy but
   cannot read configs or revoke credentials; use:ai alone cannot administer
   either. Existing captured MCP servers refresh these changing grants too.
3. Rendered the production forms through real next-intl/PresentationProvider in
   en-US/fa-IR. Verified Persian script, safe escaped labels, accessible form
   labels/password fields, disabled controls, localized sensitive-setting errors,
   stale-version reload, permission revocation and organization-switch guards.
   No native Persian or browser visual review is claimed.

## Verification

All commands ran at repository root. Final results:

- `node --import tsx --test tests/settings-catalogs.test.ts
  tests/accounting-sales-purchasing-catalog-integration.test.ts
  tests/ai-management.test.ts`: 15/15 passed, none skipped.
- Explicit loopback `TEST_DATABASE_URL`, isolated PostgreSQL18 port55490:
  `node --import tsx --test --test-concurrency=1
  tests/integration/ai-providers.test.ts tests/integration/ai-tool-registry.test.ts
  tests/integration/execution-identity.test.ts`: 3/3 passed.
- After adding independent provider/policy/chat permission regressions,
  `node --import tsx --test tests/integration/ai-providers.test.ts`: 1/1 passed.
- Final `npx tsc --noEmit`: exit0 after all production/test changes.
- Final `npm run lint`: exit0, zero errors, 20 existing unrelated warnings.
- Focused ESLint across new/changed UI, client contracts, registry and tests:
  exit0, no warnings/errors.
- `npm run i18n:check`: passed, 10776 keys per locale.
- Both AI inventory/coverage audit scripts: refreshed and checks passed.
- `python .agentic/agent.py validate`: valid, 408 tasks.
- `git diff --check`: passed.

Initial typecheck caught a union-schema inference problem and nested catalog
namespaces conflicting with existing flat-catalog tests; fixed by an explicit
response-schema type and separate flat error/tool namespaces. Initial lint caught
two reserved test variable names, renamed before final lint. Initial generated
inventory drift was solely the new pages and was regenerated/rechecked.
An early PowerShell-to-Python pipe corrupted new Persian text; replaced with
UTF-8 file-backed text and verified Persian script in every new translation.

Database safety: initialized a fresh task-only cluster at
C:/Users/Sajjad/AppData/Local/Temp/dubbl-ai010-e1d6d9f155234e459fefbb625d94c82d.
Each fixture created/dropped its own random database. SQL confirmed zero leftover
dubbl_ci_* databases; pg_ctl stopped the task cluster. Application DB, credentials
and local rollout flags were not changed.

## Review and handoff

Technical self-review is recorded in AI-010-review-1.md. This is frontend
management acceptance, not live provider qualification, runtime enablement,
full-site tool coverage or deployment. No full build, dev server, live provider
call, app database mutation or Stripe modification was performed. Connection
fixtures use synthetic provider data; native Persian/browser/human/release
qualification remains separate. AI-023 owns the worker loop; AI-007 remains its
independent integration parent. Stop after this bounded task.
