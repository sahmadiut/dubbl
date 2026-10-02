# AUD-004 attempt 1: public-contract capability audit

## Identity

2026-10-02, Asia/Tehran. Operator: coding-assistant (Codex). Repository: D:\Projects\dubbl. Entry commit: `2c67948f566aa70ba3e54dac641dbd8fb29268d9`; tracked tree was clean at initial inspection. Changes are uncommitted. During the audit, `.agentic/sources/SOURCE.md` received a separate addition of the implementation-plan text; it was read as requirements and left untouched. It is not this operator's deliverable. No production data, credentials or environment file contents were inspected.

## Audit result

Updated `registries/BIGCAPITAL_PARITY.md`, preserving every original capability name and adding the omitted resources metadata group. The registry has 46 dispositions: 39 partial implementations, five missing specific capabilities, and two unspecified value/scope groups. Partial records include both actual differences and unverified financial/runtime acceptance; they are not claims that all core implementations are defective. No full-runtime `existing` certification is given.

The official documentation index returned 352 API-reference page URLs in 57 named groups plus root. The official OpenAPI returned 350 operations on 265 paths with 58 tags: two differently capitalized Plaid tags normalize to one group. The index includes introduction/convenience root pages in addition to operation pages. Complete group coverage is recorded in the registry crosswalk; the operation inventory is not 350 successful runtime tests.

Evidence artifacts:

- `AUD-004-public-catalog.json`: URL inventory, source URL, UTC retrieval timestamp and SHA-256 of fetched index bytes.
- `AUD-004-openapi-operations.json`: method/path/tag/operation identifier/parameter names/request-schema references/response-code inventory, source timestamp and digest. Component schemas and response bodies are not copied. This is not a complete runnable OpenAPI artifact.
- `AUD-004-capability-map.json`: per-capability dispositions, owning tasks, real schema/domain/API/UI/MCP paths, test pointers, differences and revalidation date. Missing features explicitly link adjacent implementations rather than pretend absent workflows exist.
- `AUD-004-local-sources.json`: 465 local source/test fingerprints and exported symbols/tool names. Directory expansion is an inventory, not a claim of manual line-by-line review of all files.
- `scripts/verify_parity_audit.py`: offline coverage, original-row retention, task/path/test/link and local-source hash verifier.

