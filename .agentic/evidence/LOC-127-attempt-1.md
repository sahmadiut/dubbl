# LOC-127 evidence - 2026-10-24

Operator: codex-locale-worker (Codex), delegated by the owner-authorized parent
orchestrator. Started from clean master 8da39a5f. Scoped to the pricing/privacy/
terms pages, shared LegalPageLayout and supporting LegalToc's two chrome labels.
The parent approved inclusion of that supporting component during this task.

## Acceptance 1: extraction and preserved contracts

Added 268 matching PublicPricingLegal messages. Static legal sections now build
in translation context. Whole rich paragraphs/list items preserve strong and
fixed anchor elements through reviewed code. Pricing heading, limit summaries,
billing descriptions, storage actions and last-updated label use complete
messages. Interval buttons expose the selected value with aria-pressed.

Plan IDs/prices/limits/flags, annual arithmetic, storage conversions, dates,
company/authority facts and labels, legal references/periods, every URL, section
anchor, animations and all frozen Stripe passages remain intact. Plan/provider
implementation files are untouched. Existing numeral formatting remains scoped
to LOC-003. Metadata remains for LOC-128. No REST/MCP/schema/workflow operation is
added; no database accessed. See registries/PRICING_LEGAL_CATALOGS.md for explicit
exceptions. MONEY_BOUNDARIES is refreshed generated source/consumer metadata;
column classifications and financial boundary policy remain unchanged.

## Acceptance 2: observed verification

All commands ran from D:/Projects/dubbl:

- node --import tsx --test --test-concurrency=1
  tests/pricing-legal-catalogs.test.ts tests/landing-features-catalogs.test.ts
  tests/landing-shell-catalogs.test.ts: 11/11 passed. Four new tests render the
  actual production pages with real PresentationProvider/next-intl, compare URLs,
  anchors and SVG data across locales, assert company/legal/Stripe facts, exercise
  monthly and annual callbacks/actual rendered prices, compare fixed plan limit
  and boolean matrices/storage keys, and exercise LegalToc's observer options,
  observed/missing targets, active section, mobile close, smooth scroll and cleanup.
  Catalog checks cover all references, paired keys, Persian script, every numeric
  fact, and an AST inventory of remaining JSX exceptions.
- Final focused pricing/legal 4/4 rerun after adding the JSX-exception assertion.
- Ad hoc baseline harness transpiled original HEAD and working production pages,
  rendered with the real provider, stripped markup without inserting spaces, and
  normalized whitespace: exact English textContent parity for all three pages.
  Command: node --import tsx
  C:/Users/Sajjad/AppData/Local/Temp/loc127-baseline.cjs (temporary local harness).
- pnpm i18n:check: exit 0, 10,554 matching keys; ICU and rich-tag checks pass.
- pnpm typecheck: exit 0 after the namespace-specific translator type repair.
- pnpm lint: exit 0, zero errors/20 existing warnings outside owned files.
- npx eslint on three owned pages, layout, TOC and new test: exit 0, no warnings.
- python .agentic/scripts/money_inventory.py --write and node --import tsx
  .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,847 consumer hashes,
  all source occurrence checks passed.
- node .agentic/scripts/verify_legacy_money.mjs: 9 regression checks passed.
- python .agentic/agent.py validate: exit 0, 360 tasks structurally valid.
- git diff --check: exit 0.

Repaired intermediate failures: automated extraction renamed the sections JSX
attribute along with its data reference; restored the static attribute name.
The generic unscoped translator helper exceeded TypeScript instantiation depth;
bounded its type to PublicPricingLegal. The initial monthly rendering harness
reused a hook index from raw capture; reset that index for each separate render.
The final AST-exception assertion inferred a JSX-only parent type; explicitly
typed its ancestor walk as ts.Node before the final successful typecheck.
No product expectation was weakened to hide those failures.

## Acceptance 3: review and limits

Actual AI peer review by /root (Codex), delivered through collaboration after
direct inspection of layout/TOC, pricing helpers/page, legal rich sections/facts
and the four-test suite: approved subject to passing final checks and honest
evidence. Those checks passed; no blocking finding. See LOC-127-review-1.md.

Persian/legal translations are provisional. No human/native/legal approval,
mounted browser/keyboard, full RTL, locale-formatting, current-statute/claim,
provider or production/deployment acceptance is claimed. No build/dev server
was run. LOC-122, LOC-009 and LOC-002 remain independent. The parent monitors
hosted CI separately; this child does not claim CI success for its future commit.
The owner explicitly authorized committing and pushing each bounded task.
