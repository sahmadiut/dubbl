# Persian typography foundation — RTL-007

This registry covers the approved default font's packaging and shared typography.
It does not complete [RTL-002](../tasks/RTL-002.md) or
[RTL-008](../tasks/RTL-008.md)'s module, output, long-text/mobile/zoom qualification.

## Delivery and provenance

- The approved default is the unmodified, combined Persian/Arabic/Latin Vazirmatn
  variable font, official `v33.003`, commit
  `f68f7bc5dd1d046bd6a5a2bda355bd6d430e807a`.
- [Local WOFF2](../../public/fonts/vazirmatn/Vazirmatn-Variable.woff2),
  [original OFL notice](../../public/fonts/vazirmatn/OFL.txt), and
  [pinned source URLs/digests](../../public/fonts/vazirmatn/README.md) ship together.
  The binary is 111,152 bytes and has not been subsetted, converted or modified.
  Folder-local Git attributes keep the original notice LF-stable across platforms.
- [Root layout](../../app/layout.tsx) uses `next/font/local` with weights 100–900,
  normal style, preload, `display: swap`, the existing `--font-vazirmatn` variable,
  and Arial/sans-serif fallbacks. The installed Next loader test emits the exact
  local bytes to a local `/_next/static/media/` URL, with fallback metrics.
- This font needs no external stylesheet/CDN request at build or runtime. Existing
  Geist Mono and Playfair Display remain configured through `next/font/google`:
  their existing build-time delivery is unchanged. No whole-build offline claim
  or new license/distribution gate is introduced.
- DEC-004's deferred unrelated license/provenance work remains deferred. Existing
  root notices and all five private font assets are preserved. This task asserts
  no new rights or redistribution approval for those assets.

## Preference, fallback and numeric contracts

- Default body still uses the generated font's direct class. All six existing
  allowlisted `fontFamily` choices, null/invalid fallback, saved values and API/MCP
  contracts remain unchanged. Private selections retain their `!important` body
  font and `--font-site` override.
- [Global CSS](../../app/globals.css) inherits `font-variant-numeric: tabular-nums`
  from the body. Existing numerical controls and `IdentifierText` also keep their
  explicit `tabular-nums` utilities. No value, scale, numeral preference or Unicode
  content is rewritten by typography.
- The actual shipped font has Latin and Persian digits and Persian letter forms.
  At its default weight, installed fontkit shapes contextual Persian (including
  a lam/alef ligature) and produces equal advances for each numeral set with
  `tnum`: Latin 1,151 units, Persian 1,349 units. Persian advances without `tnum`
  differ, so the feature is necessary; the two scripts need not have equal widths
  to one another. Variable-axis metadata and emitted CSS declare 100–900.
- Existing `Geist Mono, selected-site-font, monospace` order and the root's explicit
  Geist-family variable remain intact. This permits per-character Persian
  fallback without adding wrapper spans or replacing English monospace.
- Existing line-height, letter/word spacing, component sizes, user zoom, styles of
  issued documents/PDF/email, canonical identifiers and hidden values are not
  changed. RTL-008 and the independent parent still own clipping/text-spacing/
  zoom review and module/output adoption.

## Evidence and boundaries

[Typography tests](../../tests/rtl-typography.test.ts) exercise the actual root JSX,
24 language/numeral/font preference combinations, real currency/identifier
controls, the actual installed Next local-font loader, actual font bytes/shaping,
and compiled installed Tailwind/global CSS. Existing root/locale/input/bidi/focus
tests retain their behavior. The
[source audit](RTL-007-source-audit.json) pins owned source/asset hashes and
preserved baseline assets/contracts; [task evidence](../evidence/RTL-007-attempt-1.md)
records final commands and results.

CUA inventory has no enabled browser or native app. No mounted rendering,
computed fallback-font assignment, `document.fonts`, font-loading timing,
native-linguistic review, screenshots, browser accessibility, zoom/text-spacing
or PDF shaping/layout pass is claimed. In particular, source/loader/fontkit/CSS
tests are not substituted for a browser-visible result. DEC-005 excludes
screenshot/helper-only blockers while preserving later behavior/layout review.
