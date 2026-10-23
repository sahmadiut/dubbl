# LOC-125 evidence - 2026-10-24

Operator: coding-assistant (Codex). Started on clean master at 6e3fbddb.
The next controller task was LOC-122. Source inspection found roughly 250 KB of
landing/pricing/legal code plus documentation/metadata boundaries; used the
controller split workflow for LOC-125..128. This delivery completes LOC-125 only.
The split, navigation index and source coverage preserve LOC-122 as an integration
parent, and leave LOC-009/LOC-002 acceptance independent. No parallel agents used.

## Acceptance 1: implementation and exception inventory

Added 78 matching LandingShell messages to en-US/fa-IR and integrated next-intl
into components/landing/navbar.tsx, footer.tsx, hero.tsx, cta-section.tsx and
trust-bar.tsx. Navbar mobile menu gets a translated accessible label. Navigation,
conversion copy, footer groups/link labels, hero demo labels and ticker sentences
are localized. The rich hero heading uses the already-approved em catalog tag
with the existing accent classes; translators can reorder the complete sentence.

Fixed destinations, menu close/state behavior, amounts/percentages/counts, demo
IDs, chart paths/animation data, API/code samples, company facts and copyright
year are preserved. Stripe's footer entry stays English and retains its URL.
No REST/MCP, database, pricing/provider, workflow or accounting implementation
changes. No feature operation is added; existing APIs/MCP remain intact.
See registries/LANDING_SHELL_CATALOGS.md for explicit exceptions and sibling scope.

## Acceptance 2: verification

All commands run from D:/Projects/dubbl. Final results:

- node --import tsx --test --test-concurrency=1 tests/landing-shell-catalogs.test.ts
  tests/public-signing-catalogs.test.ts tests/public-portal-catalogs.test.ts: 9/9.
  Three new landing checks render statically imported production templates with
  real PresentationProvider/next-intl in both locales, assert route parity,
  amount/ID/code/company facts and identical SVG paths, exercise production
  mobile menu close/state callbacks through a controlled hook capture, and use
  TypeScript AST to inventory remaining JSX literals and all 78 referenced keys.
  Every Persian value asserts Persian script. Mobile portals are not claimed as
  mounted browser coverage. TrustBar is tested although not mounted by home.
- pnpm i18n:check: 9,818 matching keys per locale, ICU/rich-tag validation passes.
- pnpm typecheck: exit 0 (fumadocs-mdx and tsc --noEmit).
- pnpm lint: exit 0, zero errors and 20 existing warnings outside owned files.
- npx eslint on the five owned components, landing test and two changed opaque
  integration files: exit 0, zero errors/warnings.
- python .agentic/scripts/money_inventory.py --write and node --import tsx
  .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,843 consumer hashes.
- node .agentic/scripts/verify_legacy_money.mjs: 9 regression checks pass.
- python .agentic/agent.py validate and git diff --check: exit 0, 360 tasks valid.
- python .agentic/tests/test_agent.py with the seven split/nested-parent/priority/
  preserved-dependency/invalid-split/external-blocker/queue tests: 7/7, exit 0.

Initial catalog validation rejected a custom accent rich tag; used the existing
approved em tag instead. Initial controlled render harness loaded a second
next-intl instance through CommonJS primitives; static imports for full template
rendering and a separate raw-tree callback capture fixed provider identity.
An escaped ampersand expectation was corrected in the test. These failures were
repaired before final passing runs.

The initially launched full controller unittest suite was stopped while its
synthetic full-backlog simulation was still running. It is not counted as passed.
The focused split/nested-parent/queue/priority regression selection verifies the
planning operation used here; full structural validation also passes.

## Owner-requested preceding GitHub CI investigation

During this task the owner explicitly asked to inspect the GitHub failure before
pushing. Inspected sahmadiut/dubbl run 40027151821 at 6e3fbddb via GitHub job APIs:
https://github.com/sahmadiut/dubbl/actions/runs/40027151821/job/120666102440

Controller, lint, typecheck and unit/catalog jobs passed. PostgreSQL integration
reported 183/184 passed. The single failure was MON-034 combined opaque/public
rendering: getTranslations is not supported in Client Components at SignPage,
called by opaque-public-integration-worker.ts outside a Next request.

Reproduced before changes with the real migrated disposable PostgreSQL fixture:
node --import tsx --test tests/integration/opaque-public-integration.test.ts
returned exit 1, 1/2 passed, with the identical getTranslations stack.

Repaired only the fixture: enable module mocks in its child process, supply a
real next-intl translator at the Next request-locale boundary before dynamically
importing SignPage, and render under the existing PresentationProvider helper.
This matches the dedicated signing fixture. Real page, handlers, DB, registered
SDK MCP calls, exact money, scope/snapshot/audit assertions and unsafe-money guard
still execute. No product/server behavior or assertion is weakened.

After fix, node --import tsx --test --test-concurrency=1
tests/integration/opaque-public-integration.test.ts
tests/integration/invoice-signatures.test.ts
tests/integration/public-portal-wire.test.ts: exit 0, 4/4 checks pass.
Baseline and fixed runs used separate unique OS-temp PostgreSQL 18 clusters,
UTF8/trust, 127.0.0.1:57833, explicit process TEST_DATABASE_URL/PG_BIN and randomized
created/dropped databases. pg_ctl stopped each cluster in finally. No app DB used.
Local PostgreSQL is 18; hosted CI used PostgreSQL 16. Full 184-case integration
rerun and replacement hosted CI are not claimed or awaited; the sole failed
fixture plus adjacent signing/portal suites were verified locally.

## Acceptance 3: limits and handoff

Provisional Persian only; no native linguistic, mounted browser/keyboard, full
RTL, calendar/numeral, marketing/legal claim, provider, deployment or production
qualification is claimed. No build or dev server was run. Honest self-review
only. Complete LOC-125 evidence/review/done and push the scoped delivery including
the owner-requested CI fixture fix; report controller next and stop.
