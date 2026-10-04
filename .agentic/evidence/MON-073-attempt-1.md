# MON-073 attempt 1 - exact approval condition contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator coding-assistant (Codex), D:/Projects/dubbl,
master, entry HEAD 87deba2, clean working tree. User instructed the next task and
commit/push after completion. Controller validate/status/context selected MON-073,
claimed with start --owner coding-assistant. Read root/nested instructions,
START_HERE/controller/project/map/backend role, task/parent, MON-011 dependency
evidence/review, ADR-006, manifest and source migration/API compatibility sections.
One task, no delegation. No schema, balance, currency flag or production change.

## Implementation and findings

- conditions.ts and wire.ts define strict described input schemas and supported
  header fields. Legacy monetary condition value was a string and remains one;
  additive valueMinor is canonical signed int64 minor units. Both must agree.
  Persist canonical value in existing JSONB and emit both strings. Six integer
  operators use bigint; text eq/neq stays literal, basis-point/ordinal headers
  retain their units. No FX/conversion/cents assumption. Missing/null fields do
  not match. Invalid active saved conditions fail closed before selection.
- service.ts and transaction.ts share scoped Drizzle workflow CRUD and request
  reads/actions. Workflow writes validate owned member UUIDs, use organization
  locks and atomically write workflow/steps/required audit. Serialized DTO/audit
  safety is checked before commit. Generic metadata actions lock organization
  and request, qualify workflow/requester/assignees/document, and atomically
  record action/status/audit. Terminal races commit one final action.
- Found a real MCP isolation defect: the previous generic approve/reject fallback
  called an unscoped engine lookup by request ID. Assigned-member checks could
  conceal this for most approvals, while comments lacked an MCP operation.
  Every new shared request path is scoped; generic engine itself requires ctx.
  Nested relation guards also reject foreign workflow/requester/action links.
  User profile relations now select only id/name/email/image, excluding the
  previously included password/session fields.
- engine.ts exact selection runs in the caller's invoice transaction. Invoice
  writers already lock organization; configuration writes use the same lock.
  New invoice requests start at the first saved step, preserving historical
  positive increasing orders with gaps. Used type/step assignments cannot be
  changed; identical editor step submissions are accepted without replacing
  history. Required=false still participates sequentially as before. Explicit
  replacement repairs malformed condition strings; unrelated patches fail.
- Five REST route files use safe response/JSON adapters and preserve existing
  envelopes/statuses. Ten registered MCP tools use strict described schemas,
  AuthContext, direct DB services and wrapTool. Added get_approval_workflow and
  comment_approval_request to cover existing REST operations. The existing
  index registration already includes approvals.ts; no registration gap.
- Bill and invoice actions retain their existing qualified lifecycle delegates,
  roles, locks, posting, status and audit behavior. Expense/journal/PO generic
  actions remain metadata only, with no new document posting/payroll semantics.
  History survives workflow/document soft deletion; new generic actions/internal
  requests require live documents. Internal creation helper validates and audits.
- The editor strips additive aliases before editing legacy value, sends incomplete
  conditions to validation instead of silently filtering them out, and explains
  monetary header fields/minor units and text operators. No browser UI claim.
- APPROVAL_WIRE_CONTRACTS.md records every operation, field, envelope, unit,
  range, correction and bound; updated manifest, money README, test matrix and
  reproducible MONEY_BOUNDARIES lexical inventory. No schema edits/migrations.

## Acceptance mapping

1. Registry documents all workflow CRUD/request read/action REST/MCP boundaries,
   string aliases, full-int64 threshold range, safe numeric document limits,
   typed header fields, defaults, pagination, errors and transaction semantics.
2. approval-contracts-worker.ts invokes every actual REST operation and all ten
   registered MCP SDK tools over linked InMemoryTransport. API keys/custom roles
   cover two tenants, spoofed organization header, owner/manager/viewer,
   expired/invalid auth, foreign IDs, assigned/non-assigned users and no-write
   SQL snapshots. Real REST/MCP invoice creation uses >int32 KWD amounts and
   exact approval conditions; generic reads expose compatible string aliases.
