# Chart-of-accounts catalog extraction

## Owner-requested account names and rial follow-up, 2026-10-24

The current account list, detail header, locked settings name and shared picker
also use `AccountNames` (101 paired generic-template names). Recognition requires
an unchanged built-in name, type and subtype; custom names, renamed defaults and
other country templates retain their saved names. Search accepts both saved and
translated names; name sorting uses the display name. Account codes, IDs and
saved names are unchanged. `IRR` displays as `ریال` on the list and in settings.

New custom accounts default to the organization base currency in AccountDrawer,
REST and MCP. The drawer waits for the scoped organization response and cancels
stale reads. Explicit foreign currencies remain supported. `list_accounts` can
receive `locale` (`en-US` or `fa-IR`) to add `displayName`; omitting it retains the
original response shape. No currency conversion or amount rescaling occurs.

The owner-authorized local test organization had 101 stale USD defaults despite
an IRR base and no journal history. A guarded, audited maintenance transaction
repaired those defaults in place. This does not migrate other organizations or
enable production IRR. See [follow-up evidence](../evidence/ACCOUNTS-PERSIAN-IRR-2026-10-24.md).

The remainder of this document records the original LOC-021 extraction.

LOC-021 is the first bounded child of LOC-007. It adds 173 paired keys in
`Accounts` and `AccountErrors` (2,334 keys per locale in total).

## Authored presentation covered

- `app/(dashboard)/accounting/layout.tsx`: all ten navigation labels and five
  explanatory titles. The existing shared loader supplies translated loading copy.
- `accounting/accounts/page.tsx`: title, empty-state examples, type labels,
  account/active counts, search/sort/filter controls, built-in/inactive badges,
  empty and request-error states.
- `accounting/accounts/[id]/layout.tsx`: identity badges, ledger/account currency
  provenance, statistics, navigation, missing/invalid-data/request errors.
- `accounting/accounts/[id]/page.tsx`: ledger headings, entry counts, debit/credit
  tooltips, filters/sorts/dates, empty/loading/pagination and request-error states.
- `accounting/accounts/[id]/settings/page.tsx`: form sections/labels/help,
  built-in rich notice, active states, save/delete/status notifications and
  confirmations, including cancel and approved domain-error messages.
- `components/dashboard/account-picker.tsx`: default placeholder/search, empty
  and request errors, ordered type-group labels and manage-accounts action.
- `AccountDrawer` in `components/dashboard/create-drawer.tsx`: title, description,
  form labels/placeholders/options, optional section, create/saving/cancel and
  result notifications. Shared footer label overrides apply only to this drawer;
  other drawers retain their existing defaults for their owning extraction tasks.

## Explicit exceptions and contracts

Persisted account codes, names (including built-in names), descriptions and free
text subtypes remain caller data; no record is renamed. Known enum type labels
translate for display, while unknown future types retain their code. Code samples
such as `1000`, currency codes and ledger dates/numbers remain canonical. Sample
account names in the empty-state explanation are presentation and are translated.
Punctuation (`#`, separators and empty-value dashes), developer invariant errors,
CSS/icons, URLs, sort/filter codes, form names, event names and organization-header
keys remain unchanged. Money/date/numeral adapters and bidi/layout are separate
qualification work; no amount is rescaled or reformatted by this extraction.

REST and MCP endpoints, schema, authorization and exact-money adapters are
unchanged. Existing account list/get/create/update/delete tools remain the MCP
operations; extraction introduces no operation needing a new tool. The client
maps only existing approved server strings and auth/validation statuses, with
translated operation fallbacks for unknown/network/JSON/HTML failures. Server
prose never becomes arbitrary product copy. Failed destructive confirmations
reject so the existing confirmation hook keeps them open; failed account-list
reads show an alert instead of a successful empty state.

Stripe files/functionality are preserved under DEC-008. The shared drawer diff
is limited to AccountDrawer imports/content and optional footer label overrides.

## Verification and remaining acceptance

`tests/account-catalogs.test.ts` renders production page/drawer/picker templates
with real React/next-intl and controlled state/navigation/network boundaries.
Only the drawer/picker portals render inline for inspection. Assertions cover
saved values and escaping, system field locks, type/currency/subtype filters,
ledger money and canonical dates, counts, payloads, failures and confirmation
semantics. Callback tests execute actual source functions, not copied handlers.
These do not constitute live browser interaction or live REST/MCP/DB acceptance.

Persian wording is provisional pending native financial/linguistic review. LOC-007
and LOC-002 retain independent integration acceptance; LOC-022 through LOC-028
cover the remaining accounting/sales/purchasing/contact/tax UI. Complete Persian
workflows, RTL, statutory compliance and IRR enablement are not established here.

See [evidence](../evidence/LOC-021-attempt-1.md) and
[self-review](../evidence/LOC-021-review-1.md) for actual final results and limits.
