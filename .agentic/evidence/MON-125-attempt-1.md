# MON-125 attempt 1 - opaque JSON and administrative forwarding

## Identity

2026-10-10, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
8dae414602ca363a34ee33613d7a8ef5d571da61; clean working tree. Changes were
uncommitted when this evidence was written. Actual self-review only.
Controller selected and started exactly MON-125; MON-034 retains integration.

All integration work used a fresh trust-authenticated PostgreSQL 18 loopback
cluster on port 55425 with max_locks_per_transaction=256. TEST_DATABASE_URL was
explicit; each fixture created, migrated and dropped a randomly named database.
Application DATABASE_URL/.env targets were not used or changed. No credentials,
real customer data, public provider request, build/dev server or deployment.

## Implementation and acceptance

1. [OPAQUE_ADMIN_WIRE_CONTRACTS](../registries/OPAQUE_ADMIN_WIRE_CONTRACTS.md)
   maps every adopted operation's inputs/outputs, scope, permissions, numeric
   limits, resets, counts/bytes/MB, exact monetary aliases and unlimited limits.
   Its cross-domain table assigns all 30 jsonb declarations plus non-JSONB
   serialized configurations to their existing owners. Remaining public signing,
   SSR/PDF and combined acceptance stay MON-126/127/034. MONEY_MANIFEST and the
   generated MONEY_BOUNDARIES inventory were updated.
2. Actual audit-log REST and full registered SDK list_audit_log now share a strict,
   organization-scoped read service with consistent pagination/count snapshots,
   actor names, filters and retained plan-date clamps. Administrative organization
   GET/PATCH and get_admin_organization/update_admin_organization share real DB
   services. Site-admin API keys and MCP stay organization-scoped; session site
   administrators retain existing global addressing. The fixture exercises two
   tenants, forged headers/unknown fields, invalid credentials, custom permission
   denial, site-admin denial/revocation and legacy/exact clients. A separate
   module-mock worker invokes all four global admin read handlers and detail
   GET/PATCH with only NextAuth session resolution stubbed; actual site-admin DB
   checks and queries run. Browser/JWT/login behavior is not claimed.
3. Opaque audit reads preflight SQL-text JSON numeric tokens before pg decoding.
   Exact strings, tiny FX strings, safe signed integers and ordinary fractions
   preserve original units; unsafe integers, precision-losing safe-range decimals
   and underflow reject with 422 LEGACY_NUMERIC_RANGE, leaving history untouched.
   Shared parser extraction retains the existing MON-124 snapshot behavior.
   Generic audit payload normalization runs before its insert, preserving safe
   bigint numeric compatibility and rejecting unsupported numbers. Subscription
   writes validate raw tokens/strict schemas before acquiring mutation locks;
   canonical form text/reset input is retained without broad Number/Boolean
   coercion. Organization-locked partial upserts serialize concurrent existing
   and initial row updates. Complete results are guarded; explicit plan Infinity
   sentinels map to the established unlimited null representation. Known
   billApprovalThreshold/mileageRate numeric cents gain matching Minor strings.

Changed source: lib/api/opaque-json.ts, audit-log.ts, admin-organization.ts,
audit.ts, invoice-snapshot-wire.ts, require-site-admin.ts; audit/admin detail and
four global admin read routes; MCP audit/admin registration plus index. Added
opaque-admin runner/worker and admin-session-worker fixtures.

## Verification

All commands ran from D:/Projects/dubbl. Results below were actually awaited.

| Command | Actual result | Scope/timing |
|---|---|---|
| Explicit TEST_DATABASE_URL; node --import tsx --test --test-concurrency=1 tests/integration/opaque-admin.test.ts tests/integration/invoice-snapshots.test.ts | Exit 0; 2/2 | Final numeric-token, retention and concurrent update assertions; snapshot regression. |
| node --import tsx --test tests/integration/opaque-admin.test.ts (same explicit disposable target) | Exit 0; 1/1 | Final runner additionally executes admin-session-worker with --experimental-test-module-mocks; all four global read handlers and session detail/revocation pass. |
| node --import tsx --test --test-concurrency=1 tests/integration/contact-wire.test.ts tests/integration/organization-settings.test.ts (same disposable target) | Exit 0; 2/2 | Generic audit-helper and related organization compatibility regressions. |
| pnpm test | Exit 0; 364/364 | After shared parser/service adoption; final later changes were transport raw-token checks and integration fixtures, covered above. |
| pnpm typecheck | Exit 0 | Final run includes admin-session worker, all final source and fixture changes; no full build. |
| pnpm lint | Exit 0; 0 errors, 105 existing warnings | Final changed-file ESLint separately verifies subsequent token-check and fixture additions. |
| pnpm exec eslint all changed source and fixture TS files | Exit 0; 0 errors, 2 existing warnings | Both pre-existing unused imports in admin/usage; new/shared/adapter/fixture files otherwise clean. |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | 415 columns, 1913 scanned files, 1419 consumer hashes, 27249 occurrences; actual source matches. |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy money lint gate. |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure valid (177 tasks); no whitespace errors. |

Initial fixture failure was a harness assumption that SDK schema errors are JSON;
native SDK text errors are now handled without changing production behavior.
Initial typecheck caught undefined missing subscription passed to getEffectiveLimits;
corrected to the documented null default and verified. Self-review caught raw
numeric request decoding and corrected it before final acceptance. No failures
remain in the completed checks.

## Review and limitations

See MON-125-review-1.md for actual self-review findings. No independent peer,
human accounting/security approval, global-admin large-scale test, real JWT/login
browser exercise, production DB qualification or IRR enablement is asserted.
Generic logAudit preflight guards its audit-row mutation; it does not turn all
existing best-effort domain operations into transactional domain-plus-audit
writes. Originating services retain their independent atomicity contracts.
Opaque strings deliberately do not acquire guessed money aliases/units, and
already-decoded MCP Numbers cannot recover precision lost before SDK input.
No schema changes, generated migrations, historical rewrites or rescaling.

## Handoff

MON-125 acceptance is complete; controller submit/self-review/done and the
authorized scoped commit/push follow this evidence. Next controller task is
MON-126 public signing. MON-034 remains open until all child tasks and its
independent combined acceptance finish. Do not extend this delivery to MON-126.
