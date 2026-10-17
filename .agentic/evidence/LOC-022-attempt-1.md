# LOC-022 attempt 1 - journals and opening balances

## Identity and scope

2026-10-18 (Asia/Tehran), operator Codex, D:/Projects/dubbl, master.
Entry HEAD: 34d3d768; working tree clean at entry. The controller selected and
started LOC-022, a bounded child of LOC-007. This evidence describes the task-owned
working diff before delivery; it does not invent a commit or human approval.

## Implementation and acceptance mapping

1. Added 269 paired messages: Journals 251, JournalErrors 15, JournalActivity 3
   (2,603 total per locale). Extracted all authored presentation in the five
   manual/recurring/opening pages, journal/opening forms and saved details, three
   owned drawers and activity sidebar. The [inventory](../registries/JOURNAL_CATALOGS.md)
   records paths, intentional technical/data/formatter exceptions and handoff.
   Existing namespaces and all 35 other drawer/provider/helper functions are
   unchanged after LF normalization. Stripe-specific files remain untouched.
2. Real production templates render with React/next-intl/PresentationProvider in
   both languages. Tests execute actual source callbacks for create, edit,
   finalize, cancel, recurring pause/run and delete; preserve request URLs,
   methods, organization headers, canonical status/frequency codes, dates,
   reasons, metadata and exact financial aliases. Cases cover large low digits,
   supported range, malformed decimals/aliases, counts, escaping, failed
   authorization/network/HTML/JSON, request alerts and confirmation rejection.
3. Evidence, honest self-review and inventory identify provisional Persian
   financial wording and independent LOC-007/002, native and RTL acceptance.
   This slice introduces no REST/MCP/schema/financial-service operation or change;
   the existing entries, recurring-journals and opening-balances tools remain the
   matching MCP operations. No application database was used or mutated.

## Behavior and preserved boundaries

Only approved fixed HTTP and preview errors are translated. Unknown server and
parser prose uses a translated operation fallback. Failed recurring reads show
an alert rather than a successful empty state. Invalid saved exact recurring
amounts fail closed. Failed delete callbacks reject so their confirmation stays
open. Loading/saving flags reset on request failure, and failed mutations do not
navigate, close the drawer or announce success.

Opening balances retain the numeric USD minor-unit bridge; manual and recurring
journals retain exact Minor strings and saved FX/cost-center/project metadata.
Amount parsing/sums, database/schema, REST/MCP authorization and machine fields
are unchanged. Existing money/date/numeral formatter contracts remain separate;
the activity sidebar reuses the already-audited locale/timezone helpers.

The older journal component fixture now uses the same provider already required
by the application. Its original financial assertions are unchanged. Source
inventory hashes/occurrence lines were regenerated for the actual diff.

## Actual verification

All commands ran in D:/Projects/dubbl. Network/state boundaries in component tests
were controlled locally. No full build, dev server, DB fixture, Docker,
deployment, provider call or browser session ran.

| Command/check | Actual result |
|---|---|
| Controller validate/status/next/start LOC-022 | Exit 0; 255 structurally valid tasks; one selected bounded child |
| Focused command below | Final exit 0; 31/31 passed, no failures/skips; 7.204 seconds |
| Full unit command below | Exit 0; 684/684 passed, no failures/skips; 1,301.296 seconds |
| `pnpm typecheck` | Final exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm i18n:check` | Final exit 0; 2,603 compatible keys in each locale |
| Changed-file ESLint | Final exit 0; zero errors/warnings |
| `pnpm lint` | Final exit 0; zero errors, 75 existing warnings |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 2,206 scanned files, 1,650 conservative consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema, consumer hashes and occurrence lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| Catalog/source scope audit against entry HEAD | Exit 0; existing namespaces unchanged; 35 unowned drawer/helper functions identical; no Stripe-specific path changed |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |
| Controller validation and `git diff --check` | Exit 0 before disposition; repeated at completion |
| Relative-link audit across task/registry/evidence documents | Exit 0; 29 local links resolve |

Focused command:

```text
node --import tsx --test --test-concurrency=2 tests/journal-catalogs.test.ts tests/journal-ui-components.test.ts tests/opening-balance-ui-money.test.ts tests/journal-ui-money.test.ts tests/journal-wire.test.ts tests/recurring-journal-wire.test.ts
```

Full unit command:

```text
node --import tsx --test --test-concurrency=2 tests/*.test.ts
```

Changed-file lint command:

```powershell
$taskLintPaths=@(git diff --name-only -- '*.ts' '*.tsx')
$taskLintPaths += 'i18n/journal-presentation.ts','tests/journal-catalogs.test.ts'
node node_modules/eslint/bin/eslint.js @taskLintPaths
```

Intermediate checks exposed test-fixture omissions (a required numeric money
alias, HTML attribute-order assumptions and nested ESM provider context). They
were fixed without weakening financial assertions. The recurring column builder
was moved outside the component with a typed translator argument to preserve
React Compiler memoization. No intermediate failure is counted as final passing
verification. A transient PowerShell stdin encoding issue in added Persian
errors was repaired with explicit UTF-8 file writing before acceptance; tests
assert Arabic-script wording and real Persian rendering.

The initial full lint invocation also inspected temporary extraction scripts and
reported ten require-import errors in those scripts plus the existing 75 warnings.
All temporary files were removed; the final full lint rerun targets the delivery
tree. Final focused checks ran after clearing a stale load-error state on a
successful localized journal-list reload. No dedicated Stripe work was performed;
the unchanged existing Stripe tests ran only as part of the general unit suite.

## Review and handoff

See [self-review](LOC-022-review-1.md). Persian wording remains provisional; no
native review, complete RTL, browser/font/layout, live REST/MCP/SQL, hosted CI,
physical printing/PDF, provider or production IRR qualification is claimed.
LOC-007 and LOC-002 retain independent integration acceptance. Dedicated Stripe
work remains excluded by DEC-008.

Verification passed. Complete controller check/submit/self-review/done, commit
only this task's files and push origin/master under the user's instruction.
Verify remote SHA and clean working tree, report the live next task and stop.
