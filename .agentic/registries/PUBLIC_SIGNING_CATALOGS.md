# Public signing catalog inventory - LOC-120

Owned source: app/sign/[token]/page.tsx and signature-canvas.tsx.
PublicSigning contains 23 paired English/Persian messages covering summaries,
signed/expired/declined states, unsafe invoice fallback, canvas controls,
submission success and failures. Persian is provisional pending native review.

Preserved exceptions: invoice numbers, frozen signer names/emails, contact names,
issue/due date strings and totalFormatted are caller/financial data. Existing
signedAt.toLocaleDateString() formatting remains unchanged; calendar/numeral/timezone
qualification belongs to later localization tasks. The previous-date fallback
and complete surrounding sentence are translated. Status enums, token, endpoint,
signatureDataUrl field, image MIME type, DOM classes and SVG paths are technical
contracts. The public 404 remains Next's shared notFound boundary.

HTTP submission failures deliberately show a reviewed generic localized message
instead of arbitrary backend prose. Network and JSON failures show retry guidance.
REST/MCP errors and provider messages remain machine output; no backend messages,
authorization, scope, money or signature behavior were modified. Existing signing
MCP operations remain covered by the integration suite; no new operation is added.

LOC-009 retains portal/payment, landing/help, email/PDF/document and background
inventory children LOC-121..124 and its independent combined acceptance. Stripe
is untouched under DEC-008. LOC-002 integration, native terminology, mounted
browser/canvas touch behavior, RTL and release qualification remain open.
