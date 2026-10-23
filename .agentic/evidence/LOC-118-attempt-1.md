# LOC-118 implementation evidence

Date: 2026-10-23. Operator: Codex. Base: c846d7f943ffee1d4e711665b3f71abd650ec1a1.
The checkout started clean on master. Changes were uncommitted when checked.

## Result and acceptance mapping

1. Extracted document workspace authored copy into 80 paired DocumentWorkspace
   keys. This covers document title, onboarding, example folder labels/summary,
   filters, controls, upload/folder/detail dialogs, named confirmations, success
   and finite error toasts, complete ICU count/plural messages and icon labels.
   Existing Upload, ReceiptAttachments and SharedUI loader catalogs were audited
   and retained. Explicit exceptions and ownership are recorded in
   [DOCUMENT_WORKSPACE_CATALOGS](../registries/DOCUMENT_WORKSPACE_CATALOGS.md).
2. Production JSX/callback tests run with real next-intl/PresentationProvider in
   both locales. Tests cover empty/populated/search/filter states, duplicate upload
   warning, preview/edit/loading states, escaped caller text, machine Select values,
   folder POST, metadata POST/binary PUT, rename/visibility PATCH, document/folder
   confirmation and DELETE callbacks, localized HTTP/network failures, linked and
   legacy shared uploads and attachment error/optimistic rollback behavior.
   Existing history/dashboard/catalog regressions also pass. See checks below.
3. Scope registry and task Handoff explicitly retain native Persian terminology,
   mounted browser/keyboard, RTL/calendar/numeral and LOC-071 parent acceptance.
   Persian wording is provisional. No parent is marked complete by this child.

## Contract review

Only the workspace page and paired messages change production code. Auth headers,
   organization key, IDs, REST paths, query/payload keys, visibility and sort/filter
   values, binary upload body, caller names, MIME metadata, saved dates and file-size
   arithmetic remain unchanged. Raw server/network diagnostics are suppressed in
   mutation toasts through locally constructed AuthPresentationError/fallbacks.
Existing MCP tools in lib/mcp/tools/documents.ts and their index registration were
inspected; no operation, REST route, MCP, schema, migration, money or Stripe change
is introduced. This does not qualify full existing document-operation MCP parity.
No database or S3 connection was used: fetch was replaced with deterministic
responses. Existing workspace upload/delete response handling was preserved;
general backend/transport qualification is outside this catalog slice.

## Verification

All commands ran in D:/Projects/dubbl.

| Check | Actual result |
|---|---|
| node --import tsx --test tests/document-workspace-catalogs.test.ts tests/document-email-history-catalogs.test.ts tests/dashboard-overview-catalogs.test.ts tests/message-catalogs.test.ts | Exit 0; 25 passed |
| pnpm i18n:check | Exit 0; 9,616 matching keys in each locale |
| pnpm typecheck | Exit 0; MDX generation and tsc --noEmit |
| pnpm exec eslint 'app/(dashboard)/documents/page.tsx' tests/document-workspace-catalogs.test.ts | Exit 0; no warnings/errors |
| pnpm lint | Exit 0; zero errors, 21 warnings in unchanged files |
| python .agentic/scripts/money_inventory.py --write | Exit 0; refreshed source hashes/occurrences and test inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 417 columns, 1,837 consumer hashes/occurrences |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks |
| git diff --check | Exit 0 |
| python .agentic/agent.py validate | Valid; 351 tasks |

Initial harness rendering exposed separate CJS/ESM next-intl context instances in
the nested SearchInput. Importing the real SearchInput and BrandLoader as ESM
resolved this; the completed regression run above passes. An initial inventory
check detected expected source drift before regeneration. A mistaken invocation
of absent check_legacy_money.py was corrected to the actual verifier above.
Inventory comparison shows only the page, two message files and new test consumer
changed. Persian-script assertions confirm every new Persian value contains
Persian text and no question-mark replacement sequence.

No full build, dev server, browser, hosted CI, deployment, provider or database
qualification was performed. Portal/motion wrappers and controlled hook state
are test limitations, not browser or end-to-end qualification.

## Review and handoff

Codex performed self-review; see LOC-118-review-1.md. No human/peer/native review
is claimed. Continue with controller selection after completing this task. Keep
LOC-071 and all higher integration/native/RTL acceptance independent.
