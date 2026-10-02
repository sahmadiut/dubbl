# Project brief

## Outcome

A maintainable Dubbl fork with selectively implemented Bigcapital behavioral parity, English/Persian UI, RTL, Persian date/numeral presentation and production-safe Iranian rial accounting. Success means the same economic event yields the same exact ledger amounts across locale/direction/calendar, before and after migration.

## Known versus unverified

Known: the user has an initial Dubbl fork and supplied a 37-page implementation plan. No fork source, commit or URL was supplied to this packaging task. The plan describes Next.js/React/TypeScript, PostgreSQL/Drizzle, Tailwind/shadcn/Radix, background jobs, object storage and Docker. These are baseline hypotheses until AUD-001 verifies them. Never treat the plan's spot audit as proof of this fork's exact schema or feature status.

## Architectural direction

Retain Dubbl as the runtime, organization model and domain architecture. Bigcapital is a public contract/behavior reference. Audit before building. Preserve functioning bank rules, matching, warehouse transfers, payment links and period locks. Maintain evidence for all valuable missing capabilities.

Money: PostgreSQL bigint minor units, exact-decimal FX (precision to be selected and justified), explicit rounding, direction and provenance, historical transaction rates and safe string API representations. Migrate expand / dual-read-write / verify / switch / contract. Preserve balances; separate legacy malformed-data remediation from type widening.

Localization: next-intl initially without new URL prefixes; user/organization/cookie/header/fallback resolution; centralized exact number/currency/date adapters. Default Persian presentation may use Persian numerals and calendar, independently of organization currency/timezone. Canonical dates remain Gregorian/UTC. Logical CSS, root direction, directional primitives and bidi isolation apply to the complete product, portal, email and PDFs.

## Scope boundaries requiring decisions

Optional branches, toman input/display, SaaS parity and financial/bank providers need explicit value/availability decisions. Iranian statutory tax/payroll/e-invoicing compliance, accounting calendar rules and hosting jurisdiction are not automatically promised. CBI API availability and future redenomination details are not assumed. Recheck current official currency/provider facts at the relevant implementation and release gates.

## Estimates from the plan

The source estimates roughly 22–30 calendar weeks for a focused 4–6 person team, about 65–90 or 70–90 person-weeks in different sections, and roughly 45–70+ weeks solo. These are planning ranges, not commitments. Its October 5, 2026 timeline is illustrative; this backlog intentionally has no invented schedule.

## Initial state

The orchestration package is prepared and structurally tested. Product implementation remains unverified. AUD-001 is the only initially ready task. Eight role documents express responsibilities, not eight running agents or available human employees.
