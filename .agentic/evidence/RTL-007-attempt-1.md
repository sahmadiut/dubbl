# RTL-007 — self-hosted approved Persian typography

## Scope and baseline

One bounded typography/font-packaging child of [RTL-002](../tasks/RTL-002.md), on
baseline `47e039646c5b45c95cd08090220463b4391e82f4`. Main working tree was clean at
selection. The live controller selected RTL-007 with no unmet dependencies and
373 structurally valid tasks. Only this child is accepted; RTL-008 and RTL-002
retain module/output and independent mixed-text/layout/accessibility qualification.

## Implemented and reviewed

- The approved default Vazirmatn now uses [`next/font/local`](../../app/layout.tsx)
  with an unmodified official `v33.003` combined Persian/Arabic/Latin variable
  WOFF2, weight 100–900, normal style, preload, `display: swap`, the same
  `--font-vazirmatn` variable, and Arial/sans-serif fallback. The direct body class
  and all private font preference overrides remain intact.
- The [asset](../../public/fonts/vazirmatn/Vazirmatn-Variable.woff2), original
  [OFL](../../public/fonts/vazirmatn/OFL.txt) and
  [pinned upstream URLs, commit and digests](../../public/fonts/vazirmatn/README.md)
  ship together. Official tag resolves to
  `f68f7bc5dd1d046bd6a5a2bda355bd6d430e807a`; font is 111,152 bytes,
  SHA-256 `4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92`.
  The downloaded OFL SHA-256 is
  `17e355067c8284f47743a1ee3b1ef7ff684ff0601eda357f9353b10b3016ab31`.
  No font data was converted, subsetted or modified. Folder-local Git attributes
  retain original LF notice bytes despite Windows `core.autocrlf=true`, so the
  exact upstream notice fingerprint also survives a fresh checkout.
  Staged whitespace review found one original upstream trailing blank in OFL;
  a notice-only Git `blank-at-eol` exception preserves its exact bytes instead of
  editing upstream notice text. All authored files retain normal whitespace checks.
- [Global CSS](../../app/globals.css) supplies inherited tabular numerals. Existing
  explicit numeric utilities remain. Installed fontkit confirms this font's
  contextual Persian shaping and equal advances **within** Latin and Persian
  numeral sets when `tnum` is enabled (1,151 and 1,349 font units respectively).
  Persian advances differ without the feature. The two scripts need not have
  equal widths to each other. Actual shaping is verified at the default instance;
  variable-axis metadata and emitted CSS are verified for the declared range.
- The selected site font remains the per-character fallback after Geist Mono,
  with the prior explicit root Geist-family override intact. No spans, Unicode
  markers, text/value conversion, scale changes or changed font preference schema.
- The [registry](../registries/PERSIAN_TYPOGRAPHY.md) and
  [source audit](../registries/RTL-007-source-audit.json) document ownership,
  asset/source hashes, delivery, typography, fallback and qualification limits.
  Five private font assets, existing LICENSE/THIRD_PARTY_NOTICES, locale/numeric
  contracts and four frozen provider/billing/pricing/checkout/mixed sources are
  unchanged. Existing Git text newline filters are accounted for when comparing
  text blobs; all five private font binaries also compare byte-for-byte.

DEC-004's unrelated licensing work remains deferred. Only the applicable notice
for the newly bundled approved font is added; no private-font rights approval,
new distribution gate, relicensing or public release is inferred. Geist Mono and
Playfair Display retain their existing Next Google font configuration. This
approved Persian font no longer requires a font CDN at **build or runtime**; no
claim is made that every other existing font/build dependency is offline.

## Exact verification and results

- Initial `node --import tsx --test --test-concurrency=1
  tests/rtl-typography.test.ts tests/rtl-root-direction.test.ts`: 7/9 pass.
  Two new instrumentation boundaries were corrected: installed fontkit cannot
  instantiate a WOFF2 variation through its `getVariation` path, so the test now
  accurately exercises default-instance glyph shaping plus actual axis metadata;
  the standalone CSS compiler also needs installed Tailwind default theme data.
  No browser or nondefault-weight glyph pass was inferred from those failures.
