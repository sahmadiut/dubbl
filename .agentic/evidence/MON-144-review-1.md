# MON-144 review 1

2026-10-11, Asia/Tehran. Reviewer: codex. Kind: self. The same operator
implemented and verified this change; no peer or human approval is claimed.

## Findings and verification

- Reviewed scoped drawer/list/detail diffs, exact helper/component, transport
  inventories and adapter/rendered/SQL tests. No float monetary parsing or
  currency-less money display remains in the migrated credit consumers.
  Explicit USD default follows both transports. Extended-price preview matches
  the credit domain rather than borrowing quote price-first semantics.
- Saved aliases validate prior to bigint use; prices are never silently
  reconstructed through Number. Safe low digits, malformed/unsafe alias/input,
  summary missing currency and both application balance bounds are covered.
  Physical quantity/100 is intentional and now preserves fractional display.
- Applications use customer/currency/state filtering and amountMinor. Handlers
  revalidate; backend rules remain authoritative. Improved dialog reopening to
  discard prior candidates/amounts; page state is keyed by org/document. Full
  reads reload after send/apply/void instead of mixing numeric headers and bigint.
  Main reads abort; list/summary results retain their context. No browser race
  simulation is claimed. The latest-100 lookup remains explicit.
- Kept summary semantics: all statuses, all filters, single currency. Mixed/
  unsafe aggregates visibly fail while independently tagged list rows remain
  available. Empty/untagged totals show a dash. Static USD examples are illustrative.
- New fixture uses real REST/MCP credit and invoice writers/recognition, then
  independently checks SQL stored units, allocation and exact invoice unwind.
  Existing credit suite independently passed domain negatives and atomicity.
  Large safe draft prices do not imply large posting/full-int64 qualification.
- Corrected a rows-array lint warning and fixture TypeScript annotations before
  completion. Final typecheck, scoped lint, 417 unit tests, two integration
  fixtures, inventory/legacy guards, controller and whitespace checks pass.
  Full lint has zero errors and 103 existing warnings outside this scope.
- Ownership, compatibility/nonmoney scales and pending sibling/parent work are
  documented. No API/MCP/schema/migration, production flags or history changes.
  MON-136/131/129/007 combined acceptance remains open. No mandatory human review
  applies to this bounded child; no provider/PDF/browser/production approval is
  invented. Source and evidence support all three MON-144 criteria.

## Result

Approve this bounded child on actual self-review. No remaining scoped finding.
Complete controller done, commit task-owned files, push origin/master, verify
remote SHA/clean tree, report the next controller task and stop.
