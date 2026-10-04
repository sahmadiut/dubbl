# MON-069 attempt 1 - exact bank rule contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator coding-assistant. Entry HEAD `8f4244b`, clean
master tracking origin/master. User requested the next task and commit/push on
full completion. Controller validate/status/context selected MON-069 and start
claimed it. One bounded task; no delegation, independent reviewer or human
financial/security approval. Authorization for commit/push is the user's request.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, task/MON-011 evidence, ADR-006, source migration/API compatibility
sections, money manifest and actual rule/auto/import/categorization/matching/
reconciliation/UI/REST/MCP/schema/test sources. Schema unchanged: no migration
generation required. No full build, application dev server or deployment ran.

## Implementation and acceptance mapping

1. `BANK_RULE_WIRE_CONTRACTS.md` inventories all four rule REST resources plus
   account application, existing MCP auto operation and scheduled/import consumers.
   It records envelopes, roles, units/ranges/aliases, condition/split policy,
   output relations, errors, preview/repeat behavior and qualification limits.
   Strict described shared Zod schemas reject unknown fields and malformed JSON,
   canonical signed minor thresholds, invalid combinations/ranges, references,
   array limits, int32 priority and unsupported decimal percentages. Partial
   update defaults are explicitly removed so omitted fields remain unchanged.

   Fixed split amount/amountMinor aliases agree and normalize to existing safe
   numeric JSON storage. Reads return numeric fixed amounts plus exact strings.
   Saved malformed/unsafe/foreign rule configuration fails closed, including
   delete's full-row MCP response. Rule monetary units remain bank minor units,
   never a guessed major-unit or currency-scale conversion. Percentage allocation
   uses exact bigint decimal ratios, half-up minor rounding, original sequential
   fixed precedence/caps and final remainder. Signed parts sum exactly.

   The UI now labels integer bank minor units, retains exact aliases while editing
   and rejects invalid fixed text before saving. It no longer silently multiplies
   thresholds by 100. Existing numeric API money remains the same minor units.
   Backend output defaults/envelopes are preserved, including MCP list relations,
   full deleted rule, original REST keyword suggestions and MCP description
   patterns. The new get_bank_rule supplies detail parity; keywords are available
   in the existing suggestion tool via style. Every exposed input field describes
   units/expectations. No public exact-mode negotiation or full-int64 promise.

2. Actual exported REST/API-key/custom-role handlers and eight registered SDK MCP
   operations run in `tests/integration/bank-rules-worker.ts` on migrated isolated
   PostgreSQL. Fixture groups verify legacy numeric and exact-only/dual clients,
   CRUD/list/detail/suggestions/application/auto, spoofed organization headers,
   two tenants, expired/invalid keys, read-only/config-only/banking-only roles,
   active owned top-level/split refs and foreign/corrupt saved references.

   Application is one transaction with the organization lock used by manual
   banking/payment writers. It selects only active banks and uncategorized,
   unlinked, unreconciled lines; pending/zero/excluded/transfer/session/journal
   lines skip. Hidden cash/expense history rejects. Existing bank GL, movement
   contact/tax/dimension ownership is also validated. Preview returns matches
   without mutations, not complete posting viability. Nonposting rules assign
   metadata without reconciliation. Single automatic and split rules reuse
   MON-065's exact tax/FX/GL/lock posting services in the caller's transaction.
   Splits now produce one linked journal/one bank leg and preserve top contact,
   enabling MON-068 undo instead of leaving orphan split journals. Import rule
   suggestions use the same validated evaluator and remain unreconciled.

   Automatic matching now selects cash on each specific bank GL rather than
   netting several banks. SQL sums remain text/bigint. Signed exact amount equality
   precedes fuzzy text/date ranking; tied confidence skips. Manual journals use
   existing qualification/marking. Existing received/made payments use payment
   matching, maintain both links and do not resettle invoices/bills. Recognition,
   noncash carriers, transfers/other domain postings are excluded. Calls serialize
   with manual matching/coding/undo and qualify saved FX/history/date locks/audit.
   Scheduled matching records an actual owner member's UUID (no custom override),
   skipping orgs without such a member; no imaginary human or system actor.

