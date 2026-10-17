# LOC-014 attempt 1 - Core settings configuration catalogs

## Identity and scope

- Date: 2026-10-17. Operator: coding-assistant. Branch: master.
- Entry commit: `314191ed580f525463947dcc7986baa589d97189`; clean tree at entry.
- Controller selected LOC-012. Inspection found 23 settings files totaling over
  10,000 lines, so it was split through the controller into LOC-014 through
  LOC-017. Explicitly claimed ready core configuration child LOC-014. LOC-013
  remains ready and is the next scheduler choice after this child.
- No database, provider, production account or browser fixture was used. Real
  React/next-intl server rendering uses synthetic in-memory values.

## Implementation and acceptance mapping

1. Extracted core settings navigation, general organization configuration,
   procurement, cost-center and tag presentation into six typed namespaces.
   Added 213 English/Persian keys, for 748 matching total keys. Reused existing
   locale preference and business-country catalogs. Payment labels are keyed by
   canonical enum values; address country labels use runtime CLDR with canonical
   fallback. Complete interpolation supports reordered lock/deletion text.
   [Settings inventory](../registries/SETTINGS_CATALOGS.md) records all files and
   explicit exceptions, including jurisdiction legal names and technical samples.
2. Real rendering verifies both locales, all 21 desktop/mobile destinations,
   detail navigation, general sections/controls, procurement percent values and
   switches, saving disabling, tag colors/escaped values, rich deletion identity
   and child warnings. Option/error tests preserve canonical data and reject
   unknown/prototype/network prose. A bounded AST audit rejects remaining JSX
   prose and display literals. Existing request paths, payload fields, enum
   values, org headers and provider/domain implementations remain unchanged.
   Procurement's functional switch state updates and basis-point conversion
   were retained while moving its form to a supporting component.
3. Persian wording is provisional. LOC-012, LOC-006 and LOC-002 retain combined
   acceptance. LOC-015/016/017 own remaining settings screens. Native L10N and RTL
   qualification remain open; no production IRR or compliance claim is made.

No REST/service/MCP/schema/migration change. Existing operations already have
MCP counterparts; this task adds no new user operation. Money inventory regenerated
for changed source hashes/lines and added components/tests, without changing units.

## Verification

Working directory for all commands: `D:\Projects\dubbl`.

| Command | Actual result | Scope/limit |
|---|---|---|
| `node --import tsx --test tests/settings-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts` | 25/25 passed, exit 0 | Real React/next-intl SSR and behavior/source assertions; no browser clicks/layout proof. |
| `pnpm test` | 598/598 passed, exit 0 | Final full-suite rerun had no MISSING_MESSAGE/INVALID_MESSAGE/FORMAT_ERROR output. |
| `pnpm typecheck` | Passed, exit 0 | Repeated after the final functional-state callback typing change. No build. |
| `pnpm lint` | Passed, 0 errors / 78 pre-existing warnings, exit 0 | Existing warnings outside modified files retained. |
| `pnpm exec eslint` with the five changed settings routes/layout, three new settings components, two adapters and settings test | Passed, 0 errors / 0 warnings | Changed-file validation. Final procurement adjustment also linted independently. |
| `pnpm i18n:check` | 748 keys per locale, passed, exit 0 | ICU structure, nonempty keys, placeholders/rich-tag parity. |
| `python .agentic/scripts/money_inventory.py --write`, then without `--write` | Passed, 417 columns / 2149 scanned files / 1614 consumers / 31298 occurrences | Regeneration records moved nonmonetary percent conversion; no financial implementation change. |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed, 417 columns and 1614 consumer hashes | Repeated against final source. |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 regression checks passed | No added legacy money import. |
| `python .agentic/agent.py validate` | Valid, 231 tasks | Structural validation only. |
| `git diff --check` | Passed | Whitespace check. |
| `git fetch origin master`, `git rev-list --left-right --count HEAD...origin/master` | Fetch succeeded; 0 ahead / 0 behind at precommit check | Commit/push parity recorded by final delivery commands. |

An intermediate broad key cleanup unintentionally renamed existing Shell.aPIKeys;
typecheck caught it and full rendering logged the missing key. Restored every
pre-existing namespace from HEAD, then reran typecheck and all 598 tests cleanly.
Intermediate lint included throwaway extraction scripts; those were removed and
lint reran successfully. A Windows stdin encoding probe found corrupted newly
added Persian extras; they were rewritten through UTF-8 files, and an encoding
assertion now covers every Settings message. These intermediate runs are not
counted as passing checks.

Final follow-up after preserving functional switch callbacks: 8/8 settings tests,
procurement-file lint, typecheck, catalog gate and source-hash verifier passed.
The only other late source edit was tag-field indentation, followed by the
25-test focused rerun and changed-file lint.

## Review and limits

Self-review by coding-assistant; see [review 1](LOC-014-review-1.md). No native,
peer, browser-layout, provider, hosted-CI or database-integration review claim.
No full build, dev server, deployment or schema command ran.

The existing general settings period-lock GET reader uses `data.lock` while the
handler returns `periodLock`. Left unchanged as a pre-existing domain-read issue;
recorded for LOC-012 independent integration acceptance. The existing inert
organization-delete button and duplicate PEPPOL scheme value also remain as-is;
this extraction does not assert those workflows are operational.

## Handoff

Complete controller acceptance/self-review/done, commit only owned files, push
origin/master, verify remote SHA and clean worktree, report next LOC-013 and stop.
Remaining settings extraction and parent integration stay open.
