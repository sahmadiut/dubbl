# Combined journal boundary contracts (MON-018)

MON-014 integration update (2026-10-09): shared manual journal legs reject unknown
fields on REST and MCP create/full replacement. Unsupported debitAmountExact can
no longer disappear before a committed write. Recurring template rate validation
passes only its three FX fields to that strict adapter. Header/import whitelist
policies, documented units, rates and lifecycle behavior remain unchanged. The
core fixture and current parent/all-three-child regressions cover the repair;
see [core integration](CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md).

2026-10-08, Asia/Tehran. Parent integration for MON-035 CRUD, MON-036 lifecycle/
import and MON-037 recurring generation. Actual source and migrated disposable
PostgreSQL fixtures establish bounded wire compatibility; independent financial
and production qualification remains separate.

## Complete operation inventory

REST paths below are relative to `/api/v1`. UUIDs and references belong to the
authenticated organization; the API-key organization overrides request headers.
MCP uses AuthContext, direct Drizzle services and wrapTool, with registration via
the existing entries, import-export and recurring-journals files in tools/index.ts.

| REST boundary | MCP operation | Input / returned envelope and units |
|---|---|---|
| GET `/entries` | `list_entries` | Existing filters/pagination; entries and count. REST totalDebit is a fixed two-decimal string; MCP totalDebit is a minor-unit number; totalDebitMinor is the raw integer sum string |
| GET `/entries/:id` | `get_entry` | Entry UUID; entry with stored legs, currency tags and saved FX. REST leg amounts are fixed two-decimal strings; MCP leg amounts are minor-unit numbers; both add exact Minor strings |
| POST `/entries` | `create_entry` | Date/header and >=2 lines; numeric minor-unit amounts or agreeing Minor strings, saved FX and dimensions. Returns entry header (REST 201) |
| PUT/PATCH `/entries/:id` | `update_entry` | Full draft header/leg replacement; same line units. Returns entry header; PATCH retains the full-replace contract |
| DELETE `/entries/:id` | `delete_entry` | Draft UUID; success, no money fields |
| POST `/entries/:id/post` | `post_entry` | Draft UUID; REST entry includes legs/aliases, MCP returns posted header |
| POST `/entries/:id/void` | `void_entry` | Posted UUID and reason; REST original entry/legs with reversal link, MCP original UUID and reversal header. Mirror swaps raw saved legs |
| POST `/entries/recode` | `recode_entries` | Scoped filters and target account/center/project, draftOnly defaults true; counts (REST also changed line UUIDs). No monetary inputs or amount conversion |
| POST `/entries` accepts autoReverseDate on creation; no separate scheduling route | `set_auto_reverse_date` | Entry UUID and Gregorian date/null; updated header, no money. Saved date must satisfy state/order/period guards |
| POST `/bulk/entries/preview` | `preview_journal_entries` | Flat grouped rows; REST debit/credit are decimal /100 inputs, MCP debit/credit are integer minor units. Exact aliases already minor units. Read-only row/group previews, numeric totals and exact sum/imbalance strings |
| POST `/bulk/entries/import` | `import_journal_entries` | Same distinct row units, optional post flag; REST fileName/source. REST job (201), MCP job/group counts/errors; imported lines retain USD/identity FX |
| GET `/recurring-journals` | `list_recurring_journals` | Status/filter/pagination; REST data/count, MCP templates. Both expose numeric minor-unit legs and exact Minor strings |
| GET `/recurring-journals/:id` | `get_recurring_journal` | UUID; template with schedule, numeric/Minor legs, saved currency tag and fixed identity FX aliases |
| POST `/recurring-journals` | `create_recurring_journal` | Name/frequency/startDate, balanced legs and optional saved headers; numeric minor units/Minor aliases. Template header (REST 201), identity rate aliases |
| PATCH `/recurring-journals/:id` | `update_recurring_journal` | Partial saved headers and optional full leg replacement; same units. Template header, omitted currency retained, explicit null clears nullable headers; startDate immutable |
| PATCH status field on `/recurring-journals/:id` | `set_recurring_journal_status` | active/paused/completed; template header, schedule unchanged |
| POST `/recurring-journals/:id/pause` | `pause_recurring_journal` | UUID; toggle active/paused, returns header; resumed schedule catches up |
| DELETE `/recurring-journals/:id` | `delete_recurring_journal` | UUID; soft-delete success, generated ledger history retained |
| POST `/recurring-journals/run` | `run_recurring_journals` | No money input; organization-scoped posted count, commits whole catch-up/schedule per template |
| Internal journal generation/maintenance | Same generator behind run tools | processRecurringTemplates with journal type, processRecurringJournals and cross-org maintenance; fixed identity posting and count envelopes |

