# MON-154 self-review 1

2026-10-12, Asia/Tehran. Reviewer: Codex, kind self. No peer/human impersonation.

Reviewed task criteria, changed source, actual adapter behavior, domain wire
contracts, immutable prior MON-153 evidence, new fixture results and scoped mapping.

- Exact saved aliases validate before adoption; unsafe/fractional/noncanonical and
  conflicting values fail. Nullable catalog/stock money remains null/null. Physical
  units retain int32 grammar. Stock-take applied discrepancies use live inventory,
  so the adapter does not reconstruct them from an older expected count.
- Catalog USD cents and valuation/assembly base-currency presentation remain
  explicit distinct legacy policies, with no raw unit changes. Book and price
  projections remain different after write-down/count application. All financial
  percentages/sorting/chart shares in the scoped valuation page use bigint ratios.
  List average margin comes from SQL numeric decimal text, with the old alias retained.
- BOM quantity/wastage aliases are validated as six-place physical decimals; the
  independent cost estimate matches positive legacy cost rounding and saved cost
  aliases. Nested recipe/finished-item money in assembly lists validates.
- Review moved detail/variant validation before deferred React state updaters and
  inventory-create validation before success/close. Picker resolution now requires
  matching item and organization, ignores superseded reads, and reports missing or
  malformed responses. Transfer form retains text and validates every line, avoiding
  partial-number truncation and silently omitted items.
- Sorting/transfer helpers have direct behavioral tests. Near-safe-limit ratios
  whose Number division collapses remain strictly ordered through bigint products.
  Transfer malformed input invalidates the whole request. JSX/source review checks
  English alerts, keyboard modes and explicit labels; no live browser claim.
- Real REST/MCP/SQL six-workflow tests and existing domain fixtures verify low
  digits, stored costs, exact BOM totals, signed stock adjustment, unchanged rejected
  snapshots and balanced posting. Final 486/486 units, 2/2 UI integrations, earlier
  7/7 domain integrations, typecheck, lint, inventory/legacy gates and diff checks
  pass as recorded in attempt evidence. Lint retains 98 existing repository warnings.
- No schema/migration or deployment/provider/IRR changes; previous completed-task
  evidence remains untouched. MON-008 and other children retain their own acceptance.

Result: approve MON-154's three scoped criteria. Complete controller transitions
and authorized task-owned commit/push, then confirm remote SHA and clean tree.
This is self-review, not independent accounting/security/production qualification.
