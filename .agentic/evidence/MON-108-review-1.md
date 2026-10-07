# MON-108 self-review 1

2026-10-07, Asia/Tehran. Reviewer: codex, kind: self. Same operator implemented
and reviewed this change; this is not independent peer or human financial review.

Inspected both route replacements, strict schemas/query adapter, shared
snapshot service, registered MCP descriptions/inputs, ledger export replacement,
actual SDK/API-key fixture assertions, contract registry and generated inventory.
Checked the three task acceptance criteria against MON-108-attempt-1 evidence.

- Numeric cents/legacy envelopes and period-only balance semantics remain.
  Exact aliases agree; prior history is explicit in new opening/ledger fields.
  Original GL currency tags never trigger rescaling or FX.
- SQL numeric SUM/text/window projections avoid unsafe ORM money decoding and
  preserve historical int64 cancellation. Final source/gross/running/history
  values narrow through reportMinor, preventing bigint JSON failures or rounding.
- Auth precedes report queries; accounts, dimensions and both join directions
  are scoped. Same read-only snapshot contains all totals/details/currency.
  Stable line/entry UUID order resolves tied dates/entry numbers for pagination.
- Exports preserve complete MCP history and now remove REST first-page truncation.
  JSON caps/counts remain; worksheet values match across actual transports.
  Shared XLSX/PDF precision and currency scales remain unchanged.
- Negative coverage includes malformed/duplicate input, foreign/deleted accounts
  and dimensions, effective-dimension precedence, malformed entry links, denied
  keys/permissions, safe edges, unsafe gross/source/running outputs and currency.
  Ledger/audit snapshots cover successful and rejected read paths.

Initial subquery alias/import defects were corrected; final integration,
unit/typecheck/lint/money gates pass. Review result: approve for this bounded
task. No unresolved implementation finding. Parent integration, independent
accounting, session/OAuth/browser, performance, full-range and production IRR
gates remain open; no deployment/production qualification is claimed.
