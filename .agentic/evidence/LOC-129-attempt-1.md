# LOC-129 verification - shared currency unit names

Date: 2026-10-24. Owner: codex-task-002. Entry commit:
cb6a84cccd6da915555b6b4a32bba3bb00898fed, clean master.

## Scope and controller split

Live validate/status/next selected LOC-115. Source inspection found money-display
helper consumers across 132 website/component files. The controller-supported
split creates LOC-129 shared foundation, LOC-130 sales/purchases/banking/
accounting/contacts/editors, LOC-131 inventory/projects/CRM/budgets/payroll and
LOC-132 reports/tax/settings/onboarding/dashboard/public/remainder. LOC-115
retains independent whole-site integration acceptance and every original
acceptance checkbox. Only LOC-129 is completed in this commit.

## Implementation and actual checks

See [scope and contract registry](../registries/CURRENCY_UNIT_PRESENTATION.md).
The static catalog covers supported exact-money and picker codes. Persian IRR
is the owner's literal **ریال**; other terminology remains provisional. Unknown
codes return the escaped original code, own-property lookup excludes prototype
keys, and English reference names remain unchanged. Numerals/calendar/currency
selection do not select language names.

Actual shared picker templates run through real PresentationProvider/next-intl
in four language/numeral combinations and full/compact modes. Inline portal and
command wrappers expose authored search terms and callbacks. Assertions verify
Persian/ISO/reference search terms, accessible names, literal IRR, disabled-code
guards, canonical callback codes, unchanged reference rows and escaped caller
data. This does not claim mounted command filtering or focus behavior.

Actual input and DualAmount SSR verify canonical hidden fields, prefixes,
missing-rate units and bidi isolation. Existing actual input callback tests
still assert canonical ASCII and invalid-edit rejection. Exact unit replacement
uses Intl part types and does not parse or rescale money. New tests cover zero,
negative subunits, signed int64 limits and IRR/USD/JPY/KWD scales with both digit
preferences; existing English output assertions remain unchanged.

No new operation or route, schema or financial arithmetic changed. Existing
REST/MCP/storage/export values and services stay canonical; no database was
used. No Stripe source, reference row, issued snapshot, email or PDF code changed.

## Commands and outcomes

All commands ran in D:/Projects/dubbl with installed dependencies:

- `node --import tsx --test --test-concurrency=1 tests/currency-labels.test.ts tests/localized-number-presentation.test.ts tests/currency-workspace-catalogs.test.ts tests/bank-ui-money.test.ts tests/invoice-ui-components.test.ts tests/bill-ui-components.test.ts tests/journal-ui-components.test.ts`: exit 0, 29/29 tests passed.
- Initial new-label/number run: 8/10 passed, two failures. One exposed missing
  Persian labels in installed ICU (SVC and four other entries); explicit
  provisional static names were supplied. The other was the capture harness's
  separate CJS next-intl identity; it now shares the real ESM provider module.
  Both failures are covered by the final passing command above.
- `pnpm exec eslint i18n/currency-labels.ts i18n/currency-names.ts i18n/use-currency.ts i18n/numbers.ts components/ui/currency-input.tsx components/ui/currency-select.tsx components/ui/dual-amount.tsx tests/currency-labels.test.ts`: exit 0, no warnings.
- `pnpm typecheck`: exit 0, including MDX generation and tsc --noEmit.
- `pnpm lint`: exit 0, zero errors and 20 existing warnings outside owned files.
- `pnpm i18n:check`: exit 0, 10,702 paired message keys. No message key changed;
  currency names use their explicit static presentation catalog.
- `python .agentic/scripts/money_inventory.py --write` followed by
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0,
  417 existing column classifications unchanged; 2,477 files scanned,
  1,858 consumer hashes, 36,742 occurrences.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, nine regressions pass.
- `python .agentic/agent.py validate`: exit 0, 364 structurally valid tasks.
- `git diff --check`: exit 0 before final controller closure.

## Limits and handoff

No full build, dev server, full unit suite, mounted browser, hosted CI, native
language/RTL/layout acceptance, financial production qualification or IRR
activation is claimed. Existing default-English domain helper callers and raw
page unit labels remain assigned to LOC-130/131/132, with independent LOC-115
acceptance afterward. Test scope is shared controls and representative existing
currency workspace/financial controls. L10N-001/L10N-012 and RTL-001 remain open
to independent terminology and visual qualification.

This task creates one scoped local commit. The parent supervisor handles the
authorized two-task push; this sub-agent does not push.
