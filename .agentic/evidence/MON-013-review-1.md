# MON-013 self-review 1

2026-10-02, Asia/Tehran. Reviewer: codex, the implementing assistant; **self**
review, not independent peer or human approval. Reviewed actual source/diff,
task criteria, FX operation inventory and `MON-013-attempt-1.md` results.

## Findings and disposition

- Numeric REST input is int32 millionths while numeric MCP input is decimal
  quote-per-base. Dedicated adapters preserve these units; tests prove `1` maps
  to 0.000001 in REST and 1 in MCP. Strings normalize without Number conversion.
  Aliases require agreement, and supported stored quotes are unchanged.
- Guards execute before rate/audit mutations, including the entire bulk parse.
  PostgreSQL fixture snapshots verify failures cannot partially insert a valid
  first row. Valid exact rates outside storage coexistence yield classified 422;
  malformed/conflicting input remains validation error. No hidden precision
  expansion or rounded fallback is advertised.
- Scoped update/delete queries contain organization predicates in addition to
  scoped lookups. Actual API-key auth ignores an arbitrary conflicting org header,
  and two-tenant/role fixtures reject foreign-ID writes and unauthorized writes.
  MCP directly uses the bound AuthContext and Drizzle. No HTTP self-calls added.
- Manual edits now clear all six automatic-provider metadata fields and use
  existing audit behavior. DB triggers preserve exact quote/format/provenance;
  same-currency updates are validated before writing. Existing history/provider
  integration tests still pass. Reference edits do not post into locked periods
  or modify previously saved journal quotes.
- Stored DTOs never promote pending/quarantined rows. Exact-row alias mismatch,
  unsupported format or direction fails closed. Historical inverse reads have
  deliberately different six/18-place precision, clearly documented; missing
  quotes expose explicit null aliases. No fake 1:1 fallback added.
- Legacy conversion preview is guarded before Number multiplication and rejects
  currency scale mismatches. It remains explicitly unsupported for full-range
  or exact-string amounts and mixed-scale pairs; this is not domain cutover.
  Small same-scale conversion/refunds retain existing numeric behavior.
- Broader regression exposed a stale pre-MON-011 message assertion. Replaced it
  with the compatibility class/code/status check, preserving int64 rejection.
  Final unit 88/88, integration 19/19, typecheck and changed-file lint pass.
  Full lint retains only 167 existing warnings. Source inventory verifies.
- Parent rollout was too broad for a coherent change. Its new children inherit
  original prerequisites and leave all integration criteria intact; no cycle or
  silent requirement removal. Only MON-013 is submitted as implemented.

## Decision and limits

Approve this bounded currency FX boundary task. No unresolved scoped defect
found. Evidence accurately distinguishes registered-handler/PostgreSQL fixtures
from HTTP transport/OAuth/session or UI qualification. Audit delivery retains
the existing best-effort helper; transactional guarantees are not invented.
No schema/migration, production flag, deployment, client sunset or human
accounting approval is implied. Other domains and full-range/mixed-scale
conversion remain their named tasks. Next is MON-014.
