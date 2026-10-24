# LOC-128 evidence - 2026-10-24

Operator: codex-locale-worker (Codex), a fresh owner-authorized worker for this
single task. Initial master HEAD 83e5a9baa7eca9dd759f54c153f8a0d7d087e20d
contains the owner's existing landing-performance commit, preserved as ancestor.
The only initial uncommitted change was this task's legitimate in-progress
controller transition. Scope: root/docs chrome and public metadata.

## Acceptance 1: extraction and contracts

Added 22 PublicMetadata messages and 11 Docs messages in both locales (33 new
paired messages). Root, privacy and terms metadata use Next generateMetadata
and existing request locale resolution. Root Open Graph locale now matches
the selected locale as en_US/fa_IR. Fumadocs receives all ten labels explicitly
from Docs; existing English defaults and inline Persian labels retain their
exact values. Docs metadata wraps its existing MDX title with a complete
message while description/title/body content remains in the bilingual source.

All technical SEO/asset/URL/robots/brand/legal entity contracts and docs source
selection, static params, missing-page behavior and existing routes are
preserved. No Stripe-specific file/passage, MDX content, provider, REST/MCP,
schema, money or authorization implementation changes. No DB was accessed;
this display-only change adds no user operation requiring a new MCP tool.
See registries/DOCS_METADATA_CATALOGS.md for the explicit exception inventory.

MONEY_BOUNDARIES is refreshed generated metadata. It includes current source
hashes/occurrences for this task plus existing drift from ancestor 83e5a9ba
(landing activity/gradient sources and test). No financial column classification
or policy changes are made; no unrelated source files are edited.

## Acceptance 2: observed verification

Commands ran from D:/Projects/dubbl:

- node --import tsx --test --test-concurrency=1
  tests/docs-metadata-catalogs.test.ts tests/pricing-legal-catalogs.test.ts
  tests/landing-shell-catalogs.test.ts tests/landing-features-catalogs.test.ts:
  17/17 passed. Five new tests execute production root/docs server components
  and metadata with real next-intl catalogs and the real root
  PresentationProvider. Framework/provider/font/request I/O boundaries are
  controlled. They inspect all ten Fumadocs values, root HTML locale/app brand,
  public/social/keyword/image metadata, fixed SEO fields, docs tree/MDX language
  choice, absent/explicit/missing slugs, notFound, static params, complete legal
  messages/entities, paired keys, full metadata references and Persian script.
- Final focused docs-metadata suite after the type narrowing and bounded
  translator-message typing: 5/5 passed.
- node C:/Users/Sajjad/AppData/Local/Temp/loc128-baseline.cjs:
  exact deep equality between original HEAD English metadata and current
  generated English metadata for root, privacy and terms. Temporary local
  harness transpiles actual baseline/current metadata; not a browser check.
- pnpm i18n:check: exit 0, 10,587 matching keys with ICU/rich validation.
- pnpm typecheck: final exit 0 (Fumadocs generation plus tsc --noEmit).
- npx eslint on root/docs layout/docs page/privacy/terms/new test: exit 0,
  no warnings; final new-test rerun after its type-only repair also passes.
- pnpm lint: exit 0, zero errors/20 existing warnings outside owned files.
- python .agentic/scripts/money_inventory.py --write and node --import tsx
  .agentic/scripts/verify_money_inventory.mjs: exit 0, 417 columns and 1,848
  consumer hashes/source occurrence checks verified.
- node .agentic/scripts/verify_legacy_money.mjs: 9 regression checks pass.
- python .agentic/agent.py validate: exit 0, 360 tasks structurally valid.
- git diff --check: exit 0.

Intermediate repairs: metadata inventory initially scanned legal-body keys;
scoped the new inventory to generateMetadata. Existing LOC-127 AST inventory
also treated legal metadata t calls as body keys; explicit metadataT names
separate the translators without weakening that existing test. Named the test
boundary component for react/display-name. The first typecheck found a test
access to metadataBase.href without narrowing Next's string|URL type; added an
instanceof assertion and bounded mocked translators to their two namespaces.
No production assertion/contract was weakened to hide these failures.

## Acceptance 3: review and qualification limits

Actual independent peer review by codex-parent (/root, Codex) inspected
production diff, new tests, server locale/request resolver, legal metadata and
installed Fumadocs defaults. It found no blocking issue and approved contingent
on final verification. See LOC-128-review-1.md. No human/native review is claimed.

Persian wording remains provisional. No mounted browser/keyboard/full RTL,
native/legal terminology, crawler/search index, linked asset availability,
provider, hosted-CI, deployment or production acceptance is claimed. No full
build/dev server was run. LOC-122, LOC-009 and LOC-002 remain independent;
their completion and later native/RTL qualification are not inferred here.

## Handoff

All required checks passed. Complete controller acceptance/review, commit only
task-owned files/generated metadata, push with owner's authorization, verify
remote SHA and clean tree, report controller's next selection and stop.
