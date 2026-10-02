# Risks and controls

All risks originate in the [Markdown implementation plan](../sources/SOURCE.md) unless labeled implementation-system risk. Track each actual finding with severity, owner, evidence, mitigation task and disposition.

| Risk | Primary control / task |
|---|---|
| Incompatible copied implementation code | Clean-room provenance and pinned license review: AUD-003 |
| 32-bit money overflow / fixed cents | Complete manifest and exact-money cutover: MON-001..010 |
| Scaled integer FX / poisoned rates | Exact decimal, explicit direction/provenance/history: MON-004..005 |
| Broken JSON / legacy API consumers | Safe string contracts and compatibility window: MON-006, REL-004 |
| Balance-changing migration | Counts, checksums, financial invariants and restore: MON-010, QA-005 |
| Currency redenomination / guessed toman | Explicit regimes and official dated evidence: MON-009 |
| Duplicated existing Dubbl capabilities | Evidence-based parity audit: AUD-004 |
| Incorrect accounting language | Native accountant glossary and acceptance: L10N-001, L10N-012 |
| RTL only works in dashboard | Full surfaces, PDF goldens, a11y: RTL, L10N, QA-003 |
| Bidi spoofing / malformed financial input | Sensitive identifier policy and strict parser: LOC-003, QA-002 |
| Assumed Iranian provider availability | Optional adapters and deployment review: DATA-005..006, QA-002 |
| Calendar leaks into storage | Canonical Gregorian/UTC boundary: LOC-004 |
| Translation/client performance regression | Server-first architecture and measured budgets: QA-004 |
| Evolving upstream / moving parity target | Pinned snapshot, merge log and maintenance: AUD-001, OPS-001 |
| Tracker records untrue completion | Evidence, honest review and Git review; CLI is not proof of external facts |
| Competing assistants or manual state edits | Single writer, lock, dependency validation; no distributed coordination |

## Observed baseline findings (AUD-002, 2026-10-02)

Evidence: `../evidence/AUD-002-attempt-3.md` and its corrected synthetic capture. Accounting/API owner review remains pending; these are open, not fixed.

- High: trial balance splits natural-signed balances by sign, placing positive payable/equity/revenue balances in its debit column. Verify debit/credit presentation and totals before relying on this report; remediation/qualification tasks: PAR-008 and QA-001.
- Medium: bank account API balance 0 differs from GL balance 102000 cents after opening journal/payment workflows. Resolve statement versus book balance semantics and selected-bank journal routing before reconciliation qualification; remediation/qualification tasks: DATA-004, MON-007 and QA-001.

## Observed money boundaries (MON-001, 2026-10-02)

Evidence: [money manifest](../registries/MONEY_MANIFEST.md), [column appendix](../registries/MONEY_COLUMNS.md) and [consumer index](../registries/MONEY_BOUNDARIES.json). Inventory completion does not remediate these risks.

- High: 194 monetary int32 columns, method-dependent landed-cost basis and Number/SQL aggregate narrowing can overflow or lose exactness. Owners MON-002/003/007/008/010.
- High: three millionths FX columns coexist with payrollItem.fxRate stored as unscaled approximate real. One universal rate backfill would corrupt payroll rates. Owners MON-004/005/008/010.
- High: fixed-two-decimal input/import/public/PDF paths coexist with currency-aware formatting. Identify malformed IRR cohorts by provenance; never rescale by magnitude. Local test DB has zero direct IRR-tagged records in 31 checked tables and zero IRR FX pairs; production/incorrect tags are not qualified. Owners MON-008/009/010, LOC-003, QA-005.
- High: org-context configuration/inventory/assets/budgets/loans and mixed payroll totals require explicit historical currency/unit policy; journal currency tags can describe original documents while amounts are already base. Owners MON-007/008/010.
- High: REST/MCP, JSON envelopes, webhook/audit/backup, provider payloads and exports cannot adopt bigint through unmodified Number/JSON.stringify paths. Owners MON-006/008, DATA-001/002, QA-005. Raw historical payloads must retain their original contract.
