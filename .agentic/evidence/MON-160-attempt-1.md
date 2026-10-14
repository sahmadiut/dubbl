# MON-160 attempt 1 - public rendering export and provider consumers

## Identity

2026-10-14, Asia/Tehran. Operator coding-assistant (Codex), self-review.
Entry master HEAD 238e9bb78db85d14a2446f0e580afca15eee44e7. The only pre-existing
working-tree change was this task's controller start from the previous incomplete
investigation; preserved and resumed. User authorized complete and push next task.
Live validate/status/next selected MON-160 with no unmet dependencies. Read root
and nested rules, controller/project/repository map, role, task, MON-007 evidence,
actual source and public/render/provider/export/backup/opaque operation registries.
The memory Dubbl controller-task skill guided the bounded workflow.

## Implementation and acceptance mapping

1. lib/money/public-ui.ts checks canonical agreeing safe numeric/Minor aliases
   and saved currency before payment/portal state adoption. Validated fields
   include hidden quote totals, line tax/price/amount and physical quantity.
   Statement running/total balances use bigint and reject currency disagreement.
   Public payment and portal invoice/payment/quote/statement pages use these
   adapters; failed HTTP/malformed successes produce alerts instead of empty
   data/zero balances. Obsolete token read effects are ignored. Quote acceptance
   validates successful saved output, disables duplicate in-flight action and
   exposes failures. Checkout missing a URL fails explicitly. Payment quantity
   uses exact documentHundredths independently of money scale.

   New lib/api/client-response.ts checks status and PDF content type before blob
   downloads. Public invoice/statement downloads, template HTML/PDF previews and
   shared email document PDF preview use these guards. Shared SendDocumentDialog
   requires saved currency for already validated parent amounts, displays an
   explicit invalid amount alert and prevents email send/preview in that state.
   Removed its legacy USD formatMoney fallback and corresponding baseline entry.
   Preview button links now satisfy the existing HTTP URL schema. ExportButton
   catches existing guarded CSV generation errors. Billing and Stripe settings
   failed status reads show unavailable states rather than default free or
   disconnected success; billing checkout/portal validate HTTP responses.

   Audited and reused existing signing SSR, email/HTML/PDF, generic import/export,
   backup/opaque and provider services instead of creating duplicate contracts.
   PUBLIC_RENDER_EXPORT_UI_CUTOVER inventories complete consumer families and
   exceptions: physical hundredths/basis points, CSV fixed-two compatibility,
   literal opaque strings, byte-preserving backup forwarding, quotas/counts and
   static integer USD subscription price labels/configured provider price IDs.
   Provider supported scales/currencies/bounds remain unchanged. No schema,
   migration, API/MCP operation, production flag, provider or deployment change.

2. Six new pure behavior/static groups cover low digits 3000000001/3000000002,
   negative one minor unit, USD/JPY/KWD/synthetic IRR display, required canonical
   aliases, hidden conflicting tax/billed total, unknown currencies, unsafe
   amounts/derived sums, malformed envelopes, statement running/total/currency
   disagreement and failed/non-PDF responses. Email currency and signed low
   digits are verified independently. A scoped static guard rejects legacy
   imports, numeric coercion, float/fixed-two rounding and /100 math in public
   amount pages/email component.

   Enhanced public-portal-wire worker feeds actual REST and registered MCP
   outputs to the same consumers and compares parsed results. Real failure
   envelopes reject. Four USD/IRR/JPY/KWD saved invoice/statement workflows
   independently query SQL total::text = 3000000001, amount_due::text = -1251 and
   saved currency, and reject altered aliases. Existing grant/tenant/contact/
   period/state/expiry, repeated acceptance, activity-write rollback, malformed
   payload, unsafe historical data, statement overflow and mixed-currency
   negatives remain. Joint real rendering/export/backup/provider/opaque/public
   regressions verify the retained consumer contracts, signed events, immutable
   snapshots/proof, captured provider/email adapters and unsupported currencies.

3. Added PUBLIC_RENDER_EXPORT_UI_CUTOVER, MONEY_MANIFEST, TEST_MATRIX and money
   README mapping. money_inventory.py now assigns scoped consumer ownership and
   unit exceptions to MON-160; regenerated reproducible MONEY_BOUNDARIES.
   Legacy baseline removes only the shared email allowance. MON-008 remains
   independently open; no parent acceptance is inferred.

## Database and verification

All commands ran in D:/Projects/dubbl, Node 23.11.0 and PostgreSQL 18. Dedicated
synthetic trust-authenticated cluster at
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon160-pg-7fee3db511d148619d9f45b8f327a439,
loopback 127.0.0.1:55460, synthetic dubbl_ci role, UTC,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL and matching
PG_BIN selected only this cluster. Wrappers create/migrate/drop randomized
fixture databases. Final database count zero; pg_ctl fast shutdown passed.
Temporary cluster files remain. No application .env/database was read or
modified, and no full build, dev server, Docker or live provider action ran.

Joint command: node --import tsx --test --test-concurrency=2 with these files:

```text
tests/integration/public-portal-wire.test.ts
tests/integration/document-rendering.test.ts
tests/integration/generic-import-export.test.ts
tests/integration/backups.test.ts
tests/integration/stripe-contract.test.ts
tests/integration/opaque-public-integration.test.ts
tests/integration/public-boundaries-integration.test.ts
```

| Command / procedure | Actual result | Limit |
|---|---|---|
| Joint integration command above | Final exit 0, 8/8, 69.814 seconds | Disposable real REST/MCP/SQL and captured adapters; no live provider delivery |
| node --import tsx --test tests/integration/public-portal-wire.test.ts | Exit 0, 1/1 | Focused consumer composition after fixture syntax correction |
| pnpm test | Final exit 0, 519/519, 20.238 seconds | Six new behavior/static groups plus full pure suite/link checks |
| pnpm typecheck | Exit 0 | MDX and tsc only |
| pnpm exec eslint scoped changed TS/TSX files | Exit 0, zero errors | Three existing warnings in template/Stripe settings; shared email/export/adapters/tests clean |
| pnpm lint | Exit 0, zero errors/91 existing warnings | Whole repo warning count remains |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0 | 415 columns, 2082 scanned files, 1564 consumers, 30395 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle columns, source hashes/lines and occurrences |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy money gate |
| python .agentic/agent.py validate | Exit 0, 215 tasks | Structure only, repeated after completion |
| git diff --check | Final exit 0 | Whitespace; LF/CRLF notices only |
| psql disposable fixture database count; pg_ctl fast stop | 0 databases, exit 0 shutdown | Dedicated synthetic cluster only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before delivery commit | Live remote synchronization |

Initial typecheck caught an inferred () => true callback type and an await inside
a synchronous test assertion. Corrected both; the final focused/joint fixtures
and typecheck passed. Changed-file lint caught synchronous state reset in three
effects; resets now run in guarded microtasks and lint passes. Initial README
append had an extra blank line at EOF; corrected and final diff check passes.
Wrong speculative source paths were corrected during discovery and are not
successful checks. No product test failure was suppressed or weakened.

## Review and handoff

Honest self-review in MON-160-review-1.md by the implementing coding-assistant.
No scoped blocker remains. Complete controller check/submit/self-review/done,
commit only owned files, push origin/master and confirm live remote SHA/clean
tree. No commit or push result is invented in this pre-delivery evidence.

Browser effects/layout, native-language review, hosted CI, production IRR,
full-int64 business acceptance, migration/release and actual provider delivery
remain unqualified. DEC-005 permits behavioral/static verification without
screenshots. MON-008 and remaining report/background child/integration tasks
retain their independent acceptance and no next task is started here.
