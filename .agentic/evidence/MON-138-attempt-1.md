# MON-138 attempt 1 - bill creation UI money

## Identity and scope

2026-10-11, Asia/Tehran. Actual operator: coding-assistant; self-review only.
Entry master HEAD 45963007b56fea95fd7bc497c28a9eeab40ca2e2, clean working tree.
The user authorized completing and pushing the next task. Live controller
selected MON-132. Source inspection confirmed separate bill create, saved bill,
debit note, procurement and recurring contracts. Created MON-138..142 with
inherited prerequisites and source sections; validated and used controller split
to queue MON-132. Live next selected MON-138 and it was started. All original
MON-132 criteria remain unchecked. This evidence precedes commit/push.

Read root/nested instructions, START_HERE/controller/project/map/frontend role,
selected/parent/dependency tasks and evidence, money architecture source,
CORE_UI_MONEY_CUTOVER, MONEY_MANIFEST, lexical inventory, exact/document inputs,
bill write/read calculators/services/REST/MCP registration, tax-rate lookup and
disposable database fixtures. No existing monetary unit is changed.

## Implementation and acceptance mapping

1. BillDrawer and the shared editor's explicit bill policy have semantic ownership
   in CORE_UI_MONEY_CUTOVER/MONEY_MANIFEST. bill-editor.ts keeps decimal prices
   as unitPriceExact text and uses the adopted bill schema/calculator. Preview
   amounts are bigint. REST and MCP both use extended-price rounding: USD 0.005
   times 3 previews/saves 2 minor units, while saved unit price is 1 minor unit.
   Supplier/org currency GETs resolve REST's selected/supplier/org/USD chain.
   Explicit currency is included in UI writes; MCP's omitted USD default remains
   unchanged. Context keys and aborted fetches reject stale supplier/org results;
   the editor remounts on org changes. Failed lookup leaves totals unresolved and
   offers explicit selection. Reverse-charge tax stays in document total but is
   excluded from the separate Amount due preview. A missing selected tax/kind
   blocks preview. Existing registered direct-DB create_bill already accepts
   these exact fields; no additional public operation or MCP change is needed.
2. Four adapter tests and two real React render tests cover USD/JPY/IRR/KWD,
   safe-edge low digits, extended-price signed ties, sum/product/range guards,
   malformed prices, currency fallback, missing/invalid tax controls, fractional
   and supplied zero quantity, blank defaults and reverse-charge payable. Shared
   rendered editor regressions retain invoice/compatibility output. The new
   migrated SQL fixture invokes authenticated supplier/org GET, bill POST/read
   and actual registered MCP SDK create_bill. It independently reads SQL text
   prices, line amounts/tax, account/tax IDs and hundredths quantities; totals,
   amount due and returned Minor aliases agree with the preview. It also checks
   duplicate warn/confirmation, unoverrideable block, hold and pending approval.
   Existing bill write/read/lifecycle suites retain role, tenant, lock, audit and
   transaction policy coverage. English input labels, decimal keyboard mode,
   scrolling, exact totals and invalid alerts are rendered and asserted. Save,
   duplicate-confirm and asynchronous currency handling are source reviewed;
   no live browser effects or race qualification is claimed.
3. Bill creation no longer parses monetary prices into Number or relies on the
   shared fixed-two/default invoice preview. Both create and duplicate-confirm
   actions require resolved valid preview; submission reparses prices and
   rejects blank descriptions before HTTP. Supplier/currency/line changes clear
   obsolete duplicate warnings. Success text uses saved pending_approval status
   so duplicate-held bills receive the correct notice. Quantity remains the
   existing numeric physical control stored in hundredths; tax/recovery rates
   retain basis points. Blank price means zero and blank quantity means one;
   supplied zero remains zero. Safe-number workflow limits are intentionally
   retained, rather than claiming a full signed-int64 public workflow. Saved
   bill/debit/procurement/recurring consumers remain MON-139..142. Other shared
   callers retain their documented compatibility defaults and ownership.
   MON-132, MON-129 and MON-007 retain independent combined acceptance. No schema,
   migration, history rescale, FX policy or production IRR flag changed.

## Verification

Commands ran from D:/Projects/dubbl. No full build, Next dev server, Docker,
deployment, provider/email send, application DB or .env access was used.

| Command | Actual result | Scope and limits |
|---|---|---|
| node --import tsx --test tests/bill-editor-money.test.ts tests/bill-editor-components.test.ts tests/document-editor-components.test.ts | Exit 0, 9/9 | Actual adapters/React render, no browser effects |
| node --import tsx --test --test-concurrency=2 tests/integration/bill-editor-money.test.ts tests/integration/bill-writes.test.ts tests/integration/bill-reads.test.ts tests/integration/bill-lifecycle.test.ts | Exit 0, 4/4 | Authenticated REST, registered MCP and migrated SQL |
| pnpm test | Exit 0, 402/402 | Complete repository unit suite |
| pnpm exec tsc --noEmit; pnpm typecheck | Exit 0 | TypeScript and MDX generation |
| pnpm exec eslint on seven changed/new TS/TSX files | Exit 0, no warnings/errors | Scoped source and tests |
| pnpm lint | Exit 0, 0 errors, 105 existing warnings | Warning count unchanged from preceding task |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0 | 415 columns, 1963 scanned files, 1461 consumers, 27850 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle classification/source hash/line checks |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy money regression guard |
| python .agentic/agent.py validate | Exit 0, 192 tasks | Structural workflow, not financial qualification |
| git diff --check | Exit 0 | Whitespace check |
| psql fixture count; pg_ctl fast stop | Count 0; exit 0 | Disposable databases removed, dedicated cluster stopped |

Initial task-generation validation rejected priority 4; corrected to the
controller-supported value 3 before splitting/starting. An attempted inventory
--verify flag was rejected because the script uses its default invocation for
verification; that correct command and the independent verifier passed. No
failing command is represented as a pass.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon138-pg-4439de6c56c7412f9d37c81a2a865d57,
127.0.0.1:55438, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL selected
this server. Harnesses created/migrated/dropped random dubbl_ci_* databases;
workers received disposable DATABASE_URL. No application data was read/changed.
Final fixture count was zero and dedicated server stop passed; cluster files
remain in the temporary directory.

## Review and handoff

Actual self-review: MON-138-review-1.md. No scoped blocker. Complete controller
checks/submit/self-review/done, commit task-owned files and supporting split
records, push origin/master, verify remote SHA/clean tree and query next task.
Stop after this child. Browser interaction, financial/human approval, production
IRR and parent integration qualification are separate and unclaimed.
