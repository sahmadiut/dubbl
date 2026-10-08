# MON-024 combined inventory and costing contracts

Verified 2026-10-09, Asia/Tehran, through actual migrated disposable PostgreSQL
REST handlers and full SDK in-memory MCP registration. This is independent parent
integration evidence by the implementing assistant, not human accounting approval.

## Complete boundary inventory

The linked inventories define every adopted operation, REST/MCP envelope, input,
output, unit, alias, supported range, authorization, references and error behavior.
These contracts compose without converting physical units into money.

| Domain | Authoritative contract | Representation and scope |
|---|---|---|
| Variants and supplier links | [Catalog](INVENTORY_CATALOG_WIRE_CONTRACTS.md) | 8 operation pairs; safe nonnegative numeric cents plus matching price Minor strings; nullable historical prices; variant quantity is metadata only; lead time is int32 days |
| Items, categories, CSV, reorder, bulk | [Master](INVENTORY_MASTER_WIRE_CONTRACTS.md) | 16 tools; opening receipt/GL atomic; CSV legacy prices use two-decimal major units while Minor columns are integers; existing-code CSV never reloads stock; price projections differ from book value |
| Movements, locations, transfers, stock takes, serial/lot metadata | [Movement](INVENTORY_MOVEMENT_WIRE_CONTRACTS.md) | Signed safe numeric monetary values plus Minor aliases; int32 whole physical quantities; location transfers preserve global stock/book value and post no GL; count apply compares live location/global quantities |
| Valuation, FIFO history, landed costs | [Valuation](INVENTORY_VALUATION_WIRE_CONTRACTS.md) | 8 operation pairs; carryingValue is saved book value; purchase/sale projections retain legacy semantics; component amount uses legacy two-decimal major units for every currency, amountMinor uses stored units; proportional allocation conserves totals |
| BOM and assembly | [Assembly](INVENTORY_ASSEMBLY_WIRE_CONTRACTS.md) | 15 operation pairs; recipe quantities/wastage use separate exact decimal aliases; finished quantity is int32 whole units; labor/overhead costs retain safe minor values and aliases; actual completion uses carrying cost |
| Procurement stock bridge | [Goods receipts](GOODS_RECEIPT_WIRE_CONTRACTS.md) | 4 operation pairs; saved PO minor prices, quantity hundredths and quantityReceivedExact physical units; inventory receives whole units at receipt-date base value; FIFO divisibility/tracking restrictions retained |
| Sales/return stock bridge | [Invoice lifecycle](INVOICE_LIFECYCLE_WIRE_CONTRACTS.md) | Existing send/void operations; consume/restore FIFO quantities and exact remaining/consumed value; average final sale exhausts residual value; historical null FIFO values retain legacy product fallback |

Numeric coexistence is bounded by Number.MAX_SAFE_INTEGER (9007199254740991).
Canonical Minor strings do not promise full-int64 business support. Unsafe saved
values, derived products or aggregates reject with 422 LEGACY_NUMERIC_RANGE before
committing adopted inventory changes. Currency/date/physical quantity/percent are
independent. KWD `purchasePrice:1250` retains 1250 stored units; legacy landed
`amount:0.01` retains one stored unit without implicit currency rescaling.

## Composed workflows and assertions

`tests/integration/inventory-integration.test.ts` and its worker verify:

- Catalog variant/supplier writes (including >int32 prices) leave stock/valuation/
  ledger unchanged and expose the same aliases through the full MCP catalog.
- A 3-unit receipt worth 87 plus freight 1 produces book value 88 while the legacy
  purchase-price projection stays 87. Transfer 2 units preserves global value/GL;
  a location count from 2 to 1 consumes 29, leaving global 2 units worth 59.
- Assembly of located components rejects atomically: its global interface cannot
  choose a warehouse or reconcile those balances. Serial/lot stock also rejects.
  Unassigned 2-unit receipt 58 plus freight 1 is assembled with conversion cost 6
  into 2 units worth exactly 65, with rounded unit cost 33. Injected audit failure
  rolls back all stock, layers, movements, journal, completion and audit effects.
- Partial/full invoice sales of this FIFO output consume 33/65; void restores
  value 65 and original layer quantity. Later adjustment/bulk issues consume
  33 then 32. An average-cost fractional recipe builds 2 units worth 1; full sale
  and void retain that single residual unit. Every journal balances in KWD.
- Existing-code CSV changes price/master metadata without replenishing stock or
  touching existing carrying value/journals. Report/layer REST and MCP DTOs agree.
- Actual REST receipt and MCP bulk adjustment serialize to 8 units worth 80.
  REST capitalization and MCP assembly permit either serial order: remaining
  component plus finished stock retains all 96 units of carrying value.
- Two organizations, conflicting organization header, custom role denials, invalid/
  expired API keys, unknown fields, inconsistent aliases, fractional stock, unsafe
  exact inputs/raw saved history, period locks and repeated final operations are
  asserted against unchanged SQL-text business snapshots.

All five child fixtures plus goods-receipt, bill, invoice and credit regressions
remain required acceptance evidence, including the additive FIFO migration test.
Completed child evidence is unchanged; parent acceptance is supported separately.

## Retained limits

Assembly location/serial/lot allocation rejects explicitly; no new allocation UI or
warehouse redistribution is inferred. Standalone global adjustments preserve their
documented independent location behavior; transfers/counts use physical locations,
while FIFO valuation remains global cost flow. New invoice FIFO consumed values
do not rewrite historical nulls or reconstruct ambiguous unlinked returns. Existing
negative-stock/shortfall, generic export/import, historical remediation, full-int64,
foreign procurement variance and independent accounting/production migration/IRR
qualification remain their assigned contracts and gates. No full build, dev server,
browser/session/OAuth HTTP MCP, PostgreSQL16 clean install, provider, Docker or
deployment is claimed. No schema modification or migration generation is required.
