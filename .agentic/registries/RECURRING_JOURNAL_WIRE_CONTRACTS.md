# Recurring journal wire contracts (MON-037)

2026-10-03, Asia/Tehran. Bounded REST/MCP/generation adoption, not MON-007 domain
cutover or production IRR qualification. Source: actual recurring schema, journal
generator, REST routes, registered MCP tools and disposable PostgreSQL fixtures.

## Operation inventory

All authenticated operations resolve the caller's organization through AuthContext;
MCP uses direct Drizzle access and wrapTool. API-key organization scope overrides
arbitrary organization headers. Write operations require `manage:recurring`.

| REST operation | MCP operation | Inputs and returned envelope |
|---|---|---|
| GET `/api/v1/recurring-journals` | `list_recurring_journals` | Optional status; REST also frequency, pagination and existing sort. REST paginated `data`, MCP `templates`; full saved headers and legs plus aliases |
| GET `/api/v1/recurring-journals/:id` | `get_recurring_journal` | Org-owned UUID; `{template}` with saved header/legs and aliases |
| POST `/api/v1/recurring-journals` | `create_recurring_journal` | Name, frequency, startDate, >=2 balanced legs; optional header below. `{template}` header plus fixed rate aliases, REST 201 |
| PATCH `/api/v1/recurring-journals/:id` | `update_recurring_journal` | Partial editable headers, optional full leg replacement; `{template}` header plus fixed rate aliases |
| PATCH status field | `set_recurring_journal_status` | active/paused/completed; `{template}` header; retained schedule is unchanged |
| POST `/api/v1/recurring-journals/:id/pause` | `pause_recurring_journal` | UUID, no financial body; toggle active/paused; completed fails 400; `{template}` header |
| DELETE `/api/v1/recurring-journals/:id` | `delete_recurring_journal` | UUID; soft-delete, `{success:true}`; posted entries unchanged |
| POST `/api/v1/recurring-journals/run` | `run_recurring_journals` | No financial inputs; `{posted}` integer count of generated entries in caller's org |
| `processRecurringTemplates(...,{types:["journal"]})`, `processRecurringJournals`, daily `processRecurringJournalsMaintenance` | Same guarded run generator | No transport inputs; fixed-rate journal path validates stored templates; count / `{journalsPosted}` |

Tools stay registered through the existing registerRecurringJournalTools entry in
tools/index.ts. Two new parity tools cover header/leg edits and pause toggle.

## Units, aliases, saved currency and ranges

- REST and MCP both retain **numeric stored minor-unit** debitAmount/creditAmount,
  unlike manual journal REST fixed-two-decimal output. USD 1250 = 12.50; IRR/JPY
  1250 remains 1250; KWD 1250 remains 1250. Nothing rescales or converts.
- Each leg accepts debitAmountMinor/creditAmountMinor canonical nonnegative int64
  strings, legacy safe nonnegative integer numbers, or both with exact agreement.
  Omitted sides are zero. Exactly one side per leg must be positive; raw debit and
  credit sums must be equal and nonzero. Aliases are always added on leg reads.
- Domain/ORM remain Number-based. Each amount **and each summed side** is bounded
  to 9007199254740991, even with string input. Syntax allows int64 through
  9223372036854775807 but larger-than-safe values fail before mutation with 422
  LEGACY_NUMERIC_RANGE. Sums use bigint; no rounded intermediate is accepted.
  Malformed syntax, decimals, negative values, alias conflicts and unbalance fail
  validation (REST 400; MCP isError). Unsafe historical rows/sums fail 422 on reads.
- Saved currencyCode is the existing template tag (active ISO code, default USD
  on create only). Metadata-only edits retain it; an explicit edit changes the
  tag without rescaling legs. Generated journal legs post those stored amounts
  verbatim with that tag. This preserves existing behavior; it does **not** claim
  currency-aware base conversion or a financially qualified foreign-currency event.
