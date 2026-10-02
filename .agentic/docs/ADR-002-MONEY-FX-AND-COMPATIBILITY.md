# ADR-002: exact money, FX and compatibility boundaries

Date: 2026-10-02 (Asia/Tehran). Technical architecture decision for CI-002; numerical rounding/precision and compatibility-window owner decisions remain pending. This document describes the target, not completed migration.

## Runtime and ownership

Keep Dubbl's Next.js App Router, PostgreSQL/Drizzle schemas, organization-scoped REST and direct-DB MCP, domain services and Trigger.dev jobs. Bigcapital public behavior supplies requirements only; no implementation or framework transplant. Retain existing authorization, period locks, audit, payment links, bank rules and warehouse workflows. API and MCP must share domain policy and preserve AuthContext organization scope.

## Money

Canonical money is an exact integer count of the currency's minor units. Target PostgreSQL bigint and TypeScript bigint domain arithmetic; never Number conversions, parseFloat or fixed `/100` ledger arithmetic. Formatting and parsing belong at boundaries. Currency metadata supplies display scale. Existing USD 1250 remains 1250 after type widening; no value or IRR rescaling by magnitude. Existing fixed-cents API/MCP contracts remain legacy contracts until MON-006 explicitly versions/evolves them. Existing code is not declared exact merely because this ADR exists.

MON-001 inventories every storage/input/calculation/output boundary, MON-002 implements exact primitives and rounding, MON-003 widens storage, MON-007/008 cut over consumers. Rounding modes and allocation residual rules require explicit accounting decisions and signed/negative/tie/large-value tests. Do not silently choose a numerical policy in this guardrail task.

## FX

Target exact-decimal storage and arithmetic, explicit base/quote direction (quote units per one base unit), source, effective date and persisted transaction rate. No implicit 1:1 fallback. Existing `converter.ts` uses integer millionths and Number math; MON-004 must backfill from that scale exactly and qualify inverse/extreme values before switching. Select numeric precision/scale and rounding with evidence in MON-002/004; no arbitrary precision claim here. MON-005 handles provider availability, historical lookup and validation. Presentation locale must not influence rate direction or posting.

## Migration and wire compatibility

Expand, support both representations, verify, switch consumers, then contract only after the real deprecation window. Drizzle schema changes require generated committed migrations. Preserve balances, posted amounts, stored historical FX, date-only Gregorian values and UTC instants. Separate malformed legacy data remediation from widening/backfill. JSON cannot encode bigint: target versioned decimal integer strings for money and exact decimal strings for FX. Legacy v1 numbers remain limited to validated safe ranges rather than being rounded or silently changed to strings. MON-006 defines version negotiation, errors and a proposed compatibility window; actual owner agreement is still required. REL-004 owns delayed contraction.

## Qualification

MON-010 qualifies migrations and all money consumers; QA-001 qualifies financial/API invariance and QA-005 qualifies backup/restore/rollback. CI-001's synthetic migration fixtures do not qualify exact-money cutover. Both AUD-002 accounting defects remain open with their assigned remediation tasks. No schema, stored value, legacy JSON contract or application arithmetic changes in CI-002.

Source: [plan money/FX design](../sources/SOURCE.md#money-and-database-architecture), [migration](../sources/SOURCE.md#database-and-currency-migration); inspected `lib/money.ts`, `lib/currency/converter.ts`, `lib/db/schema/auth.ts`, `lib/api/auth-context.ts`, `lib/mcp/errors.ts` and dependency [CI evidence](../evidence/CI-001-attempt-1.md).
