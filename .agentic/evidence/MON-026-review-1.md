# MON-026 review 1

2026-10-09, Asia/Tehran. Actual reviewer: coding-assistant; kind: self.
Reviewed source/diff, linked operation registries, parent/child fixture assertions,
actual verification output and MON-026's three unchanged acceptance criteria.
No independent peer, human, accountant or production sign-off is implied.

## Findings and disposition

- Twenty-five adopted asset/category/lifecycle/loan operations have documented
  REST/MCP input/output contracts. Existing fixed-cent and REST loan decimal-major
  distinctions remain explicit; exact aliases and safe/derived bounds are tested.
  No full-int64, currency conversion or new negotiation is advertised.
- Organization settings hold the same org lock as asset/category/loan creation.
  History checks include soft-deleted/unposted roots and do not affect unrelated
  tenants. Same-currency/metadata edits retain behavior. Parent actual transport
  tests and snapshots qualify all three currency-setting entry points and a race.
- Depreciation checks new posting account currency under account share locks.
  Both REST/MCP fail without mutation for a GBP account in a USD posting. Undo
  remains an exact historical reversal; requiring current base currency on those
  original accounts would break that behavior. The adjusted GBP child fixture
  continues to qualify the distinction and unchanged original line snapshots.
- Parent financial figures independently reconcile 12000 construction cost,
  1000 monthly charge/undo, 4000 upward surplus, -1000 impairment, -1000 disposal
  gain/loss and three 4000 principal payments. Journals balance exactly, targeted
  REST/MCP payment races post once and bank statement balance remains unchanged.
- Unsupported post-valuation charge/rollback and batch processing reject before
  commit. This meets the unsupported-input criterion without claiming a new
  remaining-life schedule. Original history is preserved and no posted economics
  are reconstructed. Opening CWIP funding and generic loan settlement remain
  explicit preconditions/domain boundaries.
- Permission overrides, API-key scope/header precedence, unknown-input rejection,
  all-tool schema descriptions, foreign asset/loan operations and unsafe/conflicting
  amount failures have parent assertions. Child regressions additionally retain
  per-operation period, history, custom-role and atomic output/audit fault coverage.
- Both initial failures were test assumptions exposed by the supported contracts,
  corrected without weakening financial invariants. All affected workers reran
  successfully; four unchanged child workers passed the initial run. Typecheck,
  21 focused pure checks, final clean changed-file lint and money gates passed.
- Entry dirty work was reviewed as the active task's partial implementation. All
  planned staged files are owned by MON-026, including generated inventory and
  closure evidence; unrelated work was neither changed nor included.

Approve the bounded task. No unresolved acceptance finding. Independent accounting,
large-batch/table-lock performance, full-int64, legacy currency remediation,
per-root currency snapshots, browser/session/OAuth, new valuation schedules and
production acceptance remain separately scoped qualification. No rollout flag,
schema or deployment changes are inferred from controller completion.
