# MON-070 attempt 1 - exact organization settings contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator coding-assistant. Entry HEAD ab70fa8 on master
tracking origin/master; clean working tree. User requested the next task, then
commit and push after full completion. Controller validate/status/context selected
MON-022. Actual source inspection found independent organization/mileage,
tax-rate/component/profile, tax-period filing/settlement and approval-condition
workflows. Split per controller into MON-070 through MON-073 with MON-011
prerequisites and priority 0. MON-022 remains blocked with its original three
acceptance criteria unchanged and all children as dependencies. No scope waiver.
MON-070 is the bounded implemented task; tax/approval completion is not claimed.

Read root and nested instructions, START_HERE, controller/project/repository map,
MON-011 attempt/self-review, ADR-006, source migration/API compatibility sections,
money manifest, actual schemas/routes/tools/UI and neighboring qualified services.
No build/dev server/schema edit/production action. Self-review, not independent
accounting/security/human approval.

## Implementation

- organization-wire.ts defines strict described partial settings and mileage
  input schemas, exact aliases and response guards. Numeric mileageRate and
  billApprovalThreshold retain nonnegative safe minor-unit integers/null; added
  canonical *Minor aliases preserve values without scale conversion. Saved null
  stays null in the organization DTO; mileage endpoint preserves its 67 fallback
  and adds matching string plus currencyCode. No threshold writer or policy added.
- Mileage accepts numeric/exact/agreeing dual values, nonnegative and at most
  9007199254740991. Malformed/negative/fractional/noncanonical/localized/oversized
  inputs and alias conflicts fail validation; valid above-safe int64 fails 422
  LEGACY_NUMERIC_RANGE before writes. Saved unsafe money/currency fails visibly;
  the existing ORM rejects unsafe bigint text before Number decode.
- organization-settings.ts shares direct Drizzle operations across REST/MCP,
  loads only live scoped rows, locks organization settings for partial updates,
  validates the complete candidate/response and writes audit in the transaction.
  An audit fault cannot commit settings. Requests record actual actor/org/IP/UA.
  Currency changes retain journal-activity gate (including drafts/deleted history)
  and functional IRR gate, without converting saved values.
- Organization GET handles dk_ API keys without requiring an org header; key
  context wins over spoofed headers. Session list maps only live membership orgs,
  retaining role/memberCount. POST keeps session/site/plan/slug policy, validates
  DTO and audits within org/member/subscription provisioning. Outbound org-created
  email is preserved and stubbed in fixtures. PATCH shares settings service.
- Five strict registered SDK tools cover get/update settings, set currency and
  get/update mileage. Existing index registration is reused; all use wrapTool.
  MCP defaults/omitted fields cannot reset settings; every field is described.
  Functional-currency gate validation occurs in wrapTool rather than an SDK
  transformation throwing outside the classified error boundary.
- Fiscal start is integer 1..12; nullable text semantics/onboarding permission
  exception remain. Merged country/business type validation closes partial-update
  bypass. Settings UI already submits PEPPOL fields: shared schema now persists
  them rather than stripping/rejecting them. Strict unknown fields reject false
  successful money/tenant updates. No percentage/quantity/FX money aliases added.
- First-country account and tax-profile seeding keeps its existing idempotent
  post-settings-commit behavior; tax seeding remains best-effort. This task does
  not claim atomic seed rollback/race qualification. No ledger posting/period
  lock is introduced for settings; claims/journals retain separate posting guards.
- Added ORGANIZATION_WIRE_CONTRACTS, public settings documentation, manifest,
  test matrix and source/task-index split traceability; refreshed money inventory.

## Acceptance mapping

1. Registry operation table covers organization GET/list/POST/PATCH, currency and
   mileage REST/MCP, input/output envelopes, units, permissions, ranges, nulls,
   aliases and errors. Global site-admin org/subscription/opaque boundaries remain
   MON-028/MON-034; tax and approval children remain open. Organization settings
   have no historical currency snapshot, and no such interpretation is inferred.
