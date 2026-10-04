# MON-066 attempt 1 - exact bank document matching

## Identity

2026-10-04, Asia/Tehran. Operator codex, implementing assistant; self-review only,
no delegation, independent financial/security review or production approval.
Entry HEAD 7539a34, master, clean working tree. Controller validate/status/context
selected MON-066, claimed with owner codex. User requested completion, commit
and push. This evidence describes verified work before controller closure/commit;
it does not invent a future commit SHA.

Read root/nested AGENTS, START_HERE/controller/project/repository map/backend role,
MON-011 dependency evidence, ADR-006, task/manifest/source migration/compatibility
sections, and MON-042/045/048/051 carrying/settlement handoffs. Source inspection
found separate floating/unlocked matching writers; existing MON-056 exact
settlement services supply the reusable qualified recognition/carrying path.

## Implementation

- Strict described bank-document-match-wire schemas accept numeric positive
  integer minor amounts and additive canonical amountMinor; aliases agree and
  exact bigint sums remain inside safe Number coexistence. Targets must be
  unique and agree with matchType; duplicate documents/unknown fields fail.
- Shared bank-document-matches direct-DB services replace three REST POST writers
  and the match-invoice GET. GET match remains the existing MON-063 service.
  Six MCP tools register in a dedicated file; the three replaced legacy tools
  are removed from bank-transactions.ts. Existing MCP transactionId/link/status
  envelopes remain; split/read/existing-journal tools supply missing counterparts.
- New settlements reuse MON-056 rather than duplicating financial logic. One
  internal transactional banking adapter retains manage:banking authorization;
  ordinary payment APIs still require manage:payments. Payment/header/allocation,
  recognition/carrying/cash/realised FX, numbering/document updates/bank links and
  audit share the same DB transaction. Bank balances/statement units do not change.
- Full statement coverage, direction/same currency, outstanding payable and one
  contact are enforced. Old partial or multi-contact reconciliation could hide
  residual cash or create invalid history; unsupported cases now reject visibly.
  Reverse-charge bill payable and qualified credit/debit/prepayment carriers
  retain exact carrying semantics. Noncash carriers cannot match existing cash.
- Existing cash matches validate saved payment/journal/allocations/control legs,
  same bank/currency/amount/direction, source/date and audit cash/rate/base history.
  No relabelling to another bank, current quote lookup or new posting occurs.
  Direct journal matching validates complete balanced owned GL/dimensions and
  exact bank net, limited to base-currency identity FX. Payment/expense/transfer/
  noncash application history cannot bypass its workflow. A deposit's qualified
  real cash receipt may match its journal without applying the deposit.
- Organization/bank/movement locks scope ownership before money decoding, then
  serialize document/history/linking and competing exclusive matches. Period/
  fiscal, active/exclusive bank GL, prior link/expense/transfer/session guards apply.
  Serialization checks run before commit, including newly created aliases.
- Public API/MCP/module docs, money README, BANK_DOCUMENT_MATCH_WIRE_CONTRACTS,
  manifest, test matrix and generated source inventory are updated. No schema,
  migration-file, historical remediation or currency rollout change.

## Acceptance mapping

1. Registry inventories every REST/MCP input/output/envelope, units, defaults,
   aliases, supported ranges/FX, errors, retry behavior and explicit unsupported
   partial/mixed-contact/foreign-direct-journal/legacy-history cases. Public docs
   match these contracts. Two pure groups exercise safe maximum/canonical syntax,
   alias agreement, exact allocation totals and duplicate/overflow rejection.
2. Actual exported REST handlers use API-key AuthContext, invalid/expired keys,
   banking-only/viewer custom roles and spoofed organization headers. Registered
   MCP SDK tools execute through InMemoryTransport with strict described schemas,
   all six adopted tools, numeric/exact/dual clients and two organizations.
   Real create/send/receive services produce recognized invoice/bill fixtures.
