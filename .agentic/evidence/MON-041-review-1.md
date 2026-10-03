# MON-041 self-review 1

2026-10-03, Asia/Tehran. Reviewer: codex, the implementing assistant. This is
self-review, not peer/human/accounting/security/production approval.

## Review performed

Read the actual diff, new wire/services, quote routes/tools, frontend create/send
payloads and DB schemas; compared task scope, ADR-006 and immutable dependencies.
Reviewed executable unit/real authenticated REST/SDK fixture assertions and
observed successful outcomes. No requirement is waived by this review.

- Monetary units retain their distinct REST-major/MCP-minor meanings. Both
  aliases are explicit; integer-ratio signed rounding and bigint sums guard all
  monetary products/totals before Number/ORM conversion. Stored line quantity and
  discounts remain hundredths and basis points. Safe-number range remains clear.
- Reads preserve REST/MCP envelopes, numeric values, contact/line money aliases
  and organization isolation. Historical foreign relations reject; no unscoped
  related records are returned to the caller. List/count snapshot is consistent.
- Draft PATCH supports whitelisted legacy headers, replacing lines explicitly;
  arbitrary tenant/status/header-total updates no longer bypass authorization.
  Create pricing/omission/defaults and lookup-only item semantics are retained.
- New/restored writes preflight saved monetary values and balances; organization/
  document locks and atomic numbering/line/header mutations prevent duplicate
  conversion/send and partial data after errors. Fault injections cover both
  early line errors and late generated-invoice/quote-update errors. Old/new issue
  dates and conversion date honor strict locks.
- Progress billing preserves original discount/tax and percentage policies;
  exact residual allocation fixes rounding overbilling/lost remaining amounts.
  Remaining zero, not within-one-unit tolerance, closes the quote. Milestone
  line duplicates/ownership and positive stored quantity are validated.
- REST overbilling keeps remaining/requested fields and adds exact strings.
  Malformed conversion JSON cannot trigger full billing. Requested email fails
  validation before mutation and provider work follows committed state. The
  documented postcommit delivery limitation is deliberate and unqualified here.
- Corresponding MCP parity includes all operations and new draft deletion, direct
  DB services, AuthContext, wrapTool and described fields. Existing registration
  requires no index change. Invoice helpers are exported without behavior change;
  real invoice write/lifecycle regression workers passed.
- Docs/inventory match actual paths and supported range. No schema or rollout
  change occurs. Existing deprecated quote route allowance is removed, not raised.

## Findings and disposition

The initial milestone expected result was corrected from 619 to 618 after checking
the existing rounding order; final full unit and operation fixtures pass. The
preexisting arbitrary PATCH, one-unit forgiveness, float math/outside-transaction
reads and silent malformed full-conversion behavior are addressed. No remaining
blocking finding in this bounded task.

Approve MON-041's three acceptance criteria within the documented safe-number
coexistence slice. MON-019 keeps combined receivable acceptance; full int64,
external writers/provider/PDF/UI/session/OAuth, configuration races, financial
and production qualification remain assigned work. No independent sign-off or
deployment authorization is implied. Next task: MON-042.
