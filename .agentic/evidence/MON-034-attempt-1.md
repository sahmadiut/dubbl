# MON-034 attempt 1 - combined opaque and public boundary acceptance

## Identity

2026-10-10, Asia/Tehran. Operator codex; actual self-review only.
Entry master HEAD 71c8a2c8b05c70bbb8d17995ea1113ebb6dabb52; working tree clean.
User authorized completing and pushing the next task. Live controller selected
MON-034, with MON-124..127 complete and no active/review work. This delivery
completes exactly the integration parent, independently of those child statuses.
Changes were uncommitted when this evidence was written.

Fresh synthetic trust-authenticated PostgreSQL 18 cluster bound to 127.0.0.1,
port 55434, max_locks_per_transaction=256. Explicit TEST_DATABASE_URL selected
this isolated server. Each integration runner created, migrated and dropped its
own randomly named disposable database. Application .env/DATABASE_URL targets
were not read, changed or used. Parent has no email/provider configuration;
child tests capture SMTP locally and stub only documented session/delivery edges.

## Implementation and acceptance mapping

1. OPAQUE_PUBLIC_INTEGRATION_CONTRACTS.md independently maps all four boundary
   families to concrete inputs, outputs, units, aliases, supported ranges and
   permissions. It assigns all 30 persisted jsonb declarations, including
   nonfinancial configuration/authentication metadata, to existing owners and
   links the authoritative domain policies. Serialized non-jsonb report/bank/
   payroll/journal/template/provider forwarding retains named ownership. A
   regression reads actual schema declarations and checks the full declaration
   inventory and every referenced registry link; new/removal/rename drift fails.
2. The new parent worker invokes actual legacy REST/exact MCP invoice writers
   in USD/IRR/KWD. It follows each record through REST or MCP snapshot correction,
   matching literal audit reads through both transports, signature request,
   static signing SSR, public signing POST, authenticated HTML/PDF and public
   payment PDF/portal HTML. Whole saved units and *Minor aliases agree throughout.
   Admin REST/MCP partial quota writes compose with organization money reads,
   preserving count overrides and monetary aliases as separate units. Actual
   hashed API credentials, two tenants, forged tenant header, empty custom grants,
   invalid credentials, full registered MCP SDK and public bearer capabilities
   establish authorization/isolation at the actual operation boundaries.
3. Every parent rejection block snapshots invoice/lines/signatures/audit/
   subscriptions/email-log/portal-log tables as SQL text and verifies no mutation.
   Invalid correction types/unknown fields/empty objects reject before writes.
   Signed corrections return 409, duplicate public signing 400, and audit/render
   retain the same corrected history afterward. Opaque full-int64/tiny-FX strings,
   leading-zero identifiers and safe fractions stay literal. Persisted decimal
   loss, unsafe integers and underflow fail together across snapshot, signing
   SSR/POST and authenticated/public render with 422 LEGACY_NUMERIC_RANGE or the
   documented safe SSR fallback. Unsupported monetary headers reject financial
   consumers while party-only reads remain usable without decoding those headers.
   Child reruns independently verify lock waits/races, transactional rollback,
   raw-token admin/audit rejection, all five document kinds, template/email
   previews/attachments, mocked SMTP and actual global-admin session handlers.

Changed files: two new parent integration fixture files; new parent registry;
MONEY_MANIFEST integration handoff; MON-034 task and new attempt/self-review.
Actual source inspection found the child implementations compose correctly;
no duplicate runtime implementation, schema/migration, monetary posting, currency
history change, rescaling or production flag change was needed. Money inventory
hashes already match unchanged runtime source and were not regenerated.

## Verification

All commands ran in D:/Projects/dubbl. Results were awaited, exit 0, no skips.

| Command | Actual result | Limit |
|---|---|---|
| python .agentic/agent.py validate/status/next/context; start MON-034 --owner codex | Valid 177-task controller; selected/started parent | Structural workflow, not product proof |
| Explicit TEST_DATABASE_URL; node --import tsx --test tests/integration/opaque-public-integration.test.ts | 2/2 passed: inventory and independent combined workflow | Actual handlers/full SDK/static SSR/local PG18; no HTTP dev server |
| Same explicit target; node --import tsx --test --test-concurrency=1 tests/integration/invoice-snapshots.test.ts tests/integration/opaque-admin.test.ts tests/integration/invoice-signatures.test.ts tests/integration/document-rendering.test.ts tests/integration/public-portal-wire.test.ts | 5/5 passed, no skips | Includes documented child locks/rollback, admin-session and mocked SMTP workers |
| pnpm test | 368/368 passed | Pure tests; independent PostgreSQL fixture above supplies operation evidence |
| pnpm typecheck | Passed after all fixture TS edits | No full build |
| pnpm lint | 0 errors, 105 existing warnings | No warnings in new fixtures |
| pnpm exec eslint tests/integration/opaque-public-integration.test.ts tests/integration/opaque-public-integration-worker.ts | Passed clean | Final fixture source |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | 415 columns, 1425 consumer hashes and all source lines verified | Lexical inventory, not independent accounting approval |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | All 9 regressions passed | No new grandfathered arithmetic |
| python .agentic/agent.py validate; git diff --check | Passed | Rechecked with final controller/staged files before commit |

No full build, dev server, Docker, deployment, production migration, live provider
call, application DB reset, browser interaction or screenshot qualification ran.
The temporary cluster is stopped after verification. No replacement remote CI
outcome is asserted by these local results.

## Review and handoff

See MON-034-review-1.md for actual self-review findings. All three original parent
criteria have independent evidence; no remaining blocker within this slice.
MON-008 retains broad consumer arithmetic/localized display and full-int64 cutover;
subsequent migration/accounting/security/release tasks keep independent acceptance.
Safe numeric range remains +/-9007199254740991. Exact opaque strings are not
financially interpreted. Provider-after-commit/domain audit limits remain their
existing documented contracts. No independent human financial/security approval,
PDF visual fit or production IRR qualification is claimed.

Next action: controller submit/self-review/done, scoped authorized commit/push,
then verify actual remote SHA and clean tree and report the next live controller
task. This immutable evidence does not invent a future commit/push result.
