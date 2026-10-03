# MON-045 self-review 1

2026-10-03, Asia/Tehran. Reviewer: coding-assistant, implementing assistant;
kind: self. This is not independent peer/human accounting/security/deployment
approval. Reviewed the actual diff, shared schemas/services and REST/MCP adapters,
registration, real fixture outputs, contract registry, public docs and inventory.

## Findings and repairs

- Import numeric prices remain decimal major units. Exact major/minor aliases
  agree without coercion; currency defaults USD, and explicit scales replace the
  fixed multiplication without rescaling legacy stored documents. Import retains
  its extended-price rounding and quantity/discount/tax units.
- Canonical/bounded inputs and bigint gross/components/header sums reject before
  jobs. Saved tax values and scoped tax-inclusive totals also preflight. References
  and periods are rechecked inside document writes. Atomic number/header/line
  rollback and independent business failures are demonstrated, not inferred from
  successful row counts. Reimport duplicates and crash-recovery limits are explicit.
- Flat grouping validates document headers, and namespaces explicit-number keys
  separately from fallback-header keys. Pure regression covers the collision.
  CSV prices stay exact strings; no permissive parseFloat or lineAmount/name/code
  guessing is introduced. The existing simple CSV parser is honestly bounded.
- Both bulk send paths now use complete exact recognition. Organization/document
  locks protect whole-batch posting; partial failure rolls back earlier postings.
  Actual concurrency/repetition fixtures verify one posted document and saved FX.
  Tightened approval permission and atomic failure policy are documented.
- Mark-paid retains the existing external-settlement annotation, with balance/
  line/state/reference/period/range guards and atomic updates. It is explicitly
  not payment/settlement qualification. Tests assert zero payment/allocation rows,
  and MON-021 handoff calls out required financial coordination.
- Reminder preflight rejects invalid saved monetary/tenant history before email
  or logs. Exact formatter preserves fractional minor units at the safe maximum.
  Skips and local encryption-key delivery failure are tested without network;
  successful provider delivery/outbox/idempotency/races remain unqualified.
- Every adopted REST boundary has MCP parity with described schemas, direct DB,
  AuthContext, wrapTool and full index registration. Unrelated bulk banking/contact
  tools are preserved. Wizard HTTP errors are now visible through an accessible
  alert, and invoice mappings include the fields accepted by the new flat import.
- Corrected fixture authentication/schema/FX-normalization assumptions, resolved
  the initial unused import warning and fixed documentation range encoding. Final
  affected checks pass; no immutable completed-task evidence was rewritten.

## Acceptance and disposition

Approve all three criteria for the defined MON-045 slice. Registry/input-output
contracts, actual migrated PostgreSQL REST/SDK legacy/exact/role/tenant fixtures,
supported-value preflight, exact response compatibility and atomic rollback tests
support acceptance. Attempt evidence records the real 138 unit and four integration
passes, final expanded worker, clean affected lint/typecheck, existing full lint
warnings and inventory/cleanup results.

No slice blocker. Combined receivable, real settlement/annotation ledger/report
interaction, full-int64/domain/financial/IRR migration, external writer/configuration
races, quoted CSV, durable import recovery/email, successful SMTP/provider,
browser/session/OAuth and platform qualification remain their assigned gates.
No schema/build/dev/IRR flag/configured database/deployment change is implied.
After task closure, commit/push as requested, verify synchronization and stop.
Next controller task: MON-020.
