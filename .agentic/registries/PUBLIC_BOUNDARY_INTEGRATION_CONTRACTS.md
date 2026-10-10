# MON-016 combined public and opaque boundary acceptance

This integration parent joins the adopted public, provider, backup, import/export
and opaque/rendering slices. The linked operation registries remain authoritative
for each endpoint's complete schema, permissions, envelopes and supported range.
The independent fixture is `tests/integration/public-boundaries-integration.test.ts`
and its worker; previous child completion is not its acceptance evidence.

## Boundary ownership and contracts

| Slice / complete operation inventory | Inputs and scope | Outputs, units, aliases and range |
|---|---|---|
| MON-030 [public portal/payment JSON](PUBLIC_PORTAL_WIRE_CONTRACTS.md) | Active contact-scoped portal token or payable invoice link. MCP additionally requires its authenticated organization and view:data; quote acceptance requires manage:invoices. Strict MCP token/quote IDs; no monetary overrides. | Existing identity, pending/paid invoice, invoice/payment/quote lists and statement envelopes. Named money fields gain canonical Minor strings matching safe numeric stored units. Currency comes from the document; quantities stay hundredths and discounts basis points. Statement sums use bigint and reject mixed currencies or unsafe derived totals before activity writes. |
| MON-031 [provider/webhook operations](PROVIDER_WEBHOOK_WIRE_CONTRACTS.md) | Public saved invoice token, scoped authenticated integration/billing controls, or original signature-verified provider event text. Native CSV major/exact aliases must agree. Outgoing delivery consumes trusted domain payloads. | Native provider field names remain intact. The application checkout profile supports qualified same-scale zero/two-decimal currencies and 1..99999999 minor units; IRR/KWD are unsupported. Signed checkout total/currency/org/invoice/token and optional amountMinor metadata must match the current saved due balance. Payment-intent replay preserves allocation identity. Outgoing canonical JSON/HMAC retains opaque exact strings; unsafe money fails before delivery insertion/fetch. This is local application policy, not live provider availability. |
| MON-032 [backup operations and entity catalog](BACKUP_WIRE_CONTRACTS.md) | Current snapshot, original uploaded JSON (20 MiB maximum), owned backup UUID and confirm=true restore. Download/read requires view:audit-log; upload/restore requires delete:organization. References, IDs, schema, periods, money and coverage are checked before destructive work. | Version 1 legacy integer fields or version 2 numeric fields plus matching Minor strings; exact-only inputs are supported within the safe bridge. Existing stored units, document currency, date-only/UTC instants, opaque JSON and losslessly compatible FX millionths remain intact. Uploaded bytes remain immutable. Supported restore atomically restores headers/lines with audit; omitted dependent graphs refuse recovery. |
| MON-033 [generic import/export operations](GENERIC_IMPORT_EXPORT_WIRE_CONTRACTS.md) | Accounts/contacts/products mapped rows or CSV, entity management permissions; bounded rows/text and strict controls. Financial imports retain domain owners. Export requires view:data and an owned live reference graph. | Product prices and legacy CSV monetary columns retain fixed-two decimal units: stored 1250 exports 12.50 even for IRR/KWD. Canonical Minor columns plus saved currency describe exact units without inferring rescaling. QuantityOnHand is whole int32 units. ZIP shares a read-only snapshot. CSV/XLSX scalar forwarding preserves exact text and rejects unsafe Numbers/object cells. Unsupported inputs fail before job creation; valid row domain errors use savepoints. |
| MON-034 [opaque/rendering integration and JSON ownership](OPAQUE_PUBLIC_INTEGRATION_CONTRACTS.md) | Scoped snapshot/audit/admin operations, signer/token proof, document/template/email controls and public capabilities. Strict allowlisted party corrections and independent admin counts. | Opaque JSON retains literal safe numeric tokens and arbitrary exact strings; no guessed money aliases. Known org money gains Minor siblings; quotas remain counts/MB. Signing summary, HTML/PDF/email/public SSR use document currency-aware exact minor formatting. Signed snapshots/proof are immutable; unsupported history fails before writes/delivery. |