2. Four pure groups and migrated SQL worker invoke exported REST handlers, all
   five actual SDK registered MCP tools and registerAllTools. Numeric/exact/dual
   clients cover safe maximum, above-int32 amounts and USD/JPY/KWD/IRR integer
   1250 without rescaling. Real key hashing/membership/custom permissions, expired
   and invalid keys, spoofed header scope, missing/deleted orgs and role failures
   are asserted. Session-list/create identity and outbound email are explicitly
   stubbed; memberships/plan/slug/provisioning/audit run against actual PostgreSQL.
3. SQL-text business/audit snapshots prove rejection without committed mutation
   for malformed JSON/aliases/unknown fields/ranges, saved unsafe values, invalid
   merged country/type, missing/deleted contexts, history/IRR gates and real
   audit-fault constraints. Settings and provisioning roll back on audit faults.
   Partial REST/MCP concurrent updates retain both fields, PEPPOL persists and
   clears without resetting omitted values, onboarding requires only view:data
   when alone, currency changes preserve threshold/mileage integers, and null
   fallback/Date JSON/legacy numeric shape remain explicit. Adjacent expense
   CRUD/lifecycle regressions cover qualified claim monetary consumers.

## Verification

Commands ran in D:/Projects/dubbl. Synthetic PostgreSQL18 cluster at
D:/Temp/dubbl-mon070-pg-8f30465893f4441db233d119020e0b17/data, loopback port 55480,
trust auth for fixtures only. Explicit synthetic TEST_DATABASE_URL creates,
migrates and drops randomly named isolated databases. No .env database reset,
provider requests or real customer data. Final fixture database count 0; fast/wait
server shutdown succeeded, temporary path note removed. Cluster remains outside
the repository. Secrets were neither opened nor recorded.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start and split validate | Exit 0; valid 123-task graph | Structure is not implementation proof |
| Final focused --test-concurrency=2: organization-wire, currency-rollout, integration organization-settings, expense-crud, expense-lifecycle | Exit 0; 13/13 checks, none skipped | Three migrated disposable PostgreSQL suites; session/email fixture boundaries |
| Final node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 206/206 pass, none skipped | Pure/transport units, not all domain integration |
| Final npx tsc --noEmit | Exit 0 | Existing generated sources; no build |
| Final npm run lint | Exit 0; 0 errors/148 existing warnings | Baseline warning count retained |
| Changed-source initial npx eslint | Exit 0; clean | Full final lint covers later refinements |
| money_inventory.py --write, then without --write | Exit 0; 410 columns, 1537 scanned files, 1241 consumers, 24336 occurrences | Lexical inventory, not full dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; source hashes/lines and Drizzle columns match | No financial runtime qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Legacy import lint gate |
| Source git diff --check | Exit 0 | LF/CRLF notices only |
| git fetch origin; HEAD...origin/master count | Exit 0; 0 ahead/0 behind before task commit | Remote checked before authorized push |

Intermediate corrections: synchronous Node module hooks conflicted with tsx;
fixture now uses async module.register loader hooks supported by the declared
runtime. A fixture journal's entryNumber was initially a string; corrected to
the actual integer schema, final typecheck passes. SDK shape registration stripped
unknown tenant fields; strict registerTool schemas now reject them, preserving
snapshot assertions. Existing currency-rollout unit used a tool-only mock server;
updated its registration adapter to registerTool, leaving rollout/permission
assertions intact; full 206 final units pass. UI review found PEPPOL inputs and
added persistence plus positive/null/omission fixtures. No assertions were
weakened to permit unsafe precision, tenant writes or missing audit.

## Review and handoff

See MON-070-review-1.md for actual implementing-assistant self-review. No bounded
task blocker remains. Complete controller check/submit/self-review/done and final
validate/status; commit/push as the user authorized, then stop. Next MON-071 tax
rate/profile contracts. MON-022 retains combined acceptance; full-int64/historical
remediation/currency snapshots/global admin/tax filing/approval and independent
accounting/security/session/provider/PostgreSQL16/IRR production gates remain
separate. No approval for those gates is inferred.
