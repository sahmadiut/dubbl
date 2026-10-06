# MON-098 self-review 1

2026-10-06, Asia/Tehran. Reviewer: codex, the implementing assistant. Explicit
self-review, not independent peer/human/accounting/production approval.

Approved within MON-098's bounded revenue contract scope. Reviewed shared wire
schemas/service, all three REST adapters, five registered MCP tools, actual
fixtures, dashboard edits, boundary registry, manifest/inventory and handoff.

REST major/MCP cents units remain distinct and exact aliases agree before writes.
Bigint rounding/allocation/recognized sums conserve values through the safe numeric
maximum. Inclusive months/all method labels/UTC overflow preserve existing monthly
allocation semantics; dates and ranges are explicit. No label/magnitude rescaling
or implicit FX/history repair occurs. Outputs preserve numeric fields/envelopes
and add canonical Minor strings; unsupported int64 values fail classified 422.

Review checked organization isolation, invoice-line parent ownership, custom
permissions, the formerly unguarded REST cancellation, account activity/type/
currency and default fallback. New schedules use existing resolved-account fields
to retain posting identity when invoice lines change. Legacy null references and
identity FX remain readable when consistent. No foreign invoice/account objects
are expanded. Draft preparation does not permit draft recognition.

Negative saved allocations, recognized totals, journal state/order/source/legs,
orphan history and unsafe outputs fail without task-owned mutation. Period tiers
and closed years run inside posting transactions. Bounded retries, organization/
schedule locks and saved preflight ensure journals/legs/period/status/totals/audit
roll back together. Injected audit/unsafe-entry/leg failures and one-shot number
collision prove the rollback/retry path. SDK registration verifies strict described
schemas and existing names. Keyed/targeted/terminal/cancel replays and cross-transport
concurrent create/recognize/cancel cases pass actual operation fixtures.

Added meaningful zero-method, corrupt recognizedAmount/saved-line/leg and legacy
null-account fixtures during review. Final targeted/revenue+accrual run passes
4/4; units 304/304; final typecheck, full lint (123 existing warnings, no errors),
changed-file lint, inventory, legacy gate and diff checks pass. Initial fixture
field/import mistakes are corrected and recorded. UI exact input/key/target,
ordered periods and bigint display/sums were inspected and typechecked; no browser
or screenshot qualification is claimed under DEC-005.

Limitations are explicit: absent transaction FX/currency snapshots require current
issued/base/two-decimal posting guards; malformed legacy history is not repaired.
Independent schedules retain caller-selected totals without adding invoice-wide
caps or original-deferral accounting policy. SHARE period locks can delay edits;
audit snapshots retain original responses and unkeyed calls intentionally advance.
No schema, full-int64/IRR, performance, independent accounting or parent MON-028
combined qualification is implied. These broader gates remain open separately.