- Intermediate 30-test affected run: 29/30 pass. Its only remaining failure was
  a too-broad CDN regex matching Tailwind's license-comment website. The check now
  rejects actual external `url(...)` and imports rather than nonrequest comments.
- Final `node --import tsx --test --test-concurrency=1
  tests/rtl-typography.test.ts tests/rtl-root-direction.test.ts tests/locale.test.ts
  tests/localized-number-presentation.test.ts tests/rtl-bidi-controls.test.ts
  tests/rtl-acceptance.test.ts`: **33/33 pass**, exit 0, no failures, skips or
  cancellations. Five new typography cases plus existing locale/font preference,
  root/Radix/Fumadocs, real financial input/callback, bidi and focus regressions.
  Actual root JSX is rendered in all 24 language/numeral/font combinations; hidden
  ASCII decimals, signed/int64 source regression values, machine ISO identifiers,
  escaped mixed-script caller text and saved font choice remain unchanged.
- Actual installed `next/dist/compiled/@next/font/dist/local/loader` executes
  inside the new suite, reading the real WOFF2 through local filesystem only and
  emitting its exact bytes to a local `/_next/static/media/` URL. Verified swap,
  preload, variable weight/style, Arial fallback metrics and no CDN URL. This is
  a direct loader test, **not** a full Next build.
- Actual installed Tailwind compiler consumes current global CSS and its default
  theme; inherited numeric feature and font-sans/font-mono/code/selected-site
  fallback contracts are verified. Source comments/URLs are not runtime requests.
- `pnpm exec eslint app/layout.tsx tests/rtl-root-direction.test.ts
  tests/rtl-typography.test.ts`: exit 0, no warnings/errors.
- `pnpm typecheck` (`fumadocs-mdx && tsc --noEmit`), session 53823: **exit 0**.
- `pnpm i18n:check`: exit 0, **10,702 keys per locale**, catalogs unchanged.
- `python .agentic/scripts/money_inventory.py --write`: exit 0, 417 columns,
  2,489 scanned source files, 1,870 consumer hashes. Generated source fingerprints
  updated; no monetary source logic changed.
- `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0,
  417 columns/1,870 hashes and source occurrences verified.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, **all nine checks pass**.
- UTF-8 JSON comparison of the complete 417 `schema_columns` records to baseline:
  equal. Thirteen preserved baseline Git blobs and eight owned source/asset
  hashes match the final source audit. Private binaries are unchanged.
- `pnpm lint`, session 16745: **exit 0**, no errors and 20 pre-existing warnings;
  no warnings in this task's owned source/test files.
- After adding notice-preserving Git attributes and documentation, final
  `node --import tsx --test tests/rtl-typography.test.ts`: **5/5 pass**, overlapping
  the 33-test suite, no new distinct test count. Git confirms LF notice attributes
  and equal filtered/unfiltered OFL blob bytes. No runtime source changed after
  the successful full typecheck/lint runs.

## Boundaries and handoff

Fresh `cua.getState()` returns `apps: []`, `browsers: []`. No enabled browser is
available. No mounted rendering, computed fallback-font assignment, document.fonts,
native Persian review, font-loading timing, screenshot, mobile/zoom/text-spacing,
PDF shaping/layout or browser focus pass is claimed. Fontkit/React/loader/CSS
evidence is described accurately and does not substitute for unrun visual review.
DEC-005 excludes screenshot/helper-only blockers, not later real behavior review.

No full build, dev-server startup, database write, hosted CI wait, deployment or
IRR enablement. No new REST/API/MCP operation or contract: this is typography
only. Owner's Persian rial-after-amount and global back-arrow behavior remain
preserved. Dedicated Stripe/provider and frozen billing/pricing/checkout/mixed
sources remain unchanged; no provider qualification is attempted.

Close RTL-007 only after honestly attributed self-review and final required gates.
RTL-008 is the next child; RTL-002 independently accepts the whole combination.
One task-owned local commit is created; supervisor handles the paired push.

All required source/runtime/static gates above are complete. Final UTF-8, local
links, eight owned hashes, 13 preserved blobs, classification equality,
controller structure and task-owned whitespace/scope are checked before the
controller's submit/self-review/done transitions and commit. No further source
changes, tests or unrelated qualification are planned.
