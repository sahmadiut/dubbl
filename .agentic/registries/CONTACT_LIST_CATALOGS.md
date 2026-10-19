# Contact list, picker and creation catalogs

LOC-058 owns the complete `app/(dashboard)/contacts/page.tsx`,
`components/dashboard/contact-picker.tsx` and only `ContactDrawer` in
`components/dashboard/create-drawer.tsx`. The paired `Contacts` namespace adds
86 messages, bringing each catalog to 5,874 keys. Persian wording remains
provisional pending native terminology review.

Covered copy includes the document title, table columns, type badges, terms,
tax hints, action menu, empty guidance/cards, filters, sorting, date placeholders,
duplicate-report link, loading label, ICU counts, delete confirmation/outcomes,
picker search/selection/creation, creation fields/footer and operation failures.
The actual merge interface is outside this slice; the list links to the existing
duplicate-detection report without implementing or changing merge behavior.

## Explicit exceptions and preserved contracts

Names, email, phone, notes, tax numbers and caller-supplied picker placeholders
remain caller data and React-escaped. `1099` is a US form identifier; `-` and
`·` remain structural symbols. `email@example.com` and `+1 (555) 000-0000` are
technical input examples, retained without implying regional validation.

Canonical `customer`/`supplier`/`both`, `all`, sort keys/directions, date strings,
DOM IDs, form names, request paths/methods, `activeOrgId`, organization headers,
and response shapes remain unchanged. Picker selection still toggles the same ID
to an empty string and closes; the creation button opens the existing drawer.
An omitted picker placeholder uses the locale default; explicit empty/custom
placeholders retain their meaning. Unknown type values never become catalog keys.

Counts describe loaded rows and use ICU complete messages. Existing money
adapters, bigint balances/credit limit, agreeing `*Minor` aliases, currency codes,
USD display fallback and date formatting remain unchanged. No sum across
currencies, unit rescaling, FX change, IRR enablement, schema or migration change.
Number/date adapters and complete RTL remain separate work.

Creation retains its existing POST fields/nulls and payment-term fallback:
`parseInt(...) || 30`, including the pre-existing zero-to-30 behavior. The form's
default remains 30 and type remains `customer`. This catalog task does not alter
that business rule. Missing organization no longer leaves the creation busy flag
set. Creation success requires a string contact ID; HTTP/JSON/envelope/network
failure stays in the form with a localized message rather than raw server prose.

Delete now checks HTTP success before removing the row/decrementing the count;
failure is translated and rejects the confirmation callback so the dialog stays
available for retry. Both confirmation buttons have explicit localized labels.
Picker reads check HTTP success/list envelope, translate failures, reset the
fetch cache on failure, and allow retry on reopening. Loading begins in the open
event handler. Page/list reads retain existing exact-money validation and reset
semantics while translating their failures.

## REST/MCP ownership and handoff

Existing `list_contacts`, `get_contact`, `create_contact`, `delete_contact` and
`merge_contacts` use org-scoped direct DB access through `wrapTool`. No REST/MCP
handler, schema, permission, route or tool registration changes. Existing MCP
list limits (max 100), absence of balance aggregates and absence of the UI's
sort/date filters remain pre-existing differences; the picker retains its REST
limit of 200. This task claims presentation extraction, not new parity work.

LOC-059 owns the detail shell/overview and LOC-060 the financial tabs.
LOC-027/007/002 retain independent integration acceptance. Native Persian,
complete RTL, browser layout, hosted CI, deployment and production acceptance
remain separate. Stripe source and existing catalog namespaces are unchanged
under DEC-008.

## Verification design

`tests/contact-list-catalogs.test.ts` renders actual production templates with
real React, next-intl, `PresentationProvider`, table and ordinary fields. Hooks,
navigation and portal boundaries are controlled; these are not mounted browser
tests. It checks both locales, empty/populated/filter/busy states, canonical
options/defaults, escaped mixed-script caller data and exact money through
9007199254740991 minor units. Actual handler bodies run with controlled IO to
assert paths, headers, filter/pagination parameters, selection, optional nulls,
creation fallback/navigation, cancellation, retry cleanup and translated
HTTP/JSON/envelope/network/alias failures. A source audit covers all owned JSX
and display attributes with the explicit technical exceptions above, plus
Persian-script and ICU 0/1/2 assertions.
