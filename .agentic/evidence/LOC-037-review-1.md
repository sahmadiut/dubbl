# LOC-037 self-review 1

Reviewer: Codex (same implementer); kind: self. Date: 2026-10-18 (Asia/Tehran).
Decision: approve the bounded catalog-extraction task, with the limits below.

Reviewed the changed budget routes, selected BudgetDrawer function and imports,
new presentation helper, paired catalogs, tests and generated money inventory.
Compared existing namespaces and sibling drawer bodies with HEAD. Inspected
existing budget REST handlers and registered MCP CRUD/report tools; no operation
or wire change required a new tool. Parent tasks and Stripe remain unchanged.

Findings corrected before approval:

- Chart legend labels cannot be machine identities after translation. Tooltips
  now select saved exact amounts by stable `budgeted`/`actual` data keys.
- Saved period labels remain canonical grouping/wire keys. Only rendered labels
  and chart axes/tooltips translate canonical generated forms. Custom text and
  unknown values remain data; no translated label enters a write payload.
- Raw server/network/parser prose cannot become UI copy. Status/code mappings,
  known amount-input errors and operation fallbacks localize failures while
  retaining budgetJson's exact-money validation.
- A failed DELETE previously showed success. Deletion/toggle now notify errors
  and rethrow for the existing confirmation hook to retain retry state; no
  success/event/redirect occurs. Missing org is checked before creation saving.
- The source audit found remaining grand-total/spent copy. It is now cataloged,
  with whole sentences and an existing approved rich tag for amount styling.

Evidence: [attempt 1](LOC-037-attempt-1.md), including 22 focused tests, 795 unit
tests at checkpoint, three real REST/MCP/SQL integrations, typecheck, catalog
validation, lint and exact-money gates. Review found no remaining blocker for
this child. English amounts/units, payload fields, routes, organization scope,
calendar data, exact sums and sibling code are preserved.

No independent reviewer, native Persian approval, mounted browser, RTL, hosted
CI or production acceptance is claimed. Persian wording is provisional. The
LOC-024/007/002 integration parents remain open and require their own acceptance.
