# Journal CRUD wire contracts

MON-035, 2026-10-02 (Asia/Tehran). Source-verified slice of MON-018; self-review
and synthetic PostgreSQL/SDK fixtures, without full ledger or IRR qualification.

## Operations

| Boundary | Input | Output and units | Guard / authorization |
|---|---|---|---|
| `GET /api/v1/entries` | Existing optional limit | `{entries,total}`; `totalDebit` remains a fixed-two-decimal string; `totalDebitMinor` is the raw stored debit sum string | API-key/session org; sums guarded with bigint before compatibility output |
| `POST /api/v1/entries` | Header and at least two described line schemas | `{entry}`, 201; header only, no returned monetary fields | `create:entries`, org-owned active references, period/closed-year and monthly limits, amount/sum/FX-product preflight; atomic header/legs |
| `GET /api/v1/entries/:id` | Entry UUID | `{entry}` with legs; REST fixed-two-decimal strings preserved, additive `debitAmountMinor`/`creditAmountMinor`, saved FX metadata | Parent org scope, cross-org historical account rejection, guarded ORM amounts and textual SQL FX read |
| `PUT/PATCH /api/v1/entries/:id` | Full header/line replacement, not a partial leg patch | `{entry}` header only | `edit:entries`; draft state, old/new period dates, dimensions/fiscal year org scope; transactional replacement, conditional draft update |
| `DELETE /api/v1/entries/:id` | Entry UUID, no money | `{success:true}` | `edit:entries`; draft-only, scoped parent, period locks; single conditional delete with FK leg cascade and audit |
| MCP `list_entries` | Existing status/date/page/limit filters | Legacy safe minor-unit `totalDebit` number plus `totalDebitMinor` string | AuthContext org, existing deleted-row exclusion, exact guarded debit sum |
| MCP `get_entry` | `entryId` | Header and legs: safe minor-unit numeric fields plus exact aliases and saved FX metadata | Parent org, textual SQL FX read, safe ORM amounts |
| MCP `create_entry` | Header and same described line schema | `{entry}` header only | `create:entries`, org dimensions, period/monthly limits, preflight and header/line transaction plus audit |
| MCP `update_entry` | `entryId` and full replacement header/lines | `{entry}` header only | `edit:entries`, draft/old-and-new locks, org dimensions, transactional conditional draft update and audit |
| MCP `delete_entry` (new parity operation) | Draft `entryId` UUID, no money | `{success:true}` | Same direct-DB delete service as REST; `wrapTool` and AuthContext scope |

Tools remain registered through the existing `registerEntryTools` entry in
`lib/mcp/tools/index.ts`. Each input field has a description. No HTTP self-calls.
REST/PATCH alias counts as one full-replace operation; five MCP operations are adopted.

## Units and compatibility

Line input `debitAmount`/`creditAmount` retains nonnegative minor-unit numeric
integers. Optional `debitAmountMinor`/`creditAmountMinor` accepts canonical ASCII
nonnegative int64 strings; both aliases must agree. Omitted sides default to 0,
including exact-only inputs. No magnitude/locale/currency-based rescaling.
USD/IRR/JPY/KWD 1250 remains stored 1250. This contract does not repair historical
IRR input mistakes or apply currency scales to REST's retained legacy /100 output.

REST list/detail legacy amounts are **strings in the historical fixed-two-decimal
format**, not cents numbers. The exact aliases always carry raw minor-unit strings.
MCP list/detail numeric amounts are minor-unit Numbers. Header-only create/edit
responses need no fabricated monetary aliases; callers read detail for saved legs.
REST's legacy decimal strings now use bigint formatting, avoiding rounding at the
safe-number edge (`9007199254740991` becomes `90071992547409.91`).

Manual CRUD stores user-supplied leg amounts; automated journal-automation writes
already converted organization-base amounts and may tag `currencyCode` with the
original document currency and saved conversion rate. Reads expose stored amounts
unchanged and never apply FX again. `totalDebitMinor` is an exact **raw stored line
sum**, preserving existing list semantics: a manually mixed-currency sum is not a
currency-homogeneous or converted economic total. Historical currency snapshots,
harmonizing manual/automated semantics and exact domain posting remain MON-007.

