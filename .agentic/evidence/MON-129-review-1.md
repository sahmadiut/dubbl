# MON-129 review 1 - honest self-review

Reviewer coding-assistant (Codex), 2026-10-12 Asia/Tehran, kind self.
Reviewed the final combined fixture, task criteria, ownership/manifest changes,
regenerated inventory and actual verification results. No independent peer,
human, accounting or native-language review is represented.

## Findings

- All core consumers map to MON-130..133 and their detailed leaf ownership.
  Shared drawer/editor/dashboard ownership is by section. Stale pending wording
  is explicitly superseded, with monetary budget/accrual sections and remaining
  auxiliary/public/background consumers retained under MON-008.
- The new parent fixture combines both document sides and cash/manual GL in each
  organization through authenticated REST and a linked MCP session. Independent
  literal SQL expectations catch low-digit loss, rounding-policy changes, quantity
  rescaling, erroneous paid/due, unbalanced GL and wrong cash net. Conflicting UI
  aliases reject; negative writes and foreign access preserve scoped snapshots.
- Price-first quote-derived invoice and extended-price bill deliberately differ
  by one minor unit. Cash net and journal totals assert that difference instead of
  erasing it. Saved rounded prices do not reconstruct unstored input precision.
  Required quote expiryDate and detail reads follow the real operation schemas.
- Final expanded snapshots include quote lines, account/bank state, both document
  lines, payments/allocations and GL; final paid/due assertions use SQL text. Their
  rerun and final typecheck/scoped lint passed after the broader 26-suite run.
- All four child compositions and leaf transport fixtures passed jointly; full
  pure/static React checks passed 474/474. Typecheck, zero-error lint, money/legacy
  gates, controller validation and whitespace checks passed. Existing 98 lint
  warnings are outside the new test files. DEC-005 permits source/layout and
  behavior assertions without browser/screenshots; live effects remain unverified.
- Compatibility exceptions are explicit and unchanged: safe numeric coexistence,
  fixed-two REST journal aliases and recurring payables, USD openings, physical
  quantities/basis points, raw thresholds/current-base GL, separate currency
  groups and cross-scale legacy base-display rejection. Production flags,
  accounting/migration/release qualification and MON-007 remain independent.
- Only task-owned files are changed. New operations/schema are absent, so no new
  MCP registration or Drizzle migration is needed. Temporary databases are gone
  and the synthetic cluster stopped; remote master matched before commit.

## Decision and limitations

Approve MON-129's three criteria based on independent combined UI acceptance,
current source ownership and actual checks. Approval applies to this parent only.
No live browser, provider/PDF/export, hosted CI, PostgreSQL 16, production IRR,
full-int64 business, native-language/accounting, migration or deployment approval.
Finish controller done, scoped commit/push and remote/clean-tree verification;
then report the next task without starting it.
