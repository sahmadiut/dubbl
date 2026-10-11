# MON-136 review 1

2026-10-11, Codex, honest self-review by the implementing assistant.
This is not independent peer/human/accounting/linguistic approval.

Reviewed the new wrapper/worker, actual adapters/scoped page/drawer consumers,
child evidence, registry/test-matrix diff and task acceptance evidence. Existing
correct runtime implementation is reused; this change establishes the parent's
independent composition rather than treating four child completions as acceptance.

- The new fixture executes authenticated REST and linked registered direct-DB MCP
  tools in the same organization session. It independently composes quote-to-
  invoice conversion, credit and prepayment applications to that invoice, and
  separate cash receipt recognition/void, across four currency scales and both
  transports. Literal SQL-text expectations preserve totals and low paid/due digits.
- Price-first quote versus extended-price credit/receipt rounding is tested in
  the SAME scenario: three half-minor prices save 3 versus 2 units. Conversion
  preserves the quote's amount. Credit void restores only its own allocation;
  the prepayment's one unit and remaining balance survive. UI presentation never
  performs a second currency conversion or infers stored units.
- Malformed create prices, unsafe prepayments and excessive applications reject
  on both transports with unchanged scoped SQL count/balance/allocation/journal
  snapshots. Foreign quote read rejection adds a combined-session organization
  scope check. Additional role/period/FX/accounting controls remain covered by
  existing domain fixtures and their child evidence, not claimed as exhaustively
  requalified by this new parent fixture.
- Different currency defaults are exercised with the same customer/org context.
  Explicit synthetic FX solely supports recognition when default KWD differs
  from organization currency. Grouped SQL text verifies mixed-currency loaded
  prepayment summaries; no inferred FX or all-page aggregate is introduced.
- All four child UI fixtures and 18 static/pure groups pass again, with full
  451-test unit, typecheck, clean new-file lint, zero-error full lint, money/legacy
  guards, controller validation and whitespace checks. Inventory includes only
  the new source files; no unrelated changes, schema/API/MCP or IRR flag edits.
- Current consumer owners and safe-number/sample/quantity/basis-point limits
  remain explicit. MON-131/MON-129/MON-007 retain their independent criteria;
  MON-133 retains unfinished accounting/banking/shared consumers. Browser effects,
  provider/PDF and production/full-int64/accounting qualification remain separate.

No blocking finding remains for MON-136's stated acceptance. Temporary PostgreSQL
was stopped after confirming zero fixture databases. Approve this integration
task only. Scoped commit/push and remote SHA/clean-tree confirmation are the final
delivery steps.
