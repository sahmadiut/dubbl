# MON-123 review 1

2026-10-08, Asia/Tehran. Reviewer: codex; kind: self. Actual diff/source inspection
and verification from MON-123-attempt-1.md; no separate agent/human/accountant.

Approved the bounded budget-notification slice against all three criteria.

- REST and registered MCP share permission/tenant/input checks and one exact DB
  service. Numeric amount/percent compatibility and internal scheduled count shape
  are retained; new outputs pair only actual monetary fields with exact aliases.
  Threshold controls are described, explicit, int32 nonnegative and nullable.
- Net activity retains the existing absolute policy; text SUM/bigint subtraction
  and exact percent rounding preserve safe-max tie cases and cancellation.
  Currency formatting uses organization metadata without reconverting base GL or
  silently rescaling stored budget units. Every evaluation/payload is validated
  before inserts, including history already deduplicated or unable to alert.
- Org-owned live account/fiscal relationships and posted non-deleted org GL are
  enforced. Calendar scope is inclusive UTC; explicit periods retain their allowed
  independent dates. Negative/zero budget amounts remain non-alerting.
- Shared transaction advisory lock and post-lock READ COMMITTED reads avoid
  concurrent replay duplicates. Per-recipient deduplication fixes incomplete and
  newly added recipients while retaining read/deleted notification history.
  Second-recipient failure rolls back all in-app rows; digest/email runs only after
  commit. Delivery failure cannot erase notification rows or miscount retries.
- Fixtures invoke actual API-key routes, linked SDK MCP tools and scheduler core,
  covering monetary limits, permissions/isolation, bad history, concurrency,
  unchanged financial snapshots and digest behavior. Generic sendNotification
  return behavior and the two existing budget regression suites remain intact.

During implementation, removed an unnecessary schema import cycle and corrected
the existing CRUD mock/SDK registration count for the new operation. Removed an
unused fixture import found by lint; final lint has 0 errors/109 existing warnings.
Final fixtures/static and money gates pass. No unresolved review findings within
MON-123. No schema/migration or build/dev/provider/IRR flag work occurred.

Limits: this is self-review only. Optional delivery has no durable retry/outbox;
global locking/high volume, live Trigger, concurrent budget edits, PostgreSQL 16,
parent integration and independent accounting/production qualification remain
outside the task. These limits are documented rather than claimed complete.
