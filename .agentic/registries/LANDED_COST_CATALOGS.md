# Landed cost catalogs - LOC-055

Bounded child of LOC-026. LOC-026/007/002 retain independent integration
acceptance. Persian financial wording is provisional pending native review and
complete RTL qualification. Stripe remains unchanged under DEC-008.

## Owned sources

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/landed-costs/page.tsx` | Document title, list/empty/loading/read states, columns, statuses/methods, allocation/delete actions, inline creation fields, component controls, validation and feedback |
| `app/(dashboard)/purchases/landed-costs/[id]/page.tsx` | Document title, loading/read/not-found states, back link, summary/reference captions, components/results tables, allocation action and feedback |
| `i18n/landed-cost-presentation.ts` | Typed own-property status and method mappings |

62 paired LandedCosts messages; 5,776 compatible keys per locale. Every new
Persian leaf contains Persian script. Existing catalog namespaces are unchanged.
Shared UI primitives retain their current catalogs and separate acceptance.

## Behavior and money boundaries

All URLs, headers, methods, IDs and nullable request fields remain unchanged.
Creation retains its `by_value` default, the `by_quantity` alternative, one blank
component, exact two-decimal ASCII input, and canonical component `amountMinor`
strings from the existing catalogPriceMinor helper. No currency field/default was
added. Currency defaults remain in the existing service. Allocation and deletion
remain bodyless requests. Components can be added/edited/removed, with at least
one row retained. Creation only closes/resets after a saved identity is returned.

HTTP/network/JSON/envelope failures use operation-specific reviewed fallbacks;
server and parser prose is never displayed. Read failures keep loaded state,
show a translated error and restore loading. Read callbacks store a boolean error
and do not refetch due to translator changes. Allocation success requires the
requested saved identity and allocated status; deletion requires success=true.
Creation guards the current saving state and restores it after parser/request
failures. These checks do not implement a general runtime row schema.

Existing saved minor-unit amounts still use bigint conversion and currency-aware
toMajorDecimal. Raw allocation bases and truncated reference IDs are unchanged.
No unit rescaling, precision policy, ledger, REST/MCP, service, schema, migration,
FX, worker, IRR flag or Stripe change is included.

Existing list/get/create/update/delete/allocate MCP tools already cover the
operations using org-scoped direct DB services and wrapTool. This extraction adds
no operation and requires no REST or MCP contract change.

## Explicit exceptions and independent scope

- Names, descriptions, source document numbers, account/line/component IDs,
  currency codes and unknown status/method codes remain escaped caller data.
  Unknown codes, including prototype-like names, cannot select catalog keys.
- Technical routes, JSON fields, headers, method/status values, CSS, punctuation,
  numeric input step/min/sample `0.00`, and empty defaults are retained.
- Dates keep the existing browser presentation; full numeral/calendar adoption
  and complete RTL conversion are separate tasks. No new amount preview existed
  in this creation form; saved detail/list amounts remain unchanged.
- Shared purchasing navigation/forms remain LOC-056. LOC-026/007/002, native
  financial terminology, full RTL/browser qualification and production IRR
  enablement retain independent acceptance.

## Verification scope

The focused test executes original callbacks extracted from production source
with controlled state/request/toast dependencies. Production components render
through real next-intl and PresentationProvider; navigation/hooks are controlled,
Sheet/Select portals inline so fields/options can be inspected. This is not a
mounted browser, focus, font or complete RTL test. Existing migrated PostgreSQL
workers separately validate real REST/registered MCP/SQL landed cost contracts,
exact allocation conservation, FIFO valuation, permissions and atomic failures.
