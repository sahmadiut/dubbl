# RTL-006 — shared mixed-text control foundation

## Scope and current baseline

One bounded child of [RTL-002](../tasks/RTL-002.md). The broad parent covers shared
bidi, typography/font packaging, and module/output layout/accessibility; it was
split into RTL-006/007/008 and retains all three original unchecked acceptance
criteria for independent combined acceptance.

Work was isolated in `D:/Projects/dubbl-rtl002-worktree` from the primary checkout's
unrelated active edits. The task checkpoint was rebased onto
`c80ae3319a8f3e3781ad2b8702635dac310108d3` after the owner UI commit and CI-003 repair.
No owner file, CI-003 artifact or new controller task was overwritten. The existing
dependency directory is junctioned for module resolution without installation; no
dependency/package/lock or primary application database change is required.

## Implemented and reviewed

- Real [`BidiText`/`IdentifierText`](../../components/ui/bidi-text.tsx) use native
  isolated `bdi` scopes, default auto/LTR as appropriate, exact text, React escaping,
  preserved whitespace, tabular numerals, selection and arbitrary long-token
  wrapping. Explicit direction/accessibility attributes remain caller-controlled.
- Real [`Input`](../../components/ui/input.tsx) applies LTR isolation/start alignment
  only to native email/URL controls without overriding explicit `dir`. Generic
  types retain their inherited behavior. Ref, native type/validation, name/value,
  errors/descriptions and event values remain intact.
- Actual [`ApiKeyFields`](../../components/settings/api-key-fields.tsx) adopts the
  identifier scope in a shrinkable code container. The visible name label now
  references its input, and free-form name uses auto direction. Copy and name
  callbacks retain exact strings, including caller whitespace and punctuation.
- The [foundation registry](../registries/BIDI_TEXT_CONTROLS.md) documents 13 existing
  literal email Input call sites, contracts and remaining module/output ownership.
  The [owned-source hash census](../registries/RTL-006-source-audit.json) records the
  final four source/test files independently of concurrent primary edits.

No identifier normalizer, sanitizer or spoofing validator is introduced. The
rendered data is not rewritten, translated, trimmed or decorated with Unicode
direction-control characters. Existing REST/MCP operations and canonical values
are unchanged; there is no new business operation needing a new tool.

## Verified commands and results

- Initial pre-rebase `node --import tsx --test --test-concurrency=1
  tests/rtl-bidi-controls.test.ts tests/settings-access-catalogs.test.ts`: **15/15
  pass**, exit 0. JSX instrumentation initially treated static arrays as dynamic
  and emitted React key warnings; the harness now preserves actual `jsx` versus
  `jsxs` construction. Production controls did not need key changes.
- Final new-baseline `node --import tsx --test --test-concurrency=1
  tests/rtl-bidi-controls.test.ts tests/settings-access-catalogs.test.ts
  tests/auth-catalogs.test.ts tests/contact-people-files-catalogs.test.ts
  tests/localized-number-presentation.test.ts tests/rtl-acceptance.test.ts`:
  **40/40 pass**, exit 0, no failures/skips/cancellations or React harness warnings.
  This includes all seven new tests, actual bilingual provider rendering, long
  email/URL/IBAN/UUID/document/key strings, exact callbacks, native input contracts,
  installed CSS, and existing auth/contact/number/focus regressions.
- `pnpm exec eslint components/ui/input.tsx components/ui/bidi-text.tsx
  components/settings/api-key-fields.tsx tests/rtl-bidi-controls.test.ts`: exit 0,
  no warnings or errors.
- Current-baseline `pnpm typecheck`: exit 0 (`fumadocs-mdx && tsc --noEmit`).
  Its process remained CPU-active while host free memory fell below 200 MB;
  no competing task check was started and the existing user dev server was untouched.
- `python .agentic/scripts/money_inventory.py --write` and
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0,
  417 schema columns and 1,869 final consumer hashes. All 417 complete parsed schema
  records compare equal to current baseline; generated changes only describe source.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, all nine checks pass.
- `pnpm i18n:check`: exit 0, 10,702 keys in each locale; catalogs unchanged.
- Four owned source/test hashes, four frozen file comparisons and unchanged
  owner `numbers.ts`, global CSS, admin navigation and CI-003 records pass.
- `pnpm lint`: exit 0, no errors and 20 pre-existing warnings.
- UTF-8/local links, four final source hashes, complete 417-classification equality,
  preserved owner/CI baselines, frozen scope, controller validation and staged
  whitespace/scope checks pass. Controller has 373 tasks including CI-003 and
  the three new RTL-002 children.

## Review boundaries

This is shared semantic rendering/control foundation, not complete module or
output adoption. Real React/provider output, actual callbacks and installed
Tailwind CSS declarations are exercised. There is no mounted browser, computed
selection/caret/clipping/zoom, screen-reader, human/native/accounting or PDF pass.
DEC-005 removes screenshot requirements, not actual later behavioral review.

RTL-007 retains font assets/notices/typography, RTL-008 retains module forms,
tables, headers/errors/totals, charts/tooltips, metadata and output/narrow-width/
long-translation/zoom/text-spacing adoption. RTL-002 accepts the full combination
independently. Its existing parent criteria are not closed by this foundation.

No full build, dev server startup, screenshot, database write, hosted CI wait,
production deployment, IRR enablement or dedicated Stripe work was performed.
The four frozen billing/pricing/checkout/mixed source files compare exactly with
the current baseline. Exact money, ISO values, request/route IDs, storage and
issued/default output contracts remain intact.

## Final gates and handoff

All task checks are complete. Close only RTL-006 with honestly attributed self-review
and one amended local task commit, then integrate that exact task commit without
overwriting primary work. RTL-007 is the next child; RTL-002 retains independent
combined acceptance. Supervisor handles the two-task paired push; this agent
does not push. No full repository unit suite or replacement hosted CI result is claimed.
