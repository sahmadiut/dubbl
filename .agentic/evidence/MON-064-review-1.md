# MON-064 self-review 1

2026-10-04, Asia/Tehran. Reviewer codex, implementing assistant. Actual source/diff
and fixture review; no peer/human or independent financial/security approval.

## Findings and resolution

- All statement/bulk/detail/profile routes and eight strict described MCP tools
  use shared direct-DB/AuthContext services and guarded responses. New tools
  register once; no HTTP self-calls. Existing numeric statement money stays minor,
  bulk preview data.amount stays major, exact aliases are explicit and agree.
- Currency-scale major conversion, BAI2 integer minor input, signed debit balances,
  zero/two/three decimal units, host-independent canonical dates, parser row widths
  and native currency/sign guards were inspected. All twelve formats have pure
  and actual adapter fixtures; malformed input cannot become zero or a skipped row.
- Safe minor coexistence/decimal Number bounds are enforced before committed effects.
  Bigint sum/running balance arithmetic and opaque JSON numeric guards prevent
  precision loss. Exact aliases cannot repair already-rounded Number inputs.
- Organization/parent ownership precedes bank reads; detail scopes organization,
  row bank/currency and nested references. Rules guard numeric thresholds and
  owned coding references. Actual keys/custom roles/header spoofing/foreign parents/
  references/deletion and unchanged-state assertions pass.
- Adopted writers lock org/bank; rows/history/balance/job/audit are atomic. Forced
  DB failures after earlier account writes and locked later dates leave no changes.
  Duplicate checks cover existing/within-file/concurrent retries. All-duplicate
  imports cannot reset balances; explicit-opening overlap includes existing rows.
- Rules previously marked imported lines reconciled without journals. Suggestions
  now leave status unreconciled; real rule posting/automatic reconciliation remains
  MON-069. Bulk invalid-batch behavior is intentionally corrected to all-or-nothing;
  previews retain actionable row errors. Registry records both compatibility changes.
- Initial parser/MCP/fixture defects and warnings were repaired. Final focused pure/
  PostgreSQL/type/changed-file lint checks pass; full 189-case suite and bank account/
  read regressions pass. Whole lint has 148 existing warnings, no errors. Money
  inventory/hash/legacy gates and diff checks pass; synthetic fixture DBs removed
  by harness and server stopped. No schema/migration/production flag change.

## Limits

Lightweight decoded-text parsers with documented ambiguity/format limits; no binary,
complete native-format validation, generic resumable/source-mapping/object imports
or historical bad-unit repair. Numeric coexistence only; no full-int64 contract.
Duplicate identity can collapse truly identical rows without external references;
retries may add history/jobs/audit, and no separate legacy-writer concurrency guarantee
is made. Other banking/reference/period configuration writers remain their tasks.
PostgreSQL 18 synthetic migrated fixtures only; no browser/OAuth/session/provider/
PostgreSQL 16/production/independent financial/IRR approval. MON-021 remains a final
combined gate and AUD-002 discrepancies remain outside this bounded import task.

## Decision

Approve all three bounded MON-064 criteria based on actual source/fixture evidence
with the limits above. Complete through controller, commit/push as user authorized,
then stop. Next MON-065.
