# Integrated asset and loan contracts (MON-026)

Verified 2026-10-09, Asia/Tehran. Implementing-assistant self-review; synthetic
PostgreSQL fixtures qualify the supported wire and transaction behavior.
Parent acceptance joins MON-086..090 without replacing their operation contracts.

## Complete boundary inventory

Every linked registry specifies actual REST paths, MCP names, inputs, outputs,
envelopes, permissions, aliases, units, null behavior and supported ranges.

| Boundary | Operation pairs | Authoritative contract | Actual fixture |
|---|---|---|---|
| Asset/category list, detail, create, update, delete | 10 | [ASSET_MASTER_WIRE_CONTRACTS](ASSET_MASTER_WIRE_CONTRACTS.md) | asset-master.test.ts |
| Single/batch depreciation and rollback | 3 | [ASSET_DEPRECIATION_WIRE_CONTRACTS](ASSET_DEPRECIATION_WIRE_CONTRACTS.md) | asset-depreciation.test.ts |
| Revaluation, impairment and disposal | 3 | [ASSET_VALUATION_WIRE_CONTRACTS](ASSET_VALUATION_WIRE_CONTRACTS.md) | asset-valuation.test.ts |
| Construction cost list/add and capitalization | 3 | [ASSET_CWIP_WIRE_CONTRACTS](ASSET_CWIP_WIRE_CONTRACTS.md) | asset-cwip.test.ts |
| Loan list, detail, create, update, delete, payment | 6 | [LOAN_WIRE_CONTRACTS](LOAN_WIRE_CONTRACTS.md) | loans.test.ts |
| Functional-currency settings boundary | REST PATCH /organization; update_organization and set_organization_currency | [ORGANIZATION_WIRE_CONTRACTS](ORGANIZATION_WIRE_CONTRACTS.md) | organization-settings.test.ts and parent fixture |

Fixture paths are under tests/integration. Their workers invoke actual exported
Next handlers with synthetic API keys and real registered MCP SDK transports.
The parent asset-loan-integration.test.ts combines writers in one migrated random
database, independently of the individual child fixtures. No dev server is needed.
All 25 asset/loan tools and both settings tools retain strict described schemas.

Money preserves fixed integer cents and agreeing canonical ASCII *Minor strings.
Numeric outputs remain safe integers; signed changes retain signs and nullable
money retains paired nulls. The effective range is +/-9007199254740991, restricted
by each operation's sign/aggregate rules. Canonical int64 inputs above that range
fail 422 LEGACY_NUMERIC_RANGE before mutation. REST loan principal additionally
retains decimal-major input; MCP principal remains integer cents. Exact bigint
intermediates do not change stored units. Annual rates are basis points, useful
life and terms are months, production readings are physical units, dates are
Gregorian YYYY-MM-DD and instants are UTC. Identity posting FX is exact 1 with
quote_per_base direction. Loan creation requires a two-decimal base currency.

## Combined lifecycle and ledger evidence

The parent fixture creates an exact-client category and zero-cost CWIP asset.
A numeric 5000-cent cost and exact 7000-cent cost accumulate to 12000. REST
capitalization and MCP replay move the full 12000 into service exactly once.
The first charge is 1000, NBV 11000; rollback restores NBV 12000 and preserves
the original journal lines. Explicit-target cross-transport rollback replay
adds no mutation. A later charge restores NBV 11000 before revaluation.

Revaluation to 15000 adds 4000 equity surplus; impairment to 14000 consumes 1000
of it. Disposal for 13000 yields a -1000 gain/loss, no implicit catch-up on the
valued asset, transfers the remaining 3000 surplus and clears its root balance.
REST/MCP disposal and detail agree, including signed valuation and CWIP history.
Every resulting journal balances in bigint and uses USD identity FX.

A 12000-cent zero-rate loan has three 4000-cent repayments. Each displayed
schedule target is submitted concurrently through REST/MCP and posts once;
principal sums exactly to 12000 and final status is paid_off. The bank's statement
balance remains 76543, matching the existing loan GL-only payment contract.
Paid-history deletion rejects 400 without mutation. This does not invent funding,
statement transactions, generic settlement allocations or external transfers.

## Functional-currency history and posting accounts

Assets, category residual templates and loans lack per-row currency snapshots.
Organization settings now reject changing the functional currency with any such
root history, including unposted, zero-value and soft-deleted records. This uses
the existing 409 history policy alongside journal/payroll guards. Both settings
tools and REST share updateOrganizationSettings and the organization row lock.
Unrelated tenants do not block an empty organization from selecting a supported
currency. Same-currency and other metadata edits remain allowed.

Parent fixtures assert zero journals before each root-history denial, repeat
through REST and both MCP settings tools, soft-delete the roots and repeat all
three paths. Concurrent initial asset creation/currency selection serializes:
the selection either finishes first or rejects after the root exists. Once the
asset exists, the other currency cannot replace its implicit meaning.

New depreciation GL postings require live active owned accounts in the posting
base currency. A wrong-base account fails 422 through both transports without
creating a charge, journal or audit. Historical reversals retain original account
IDs/currency/FX and still permit owned inactive/deleted accounts; they do not
reprice original lines. The child GBP reversal fixture uses GBP posting accounts
and separately proves reversal preserves GBP after a synthetic direct base edit.
Direct SQL legacy edits are fixture-only and are not a public migration workflow.

## Cross-writer safety and supported failures

Organization-first root locks coordinate master, cost, capitalization,
depreciation, valuation/disposal, loan and settings mutations. Parent races cover
capitalization versus depreciation and disposal versus a single charge: one
April charge survives, accumulated depreciation is 2000 and disposal completes.
Child fixtures cover master/lifecycle protection, keyed/unkeyed races, scoped
historical references, period tiers/closed years and injected audit/output faults.

Parent whole-slice snapshots include roots, children, schedules, accounts, bank,
GL and audit. They prove auth/permission, foreign-root, unsafe range, conflicting
alias, unknown organization field and unsupported lifecycle failures leave those
tables unchanged. API-key usage metadata is intentionally outside the financial
snapshot. Custom permissions override the owner role; spoofed org headers cannot
redirect the API-key context. Registration assertions cover every tool's strict
schema and field descriptions; representative actual unknown-input calls cover
masters, CWIP, depreciation, valuation, loans and settings.

Depreciation and rollback after valuation remain unsupported and fail 422. The
parent checks both paths and verifies batch depreciation atomically rolls back
an earlier ordinary charge when a valued asset rejects. This is an explicit
supported-range boundary, not a new remaining-life/usage schedule. Disposal uses
the adopted valuation carrying policy; disposed assets reject fresh depreciation.
Opening CWIP funding remains a precondition and is never reconstructed.

## Remaining qualification

No schema/migration, historical rescale, original GL-line edit, application-DB
mutation, production IRR flag or deployment change. Independent accounting,
full-int64 consumers, legacy remediation, per-root currency snapshots,
post-valuation schedules, large-batch/table-lock performance, browser/session/OAuth
and production acceptance remain money/release or separately scoped feature work.
Completion of this bounded integration contract does not qualify those limits.
