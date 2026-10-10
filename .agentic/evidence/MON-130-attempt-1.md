# MON-130 attempt 1 - manual and recurring journal UI money

## Identity and scope

2026-10-11, Asia/Tehran. Operator: coding-assistant; honest self-review only.
Entry master HEAD 67b60c1c512b2f0507529b9607788ad63674a1f8, clean tree.
The user authorized completing and pushing the next task. Live controller
selected MON-129. Actual source contained distinct journal, receivable, payable
and cash/tax/account consumers. Created MON-130..133, validated, used controller
split to queue MON-129 for independent combined acceptance, then claimed the
first bounded child MON-130. No original parent criterion was checked or removed.
This evidence was written before the task commit.

Read root/nested instructions, controller/project/map/frontend role, task and
dependency evidence, money architecture/migration source sections, exact money
and domain wire contracts, current journal REST/MCP handlers, actual UI source,
lexical MONEY_BOUNDARIES and integration harnesses. Scope ownership is in
CORE_UI_MONEY_CUTOVER and linked from MONEY_MANIFEST/index/coverage/test matrix.
No schema/migration, public operation, MCP contract, IRR flag or stored history
was changed. Existing registered MCP operations already accept all adopted UI
Minor fields and return exact aliases; parity was verified rather than duplicated.

## Implementation

- Added journal-display.ts: explicit currency major parsing, blank cell zero,
  nonnegative decimal validation, safe workflow bounds, bigint side sums,
  matching preview/write rows, checked fixed-two legacy/Minor agreement, exact
  English fractional display and grouped saved-currency totals.
- EntryForm and EntryDrawer write Minor strings. Invalid/orphan/unsafe/unbalanced
  amounts disable saving. Manual journals retain valid two-sided legs; recurring
  rows separately enforce their existing one-sided policy. Empty unused rows
  are omitted without dropping any positive amount.
- Journal list and dashboard recent journal columns use exact aliases for
  amounts, sort and posted sums. Their untagged raw aggregate presentation
  intentionally remains exact fixed-two compatibility, not converted economics.
- Journal detail reads fixed-two aliases without floating parsing and validates
  them against exact Minor fields. Saved manual/null-source and recurring detail
  use saved currency scales, with totals grouped by currency. Automated GL tags
  can describe original documents rather than amount currency; those branches
  explicitly retain their prior fixed-two display until MON-133 resolves them.
- Draft edits convert saved Minor fields to currency major text, then back to
  the same units. Currency/rate/cost center/project and header fiscalYearId are
  preserved by the payload instead of being silently reset. Added rows inherit
  first-row currency/rate. API/wire rate and balance policies remain unchanged.
- Recurring drawer previews/writes are exact; blank leg memos use the template
  name. New manual/recurring creation keeps its explicit USD/identity defaults.
  Saved recurring detail sums/displays Minor aliases in saved currency, preserving
  the existing verbatim identity posting contract without new FX promises.
- CurrencyInput has optional currency fraction precision, default two unchanged
  for existing callers. Journal inputs have per-line accessible labels. Existing
  horizontal scrolling is retained; edit columns allow currency prefixes.
- Added six pure adapter tests, two actual React render tests, and an authenticated
  REST/registered MCP/disposable SQL editor-payload fixture. Refreshed lexical
  inventory: 415 schema columns, 1947 scanned files, 1445 money consumer files,
  27523 occurrences. Generic lexical owners are supplemented by reviewed section
  ownership, not treated as dataflow/completion proof.

## Acceptance mapping

1. All MON-130 consumers are enumerated in CORE_UI_MONEY_CUTOVER: EntryForm,
   manual and recurring create drawers, manual list/detail/edit, recurring detail,
   dashboard recent journals and shared input precision. Recurring list is
   schedule/count only. Exact adapters replace monetary float parsing, sums,
   sort and formatting in these sections; existing REST/MCP aliases are used.
