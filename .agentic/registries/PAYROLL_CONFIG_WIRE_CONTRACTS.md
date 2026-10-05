# Payroll configuration wire contracts (MON-080)

2026-10-05, Asia/Tehran. Shared direct-DB services in lib/api/payroll-config.ts,
strict schemas/DTOs in payroll-config-wire.ts, 23 REST/MCP operation pairs.
This is compatible safe-number coexistence, not full-int64 payroll or financial
release qualification. Actual PostgreSQL fixtures: payroll-config.test.ts and
payroll-config-worker.ts. Pure boundaries: payroll-config-wire.test.ts.

## Complete operation inventory

| REST operation (under `/api/v1/payroll`) | MCP tool | Result envelope |
|---|---|---|
| GET `settings` | `get_payroll_settings` | `settings` |
| PUT `settings` | `update_payroll_settings` | `settings` |
| GET `deductions/types` | `list_payroll_deduction_types` | `data` |
| GET `deductions/types/[id]` | `get_payroll_deduction_type` | `deductionType` |
| POST `deductions/types` | `create_payroll_deduction_type` | `deductionType` |
| PATCH `deductions/types/[id]` | `update_payroll_deduction_type` | `deductionType` |
| DELETE `deductions/types/[id]` | `delete_payroll_deduction_type` | `success` |
| GET `employees/[id]/deductions` | `list_payroll_employee_deductions` | `data` |
| POST `employees/[id]/deductions` | `create_payroll_employee_deduction` | `deduction` |
| PATCH `employees/[id]/deductions/[deductionId]` | `update_payroll_employee_deduction` | `deduction` |
| DELETE `employees/[id]/deductions/[deductionId]` | `delete_payroll_employee_deduction` | `success` |
| GET `employees/[id]/tax-config` | `get_payroll_employee_tax_config` | `taxConfig` |
| PUT `employees/[id]/tax-config` | `update_payroll_employee_tax_config` | `taxConfig` |
| GET `tax/brackets` | `list_payroll_tax_brackets` | `data` |
| GET `tax/brackets/[id]` | `get_payroll_tax_bracket` | `bracket` |
| POST `tax/brackets` | `create_payroll_tax_bracket` | `bracket` |
| PATCH `tax/brackets/[id]` | `update_payroll_tax_bracket` | `bracket` |
| DELETE `tax/brackets/[id]` | `delete_payroll_tax_bracket` | `success` |
| GET `tax/allowances` | `list_payroll_tax_allowances` | `data` |
| GET `tax/allowances/[id]` | `get_payroll_tax_allowance` | `allowance` |
| POST `tax/allowances` | `create_payroll_tax_allowance` | `allowance` |
| PATCH `tax/allowances/[id]` | `update_payroll_tax_allowance` | `allowance` |
| DELETE `tax/allowances/[id]` | `delete_payroll_tax_allowance` | `success` |

POST returns 201; all other successful REST operations return 200. MCP retains
these named envelopes without HTTP status. Lists contain data arrays, without
pagination/aggregate money. Type/bracket/allowance detail returns one owned live
row. Employee deductions retain nested deductionType, whose money also gains
aliases. Allowance CRUD exposes the existing persisted table for the first time; it adds
no table, tax rules or provider lookups. Settings and employee tax-config GET
retain existing lazy default initialization, now serialized and audited; a
repeat read returns the saved row without a new audit. No payroll/GL posting.

## Money and exact aliases

All original numbers remain nonnegative **integer cents**, including annual
thresholds and per-period fixed deductions. Existing payroll's two-decimal cents
contract is preserved independently of ISO currency scale. USD 1250 remains
1250; changing a label never rescales saved values. The boundary does not claim
scale-aware foreign payroll. Fields in this slice:

| Entity | Numeric cents fields | Scope and null behavior |
|---|---|---|
| Settings | ssWageBaseCents, addlMedicareThresholdCents, futaWageBaseCents, sutaWageBaseCents | Annual thresholds/wage bases; nonnull; DB defaults on insert |
| Deduction type | defaultAmount | Fixed amount per payroll period; null means no fixed default |
| Employee deduction | amount | Fixed per-period override; null means use percent/type fallback |
| Employee tax config | additionalWithholding | Extra withholding per payroll period; historical null preserved and explicit null supported |
| Tax bracket | minIncome, maxIncome, baseAmountCents, standardDeductionCents | Annual floor, exclusive ceiling, cumulative tax at floor, optional standard deduction; only floor is nonnull; null ceiling unlimited, null base derives from prior brackets |
| Tax allowance | allowanceValueCents, standardDeductionCents | Annual amount per allowance and annual standard deduction; nonnull, default zero |

Each field adds a canonical ASCII string named **the full field name + Minor**,
e.g. ssWageBaseCentsMinor and additionalWithholdingMinor. Responses always retain
the original Number and add the matching alias; null produces null for both.
Input may supply numeric, string or both with exact agreement, including null.
Create bracket requires minIncome or minIncomeMinor. Optional omitted values
retain saved state on update and use existing defaults/nulls on creation.
Exact aliases follow ADR-006; legacy numeric compatibility remains under its
documented qualification/client-migration deprecation window. No sunset date
or generic client opt-in is introduced.

Supported effective money range is 0..9007199254740991 inclusive. Canonical
syntax excludes signs for nonnegative money, leading zeros, -0, fractions,
exponents, spaces, localized digits, nonfinite and unsafe Numbers. Signed-int64
string syntax validates first; a valid int64 string beyond the safe effective
range returns 422 LEGACY_NUMERIC_RANGE before any write. Other input validation
returns REST 400 / MCP validation error. Unsupported saved money/metadata returns
422 rather than silently narrowing, masking historical errors or emitting null.
DTO and audit serialization occurs inside the transaction before commit.