The companion inventories specify every field, validation and historical edge:
[CRUD](JOURNAL_WIRE_CONTRACTS.md), [lifecycle/import](JOURNAL_LIFECYCLE_WIRE_CONTRACTS.md),
[recurring](RECURRING_JOURNAL_WIRE_CONTRACTS.md) and
[compatibility foundation](../docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md).

## Units, aliases and supported ranges

- Raw stored units never rescale. USD/IRR/JPY/KWD 1250 remains 1250. Manual REST
  output retains historical /100 formatting even for zero/three-decimal currencies;
  templates and MCP retain numeric minor units. Automated base amounts are not
  converted again because their currency tag refers to a source document.
- Writes accept canonical nonnegative int64 strings and safe integer numeric
  aliases with exact agreement. Each amount and each summed side must fit
  0..9007199254740991; valid larger int64 input fails with 422 LEGACY_NUMERIC_RANGE.
  Historical manual signed amounts/sums must fit +/-9007199254740991. Counts,
  physical fields and identifiers are not money and receive no fabricated aliases.
- Manual saved FX must fit positive int32 millionths losslessly:
  0.000001..2147.483647, explicit quote_per_base. REST create additionally guards
  every nonidentity amount*scaled-rate intermediate and converted sum before
  existing Number math. Textual SQL reads preserve rateExact without numeric JSON
  decoding; null/invalid history remains explicit and mutation fails closed where
  qualified saved FX is required. Reversal never multiplies money by FX.
- REST import decimal text supports through 90071992547409.91 with at most two
  fractional places; numeric decimal inputs are capped at 2^45-1 before JSON can
  lose adjacent cents. MCP import uses integer minor units. Imports retain USD/1:1;
  no source/currency/locale inference or currency-aware scaling is introduced.
- Recurring templates have no configurable FX storage: rateExact "1",
  exchangeRate 1000000 and quote_per_base are the only supported rate contract.
  Saved currency remains a tag on verbatim generated money. Creation/update use
  full strict SDK object schemas, matching REST: unknown header fields and
  immutable startDate edits fail before mutation, rather than disappearing in
  raw-shape SDK normalization. Nested unsupported leg fields remain rejected.
- Dates are Gregorian date-only; recurring occurrence caps/counts are int32.
  Existing UTC month-overflow behavior and locked-date skip/consume policy remain.
  Quantity/unitPrice/tax/discount fields in shared stored template rows are not
  journal financial inputs or newly aliased fields.

## Combined fixture and mutation guarantees

`tests/integration/journal-integration.test.ts`/worker registers the actual three
tool groups through MCP SDK InMemoryTransport and calls imported REST handlers
with synthetic API keys/custom roles. Eighteen flows cover three writer origins,
two creation transports and legacy/exact/dual clients at 1250, above-int32 and
max-safe values. Imports preview without mutation; templates edit/pause/resume
through the opposite transport, generate once and retain posted history on delete.
Manual/imported drafts cross transports for full replacement, scheduling, recoding,
posting and reversal. Generated posted entries use explicit posted recoding and
the same reversal service. Both readers preserve raw amounts, saved currency,
identity/manual FX, and reciprocal original/mirror links. Retried posting/voiding
fails without financial or audit mutation.

One snapshot spans journal headers/exact-text legs, template headers/exact-text
legs/schedules, import jobs and audit count. Unsupported template headers/date
edits, malformed/range failures, foreign dimensions, cross-tenant mutations,
permissions, invalid credentials and period locks preserve that snapshot. Successful
no-op runs intentionally retain their existing audit event while leaving all
financial/schedule rows unchanged. Child regressions add all individual operations,
both tenant directions, alias conflicts, unsafe historical sums, forced SQL rollback,
concurrent reversal/generation, partial imports and internal maintenance.

No new schema/migration, history repair, public mode negotiation or IRR flag.
Preserved REST-create versus MCP/edit balance policies, already-base automated
semantics, fixed identity recurring posting, per-group import/per-template commit
boundaries, best-effort audit durability, MAX+1 cross-entry numbering races,
reference/lock races, import retry duplication and scheduled auto-reversal execution
retain MON-007/008/010 and QA/release qualification. Actual handlers/SDK fixtures
do not assert HTTP/session/OAuth/browser, PostgreSQL 16 runtime, independent
accounting, full-int64 domain or production qualification.
