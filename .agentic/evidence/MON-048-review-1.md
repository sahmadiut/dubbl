# MON-048 self-review 1

2026-10-03, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review only; no independent peer/human/financial/security/production sign-off.

Approved within the bill lifecycle slice. Reviewed services, real REST/MCP and
generic approval paths, exact math, stock/GRNI reversal, fixtures, documentation,
source inventory and acceptance evidence. No schema change or scope split.

Money remains stored minor units with numeric compatibility and additive strings.
Legacy/exact/dual clients preserve USD 1250 and larger safe values. Tax/AP follows
saved supplier payable, including partial reverse-charge recoverability and matched
stock taxes. Currency-scaled FX is exact and saved; reversal mirrors saved legs
instead of converting using a new rate. Full-int64 and foreign receipt FX are
deliberately unavailable rather than silently rounded or advertised.

Review found stock rounding could differ from GL on several sub-minor FX lines.
Stock now takes the same converted GL cost leg/residual; the real regression
fixture passes. GRNI now requires a balanced, unreversed receipt accrual with
identity FX in the current base currency. Partial bills clear only remaining
received units, restore their own PO quantities and preserve other active bills.
Void restores the original/remaining receipt stamp and reverses exact linked
variance value. Average/FIFO/warehouse changes have safe ranges and original
value history; consumed FIFO and unqualified legacy stock fail with rollback.

Organization/header/receipt/PO/workflow/stock locks and scoped references protect
the selected writers. Strict issue dates and reversal dates respect periods and
closed years. Receive cannot bypass a pending workflow; final approval and generic
request paths post once with the workflow action, bill state and audit. Assignees,
nonconsecutive steps, rejected states and cancellation are exercised. MCP approve
now matches pending-only REST semantics; new receive_bill covers drafts.

All three criteria have concrete registry and real-fixture evidence. Four adjacent
PostgreSQL workers pass; final accrual guard has a passing lifecycle rerun. Unit
suite 149/149, typecheck, affected-path lint and money inventory/legacy checks pass.
Full lint has 0 errors/159 existing warnings. Whole-business SQL-text snapshots
and injected DB failures demonstrate posting/workflow/audit/reversal rollback;
concurrent receive/void does not duplicate effects. Initial fixture decoding/
decimal-scale and compiler narrowing failures were corrected and rerun. Incidental
comment encoding changes were restored. Synthetic fixture databases are removed
and server stopped; the delayed launcher's post-stop readiness exit is documented.

Limitations remain explicit: existing external period/rate configuration helpers
and other settlement/procurement writers do not share all these locks. MON-021
must qualify real payment/allocations/ledger/carrying-FX/idempotency, exact payment
aliases and races; pay_bill remains balance-only. This slice's common recognition
and exact payable/range barriers do not imply that settlement is complete.
Historical receipt remediation, FIFO variance, base-currency regime migration,
full-int64, provider/session/OAuth/browser, PostgreSQL 16/clean installs, production
migrations, human accounting/security/native-language/IRR/release gates remain
assigned work. MON-020 retains combined acceptance; MON-049 is next. Commit/push
is explicitly authorized; no deployment is inferred.
