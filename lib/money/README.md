# Exact money core

New monetary calculations import `lib/money/exact.ts`. A `Money` carries a signed
bigint minor-unit amount and a validated currency. Final amounts must fit signed
PostgreSQL bigint, including in memory before the storage migration. Intermediate
products/ratios are arbitrary precision. Currency mismatches and overflow throw.
USD 1250 stays USD 12.50; IRR 1250 means 1250 rial. No rescaling occurs.

`scales.ts` is a frozen snapshot of the installed ICU catalog used at MON-002,
with IRR explicitly set to zero as required by the project plan. It deliberately
does not consult runtime ICU during calculations. A future currency regime must
have a separate historical policy; do not change a posted currency's scale in
place. This metadata does not authorize or enable IRR production rollout.

`parseMajor` accepts ASCII decimal strings, with optional sign, mandatory whole
digits and optional fractional digits. It rejects whitespace, group separators,
exponents, symbols, localized digits and malformed suffixes. Input is limited to
256 characters. Locale parsing/formatting belongs to later boundary work.
`toMajorDecimal` emits an exact ungrouped decimal string without Number coercion.

Parsing, multiplication and tax all require an explicit rounding mode:

| Mode | Behavior for fractional minor units |
|---|---|
| reject | Throw unless exact |
| toward-zero | Truncate toward zero |
| floor | Round toward negative infinity |
| ceiling | Round toward positive infinity |
| half-away-from-zero | Nearest; ties away from zero |
| half-even | Nearest; ties to the even integer |

These are primitives, not jurisdictional tax or posting policies. Callers must
select the appropriate operation policy explicitly. `taxMoney(net, "12.5", mode)`
uses plain percent, not basis points. Quantity, discount and FX calculations use
`multiplyRatio`; the caller owns units, FX direction and target currency policy.
MON-004 adds exact FX string storage, backfill and guarded legacy coexistence;
see `../db/FX_MIGRATION.md`. Provider/inverse arithmetic and consumer cutover
remain MON-005/006/007/008 work.

`allocateMoney` requires nonnegative bigint weights with a positive total. It
allocates absolute amounts using largest remainders, breaks ties by input order,
then restores the sign. This deterministic residual policy conserves totals and
mirrors refunds; it is not automatically applied to existing workflows.

`fromLegacyNumber` and `toLegacyNumber` are explicit minor-unit bridges requiring
safe integer numbers. They never rescale and throw outside the safe-number range.
The deprecated functions in `lib/money.ts` retain their v1 behavior (including
permissive parsing and floating-point limitations) until consumers are migrated
by MON-006/007/008. Do not use them in new work.

ESLint's `money/no-new-legacy` blocks new imports and increases in imported-binding
references using `scripts/legacy-money-baseline.json`. Existing allowances are a
ceiling for migration, not permission to add uses. Remove allowances as consumers
are migrated; do not regenerate/increase them to silence errors. The guard also
rejects literal dynamic imports, require calls and re-exports. It is a static
guard, not whole-program dataflow analysis; computed module paths and unchanged
reference counts still require code review.

## Wire foundation (MON-011)

`wire.ts` supplies explicit money/rate DTOs and Zod inputs. `moneyDto` returns
`amountMinor` as a signed int64 string plus currency; legacy mode additionally
returns a safe numeric `amount` without changing units. `moneyInputSchema`
requires at least one alias and exact agreement when both are present.
`legacyMoneyInput` explicitly rejects values outside safe-number compatibility.
Use these aliases only for minor-unit contracts, never decimal-major prices.
Rate DTOs retain int32-millionths `rate` in legacy mode and an exact `rateExact`
decimal with `quote_per_base` direction; exact mode omits the numeric alias.

`stringifyWire`, the shared REST helpers and `wrapTool` default to legacy numeric
JSON, safely serializing nested bigint within the safe-number range. Unsafe or
nonfinite values produce `WireCompatibilityError` / `LEGACY_NUMERIC_RANGE` (422).
Explicit exact mode serializes bigint as integer strings and rejects already
unsafe Numbers. No global BigInt prototype changes or magnitude-based fallback.

The currency FX REST/MCP slice now accepts `rateExact` aliases during lossless
int32-millionths coexistence; see [FX contracts](../../.agentic/registries/FX_WIRE_CONTRACTS.md)
for actual operations, units and unsupported ranges. Legacy conversion preview
is limited to matching currency scales and safe integer intermediate products.
Remaining endpoint/tool adoption remains MON-012 and its domain children.
Direct NextResponse calls, domain input schemas and raw SQL aggregates require
their own migration. The ORM still exposes safe numbers; full-range business
paths remain MON-007/008. Serializing a handler result cannot undo earlier writes;
validate requests and supported business range before mutations. See
[ADR-006](../../.agentic/docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md) for adoption and
the proposed deprecation policy; no actual sunset date is agreed. Production
flags, schema and stored units remain unchanged.

Contact CRUD/list REST and MCP now accept/return nullable `creditLimitMinor`
strings alongside numeric cents/limits. Guarded support remains 0 through
9007199254740991 before writes. REST list balances add `*Minor` aliases with
exact SQL-text/bigint totals and fail unsupported/mixed-currency pages with 422.
See [contact contracts](../../.agentic/registries/CONTACT_WIRE_CONTRACTS.md);
full-range consumers and other contact/report/bulk envelopes remain future work.

Budget CRUD accepts signed `totalMinor`/`amountMinor` aliases alongside cents,
validates all amounts/dates/org references before transactional writes, and uses
bigint sums/distribution within the signed safe-number range. GET detail returns
both aliases; header envelopes are unchanged. Budget reports remain pending. See
[budget contracts](../../.agentic/registries/BUDGET_WIRE_CONTRACTS.md).

Public payment-link/portal JSON now returns additive monetary `*Minor` strings
while retaining safe numeric envelopes. Statements use bigint sums and reject
mixed currencies/unsafe totals; quote status/activity writes share a scoped
transaction with monetary preflight. Seven strict, org-scoped MCP tools expose
the same operations. See [public contracts](../../.agentic/registries/PUBLIC_PORTAL_WIRE_CONTRACTS.md).
Checkout, providers, backups, opaque payloads, public frontend/PDF display and
full-range business consumers retain their assigned tasks. IRR remains disabled.
