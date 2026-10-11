# MON-140 self-review 1

2026-10-11, Asia/Tehran. Actual reviewer: coding-assistant, the implementing
assistant. Honest self-review only; no separate peer/human/accounting approval.

Reviewed the final scoped source/test/registry diff and MON-140-attempt-1 results.
Verified preview uses the actual extended-price wire policy and explicit USD/
selected currency; numeric legacy reads and canonical Minor aliases agree before
bigint adoption. Checked raw units never rescale, list currencies never combine,
safe-edge digits survive and quantity hundredths remain physical units. Saved
detail/card/send props carry the saved currency. English labels, invalid alerts,
decimal keyboard/accessible input names, wrapping and horizontally scrolling
line layout were inspected and actual components rendered in tests.

Reviewed application eligibility and both balance bounds: pending approval bills
cannot be allocated; note must be sent and bill must be recognized, same supplier
and currency. Exact amountMinor is reparsed by handlers; authoritative backend
locks, permissions, FX carrying-value restrictions and reversal behavior remain.
Actual REST/MCP/SQL application and void checks passed. Debit void resets remaining
to zero; the fixture explicitly verifies that policy. Invalid/malformed/unsafe
create attempts leave count/sum unchanged. Draft exact replacement parity passed.

Reviewed loaded org/filter/document contexts, aborted reads and pagination generation
guards; lifecycle success reloads normalized reads instead of merging raw headers.
These are source checks, not a live browser race test. Latest-100 org bill candidates
are locally filtered and explicitly labelled; backend offers no supplier filter.
Removed unsupported remaining-sort control. No invented cash refund, editor/copy
operation, API/MCP/schema/migration, second FX or production feature activation.

Static checks, 422 unit tests, five scoped pure/render groups, new SQL fixture,
existing debit/bill lifecycle regressions and money guards support the three
criteria. Intermediate script/fixture/ref-lint failures were corrected and disclosed
in attempt evidence. No scoped must-fix finding remains. Approve MON-140 as self;
MON-141/142 and MON-132/MON-129/MON-007 combined acceptance remain independent.
