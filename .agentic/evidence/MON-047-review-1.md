# MON-047 self-review 1

2026-10-03, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Honest self-review; no independent peer/human/accounting/security/deployment sign-off.

Approved within the bill CRUD write slice. Reviewed actual route/MCP changes,
shared schemas/math/services, source inventory, contract/docs and PostgreSQL
fixtures against all three acceptance criteria. No scope split or schema change.

Numeric unitPrice remains decimal major units for both transports. Aliases agree
explicitly; storage/header outputs remain minor units. Exact bigint ratios preserve
extended-price/discount/exclusive-tax signed rounding and currency scales without
floating ledger arithmetic. Safe money, gross/net/tax and sum bounds reject visibly;
full-int64 support is not advertised. DTO/serialization preflight runs before commit.
The inherited unitPrice schema description was corrected to zero default/no lookup.

Organization and header locks, scoped shared-reference checks and whitelisted
updates preserve tenant boundaries. Both old/replacement dates and closed years
are checked. Drafts with saved bookkeeping/payments reject. Historical inactive/
deleted references are retained only within the tenant, and saved unsafe money
cannot be overwritten/deleted through this slice. Existing currency omission
differences (REST supplier/org/USD versus MCP USD) remain deliberate and tested.

Duplicate policies retain their original REST trigger and exclusions. MCP gains
matching supplied-number/confirmation/hold/submission inputs. Pending state remains
the existing direct status transition; no approval-engine request/posting claim is
made. Reverse-charge PATCH/MCP supplier due now agrees with REST create. Numbering
handles arbitrary supplier text, numeric/BILL forms, concurrent first creation,
supplied auto-number collisions and signed int32 exhaustion. CRUD numbering,
header/lines/PO links/delete/audit are one transaction; failure injection proves
rollback. Success audit counts and scope are asserted. No stock/ledger/allocation
posting occurs; soft-deleted headers retain their PO links as before.

Final pure suite 145/145, all three actual PostgreSQL bill-write/bill-read/invoice-
write workers, typecheck, affected-path lint and source inventory/Drizzle/hash/
legacy gate pass. Full lint has 0 errors/159 existing warnings. Initial test-only
DDL parameter binding and missing tsx verifier invocation were corrected and
rerun. SQL-text snapshots retain every digit and show no failed business mutations.
Fixture DB count is zero and the temporary server is stopped.

Limitations are explicit: period configuration reads use the existing helper
outside the transaction; concurrent outside lifecycle/configuration writers are
not qualified here. Create-only duplicate policy does not run on supplier PATCH.
Approval execution, GRNI/tolerance/stock posting, payment/settlement, exports/PDF,
full-int64/functional IRR, browser/session/OAuth/provider, PG16/clean installs,
production migrations and human financial/security/release review stay with
assigned tasks. MON-020 retains combined acceptance, and MON-048 is next. User
explicitly authorized commit/push after completion; no deployment is inferred.
