# Shared sales navigation and document form catalogs

LOC-047 adds 49 paired messages in `SalesNavigation` and `DocumentForms`, reaching
5,002 compatible keys per locale. Persian terminology is provisional; native
linguistic and RTL qualification remain independent.

## Ownership

- `app/(dashboard)/sales/layout.tsx`: eight tab labels and three explanatory
  titles. Routes, icons, exact matching and detail-page navigation remain intact.
- `app/(dashboard)/sales/loading.tsx`: inspected and rendered unchanged; its
  `BrandLoader` already uses `SharedUI.loading2`.
- `components/dashboard/line-items-editor.tsx`: column headings, descriptions,
  account/tax placeholders, add/remove actions, accessible line quantity/price
  labels, totals, purchase reclaim hints and recurring-bill fixed-scale guidance.
  All five existing document calculators remain unchanged. The remove control
  now has a translated accessible name.
- `components/dashboard/invoice-amount-input.tsx`: default accessible amount and
  invalid-amount messages. Caller-provided label, error and placeholder overrides
  remain supported; validity, decimal precision and callbacks remain intact.
- `DrawerFooter` in `components/dashboard/create-drawer.tsx`: default cancel and
  saving labels. Overrides remain supported across all existing callers. This is
  shared default ownership, including purchasing and other drawers; no individual
  drawer implementation changed. `SectionLabel` has no authored text: its children
  belong to each drawer's task, so its implementation remains unchanged.
- `i18n/document-form-presentation.ts`: finite reviewed preview-error mapping and
  a translated generic fallback for unreviewed parser/calculator messages.

LOC-056 retains purchasing navigation and remaining purchasing-specific forms.
LOC-033 retains supplier-only `PaymentAmountPreview`. Contact/currency/account
picker internals, document sending, email history and unrelated drawer labels
retain their existing task ownership. LOC-025/007/002 still require independent
combined acceptance; completing this shared slice does not complete a parent.

## Preserved contracts and explicit exceptions

Money calculators, rounding policies, supported ranges, decimal grammar, stored
units, currency scales, FX, IRR flags, database schema, REST/MCP and authorization
are unchanged. In particular, recurring bills retain fixed-two price storage in
every currency; translation never changes those units. Existing numeric controls,
user-entered descriptions, account/tax IDs, tax names, rates, currency codes,
percent text, numeric-only placeholders, punctuation and the existing invalid-total
sentinel remain data. Their number/date/direction presentation belongs to later
adapter/RTL work. Arbitrary parser prose is replaced with the reviewed generic
error; known validation text maps to paired messages without changing validation.

The existing `create_invoice`, `create_bill`, `create_purchase_order` and
`create_recurring_template` tools cover document creation; existing document
payment/credit tools cover amount-input consumers. `list_tax_rates` supplies
organization tax rows (basis-point rates and recoverable shares). Their registered
implementations, shared services, `AuthContext` and `wrapTool` remain unchanged.
There is no new user operation or changed REST route requiring a new MCP tool.
Stripe files/functionality and all earlier catalog namespaces remain unchanged.

## Verification and limitations

`tests/shared-document-catalogs.test.ts` renders real production functions with
React, next-intl and `PresentationProvider` in English and Persian. It checks tab
routes/detail visibility, loading, exact USD/JPY/KWD amounts, all five preview
policies, tax-reclaim hints, safe interpolation, known/unknown preview failures,
line-edit/add/remove callbacks, validity, amount overrides and footer states.
State/effect and select-portal boundaries are controlled where necessary; money
calculators remain real. Existing amount-rendering tests now use the presentation
provider, and three catalog harnesses import the real amount input through the
same ESM context as their provider. Their assertions remain intact.

Existing migrated disposable PostgreSQL fixtures test invoice, bill, recurring
invoice, recurring bill and procurement REST/MCP/SQL agreement. This does not
claim mounted browser interaction, native Persian approval, complete RTL,
provider/hosted-CI/deployment or production IRR qualification. No full build,
development server or application database was used.

See [attempt evidence](../evidence/LOC-047-attempt-1.md) and
[self-review](../evidence/LOC-047-review-1.md).
