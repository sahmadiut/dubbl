# MON-135 attempt 1 - saved invoice and settlement UI money

## Identity and scope

2026-10-11, Asia/Tehran. Actual operator: codex; honest self-review only.
Entry master HEAD 4caa61e99fcf5cfe497b2368753cdfbd1b06ed61, clean tree.
Live controller selected MON-135 and it was claimed through start. The user
authorized completion and push of one task. This evidence precedes the commit.
No parent or sibling task is completed by this child.

Read root/nested instructions, controller/project/map/frontend role, selected
task and dependency evidence, money/migration/source sequence sections,
CORE_UI_MONEY_CUTOVER/MONEY_MANIFEST/lexical inventory, adopted invoice/payment/
credit/lifecycle wire and REST/MCP contracts, actual UI and disposable SQL harness.
The memory controller skill was used for one-task/scoped commit verification.

## Implementation and acceptance mapping

1. Ownership is explicit in CORE_UI_MONEY_CUTOVER, MONEY_MANIFEST and TEST_MATRIX.
   invoice-ui.ts validates canonical Minor aliases against retained safe integer
   numeric raw units, with a checked legacy-only fallback. Fetch boundaries
   normalize invoice headers/lines, summaries/aging, payments, credits and nullable
   base amounts to bigint. Exact English currency-scale display retains low
   digits. Bigint sums/ratios drive aging and payment progress; only bounded
   presentation percentages become Number. No second FX conversion is applied.
   Summary currency is used explicitly; missing/mixed-currency summary money
   displays a dash rather than a plausible USD zero. Recent payments use saved
   currency. Invoice GET history is allocation money without a currency tag,
   explicitly displayed in invoice currency per invoice-reads.ts.

   Payment and custom late fee inputs use explicit currency prefixes, currency
   scales, text/decimal keyboard mode and labels/invalid alerts. Invalid,
   nonpositive, fractional-minor and unsafe inputs disable submit. Handlers
   reparse and write existing amountMinor fields. Blank late fee retains the
   configured interest workflow. Same-currency credit min/due uses bigint and
   writes amountMinor. Copy payloads use explicit saved currency and
   unitPriceExact, retaining tax, discount, account/cost-center/project/inventory/
   warehouse/price-list dimensions. Balance actions await refreshed invoice,
   base amounts, payment history and credits. Main money fetches are aborted
   on context change; loaded and credit contexts prevent showing old amounts
   or credit actions while another organization/invoice loads.

2. Five pure/rendered cases verify USD/JPY/synthetic IRR/KWD scale, large safe
   low digits, malformed/range/alias failures, signed display, nullable base
   amounts, aging/progress, credit currency/positivity, copy dimensions/tax and
   REST preview calculations. Actual React output verifies exact English source/
   base display, labels, decimal mode and aria-invalid/alert behavior. The SQL
   fixture uses real authenticated REST and registered MCP read/create/update/
   payment/customer-credit/custom-interest operations across the same currencies.
   Independent SQL text verifies copied/edited prices, tax/cost center/discount/
   quantity, cash/credit paid and due balances, and late fee price. Large safe
   draft/copied amounts retain low digits; no large-posting-range claim is made.
   Existing invoice-read/lifecycle/payment-settlement/credit workers pass their
   tenant, role, lock, unsupported-history and atomicity cases.

3. Quantity remains physical hundredths, displayed without integer truncation;
   deposit/discount/tax percentages remain nonmoney basis points. No money is
   rescaled. Saved copy prices have already been rounded to minor units; no
   unseen sub-minor source precision is reconstructed. REST copy remains
   price-first and PATCH keeps its extended-price policy. The existing detail
   Edit sheet changes sender/recipient snapshots only; there was no monetary
   line editor to migrate. The exact copied payload is verified through draft
   REST PATCH and MCP update_invoice, with no new editing workflow introduced.
   Shared creation editor stays MON-134. Numeric DualAmount callers and
   currency-less SendDocumentDialog callers retain their prior compatibility
   behavior; this invoice slice passes bigint and explicit currency. Other
   receivable/payable/cash/report consumers remain with their owners, including
   MON-136/137/132/133 and MON-008. MON-131, MON-129 and MON-007 retain independent
   combined acceptance. No REST/MCP operation or schema changed; existing
   registered direct-DB tools already support every adopted input alias.

## Verification

All commands ran from D:/Projects/dubbl. No full build, Next dev server, Docker,
deployment, .env or application database access was used.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/invoice-ui-money.test.ts tests/invoice-ui-components.test.ts | Exit 0, 5/5 | Real adapter and React SSR; no browser interaction |
| node --import tsx --test tests/integration/invoice-ui-money.test.ts | Exit 0, 1/1, final 5.85s | Real REST/MCP/SQL across four currencies, including late fees |
| Focused test-concurrency=2 run including invoice-ui-money, invoice-reads, payment-settlements, credits and invoice-lifecycle | Four existing domain workers passed; new worker initially failed due to missing fixture AR account | Added actual AR/tax fixture accounts; new worker subsequently passed twice, including expanded custom-interest coverage |
| pnpm test | Exit 0, 396/396 | Complete repository unit suite |
| pnpm typecheck | Exit 0 | MDX generation and TypeScript; no full build |
| pnpm exec eslint on eleven changed/new TS/TSX files; final detail-only ESLint | Exit 0 | Three existing sales-list warnings; detail/new source has no warnings/errors |
| pnpm lint | Exit 0, 0 errors, 105 existing warnings | Existing warning count unchanged |
| python .agentic/scripts/money_inventory.py --write, then verify | Exit 0 | 415 columns, 1958 source files, 1456 consumers, 27764 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle classification and source hash/line consistency |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy guard |
| python .agentic/agent.py --json validate | Exit 0, 187 tasks | Structural workflow only |
| git diff --check | Exit 0 | No whitespace errors |
| Synthetic psql fixture count; pg_ctl fast stop | Count 0; exit 0 | Dedicated cluster stopped; temporary cluster files retained |

Initial rendered-input test exposed that CurrencyInput ignored aria-invalid;
added optional forwarding and the same test passed. Initial TypeScript checks
exposed generic Omit losing known fields in indexed records; corrected the
homomorphic mapped return type and fixture annotations, then typecheck passed.
Inventory briefly detected source drift during active editing; final regeneration
and independent verification passed. No failing check is represented as passed.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon135-pg-233c766d84a744bb98f569257abfa947,
127.0.0.1:55435, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL selected this
server. Harnesses created/migrated/dropped random dubbl_ci_* databases; workers
received only disposable DATABASE_URL. No application database was read/changed.
Fixture recognition invokes sendInvoice service and no outbound email/provider
action. Final fixture database count was zero and dedicated cluster stop passed.

## Review and handoff

Actual self-review is MON-135-review-1.md. No scoped blocker. Browser interaction,
full signed-int64 public workflow, production IRR and accounting/linguistic
qualification are not claimed. DEC-005 does not require screenshots. The
controller's mandatory combined parent acceptance remains open. Finish controller
check/submit/self-review/done, commit task-owned changes, push origin/master,
verify remote SHA/clean tree and report the live next task without starting it.
