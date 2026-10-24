# LOC-122 independent landing/help acceptance - 2026-10-24

Operator: codex-loc122, a fresh owner-authorized Codex worker for this task.
Baseline: clean master 118743ba96f4253df288c96c96a2b5e122d08cb4.
Controller validate/status/next/context selected LOC-122 with all prerequisites
resolved; started through the controller. Read root/.agentic instructions,
controller/project/repository map, actual source and all four child evidence
and exception inventories. Child completion was not treated as parent proof.

## Acceptance 1: independent audit and scope

The combined existing implementation is correct for bounded catalog extraction;
no production change or duplicate translation is necessary. Added
registries/LANDING_HELP_INTEGRATION.md and linked it from the catalog registry.
It maps LandingShell (78), LandingFeatures (283), PublicPricingLegal (268),
PublicMetadata (22) and the 11 added Docs keys to their detailed inventories.
MDX remains in its existing paired bilingual source; existing Docs navigation
keys remain in use. Gradient/activity/layout helpers add no owned prose.

Preserved explicit exceptions include opaque sample amounts/dates/IDs, code,
brands, company/legal facts, pricing values/interval math, URLs/SEO/assets and
frozen Stripe passages. No application/Stripe/provider, REST/MCP/schema,
authorization, money or locale preference implementation is changed. This
display-only acceptance adds no new operation or database need. No DB accessed.
The pre-existing footer /#integrations link lacks a matching home section ID;
recorded as an unchanged extraction-scope exception, not certified navigation.

## Acceptance 2: combined production verification

New tests/landing-help-integration.test.ts statically imports the actual Home,
LandingLayout, PricingPage, PrivacyPage and TermsPage and composes them inside
the actual root server layout with the real PresentationProvider/next-intl.
Only Next request/font I/O and unrelated theme/auth/Fumadocs provider boundaries
are controlled. Both locales assert root metadata/content coherence, one main
and footer, translated shared shell and owned page content, invariant links/SVG
data, fixed sample money/IDs/code and Stripe/legal facts, nine accessible closed
FAQ triggers, and zero rendering diagnostics. A second check verifies English
and Persian MDX source existence for every docs link rendered by the full home.
It does not claim MDX execution; the adjacent docs suite executes the production
page/layout/metadata with controlled source/request/framework boundaries.

Commands run from D:/Projects/dubbl:

- node --import tsx --test --test-concurrency=1
  tests/landing-help-integration.test.ts tests/landing-shell-catalogs.test.ts
  tests/landing-features-catalogs.test.ts tests/pricing-legal-catalogs.test.ts
  tests/docs-metadata-catalogs.test.ts tests/landing-activity.test.ts:
  20/20 passed, exit 0. Existing child tests exercise showcase/nav/timers,
  FAQ answers, plan/interval contracts, legal TOC callbacks, docs locale/source/
  metadata/notFound/static params and catalog inventories.
- Final node --import tsx --test tests/landing-help-integration.test.ts:
  2/2 passed after the test-local naming correction; exit 0.
- pnpm i18n:check: 10,587 paired keys, ICU/rich validation passed; exit 0.
- pnpm typecheck: fumadocs-mdx and tsc --noEmit passed; exit 0.
- npx eslint tests/landing-help-integration.test.ts: final exit 0, no warnings.
- pnpm lint: exit 0, zero errors and 20 pre-existing warnings outside owned files.
- node --import tsx .agentic/scripts/verify_money_inventory.mjs:
  417 columns, 1,848 hashes and source occurrence checks passed; exit 0.
- node .agentic/scripts/verify_legacy_money.mjs: 9 regressions passed; exit 0.
- python .agentic/agent.py validate: 360 tasks valid; exit 0.
- git diff --check: exit 0.

Intermediate harness repairs: the transpiled root's CommonJS provider import
loaded a different next-intl instance from the statically imported children;
explicitly supply the statically imported actual production PresentationProvider
to preserve module identity. Navbar also has a collapsed trigger, so FAQ count
now selects actual accordion-trigger elements rather than every closed control.
Changed a local variable named module to rootModule for the Next ESLint rule.
No production behavior or acceptance expectation was weakened.

## Acceptance 3: review and limits

Actual independent peer review by codex-parent (/root, Codex) inspected the
new production-composition tests, consolidated inventory and LOC-122 scope.
Approved contingent on final passing checks; see LOC-122-review-1.md.
No human/native review or hosted-CI result is claimed.

Persian/legal/financial wording remains provisional. No mounted browser,
hydration/keyboard, complete RTL, numeral/calendar, current marketing/legal
claims, crawler/indexing, asset availability, provider, deployment or production
qualification is inferred. No full build or dev server was run. LOC-009 and
LOC-002 remain independent acceptance parents, with later L10N/RTL gates intact.
The owner authorized task-only commit and push. Parent monitors hosted CI.
