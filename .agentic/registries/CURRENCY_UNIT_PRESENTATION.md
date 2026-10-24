# Currency unit presentation

## Shared foundation: LOC-129

`i18n/currency-names.ts` is a static Persian name snapshot, rather than a browser
ICU-dependent lookup. Names derive from installed ICU DisplayNames, with explicit
provisional names for its unmapped SVC/XCG/XDR/XSU/ZWG entries. The owner's exact
IRR name is **ریال**. Other terminology remains provisional for L10N-001 and
L10N-012. This catalog is independent of the message catalogs and never changes
canonical ISO metadata, database reference names, currency scales or flags.

`currencyLabel(code, locale, referenceName?)` selects names only for `fa-IR`.
English returns the caller's existing reference name when supplied, otherwise
the existing ISO code. Unknown/unmapped/case-mismatched codes fall back verbatim
to the supplied code; caller text remains escaped by React. Own-property lookup
prevents prototype names being treated as supported currencies. `currencyPrefix`
only translates known ISO codes; symbols and arbitrary caller prefixes retain
their existing meaning. No code is inferred from an ambiguous `$` symbol.

`currencyPartsText` replaces only identified Intl currency parts. Numeric parts,
signs, grouping and exact low digits remain untouched; a nonbreaking space
separates a localized name directly adjacent to a numeric part. English parts
are joined unchanged. The existing exact formatter retains BigInt arithmetic
and explicit currency scale, independently of numeral/calendar preference.

Adopted shared surfaces:

| Surface | Unit behavior | Canonical contract |
| --- | --- | --- |
| CurrencySelect full/compact | Persian name is primary; full selection retains secondary ISO; searchable terms include ISO, reference and localized names | Selected value, disabled codes, keys and callback are unchanged ISO |
| CurrencyInput | Known ISO prefix uses language label in `bdi` | Parent text, callback, hidden form field, decimal policy and caller aria-label are unchanged |
| DualAmount | Both amounts and missing base-rate unit use localized names and isolation | Saved source/base currencies, minor amounts and no-FX behavior unchanged |
| formatExactMoney/useNumberPresentation | Explicit presentation selects the name, preserves exact number parts | Existing default-English formatter callers and all units unchanged |

No new business operation or endpoint is introduced. Existing REST/MCP services
and machine currency values are unchanged. No schema, IRR production activation,
rial/toman conversion, rounding, payroll/legacy scale or financial calculation
change is authorized by this work.

## Remaining whole-website adoption and independent acceptance

An initial source audit found money display helper consumers in 132 website and
component files. That count is a scoping observation, not proof that all normal
currency displays have been adopted. LOC-115 is queued for independent combined
acceptance after these children; completing LOC-129 does not complete LOC-115:

| Owner | Required surfaces |
| --- | --- |
| LOC-130 | Sales, purchases, banking, accounting/fixed assets/loans, contacts, shared create/detail/document editors |
| LOC-131 | Inventory, projects, CRM, budgets, payroll; explicit fixed-two legacy semantics |
| LOC-132 | Reports, tax/currency workspace, settings/onboarding, dashboard/home, public/portal pages, all remaining website families |
| LOC-115 | Exhaustive caller/exception audit and independent integration acceptance of all children |

Each adoption task must inspect actual callers, including translated message
arguments and local formatter closures. Existing default-English helpers do not
automatically become language-aware. Raw domain unit labels, heading arguments,
accessible labels, summaries, badges and normal money cells remain assigned to
these children. This shared foundation does not claim their completion.

Exceptions to preserve and inventory during domain adoption: explicit technical
ISO identifier columns, state/select values, URLs, saved user/reference names,
REST/MCP/DB values, machine CSV/JSON exports, issued snapshots and email/PDF
outputs. Stripe files/functionality remain frozen under DEC-008, including
dedicated Stripe display work. Shared UI changes may naturally apply where
existing shared controls are used, but no Stripe-specific caller is edited.

RTL-001 and L10N-012 retain independent mounted-browser/layout/native acceptance.
The shared tests use real provider/next-intl SSR and authored callbacks, with
inline picker portal/command wrappers; they do not qualify browser search
filtering, focus, keyboard behavior, hydration or visual layout.