Public sources: [introduction](https://docs.bigcapital.app/api-reference/introduction), [documentation index](https://docs.bigcapital.app/llms.txt), [OpenAPI](https://docs.bigcapital.app/api-reference/openapi.json), and the [public transferred operation](https://docs.bigcapital.app/api-reference/warehouse-transfers/mark-the-given-warehouse-transfer-as-transferred.md). These are official moving public contracts; fetched-byte hashes pin this observation, not a released Bigcapital build. No Bigcapital implementation repository/code was read or imported. Public money-field units not explicitly established by a contract are not assumed to match Dubbl cents.

## Material findings and preservation requirements

1. Bank rules are real: schema/UI/REST/registered MCP plus `lib/api/bank-rules.ts` implement ordered conditions, split allocations and automatic posting/reconciliation. REST application lives at `bank-accounts/[id]/apply-rules`, not the guessed `bank-rules/apply` path. DATA-004 owns behavior and concurrency qualification.
2. Warehouse transfers are real. REST creates transfer rows and completion changes source/destination stock, paired movements and received quantities. Completion does not wrap all writes in one transaction; create does not validate referenced warehouse/item organization ownership; PATCH accepts lifecycle statuses without a completed-transfer restriction. In contrast, MCP `transfer_inventory_stock` checks item/warehouse ownership and source stock, then atomically records an immediately completed transfer with stock/movements. These paths must be reconciled and strengthened under PAR-005 rather than replaced as a missing feature. Partial receipts/cancellation need tests; no undocumented guarantee about Bigcapital partial receipt behavior is claimed.
3. Payment links are real: authenticated org-scoped generation, random token, existing-token reuse, public token metadata/page/PDF/checkout. Generation lacks an explicit `requireRole` guard and invoices MCP has no payment-link lifecycle tool. PAR-007/QA-002 owns qualification and corresponding tools. Provider calls and rendered pages were not tested.
4. Matching is real: candidates include invoices/bills/existing payments/journals/transfers; the route verifies bank ownership and links existing journals rather than posting them again. The match route and `createPaymentJournalEntry` lack period-lock assertions for match-created payments. MON-007/DATA-004 must qualify and close that path; source inspection is not proof of all call-chain safety or exploitability.
5. Locks are real: `lib/api/period-lock.ts` checks organization staff/advisor dates and closed fiscal years, with permissions controlling bypass. Public module-level and partial-unlock contracts differ. Preserve the current model while qualifying all posting operations.
6. Supplier debit notes already reduce AP and apply against bills with supplier/currency/balance checks and transactional balance updates. The plan's candidate missing vendor credits must first be compared with this implementation in PAR-001/PAR-002; adding a duplicate economic model is not justified by a naming difference. Linked supplier-credit refunds are missing and map to PAR-003.
7. Sales receipts, partial payments, on-account customer deposits, credit-note issue/application/void are implemented. Customer credit application records carrier payments and allocations without double-relieving AR. Dedicated credit-note refunds are missing and map to PAR-004. Application reads happen before transactional writes: negative/concurrent/retry qualification remains necessary.
8. Branches, Plaid and generic resource metadata were not found as the specific catalog capability; cost centers/consolidation, manual imports and entity-specific schemas are adjacent alternatives. Branch/provider value stays with AUD-005 and their existing optional tasks. Resource metadata maps to DATA-001/DATA-003. SaaS and convenience endpoint value remain unspecified; nothing was silently skipped or owner-approved.
9. Number/int32 money, millionths FX and Number tax/cost rounding remain observed hardening work under MON tasks/PAR-005. Existing currency-aware and balanced FX helper tests do not certify IRR production, ledger workflows or migrations. Saved reports differ from resource table views; DATA-003 owns that gap. Reports need formula/fixture comparisons under PAR-008.

## Acceptance mapping

1. Every original capability has disposition, dated public reference, actual layer paths/test status, intentional differences and task mapping. All 58 normalized catalog buckets appear in the crosswalk, including previously implicit subgroups and resources metadata. Optional value decisions remain explicit rather than invented.
2. Existing bank rules/transfers/links/matching/locks were traced into actual source logic and their registered MCP modules as described above. Source verification found concrete distinctions, not merely filenames; no claim of runtime financial correctness is made.
3. Every row references existing task IDs, validated offline. Refund/metadata/view gaps and transfer/matching/payment-link correctness/tool gaps map to PAR-001 through PAR-005, PAR-007, DATA-001 through DATA-004, MON-007 and QA-002. Optional/scope questions map to AUD-005/DATA-005/DATA-006/DATA-007/PAR-006. No additional child task is needed for this bounded audit; later implementation tasks should split if their confirmed scope is too broad.

## Verification

All local commands ran from D:\Projects\dubbl.

| Command / procedure | Actual result | Limitation |
|---|---|---|
| `python .agentic/agent.py validate/status/context/next`; `start AUD-004 --owner coding-assistant` | Exit 0; next ready task selected and claimed | Structural workflow only |
| `Get-Content`, `rg --files`, targeted `rg -n`, directory inventories and representative source reads | Actual schema/domain/REST/UI/MCP paths and findings above | Initial guessed paths were corrected; source presence is not workflow qualification |
| Official docs retrieval using web and Python urllib | Public introduction/index/OpenAPI/transfer operation retrieved; catalog digests and operation inventory retained | Initial urllib without User-Agent returned HTTP 403; Mozilla/5.0 header succeeded; no live Bigcapital credentials/API calls |
| `python .agentic/scripts/verify_parity_audit.py` | Exit 0: all 45 original rows retained + one added; 58 groups, 350 unique operations, 265 paths, 58 tags; all task/test/layer/local Markdown links and 465 source hashes verified | Immutable source snapshot will intentionally detect future drift; does not execute APIs |
| `npm test` | Exit 0: 44 passed, 0 failed across eight test files | Pure bank code allocation/money/FX helpers; no workflow tests added or claimed |
| `npx tsc --noEmit` | Exit 0 | Existing installed dependencies/generated sources; not a clean build |

Final diff/structural checks and guard-negative checks are recorded in `AUD-004-review-1.md`. No full build, dev server, Docker execution, schema/migration generation, DB writes/fixtures, browser/PDF rendering, provider calls or deployment were run. This task changes documentation/evidence and an offline verification script only; no REST/schema/runtime feature change requires new MCP tools or migrations.

## Review and handoff

Separate honest self-review in `AUD-004-review-1.md`; no independent peer, accounting owner or native Persian review claimed. AUD-005 remains the required human product/accounting scope review and depends on AUD-002. The runtime-baseline blocker remains the existing explicit dev-start restriction; Docker is owner-omitted and the test database is already authorized. After AUD-004 completion, the tracker must compute the next action; do not bypass blocked prerequisites or enable IRR.