- Recurring templates have **no saved configurable FX column**. The declared
  contract is fixed `exchangeRate:1000000`, `rateExact:"1"`,
  `rateDirection:"quote_per_base"`. Header inputs may explicitly agree with this
  identity; any unsupported nonidentity/excess-precision rate fails before writes.
  Leg rate aliases are output metadata only; leg FX/currency/project inputs fail
  the strict leg schema because they cannot be saved. No live provider lookup,
  inversion or multiplication occurs. The FX product is the original amount at
  identity, so line/sum safety guards cover this path without claiming MON-007 FX.
- Generated journal lines explicitly persist identity FX, direction and provenance;
  the existing DB sync trigger retains `rateMigrationStatus:"exact"`. Template
  DTO aliases describe this fixed policy, not a fabricated historical rate record.
- quantity (integer hundredths), unitPrice (stored minor units), discountPercent
  (basis points) and taxRateId remain shared-schema fields on returned raw legs,
  unchanged and ignored for journal generation. They are not journal financial
  inputs; strict leg input accepts only description/account/amounts/cost center.
  No alias is added to these non-journal fields in this slice.
- Name/description are nonempty; frequency is weekly/fortnightly/monthly/quarterly/
  semi_annual/annual. startDate and nullable inclusive endDate are canonical
  Gregorian YYYY-MM-DD, ordered; startDate is immutable on PATCH. maxOccurrences
  is nullable positive int32 <=2147483647. Saved occurrence counts are nonnegative
  int32 and increments preflight overflow. Frequency uses existing UTC advancement,
  including JavaScript month overflow behavior; no new calendar policy is claimed.
- Optional reference/notes/endDate/maxOccurrences use null to clear. PATCH omitted
  fields retain stored values; optional currency has no create default on PATCH.
  Headers/legs and schedule outputs retain existing envelopes and normal counts.

## Authorization, atomicity and scheduling

Accounts and cost centers must be active, undeleted and owned by the caller's org
before create/edit/activation/generation. Header edits also validate retained legs;
detail/list reads allow same-org inactive historical dimensions but reject foreign
dimension FKs. Parent predicates recheck org/type/nondeleted state for mutations.
Soft deletion can stop malformed templates without parsing their legs.

Create header/legs commit together; edit locks the parent and atomically replaces
header/legs. Status, toggle and generation use the same parent lock; deletion's
UPDATE also takes that row lock. Pausing can stop a malformed template; resuming
validates retained legs/dimensions. Resume leaves nextRunDate unchanged and therefore
catches up missed due occurrences (correcting the former misleading description).

Every journal template's entire due catch-up runs under a parent FOR UPDATE lock.
After locking, generation rereads status/schedule and current legs, validates amounts,
sums, dimensions, date advancement and occurrence limits **before writes**, then
posts headers/legs and advances the template in the same transaction. SQL failures
roll back the whole template catch-up; repeated/concurrent runs of that template do
not duplicate occurrences. Invalid or unsupported history is not filtered away or
consumed: it fails visibly and leaves that template's schedule unchanged.

Existing locked-period/closed-year behavior is preserved: strict scheduler checks
consume a skipped occurrence and advance without posting. Dates and counters share
the template transaction. Runs commit **per template**, not across all templates or
organizations: an earlier successful template can remain committed if a later one
fails. Audit uses the existing awaited best-effort logger; it is not transactional
compliance durability and scheduled system runs do not invent user audit identities.

## Qualification and exclusions

Pure fixtures: tests/recurring-journal-wire.test.ts. Actual handlers/API-key/custom
permissions and MCP SDK InMemoryTransport on migrated PostgreSQL:
tests/integration/recurring-journal-wire.test.ts and its worker. Covers legacy,
exact/dual, int32-plus/safe-max amounts, four currency scales, malformed/conflicting/
unsupported amounts/rates/sums/dates, retained currency, dimensions and two tenants,
every operation, deletion, locked/closed dates, catch-up, concurrent run, failed
leg replacement, failed final schedule write, corrupt history and maintenance.

HTTP/session/OAuth/browser, arbitrary full-int64 arithmetic, full base-currency
posting qualification, other recurring document kinds, generic recurring CRUD,
current-month-end policy, reference/period-lock races, cross-template MAX+1 journal
number allocation, operational batch limits, best-effort audit durability, and
production IRR remain domain/QA/other boundary tasks. No schema/migration, configured
database, provider, rollout flag, deployed site or posted history is changed.
