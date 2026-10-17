# LOC-013 attempt 1: teams, administration and notification extraction

## Identity and scope

2026-10-17 (Asia/Tehran), coding-assistant, D:/Projects/dubbl, master. Entry HEAD
`6437fdda` and a clean tree. Live validate/status/next selected LOC-013 with
LOC-005 resolved and no active review. Started exactly this bounded task. Read
root/nested instructions, controller/project/repository map, frontend role,
LOC-005 evidence, catalog registry, source requirements and actual consumers.
No unrelated changes were present. Parent LOC-006 and LOC-002 acceptance remains
independent; no new child/sibling task was started.

## Implementation

- Added 290 matching keys: Teams 79, Admin 165, Notifications 37 and
  WorkspaceErrors 9. The complete production catalogs now have 1,038 keys per
  locale. Provisional Persian wording is present rather than English placeholders.
- Extracted all bounded static copy in the four teams files, seven admin files,
  notification page/dropdown and their supporting display components. Full
  sentences and ICU counts replace concatenated prose and English plural branches.
- Shared TeamFields preserves name/description values and the existing eight hex
  colors while adding translated accessible color names. Shared AdminNavigation
  preserves responsive destinations/detail branching and denied-child exclusion.
  SiteSettingsForm retains all write enums, string booleans and on-blur saving.
  Subscription descriptions preserve conditional Stripe warnings and escape names.
- Display helpers translate built-in plan/status/role/template labels without
  changing machine values or custom names. Workspace error allowlisting maps the
  actual auth/resource/duplicate response strings and safe validation/fallback
  copy; unknown network/server prose is not exposed as approved product text.
- Shared notification relative-time/date grouping uses independent presentation
  preferences and retains English relative thresholds. Canonical Gregorian local
  day keys avoid grouping by translated text or merging different years, and
  yesterday handles timezone/DST transitions. Approval review destinations and
  notification read/read-all/paging requests are unchanged.
- Added `registries/WORKSPACE_CATALOGS.md`, updated the catalog registry and task
  handoff, and refreshed the generated source inventory. No REST handler, MCP
  tool, schema/migration, authentication/authorization or accounting code changed.

## Acceptance mapping

1. Bounded extraction: matching catalog namespaces, typed production calls and a
   source audit cover the 13 original files plus extracted components. The scope
   registry explicitly lists brands/domain examples, caller/reference data,
   canonical enum/ID/write values, persisted notification/email content,
   standalone numeric/symbol data and existing admin date/number formatting.
   Notification generation/email template content belongs to LOC-009, and full
   date/number adapter adoption belongs to LOC-003.
2. Real React/next-intl rendering covers admin access/navigation/detail branches,
   initial lists/email-preview, loaded settings, team create/edit fields,
   conditional subscription descriptions and all five approval entity summaries.
   Tests cover escaped identities, color selection, switch/saving branches,
   routing, ICU counts, built-in/custom label handling, adversarial errors,
   time thresholds, timezone midnight, DST and cross-year grouping. All final
   static/catalog checks pass. Backend contracts are preserved by diff review;
   no database or external provider action was needed or executed.
3. Handoff and scope registry explicitly retain provisional Persian/native
   review, RTL, generated-content localization, date/number adapters and parent
   integration acceptance. This task has `human_review: false`; the review is
   honestly recorded as self-review, not native linguistic or financial approval.

## Verification

All commands ran from the repository root; no application database was accessed.

| Command | Actual final result |
|---|---|
| `node --import tsx --test tests/workspace-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts` | Exit 0; 26 passed, zero failed/skipped |
| `pnpm test` | Exit 0; 607 passed, zero failed/skipped; subsequent fixture typing/assertion cleanup rechecked by the focused 26-test command |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` | Exit 0; zero errors, 78 existing warnings |
| `pnpm exec eslint` on all changed app/components/i18n/test source paths | Exit 0; three pre-existing unused-variable warnings in teams and admin org detail, none in new code |
| `pnpm i18n:check` | Exit 0; 1,038 compatible keys in each locale |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 schema columns, 2,158 scanned files, 1,620 conservative consumer files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; columns, source hashes and occurrence lines verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` | Exit 0; 231 structurally valid tasks before disposition |
| `git diff --check` | Exit 0 |
| `git fetch origin`, `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

Interim extraction/typecheck runs caught self-referential translator initializers,
missing limit-label keys/error hook and a test fixture's required children prop;
all were corrected. Lint caught a callback memoization dependency mismatch and
the fixture's children-prop rule; the callback now uses an ordinary handler and
the fixture uses standard React children. Final checks above passed. Temporary
extraction scripts were removed, and the inventory was regenerated afterward.
An exploratory JSON count command needed explicit UTF-8 on Windows; the UTF-8
retry reported the namespace counts above.

## Limits and handoff

No full build, dev server, browser click/layout run, screenshots, provider action,
email delivery, database integration/migration, Docker or hosted-CI success is
claimed. Existing admin date/number calls and generated notification/email text
remain explicitly scoped exceptions. The pre-existing enterprise confirmation
says Business while the unchanged write payload selects `pro`; parent integration
should assess that inconsistency. See [self-review](LOC-013-review-1.md).

Complete controller check/submit/self-review/done; commit only this task's source,
catalog, test and orchestration/inventory changes; push origin/master, verify
remote SHA parity and clean status, report the next selected task and stop.
