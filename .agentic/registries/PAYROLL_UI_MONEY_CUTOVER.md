# MON-155 payroll UI money consumers

Payroll preserves its existing two-decimal cents convention for every currency,
including JPY, KWD and IRR. ISO currency metadata identifies presentation; it does
not rescale stored salaries, deductions, forecasts or payments. This reuses the
qualified [master](PAYROLL_MASTER_WIRE_CONTRACTS.md),
[configuration](PAYROLL_CONFIG_WIRE_CONTRACTS.md),
[run](PAYROLL_RUN_WIRE_CONTRACTS.md),
[payment](PAYROLL_PAYMENT_WIRE_CONTRACTS.md),
[compensation](PAYROLL_COMPENSATION_WIRE_CONTRACTS.md) and
[output](PAYROLL_OUTPUT_WIRE_CONTRACTS.md) contracts. No REST/MCP operation changes.

| Consumer | Adoption and arithmetic |
|---|---|
| Payroll overview | Validate employee/run DTOs, group saved currency totals, bigint monthly division and clamped chart ratios |
| Employee list/detail and shared employee drawer | Validate saved/create/update salary, hourly rate, deductions, tax configuration and bands; exact input and bigint salary preview; use selected/saved currency; compare band penetration only in the employee currency |
| Contractor list/detail and shared contractor drawer | Validate masters, nested payments and mutation responses; exact cents input for rates/payments; saved payment currency |
| Settings | Validate configuration/deduction/bracket/band reads and successful mutations; exact cents band input/display; basis points retain their distinct percent conversion |
| Compensation list/reviews and forecasting/analytics | Validate nested totals and entries; exact legacy cents input regardless of selected currency; bigint band-width average; signed forecast differences preserved |
| Run list/detail and off-cycle dialog | Validate runs/items/bonuses and success responses; bigint deduction sum; saved base/item currencies and exact bonus inputs |
| Payslip list/detail, reports, self-service and tax forms | Validate numeric/Minor aliases recursively before state adoption, including deduction lines, YTD and tax boxes; retain signed corrections and two-decimal output |
| Tax liabilities/payments | Validate report/payment aliases; bigint totals and differences; retain unlike-currency suppression and saved payment currency |
| Timesheet/leave/time-leave pickers | Validate nested employee money whenever employee DTOs are loaded; physical hours, balances and counts remain nonmoney |

`lib/money/payroll-ui.ts` requires safe integer numeric values and agreeing canonical
Minor strings for present monetary fields, validates nullable pairs and saved
currencies, rejects negative master/configuration values and malformed band ranges.
Signed run/report/output money remains supported. Read failures prevent state
adoption and show English alerts in monetary pages; form validation errors preserve
entered text. Advisory unfinished salary preview retains the existing zero result.

Explicit exceptions: hours/accrual balances/overtime multipliers, headcounts,
percentage adjustments, informational binary32 ratios and historical FX remain
their existing nonmoney units. Fixed tax/configuration editors without a currency
snapshot keep their existing USD label and cents input; tax forms remain USD.
Legacy missing currency fallback is USD where the domain already permits it.
Safe numeric sorting differences are order comparisons, never money totals.

`tests/payroll-ui-money.test.ts` checks units, low digits, signed/nullable/invalid
values, nested adoption, group totals and all payroll page source consumers.
Successful REST and linked MCP responses in the eight payroll integration workers
run through the same adapter. The master worker additionally verifies UI input to
REST create to MCP edit to independent SQL-text storage across USD/JPY/KWD.
Payroll legacy helper allowances are removed from the ESLint baseline; the source
inventory assigns these pages/helpers to MON-155 while retaining MON-008 acceptance.

No schema, migration, posted history, statutory policy, provider, application DB,
production flag, deployment, full-int64 wire expansion or new PDF qualification.
MON-008 combined consumer acceptance remains open.
