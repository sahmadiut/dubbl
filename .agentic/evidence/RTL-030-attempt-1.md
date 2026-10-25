# RTL-030 ledger accounts acceptance

## Identity and bounded scope

Codex, 2026-10-26; master baseline d06515d40bda4c8b95d7d1ca6412953222b5028d. Clean tree and empty index at selection. Current controller validate/status/next selected RTL-030; claimed by codex-rtl030. This is the first task of the next owner-authorized two-task batch, so commit locally without push. Existing dashboard/theme and owner changes in prior history are preserved.

The exhaustive ownership registry assigns exactly four TSX sources. Imported account-presentation/name, currency, exact-money, core wire, drawer, DataTable and DatePicker foundations are reused. No new operation or REST/MCP tool is introduced by these presentation repairs.

## Exhaustive source audit and repair

| Assigned source | Independent audit result and disposition |
|---|---|
| app/(dashboard)/accounting/accounts/page.tsx | Isolate exact account codes, unchanged/localized display names, descriptions, currency labels and example text. Replace physical search padding/adornment, group count margin and row alignment with logical equivalents; mirror only directional disclosure. Let long header/action text, rows, grouped headers and type tabs wrap with shrinkable name columns; examples use one column at narrow widths. Name search, type tablist and sort, provide auto-direction search and explicit non-submit account rows. Distribution keeps enclosing rounded clipping and removes redundant physical first/last rounding. Raw search/type/sort values, canonical account IDs/routes, code ordering, built-in-name recognition and account creation drawer callback remain unchanged. |
| app/(dashboard)/accounting/accounts/[id]/layout.tsx | Isolate caller names/subtype/description, exact LTR code and displayed money/counts; permit long headings, currency badges and summary cells to shrink/wrap. Preserve account versus GL currency provenance and existing numeric/Minor validation. Directional back arrow mirrors, navigation keeps exact destinations and gains explicit non-submit actions, named nav and aria-current. Tabs wrap rather than clipping long labels. Universal accounting debit/credit trend glyphs retain their meaning. |
| app/(dashboard)/accounting/accounts/[id]/page.tsx | Exact LTR entry number and canonical Gregorian date are isolated; caller descriptions and unchanged exact-money formatter results are isolated. Amount headings/cells align to logical end, descriptions wrap while existing local horizontal table scrolling remains. Name and auto-direct the search; use logical adornment/padding/clear-icon margin. Entry-type tabs gain explicit locale direction and wrapping, sort is named with unclamped selection, start/end date groups are named and bounded. Existing native DatePicker canonical callbacks, search/type/sort/date query construction, append/pagination/loading/error guards, links and numeric/Minor money validation remain unchanged. |
| app/(dashboard)/accounting/accounts/[id]/settings/page.tsx | Associate each code/name/subtype/description label to its native field with stable IDs and accessible names; code remains LTR and caller prose uses auto direction. Name status select and allow selected values to wrap. Isolate displayed currency, make grid children shrinkable and save/danger actions wrap without clipping. Preserve original native field names/defaults and exact caller strings, built-in disabled/readOnly name/code locks, status options, raw FormData/PATCH/DELETE payloads, confirmation retry/error handling, toasts and event/navigation behavior. |

No REST/MCP, schema/migration, database, Stripe, exports, canonical currency/date/amount, posted history or accounting calculation changes. Existing numeric aliases remain validated safe integers paired with canonical Minor strings; derived formatting still uses bigint and explicit currency provenance. ISO codes and canonical identifiers are not translated or rewritten.

## Acceptance mapping

1. All four assigned sources are audited individually above. Actual account catalog and callback regressions preserve built-in naming/locking, canonical create/update/status/delete payloads, errors, route destinations and money aliases. The new fixture retains caller whitespace and escaping and compares low digits of 4000000000000001 minor units.
2. New actual component/provider/callback tests exercise en-US/fa-IR x latn/arabext: long mixed caller/code text, exact money, unknown/custom names, row and back/navigation callbacks, search/type/sort changes, canonical date callback, selected account status and disabled system inputs. Installed Tailwind output demonstrates logical margins/search padding and alignment, responsive wrapping, unclamped selection and direction-only icon mirroring. Existing actual components and exact ledger continuity/aging regressions are retained.
3. This evidence enumerates ownership and actual checks and records unverified browser/native/accounting/output limits. RTL-014/010/008/002 retain independent acceptance; this child does not check their criteria. DEC-005 removes screenshot blocking, while DEC-008 preserves Stripe unchanged.

## Actual verification

- `node --import tsx --test --test-concurrency=1 tests/rtl-ledger-accounts.test.ts tests/account-catalogs.test.ts tests/ledger-aging-ui.test.ts`: first run passed all 22 existing account/ledger tests and two new tests; three new fixture tests failed because the fixture used bigint for fields whose existing wire contract requires numeric aliases and because the callback finder selected a SelectItem. Corrected the fixture to safe numeric aliases plus exact Minor strings and selected the actual controlled callback. No product behavior was changed to accommodate the fixture.
- `node --import tsx --test tests/rtl-ledger-accounts.test.ts`: final 5/5 pass, zero failures/skips/cancellations. Together with the unchanged 22 passing existing regressions above this verifies 27 tests. This is two recorded runs, not a claim that the first combined run passed.
- `pnpm typecheck`: pass, exit 0, including generated Fumadocs and tsc. The final fixture corrections were made before that process completed.
- Scoped `pnpm exec eslint` on all four assigned sources and tests/rtl-ledger-accounts.test.ts: pass, exit 0.
- `pnpm lint`: pass, exit 0, zero errors and 21 existing unrelated warnings (including the owner's earlier inspection-script unused import).
- `pnpm i18n:check`: pass, 10723 keys in each locale; catalogs and translations unchanged.
- `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: all nine checks pass.
- `python .agentic/scripts/money_inventory.py --write`, `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: pass, 417 columns and 1889 consumers; final verification after fixture corrections also passed. Only four owned source hashes/occurrence lines and one new consumer-test record refreshed; MONEY_COLUMNS has no content diff.
- `git diff --check`: pass. Controller validates 415 tasks at entry; final done-state validation is recorded by controller completion.

Initial concurrent typecheck, full lint and tests exhausted available host RAM (approximately 350 MB free). Only this task's identified eslint process was stopped; the owner's existing dev server and all other services were untouched. Typecheck completed and free memory recovered; the corrected focused tests and final full lint ran sequentially. The interrupted lint run is not counted as a pass.

## Review and handoff

Codex performs an honestly attributed self-review allowed by current START_HERE step 6 / CONTROLLER for human_review=false. Separate review evidence records findings. No peer, human or native reviewer is impersonated.

No full build, dev-server startup, application DB writes, integration database fixture, provider action, screenshot/browser session, migration, production activation, push or deployment performed. This scoped source/component acceptance does not qualify mounted browser caret/selection/zoom, pixel clipping, keyboard/AT interactions, native Persian language, printed/PDF/email output, live REST/MCP/SQL or accounting/IRR production readiness. Those parent/qualification tasks remain independent.

Commit this bounded task locally. The parent delegates the next controller task to a fresh agent, which will commit its task and perform the authorized batch push.
