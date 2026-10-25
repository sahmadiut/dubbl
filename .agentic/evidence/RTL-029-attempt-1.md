# RTL-029 - email and document bidirectional presentation

## Identity and boundary

Task RTL-029, 2026-10-25, Codex (`codex-batch02-task2`). Selected by current controller from clean master at `8d009f8c7f6fc3cf1bed76f709d8267262ed03fe`. This is the second controller task of the owner's two-commit push batch. The preceding RTL-028 commit is retained. Parent RTL-011/008/002 have independent combined acceptance. No human, native linguistic or accounting acceptance is asserted.

## Exhaustive assigned ownership and consuming builders

| Owned census entry | Audit and result |
|---|---|
| `lib/email/templates/layout.tsx` | Existing explicit root language/direction retained. Shared email-local inline isolated span preserves raw React text with auto or technical LTR direction. Locale-selected physical padding fallback mirrors logo gap in email clients without logical CSS. Body alignment follows locale; arbitrary tokens can wrap. Brand and unchanged legal identity/address use explicit LTR. Table/presentation semantics, URLs, image alt and unsubscribe condition are retained. |
| `lib/email/templates/document-sent.tsx` | Isolates organization names in translated heading/footer, raw document ID, already-formatted money/dates, personal message and custom CTA label. Metadata gutter mirrors with locale and cells align at top. View URL, type fallback, amount/date visibility, amount scale and caller formatting are unchanged. |
| `lib/email/templates/login-alert.tsx` | Rich isolated caller greeting; IP/auth provider explicit LTR and browser/timestamp auto scopes. Detail-label gutter mirrors with locale, long technical text wraps without unconditional break-all. Raw timestamp/default behavior and security URL retained. |
| `lib/email/templates/member-invite.tsx` | Rich isolated inviter/org/role fragments preserve strong emphasis, custom role text, info values and invite link. No role normalization or permission change. |
| `lib/email/templates/notification-digest.tsx` | Isolates greeting/org and persisted notification title/body/time. Keeps nine-item truncation, order, type/color keys, count/plural rules, links and unsubscribe. |
| `lib/email/templates/org-created.tsx` | Rich isolated organization/name fragments; existing table-based step geometry remains symmetric and inherited root direction provides reading order. Static labels and CTA preserved. |
| `lib/email/templates/welcome.tsx` | Rich isolated caller in greeting. Existing table feature sequence, layout and CTA preserved. |
| `lib/documents/pdf-renderer.tsx` | Audited real React-PDF/Yoga output, its Helvetica/English default and physical page/numeric geometry. Metadata value shrinks in its row, line descriptions have bounded flex width/gutter, footer text and wrapping group are bounded. Existing public renderer signature, labels, country-tax labels, money calculation, date visibility, template substitution and PDF bytes response retained. Native Persian font/shaping/direction remains unqualified, detailed below. |

Imported `lib/documents/pdf-generator.ts` belongs to this consuming output slice: both invoice and generic five-kind HTML builders now escape and isolate raw identifier/date/money/caller fields, use logical table alignment/gutters, wrap party/footer rows and bound party columns. Dynamic document numbers in plain HTML title are escaped without inline markup. Default note/bank/instruction text keeps placeholder resolution and is isolated after escaping. Caller-provided rich header/footer markup is retained as authored; inserting spans into arbitrary attribute contexts would alter its existing contract. `lib/email/render-document-email.ts`, `lib/documents/render-service.ts`, `render-wire.ts` and saved snapshot selection were audited and unchanged.

Paired Output catalog values only add existing approved `em` structural tags around their original arguments. Matching rich callbacks produce isolated inline values; ordinary preheader preview keys remain plain text. Key/argument inventory remains 10,723. No Unicode directional controls are injected, no persisted value is translated/trimmed, and existing English/Persian wording is retained.

## Acceptance mapping

1. All eight assigned entries and imported builders are accounted for above. Actual output tests retain caller punctuation/escaping, custom templates/links, five document kinds, due-date suppression, four currency scales, signed quantities, safe-integer limits and unchanged input objects.
2. Runtime-generated email markup contains self-contained inline isolation, mirrored fallback gutters and wrapping; HTML builders emit native bdi scopes and logical/wrapping layout. Installed React Email and React-PDF renderers execute. No Tailwind/CSS-utility assertion is substituted for email styles. Legacy PDF layout adjustments pass actual binary generation without claiming visual/native qualification.
3. Output/technical/provider exceptions and the qualification limits below are explicit. No parent/global acceptance is closed by this child.

