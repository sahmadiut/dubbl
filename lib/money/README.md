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
The exact-decimal FX service and persisted rate model are MON-004 work.

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

This task adds an internal arithmetic service, without new user-facing features,
REST/MCP contracts, schema changes, migrated records or production flags.
