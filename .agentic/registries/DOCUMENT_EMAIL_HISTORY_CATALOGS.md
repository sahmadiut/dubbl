# Document email history catalogs

LOC-116 owns `components/dashboard/email-history.tsx` and the seven paired
`DocumentEmailHistory` messages. Known sent/failed statuses and unknown-status
fallbacks are display labels only. Relative timestamps use next-intl with the
presentation provider's locale and clock. Resend success, HTTP failure and network
failure use reviewed catalog fallbacks, never arbitrary server prose.

Recipient addresses and subjects are caller content and remain escaped and
unchanged. Email/document IDs, document type, organization header, API paths,
status values and POST method remain machine values. Existing
`list_document_emails` and `resend_document_email` MCP tools remain unchanged;
this slice changes no API, database, money, permission or email template contract.

Persian wording is provisional pending native review. LOC-071 retains combined
dashboard/document acceptance; LOC-117/118/119 own overview/widgets, workspace
and send controls respectively. LOC-009 owns authored public/email/PDF templates.
RTL, browser workflow and delivery-provider qualification remain independent.

Tests execute production JSX with real next-intl and PresentationProvider,
controlled state/IO, escaped hostile subjects, known/unknown statuses, loading,
relative time and real resend callbacks in success/HTTP/network scenarios.