## Actual verification

All commands ran in `D:/Projects/dubbl` against code/local synthetic fixtures, with no application database access.

| Command | Result |
|---|---|
| `node --import tsx --test --test-concurrency=1 tests/rtl-output.test.ts tests/output-catalogs.test.ts tests/document-render-wire.test.ts` | Exit 0, 18/18 pass, no skips/cancellations. Actual en/fa email rendering and rich values, exact technical values/links, generic/invoice HTML, all five kinds and USD/IRR/JPY/KWD, safe-int and signed physical hundredths, actual `%PDF-` binary generation. |
| `pnpm typecheck` | Exit 0; generated MDX then TypeScript including the new regression file. |
| `pnpm exec eslint lib/email/templates lib/documents/pdf-generator.ts lib/documents/pdf-renderer.tsx tests/rtl-output.test.ts tests/output-catalogs.test.ts` | Exit 0, no warnings/errors. |
| `pnpm lint` | Exit 0; zero errors, 20 existing warnings outside this task's changes. |
| `pnpm i18n:check` | Exit 0; 10,723 paired English/Persian keys and matching structural arguments. |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 classified schema columns, 2,506 source files, 1,887 consumer files. Generated fingerprints/occurrences updated for changed presentation/test sources. |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 417 columns, 1,887 hashes and source occurrences verified. |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; all nine checks pass. |
| `git diff --check` | Exit 0; no whitespace errors. Existing Windows newline-conversion notices are not lint errors. |
| `python .agentic/agent.py validate` | Structural task validation passed at selection; final completion validation is recorded by controller after this evidence is written. |

Existing invite fixture was updated to inspect strong emphasis containing the new isolated span. No product regression was hidden by changing numeric expectations. The new tests assert no injected directional-control characters and exact unmodified input data. No REST/MCP/storage/schema/migration, dependency, provider or financial logic change.

## Qualification limits and exceptions

- Email markup is rendered with installed production React Email; Outlook/Gmail/Apple Mail visual behavior, old-client support of auto direction/isolate/overflow-wrap, narrow width/zoom/text spacing, assistive technology and native Persian terminology have not been manually qualified. Root direction, explicit technical fallback and real inline styles are evidence of implementation, not a client-matrix pass.
- HTML documents are runtime strings with native bidi scopes and logical CSS. No browser or print-engine layout/PDF conversion run was performed. Custom rich header/footer markup remains caller-owned and may carry its own physical styling. Existing delivery and presentation-locale resolution remain unchanged; background callers still default explicitly to English.
- The legacy React-PDF path remains English labels and Helvetica. Its standard font does not establish Persian glyph coverage, shaping or mixed-script native readability, and no fake HTML `dir` attribute or unverified font conversion was added. Real binary generation passes; no extracted-text, visual pagination, Persian shaping, financial signoff or physical-printer qualification is claimed. RTL-011/008/002 must independently handle this known native-output limitation and any further output qualification.
- Saved issued-party snapshots and canonical document DTO selection are unchanged. Generated display markup changes for a newly requested render, while no historical stored snapshot/ledger value is rewritten. Money formatting stays the existing exact wire formatter with unchanged scale/rounding.
- Machine CSV/JSON exports, routes/IDs/REST/MCP schemas and content-type/filename conventions remain unchanged. No new user business operation needs an MCP tool.
- Stripe functionality/files are unchanged under DEC-008. No dedicated Stripe/provider work, dev startup, full build, database write, live message delivery, hosted CI wait, deployment or IRR activation occurred.

## Review and handoff

Codex self-review is honestly attributed in `RTL-029-review-1.md`, permitted for `human_review=false`. The owner requested a concurrent separate dashboard appearance repair while this task was finishing; dashboard files are excluded and any concurrent dirty paths must be preserved and reported. Commit only this task's reviewed files, then push it together with preceding RTL-028 per the owner's batch authorization. Parent acceptance and native/browser/output/accounting qualification remain open. The controller computes the next task after completion.
