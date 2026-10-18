# Bank transaction workspace catalogs

LOC-030 adds the 303-message `BankWorkspace` namespace in English and provisional
Persian, bringing both catalogs to 3,336 compatible keys. Existing namespaces
are unchanged. LOC-023/007/002 retain independent integration acceptance.

## Authored presentation covered

- `app/(dashboard)/accounting/banking/[id]/(detail)/layout.tsx`: account-not-found
  state, return link, shared account type labels (reusing `BankAccounts`), bank
  header, statement/import actions and tooltips, balance/inflow/outflow/done
  summaries, navigation tabs, transaction action notifications and the import
  callbacks housed in this layout. URLs and tab values remain canonical.
- The detail overview: document title, to-do/done/ignored summary, recent
  transaction/import headings and empty-state explanation/import action.
- The transactions page: document title, list/bulk toggle, status tabs/tooltips,
  search/date/sort/filter controls, selection/batch actions, empty states and ICU
  result/success/partial-result counts. Failed HTTP bulk-ignore requests now
  produce the translated failure without clearing selection or claiming success.
- `_components.tsx`: `BankMatchPreview`, `TransactionRow` (all five derived
  states, tooltips, confirmations and structured clearing guidance), bill and
  invoice match sheets, expense creation, categorization and all quick choices,
  unified existing-record/document matching, transfer and split sheets, and the
  bulk cash-coding grid. Includes placeholders, accessible amount/selection
  labels, saving/linking/recording states, validation, tax recoverability,
  statement/document/allocation previews and matcher explanation presentation.
- `i18n/bank-workspace-presentation.ts`: finite typed matcher-reason and local
  money-validation mappings. Known request failures reuse `BankAccountErrors`;
  unknown server/network/parser failures use translated operation fallbacks.
  Unknown match explanations use a translated generic explanation. REST/MCP
  reasons and error payloads remain machine-facing English contracts.

## Explicit exceptions and contracts

User-authored descriptions, references, payees, bank/account/contact/tax names,
account numbers and ledger codes remain caller data, escaped by React. The
existing `Director's loan` memo default remains saved data in both locales;
localized quick-choice labels do not change the memo or account resolution.
Technical currency/country/type/status/match codes, IDs, headers, field names,
HTTP methods, routes/query parameters, CSS classes/colors, masks, punctuation,
arrows, signs, percentage notation and tax-name/rate composition remain unchanged.
The context-provider invariant is developer-facing. Date, numeral and financial
formatting use existing adapters; this task does not change their policy.

`ImportRow`, `ImportSheet`, `FORMAT_LABELS`, `ReconciliationReport` and
`RecLineList` remain owned by LOC-031/032; the import/reconciliation routes and
scheduled-payment/batch/transfer-drawer routes remain outside this slice.
LOC-031 can reuse this namespace's import callback messages; its full import
presentation remains independently open. The exported derived-state metadata is
now a translator-accepting function; the state derivation itself is unchanged.

No schema, migration, financial-service, REST or MCP file changed. Existing
bank-transaction reconciliation/exclusion/unreconciliation, categorization,
bill/invoice/existing-record matching, expense creation, split-account,
match-transfer, bulk categorization and account/import reads remain backed by
their current REST/MCP tools and org-scoped services. No new user operation was
added. Bigint amount/summary/tax/split calculations and canonical Minor strings,
full-statement payment policy, currency constraints, tracking fields and
null/omission behavior remain intact. Stripe is preserved under DEC-008.

## Verification boundary

`tests/bank-workspace-catalogs.test.ts` renders real production templates through
React, next-intl and PresentationProvider. State/navigation are controlled;
sheet/dialog portals and select options render inline for inspection. Unowned
account/contact/tracking/attachment widgets are narrow test boundaries. Tests
execute actual production callback syntax with network/state boundaries for all
matching variants, expense, categorize, transfer, split, grid fill-down/save and
batch actions, including exact low digits, KWD scale, rejected amounts, unknown
prose, HTML/network/HTTP failures, canonical writes and partial-result counts.
An AST audit rejects authored JSX text and visible literal attributes in the
owned scope. These are rendering/callback tests, not browser event automation.

Persian terminology is provisional pending native review. Full RTL/font/layout,
browser interaction, hosted CI, providers, deployment and production IRR gates
remain independent. The optional existing REST/MCP/SQL regression attempt could
not create its random disposable database because the local role lacks CREATEDB;
it is not recorded as passed. No application data was modified. See
[evidence](../evidence/LOC-030-attempt-1.md) and
[honest self-review](../evidence/LOC-030-review-1.md).
