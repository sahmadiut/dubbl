# MON-059 review 1 - implementing-assistant self-review

2026-10-04, Asia/Tehran. Reviewer: coding-assistant. Kind: self. Reviewed shared
wire/services, REST adapters, MCP registration, UI changes, actual fixtures,
docs/registries/manifest/inventory and evidence. No independent/human approval.

## Findings and disposition

- Preserved numeric minor-unit amount and added canonical amountMinor, exact
  agreement, safe bounds and nested aliases. Currency is retained from schedule
  and bill, not payment defaults; unsupported data rejects before effects/disclosure.
  UI review found fixed x100 parsing/prefill: now exact with selected currency,
  string submission, safe/positive guard and failed-attempt messages. Removed
  deprecated parseMoney adoption; display/locale rollout remains explicit.
- Shared direct-DB org-scoped service and described one-operation MCP tools
  follow wrapTool/registration conventions. Review/fixtures found SDK raw shapes
  silently strip unknown fields; strict registerTool input schemas now reject
  financial/state override arguments, including process's empty input schema.
- Organization/schedule locks and fresh status reread remove stale attempts;
  MON-056 settlement is reused inside the caller transaction. Status/processedAt
  and mandatory process/payment audits cannot commit separately from cash.
  Final audit injection proves complete rollback and pending retry. Independent
  valid items commit during partial runs, with classified item failures/counts.
- Concurrent REST/MCP process, cancellation races, retries and future/deleted/
  cancelled/completed exclusion assert serialized outcomes without duplicate cash.
  Legacy failed/processing rows are deliberately not re-armed. No old history
  linkage or unattended job is inferred. Multiple creates schedule distinct intent;
  there is no balance reservation, so live settlement rechecks outstanding amounts.
- CRUD/audit atomicity, dates/locks/closed years, read-only/custom-role/key/org
  checks, saved null/foreign/unsafe/deleted history, safe max, EUR saved date/
  currency/carrying/payment FX and missing-rate/account negatives are exercised
  through actual PostgreSQL handlers/SDK. Same-tenant historic reads remain guarded.
- Full 177-unit/eight-domain integration regressions pass, final extra MCP fixtures
  pass, typecheck and focused lint pass. Full lint retains 155 baseline warnings,
  no errors. Inventory and legacy guard pass. No schema edit needs migration files.

## Compatibility and limits

Completed/processing schedule deletion now rejects instead of hiding cash provenance.
Process failures remain pending with explicit response failures instead of stranded
failed/processing states; consumers check failed even on successful HTTP/MCP calls.
These are documented correctness repairs. Cancellation can release stale settled
intent without changing ledger history. Unsupported historic money/relations still
require qualification rather than guessing/rewrite.

Period/config/contact-merge/bank writers outside this adopted service are not claimed
serialized by these locks. Full-int64, independent financial/security/migration/
release and IRR gates remain assigned work. UI code/exact adapters were inspected
and tested; no live browser or linguistic qualification is claimed. Existing
manual/dashboard execution is preserved; no scheduled Trigger job existed here.

## Result

Approve all three bounded MON-059 criteria. No blocking finding remains. MON-021
combined acceptance stays open. Close controller, commit/push as requested and stop;
next MON-060 expense CRUD contracts.
