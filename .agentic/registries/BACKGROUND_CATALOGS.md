# Background and residual message catalogs

LOC-124 owns 61 paired `Background` messages and `i18n/background.ts`.
The internal translator accepts an explicit locale and defaults to en-US, matching
the output extraction contract. Existing workers, REST and MCP delivery paths
continue using English. No recipient-language inference or delivery activation is
introduced; historical saved notification titles/bodies are never rewritten.

## Source inventory and ownership

| Surface | Treatment |
|---|---|
| `trigger/scheduled.ts` | Dispatches services only. Task IDs, cron/retry policy, worker result keys and console diagnostics remain machine/operator contracts. The Stripe retry entry is untouched under DEC-008. |
| `lib/notifications/send.ts`, `digest-processor.ts` | Extract immediate/digest subjects, fallback greeting and relative-time captions. Existing preferences, queues, timestamps, URLs, type values and delivery behavior remain intact. The digest component/layout is LOC-123 `Output` ownership. |
| `lib/api/budget-alerts.ts`, `budget-alert-wire.ts` | Extract generated title/body. Names and period labels remain caller data; formatted exact monetary strings and threshold digits are interpolated without numeric conversion. Evaluation, preflight, transactions and deduplication retain their contracts. |
| `lib/api/bank-balance-alerts.ts` | Extract generated title/body. Saved currency code, exact balance/threshold decimal strings and account name remain data. Organization scope, daily deduplication and delivery preferences remain intact. |
| `lib/reports/schedule-processor.ts` | Extract subject, HTML heading/body and finite frequency captions. Shared helper escapes all HTML text after translation. Saved report name, format, attachment, recipients and schedule metadata remain unchanged. |
| `lib/api/recurring-invoice-generate.ts`, `remittance.ts` | Extract generated delivery subjects and remittance HTML labels. Document numbers, organization names and preformatted money remain data. Existing document email/template content is delegated to LOC-123. |
| `lib/api/contact-statement-delivery.ts` | Extract print/email headings, finite type captions, columns, totals, period/generated copy and subject. Renderers retain English and Gregorian/UTC date formatting pending output qualification. Transaction descriptions, references and exact balances remain unchanged. |
| `lib/reports/statement-export.ts` | Extract fallback amount header, code/account captions, subtotals, total and fallback sheet name. Retain English for XLSX compatibility and existing Helvetica PDF limitations; worksheet keys, custom headings and financial formatting are preserved. |
| `lib/email/reminder-processor.ts`, `template-engine.ts` | Saved rule subjects/bodies and `{{variable}}` identifiers are caller templates. Do not translate or overwrite them. SMTP errors and delivery-log statuses remain diagnostics. |
| Other `lib/api`, `app/api`, `lib/mcp` | AuthError/Zod/wire/period-lock/provider errors, response envelopes, success messages, enums, identifiers and tool descriptions remain existing English machine contracts. Dashboard consumers use their catalog-owned reviewed fallbacks (`i18n/*-errors.ts`, `*-presentation.ts` and module components); raw API diagnostic translation is not introduced. Public signing/portal errors are LOC-120/121 ownership. |
| `contact-statements.ts`, report producers, snapshot/seed helpers | Generated ledger descriptions, row labels returned by machine report APIs, saved identity fallbacks, demo fixtures and report payload headings remain data/contracts. Display adapters and LOC-123 renderers own finite visible captions; stored history is not repriced or translated. |
| Backup/bookkeeping/invoicing/trash maintenance, currency sync/revaluation | Service results, audit metadata and failure logs are machine/operator diagnostics. Their notification/email display paths delegate to the owners above. No independent display template lives in the Trigger dispatcher. |
| Provider/auth/SMTP/Resend/webhook/Stripe paths | Preserve error strings, protocol headers, provider payloads and diagnostics. Stripe is expressly frozen; no dedicated provider work is performed. Auth/admin/invitation email chrome is already `Output` ownership. |

Names, arbitrary user content, routes/URLs, document IDs, machine dates, ISO
currency codes, statutory acronyms, attachment filenames/content types, report
format values and branding are not translation keys. Currency formatting, money
storage, financial readiness and IRR activation flags are unchanged.

## Verification and limits

`tests/background-catalogs.test.ts` checks paired keys, Persian script, English
copy compatibility, digest relative-time boundaries/pluralization, actual React
Email rendering in both locales, caller-data escaping, exact monetary text and
scheduled report output. Existing migrated REST/registered MCP/SQL suites cover
alert generation/deduplication, statements, recurring invoices and report delivery.

Persian wording is provisional. Recipient locale selection, native linguistic
review, browser/email-client behavior, mixed-direction layout, Persian PDF
font/shaping, calendar/numeral qualification and production delivery remain later
L10N/RTL/release work. LOC-009 and LOC-002 require independent acceptance.
