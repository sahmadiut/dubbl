# Bank-account catalog extraction

LOC-029 adds 100 paired messages: `BankAccounts` (89) and `BankAccountErrors`
(11), bringing each catalog to 2,703 keys. Existing namespaces are unchanged.
LOC-023/007/002 retain independent integration acceptance.

## Authored presentation covered

- `app/(dashboard)/accounting/banking/page.tsx`: document title, account-type and
  group labels, three onboarding steps, empty-state explanation/action, totals,
  positive/negative balances, ICU active/currency counts, visibility toggle,
  transfer/new-account actions, tooltips, inactive badge and menu labels.
- `app/(dashboard)/accounting/banking/[id]/(detail)/settings/page.tsx`: document
  title, general/region/books/color/danger sections, labels, placeholders,
  explanations, account-type choices, accessible color labels, save and delete
  actions/confirmation and localized success/failure messages.
- Only `BankAccountDrawer` in `components/dashboard/create-drawer.tsx`: title,
  description, labels, examples, account types, optional ledger link explanation,
  accessible colors, translated validation, saving/cancel/create footer and
  success/failure notifications. Other drawer/provider/helper functions remain
  unchanged after LF normalization.
- `i18n/bank-account-presentation.ts`: finite typed display mappings and approved
  fixed bank-service error translations. Unknown future types remain codes with
  own-property guards. Authorization, invalid input and incompatible saved-money
  errors translate; unknown server/network/parser prose uses the operation's
  translated fallback. The successful response body is left unread for callers.

## Explicit exceptions and preserved contracts

Account names, bank names, account numbers/IBANs, saved ledger names, IDs and other
caller data remain untouched and escaped by React. Account-type/currency/country
codes, hidden form values, chart-account IDs/type filters, URLs, organization
headers, HTTP methods, JSON field names/null/omission behavior, event names,
navigation destinations, colors and masks are machine/data contracts. `US`,
currency codes, step numbers, zero samples, punctuation/dashes and masks remain
technical/sample exceptions. English placeholders retain their text; Persian
examples are presentation only and do not change saved/input machine values.

Existing bigint bank adapters, canonical Minor aliases, per-currency grouping,
percentage helpers and financial formatters remain unchanged. Money/date/numeral
formatting and production IRR enablement are outside this catalog extraction.
Malformed saved aliases continue to fail closed; settings validate the response
before scheduling a React state update or announcing success. Creation validates
the returned navigation identifier before closing/announcing success. The internal
missing-identifier invariant uses the translated create-operation fallback.
No schema, migration, service,
REST or MCP change was needed. Existing bank-account list/get/create/update/delete
MCP operations remain the corresponding operations; no new operation was added.

Failed account deletion now rejects its confirmation callback after a localized
notification, preserving the existing confirmation hook's stay-open semantics.
Failed saves/creates do not report success, close, refresh or navigate. Missing
organization scope returns before entering the create saving state. Account
reload clears a previous localized read failure only after valid data loads.

## Split ownership and remaining acceptance

The enclosing LOC-023 had 11 banking TSX files totaling 7,019 lines plus banking
drawers. LOC-030 owns detail layout/overview/transactions and non-import shared
sheets; LOC-031 owns imports and import-specific shared UI; LOC-032 owns the
reconciliation page; LOC-033 owns scheduled payments/batches and BankTransferDrawer.
Inventory's TransferDrawer is excluded. `_components.tsx` and other banking
routes remain unchanged by LOC-029. Existing raw labels in those routes belong
to the remaining children, then independent LOC-023 acceptance.

`tests/bank-account-catalogs.test.ts` renders production templates through actual
React/next-intl/PresentationProvider with controlled state/navigation/network
boundaries. Sheet portals render inline for inspection. Tests execute actual
production callback syntax for list/create/update/delete, including negative
responses, unknown/HTML/JSON/network failures, exact low digits, per-currency
groups, nullable/optional payload fields, org headers, events, destinations,
saving flags and confirmation rejection. These are component/callback checks,
not live REST/MCP/database or browser workflow qualification.

Persian financial wording remains provisional pending native terminology review.
Native, full RTL/font/layout, browser interaction, hosted CI and production IRR
acceptance remain independent. Stripe files/functionality are preserved under
DEC-008. See [evidence](../evidence/LOC-029-attempt-1.md) and
[honest self-review](../evidence/LOC-029-review-1.md).
