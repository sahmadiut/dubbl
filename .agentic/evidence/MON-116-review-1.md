# MON-116 review 1

2026-10-08. Reviewer: codex. Kind: self. Result: approve for this bounded task.
The implementer reviewed their own changes/evidence. This is not independent peer,
human, financial/accounting or production qualification.

Reviewed both shared service/schema paths, actual route and MCP registration,
consumers, fixtures, registry and verification results. SQL text projections protect
stored money before the transitional ORM. Bigint/rational calculations are narrowed
only at documented safe compatibility boundaries. Every monetary output has a
matching Minor string; nullable fields match. Rates and inverses reject inexact
numeric coexistence, retaining quote_per_base and signed legacy Math.round ties.

Auth/permissions are shared inside the services. Organization, contact and rate
queries are scoped; foreign/deleted labels use fallback text. Snapshot transactions
are read-only/repeatable-read and rate caches are local. Actual REST/API-key and
MCP clients agree for both tenants, defaults and populated results; permissions,
invalid inputs and unchanged financial/audit snapshots are asserted.

Forecast selection excludes irrelevant types/statuses/deleted/overdue rows. Currency
selection considers contributing events only; filters and empty defaults avoid
mixed-currency sums. Generator date semantics and occurrence/end caps remain;
full horizons and proper Sunday buckets correct the legacy truncation/lumping.
The existing pretax/prediscount subtotal estimate is disclosed rather than claiming
tax-inclusive generation. Expenses keep legacy recurring_bill output classification.

Unrealized FX is explicitly today's outstanding estimate from issue-date/today saved
quotes, not posted historical valuation. Direct precedence, missing/quarantine nulls,
receivable/liability signs and rate compatibility are characterized. Missing-rate items
are counted and excluded; unsafe available quotes fail. UI exposes failures and
missing-rate counts and formats original integer values exactly; chart geometry is
only approximate presentation.

Corrected findings: initial numeric test expectation; fixture aliases rejected by
the DB guard; lossless reciprocal check; extra recurring cross-org/deleted labels and
subtotal overflow tests. All final focused/adjacent integration, full unit, typecheck,
lint and money gates passed. No unresolved in-scope finding remains.

Limits: current amounts do not reconstruct historical settlement/posted FX; rates
changed at issue dates can change the estimate. Recurring estimates do not include
tax/discount. Large source volumes are processed in memory; no production performance
claim. Deliberate expanded/corrupt rates are seeded only in disposable tests with
guards restored before reads. Browser/session/OAuth, visual layout, public int64,
independent financial and production/IRR qualification remain open. MON-104/MON-029
retain their own combined acceptance.
