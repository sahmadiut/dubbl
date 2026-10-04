# MON-057 self-review 1

2026-10-04, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review only; no independent peer/human/accounting or deployment approval.

Approved within documented bounded reversal adoption. Inspected REST and registered
MCP callbacks, saved journal/balance helpers, credit/debit note void interaction,
fixtures, wire docs and inventory. Shared direct-DB operation preserves the success
envelope, minor units, numeric-safe aliases and saved FX without current rate lookup.
Inputs have no money fields, so legacy/exact clients use the same UUID operation.

Scoped locked reads and active allocation equality prevent foreign/orphaned or
annotation-only balances from becoming successful reversals. Exact subtraction
never clamps; document/note/prepayment balance restoration is symmetric. Cash
and application journal source/date/currency/account/dimension/FX/balance guards
prevent ambiguous history from being repaired silently. Every reversal copies
saved metadata and flips legs exactly; originals, note recognition, deposit GL,
allocation history and bank balances are preserved. Final audit JSON is checked
and inserted within the same transaction as all money/link/tombstone changes.

Review found soft-deleted carriers still counted by existing note voids. Both
queries now join live payment rows; repeated apply/void fixtures verify restoration
and history retention. Added legacy null sourceId, arbitrary-order rounded zero
control reversal, safe-max, journal-number exhaustion, foreign dimension/document,
quarantined FX and noncash final-audit failure tests. Tightened payment journal
currency and legacy document recognition reference checks. These refinements have
final affected lint, typecheck and actual six-worker PostgreSQL verification.

Missing/foreign/deleted primary IDs, custom roles, strict locks, provider/statement
links and corrupt stored values fail visibly without committed business changes.
Bank/provider references are rejected for appropriate unmatch/refund flow; no
external refund is attempted. Duplicate deletes yield one audit/reversal and 404
for the competing call. Both cash and note audit-injection failures roll back every
business-table snapshot. Unit suite 173/173; final integration 6/6; typecheck and
affected lint clean; full lint zero errors/155 preexisting warnings. Inventory,
legacy helper and diff checks pass. Synthetic databases removed and server stopped.

Limitations are explicit: retained rounded carrying after arbitrary-order reversal
can require unwinding remaining applications before new cash, no generalized
residual release or simultaneous unadopted bank/batch/config/lock qualification.
No full-int64/IRR, production migration, provider/live HTTP OAuth, independent
financial/security/release acceptance is inferred. MON-021 retains combined gates.
No schema/history/flag changes. Close this task and commit/push as authorized;
stop after MON-057. Next MON-058 payment batch contracts.
