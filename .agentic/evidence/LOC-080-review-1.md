# LOC-080 Codex self-review

Reviewer: Codex. Kind: self. Date: 2026-10-20 (Asia/Tehran).
Scope: employee list, EmployeeDrawer, response boundary, paired catalogs, tests,
owned inventories and controller handoff. This is not peer/human/native review.

## Findings

- All authored display copy in the bounded page/drawer has paired catalog keys;
  the AST guard rejects unextracted JSX/display attributes and raw error prose.
  Explicit exceptions cover technical examples, decorative initials, machine
  values and existing formatting. Persian values contain Persian script.
- Display-only finite frequency/status/sort translations retain all machine
  tokens. Names/IDs/positions and other caller values are escaped and preserved.
  Existing route, header, payload, null, Gregorian date and bank/employee
  identifier contracts remain. No REST/MCP/authorization changes were made.
- List adoption requires a validated successful response, required display
  fields and canonical matching salary aliases. Superseded/unmounted requests
  cannot set rows/errors/loading; missing org and storage failures release busy
  states. Refetch clears prior feedback and can retry. Create response navigation
  requires an ID and validates any supplied money; an ID-only response does not
  need money fields because none are displayed from it.
- Failed creation retains input and releases saving; only a verified success
  closes/navigates. HTTP/JSON/network/parser/private server text never appears
  in error feedback. Existing exact cents and basis-point helpers still own
  payload conversion, including zero/29/max safe cents and USD/JPY/KWD behavior.
- Production JSX/next-intl rendering, callback and migrated REST/MCP/SQL checks
  exercise the actual behavior. Hook/IO and portal/date/currency-picker test
  boundaries are disclosed. Full-suite/static results are in
  [attempt evidence](LOC-080-attempt-1.md).
- Shared drawer source outside EmployeeDrawer and its one import is unchanged;
  generated money inventory has only owned source changes. No Stripe,
  schema/migration, statutory rule, ledger or IRR/FX flag changes.

No unresolved defect found within this extraction scope. Approved: all recorded
verification passes, including 1,150/1,150 unit/static tests and the migrated
REST/MCP/SQL fixture. The existing startDate sort uses number order,
list pagination remains as before, and cents presentation remains fixed-two;
this review does not qualify or repair those separately documented behaviors.

Persian terminology, mounted browser/keyboard, complete RTL/date/numeral,
output, hosted CI, live providers and production release remain unverified.
LOC-067/008/002 need independent acceptance; LOC-081 owns employee detail.
