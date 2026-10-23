# Document workspace catalogs

LOC-118 owns `app/(dashboard)/documents/page.tsx` and audits its loading route,
`components/dashboard/file-uploader.tsx` and `receipt-attachments.tsx`.
The workspace uses 80 paired DocumentWorkspace keys for titles, onboarding,
folders, upload/rename/visibility dialogs, file details, confirmations, filters,
sort labels, accessible icon actions, counts, notifications and finite errors.
Counts and upload titles use complete ICU plural messages. File/folder names
remain escaped caller data in rendering and confirmation interpolation.

The shared uploader already uses Upload and the attachment list already uses
ReceiptAttachments. Their existing paired catalogs and behavior are retained.
The route's BrandLoader already uses SharedUI; no duplicate loading key is added.

Explicit exceptions:

- Caller file/folder names, MIME/type metadata and IDs remain unchanged.
- Example filenames `Q1-Report.pdf`, `Team-Photo.jpg`, `Budget-2026.xlsx` and their
  illustrative size strings are literal file-format examples. The example folder
  labels and authored example summary are translated.
- `B`, `KB`, `MB`, file-size arithmetic, stored instants and existing browser date
  formatting remain unchanged. Locale/calendar/numeral and layout qualification
  belong to later work.
- URLs, query names, HTTP methods, organization storage/header keys, JSON fields,
  visibility values, filter/sort values, MIME strings and binary upload bodies are
  machine contracts. They remain untranslated.
- ReceiptAttachments' caught internal `Attachment request failed` diagnostic is
  never rendered; view/remove errors use its existing finite translated keys.

Untrusted server/network diagnostics no longer appear as workspace mutation
toasts. Only locally constructed AuthPresentationError messages or operation
fallbacks reach the toast. Existing REST routes and MCP registrations are
unchanged: `lib/mcp/tools/documents.ts` provides list_contact_files,
upload_contact_file, list_entity_files and attach_file_to_entity. This slice adds
no new user operation or REST/MCP/schema/auth/money behavior. It does not qualify
the backend, storage provider, or all existing document operations' MCP parity.

Tests execute production JSX with real next-intl/PresentationProvider and
controlled hook state/IO. Portal primitives expose children; motion is wrapped.
Coverage includes both locales, unsafe caller text escaping, empty/populated/
filtered states, upload and folder dialogs, preview states, icon labels, machine
values, mutation requests/failures, deletion confirmation callbacks, linked and
legacy uploads, shared attachment errors and optimistic removal rollback.
No DB fixture is needed for these presentation-only changes. Existing workspace
delete/upload transport response handling is preserved; these tests do not claim
general transport hardening.

Persian wording is provisional. Native terminology review, browser/keyboard/RTL,
calendar/numeral qualification, LOC-071 combined acceptance and higher parents
remain independent. No Stripe files or behavior are changed.
