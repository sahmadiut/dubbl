# MON-050 self-review 1

2026-10-03, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Honest self-review; no independent peer/human/accounting/security/production
approval. Approved within the purchase requisition contract slice.

Reviewed actual schemas/services/thin routes/registered tools/UI changes,
contract/docs/source inventory and meaningful pure/database fixture evidence
against all three acceptance criteria. No additional schema change or task split.

Numeric input prices remain decimal major units. Exact major/minor aliases agree
before calculation; bigint extension, signed ties and zero-tax policy preserve
existing economic amounts. Safe numeric outputs add explicit *Minor strings.
No money aliases are applied to physical hundredths or counts. Subminor extension
survives saved-line conversion without recomputation. Unsupported prices/products/
sums/saved fields reject before writes; full-int64 business support is not claimed.

Tenant references are checked even on saved history and before supplier/line
relation disclosure. Foreign IDs return 404, custom read-only roles cannot write,
and actual API keys cannot redirect scope via conflicting headers. Historical
same-tenant references remain readable. Mutations enforce strict request-date and
new PO-date locks, zero-tax/balance/quantity and conversion status/link agreement.
Read DTOs also enforce that agreement; this guard was added during review.

Organization locks serialize first numbering, decisions, conversion and PO
creation. The same PO allocator is used inside conversion's transaction. Number,
header/lines, status/link and audit commit together, with response preflight.
Injected failures demonstrate rollback after independent write stages and failed
audit, including status and numbering. Repeated conversion rejects and concurrent
conversion creates only one order; no success replay or idempotency key is invented.

The existing submission UI never persisted submitted status because PUT stripped
it and the UI fabricated a fallback. The corrected single PUT has a validated
draft transition, alongside separate MCP submit/edit/delete operations. Approved/
converted content is protected against amendment/deletion. Intentional compatibility
corrections (draft-only edits, explicit invalid status/filter rejection, wrong-state
400) and retained metadata whitelisting/soft-delete lines are documented. No workflow
routing, notification or posted ledger behavior is invented by the module docs.

Review strengthened foreign saved tax/PO-link rejection, PO-header rollback and
first-sequence concurrency in a genuinely unused organization. Both final migrated
PostgreSQL workers pass, as do 156 units, typecheck, full lint (0 errors/155 existing
warnings), clean affected-path lint, source/Drizzle/hash and 9 legacy checks.
Fixture databases were removed and synthetic server stopped. Branch synchronization
was verified before the authorized commit/push.

MON-020 retains combined procurement acceptance; next MON-051. Other bulk/receipt/
settings/trash and period-configuration writers/races, full-int64, live providers/
browser/session/OAuth, production migration and independent financial/security/
native-language/release/IRR gates remain separately assigned. No build/dev/
deployment or functional-currency enablement occurred. No slice blocker remains.
