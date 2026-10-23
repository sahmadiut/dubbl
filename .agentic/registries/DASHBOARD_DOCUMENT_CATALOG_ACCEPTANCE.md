# Combined dashboard and document catalog acceptance

LOC-071 independently accepts LOC-116..119 together on current source. It does
not complete LOC-008 or LOC-002. No further product extraction was necessary.

## Reconciled source inventory

| Surface | Owned source and catalog coverage |
|---|---|
| Dashboard overview | `app/(dashboard)/dashboard/page.tsx`, loading route and `cash-flow-widget.tsx`; 99 DashboardOverview messages |
| Document workspace | `app/(dashboard)/documents/page.tsx` and loading route; 80 DocumentWorkspace messages |
| Email history | `components/dashboard/email-history.tsx`; seven DocumentEmailHistory messages |
| Shared send dialog | `components/dashboard/send-document-dialog.tsx`; 44 DocumentSend messages across five document kinds |
| Audit activity | `components/dashboard/activity-feed.tsx`; JournalActivity (3) and SettingsAudit (52) |
| Upload/attachments | `components/dashboard/file-uploader.tsx` and `receipt-attachments.tsx`; Upload (8) and ReceiptAttachments (6) |
| Shared display | `brand-loader.tsx`, `error-state.tsx`, `data-table.tsx`, `components/ui/search-input.tsx`; SharedUI (42) |
| Statistics | `components/dashboard/stat-card.tsx`; translated caller title/change values, exact preformatted value, geometry-only sparkline |

The inventory contains four routes and eleven shared surfaces, using nine
namespaces with 341 paired messages. Counts include each namespace once, including
existing shared keys that are also used elsewhere; they are not counts of newly
translated strings. Domain-owned send-launch controls remain in their existing
invoice/quote/credit-note/purchase-order/debit-note catalogs (LOC-007 acceptance).

Child inventories remain authoritative for their detailed extraction exceptions:
[history](DOCUMENT_EMAIL_HISTORY_CATALOGS.md),
[overview](DASHBOARD_OVERVIEW_CATALOGS.md),
[workspace](DOCUMENT_WORKSPACE_CATALOGS.md) and
[send](DOCUMENT_SEND_CATALOGS.md). Completed child evidence was not edited.

## Combined exceptions and preserved contracts

- The send dialog's entire payment selector and associated Stripe connection,
  reset and preview-payment behavior retain DEC-008 ownership. The five English
  JSX fragments are pinned explicitly by the combined source test; no broad
  English-word exemption is used.
- Email subjects, template fallback names, preview button props, public/email/PDF
  authored templates and existing template money/date formats retain LOC-009
  ownership. UI translation does not translate outbound template payloads.
- Caller names, descriptions, account names, file/folder names, email recipients,
  subjects, document/entry numbers and IDs are data, escaped by React in text and
  attribute rendering. Unknown audit action codes and entity identifiers retain
  the existing inspectable technical-data fallback (entity underscores become
  spaces); they are not newly authored prose or reviewed translations.
- Workspace example filenames Q1-Report.pdf, Team-Photo.jpg, Budget-2026.xlsx,
  illustrative file sizes, B/KB/MB, recipient@example.com and the missing-value
  dash are technical examples/units. Existing date-only text, chart week labels,
  compact en-US currency axis formatting, percentage geometry and count notation
  retain their documented behavior pending calendar/numeral/layout work.
- Saved currency, exact bigint monetary values and Minor aliases remain unchanged.
  Chart geometry uses numbers while tooltip/display carriers retain exact values.
  Organization headers/storage, URLs, query keys, HTTP methods, bodies, enum/status
  values, chart data keys, upload bytes, callbacks and authorization are preserved.
- ErrorState accepts caller messages; the dashboard supplies its finite translated
  errors. This acceptance does not assert arbitrary callers of the global shared
  primitive have been audited. Residual shared operations belong to LOC-008.

## Verification and limits

Combined source tests pin both route directories, all fifteen source files,
observed namespace set, copy exceptions, paired keys and Persian script. Real
production dashboard JSX composes actual ActivityFeed and CashFlowWidget through
one PresentationProvider; tests verify translated activity/forecast/errors,
unknown audit data escaping, exact KWD amounts, audit navigation and period action.
The document composition renders workspace, send, history and attachments with
the real nested uploader plus shared loader/error primitives in both locales.
Both loading routes render their actual localized loader. Child suites supply the
operation/negative-state matrix and transport-preservation assertions.

Existing migrated PostgreSQL suites exercise actual authenticated REST handlers,
linked registered MCP calls and independent SQL checks for dashboard data,
dashboard/report/delivery/budget integration and document/email/PDF rendering.
Fixtures create/drop random databases on an isolated loopback cluster; provider
email delivery is mocked. Existing MCP document-file/send/render/preview/history
surfaces are preserved, not extended or newly qualified in every operation.

Tests control hooks, IO, portals, charts and animation; they do not qualify mounted
effects, browser/keyboard/RTL layout, real SMTP/S3/provider delivery or all API
response envelopes. No product code, catalog, financial, auth, REST/MCP, schema,
migration, IRR flag or Stripe file changes are needed for this parent acceptance.
Persian wording remains provisional. LOC-008 residual shared-component acceptance,
LOC-002 whole-product acceptance, LOC-009 authored output and native terminology,
RTL/calendar/numeral, hosted-CI, deployment and release qualification remain open.
