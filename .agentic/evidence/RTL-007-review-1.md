# RTL-007 self-review

Reviewer: `codex-task-015`. Kind: **self**. This is not peer, owner, native,
browser, accountant or production approval.

## Acceptance review

1. The approved default font is an unmodified, pinned official Vazirmatn variable
   WOFF2 with its original OFL notice alongside it. The actual installed Next
   local-font loader emits the exact bundled bytes, swap/preload/weight/style and
   fallback metrics without network I/O. All six font preferences and private
   binaries/root notices remain preserved. Other existing Google font setup is
   unchanged; unrelated DEC-004 licensing work stays deferred.
2. Actual fontkit default-instance shaping verifies contextual Persian and all
   supported common characters. Actual `tnum` advances are equal within both
   Latin and Persian digit sets; metadata/emitted CSS declares 100–900 weights.
   Body CSS inherits tabular numerals, while current selected-site/Geist Mono
   per-character fallback remains in the compiled stylesheet. Actual root and
   real input/identifier controls preserve canonical values and mixed script
   text in all 24 locale/numeral/font combinations.
3. Existing locale/root/financial input/bidi/focus regressions pass together:
   33/33 final tests. Typecheck, owned lint, catalogs and money/classification
   guards pass. Original failed harness runs and exact limitations are explicitly
   recorded rather than described as passing. Full lint exits 0 with 20 existing
   warnings, none in owned files. Final scope/source/classification checks pass;
   controller approval remains honestly attributed self-review.

## Scope and limits

No copied font implementation, conversion, private-font rights assumption,
provider/billing/Stripe edit, machine contract, monetary unit, route/storage
change or font preference redesign. Frozen sources and owner numeric behavior
are checked against the baseline. No new business operation needs an MCP tool.

There is no mounted browser/font-visibility/loading timing, native review,
nondefault-weight rendering, screenshot, PDF, mobile/zoom/text-spacing or
module-wide qualification claim. RTL-008 and independent RTL-002 remain open.
The original root notices are unchanged and no release licensing gate is added.

Review approval is recorded only after all final required checks pass and the
task-owned staged diff is verified. See [task evidence](RTL-007-attempt-1.md) and
the [typography registry](../registries/PERSIAN_TYPOGRAPHY.md).
