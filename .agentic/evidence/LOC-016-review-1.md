# LOC-016 self-review 1

Reviewer: coding-assistant. Kind: self. Date: 2026-10-17 (Asia/Tehran).
This is the implementing assistant's review, not independent or native approval.

## Findings and disposition

- Scope stays within members, roles, advisors, API keys, audit and supporting
  presentation/error helpers. Shared AI planning edits were preserved and excluded.
- Catalog keys are typed and paired. Persian wording is provisional. Complete
  messages retain interpolation and plural behavior; rich content uses only
  approved structural tags with attributes owned by application code.
- All 45 permission codes and original group memberships match entry HEAD.
  The editor does not expose bypass:period-lock. Selected callbacks, guards and
  system-role restrictions remain in their original caller; translated labels do
  not enter payloads. Saved custom/system-role names remain data to avoid guessing
  identity from a label or rewriting the server's seeded-name matching contract.
- Member/role/advisor/API request URLs, JSON bodies and audit query parameters
  match entry HEAD by AST comparison. Server authorization, accounting, canonical
  dates/money and REST/MCP output are untouched. Existing role/audit MCP tools were
  inspected; no new user operation requires a new tool in this extraction.
- Plain keys and caller text are React-escaped; create/reveal branches and close
  reset remain intact. Copy/revoke labels are translated; real clipboard behavior
  was not executed. The sample Authorization/Bearer header remains code.
- Audit action tabs/badges/sentences use exact allowlists and retain machine filter
  values. Unknown codes remain technical data rather than dynamic translation
  keys. Relative/day label tests cover thresholds, invalid input and local-day
  boundaries. Other timestamp/number formatting and full RTL remain separate.
- Exact errors preserve role/owner/system-role/conflict guidance. Unrecognized
  response prose cannot become catalog keys or translated product text; status
  and operation fallbacks remain contextual. No HTML sink was introduced.
- Interim extraction, separator, badge-label and test-guard issues were repaired.
  Final verification results are recorded in the attempt evidence. Existing fetch
  rejection/indeterminate limitations are explicitly inventoried, not certified.

Approve the bounded catalog extraction after the final checks in
[attempt evidence](LOC-016-attempt-1.md). LOC-012/006/002 integration, native L10N,
RTL, browser layout and persisted workflows remain independent acceptance gates.
