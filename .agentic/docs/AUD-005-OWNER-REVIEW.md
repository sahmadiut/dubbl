# AUD-005 owner review packet

Prepared 2026-10-02 (Asia/Tehran), coding-assistant. Status: accepted by the actual project owner after a Persian explanation. Approval record: [actual owner review](../evidence/AUD-005-owner-review-1.md). Recommendations below were proposals at preparation and are now approved under DEC-006.

## Baseline to review

Approve the [parity registry](../registries/BIGCAPITAL_PARITY.md) as the implementation planning baseline, with its limitations and follow-up tasks. It contains 46 capabilities: 39 partial, 5 missing and 2 unspecified. The retained public snapshots cover 350 operations across 265 paths; coverage is source evidence, not tested endpoint equivalence. Dubbl remains the runtime and API/MCP architecture. Reuse existing bank rules, matching, transfers, payment links, supplier debit notes/AP credits and period locks where correct. Qualify differences through the named tasks rather than duplicate these capabilities.

The [runtime capture](../evidence/AUD-002-attempt-3.md) passed 22 of 24 comparisons. Two findings remain open:

| Finding | Observed result | Required follow-up |
|---|---|---|
| Trial-balance debit/credit presentation | Positive natural balances for credit-normal accounts appear in the debit column; AP 5000 cents is displayed as debit 50.00 | PAR-008 report formulas and QA-001 accounting invariants; verify both REST and MCP behavior |
| Bank API versus GL balance | Bank API reports 0 cents; associated GL reports 102000 cents after opening/payment workflows | DATA-004 and MON-007: resolve statement/book semantics and selected-bank posting, then QA-001 reconciliation |

All 30 HTTP report/bank responses matched the captured handler baseline. Matching that baseline does not resolve its defects. Helpers passed 44 tests in AUD-004; workflow authorization, provider operation, rendered PDFs and production performance remain unqualified. Docker and screenshots are omitted under existing owner decisions. Licensing follow-up is deferred for this private fork. This review accepts the audit and planned remediation; it does not approve the financial outputs for production or enable IRR.

## Recommended scope for approval

The private Iran-use context supports concentrating on exact money/FX, safe migration, English/Persian UI, RTL, Persian numeral/calendar presentation, core accounting gaps and manual/CSV banking. The following are recommendations, not inferred owner decisions.

| Area | Recommendation and reason | Task disposition after approval |
|---|---|---|
| Intra-organization branches | Defer until a concrete multi-branch need is demonstrated; existing organizations/cost centers are not branch parity | Skip optional PAR-006 with the actual owner decision as evidence |
| Toman display/input | Defer; keep IRR/rial as the ledger currency and avoid ambiguous conversion | MON-009 stays mandatory; leave toman disabled; any future convenience needs explicit unit semantics and a bounded task |
| Bank-feed adapter and connector | Defer both until a provider is selected and availability is reviewed; manual/CSV banking remains useful | Skip optional DATA-005 and its dependent DATA-006 together; DATA-004 remains mandatory |
| SaaS subscriptions and miscellaneous API conveniences | Defer new parity work because this is a private fork with no demonstrated subscription/catalog requirement | Skip optional DATA-007; preserve current billing/integration behavior |
| Iranian statutory tax, payroll and e-invoicing | Defer new compliance implementation until concrete obligations and domain review are supplied | No new compliance tasks or claims; existing feature localization/correctness tasks remain in scope |
| Statutory accounting calendar | Defer jurisdiction-specific accounting rules; retain Persian calendar presentation with canonical Gregorian dates/UTC instants | LOC-004 remains mandatory; no statutory calendar claim |
| Hosting jurisdiction and external payment/FX providers | Defer selection to a concrete deployment/provider review; no provider eligibility or official feed is assumed | QA-002 and REL-001/002 remain mandatory gates; preserve existing integrations without qualifying availability |

Owner approval now authorizes the four optional skips listed above. No mandatory task is removed. Existing capabilities remain part of compatibility and correctness work.

## Schedule and remaining decisions

The source ranges (22–30 weeks for a focused 4–6 person team; 45–70+ weeks solo; differing 65–90/70–90 person-week estimates) are planning estimates, not promises. The illustrative October 5, 2026 start is not an agreed start date. There are no new due dates, staff assignments or inferred progress claims.

Exact FX precision/rounding, API compatibility window, performance budgets and recovery targets remain decisions for their existing money/QA/release tasks. Approving this packet does not resolve them or authorize deployment.

## Owner response and closure

The actual owner approved the recommendation after clarification. Record this as the project owner's review of AUD-005 only, without inventing specialist accounting or production sign-off. Apply the four optional task dispositions, check the remaining criteria and complete AUD-005 through the actual human review evidence. The next task is CI-001 after closure.
