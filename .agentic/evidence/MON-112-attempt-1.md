# MON-112 attempt 1 — exact contact statements and delivery

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry HEAD
`6ca087fbf29bcaa42e48613b6a509f7f0c874653`, master, clean working tree.
Controller validate/status/next/context selected MON-112; started with owner codex.
One bounded child task; MON-102 retains integration acceptance. Review is self only.

## Implementation

- Shared `lib/api/contact-statements.ts` implements general and AP supplier
  statements using scoped undeleted contact projections and repeatable-read,
  read-only snapshots. Bigint opening/running/period totals gain canonical Minor
  strings alongside unchanged integer numeric currency minor units. Original
  totals minus dated cash replace today's amountDue minus historical payments
  in general opening balances, fixing double counting without stored data changes.
- Shared `contact-activity.ts` retains draft/activity selection, type filters,
  exclusive timestamp pagination, and adds amountMinor. Contact ownership and
  read permission now validate on all boundaries; unsupported dates/currencies/
  money fail with classified errors. Mixed statement currencies require a filter.
- `contact-statement-wire.ts` supplies described strict fields: real inclusive
  Gregorian dates, UTC defaults/leap clamp, supported currency, UUID, bounded
  integer pagination, ISO cursor, valid activity types, unknown/duplicate guards.
- Five contact REST routes delegate to these services. Print retains existing HTML
  and Print / Save PDF behavior; email retains its layout and saved recipient/SMTP
  config. `contact-statement-delivery.ts` shares preflight and exact currency-scale
  formatting, escapes all interpolated user/organization text, and requires both
  manage:contacts and view:data before email. Malformed JSON is a 400.
- New `lib/mcp/tools/contact-statements.ts` registers five one-operation tools in
  index.ts. The existing get_purchasing_supplier_statement name and {statement}
  envelope remain; its registration moves from purchasing.ts. Removed obsolete
  supplier-statement.ts. Public token/portal statements remain their public owner.
- Added the boundary registry, manifest summary and refreshed MONEY_BOUNDARIES.
  See [CONTACT_STATEMENT_WIRE_CONTRACTS](../registries/CONTACT_STATEMENT_WIRE_CONTRACTS.md)
  for inputs, units, aliases, ranges, roles, behavior, errors and limitations.

No schema edits, migrations added, historical rescaling, production IRR flag,
provider configuration or deployment change.

## Acceptance mapping

1. The boundary registry maps every route/tool and enclosing output, preserving
   supplier AP signs and envelope. Every monetary field has simultaneous numeric
   and canonical integer-string representations with safe bounds
   +/-9007199254740991. Currency display uses its metadata; no FX/rescaling.
2. `tests/integration/contact-statement.test.ts` invokes actual API-key handlers,
   registered MCP SDK clients and migrated PostgreSQL. Both legacy decimal-price
   and exact minor-string invoice writers feed the report. Assertions cover both
   statement conventions, notes/carriers, opening double-count correction,
   activity/quote/draft/pagination, auth/custom-role/tenant/foreign/deleted/UUID
   failures, printable HTML and recorded email parity. USD/IRR/JPY/KWD display
   and filtered totals preserve integers. MCP email tenant/permission negatives
   and non-supplier errors are exercised explicitly.
3. Pure input groups reject invalid dates, reversed windows, unsupported currency,
   malformed cursor/type/limit, duplicate/unknown query fields and unsafe ranges.
   Actual boundaries reject malformed JSON, mixed currency, unsafe stored int64
   and result overflow before any delivery. Bigint intermediate cancellation and
   safe positive/negative endpoints are asserted. Financial/audit/config snapshots
   remain unchanged on reads/errors and recorded SMTP calls do not increase on
   preflight failures. API-key lastUsedAt auth bookkeeping is excluded separately.

## Fixture and verification

All commands ran in D:/Projects/dubbl. Task-created PostgreSQL 18 cluster bound
only to 127.0.0.1:55512 with synthetic fixture role and UTC timezone. Explicit
TEST_DATABASE_URL selects that server. Harness creates/migrates/drops random
dubbl_ci_ databases; configured application DB was not used. Nodemailer transport
was recorded in memory; no real email/provider call. Cluster stopped afterward.

| Actual command/check | Result | Limitation |
|---|---|---|
| Controller validate/status/next/context/start | Exit 0, 173 structurally valid tasks | Not financial qualification |
| node --import tsx --test tests/contact-statement-wire.test.ts tests/integration/contact-statement.test.ts | Exit 0, 4/4, no skips, final run including extra MCP email negatives | Disposable migrated DB and recorded SMTP |
| node --import tsx --test --test-concurrency=1 tests/contact-statement-wire.test.ts tests/integration/contact-statement.test.ts tests/integration/contact-wire.test.ts tests/integration/aging.test.ts | Exit 0, 6/6, no skips | Contact and aging regressions; preceded extra email negative assertions |
| pnpm test | Exit 0, 333/333 | Pure/unit suite |
| pnpm typecheck | Exit 0 | No build, existing generated sources |
| pnpm exec eslint on all 15 changed TS files | Exit 0, no warnings/errors | Final worker-only lint also passed after extra assertions |
| pnpm lint | Exit 0, 0 errors, 120 warnings in unchanged files | Existing unrelated warnings retained |
| python .agentic/scripts/money_inventory.py --write and without --write | Exit 0; 415 columns, 1797 scanned files, 1355 consumers, 25871 occurrences | Lexical inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 Drizzle columns, 1355 source hashes/occurrence lines | Final regeneration after last worker additions also verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Legacy helper gate |
| git diff --check and git diff --cached --check | Exit 0 | Git line-ending notices only |

Initial inventory regeneration found the removed supplier service still listed by
Git's cached file enumeration. Staged only that task-owned deletion, regenerated
and cross-checked successfully; no inventory script change. Self-review also
corrected a comment encoding change and updated the purchasing scope comment.
No full build, dev server, Docker, live SMTP/provider or deployment was run.

## Review and handoff

See [MON-112-review-1](MON-112-review-1.md) for the actual self-review. No bounded
task blocker remains. Controller completion follows this evidence; commit/push is
explicitly authorized by the user's complete-and-push request. MON-102 retains
combined integration, public portal remains its existing owner, and full-range,
performance, independent accounting and production IRR gates remain separate.