## Other units and metadata

- defaultTaxRate, ssRateBp, medicareRateBp, addlMedicareRateBp, futaRateBp,
  sutaRateBp and bracket rate are integer **basis points** 0..10000. 100 is 1%.
  No money aliases are accepted for rates.
- defaultPercent and employee percent are nullable **decimal percent of gross**
  0..100, e.g. 2.5 means 2.5%, not 250 basis points. PostgreSQL real cannot store
  arbitrary decimals exactly: this bounded slice accepts only finite binary32
  values unchanged by Math.fround. 2.5 is supported; 2.9 rejects before write.
  Unsupported saved real values also reject. Exact decimal percent expansion or
  remediation is separate; no silent quantization, schema conversion or alias.
- overtimeThresholdHours is nonnegative binary32 hours; overtimeMultiplier is
  binary32 factor >=1. Negative zero is rejected. Rates/physical hours remain
  ordinary numbers and are not money/FX strings.
- federalAllowances/stateAllowances are nonnegative int32 counts 0..2147483647.
  Tax year/defaultTaxYear is Gregorian integer 1..9999; bracket/default year may
  be null. No current statutory rates/year defaults are asserted by this task.
- jurisdictionLevel is federal/state/local; jurisdiction is a nullable nonempty
  label/code. Filing status is single/married_joint/married_separate/
  head_of_household; nullable bracket filing status applies to all.
- Names are nonempty, text <=10000 characters; create type requires category
  pre_tax/post_tax. Timing defaults recurring or accepts one_time. Booleans are
  explicit. IDs are UUIDs. Dates are valid Gregorian YYYY-MM-DD or null; merged
  endDate cannot precede startDate. Bracket ceiling must exceed floor.
- defaultCurrency uses the supported ISO currency schema. A settings currency
  change requires no payroll_run history (including retained/deleted runs).
  Explicit supplied GL codes must resolve to owned live active accounts of type
  expense/liability/asset respectively. Lazy DB defaults may reference codes not
  provisioned yet; posting must qualify them separately. Null clears codes;
  there is no automatic account creation.

## Scope, permission, atomicity and retries

Settings, types, employee deductions and tax elections require manage:payroll;
brackets and allowances require manage:tax-config. REST authenticates and checks
permissions before decoding bodies; direct DB services recheck. MCP uses the
creation-time AuthContext, wrapTool, strict input and described fields, without
HTTP self-calls. Client org headers cannot override an API key's organization.

Every writer locks the live organization and commits row plus audit atomically.
Employee nested operations additionally lock the owned live employee, coordinating
with MON-079 master update/delete. Deduction writes match both employeeId and
actual deductionId. Assignments require a live type in the same organization;
reads/edits check historical type ownership and never reveal foreign nested rows.
Historical soft-deleted owned types remain available to existing assignments.
Invalid cross-tenant history fails explicitly. Type/bracket/allowance update and
delete exclude deleted rows, so they cannot resurrect history. Soft deletion
retains all rows/posted references. Bracket deletion also deactivates it; the
existing withholding loader excludes deleted bracket and allowance rows.

Preflight rejects invalid aliases, dates, floor/ceiling, ranges, references and
saved output before commit. Atomic audit/DTO fault injection and full tracked
snapshots are tested via REST and MCP. Reads that initialize defaults serialize
on organization/employee locks, producing one row/initialization audit. Adopted
concurrent partial updates retain disjoint fields; simultaneous deletes have
one winner and one 404. Repeating create type/bracket/deduction intentionally
creates another record; no idempotency key is claimed. Allowance create/update
allows one live row per (org, level, nullable jurisdiction, year), rejects 409
duplicates including concurrent null-jurisdiction creates. Retained duplicates
are not silently merged. No period lock is applied to editable future payroll
configuration; historical pay items and journals are never recomputed here.

## Dashboard compatibility corrections and remaining work

Settings submits only editable fields, not readonly IDs/timestamps/new DTO
aliases from GET. Type/bracket editors parse exact cents and basis points; fixed
amount/range displays preserve large safe integers and zero. The employee form
uses actual filing enums, additionalWithholdingMinor (two-decimal cents input),
and data deduction envelope. The former nonexistent additionalFederalWithholding
and additionalStateWithholding fields were silently ignored; they now reject
unknown input, and the editor exposes the actual single per-period withholding.
Existing fixed/percent/type precedence is displayed without treating percent as
money. This task does not add unsupported state withholding storage.

MON-082 owns withholding/run arithmetic, jurisdiction selection, complete
schedule qualification and concurrent unadopted run writers. Current calculation
loaders still choose tax schedule/allowance rows by their legacy selection rules;
nondefault jurisdiction metadata and conflicting bracket sets do not establish a
qualified jurisdiction-specific run. Configuration CRUD does not certify statutory
compliance or run eligibility. MON-081/083/084/085 retain time/leave, payments,
compensation/forecast and outputs. Parent MON-025 retains integrated writer gates;
MON-010/QA retain migration/financial/security/full-int64 qualification. No schema
change, historical rescale, app-database reset/migration, provider/network tax
lookup, IRR enablement, build/dev server, deployment or independent human review.


Compatibility corrections also reject formerly unconstrained negative/fractional/unsafe money and lossy percent/hour controls, foreign nested writes, unknown fields and deleted-row edits. Existing valid money units and response envelopes remain unchanged. Clients that echoed readonly GET fields into PUT must send the documented editable controls; the bundled dashboard does so.
