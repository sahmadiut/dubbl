# Consolidation and report pack catalogs - LOC-114

Owns app/(dashboard)/reports/consolidation/page.tsx and pack/page.tsx.
ConsolidationReports has 37 paired messages for group/member management, report
headings, tabs, account types, summaries, totals, errors and accessible removal
labels. ReportPack has 14 paired messages for headings, help, period, bundle
contents and download. ICU interpolations preserve caller names and date strings.

Exceptions: group/business/account names, labels, account codes, organization
slugs/country values and unknown account types remain caller/server data.
Counts and reportResultMoney output retain their existing presentation; date
strings remain canonical Gregorian values. Punctuation and currency codes are
literal. Shared date-range/basis/export/loader controls retain existing catalog
ownership. Full numeral/calendar/currency formatting qualification is separate.

Raw-unit CSV column keys (including entity label/ID pairs), account type values,
currency codes, totals and filenames remain unchanged. The pack download URL,
Gregorian dates, accrual/cash values and xlsx format remain unchanged; workbook
sheet/cell contracts are not translated. API routes, organization headers,
group/member payloads, tenant authorization and MCP tools are unchanged.

Report HTTP, malformed-money and network failures use a reviewed localized
fallback and do not adopt a failed report. Existing request-generation guards
continue to suppress stale results. Existing group list/mutation failure behavior
is unchanged; this extraction does not add a new management error workflow.

Persian wording is provisional pending native terminology review. LOC-070/008/002
retain independent combined acceptance. Full RTL, calendar/numeral, browser,
output and production qualification remain open. Stripe remains unchanged.
