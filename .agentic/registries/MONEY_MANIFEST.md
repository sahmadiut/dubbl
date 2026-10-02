# Money and FX boundary manifest

Owner: MON-001. Every row below is a domain to inspect, not an assertion of a table name. Expand to one row per real column or conversion boundary before migration. Record actual table/column/path, current type, current unit/currency source, maximum range, target representation, consumers, migration task and test evidence.

| Domain / boundary | Actual paths / columns | Status |
|---|---|---|
| Journal debit/credit, balance aggregates | unknown | inspect |
| Invoices and invoice lines | unknown | inspect |
| Quotes / estimates | unknown | inspect |
| Bills and bill lines | unknown | inspect |
| Payments, allocations, refunds | unknown | inspect |
| Expenses and tax totals | unknown | inspect |
| Inventory cost layers / landed cost | unknown | inspect |
| Payroll | unknown | inspect |
| Fixed assets / depreciation | unknown | inspect |
| Loans / budgets | unknown | inspect |
| Recurring templates and jobs | unknown | inspect |
| Customer and vendor credits | unknown | inspect |
| FX fields and provider caches | unknown | inspect |
| API / MCP / JSON serialization | unknown | inspect |
| Portal / payment / signing | unknown | inspect |
| PDFs / email / print | unknown | inspect |
| Reports / exports / imports | unknown | inspect |
| Locale parsers / currency fallback metadata | unknown | inspect |

Search fixed /100, *100, fixed two-decimal formatting, amountCents and related names, decimalToCents, centsToDecimal, parseMoney, parseFloat, Number(bigint) and scaled FX. Classify false positives such as percentages. Audit frontend, server, jobs and public surfaces. No valid existing money value is rescaled merely by widening integer storage.
