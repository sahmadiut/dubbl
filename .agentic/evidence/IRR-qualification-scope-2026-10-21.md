# Owner request: perform or schedule the remaining IRR checks

Date: 2026-10-21 (Asia/Tehran). Author: Codex. Kind: planning and technical
baseline record; not human accounting review, task completion or deployment.

## Actual instruction

After the owner reported the IRR functional-currency error and asked why it
remained despite completed financial tasks, Codex explained the separate code
readiness and release gates. The owner then said, translated from Persian:
"What are those checks you mention? If you can, do them yourself, or write tasks
so they get done, because I don't feel up to it."

This authorizes technical checking by Codex and concrete task preparation.
It does not identify a production candidate, target environment/organization or
canary scope, and is not recorded as an independent human financial/security
review. Existing completed evidence and broad human-review metadata are retained.

## Verified starting point

- The controller reports 168 completed tasks in the money/FX phase before adding
  this sequence. This is task metadata, not a statement that every release or
  localized-input gate is complete.
- `lib/currency/rollout.ts` still owns a false readiness constant. The settings
  picker changes proposed earlier in this conversation explain the restriction;
  they do not enable functional IRR. During planning, the settings page itself
  matched HEAD again while other earlier helper changes remained uncommitted;
  the earlier UI/static results apply to the earlier tested diff, not an assumed
  unchanged current UI candidate. That current state was preserved.
- LOC-003, QA-001..005 and REL-001..003 remain open. ADR-003 requires a separately
  reviewed candidate and operator opt-in. The original backlog did not name the
  final code/configuration activation operation.
- The application database was not changed. The user did not select a final
  deployment/activation target in this conversation.

## Checks actually run earlier in this conversation

These results establish the starting baseline only. IRR-001..005 are newly
scheduled work and none is marked passed from these earlier results.

| Actual command/context | Observed result | Scope |
|---|---|---|
| `node --import tsx --test tests/functional-currency-settings.test.ts tests/currency-rollout.test.ts tests/settings-catalogs.test.ts tests/organization-wire.test.ts` | Exit 0, 19/19 | Existing disabled-policy settings/component/wire behavior; not successful IRR activation |
| `node --import tsx --test tests/integration/organization-settings.test.ts` with explicit disposable loopback PostgreSQL | Exit 0, 1/1 | Real migrated organization REST/MCP contracts; production policy stays off |
| `node --import tsx --test --test-concurrency=1 tests/integration/money-migration-qualification.test.ts tests/integration/core-accounting-integration.test.ts` with explicit disposable loopback PostgreSQL | Exit 0, 3/3 | Core financial composition, historical preservation/replay and financial-drift negatives; not the whole future IRR candidate |
| `pnpm exec tsc --noEmit`, owned-file ESLint and `pnpm i18n:check` for the preceding settings changes | Exit 0 | Static/catalog validation, not browser or production qualification |

The PostgreSQL 18 fixture ran on loopback port 55587. Each test used randomized
disposable databases. Before shutdown the fixture database count was zero and
the server stopped successfully. No credentials are recorded here.

## Resulting work

[IRR-001](../tasks/IRR-001.md), [IRR-002](../tasks/IRR-002.md) and
[IRR-003](../tasks/IRR-003.md) cover the current financial baseline, recovery,
selection controls and critical Persian entry. They feed the broader QA tasks
without automatically passing them. [IRR-004](../tasks/IRR-004.md) owns the
reviewed default-off code/configuration candidate and
[IRR-005](../tasks/IRR-005.md) owns actual activation after REL-002 approval.

The [readiness map](../registries/IRR_READINESS.md) records the exact sequence,
handoffs and current limitations. New technical reviews are honestly attributed
to Codex; no current runtime flag or currency is changed by this planning work.

## Verification of the planning change

- Controller validation: exit 0, 346 valid tasks with no dependency cycle.
- Controller next/status: IRR-001 is todo, ready with no unmet dependencies and
  selected before further localization; none of the five new tasks is complete.
- Local Markdown targets: 674 checked across 20 new/changed planning files;
  every referenced local path exists.
- Money inventory: refreshed after the previously modified settings page
  returned to HEAD. Regeneration/check and Drizzle/source verification pass:
  417 columns, 1,821 consumers and all occurrence lines/hashes verified. The
  initial stale-inventory check failed on that page; it was corrected by
  regeneration, not by restoring or overwriting the current UI source.
- `git diff --check`: exit 0. No application source, database currency, runtime
  configuration, build/dev server or deployment changed in this planning turn.
- Existing completed task evidence/reviews and existing human-review metadata
  remain unchanged. No commit or push was requested or performed.
