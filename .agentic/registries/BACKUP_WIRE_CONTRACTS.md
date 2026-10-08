# MON-032 backup snapshot and restore contracts

This is the MON-016 backup child. Source: `lib/api/backup-wire.ts`,
`backup-snapshot.ts`, `backup-storage.ts`, `backup-maintenance.ts`, six REST
route files and `lib/mcp/tools/backups.ts`. QA-005 retains complete database
recovery rehearsal; the historical entity snapshot is not a full database dump.

## Operations

| REST | MCP | Input / permission | Output / mutation |
|---|---|---|---|
| GET `/backups` | `list_backups` | `view:audit-log`; REST page/limit positive safe integers, limit capped at 100; MCP limit 1..50, offset nonnegative | REST `{data,total}`, MCP `{backups,total}`; metadata only |
| POST `/backups` | `create_backup` | `view:audit-log`; 5 stored snapshots/hour; 10 active manual backups | Version 2 immutable object; `{backup}` (REST 201); 30-day manual expiry and audit |
| GET `/backups/:id` | `get_backup` | UUID, `view:audit-log` | `{backup}` for a non-deleted owned row; foreign/missing 404 |
| GET `/backups/:id/download` | `download_backup` | UUID, `view:audit-log`, completed owned row and matching storage key | REST original JSON bytes; MCP `{snapshotJson}` with original text; never converts old files |
| GET `/backups/download-snapshot` | `download_backup_snapshot` | `view:audit-log`; hourly guard | REST version 2 JSON attachment; MCP `{snapshot}`; repeatable-read source, no stored backup |
| POST `/backups/upload` | `upload_backup` | `delete:organization`; multipart File / snapshotJson string; max 20 MiB UTF-8 | Shared format/range/reference/ownership preflight before metadata/storage; original uploaded text retained; `{backup}` |
| POST `/backups/:id/restore` | `restore_backup` | `delete:organization`, UUID, confirm=true; REST body is strict | REST preserves `{success:true,restoredCounts:{restoredCounts}}`; MCP `{restoredCounts}`. Counts include `entity.lines` |
| DELETE `/backups/:id` | `delete_backup` | UUID, `delete:organization` | Owned metadata soft deletion plus audit; `{success:true}`; stored object retained |
| Scheduled maintenance | internal job, not user operation | existing 23-hour scheduled cadence, 7/30-day plan retention | Uses the same version 2 builder; expired object/metadata purge is unchanged |

The list and stored-file operations contain byte sizes/counts, not money. No
monetary alias is added to those metadata values. MCP fields have descriptions,
tools use wrapTool, and shared services access Drizzle directly under AuthContext.

## Snapshot format and stored units

Both versions require version (1 or 2), canonical organization UUID, ISO createdAt
instant and all 21 entity arrays below. Version 1 accepts historical safe integer
money. Version 2 adds `<field>Minor` canonical signed-int64 ASCII strings for
every bigint money column; nullable money has a null alias. Exact-only version 2
inputs may omit numeric siblings. Supplied siblings must agree; null and nonnull
cannot disagree. ORM writes currently require +/-9007199254740991, so valid
larger int64 aliases reject with `LEGACY_NUMERIC_RANGE` / REST 422. Numeric JSON
tokens that JSON.parse would round are rejected before schema conversion.

| Entity array | Stored integer money fields with matching Minor aliases |
|---|---|
| accounts | none |
| contacts | creditLimit |
| invoices, bills | subtotal, taxTotal, total, amountPaid, amountDue |
| journalEntries | none in header |
| products | purchasePrice, salePrice, averageCost, standardCost, totalValue |
| bankAccounts | balance, lowBalanceThreshold |
| expenses | totalAmount |
| payments | amount |
| quotes | subtotal, taxTotal, total, billedTotal |
| creditNotes, debitNotes | subtotal, taxTotal, total, amountApplied, amountRemaining |
| purchaseOrders | subtotal, taxTotal, total |
| recurringTemplates | none in header |
| projects | budget, hourlyRate, fixedPrice, totalBilled |
| budgets | none in header |
| fixedAssets | purchasePrice, residualValue, accumulatedDepreciation, netBookValue, revaluedAmount, revaluationSurplusBalance, disposalAmount |
| loans | principalAmount, monthlyPayment |
| taxRates, costCenters, documents | none |
| invoices.lines, bills.lines, quotes.lines, creditNotes.lines, debitNotes.lines, purchaseOrders.lines | unitPrice, taxAmount, amount |
| journalEntries.lines | debitAmount, creditAmount |

These are the database's existing integer units, cents where the legacy schema
uses cents. USD 1250 and stored IRR 1250 remain 1250. Backup does not call current
currency-scale conversion, infer currency from locale, translate FX or recompute
prices/totals. Stored document currencyCode/project currency and organization
context retain their existing meanings. Quantities, minutes, percentages,
int32 counts and numeric/JSON nonmoney fields retain their own units and receive
no Minor aliases. Opaque JSON is not recursively renamed or rescaled.

Journal line exchangeRate stays positive int32 millionths. Nullable rateExact,
direction, format, provenance and migration status are retained. Nonnull exact
rates must match exchangeRate losslessly in the current millionths coexistence
bridge; unsupported higher precision/ranges return LEGACY_NUMERIC_RANGE.
Direction is quote_per_base; invalid decimals/mismatches reject. Canonical
Gregorian date-only fields and timestamp instants are checked; Date objects are
rehydrated only for insertion. UUIDs/enums/booleans/int32 fields are checked using
the actual static schema catalog. Unknown entities/columns, missing arrays or
document lines, duplicate IDs and conflicting line parents reject.

## Organization, references and restore failure behavior

Snapshot and every header organizationId must equal AuthContext organizationId.
IDs cannot collide with foreign headers; existing line IDs cannot move to a new
parent. Physical FKs are checked against snapshot roots/lines or existing active
owned external references. Users must have an organization membership. Hierarchy,
project, converted-invoice, journal reversal and supported polymorphic references
also receive ownership checks. Unknown polymorphic types and external child
references with unsupported ownership chains reject. References into replaced
tables must be present in the snapshot, not merely in today's live data.

Before writing a safety backup, restore checks stored bytes, current references,
dependency order, period locks/closed fiscal years and omitted dependent tables.
If an unexported table has rows referring to this organization's included roots
or document lines (for example payment allocations, expense lines, recurring
lines, budget periods, inventory movement/FIFO or asset/loan history), restoration
rejects instead of silently restoring only headers. Upload/download still retain
the historical format; extending it to full recovery belongs to QA-005. These
checks also include soft-deleted history, which is not implicitly disposable.

A valid supported restore saves a new version 2 safety snapshot, then acquires
sorted SHARE ROW EXCLUSIVE locks on affected/referenced/dependent tables and
revalidates. It soft-deletes current included roots, upserts every supplied root
and document line in FK order, replaces included parents' old lines, and writes
one transactional restore audit. No FK/constraint error is swallowed. A failure
rolls back data and that audit; the already-saved safety snapshot remains.
Table locks briefly serialize writes across organizations during restore.

No schema migration, full-int64 consumer cutover, complete disaster recovery,
production S3/Trigger availability or IRR enablement is claimed. Focused actual
REST/API-key/MCP SDK fixtures and synthetic S3 command responses are recorded in
`../evidence/MON-032-attempt-1.md`.