2. Pure tests cover USD/IRR/JPY/KWD scales, safe-edge low digits, 0.10+0.20,
   malformed/negative/fractional/range/conflict rejection, orphan amounts,
   manual versus recurring side policy, English grouping/negative fractions,
   separate currencies and metadata. Actual rendered forms prove disabled
   invalid/orphan/unbalanced saving, exact totals and accessible text fields.
   SQL fixture independently checks saved raw totals after REST/MCP creation
   and REST edits, exact reads/list aliases, recurring templates and nonidentity
   saved FX. Currency/FX/cost-center persistence is checked in the DB fixture;
   project passthrough is pure wire tested; fiscal-year passthrough is source reviewed.
   Existing journal integration rechecks tenant/role/locks/import/post/reversal/
   schedule behavior. Synthetic IRR inputs do not enable production IRR.
3. The scoped source sections no longer use money parseFloat, decimalToCents,
   floating sums/tolerance, Math.round scaling or toFixed. Fixed-two REST read
   aliases, untagged list totals and automated-source presentation are explicitly
   documented compatibility exceptions. Other create-drawer sections and
   dashboard report widgets are unchanged and assigned to remaining tasks.
   MON-129 and MON-007 remain open for their own integration acceptance.

## Verification

All commands ran from D:/Projects/dubbl. No full build, Next server, Docker,
deployment, application DB or .env access was used.

| Command | Actual result | Scope/limitation |
|---|---|---|
| node --import tsx --test tests/journal-ui-money.test.ts tests/journal-ui-components.test.ts | Exit 0, 8/8 | Actual adapters and server-rendered React; not browser interactions |
| node --import tsx --test --test-concurrency=2 tests/integration/journal-ui-money.test.ts tests/integration/journal-integration.test.ts | Exit 0, 2/2 | Explicit disposable migrated PostgreSQL; real REST/MCP/SQL plus journal lifecycle regression |
| pnpm test | Exit 0, 383/383 | Repository pure suite, includes new React tests |
| pnpm typecheck, final pnpm exec tsc --noEmit | Exit 0 | MDX generation plus TS; final compile includes last code changes |
| pnpm lint | Exit 0, 0 errors, 105 existing warnings | Repository lint, no build |
| pnpm exec eslint on all 12 changed/new TS/TSX files | Exit 0, 0 errors, 1 existing unused-disable warning | Final source; the accounting list directive predates this change |
| python .agentic/scripts/money_inventory.py --write, then without write | Exit 0 | Exact current source inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | 415 actual Drizzle columns and 1445 consumer hashes/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy import/reference guard |
| python .agentic/agent.py validate | Exit 0, valid 183 tasks | Structural workflow, not financial approval |
| git diff --check | Exit 0 | No whitespace errors |
| synthetic psql database count / pg_ctl fast stop | Count 0, stop exit 0 | Only the dedicated fixture cluster |

Initial development checks found a missed recurring credit total formatter,
a test-only unsafe TypeScript cast and a render-test assertion depending on HTML
attribute order. Fixed all three, then reran the relevant final checks above.
Review also caught manual two-sided compatibility: limited that validation to
recurring rows and verified both policies rather than restricting valid manual data.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon130-pg-cff620afa3b8463299dbf778f5ea0fa7,
127.0.0.1:55430, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL targeted
this server; harnesses created/migrated/dropped random dubbl_ci_* databases and
gave workers disposable DATABASE_URL. Final database count zero; cluster stopped.
Temporary dedicated cluster files remain. No application database was read or changed.

## Review and handoff

Actual self-review: MON-130-review-1.md. No scoped blocker. Complete the controller
check/submit/self-review/done flow, commit task-owned files, push origin/master
and verify the remote SHA and clean tree. Stop after this child. Next is MON-131.
No live browser/keyboard session, screenshot, PostgreSQL 16/hosted CI result,
independent accounting/locale/migration/security review or production qualification
is claimed. Remaining core UI and currency-rich aggregate/automated presentation
are explicitly assigned; neither MON-129 nor MON-007 is complete.
