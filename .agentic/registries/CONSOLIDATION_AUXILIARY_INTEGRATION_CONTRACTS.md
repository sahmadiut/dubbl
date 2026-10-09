# Consolidation and auxiliary integration contracts (MON-028)

2026-10-09, Asia/Tehran. Independent parent integration after MON-095..099;
implementing-assistant self-review, no independent accounting qualification.

## Complete boundary ownership

REST paths are relative to /api/v1. The linked registries list every field,
operation, envelope, input/output unit and supported range. These contracts
compose without changing the child transports or introducing another money mode.

| Slice and REST operations | Registered MCP operations | Detailed contract |
|---|---|---|
| Consolidation groups: collection GET/POST; /{id} GET/PATCH/DELETE; /{id}/members GET/POST/DELETE; /{id}/rules GET/POST; /{id}/rules/{ruleId} DELETE | list/get/create/update/delete_consolidation_group(s), list/add/remove_consolidation_member(s), list/create/delete_consolidation_elimination_rule(s): 11 pairs | [Configuration](CONSOLIDATION_CONFIG_CONTRACTS.md) |
| Consolidation groups/{id}/report GET/POST | get_consolidation_report, recalculate_consolidation_report: 2 pairs | [Reporting/translation](CONSOLIDATION_REPORT_CONTRACTS.md) |
| Accrual-schedules collection GET/POST, /{id} GET/DELETE, /{id}/post POST | list/create/get/cancel_accrual_schedule(s), post_accrual_entry: 5 pairs | [Accruals](ACCRUAL_WIRE_CONTRACTS.md) |
| Revenue-schedules collection GET/POST, /{id} GET/DELETE, /{id}/recognize POST | list/create/get/cancel_revenue_schedule(s), recognize_revenue_entry: 5 pairs | [Revenue](REVENUE_WIRE_CONTRACTS.md) |
| Recurring collection GET/POST, /{id} GET/PATCH/DELETE, /{id}/pause POST, /{id}/preview GET, /summary GET | list/create/get/update/pause_recurring_template(s), delete_recurring_payable, preview_recurring_payable, get_recurring_template_summary: 8 pairs | [Recurring payables](RECURRING_PAYABLE_WIRE_CONTRACTS.md) |
| Recurring manual and scheduled generation | run_recurring_template validates a target and sweeps all due document templates; processRecurringPayableTemplate commits per template | Same payable contract; existing invoice/journal branches remain with their core owners |
| Organization PATCH currency changes | set_organization_currency, update_organization | [Settings](ORGANIZATION_WIRE_CONTRACTS.md), new accrual-history guard below |

There are 31 REST/MCP pairs across the five children, plus manual/job generation
and the settings integration boundary. Group/rule/member configuration has no
money input. No public consolidation-rate writer exists in this slice; report
rate resolution is read-only. The MON-099 auxiliary ownership audit maps remaining
configuration to organization/tax/approval/banking/payroll/procurement/assets/
projects/report/import/rendering owners; no additional independent monetary
configuration writer was found. This is source ownership, not their qualification.

## Units and supported ranges

| Boundary | Legacy input / exact input | Output and range |
|---|---|---|
| Accrual/revenue creation REST | totalAmount decimal-major or totalAmountExact canonical ASCII decimal-major text; totalAmountMinor integer-string fixed cents; aliases must agree | totalAmount and nested amount numeric fixed cents plus matching Minor; revenue also recognizedAmountMinor; positive through 9007199254740991 |
| Accrual/revenue creation MCP | totalAmount integer cents or totalAmountMinor string; REST major-text alias is unsupported | Same fixed cents, conserved bigint allocations, last period absorbs remainder |
| Recurring payable prices, both transports | unitPrice decimal-major, unitPriceExact major text, unitPriceMinor integer-string fixed cents | Signed safe cents; unitPrice/debitAmount/creditAmount and preview lineTotal add Minor; generated bill/expense audit DTOs add Minor |
| Consolidation report | UUID and inclusive Gregorian startDate/endDate; no money/FX inputs | Signed safe presentation-currency fixed cents with every numeric money alias paired to Minor; byEntityMinor is a separate map |
| Report FX metadata | Saved qualified group rates or qualified fallback | rateExact positive exact quote_per_base decimal and matching int32-millionths rate; overprecise/tiny/high numeric compatibility fails 422 |

