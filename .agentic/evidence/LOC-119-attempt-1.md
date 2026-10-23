# LOC-119 implementation evidence

Date: 2026-10-23 (Asia/Tehran). Operator: Codex. Repository: D:/Projects/dubbl.
Base: 8682adaf0e8bf550f15a3526ff1207d0e25f067c, master, clean entry tree.
Live controller selected LOC-119; only this task was started. User authorized
completion and push. Fetch confirmed HEAD/origin/master parity before commit.

## Acceptance mapping

1. Extracted 44 paired flat DocumentSend messages for the shared send dialog,
   covering all five document kinds, composition controls, previews and iframe
   titles, PDF attachment control, actions, notifications and finite failures.
   Related launch controls already use their domain catalogs. Scope, exceptions
   and ownership are in [DOCUMENT_SEND_CATALOGS](../registries/DOCUMENT_SEND_CATALOGS.md).
2. Production JSX runs through real next-intl/PresentationProvider in both
   locales. All five kinds preserve exact bigint amounts above the safe-number
   boundary, escaped caller text, send/mark/email/PDF preview requests, headers,
   payloads, attachment flags, English template props/subjects and callbacks.
   The operation matrix covers success, HTTP rejection and network failure.
   Preview loading/error/edit/back actions, unsafe money, missing email, field
   edits and loading-state cleanup have assertions. Catalog and existing
   workspace/history/dashboard/public/accounting/settings regressions pass.
3. Registry, catalog index, handoff and self-review retain provisional Persian,
   native terminology, mounted browser/keyboard/RTL/calendar/numeral and LOC-071
   combined acceptance. No parent acceptance is claimed.

## Contract and scope review

Only shared dialog presentation and paired catalogs change product code. Machine
document kinds, URLs, POST/header/storage keys, body fields, bodyless mark POST,
recipient/user content, preview PDF validation/blob handling and success callbacks
are retained. publicEmailMoney and template date formatting remain unchanged.
Raw HTTP send diagnostics are replaced with a finite translated fallback; caught
network failures in send/mark now use the same fallback and release loading flags.
The entire payment selector, Stripe effects, reset and preview-button code were
compared with HEAD and are unchanged. No dedicated Stripe work was performed.

Existing send registrations in invoice-lifecycle.ts, quotes.ts, credit-notes.ts,
debit-notes.ts and purchase-orders.ts were inspected, as were email.ts and
document-rendering.ts (send_document_email, list_document_emails,
resend_document_email and preview_document_email). This catalog slice adds no
operation or REST/MCP/auth/schema/migration/financial contract. It does not
qualify backend email delivery or all existing operation parity. Email subjects,
templates and template preview labels retain LOC-009 ownership. Credit/debit-note
recognition is not evidence of email delivery.

No DB fixture or real provider call was required: tests replace fetch and control
hooks; portal UI wrappers expose children. Effect lifecycle, browser layout and
keyboard behavior are not established by these tests.

## Verification

All commands ran in D:/Projects/dubbl.

| Command | Actual result |
|---|---|
| node --import tsx --test tests/document-send-catalogs.test.ts tests/document-email-history-catalogs.test.ts tests/document-workspace-catalogs.test.ts tests/dashboard-overview-catalogs.test.ts tests/message-catalogs.test.ts tests/public-ui.test.ts tests/accounting-sales-purchasing-catalog-integration.test.ts tests/settings-catalogs.test.ts | Exit 0; 45 tests passed |
| pnpm i18n:check | Exit 0; 9,660 matching keys per locale |
| pnpm typecheck | Exit 0; MDX generation and tsc --noEmit |
| pnpm exec eslint components/dashboard/send-document-dialog.tsx tests/document-send-catalogs.test.ts | Exit 0; zero errors/warnings |
| pnpm lint | Exit 0; zero errors, 21 warnings in unchanged files |
| python .agentic/scripts/money_inventory.py --write | Exit 0; refreshed owned hashes/occurrences and test inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 417 columns, 1,838 consumer hashes/occurrences |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks |
| git diff --check | Exit 0 |
| python .agentic/agent.py validate | Valid; 351 tasks |

The initial Persian write through PowerShell stdin lost Unicode; Persian-script
assertions caught it. The catalog was rewritten through apply_patch and every
new Persian leaf now passes script and replacement-character checks. Initial
typecheck also exposed existing catalog consumers' flat-namespace assumption;
flattening the new keys fixed the mismatch without changing unrelated tests.
Inventory comparison limits changed consumers to the send dialog, paired
messages and owned test, plus its scanned-path addition. No column classification
or money implementation changes are introduced.

No full build, dev server, database/provider, hosted-CI, deployment or production
qualification was run. No human, native or independent peer review is claimed.

## Handoff

See LOC-119-review-1.md for Codex self-review. After completion and scoped push,
stop and report the next controller task. Keep LOC-071 and higher acceptance
independent; email/PDF authored output remains LOC-009 work.
