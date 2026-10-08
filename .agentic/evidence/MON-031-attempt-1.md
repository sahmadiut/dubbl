# MON-031 attempt 1 — payment provider and webhook contracts

## Identity

2026-10-08, Codex, D:/Projects/dubbl, master; entry HEAD c56803e, clean tree.
Implementation was uncommitted when these checks ran. No unrelated changes were
present at entry or during the final status inspection. Self-review only.

Fixtures used a temporary PostgreSQL 18 trust cluster, task_mon031 on
127.0.0.1:55531, UTC. Explicit TEST_DATABASE_URL selected this server; integration
fixtures created/migrated/dropped random dubbl_ci_ databases. The application's
DATABASE_URL and provider credentials were not read or used. Synthetic example.test
data and dummy Stripe secrets only; all provider requests and outgoing HTTP fetch
were mocked. No real charges, subscriptions, messages or webhook sends occurred.

## Implementation result

- `lib/integrations/stripe/{money,csv-parser,import}.ts`: currency-specific exact
  CSV decimal parsing and canonical Minor columns; agreeing aliases and complete
  input preflight; shared REST/MCP implementation and correct charge fee posting.
- `lib/integrations/stripe/{checkout,billing}.ts` and checkout/webhook routes:
  paid-total/currency/org/link snapshot checks, balance conservation, atomic
  payment/allocation/invoice updates, concurrent PI replay guards and shared
  invoice/subscription checkout operations. Invalid plans/config reject before
  external customer creation. Native subscription requests retain Price IDs.
- `lib/integrations/stripe/sync.ts`, initial-sync, retry consumption and
  `lib/api/numbering.ts`: all exported handlers use shared scoped org-serialized
  transactions, current account/map ownership, fiscal/period checks, exact local
  balance arithmetic, checked provider amounts/fees and correct fee currency.
  Numbering participates in the transaction. Existing invalid UUID placeholders
  in failed-payment/subscription metadata mappings now use the integration UUID.
- Reconciliation service independently checks organization before provider access,
  validates whole bounded days and projects safe signed amount/amountMinor with
  currencyCode. Local mapping money/item DTOs add agreeing Minor strings.
- `lib/webhooks/{payload,deliver,fire}.ts`: payload validation precedes insertion
  and queuing; canonical JSON/HMAC bytes survive jsonb reordering on retries;
  safe bigint preserves numeric values. Inactive/deleted endpoints are skipped.
  REST delivery/status JSON is guarded; MCP webhook mutations now mirror REST
  permissions. Added create_invoice_checkout and create_billing_checkout to
  already-registered tool modules, with described schemas and direct DB services.
- Updated money manifest/inventory and the full boundary registry. No schema or
  migration changes. Updated the existing portal fixture's tool inventory for
  the additional invoice checkout tool.

## Acceptance mapping

1. `registries/PROVIDER_WEBHOOK_WIRE_CONTRACTS.md` inventories each native,
   public, authenticated REST/MCP and internal boundary, inputs/outputs, units,
   explicit aliases, currency/amount support policy, failures and limits.
2. `tests/integration/stripe-contract-worker.ts` calls actual route exports with
   API keys and actual registered MCP tools through InMemoryTransport against
   migrated PostgreSQL. Legacy/exact CSVs, max-safe values, two-tenant/denied-role
   cases, direct initial sync and retry, signed event validation, positive
   charge/refund/dispute/invoice/transfer/credit/subscription lifecycles, USD/JPY
   fee units, paid checkout and concurrent repeats, balance assertions and HMAC
   retry bytes are exercised. Related invoice/payment/public-portal fixtures pass.
3. Invalid CSV amounts/aliases/dates/currencies reject before any file row writes;
   unsafe provider prices/refunds/fees, scope and period failures leave financial,
   contact/account/config/credit/numbering/audit snapshots unchanged. A late
   invalid fee retrieval rolls back the preceding revenue/contact/map writes.
   Stale/mismatched checkout cannot record a different invoice balance; a new PI
   cannot silently settle an already-paid invoice. Invalid outgoing bigint is
   rejected before delivery insertion/fetch. Reconciliation returns classified
   range errors rather than rounded Numbers. No provider raw alias injection.

## Verification

All commands ran in D:/Projects/dubbl; exit 0 unless the diagnostic history below
states otherwise. No build or dev server was run.

| Command | Actual result |
|---|---|
| `pnpm test` | 357/357 unit tests passed |
| `node --import tsx --test tests/stripe-money.test.ts` | Final helper-focused check, 3/3 passed |
| `node --import tsx --test --test-concurrency=1 tests/integration/stripe-contract.test.ts tests/integration/public-portal-wire.test.ts tests/integration/invoice-writes.test.ts tests/integration/payment-settlements.test.ts` | Four targeted integration groups passed |
| `node --import tsx --test tests/integration/stripe-contract.test.ts` | Final dedicated fixture passed after additional JPY fee, initial-sync, duplicate checkout and snapshot assertions |
| `pnpm typecheck` | Passed, including final source/fixtures |
| `pnpm lint` | 0 errors, 109 existing warnings |
| Changed TypeScript files via `pnpm exec eslint` | Final check passed, no warnings/errors |
| `python .agentic/scripts/money_inventory.py --write` then verifier | 415 columns, 1391 consumers, 26300 occurrences; inventory generated and verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine gate regression checks passed |
| `git diff --check` | Passed |
| `python .agentic/agent.py validate` | Valid, 173 tasks; structural verification only |

Early fixture failures exposed an incorrectly named synthetic bank-account field,
the old portal fixture's expected tool count, SDK non-JSON schema error text, and
the existing failed-payment UUID placeholder. Those were corrected; the final
runs above passed. This does not erase those diagnostic runs or claim that the
whole repository integration suite or live providers were tested.

## Review and limitations

Codex self-review: source/diff, preflight order, monetary arithmetic, transaction
propagation, source/reference ownership, signatures, test assertions and registry.
The review is not an independent peer or human accounting/security approval.

Application support is deliberately explicit: same-scale qualified zero/two
decimal currencies, safe numeric coexistence, conservative checkout ceiling and
no implicit functional-currency FX. Three-decimal/provider-scale exceptions and
live provider account/network availability remain unsupported/unqualified.
Existing notification hooks and provider network actions are not atomic with the
database. Failed provider attempts keep diagnostic logs; CSV business failures
remain row-atomic, and initial-sync completion denotes attempt completion rather
than every object succeeding. Existing accounting audit defects and final parent
integration acceptance remain separate. No production qualification, browser,
full build, dev server, schema/migration, application DB access or IRR rollout.

## Handoff

All three MON-031 criteria are supported by the registry and actual checks.
Submit and self-review this task, then commit/push task-owned changes to
origin/master and verify the remote SHA/clean tree. Stop after this bounded task.
Next selection is computed by the controller; MON-016 retains final integration.
