# Payroll employee and contractor master contracts

MON-079; implementing-assistant self-review. Parent MON-025 retains integrated
payroll qualification after MON-079 through MON-085. This is master-record
adoption, not qualification of payroll calculations, posting, statutory rules
or foreign payroll FX. No rates or tax regulations are changed here.

## Operations and envelopes

All REST paths start with `/api/v1/payroll`. Services in
`lib/api/payroll-master.ts` use direct Drizzle access, with AuthContext fixed at
MCP server creation; REST authenticates the request and uses the same service.

| REST | MCP | Response |
|---|---|---|
| GET employees | list_payroll_employees | REST `{data, pagination}`, MCP `{employees, total, page, limit}` |
| GET employees/{id} | get_payroll_employee | `{employee}` |
| POST employees | create_payroll_employee | `{employee}`, REST 201 |
| PATCH employees/{id} | update_payroll_employee | `{employee}` |
| DELETE employees/{id} | delete_payroll_employee | `{success: true}` |
| GET contractors | list_contractors | REST `{data, pagination}`, MCP `{contractors, total, page, limit}` |
| GET contractors/{id} | get_contractor | `{contractor}` including historical `payments` |
| POST contractors | create_contractor | `{contractor}`, REST 201 |
| PATCH contractors/{id} | update_contractor | `{contractor}` |
| DELETE contractors/{id} | delete_contractor | `{success: true}` |

Other successes are REST 200. Existing list/create employee tool names and
envelopes remain; list adds safe master/profile fields and money aliases. Every
operation requires `manage:payroll` for employees or `manage:contractors` for
contractors, including reads; custom permissions override legacy role checks.

## Units and ranges

- Employee `salary` is nonnegative ANNUAL integer cents; `salaryMinor` is its
  additive canonical ASCII integer string. Either is required on create, zero
  is allowed. Employee/contractor `hourlyRate` is nullable integer cents per hour;
  `hourlyRateMinor` is a matching nullable string. Both aliases must agree,
  including null. Salary cannot be null. New money supports 0..9007199254740991.
- Numeric inputs remain safe Numbers; canonical int64 strings above safe Number
  range produce 422 `LEGACY_NUMERIC_RANGE` before mutation. Full int64 workflows
  remain MON-007/008. Both output aliases coexist; no header negotiation, unit
  rescaling, lossy coercion or magnitude-based type selection occurs. USD/IRR/
  JPY/KWD 1250 remains the stored integer 1250. These master endpoints neither
  fetch rates nor perform FX conversion.
- Historical null hourly rates retain null aliases. Nullable historical currency
  remains null without guessing a currency. Unknown/noncanonical saved currency,
  negative/fractional/unsafe master money and out-of-range saved tax rate produce
  classified 422. Unrelated edits cannot mask invalid monetary history. Deletes
  also preflight the saved master DTO; remediation of malformed history remains
  separate.
- `taxRate` is an integer basis-point fallback, 0..10000, default 2000; no money
  alias. `ptoBalanceHours` is saved physical hours, finite numeric output, not
  cents; this API does not mutate it. Frequency/type are explicit enums. Salary
  default is never guessed; create frequency/type/currency default monthly/salary/
  USD, hourly rate defaults null, active defaults true. Omitted patch fields
  retain values; nullable metadata clears with null. Strings are bounded to
  10000 characters; email/UUID/currency and Gregorian YYYY-MM-DD dates validate.
- Employee start date/number are create-only. End date cannot precede start.
  Employee currency updates, previously silently ignored by REST despite being
  sent by the editor, are now explicit and permitted only without pay-item
  history. Contractor currency changes require no payment history. Amounts do
  not rescale. Salary/rate updates do not rewrite existing items/payments.
- Contractor detail payment `amount` keeps signed safe integer cents and gains
  `amountMinor`; each payment retains its own nullable currency and lifecycle.
  No cross-currency total, reinterpretation or payment mutation is introduced.
  Payment writers are MON-083, not this slice.

## Validation, scope and atomicity

Strict body/tool schemas reject unknown fields, alias conflicts, negative/new
fractional money, malformed exact strings, dates, currencies and UUIDs. REST
validation returns 400; SDK schema failures/`wrapTool` Zod failures return MCP
isError validation results (the existing Zod wrapper has no numeric status).
Auth/not-found/conflict/range errors retain 401/403/404/409/422 classification.
Malformed JSON is 400. Unknown REST query keys retain the prior ignored behavior;
recognized pagination/filter values are strict. REST active filters are `active`
for employees and `isActive` for contractors; MCP uses `active` for both. Page is
1..1000000; default size 50, REST max 100, MCP max 200. Lists sort by createdAt
descending then UUID ascending, with count/rows in one repeatable-read snapshot.
Counts are SQL text checked through bigint before returning numeric compatibility.

Reads/writes exclude deleted/foreign roots. Member assignment checks organization
ownership; employee member joins are independently scoped even for corrupt saved
links. Public user profile exposes only id/name/email/image, never passwordHash,
revocation/admin flags or other account internals. Foreign saved member links
return null member details; updates require owned link or explicitly clearing it.

Each create/update/delete transaction includes output preflight and audit. Updates
and deletions lock the scoped master row and repeat scoped predicates; successful
deletion retains all historical item/payment references. Competing adopted
REST/MCP deletions produce one success, one 404 and one audit. Audit/DTO failure
rolls back the entire adopted mutation. These metadata operations do not post GL
or change existing pay-run amounts, so financial period locks do not apply.
Unadopted run/payment writers do not yet share all master locks; integrated
currency-change/run-creation concurrency remains MON-082/083 and parent MON-025.

## Dashboard and verification

Root master create/edit forms use bigint-based two-decimal parsing and matching
exact aliases, retaining the existing cents editor convention and currency
presentation. They reject excess precision/unsafe values instead of rounding.
Exact decimal hydration round-trips maximum safe cents; zero hourly rates remain
zero instead of becoming null. Employee pay-period preview uses bigint half-up
rounding; unfinished invalid input previews zero and cannot save. List money
formatting uses the exact existing scale-aware bank display adapter, retaining
prior ISO display scales. Wider payroll currency/editor presentation remains the
parent/locale qualification. Contractor creation now sends `hourlyRateMinor`,
fixing the prior ignored `defaultRate`. Employee number is an identifier, not a
database-enforced uniqueness guarantee.

`tests/payroll-master-wire.test.ts` covers alias/range/null/unit/date/query/editor
contracts. `tests/integration/payroll-master-worker.ts` invokes all ten actual
REST/MCP operation pairs using two tenants, API keys/custom roles, full MCP
registration, header spoofing and saved corrupt data. PostgreSQL snapshots verify
negative paths, six audit rollback operations, post-insert DTO rollback and one
winner concurrency, with retained history and no ledger changes. No browser,
session/OAuth, full-range, production IRR or independent financial/security
qualification is claimed.
