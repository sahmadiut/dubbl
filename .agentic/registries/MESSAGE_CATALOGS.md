# Message catalog foundation

LOC-005 is the validation/preference slice of LOC-002. The parent remains open
for full extraction and independent integration acceptance. Current coverage is
`LocalePreferences`, LOC-010 authentication/onboarding/invitation namespaces and
LOC-011 shared shell/UI, LOC-014 core settings, LOC-015 settings automation,
LOC-016 settings access/audit, LOC-018 billing/Stripe, LOC-019 document templates,
LOC-020 import/export, backups and trash
and LOC-013 teams/admin/notification
namespaces in `messages/en-US.json` and `messages/fa-IR.json`
(see [auth scope](AUTH_CATALOGS.md), [shell scope](SHELL_CATALOGS.md),
[settings scope](SETTINGS_CATALOGS.md), [automation scope](SETTINGS_AUTOMATION_CATALOGS.md),
[access scope](SETTINGS_ACCESS_CATALOGS.md)
and [workspace scope](WORKSPACE_CATALOGS.md), [provider scope](SETTINGS_PROVIDER_CATALOGS.md),
[document settings scope](SETTINGS_DOCUMENT_CATALOGS.md),
[data settings scope](SETTINGS_DATA_CATALOGS.md));
passing key parity does not mean that the rest of the product is localized.

LOC-017 combined provider/document/data acceptance and integration repairs are
recorded in [combined settings acceptance](SETTINGS_PROVIDER_DATA_ACCEPTANCE.md).
The wider LOC-006/002 integration and native/RTL gates remain independent.

LOC-012's independent combined settings acceptance is now recorded in
[settings catalog acceptance](SETTINGS_CATALOG_ACCEPTANCE.md), including the
owner-authorized Stripe exclusion, eight additional paired error keys and the
2,160-key catalog total. LOC-006/002 and native/RTL gates remain independent.

LOC-006's independent shell/auth/settings/workspace acceptance is recorded in
[combined catalog acceptance](SHELL_AUTH_SETTINGS_ACCEPTANCE.md). It adds the
paired sign-in request-failure message (2,161 keys per locale), composed rendering,
production callback checks and migrated REST/MCP/SQL integration. LOC-002 and
native/RTL qualification remain open. DEC-008 preserves Stripe unchanged.

## Catalog and authoring contract

- English is the compile-time key schema (`i18n/types.d.ts`). `useTranslations`
  and `getTranslations` reject unknown namespaces and keys during typecheck.
  Use literal keys or finite typed unions; do not erase key types with casts.
- Both JSON files use module namespaces. Add matching keys in both locales;
  adding further module namespaces is owned by LOC-006 through LOC-009. The
  existing request loader/provider still supplies the selected catalog only.
- `pnpm i18n:check` parses every message with the pinned FormatJS ICU parser,
  checks nonempty tree/string leaves, safe identifier keys, exact key parity,
  argument kinds/formats, rich tags, select choices, exact plural cases and
  offsets. All runtime plural categories must exist; irrelevant categories fail.
  Locale-specific plural category differences are allowed (notably ordinals).
- The parser is a development dependency, imported only by validation tooling
  and tests. No application import loads it or adds it to the client provider.
- The gate is an explicit CI test-job step, alongside the full unit suite.
  Typecheck and ESLint separately enforce typed production keys and safe API use.
  JSON files are reviewed source assets, not remotely editable content.

## Rendering and plural rules

Use ordinary `t(key, values)` for text and `t.rich(key, {...richTextTags, ...values})`
with `i18n/rich-text.tsx` for structured emphasis/code. Only `strong`, `em` and
`code` tags are approved. Catalog HTML attributes, unknown tags, comments and
ICU-quoted HTML are rejected. URLs and attributes belong in reviewed application
code; adding a new structural tag requires validator/renderer/test review.

The ESLint guard rejects raw/markup access, catalog-access imports and HTML sinks
in modules importing next-intl/use-intl. The root layout alone may import
`getMessages` for provider transport; it retains the HTML/raw restrictions. This
is a developer guard, not a sandbox against adversarial JavaScript, computed
indirection or deliberately bypassed types. Review remains required.

Tests use real next-intl/React rendering and adversarial interpolation. They
exercise cardinal 0/1/2 and fractions, ordinal branches and explicit `=0` cases.
Persian cardinal 0 and 1 select `one`, 2 selects `other`; Persian ordinals select
`other`. English cardinal zero selects `other`. Counts use runtime ICU; no
English `count === 1` branching is introduced. Money/date presentation adapters
remain separate tasks; count formatting here does not format financial amounts.

Official sources checked 2026-10-17:

