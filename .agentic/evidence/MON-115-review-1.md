# MON-115 review 1

2026-10-08. Reviewer: codex. Kind: self. Result: approve for this bounded task.
The implementer reviewed their own diff and evidence; this is not independent
peer/human/accounting approval or production qualification.

Reviewed shared service/schema/route and MCP integration, dashboard consumer diffs,
contract registry and actual test results. Every amount is narrowed only after
bigint calculations, with numeric/Minor aliases and visible compatibility errors.
Ledger source text can aggregate beyond int64 without precision loss; document
sources and all exposed values enforce supported safe ranges. Derived differences,
root totals and Excel cells have explicit negative fixtures.

Authorization is shared inside the service. Read-only repeatable-read snapshots
scope organization metadata, document queries and both sides of ledger joins.
Contact labels are owned/live; no foreign name leaks. Actual API-key handlers and
MCP clients agree for populated and empty results; custom-role denials, malformed
keys, foreign references and unchanged financial/audit snapshots are asserted.

UTC month/prior arithmetic, cash heuristic, current AR/AP snapshots, invoice-driven
contact inclusion, expense COGS and integer percentage ties preserve documented
semantics. Contact document filtering and executive same-base currency rules avoid
implicit FX. Existing project service is reused and its integration fixture passed.
UI errors are visible, failed rows/totals hidden, and exact formatter/tooltip uses
returned currency. PDF/XLSX and MCP exports share validated statements and range guards.

Findings corrected: required fixture description, early month schema check, schema
union callback typing, basis separation from date inputs, old unused MCP imports,
default export filename dates and COGS account-type restriction. No unresolved
in-scope finding remains. Typecheck, focused/adjacent integration, full units,
changed-file/full lint, inventory/legacy gates and controller validation passed.

Limits: browser/session/OAuth and visual print fit were not verified. Contact and
outstanding-document rows aggregate in memory; no production volume qualification.
Current AR/AP balances do not reconstruct historical payments. Cash remains an
entry heuristic. Public full-int64, independent financial review and production
IRR/release qualification remain separate. MON-104/MON-029 retain integration.