Fixed cents remain major x 100 across USD/JPY/KWD/IRR here. No currency metadata,
locale, magnitude or suffix rescales stored amounts. Valid int64 strings whose
values exceed the safe numeric business range reject LEGACY_NUMERIC_RANGE/422;
there is no exact-only/full-int64 mode. SQL report aggregates are text and bigint;
intermediates can cancel above the exposed range. Quantities are physical decimals
stored in int32 hundredths; discount/tax are basis points; counts/periods/dates
have no money aliases. Strict syntax and conflicting aliases reject before write.
Major text and amount bounds, null/sign policies, allocation and signed rounding
details remain explicit in the child registries, including legacy UTC month overflow.

## Combined currency, locking and atomicity

Accrual rows have no currency snapshot. Organization settings now reject changing
defaultCurrency with **any** accrual schedule, including unposted and cancelled
rows, under the same organization lock used by schedule creation/post/cancel.
Same-currency/settings edits and empty-organization changes remain available.
Creation versus currency change has one winner: existing USD accounts cannot
create a schedule after EUR wins, and an inserted USD schedule freezes currency.
Historical malformed roots require remediation; no posted history is rewritten.

Revenue references an explicitly currency-labelled invoice and saved posting
accounts. Recognition requires invoice currency == current base and a two-decimal
base; accrual posting likewise requires live matching two-decimal accounts.
JPY/KWD/IRR fixed-cent posting and unsupported FX fail explicitly; configuration,
draft generation and report translation do not enable such posting or IRR rollout.

Parent report persistence locks period_lock and fiscal_year tables in SHARE mode
**before its first serializable snapshot**, then locks the parent organization.
This prevents missing rows inserted by concurrent legacy lock/year writers.
Acquiring the table lock after SELECT would preserve the earlier snapshot even
after waiting. The deterministic parent fixture holds each insertion open,
observes report lock waiting, commits the closed/locked period, and verifies
422 with unchanged elimination/GL/domain/audit state. SHARE locks protect absent
rows and can delay lock/year edits across organizations. Existing bounded
serialization/deadlock retries remain; reads remain repeatable-read and pure.

Accrual/revenue writers serialize through their organization lock and allocate
distinct journal numbers. Key/period-target replays do not advance schedules.
Recurring draft catch-up serializes with edits/generators, commits financial rows,
numbering, per-occurrence audit and schedule atomically per template; retries
generate zero once completed. Org-wide runs intentionally commit per template.
Recalculation replaces all entries for group/endDate, cleans deleted/skipped rules
and never posts member GL. Audit/output faults roll back previous writes/deletions.
Current membership, roles, API-key scope, nested references and period checks
remain mandatory as documented and tested through the actual transports.

## Combined fixture and limits

consolidation-auxiliary-integration.test.ts/worker uses actual API-key REST and
full registerAllTools SDK transports in a random migrated PostgreSQL database:

- REST exact-major accrual 1250 and MCP cents revenue 2501 replay across transports;
  concurrent domain posts allocate [416,416,418] and [833,833,835], producing six
  distinct balanced identity-USD journals. Report revenue=2501, expenses=1250,
  netIncome=1251 and balanceCheck=0 agree with exact aliases.
- Three recurring bills and three expense claims remain drafts at 1250 each;
  concurrent catch-up produces [0,3], replays produce zero and draft generation
  contributes no GL/report earnings.
- A synthetic custom prefix rule eliminates 1250 with variance 1251; persisted
  values agree with the worksheet. Rule deletion/recalculation removes its saved
  entry while retaining all six member journals. This verifies mechanics, not
  economic validity of arbitrary custom/elimination configurations.
- Currency-history and currency/create races, custom-permission/foreign roots,
  strict inputs/unsafe aliases, report snapshot/period insertion races and audit
  rollback compare whole-slice SQL snapshots. All five child workers plus settings
  retain complete operation-level auth/range/output/storage/fault qualification.

Independent accounting, symmetric invoice/bill-cap assumptions, original revenue
deferral/aggregate schedule policy, legacy remediation, large-history performance,
full-int64, production IRR, browser/session/provider parity and deployment remain
separate qualification. No schema/migration or historical rescale is introduced.
