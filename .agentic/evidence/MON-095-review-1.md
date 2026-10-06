# MON-095 review 1

2026-10-06, Asia/Tehran. Reviewer: codex. Kind: self; same assistant implemented
and reviewed. No independent human, accounting or production approval.

Reviewed new shared services/schemas, all five route files, consolidation MCP
registration, actual SDK/PostgreSQL worker assertions, boundary map, task split,
machine inventory and full verification results.

- Eleven configuration operation pairs are mapped and callable. Root money/FX
  aliases are not applicable; currency labels never change ledger units. Legacy
  USD creation/list/member and dashboard public names remain supported.
- Every adopted writer requires manage:reports; owned roots and group-scoped
  rules reject foreign access. Live child membership controls projections and
  add/config reads; explicit unlink allows revoked-access recovery. Full private
  organization settings are excluded, including unsafe historical money.
- Strict described tool/REST inputs reject malformed IDs/currencies/types,
  unknown monetary fields and empty updates. Saved invalid currency/rule and
  duplicate membership history fails closed. Saved rates/eliminations guard
  presentation changes. Output faults and all seven writer audit faults prove
  rollback across both transports; parent locks prevent duplicate member races
  and serialize config deletion/writes.
- Final targeted fixture, 297 unit tests, typecheck, full lint (127 existing
  warnings), clean changed-file lint, inventory/legacy gates and diff check pass.
  No schema, migration or production flag changes need qualification here.

Review corrections: removed extra EOF whitespace and refreshed source hashes;
added saved invalid rule, MCP invalid saved group update, rule output rollback
and delete returned-row validation before final tests.

Scope limitations are explicit: the pre-existing report persistence writer does
not yet acquire the parent lock, and report money/FX/arithmetic/functional-
currency history is MON-096. Accrual/revenue/recurring payables are separate
children. Parent MON-028 retains original combined criteria. No full-int64,
high-volume, independent accounting, migration/release or IRR rollout claim.

Approve MON-095's bounded configuration contracts against all three criteria.
