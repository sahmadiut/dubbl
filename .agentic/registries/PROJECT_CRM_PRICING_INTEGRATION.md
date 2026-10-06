# Project, CRM and pricing integration contracts (MON-027)

2026-10-06, Asia/Tehran. Implementing-assistant self-review. This parent qualifies
the combined safe-number contract slice implemented by MON-091 through MON-094;
child attempt/review evidence remains immutable. Requirements: SOURCE.md
database-and-currency-migration and api-backward-compatibility; ADR-006.

## Complete boundary map

| Domain | REST/MCP operation pairs | Authoritative field/envelope/range map | Shared direct-DB services |
|---|---|---|---|
| Price books, tiers and resolver | 10 | [Pricing](PRICING_WIRE_CONTRACTS.md) | pricing.ts, pricing-wire.ts |
| CRM pipelines, deals, activities, summaries/analytics | 16 | [CRM](CRM_WIRE_CONTRACTS.md) | crm.ts, crm-wire.ts |
| Project/member/time/timer/task/milestone/assignment/team/checklist/comment/label/note | 48 | [Project master](PROJECT_MASTER_WIRE_CONTRACTS.md) | project-master.ts, project-master-wire.ts, project-master-operations.ts |
| Cost registration, preview, invoice allocation, profitability | 7 plus the singular cost MCP adapter | [Project billing](PROJECT_BILLING_WIRE_CONTRACTS.md) | project-billing.ts, project-billing-wire.ts |

These maps enumerate every boundary, input/output envelope, writable/read-only/
nullable alias and retry policy in this slice. Existing names/envelopes remain;
REST adapters and MCP tools call the same organization-scoped Drizzle services.
MCP registration is present in lib/mcp/tools/index.ts, with wrapTool and described
strict Zod inputs. There are 81 operation pairs and 82 domain MCP tools.

Price unitPrice, CRM valueCents, project budget/hourlyRate/fixedPrice/totalBilled,
member hourlyRate/costRate, milestone/assignment amounts, time rates and billing/
report money retain numeric **fixed cents** and explicit canonical fieldMinor
strings. Rates are cents/hour. Supported nonnegative money is 0..9007199254740991;
report net money may be signed within that bound. Exact inputs must fit int64
syntax and this safe business bridge. No locale/currency/magnitude rescaling or
public representation header is inferred. Invalid/conflicting aliases reject;
valid int64 inputs beyond the bridge fail classified LEGACY_NUMERIC_RANGE 422.

Percent/probability, markup basis points, physical quantity, whole minutes,
seconds, counters and pagination retain their individually documented units and
ranges. Bigint intermediates guard products, sums and ratios before numeric
conversion. Dates are canonical Gregorian; timestamps are UTC instants.
Independent financial/full-int64/FX/migration/production IRR gates remain open.

## Combined behavior

- Member rates override project rates only when creating a time entry without an
  explicit rate. Existing entries retain their saved rates after member/project
  edits, including an explicit zero. Billing values original minutes with the
  saved rate; rounded invoice hour quantity does not replace the exact amount.
  Billing allocations become visible in master detail, update totalBilled, and
  make allocated time immutable. Keyed replay across transports changes nothing.
- Milestones created through master operations feed progress billing. Allocated
  milestone amounts cannot decrease below invoiced cents or be deleted. Remaining
  amounts agree across master and billing services. Currency changes reject
  time/member/milestone/billing and financial-source history, including expense-only
  registrations; they never relabel already allocated time or sources.
- Fixed price edits now reuse projectFixedInvoiced inside the master transaction.
  A proposed price below the attributed, nonvoid/nondeleted fixed allocation
  returns 409 before changing the project or audit. Recharged registered expenses
  are excluded using the same computation as preview/generation, rather than
  comparing totalBilled blindly. Equality and valid increases remain allowed.
  Unsupported name-only/mixed-currency history fails closed as in billing.
- Organization-first/project row locks serialize master/time edits and invoice
  allocation. Racing time edit/invoice yields either the new rate or a rejected
  edit against the billed entry. Racing fixed price reduction/allocation permits
  only a valid outcome, with nonnegative remaining fixed price. Audit failure
  rolls back invoices/lines/numbering/allocation/totals across the combined state.
- Price-book tiers feed actual invoice/quote create lookup. Resolver returns unit
  price only; document services bound extended quantity products. Price currency
  changes preserve integers and affect future resolution; existing invoice
  currency, stored line price and totals remain snapshots. An incompatible
  future USD invoice against a newly JPY book rejects without mutation. Racing
  tier edit/document create snapshots a complete old or new price under the
  organization lock. Invoice/quote transports retain their own documented price
  input units/defaults in INVOICE_WRITE_WIRE_CONTRACTS and QUOTE_WIRE_CONTRACTS;
  callers must not feed decimal major-unit prices into fixed-cents CRM/project
  fields. Matching explicit Minor aliases avoid that ambiguity.
- CRM, pricing and projects can share an owned contact; there is no automatic
  deal-to-project conversion, posting or pricing-to-project rate assignment.
  The combined fixture transfers an invoice value to a deal explicitly as
  valueCentsMinor and verifies agreement. JPY 1250 remains 1250 fixed cents.
  CRM and project monetary scalar summaries independently require a currency
  filter for mixed currencies; no cross-domain total or implicit FX is invented.
- Root, nested and saved references remain scoped to organization and project.
  Foreign organization headers do not override API-key scope. Foreign contacts,
  inventory and project roots reject without modifying domain/audit snapshots.
  Public user projections exclude password/auth fields.

## Verification and limits

tests/integration/project-crm-pricing.test.ts creates a random migrated database
and runs actual API-key REST handlers plus complete MCP SDK registration and
in-memory transport. It exercises the interactions above in both transport
directions, including audit faults and races. The four child workers independently
cover every operation, roles, invalid/expired auth, unsafe stored/output values,
mutation faults and lifecycle cases. Invoice/quote workers qualify the adjacent
shared pricing lookup. No Next dev server is required.

On a small default PostgreSQL cluster, use --test-concurrency=1 for the combined
seven-worker regression command: simultaneous full-schema migrations can exhaust
the cluster's shared lock table. This is fixture provisioning, not a reason to
alter application/deployment DB settings.

Safe-number aliases do not enable full-int64 calculations, currency-scale/FX
costing, production IRR, migration contraction, localization or independent
accounting/release approval. Existing invoice void/deletion/reversal allocation
repair, removed-member/dangling references, untagged historical attribution and
high-volume/performance qualification remain the documented broader gates.
This task changes no schema, migration, posted history or rollout/deployment flag.