`exchangeRate` remains positive int32 millionths on writes (`1000000 = 1`).
`rateExact` accepts positive quote-per-base decimal strings under MON-004's
20-whole/18-fractional policy, but must be exactly representable as int32 millionths
for these Number consumers. Dual rates must agree; explicit `rateDirection` must
be `quote_per_base`. Only when both rate aliases are omitted does 1:1 default.
Reads use the saved rate, normalized as a decimal string, plus existing format,
direction, provenance and migration status. Null/invalid historical rates remain
null/invalid; they are never guessed from current exchange-rate tables. Historical
legacy zero rates can be read with explicit null/invalid exact metadata but cannot
be newly written. Nested Drizzle numeric JSON would pass FX through Number:
adopted reads instead select `rate_exact::text` inside relational queries.

## Supported business ranges and validation

- Each amount and raw debit/credit sum must fit 0..9007199254740991. Valid int64
  strings beyond this range fail before writes with `LEGACY_NUMERIC_RANGE`/422.
  Canonical syntax, sign, unsafe numeric input, conflicting aliases and out-of-int64
  strings fail validation (REST 400; MCP `isError=true` with validation details).
  These are CRUD write bounds; historical reads preserve signed safe integer
  amounts/sums in -9007199254740991..9007199254740991 without rescaling.
- Rate range is 0.000001..2147.483647 in exact six-place increments. Positive exact
  rates outside that coexistence range fail 422 without rounding. Invalid/nonpositive
  legacy rates or conflicts fail validation.
- Existing REST create balance policy is retained: same-currency 1:1 entries need
  raw debit/credit equality; other entries compare summed rounded base amounts,
  allowing at most one stored unit per line of existing rounding slack. Before
  Number math, each non-1:1 `amount * exchangeRate` product and each converted sum
  must fit the safe integer range. Products use bigint for the guard even if they
  exceed int64. Identity-rate conversion bypasses multiplication. This is a guarded
  legacy algorithm, not full exact FX conversion or currency-scale qualification.
- REST full-replace and MCP create/update retain their existing raw-equality
  balance policy; MCP does not apply saved rates for balance checking. The existing
  cross-transport policy difference stays explicit for MON-007 reconciliation.
- Canonical Gregorian date-only create/edit/reversal dates, UUID references,
  active same-org accounts/centers, nondeleted same-org projects/fiscal years,
  old/new period locks, nonzero balance, at least two legs and auto-reverse ordering
  are preflighted. Draft state is rechecked in edit/delete SQL. Concurrent entry
  number allocation still uses existing MAX+1; a collision rolls back header/legs.
  Detail reads reject historical cross-org account FKs before exposing account
  labels, while reads of same-org inactive historical accounts remain permitted.
- Invalid requests leave entries/legs/audits unchanged. New writes never rely on
  a post-commit serializer error. Unsafe historical amounts and unsafe sum reads
  return classified compatibility errors with no repair/mutation. Permission and
  absence errors retain 403/404 where classified; MCP's preexisting generic missing
  entry/non-draft edit errors remain `isError=true`. Shared `wrapTool` now returns
  period-lock errors with status 422, matching REST.

No full-int64 reads/writes are advertised, and no public exact-mode switch is
introduced. Additive aliases are always available on adopted reads and accepted
on adopted writes. Legacy deprecation/removal remains ADR-006/REL-004.

## Qualification and exclusions

`tests/journal-wire.test.ts`: aliases/defaults/canonical errors, currency unit
preservation, sums/product overflow, retained balance policies, saved-rate/null
history and exact legacy decimal formatting.

`tests/integration/journal-wire.test.ts`/worker invokes real REST API-key handlers
and MCP SDK/client tools over InMemoryTransport on a migrated disposable database:
legacy/exact/dual clients, above-int32/safe-max values, amount/rate errors, both
tenant directions and dimension ownership, custom-role/auth failures, both date
locks/closed years, posted immutability, snapshots before/after rejected mutations,
forced PostgreSQL leg failures after header insert/update/delete, safe-row aggregate
overflow, raw unsafe history, already-base automated postings, invalid legacy FX
and deletion cascades/audits. No HTTP OAuth/session/browser qualification.

MON-036 owns post/void/recode/set-auto-reverse-date, reversal and bulk import/preview
contracts, including relational exact-FX reads there. MON-037 owns recurring CRUD/
pause/run and generation. MON-018 keeps combined integration acceptance after all
children; MON-007 owns full posting/domain cutover and policy reconciliation.
Shared period-lock error classification is regression-tested through actual MCP
CRUD, but unrelated MCP workflows are not independently qualified by this slice.
Schema, migrations, production/configured DB, rollout flags and deployment are
unchanged. No full build, dev server or Docker is required or executed.
