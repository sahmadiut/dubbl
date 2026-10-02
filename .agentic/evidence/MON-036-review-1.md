# MON-036 self-review 1

2026-10-03, Asia/Tehran. Reviewer codex, kind self. Same operator implemented and
reviewed; no peer/human/accounting/deployment approval.

Inspected the source/diff and actual assertions/results in MON-036-attempt-1.md.
Approve the bounded lifecycle/import contract slice.

Review findings and disposition:

- REST import decimal versus MCP integer-cent discrepancy is preserved explicitly
  rather than silently harmonized. Canonical minor aliases and dual agreement are
  tested on both. Parsing no longer truncates junk/rounds extra precision; large
  numeric REST decimals require text, including a classified pure negative test.
- All user-facing boundaries have tool parity; preview_journal_entries is newly
  registered through the existing import tool file. Tool descriptions/schema fields
  explain units, returns, bounds and permissions; direct DB and wrapTool retained.
- Mutation-scoped org/role/period checks and target validation address source
  defects. Null/inconsistent FX is not guessed; recode cannot let the coexistence
  trigger silently repair unqualified history. Old same-org inactive dimensions
  remain reversible, while selecting inactive/foreign targets fails.
- Lifecycle header locks and transactions protect status/reversal/response
  failures. The duplicate-void test proves one mirror for concurrent calls on the
  same original. Fault fixtures prove reversal/import-leg and partial-recode
  rollback rather than merely checking validators.
- No arbitrary bigint leaks into responses. DTO raw Minor/rate aliases retain
  original stored values, fixed REST decimal output and MCP header/count output.
  Tiny rates do not multiply already-base reversal amounts. Unsafe rows and sums
  fail without financial mutation; dimension-only recode avoids amount decoding.
- Partial-job business failures intentionally record metadata, retaining existing
  import behavior; globally malformed wire values have full no-write snapshots.
  Job count fields still count groups versus lines as documented.
- Final pure and five actual migrated workers pass; final typecheck/changed-file
  lint/inventory and diff checks pass. Full units 104/104 and full lint zero errors
  preceded final small refinements, followed by relevant final checks. Fixture
  corrections and untested session/OAuth paths are disclosed honestly.

Remaining gates: full-int64 posting/FX/balance policy, currency-aware major import,
recurring and scheduled reversals, broader concurrency, import retry idempotency,
crash recovery, audit durability, browser/HTTP OAuth and human qualification.
No production/IRR/schema/deployment or configured-database change. MON-018/007/037
and QA retain these responsibilities. No blocker remains in MON-036 itself.
