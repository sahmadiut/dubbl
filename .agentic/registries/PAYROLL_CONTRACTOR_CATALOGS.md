# Payroll contractor catalogs - LOC-082

74 paired `PayrollContractors` messages; 7,266 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance; native terminology, complete RTL, numeral/calendar and release
qualification remain separate.

## Owned presentation

| Source | Coverage |
|---|---|
| `app/(dashboard)/payroll/contractors/page.tsx` | Document title, empty/help/action copy, counts, status tabs/badges, search and clear name, all sort options, filtered absence, hourly suffix, ICU singular/plural count and finite read/organization feedback |
| `app/(dashboard)/payroll/contractors/[id]/page.tsx` | Document title, back/not-found, profile/payment sections and fields, save/busy/delete actions, payment status labels, process/delete confirmation and success/failure feedback |
| `components/dashboard/create-drawer.tsx`, `ContractorDrawer` only | Title/help/section, field labels, human name/company examples, create/busy action and required/organization/create feedback |

`payrollContractorJson` delegates exact-money/ISO checks to `payrollJson`, then
checks HTTP success, JSON/envelopes, displayed fields, booleans, finite payment
statuses, required cents aliases and pagination. Creation permits an ID-only
response because it is used only for navigation; supplied money is still checked.
PATCH responses do not require payments, which the actual service omits.
Untrusted server/parser/network/storage prose never enters visible feedback.

Initial reads handle absent organization/storage failure and finish loading.
An initial detail 404 becomes the localized not-found state. Effect cleanup
suppresses late responses; list load-more requests share their originating
filter's active token. Failed creates/saves retain fields and release saving;
failed payments retain input; failed processing/deletion never claim success
or navigate. Verified payment mutations remain successful if their follow-up
read fails; that read shows a separate localized error and retains the page.
Payment refreshes preserve unsaved profile/payment currency inputs.

## Explicit exceptions and unchanged contracts

- Caller names, company, email, tax/account identifiers, invoice number,
  descriptions, IDs and currency codes are escaped data. Human name/company
  placeholders are translated. Technical examples `jane@example.com`, `150.00`,
  fallback `-`, layout numerals and required `*` remain intentional exceptions.
- `BrandLoader` uses existing `SharedUI` loading copy; `DrawerFooter` cancellation
  uses `DocumentForms`. The drawer supplies the existing `creatingLabel`
  override. CurrencySelect/CurrencyInput shared ownership remains unchanged.
- Machine statuses `pending`/`paid`/`void`, list `all`/`active`/`inactive`, drawer
  type `contractor` and sort values `created:desc`, `created:asc`, `name:asc`,
  `name:desc`, `rate:desc`, `rate:asc` remain canonical. Only labels change.
- Existing name/company/email case-insensitive search, client sorting, loaded
  active/inactive counts, server total, page/limit and infinite scroll remain.
  A zero hourly rate now renders its formatted zero rather than React's bare
  numeric `0`; no stored value changes. Null rates remain absent.
- Payroll retains fixed-two cents for USD/JPY/KWD/IRR, `payrollCentsInput`,
  `payrollCentsDecimal`, `payrollMoneyDisplay`, safe integer numeric aliases and
  canonical `hourlyRateMinor`/`amountMinor` strings. No currency rescaling or
  financial calculation change. Nullable historical currency still falls back
  to USD. Gregorian dates and UTC instants remain transport data.
- `activeOrgId`, REST URLs/methods, organization/content-type headers, exact
  money payloads, optional null/omitted fields and navigation remain unchanged.
  Existing org-scoped `list_contractors`, `get_contractor`, `create_contractor`,
  `update_contractor`, `delete_contractor`, `create_contractor_payment` and
  `process_contractor_payment` already cover this UI through shared services.
  No new operation, REST/MCP change, schema/migration, statutory identifier,
  FX/IRR flag, provider or Stripe change.

## Verification and handoff

The focused suite renders production JSX with next-intl/PresentationProvider
and real money inputs, footer and controls; hooks/IO and portal/currency-picker
boundaries are controlled. It covers bilingual states, escaping, plural count,
all sort/status labels and values, search/navigation, zero/29/max-safe cents,
null currency, malformed response rejection, read cleanup, infinite scroll,
canonical mutation payloads, failed field retention, confirmation cancellation,
storage errors, refresh failures, source-copy exceptions and Persian script.
The payroll source guard checks both contractor pages and the drawer's reader.

Migrated payroll master/payment workers apply the checked reader to real REST
and registered linked MCP responses, with an explicit adapter for MCP list
pagination. Their existing SQL, authorization, tenant isolation, audit, ledger
balance, migration and rollback checks remain intact.

See [attempt evidence](../evidence/LOC-082-attempt-1.md) and
[Codex self-review](../evidence/LOC-082-review-1.md) for actual results.
This child does not qualify mounted browser/keyboard behavior, full RTL,
native financial terminology, outputs, hosted CI, deployment or production.
