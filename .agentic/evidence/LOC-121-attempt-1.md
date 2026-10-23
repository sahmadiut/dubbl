# LOC-121 evidence - 2026-10-24

Operator: coding-assistant (Codex). Started on clean master at ca9357b7.
Only LOC-121 is completed by this delivery; parent/sibling acceptance stays open.

## Acceptance 1: implementation and inventory

Added 57 paired PublicPortal messages in en-US/fa-IR and used next-intl in the
six app/portal/[token] layout/page files. Navigation, headings, loading/empty
states, actions, errors and known invoice/quote statuses use the catalog. A typed
status mapper has a reviewed unknown fallback without changing machine values.
Overview failures no longer expose unreviewed network exception prose.

The exact-money readers and formatter, PDF filenames, URLs, tokens, payable
conditions, quote POST and authorization remain unchanged. No API, MCP, schema or
migration change. app/pay/[token]/page.tsx is the frozen Stripe flow and remains
unchanged under DEC-008; it is explicitly inventoried rather than localized.
See registries/PUBLIC_PORTAL_CATALOGS.md for all display/machine exceptions.
Generated MONEY_BOUNDARIES.json records the new source/test files and changed
consumer hashes/line positions; existing amount semantics are preserved.

## Acceptance 2: verification

All commands run in D:/Projects/dubbl. Final checks:

- node --import tsx --test tests/public-portal-catalogs.test.ts: 3/3 pass.
  Production JSX renders through the real PresentationProvider in both locales;
  controlled React state/effects and navigation expose initial/populated/empty/
  loading/error states, escaped names, unchanged money/date strings and paths,
  paid-invoice payment-link suppression and unknown display statuses. Production
  reads execute for success, HTTP, malformed JSON and disagreeing money aliases;
  failed reads adopt no rows. Quote accept and PDF failure callbacks preserve
  URLs/methods and use reviewed catalog messages. Every Persian value asserts
  Persian script. This is a controlled component harness, not a mounted browser.
- node --import tsx --test tests/integration/public-portal-wire.test.ts: 1/1 pass.
  Existing actual public REST handlers, linked registered SDK MCP calls and
  independent SQL assertions on migrated PostgreSQL. No live provider calls.
- pnpm i18n:check: 9,740 matching keys per locale and valid ICU contracts.
- pnpm typecheck: exit 0 (fumadocs-mdx and tsc --noEmit).
- pnpm lint: exit 0, zero errors and 20 pre-existing warnings outside owned files.
- npx eslint 'app/portal/**/*.tsx' i18n/public-portal-presentation.ts
  tests/public-portal-catalogs.test.ts: exit 0, zero errors/warnings.
- python .agentic/scripts/money_inventory.py --write; node --import tsx
  .agentic/scripts/verify_money_inventory.mjs: 417 columns, 1,842 consumer hashes.
- node .agentic/scripts/verify_legacy_money.mjs: 9 checks pass.
- python .agentic/agent.py validate and git diff --check: exit 0.

Integration used a unique OS-temp PostgreSQL 18 cluster with explicit UTF8/trust,
127.0.0.1:57831 and process-scoped TEST_DATABASE_URL/PG_BIN. The fixture creates
and drops its randomized database. pg_ctl stopped the cluster in finally. The
application database was not used.

Initial checks caught dynamic translation keys, nested catalog incompatibility
with existing test types, and test harness typing/lint/traversal issues. Repaired
these with flat keys, a typed mapping and corrected harness. Only final passing
runs support acceptance; no full build or dev server was run.

## Acceptance 3: limitations and handoff

Persian is provisional; no native linguistic approval, mounted browser/keyboard,
full RTL/calendar/numeral qualification, hosted CI, actual provider checkout,
deployment or production qualification is claimed. Stripe remains frozen. Honest
self-review only; LOC-009 and LOC-002 retain independent acceptance. After final
verification, record controller review/done, commit the owned files and push.
