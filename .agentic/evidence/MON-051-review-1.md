# MON-051 self-review 1

2026-10-04, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review only; no independent peer/human/accounting/security/production sign-off.

Approved within the documented supplier debit-note supported slice. Reviewed
shared wire/service, real REST/MCP/generic bill void coordination, saved FX/GL/
stock/allocations, email state, fixtures, docs and refreshed money inventory.
Three criteria map to explicit registry and actual operation evidence.

REST numeric major and MCP numeric integer-minor price differences are preserved;
exact aliases agree before business preparation. Exact ratio products/discount/
tax/sums and output aliases retain existing stored units with safe range barriers.
Signed draft values remain readable; unsupported posting values fail. Draft mass
assignment is removed. Organization scoping and owned relations protect reads
and writes; authenticated custom-role and foreign-org fixtures cover every operation.

All selected business effects, including audit, share organization/document
transactions. Saved FX survives quote changes. Stock returns require complete
matching original bill receipt history and mirror original GL costs; void restores
actual value and FIFO layers. Bill void cannot double-reverse an active return.
Review added missing stock-history/dimension/cost-method guards and rejects
consumed/unsupported receipt paths instead of reconstructing costs from live values.

Application does not double-post AP. Review added equal proportional AP carrying
values to the existing supplier/currency/saved-rate/account checks, preventing
foreign rounding differences from being silently treated as a 1:1 GL offset.
Paired carriers and exact applied/due balances unwind atomically; altered,
orphaned/foreign or bank/provider/journal-linked carriers fail. Request-id
idempotency and interactions with legacy payment/bank/bulk/report writers remain
MON-021 and the parent acceptance, not inferred from full-application concurrency.

Historical qualified safe numeric reads remain available when an old owned
recognition reference matches; mutation requires own saved source/FX history.
Email validates before posting and delivers afterward; 502 exposes committed
sent state. Existing document-email retry avoids repeating recognition. PDF stays
separate. Old unused non-atomic debit-note journal helper is removed.

Final units 159/159, typecheck, affected-path lint and inventory/legacy checks pass.
Full lint has 0 errors/155 existing warnings. Three actual PostgreSQL handler/SDK
workers pass. SQL-text snapshots and failures in line/journal/allocation/stock/
void-audit writes demonstrate rollback; concurrent numbering/send/full apply/void
avoid duplicate effects. Initial fractional-MCP role fixture was corrected; it
was not an authorization implementation failure. Synthetic databases are removed
and server stopped after the interruption/restart and final checks.

Limits are explicit: partial/GRNI/standard/tracked stock and specialized expense
tax/header paths reject; differing/rounded carrying FX, cash classification and
cross-writer races/idempotency remain MON-021. Existing saved rates lack a full
base-currency regime snapshot, so regime migration is not qualified. Full-int64,
PostgreSQL 16/clean install/production migrations, provider/session/OAuth/browser,
independent financial/security/native-language/IRR/release gates remain assigned.
MON-020 retains combined acceptance; MON-052 is next. Commit/push authorized;
no deployment is inferred.