3. SQL-text business/audit snapshots prove no committed effects on invalid input,
   unsafe thresholds/fixed JSON/DB amounts, foreign primary/nested refs, malformed
   JSON, period locks and injected audit faults. CRUD/application faults roll back
   state/journals/numbering/audit. Automatic linking faults preserve statement and
   payment history. USD/JPY/KWD/IRR fixtures retain integer 1250; safe maximum and
   3-billion-unit journals/splits preserve exact sums. Split tax and saved FX are
   qualified by shared services. Undo reverses created rule journals and detaches
   existing manual/payment links without reversing pre-existing cash. Concurrent
   application and manual coding create one exclusive journal; concurrent cash
   matching links an entry once. Repeated application does not repost eligible
   categorized/linked lines. No replay-key or cached-response guarantee is added.

## Verification

All commands ran in D:/Projects/dubbl. Synthetic PostgreSQL18 cluster at
D:/Temp/dubbl-mon069-pg-d4198d693cc94147a546b14605ae50a8/data, loopback port 55479,
trust auth for fixtures only. Explicit synthetic TEST_DATABASE_URL creates,
migrates and drops random isolated databases; it does not use/reset the .env
database. Worker external provider keys are blank. Final fixture DB count 0;
fast/wait server shutdown succeeded. Cluster remains outside the repository;
temporary path note removed. No credentials or real customer data recorded.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start and final pre-submit validate | Exit 0; valid 119-task graph | Structural, not product proof |
| node --import tsx --test tests/bank-rule-wire.test.ts | Exit 0; 4/4 pure groups | Exact contracts/evaluator/splits only |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 202/202 pass, none skipped | Broad units before final scoped-reference/JSON refinements |
| Eight integration suites, --test-concurrency=2: bank-rules, bank-imports, bank-categorization, bank-document-matches, bank-reconciliations, bank-transfers, payment-settlements, payment-reversals | Exit 0; 8/8 pass | Migrated PostgreSQL18; before final target refinements |
| Final node --import tsx --test tests/bank-rule-wire.test.ts tests/integration/bank-rules.test.ts | Exit 0; 5/5 pass, none skipped | Includes expanded safe maximum, pending/zero, malformed JSON, foreign bank GL/movement refs and fault/race worker |
| Final npx tsc --noEmit | Exit 0 | Existing generated sources; no build |
| Final npm run lint | Exit 0; 0 errors/148 existing warnings | Baseline count retained |
| Affected files npx eslint | Exit 0; no warnings | Before final JSON/scope guards; full lint above covers final source |
| money_inventory.py --write, then without --write | Exit 0; 410 columns, 1530 scanned files, 1234 consumers, 24228 occurrences | Lexical work queue, not full dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; source hashes/lines and Drizzle columns match | No financial runtime qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Legacy lint guard |
| Final source git diff --check | Exit 0 | LF/CRLF notices only |
| git fetch origin and HEAD...origin/master count | Exit 0; 0 ahead/0 behind before task commit | Remote inspected before authorized push |

Intermediate findings: pure aliases/partial-default tests passed. Integration
initially expected a payment match despite insufficient fuzzy confidence; fixture
description/reference now mirror its actual saved journal. An intentionally bad FX
fixture violated the database's coexistence guard when only rateExact changed;
paired exact/legacy fields now change together to reach the service qualification
check. Typecheck found DTO union inference lacked optional amountMinor; explicitly
typed split output fixed it. Removed one newly unused import; final lint restores
148 baseline warnings. Review also restored original list/delete/suggestion
response fields and added malformed JSON and pre-existing foreign-reference guards.
No test assertions were weakened to permit precision loss, mutation or bad scope.

## Review and handoff

Actual implementing-assistant self-review: MON-069-review-1.md. No bounded-task
blocker remains. Complete controller check/submit/self-review/done, validate/status,
then the user-authorized commit/push and stop. MON-021 retains combined integration;
full-int64 consumers, historical remediation, foreign balance proof, independent
accounting/security, actual provider/OAuth/browser/PostgreSQL16/production and IRR
release enablement remain separate gates. No approval for them is inferred.
