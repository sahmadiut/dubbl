# IRR qualification and activation path

Date: 2026-10-21 (Asia/Tehran). This is a work/evidence map, not a competing
status tracker or a declaration of production readiness. Task metadata remains
authoritative. [Owner instruction](../evidence/IRR-qualification-scope-2026-10-21.md).

## The gap being closed

Subsequent owner instruction, 2026-10-21: temporarily allow IRR on the local
development site for testing. The server-only `IRR_TESTING_ENABLED=true`
override requires a development/test runtime and leaves the readiness constant
false. Local `.env.local` opts in, with production opt-in false. This is the
bounded exception to the planning rules below, recorded in
[local testing evidence](../evidence/IRR-local-testing-2026-10-21.md).
It does not complete IRR-001..005 or any QA/release task.

MON-001..010 and their financial implementation children are complete, but the
code-owned IRR readiness constant is still false. MON-010 explicitly did not
enable IRR. The old release backlog did not name the final code/configuration
activation operation. LOC-003 (general localized money input) and the broad
QA/release tasks remain open; financial child completion does not close them.

The current selection restriction is therefore real even though synthetic IRR
fixtures pass. The earlier proposed disabled-picker change explains that
restriction but cannot make an organization usable in IRR; inspect the current
working UI rather than assuming that proposal is still fully present.

## Executable sequence

Owner ordering update, 2026-10-21: schedule all IRR work after localization.
IRR-001 now waits for RTL-002 and L10N-012; its existing downstream chain
keeps IRR-002..005 after those gates too. IRR-001..003 move from phase 2 to
phase 8. IRR-004..005 retain phase 9 and their release dependencies. See
[ordering evidence](../evidence/IRR-after-localization-2026-10-21.md).

| Task | Concrete result | Ordering and handoff |
|---|---|---|
| [IRR-001](../tasks/IRR-001.md) | Current exact-money/FX/accounting/report/migration evidence with independent per-currency SQL reconciliation and explicit unresolved findings | After MON-007/008/010, RTL-002 and L10N-012; phase 8, priority 0, following the owner's instruction to finish localization first |
| [IRR-002](../tasks/IRR-002.md) | Tested IRR backup/restore, measured recovery and concrete rollback limits | After IRR-001; supplies bounded evidence to QA-005 |
| [IRR-003](../tasks/IRR-003.md) | Real selection, REST/MCP authorization/history guards and critical Persian IRR entry tests on an isolated enabled test candidate | After IRR-002; supplies evidence to QA-001/QA-002 and identifies remaining LOC-003 scope |
| [IRR-004](../tasks/IRR-004.md) | Reviewed code/configuration candidate capable of opt-in IRR, default off, with exact revision and runbook | After IRR-003 and QA-001/002/005; REL-001 waits for this candidate before REL-002 approves it |
| [IRR-005](../tasks/IRR-005.md) | Actual authorized target activation, successful eligible-organization selection and canary reconciliation | After IRR-004 and actual REL-002 approval; REL-003 waits for this observed result |

IRR-001..003 can be performed by Codex without representing its technical review
as independent human approval. Their completion is reusable evidence for the
broader QA tasks, not automatic completion of those tasks. Existing human-review
requirements, native-language acceptance and exact production rollout approval
are not silently waived. IRR-005's technical review does not replace REL-002.

## Evidence and remaining checks

| Boundary | Current verified baseline | What is still required |
|---|---|---|
| Readiness policy | `lib/currency/rollout.ts` has `IRR_FINANCIAL_GATE_PASSED=false`; even an explicit operator request cannot enable IRR | Reviewed candidate change and both on/off regressions in IRR-003/004; actual runtime activation in IRR-005 |
| Money/FX/migration | MON-010 evidence and a fresh three-case core-accounting/migration run earlier in this conversation pass | IRR-001 must record the current candidate and rerun the declared complete baseline, including report/auxiliary paths; prior results alone do not finish it |
| Organization selection | Existing flag-off REST/MCP and focused settings tests pass | Successful flag-on REST/MCP/SQL proof, denied/foreign cases and unchanged failure snapshots on the reviewed candidate |
| Existing organizations | Shared service forbids currency changes after journal, payroll, asset/category, loan or accrual history | Inspect eligibility for the eventual target; never change currency through SQL or relabel stored USD history as IRR |
| Persian input | Strict localized primitive exists; LOC-003 remains open | Exercise actual critical IRR entry controls with Persian/Arabic-Indic/Latin digits and malformed values; retain broader localization/native/RTL acceptance separately |
| Recovery | Synthetic migration preservation evidence exists | New IRR backup/restore rehearsal, measured recovery, large-value checks and stop/restore procedure; production/version/volume scope remains QA-005 |
| Release | QA-001..005 and REL-001..003 are open | Candidate-specific global checks, actual environment/scope approval, then explicit IRR-005 activation and REL-003 observation |

## Execution rules

- Task planning itself changes no flags, readiness constant or organization
  currency. The subsequent owner-authorized local testing exception above
  changes selection availability only; it does not rewrite stored currencies.
- Use an explicit loopback TEST_DATABASE_URL and randomized disposable databases
  for qualification. Do not test by resetting the application database.
- Preserve integer minor units, low digits, existing currencies and historical
  interpretation; do not introduce toman conversion or redenomination.
- Setting the operator flag false is not a migration reversal or complete
  write freeze for existing IRR organizations. Test and document actual behavior.
- No full builds, unrequested dev-server startup, Docker execution, production
  mutation or dedicated Stripe work. Apply DEC-002/005/006/008 as recorded.
- Record exact commands, candidate/diff, results, cleanup and limits. A failing
  assertion or missing external surface remains an identified finding, never a
  fabricated pass or a silently completed parent task.

## Related gates

[Rollout policy](../docs/ADR-003-LOCALE-AND-CURRENCY-ROLLOUT.md),
[release gates](../docs/RELEASE_GATES.md),
[MON-010 qualification](MONEY_MIGRATION_QUALIFICATION.md),
[QA-001](../tasks/QA-001.md), [QA-002](../tasks/QA-002.md),
[QA-005](../tasks/QA-005.md), [REL-001](../tasks/REL-001.md),
[REL-002](../tasks/REL-002.md), [REL-003](../tasks/REL-003.md).
