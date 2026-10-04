# MON-065 self-review 1

2026-10-04, Asia/Tehran. Reviewer codex, implementing assistant. Actual source/diff
and fixture review; no peer/human/independent accounting or security approval.

## Findings and resolution

- Four REST adapters and five MCP operations use shared scoped direct-DB services.
  Replaced tool registrations were removed; MCP SDK fixtures prove unique names,
  strict described fields, numeric/exact clients and preserved result envelopes.
- Split minor-unit aliases and expense REST-major/MCP-minor inputs were inspected.
  Review caught the new MCP operation initially mirroring REST's major numeric
  field. It now follows project minor-unit conventions, with actual USD/JPY/KWD/
  IRR dual-alias adapter fixtures and final six-suite/unit/type checks passing.
- Exact tax/split/currency-scale FX arithmetic and safe totals precede commit.
  Tax applicability/control references and compound rejection are explicit.
  Reverse charge is shared by category splits and single coding; expense category
  breakdown is retained. Foreign/inactive/deleted references cannot be posted.
- Self-link/control/fallback/journal/bank/claim/items/audits share transactions.
  Forced audit trigger failures verify complete rollback and retain the original
  correction journal. Bulk preserves per-item failure behavior and no duplicate
  posting on repeated IDs. Concurrent adopted operations have one active posting.
- Corrections validate prior journal source/status/base/rates/references and the
  bank leg against the movement. They reuse saved FX after quote change/removal.
  Corrupted history/base changes fail safely. Matching/transfer/statement-linked
  movements remain outside categorization and are not overwritten.
- Claims created from bank movements are paid and journal-linked. Ordinary claim
  approval and repeated bank creation fail; audit identity survives a cleared bank
  link. This prevents the former draft double-recognition path. Generic bank undo
  must still coordinate claim state in MON-068/MON-021; registry and public docs
  state that limitation rather than promise an unimplemented reversal.
- Final 191 unit tests, six actual migrated PostgreSQL suites, tsc and generated-MDX
  typecheck pass. Full lint has 148 existing warnings/no errors; final affected
  lint is clean. Synthetic databases are removed and the fixture server is stopped.
  No schema/migration/IRR/production rollout change. Refreshed inventory and final
  controller/publication integrity checks are required before committing.

## Limits and decision

Safe numeric coexistence only. No full-int64, historic bad-unit/unlinked-claim
repair, bank matching/transfer/undo/rule rollout, cross-legacy-writer concurrency,
browser/session/OAuth/provider/PostgreSQL 16/production or independent financial
qualification. MON-021 retains combined gates and AUD-002 discrepancies.

Approve all three bounded criteria on actual source/fixture evidence with these
explicit limits. Complete through the controller, commit/push as requested and
stop. Next MON-066; bank-expense undo handoff remains MON-068/MON-021.
