# LOC-126 evidence - 2026-10-24

Operator: codex-locale-worker (Codex), delegated by the owner-authorized parent
orchestrator. Repository baseline master 909caf7; entry had only the controller's
started LOC-126 task edit. This bounded child does not accept LOC-122/009/002.

## Acceptance 1: implementation and exceptions

Extracted 283 paired LandingFeatures messages from the eight owned components:
bento-features, dashboard-preview, feature-sections, how-it-works, integrations,
open-source, testimonials and faq. Static data factories translate within render
context. Complete problem/solution headings and FAQ contact sentence are rich
messages with the existing accent spans/anchor supplied by reviewed code. View
buttons now expose localized accessible names and active pressed state.

Preserved sample money/IDs/dates, statuses, SVG/chart geometry, animations and
code/terminal examples. Marquee highlighted pills use explicit booleans matching
the prior English substring decisions; translation cannot change their styling.
Network nodes translate once per render. Stripe Payout, the complete Stripe/
Payments integration card, API-First title/Stripe description remain literal.
No REST/MCP, schema, accounting, provider implementation or feature operation was
added. Refreshed source consumer hashes in MONEY_BOUNDARIES only; no money policy
change. Full exception inventory: registries/LANDING_FEATURE_CATALOGS.md.

## Acceptance 2: verification

All commands used D:/Projects/dubbl. Final observed results:

- node --import tsx --test --test-concurrency=1
  tests/landing-features-catalogs.test.ts tests/landing-shell-catalogs.test.ts:
  7/7 passed. The four new checks render static production components using real
  PresentationProvider/next-intl in both locales; compare routes/SVG paths/points;
  retain sample money/code/IDs/Stripe literals; exercise all three showcase views,
  localized names/pressed state, navigation callbacks, six-second timer advance,
  wrap and cancellation; compare exact highlighted classes across locales; inspect
  all nine question/answer pairs and stable single/collapsible accordion props;
  assert all 283 keys are referenced/paired and Persian values contain script.
- An ad hoc baseline harness transpiled each original git HEAD component and
  working component, rendered both under the real provider, stripped markup and
  normalized whitespace: English visible text unchanged for all eight components.
  Command: node --import tsx
  C:/Users/Sajjad/AppData/Local/Temp/loc126-baseline.cjs (local temporary harness).
- pnpm i18n:check: 10,286 matching keys; ICU/rich-tag contracts passed.
- pnpm lint: exit 0, zero errors and 20 pre-existing warnings outside owned files.
- npx eslint on the eight owned components and the new test: exit 0, no warnings.
- python .agentic/scripts/money_inventory.py --write and node --import tsx
  .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,846 consumer hashes,
  all occurrence/source-line checks passed.
- node .agentic/scripts/verify_legacy_money.mjs: all 9 regression checks passed.

Initial typecheck found three factory-only visual components missing their local
translation hook; added the hooks. Initial rich contact tags link/a were rejected
by the allowlist; use the already-approved em tag mapped to the existing anchor.
An initial test counted incidental Radix closed nodes; final assertion checks
the nine collapsed accessible triggers instead. Final results supersede these
repaired intermediate failures.

## Acceptance 3: scope and limits

Persian wording remains provisional pending native review. No mounted browser,
keyboard, full RTL, calendar/numeral, marketing/legal/API claim, provider,
deployment or production qualification is claimed. No build/dev server was run.
No database was accessed. Parent/sibling integration tasks remain independent.
The orchestrator monitors hosted CI separately; this child does not claim hosted
CI success for its future commit. User explicitly authorized commit and push.

## Final checks and review

- pnpm typecheck: exit 0 (fumadocs-mdx and tsc --noEmit) after the hook repair.
- python .agentic/agent.py validate: exit 0, 360 tasks structurally valid.
- git diff --check: exit 0.
- Final focused 7/7 rendering/behavior checks rerun after the accessible FAQ
  assertion refinement. Money inventory regenerated and verified after final
  source/test changes. Only scanned_paths and generated consumers changed at the
  registry top level; column classifications/boundary policy are unchanged.

Actual peer review by /root (Codex), delivered through the collaboration channel:
approved bounded LOC-126 source/test diff subject to passing typecheck and honest
evidence. Reviewed FAQ rich sentence and fixed URL, showcase timer/navigation,
node reuse, production/callback tests, preserved sample money/Stripe/code and
English baseline parity. Suggested node reuse, full rich headings and meaningful
accessible FAQ assertions; incorporated. Final typecheck passed. No blocking
findings remain. See LOC-126-review-1.md; no human/native approval is claimed.
