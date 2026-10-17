# MON-010 owner-authorized self-review and completion

Date: 2026-10-17, Asia/Tehran. Reviewer: Codex, implementing agent. Kind: self.
Reviewed implementation: `b88a37489131002e8f4ade5a68713da44e411f15` on master.
Entry tree was clean; that SHA matched live origin/master in this conversation.

## Owner instruction and scope

Codex told the owner that MON-010's implementation was already pushed, linked
the final qualification evidence and explained the remaining human
accounting/database review requirement. The owner then explicitly directed
Codex to perform the review and proceed. English translation of the Persian
instruction: "I don't feel up to it; check it yourself and go ahead."

[DEC-007](../docs/DECISIONS.md#dec-007--mon-010-self-review-authorized-by-owner)
records this task-specific delegation. MON-010's `human_review` field is changed
to false before recording an honest self-review through the controller. No human
technical review is claimed. No financial acceptance criterion, task dependency
or other task's review requirement is waived. Prior evidence remains unchanged.

## Technical review

- Read the localized normalizer/parser and its tests, exact-money primitives,
  application rollout guard, independent migration qualification fixture,
  qualification registry, matrix and both prior attempt records.
- Localized input validates the entire numeral/sign/separator grammar before
  removing validated grouping characters. One numeral script and explicit
  separator policy avoid ambiguous normalization. Currency scale, rounding and
  signed int64 enforcement delegate to exact bigint primitives. Canonical wire
  parsing remains separate. LOC-003 retains product-wide UI integration.
- The migration fixture uses four distinct currency tenants and independent
  literal SQL expectations for trial balance, AR/AP, bank and retained earnings.
  Historical column projections, row hashes and null/count checks survive
  additive schema changes. Nine rolled-back corruption cases include balanced
  doubling and historical/tenant damage; equal debit/credit sums alone cannot
  satisfy preservation. No new issue requiring implementation changes was found.
- `IRR_FINANCIAL_GATE_PASSED` remains false. Focused tests verify that environment
  flags, startup and REST/MCP selection cannot enable functional IRR prematurely.

## Verification in this review

All commands ran from D:/Projects/dubbl. This change updates review/controller
documentation only; lib/, tests/ and drizzle/ match the reviewed commit.

| Command | Result |
|---|---|
| `node --import tsx --test tests/exact-money.test.ts tests/exact-rate.test.ts tests/currency-regimes.test.ts tests/localized-money.test.ts tests/currency-rollout.test.ts` | Exit 0; 25/25 passed, zero skipped |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 417 Drizzle columns, 1588 consumer hashes and all source occurrence lines verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks passed |
| `python .agentic/agent.py validate` before disposition edits | Exit 0; 218 structurally valid tasks |
| `python .agentic/agent.py validate` after the scoped review-requirement edit | Exit 0; 218 structurally valid tasks |
| Local Markdown target check across task, decision, registry and review files | Exit 0; all 17 relative link targets exist |
| `git diff --check` after disposition edits | Exit 0; no whitespace errors |

An earlier focused invocation named the nonexistent `tests/money-exact.test.ts`;
Node selected the two existing files and passed 10 tests. The explicit corrected
five-file command above includes `tests/exact-money.test.ts` and passed all 25.
No exact-money result is attributed to the earlier command.

[Attempt 2](MON-010-attempt-2.md) and [review 2](MON-010-review-2.md) remain the
implementation verification record: 558 unit tests, all 25 selected integration
cases with passing results after an isolated retry, typecheck and zero-error
lint. The joint integration command was 24/25 and failed at the unchanged core
worker timeout; the isolated core retry passed. That failed joint command is
not relabeled as passing. No DB integration, full unit suite, typecheck or lint
rerun is claimed for this documentation-only disposition.

## Disposition

Approve MON-010 as Codex self-review under the owner's task-specific delegation.
All three financial acceptance criteria retain their documented scope and
evidence. Complete through the controller, validate, check links/whitespace,
commit only the task-owned disposition files, push and verify remote parity.
Do not start another task in this delivery.

No independent human sign-off, production IRR activation, production database
or volume/PostgreSQL16 rehearsal, browser, build/dev server, deployment or hosted
CI qualification is claimed. Later QA/release requirements remain applicable.