3. Pure/DB fixtures cover six operators/full-int64 edges, unsafe operands,
   malformed/partial/conflicting thresholds, unknown keys, unsupported text
   ordering, missing fields, invalid saved conditions and scoped references.
   Invalid invoice selection cannot consume numbering/write headers/lines/
   requests. Audit and step triggers prove rollback. Generic terminal races,
   step gaps, comments/rejections, identical editor steps, soft-delete history
   and assigned viewers are exercised. Existing invoice/bill suites qualify
   lifecycle delegation, locks, posting and rollback after the final changes.

## Verification

Commands ran from repository root with installed dependencies and ignored
generated Next/MDX sources. PostgreSQL18.6 initdb/pg_ctl created a unique synthetic
trust-auth temp cluster on 127.0.0.1:55473. Explicit synthetic TEST_DATABASE_URL
drives withDatabase's random dubbl_ci_* databases and applyCurrent's committed
migrations. No configured .env database was queried, migrated or reset; no
credentials printed/persisted. Temp cluster files remain outside the repository.

| Actual command/check | Result | Bounds |
|---|---|---|
| Controller validate/status/context/start | Valid 123-task graph, selected/claimed MON-073 | Structural only |
| npm test | 215/215 passed, exit 0 | Full unit run; final schema refinements subsequently covered by targeted suite |
| node --import tsx --test tests/approval-conditions.test.ts tests/integration/approval-contracts.test.ts tests/integration/invoice-writes.test.ts tests/integration/invoice-lifecycle.test.ts tests/integration/bill-lifecycle.test.ts | Final 7/7 passed, exit 0 | Three pure groups and four actual migrated PostgreSQL suites; SDK transport, no network dev server |
| npx tsc --noEmit | Final exit 0 | No full build, existing generated sources |
| npm run lint | Exit 0, zero errors/143 warnings | Full run before last bounded refinements; baseline reduced by removed legacy unused imports |
| npx eslint on all changed/new TS paths | Final exit 0, zero errors/one existing editor effect warning | All adopted source and fixtures; no new warning |
| money_inventory.py --write then without --write | Exit 0; 410 columns, 1559 paths, 1259 consumers, 24437 occurrences | Lexical queue, not dataflow proof |
| verify_money_inventory.mjs | Exit 0; columns/hashes/source lines verified | Source metadata only |
| verify_legacy_money.mjs | Exit 0; nine regression checks passed | Legacy import gate only |
| git diff --check | Exit 0 | LF/CRLF notices only |
| Disposable DB count / pg_ctl stop | Zero fixture databases, server stopped | Unique synthetic temp cluster only |

Exploratory failures were repaired: default db was not assignable to transaction
type; the optional selector now correctly accepts db or transaction. Adding invoice
fixtures made an expense-only list count assertion include another pending invoice;
the test now explicitly uses the entityType filter. An initial unused viewer-member
fixture warning was resolved by exercising its actual assigned-approver behavior.
Self-review found editor step replacement and soft-deleted-document history issues;
identical submitted steps preserve IDs, and history reads validate ownership while
allowing deleted documents. Final fixtures/typecheck/changed-file lint pass.

No build, dev server, Docker, browser/screenshot, genuine UI/session/network,
production DB/provider, deployment or IRR enablement occurred. Exact thresholds
support int64 independently of safe-number document amounts. Nonterminal retries
can approve a next step; no operation token is invented. Generic condition text
identifier values are literals, not dereferenced records. Multi-currency thresholds
use each document's own units; currencyCode filters are explicit, no conversion.
Generic opaque/export MON-034, historical remediation MON-033, combined MON-022,
full-domain int64 and independent accounting/security/migration/IRR gates remain.

## Review and handoff

Implementing-assistant self-review: MON-073-review-1.md; no invented peer/human
approval. No bounded-slice blocker. Check criteria, submit/review/done, validate/
status, then user-authorized commit/push and clean synchronized branch verification.
Stop after this task. Controller next expected MON-024; MON-022 combined criteria
remain unchanged and parent status is not silently closed.
