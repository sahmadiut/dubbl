# Currency regime registry

Owner: MON-009, maintained by OPS-001. This is an evidence registry, not executable monetary policy. No official effective date, future ISO code or conversion factor is invented here. Reverify actual official sources before implementation or release.

| Regime ID | ISO code | Display minor units | Effective from/to | Scale to previous | Official source / retrieval date | Decision status |
|---|---|---|---|---|---|---|
| Current-rial candidate (not a persisted ID yet) | IRR | 0 as proposed by [Markdown plan](../sources/SOURCE.md#rial-and-redenomination-design) | not verified | not applicable | pending official/CLDR verification | proposed |
| Future regime | unspecified | unspecified | unspecified | unspecified | pending official publication/verification | not enabled |

Ledger currency and optional toman display/input are different concepts. Historical posted values retain their original regime. Any reporting conversion must be explicit and versioned. Existing potentially mis-scaled IRR records need identified provenance and a separate remediation decision, not numeric-magnitude heuristics.

CI-002: organization functional-currency selection is now gated by `lib/currency/rollout.ts` through the shared REST/MCP schema. The code financial gate is false, and `IRR_PRODUCTION_ENABLED` defaults to false; a premature true request is rejected. See [ADR-003](../docs/ADR-003-LOCALE-AND-CURRENCY-ROLLOUT.md) for exact scope, preexisting/foreign-IRR limitations and later qualification. This adds no verified regime metadata or official currency facts.
