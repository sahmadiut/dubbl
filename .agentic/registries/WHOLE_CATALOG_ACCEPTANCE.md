# Whole-catalog integration acceptance - LOC-002

Independent combined acceptance, 2026-10-24, Codex. The production catalogs
contain 157 namespaces and 10,587 compatible leaves per locale. Existing child
implementations compose correctly; no production or catalog rewrite is needed.
This record accepts extraction, missing-key/ICU validation and safe catalog
rendering. Native terminology and complete Persian/RTL workflows remain separate.

## Reconciled source ownership

| Combined owner | Current source and exception inventory |
|---|---|
| LOC-005 / LOC-006 | [Foundation and authoring contract](MESSAGE_CATALOGS.md), [shell/auth/settings/workspace](SHELL_AUTH_SETTINGS_ACCEPTANCE.md): preferences, authentication/onboarding/consent/invitations, shell/primitives, settings, teams/admin/notifications. |
| LOC-007 | [Accounting/sales/purchasing/contacts/tax](ACCOUNTING_SALES_PURCHASING_CATALOG_ACCEPTANCE.md): 87 route components, their layouts/forms/drawers/pickers and error presentation. |
| LOC-008 | [Operations/reports](OPERATIONS_CATALOG_ACCEPTANCE.md): 101 inventory/payroll/projects/CRM/report/dashboard/document route components plus shared controls. |
| LOC-009 | [Public/output/background](PUBLIC_OUTPUT_CATALOG_ACCEPTANCE.md): signing, portal, landing/pricing/legal/help, document/email renderers and background delivery display copy. |

Counts in older child records are historical snapshots and may overlap reused
namespaces. The independently flattened complete catalogs determine the current
total; child counts are not added together. Source inspection finds 249 app TSX
and 158 components TSX files; not every file owns authored prose. Existing help
content has 68 paired English/Persian MDX sources and remains outside JSON.
All parent compositions and child source inventories execute in the full unit
suite on the current tree, rather than inferring integration from task status.

Explicit exceptions remain caller/saved/historical data, names and identities,
codes/routes/URLs/IDs, canonical API/MCP/storage/report/CSV contracts, statutory
tokens, technical/demo values, runtime calendar/number/date presentation and
provider/operator diagnostics. Finite authored error fallbacks use catalogs.
Existing output hooks accept an explicit locale, while send/background defaults
and PDF rendering retain English pending recipient/Persian shaping qualification.
DEC-008 preserves all existing Stripe functionality, files and residual prose;
Stripe qualification does not block this acceptance. No new user operation or
REST change requires an MCP addition. Existing documented MCP gaps remain open.

## Independent whole-catalog runtime checks

[Whole-catalog tests](../../tests/whole-catalog-integration.test.ts) execute every
actual catalog leaf through the real next-intl translator, real React structured
tag callbacks and HTML escaping. Generated fixtures supply adversarial caller
text, numeric/date arguments, each select choice, 0/1/2/fractions and exact plural
cases. Interleaved Persian/English/Persian runs detect mutable locale state.
The actual PresentationProvider separately transports a representative key from
every complete namespace, with no translation or React diagnostics. Reflection
is restricted to exhaustive test enumeration; production callers retain their
English-schema next-intl types and compile-time negative-key probes.

All 160 production plurals in each catalog independently check selected branch
literals and localized pound values for 0, 1, 2, 0.5 and 1.5, honoring explicit
cases and offsets. Runtime Persian cardinal selection is one/one/other for
0/1/2. Existing message-catalog tests additionally pin ordinal behavior, nested
validation, malformed keys, missing branches, interpolation/format mismatches,
HTML/tag/attribute rejection and safe rendering/lint failures. Current catalogs
have two selects and no nested selectors; adding nesting deliberately fails
until combined runtime fixtures are extended.

`pnpm i18n:check` parses every leaf and rejects missing/extra/empty keys or
incompatible ICU contracts. Production typecheck resolves actual literal and
finite-union keys against the English schema. ESLint guards raw/markup/catalog
bypasses and catalog HTML sinks; direct rich callbacks retain application-owned
structure/URLs. HTML email/document/report helpers escape translated/interpolated
text, while React escapes structured output. Saved custom HTML/templates remain
caller content with their existing policy, outside catalog HTML authoring.

## Qualification boundary

Focused migrated PostgreSQL suites complement the full unit/source/render/callback
checks with real authenticated REST, registered MCP and independent SQL across
locale preferences, shell/settings, accounting, inventory, payroll, projects,
portal and document boundaries. Only explicit loopback disposable fixtures run;
no application database or live provider is used. Exact stored units, ISO codes,
FX, authorization, historical snapshots and IRR flags are unchanged.

See [actual commands and results](../evidence/LOC-002-attempt-1.md) and
[actual review](../evidence/LOC-002-review-1.md). Catalog parity and runtime
rendering do not confer native linguistic/financial/legal approval, full RTL,
calendar/numeral/input qualification, browser hydration/keyboard, recipient
delivery, Persian PDF shaping, hosted CI, deployment or production readiness.
LOC-003 and subsequent localization/RTL tasks retain their own acceptance.