Numeric coexistence supports signed safe integers +/-9007199254740991, with
operation-specific sign/business bounds from the linked registries. Canonical
Minor syntax admits signed int64 text, but the adopted ORM/business bridge rejects
values outside its safe numeric range with 422 LEGACY_NUMERIC_RANGE. Exact opaque
strings can carry larger values without becoming monetary write aliases. Invalid
wire shape/alias disagreement ordinarily returns REST 400/MCP validation errors;
scope failures retain the owning operation's 401/403/404 semantics.

The [JSON ownership closure](OPAQUE_PUBLIC_INTEGRATION_CONTRACTS.md) inventories
every persisted JSONB declaration and non-JSONB forwarding owner. Its schema/link
regression remains part of this parent's checks. The [money manifest](MONEY_MANIFEST.md),
MONEY_BOUNDARIES.json and verified source hashes retain cross-domain ownership for
direct REST/MCP forwarding already adopted by the other MON-012 children. This
parent does not override those domain contracts or inject global aliases into
native provider, signed, immutable or opaque payloads.

## Independent combined fixture

1. Actual API-key REST and full MCP SDK import legacy/exact products and contacts.
   Currency-aware legacy REST/exact MCP invoice writers produce USD, IRR and KWD
   invoices with the same stored 1250 amount. Product source prices remain
   fixed-two; invoice aliases carry the stored integer explicitly.
2. REST/MCP CSV exports agree on all six invoices and exact Minor columns. A
   version 2 snapshot and immutable version 1 upload feed actual REST/exact-MCP
   supported restores before dependent token/signature/payment graphs exist.
   Restored exports match byte-for-byte; both uploaded original texts survive.
3. Restored invoices feed public payment/portal/statement JSON and authenticated/
   public HTML plus PDF generation. Corrections retain full-int64/tiny-FX strings
   and leading-zero identifiers as opaque party data. Public signing freezes
   corrections. Safe numeric totals and exact aliases remain 1250 while formatted
   money uses the saved USD/IRR/KWD scale.
4. USD REST/MCP checkout passes the saved native unit_amount and snapshot metadata
   to a captured provider adapter. Real signed webhook verification and settlement
   update payment/allocation/invoice together. Invalid signatures, altered amounts
   and foreign org metadata leave state unchanged; replay adds no mutation. Portal
   payment/statement results and new backup payment aliases agree after settlement.
   Outgoing delivery signs the actual canonical body and retains literal payloads.
   IRR/KWD checkout rejects before adapter calls.
5. Combined table/storage/adapter snapshots prove no mutation for denied grants,
   invalid credentials, foreign tenant addressing, unsupported/conflicting aliases,
   invalid snapshots and unsafe persisted monetary history. Foreign exports contain
   no local records. Restore after token/signature/allocation dependencies exist
   refuses the incomplete historical recovery format before a safety backup.

The child regression suites supply the rest of the enumerated operations:
public-portal-wire, stripe-contract, backups, generic-import-export and
opaque-public-integration. They cover quote acceptance, signed Connect/sync/import/
reconcile/retry, backup maintenance/rollback, XLSX/ZIP and deeper opaque/rendering
families; their checks supplement the new combined workflow.

## Qualification limits

Synthetic S3, checkout and HTTP delivery adapters capture local outbound contracts;
no live provider/storage, Trigger deployment or HTTP dev server is used. Handlers,
API-key authorization, real MCP SDK validation, database transactions, signature
verification and HTML/PDF generation are executed. No browser/PDF visual fit or
independent accounting/security/native-language approval is claimed. QA-005 retains
complete disaster-recovery rehearsal; MON-008 retains consumer/full-int64 cutover;
migration, IRR enablement and release qualification remain separate. Existing
provider-after-commit and best-effort audit limits remain as documented.
