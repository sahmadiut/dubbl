# MON-061 self-review 1

2026-10-04, Asia/Tehran. Reviewer coding-assistant, implementing assistant.
Self-review only, without peer/human/financial/security/production approval.

Approve this bounded expense lifecycle contract slice. Inspected actual service,
REST adapters, described strict MCP schemas/registration, reused CRUD checks,
exact tax/FX helpers, saved-history validation, test assertions, documentation and
inventory. All three criteria have concrete operation/negative/rollback evidence.

Numeric header totals retain stored claim minor units with additive canonical
totalAmountMinor; no new amount input or magnitude-selected representation.
Saved base journal amounts are never converted again. Exact tax ratios preserve
explicit employee gross and recoverability; reverse charge owes only supplier
net. Full settlement clears actual recognition carrying value and separates FX,
using existing system codes. Quotes/scale conversion are scoped and saved;
nonrepresentable FX, unsafe money and compound components reject explicitly.

Organization then claim locks coordinate lifecycle with adopted CRUD. Distinct
manage/approve permissions, current member/owned references, live posting account
eligibility, saved dates and two-tier/fiscal locks guard all operations. Bank
eligibility excludes unrelated asset accounts. Response validation and audit are
inside the same transaction; snapshot and injected SQL-fault assertions prove
no committed partial posting/reset/link/account/number changes.

Pay/reverse require complete journal-specific atomic audit, current base provenance
and matching total/legs, plus owned historical accounts/dimensions and agreeing
exact FX. Missing/draft/duplicate/foreign/tampered history rejects; no legacy
base/FX repair is invented. Reversal copies stored rates and swaps sides verbatim,
including optional payment, retains posted originals/reversals, and works without
quotes. Repeated cycles and concurrent duplicate requests are covered. State
errors provide duplicate prevention, not successful idempotent response replay.

Review tightened compound-tax rejection, bank eligibility, journal sequence bounds
and ambiguous/draft history guards, and added negative base/history/FX fixtures.
Final tests pass: 182 units, seven PostgreSQL workers, typecheck, full lint with
0 errors/155 baseline warnings, clean changed-file lint and inventory/legacy gate.
Fixture/setup failures are repaired and accurately recorded in attempt evidence.
Synthetic databases are removed and server shutdown verified.

Limits remain explicit: old qualified-audit remediation, full-int64, compound tax,
generic bank/restore/merge/reference/configuration writer races, browser/session/
OAuth/providers/performance, PostgreSQL 16/clean install/production migration,
independent accounting/security and IRR/release gates. MON-021 retains integrated
payment/expense/bank acceptance and prior carrier handoffs. No deployment, schema,
historic-unit change or IRR enablement. No slice blocker. Next MON-062; user has
authorized commit/push after task completion.
