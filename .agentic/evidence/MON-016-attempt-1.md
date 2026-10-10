# MON-016 attempt 1 - combined public and opaque boundary acceptance

## Identity

2026-10-10, Asia/Tehran. Operator: coding-assistant; actual self-review only.
Entry master HEAD 0413b71e14788cad9e69d3d4dc693d7f0e2a35a9, clean tree.
The user authorized completing and pushing the next task. Live controller
validation selected MON-016 with MON-011 and MON-030..034 done, no active/review
work. This delivery completes this integration parent independently of child
completion. Changes were uncommitted when this evidence was written.

Dedicated synthetic trust-authenticated PostgreSQL 18.6 cluster on loopback
127.0.0.1:55416, max_locks_per_transaction=256. Explicit TEST_DATABASE_URL opted
into that server. Runners created, migrated and dropped randomly named disposable
databases; the application database and .env were not read or altered. Final
fixture database count was 0 and pg_ctl successfully stopped the cluster.

## Implementation and source inspection

Read applicable instructions, controller/project/repository map, selected and
dependency tasks/evidence, ADR-006, the five child operation registries and actual
REST/MCP/service/serializer/schema implementations. Existing shared services
already implement the slice; no duplicate production implementation is needed.

- Added public-boundaries-integration.test.ts and worker: real API-key REST,
  full registered MCP SDK linked transports, migrated PostgreSQL, real signed
  webhook verification/settlement and real HTML/PDF generation. Synthetic S3,
  checkout and outgoing HTTP adapters capture contracts without live services.
- Added PUBLIC_BOUNDARY_INTEGRATION_CONTRACTS.md to join every child inventory's
  inputs, outputs, units, aliases, ranges, rights, tokens and remaining owners.
  MONEY_MANIFEST links this independent parent contract. The child JSON schema
  ownership closure and source money inventory retain all existing owners.
- Refreshed MONEY_BOUNDARIES.json for the new fixture sources; no schema, monetary
  runtime, legacy history, currency scale, migration or IRR flag was changed.

## Acceptance mapping

1. The new parent registry enumerates MON-030..034 and links their complete
   operation inventories. It distinguishes currency minor units from generic
   fixed-two CSV/product prices, physical quantities, counts, opaque strings,
   compatible FX millionths and native signed provider contracts. Numeric safe
   coexistence and the application's narrower checkout policy are explicit.
   The MON-034 schema/link regression verifies every persisted JSON declaration.
2. The independent parent imports legacy/exact products/contacts through REST/MCP,
   creates six USD/IRR/KWD legacy REST/exact MCP invoices, exports matching CSV,
   uploads immutable legacy v1/exact v2 snapshots, restores through both transports,
   and checks the restored exports byte-for-byte. The same invoices feed literal
   corrections, public token JSON/statements, signing and authenticated/public
   HTML/PDF. USD checkout and signed payment events update portal payments and
   backup aliases; outgoing delivery HMAC validates the exact captured body.
   Actual API-key/SDK fixtures also exercise foreign organizations, empty grants,
   invalid credentials and forged org headers. Child regressions pass for the
   broader operation families documented by each slice.
3. Combined snapshots of mutation tables, synthetic storage and provider/delivery
   calls stay unchanged for conflicting product/invoice/backup aliases, unsafe
   exact import input, unsupported token overrides, denied grants/tenants, invalid
   signatures, altered amounts and foreign signed metadata. Signed invoices refuse
   party corrections; opaque full-int64/tiny-FX strings and leading-zero IDs remain
   literal. USD payment replay has no writes. IRR/KWD checkout rejects before
   provider calls. Saved SQL int64 9007199254740993 rejects public payment/list/
   statement, render, export and backup through REST/MCP with LEGACY_NUMERIC_RANGE,
   without activity or other writes. Once dependent tokens/signatures/allocations
   exist, restore rejects the historical format's incomplete graph before even
   creating a safety backup. No rescaling or generic alias injection occurs.

## Verification

All commands ran from D:\Projects\dubbl. Integration commands used the explicit
synthetic loopback TEST_DATABASE_URL; worker DATABASE_URL selected only each new
disposable database.

| Command / procedure | Actual result | Limit |
|---|---|---|
| node --import tsx --test tests/integration/public-boundaries-integration.test.ts | Final exit 0, 1/1 passed | Independent combined handler/full-SDK workflow; no HTTP dev server |
| node --import tsx --test --test-concurrency=2 tests/integration/public-portal-wire.test.ts tests/integration/stripe-contract.test.ts tests/integration/backups.test.ts tests/integration/generic-import-export.test.ts tests/integration/opaque-public-integration.test.ts | Exit 0, 6/6 passed | Five slice suites, including JSON inventory; backups cover UTC and Asia/Tehran |
| pnpm test | Exit 0, 368/368 passed | Pure/unit contract regressions |
| pnpm typecheck | Final exit 0, MDX generation and tsc passed | No full build |
| pnpm exec eslint tests/integration/public-boundaries-integration.test.ts tests/integration/public-boundaries-integration-worker.ts | Final exit 0, no warnings/errors | Changed source |
| pnpm lint | Exit 0, 0 errors/105 existing warnings | Existing repository warnings remain |
| python .agentic/scripts/money_inventory.py --write, then without write | Final exit 0; 415 columns, 1929 scanned sources, 1429 consumers, 27233 occurrences | Lexical inventory, not financial qualification |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0; Drizzle columns, hashes and source lines verified | Source ownership/drift |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, all 9 regressions passed | No new grandfathered arithmetic |
| python .agentic/agent.py validate | Exit 0, 177 tasks valid | Structural workflow integrity |
| git diff --check | Exit 0 | Whitespace only |
| Synthetic server database count / pg_ctl stop | 0 disposable databases / exit 0, stopped | Temporary cluster files retained; no application DB mutation |

Initial runs identified fixture assumptions: product storage is salePrice,
foreign-currency invoice creation needs a Pro subscription, the existing REST
restore response wraps restoredCounts twice, and MCP Zod errors expose validation
details without an HTTP status. Fixture setup/assertions now follow actual
contracts. No production defect was found or masked. The temporary unused import
warning was resolved by exercising REST signature request as well as MCP. An
intermediate inventory check detected source edits made during its run; final
regeneration and verification passed against the finished source.

## Review and limits

See MON-016-review-1.md for the coding-assistant's actual self-review. There is no
peer/human approval claim. No live Stripe/S3/SMTP/Trigger, build/dev, deployment,
browser interaction, PDF visual fit, independent accounting/security or native
Persian qualification. QA-005 retains complete disaster recovery. MON-008 retains
broad consumers/full-int64 cutover; migration/production IRR/release gates remain.
Provider account/regional support and existing provider-after-commit/best-effort
audit limits are unchanged. The outgoing delivery service is called explicitly;
this fixture does not claim checkout automatically emits a webhook event.

## Handoff

Complete the evidence-backed controller checks, submit, honest self-review and
done flow, then the authorized scoped commit/push. Verify remote master SHA and
clean tree, report the controller's next task and stop. Parent/domain qualification
tasks retain their independent criteria.
