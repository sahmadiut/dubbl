# LOC-052 attempt 1 - Supplier debit note catalogs

2026-10-19 (Asia/Tehran), Codex/coding-assistant. Selected by the live controller
with a clean master working tree. One bounded purchasing child was implemented;
LOC-026/007/002 retain independent integration acceptance.

## Implementation and scope

Extracted the debit-note list/detail routes, currency-grouped overview, saved
money details and only DebitNoteDrawer in the shared creation module. Added 105
paired DebitNotes messages and a typed finite status mapping. Labels, filters,
empty guidance, count plurals, confirmations, local amount validation, request
failures, success feedback and the drawer's cancel/creating overrides now use
catalogs. The catalog total is 5,508 compatible keys per locale.

Read failures store message keys so existing errors follow the current locale
without translation-dependent refetches. Unknown statuses remain escaped caller
data. HTTP/network/JSON/parser errors use reviewed operation-specific fallbacks.
Creation rejects missing/empty saved identity before success/close/navigation;
the existing saving flag now guards reentry. Cancel HTTP/network failures now
receive translated feedback. Application error feedback suppresses unmounted
outcomes. Success routing, refresh and confirmation choices remain unchanged.

The [scope and exception inventory](../registries/DEBIT_NOTE_CATALOGS.md) records
all owned sources, demonstration/user/technical exceptions, existing MCP coverage
and independent handoffs. Exact helpers, currency scales, safe numeric aliases,
canonical Minor strings, bigint currency-isolated sums, purchase tax/account
context, 18-place price entry, extended-price rounding, saved quantity hundredths,
USD default and same-supplier/currency recognized-bill application remain intact.
No REST/MCP/service/schema/migration/FX/worker/IRR flag or Stripe file was changed.

## Executed verification

All commands ran from D:/Projects/dubbl using installed dependencies.

| Gate | Result |
|---|---|
| `node --import tsx --test tests/debit-note-catalogs.test.ts` | 11/11 passed |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 921/921 passed; no skips |
| Disposable migrated PostgreSQL suites below | 2/2 passed |
| `pnpm typecheck` | Passed |
| `pnpm i18n:check` | Passed; 5,508 compatible keys per locale |
| Changed-file ESLint: five TSX sources, presentation helper and focused test | Passed; zero errors/warnings |
| `pnpm lint` | Passed; zero errors, 69 existing warnings |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned consumer paths/hashes/occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed; 417 columns, 1,693 consumers |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| `python .agentic/agent.py validate` | Passed; 292 structurally valid tasks |
| `git diff --check` | Passed |

Integration command with explicit loopback TEST_DATABASE_URL:

```text
node --import tsx --test --test-concurrency=1 tests/integration/debit-notes.test.ts tests/integration/debit-note-ui-money.test.ts
```

PostgreSQL 18 ran on loopback port 55452 in a newly initialized temporary
trust-auth cluster. Fixtures created/migrated/dropped randomized databases; both
real REST/registered MCP/SQL workers passed. The server shut down cleanly.
No application database, .env credentials, external provider, full build, dev
server or deployment was used. General unit coverage includes existing Stripe
tests; no dedicated Stripe work was performed.

Production functions render through real React/next-intl/PresentationProvider,
money overview/details, table, date and amount controls. Hooks/router and
portal/select/picker/editor boundaries are controlled. Eleven tests cover both
locales, empty/filter/detail/drawer states, status fallbacks, escaped caller data,
plurals, selected option IDs, exact values/payloads, saved quantity units,
recognized bill eligibility, canonical requests, aborted/stale/generation reads,
malformed aliases/envelopes, failed-form retention, confirmations, unmounted
outcomes, source JSX inventory and Persian-script assertions.

The initial focused/source-audit run caught an unextracted list CTA and stale
copied test keys; these were corrected. Final focused/static checks pass without
relaxing financial assertions or validation. Direct JSON comparisons confirmed
all pre-existing catalog namespaces unchanged. Source comparisons confirmed all
sibling drawer code unchanged. Inventory comparison confirmed all 417 schema
column policies/classifications unchanged; only owned consumer metadata changed.

## Review and independent handoff

See [honest self-review](LOC-052-review-1.md). These controlled rendering/callback
checks are not mounted browser, layout or native financial terminology approval.
Persian remains provisional. LOC-026/007/002, native terminology, complete
RTL/font/browser review, hosted CI, deployment and production IRR qualification
remain independent. ContactPicker internals remain LOC-058; shared purchasing
navigation/forms remain LOC-056. Stripe stays unchanged under DEC-008.

Finish controller acceptance/submit/self-review/done and the authorized scoped
commit/push. Verify origin/master SHA and clean tree,
report the live next task and stop.