3. Before/after SQL-text snapshots assert unchanged financial/numbering/audit state
   on money/range/scope/state/history errors. Tests cover safe maximum, unsafe
   persisted statement/document values, directions, over/underpayment, duplicate
   or mixed-contact allocations, foreign documents/GL, inactive/shared bank links,
   period/fiscal locks, reverse-charge payable and all currency scales.
   Credit/debit/prepayment application carriers remain noncash; residual settlement
   preserves balances and saved carrying. Payment journals retain recognition
   1.5 FX and later cash 2 FX with a separate realised leg; existing cash links
   still succeed after live quotes are deleted. Altered allocations/saved rates
   reject. Forced bank-audit failures roll back new payment/numbering/document/
   journal/link writes and existing payment/journal links. Statement, document,
   payment and journal races each leave one successful exclusive match.

## Verification

Commands ran in D:/Projects/dubbl with installed dependencies. PostgreSQL 18
synthetic loopback cluster port 55476 at
D:/Temp/dubbl-mon066-pg-3f3e1d89805d467d8a42b29230e41483/data, trust-auth fixture
only. Explicit synthetic TEST_DATABASE_URL creates/migrates/drops random disposable
databases; the configured .env database is not read/migrated/reset. Provider keys
are blank in workers. Final disposable database count 0; fast/wait shutdown passed.
Cluster files remain outside the repository.

| Actual command/check | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119-task graph, MON-066 selected/claimed | Workflow structure only |
| `node --import tsx --test tests/bank-document-match-wire.test.ts` | 2/2 pass | Pure schemas/arithmetic |
| `npm test` final | Exit 0; 193/193 pass | Unit suite, no DB/browser proof |
| `node --import tsx --test --test-concurrency=2` with bank-document-matches, payment-settlements, payment-batches, scheduled-payments, bank-accounts, bank-transaction-reads, bank-imports, bank-categorization under tests/integration | Exit 0; 8/8 pass | Actual migrated PostgreSQL handlers/SDK; synthetic PostgreSQL 18 only |
| `npm run typecheck` | Exit 0; MDX generation and tsc | No build |
| `npm run lint` | Exit 0; 0 errors/148 existing warnings | Existing warning baseline retained |
| `npx eslint` all changed TS/handler/MCP/fixture paths, final | Exit 0; no warnings | Bounded source lint |
| Money inventory `--write`, read-only verify | Exit 0; 410 columns/1512 scanned/1226 consumer files/24011 occurrences | Lexical inventory, not financial approval |
| `verify_money_inventory.mjs`, `verify_legacy_money.mjs` | Exit 0; 410 schema columns/1226 hashes and 9 regression guards | Structural/legacy gate |
| `git diff --check` | Exit 0 | LF/CRLF notices only |
| `git fetch origin master`, divergence query | Exit 0; 0 ahead/0 behind before commit | Requested fork only |
| Synthetic psql database count / pg_ctl shutdown | 0 disposable databases; exit 0 server stopped | No target .env data touched |

Development failures were repaired: route migration marker, fixture syntax/service
envelopes, nullable balance preflight, field descriptions after Zod unwrap and a
test's mistaken treatment of real deposit receipt cash. Corruption fixtures now
update both FX aliases to satisfy the DB trigger before testing application-level
history rejection. Final tests validate the corrected behavior. Two expanded
eight-worker runs failed during migrations with PostgreSQL `out of shared memory`
and max_locks_per_transaction hints; source was not the cause. Reducing runner
concurrency to two made all eight suites pass without changing database settings.
These failed development runs are not claimed as passing checks.

No full build, Next dev server, Docker, production migration/deployment, provider
request, browser/session/OAuth or independent financial/security qualification.
Safe-number coexistence is not full-int64 or production IRR acceptance. Other
legacy writers/period configuration do not all use the adopted locks yet.

## Review and handoff

Actual self-review is MON-066-review-1.md. No bounded task blocker. Close through
controller, commit/push as authorized and stop. Next task MON-067 exact banking
transfer contracts. MON-068/MON-021 retain safe undo/session coordination and
combined payment/expense/banking/AUD-002 accounting acceptance. Historical repair,
full-range/migration/provider/security/financial/IRR gates remain separate.