- [next-intl translation and rich text APIs](https://next-intl.dev/docs/usage/translations)
- [next-intl message typing](https://next-intl.dev/docs/workflows/typescript)
- [FormatJS ICU parser](https://formatjs.github.io/docs/icu-messageformat-parser/)
- [Unicode CLDR 48 plural rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html#fa)

## Preference scope and remaining extraction

The existing preference title/description/labels/error/actions and all language,
numeral and calendar option labels now come from catalogs, including the
organization language selector. `UTC` remains a technical IANA placeholder.
Language autonyms and numeral samples intentionally remain identical across
locales. Persian calendar labels are provisional, not a native terminology approval.
Existing en-US labels, select values, request bodies, reload behavior, URLs and
organization permissions are preserved. No new user operation or REST route was
introduced; existing `get_locale_preferences`/`update_locale_preferences` and
organization tools still provide the same operations via their shared services.

Extraction ownership:

| Task | Scope |
|---|---|
| LOC-005 | Validation foundation and complete locale preference labels |
| LOC-006 | Shared shell, auth/onboarding, settings, teams, admin, notifications |
| LOC-010 | LOC-006 child: authentication/onboarding/invitations and MCP consent |
| LOC-011 | LOC-006 child: shared shell and UI primitives |
| LOC-012 | LOC-006 child: settings configuration |
| LOC-013 | LOC-006 child: teams, administration and notifications |
| LOC-014 | LOC-012 child: navigation, general, procurement, cost centers and tags |
| LOC-015 | LOC-012 child: settings automation and notification preferences |
| LOC-016 | LOC-012 child: settings access and audit |
| LOC-017 | LOC-012 child: settings providers, documents and data management |
| LOC-018 | LOC-017 child: billing and Stripe settings |
| LOC-019 | LOC-017 child: document template settings |
| LOC-020 | LOC-017 child: import/export, backups and trash |
| LOC-007 | Accounting, sales, purchasing, contacts, tax and associated shared UI/errors |
| LOC-021 | LOC-007 child: chart of accounts, account picker/drawer and accounting navigation; see [scope](ACCOUNT_CATALOGS.md) |
| LOC-022 | LOC-007 child: journals and opening balances; see [scope](JOURNAL_CATALOGS.md) |
| LOC-023 | LOC-007 child: banking; see [combined acceptance](BANKING_CATALOG_ACCEPTANCE.md) |
| LOC-029 | LOC-023 child: bank-account list, creation and settings; see [scope](BANK_ACCOUNT_CATALOGS.md) |
| LOC-030 | LOC-023 child: transaction workspace and shared matching/categorization sheets; see [scope](BANK_WORKSPACE_CATALOGS.md) |
| LOC-031 | LOC-023 child: imports and shared import presentation; see [scope](BANK_IMPORT_CATALOGS.md) |
| LOC-032 | LOC-023 child: reconciliation; see [scope](BANK_RECONCILIATION_CATALOGS.md) |
| LOC-033 | LOC-023 child: scheduled payments, batches and bank-transfer drawer; see [scope](BANK_PAYMENT_CATALOGS.md) |
| LOC-024 | LOC-007 child: assets, loans, budgets and accruals |
| LOC-034 | LOC-024 child: asset-category management; see [scope](ASSET_CATEGORY_CATALOGS.md) |
| LOC-035 | LOC-024 child: fixed-asset list/detail and creation drawer |
| LOC-036 | LOC-024 child: loan list/detail and creation drawer |
| LOC-037 | LOC-024 child: budget routes and creation drawer |
| LOC-038 | LOC-024 child: accrual list/detail and creation drawer |
| LOC-025 | LOC-007 child: sales and shared document forms |
| LOC-039 | LOC-025 child: payment list/detail; see [scope](SALES_PAYMENT_CATALOGS.md) |
| LOC-040 | LOC-025 child: invoices and payment-recording dialogs |
| LOC-041 | LOC-025 child: quotes |
| LOC-042 | LOC-025 child: cash sales/receipts |
| LOC-043 | LOC-025 child: credit notes |
| LOC-044 | LOC-025 child: customer prepayments |
| LOC-045 | LOC-025 child: recurring invoices |
| LOC-046 | LOC-025 child: revenue schedules |
| LOC-047 | LOC-025 child: sales navigation and shared document/line forms |
| LOC-026 | LOC-007 child: purchasing |
| LOC-048 | LOC-026 child: goods receipt list/detail and shared procurement line details; see [scope](GOODS_RECEIPT_CATALOGS.md) |
| LOC-049 | LOC-026 child: supplier bills |
| LOC-050 | LOC-026 child: recurring bills |
| LOC-051 | LOC-026 child: expenses and recurring expenses |
| LOC-052 | LOC-026 child: supplier debit notes |
| LOC-053 | LOC-026 child: purchase requisitions |
| LOC-054 | LOC-026 child: purchase orders and receiving forms |
| LOC-055 | LOC-026 child: landed costs |
| LOC-056 | LOC-026 child: shared purchasing navigation/forms |
| LOC-027 | LOC-007 child: contacts |
| LOC-057 | LOC-027 child: contact people/files; see [scope](CONTACT_PEOPLE_FILES_CATALOGS.md) |
| LOC-058 | LOC-027 child: contact list/picker/creation |
| LOC-059 | LOC-027 child: contact detail shell/overview |
| LOC-060 | LOC-027 child: contact financial tabs |
| LOC-028 | LOC-007 child: tax |
| LOC-061 | LOC-028 child: tax rate and navigation; see [scope](TAX_RATE_CATALOGS.md) |
| LOC-062 | LOC-028 child: currency workspace |
| LOC-063 | LOC-028 child: tax period |
| LOC-064 | LOC-028 child: VAT filing |
| LOC-065 | LOC-028 child: remaining tax filing |
| LOC-008 | Inventory, payroll, projects, CRM, reports, dashboard and documents |
| LOC-009 | Public surfaces, landing/help, email/PDF and user-visible background content; remaining source audit |
| LOC-002 | Independent combined key coverage, plural and safe rendering acceptance |

Later L10N/RTL tasks retain native-reviewed financial wording, complete Persian
workflows and layout qualification. Do not use English placeholders or parity
alone as proof of completed Persian translation.

## Verification

[Catalog tests](../../tests/message-catalogs.test.ts) cover production key parity,
negative ICU/shape/placeholder/format/tag cases, real plural and escaping behavior,
rendered preference controls, and lint rejection. Compile-time negative probes
ensure missing namespaces/keys fail typecheck. Existing
[locale tests](../../tests/locale.test.ts) cover preference precedence and provider
payload serialization. No DB/API/schema change is part of LOC-005.
