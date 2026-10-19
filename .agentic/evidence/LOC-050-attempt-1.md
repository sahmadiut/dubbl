# LOC-050 attempt 1 - recurring bill catalogs

## Identity and scope

2026-10-19 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: dfcd82c35aeca2055e12dd5250ab256ace0eb0b8. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next selected LOC-050; only this bounded child was started.
LOC-026/007/002 retain independent integration acceptance. No subagents were used.

Applied the previously read memory controller-task skill and checked the prior
MON-142 recurring-bill contract against current money/UI/REST/MCP source. Read
root instructions, task/parent/dependency and catalog/source requirements plus
project/repository/controller/frontend guidance in this conversation. DEC-008
preserves Stripe unchanged. No full build or development server was run.

## Implementation and acceptance mapping

1. Added 42 paired RecurringBills messages, bringing both catalogs to 5,207 keys.
   The [scope inventory](../registries/RECURRING_BILL_CATALOGS.md) covers the
   recurring bill list, embedded creation drawer, read/validation/create errors,
   status/frequency labels and explicit caller/technical/shared-form exceptions.
   Error state stores finite keys; the current locale supplies display text.
   Selected frequency is explicitly translated in the existing Radix trigger;
   its six option values and monthly default are preserved. Prior namespaces
   are unchanged. Every new Persian message contains Persian script.
2. Real production workspace rendering through React/next-intl and
   PresentationProvider checks English and Persian titles/guidance, headers,
   loading/empty/error states, escaped caller data and exact currency rows.
   The actual table, frequency selector, currency selector and shared line editor
   are used; state/effects, sheet portal and contact-picker boundaries are
   controlled. Visible selected trigger and portal option values/text/callbacks
   are tested separately. USD/JPY/KWD/IRR previews retain fixed-two inputs;
   0.005 times 3 still becomes 3 raw units. Production callback syntax verifies
   org headers, bill type, unchanged payload serialization, nullable schedule
   controls, exact decimal strings, preserved inputs after failures, busy/reset
   behavior, cancellation, malformed envelopes/aliases, HTTP/HTML/network and
   invalid-success outcomes. Known local input failures are mapped explicitly;
   the custom Zod date-order issue receives its reviewed translation. Unknown
   server/parser prose is never displayed. No monetary helper, rounding,
   generation policy, currency fallback, REST/MCP/service/auth/schema/migration,
   persisted-unit or IRR flag change was made. Existing MCP covers both operations.
3. Scope, task handoff and review retain provisional Persian, native/RTL handoff
   and separate LOC-026/007/002 integration acceptance. Shared ContactPicker
   internal menus/badges remain LOC-058; purchasing navigation/forms remain
   LOC-056. Shared line forms already use DocumentForms and remain unchanged.

## Verification

| Check | Actual result |
|---|---|
| Focused recurring bill catalog/money tests | Exit 0; 10/10, including 5 new production rendering/callback/source tests |
| Full unit/static suite, concurrency 4 | Exit 0; 900/900, no failures, skips or cancellations |
| Migrated PostgreSQL recurring bill/payable integration | Exit 0; 2/2 REST/MCP/generation/SQL suites |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 5,207 compatible keys per locale |
| Changed-source/test ESLint | Exit 0; no errors or warnings |
| pnpm lint | Exit 0; 0 errors, 69 warnings in unrelated existing files |
| Money inventory refresh/verifier | Exit 0; 417 columns, 1,690 consumer hashes and all occurrence/source lines verified |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog audit | Exit 0; AST rejects authored English JSX/display attributes, every new Persian message has script, prior namespaces unchanged |
| Fetch/divergence before commit | Exit 0; HEAD and origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

Commands:

```text
node --import tsx --test tests/recurring-bill-catalogs.test.ts tests/recurring-bill-ui-money.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/recurring-bill-ui-money.test.ts tests/integration/recurring-payables.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint app/(dashboard)/purchases/bills/recurring/page.tsx i18n/recurring-bill-presentation.ts tests/recurring-bill-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

PostgreSQL 18 ran on loopback port 55450 using a newly initialized temporary
trust-auth test cluster and explicit TEST_DATABASE_URL. Fixtures created,
migrated and dropped random databases; the test server shut down cleanly. No
application database, .env credential, external provider or deployment was used.
General full-suite coverage includes existing Stripe tests; no dedicated Stripe
work occurred. Inventory changes are mechanical scan/hash/occurrence updates for
the recurring page, new helper/test and paired catalogs; column policies and
classifications remain unchanged.

Initial focused checks caught CJS/ESM component identity in the new renderer:
CurrencySelect did not share the provider context, and SelectItem identities
did not match the inspected tree. The helper now supplies the actual statically
imported components, retaining real rendering. The date-order test also exposed
that the existing validator wraps its custom message in ZodError; the finite
presentation mapping now matches that reviewed issue. A one-off shell diagnostic
had quoting errors and produced no runtime evidence. Final focused/full/static
checks pass; no validation or monetary contract was relaxed.

## Review and handoff

See [honest self-review](LOC-050-review-1.md). These are controlled rendering and
production callback tests, not mounted browser interaction or layout acceptance.
Native Persian financial terminology, complete RTL/font/layout, hosted CI,
deployment and production IRR qualification remain independent.

Finish controller checks/submit/self-review/done, commit only task-owned
source/catalog/test/planning/evidence/inventory files, push origin/master,
verify remote SHA and clean tree, report the live next task and stop. LOC-026
remains queued for independent combined purchasing acceptance after its children.
