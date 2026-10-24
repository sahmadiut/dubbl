# Preceding CI investigation requested during RTL-009

Owner explicitly requested checking the failed GitHub CI, reproducing/fixing it locally, and including the repair in the pending RTL-009 commit before proceeding. The first commit attempt was rejected before a commit existed; staged RTL-009 work was preserved. No push or remote mutation was performed for this investigation.

## Observed hosted result

Origin is sahmadiut/dubbl. The CLI initially resolved the upstream repository by default, so the relevant run was explicitly selected from origin. Relevant failed run: [40137985215](https://github.com/sahmadiut/dubbl/actions/runs/40137985215), commit 82552ef3a43bec40304075543a828b1f0e74030f, created 2026-10-24T22:18:27Z. GitHub connector job summaries and decoded Test logs were read directly. Test job 121003488060 failed; lint, typecheck, controller and PostgreSQL fixture jobs succeeded. Dependent build/Docker/migration jobs were skipped; no local full build is authorized or needed.

The Test job reported 1,529 tests: 1,525 passed and four failed. All four failures were TypeError `(0 , local_1.default) is not a function` when loading the real app/layout.tsx in two older test harnesses:

- tests/docs-metadata-catalogs.test.ts: root metadata and root production rendering.
- tests/landing-help-integration.test.ts: landing composition and documentation destinations.

## Cause and repair

RTL-007 changed approved Vazirmatn delivery from next/font/google to next/font/local. These two existing root-layout harnesses still mocked only named Google fonts and allowed the local-font import to reach the untransformed Next build-time boundary under Node. Production loader behavior was already independently verified by tests/rtl-typography.test.ts. This is a stale harness boundary, not a font/metadata/product/workflow defect.

Add the current next/font/local default-export boundary mock to both suites and retain only actual Google names Geist_Mono and Playfair_Display. Existing real production components, metadata assertions, bilingual catalogs/routes and separate installed-font-loader tests stay intact. No weakened assertion, skip, production font change or workflow change is used.

## Local reproduction and focused repair verification

Before editing: node --import tsx --test --test-concurrency=1 tests/docs-metadata-catalogs.test.ts tests/landing-help-integration.test.ts reproduced exactly **4 failures and 3 passes**, exit 1, with the same local_1.default TypeError and root-layout import stack as CI.

After repair: node --import tsx --test --test-concurrency=1 tests/docs-metadata-catalogs.test.ts tests/landing-help-integration.test.ts tests/rtl-typography.test.ts tests/rtl-root-direction.test.ts passed **16/16**, exit 0. This includes all four repaired tests, actual installed Next local loader/asset shaping and root/Radix direction checks. Full pnpm test and repair-owned lint were then started to confirm the pending commit; final results belong in RTL-009-attempt-2.md.

No hosted replacement run, production qualification, browser/native/PDF review, application DB write, full build or dev startup is claimed. The requested paired push remains the supervisor's responsibility.
