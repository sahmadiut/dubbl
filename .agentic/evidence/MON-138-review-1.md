# MON-138 review 1 - honest self-review

2026-10-11, Asia/Tehran. Reviewer: coding-assistant; kind: self. This is the
same operator that implemented the task, not an independent peer/human review.

Reviewed the actual BillDrawer/shared editor diff, new bill adapter, pure/render
and REST/MCP/SQL fixtures, ownership/inventory changes and source-verified split.
Acceptance mapping and actual command results are in MON-138-attempt-1.md.

Findings resolved before approval:

- Generic invoice preview alone cannot express bill reverse-charge payable.
  The explicit bill policy uses billWriteTotals and renders Amount due separately.
  Selected rate kind must resolve; invalid previews suppress numeric totals.
- Reusing invoice REST price-first rounding would give 3 rather than 2 minor
  units for USD 0.005 times 3. Both bill transports' extended-price contract is
  asserted against independent SQL totals and preserved unchanged.
- Duplicate hold can save pending_approval even when the checkbox is off.
  Success notice now follows the saved status; warn/block/hold/approval fixtures
  verify the authoritative backend policies and exact amounts.
- Currency/line/supplier edits invalidate preview state and clear old duplicate
  warnings. Save and duplicate-confirm handlers use resolved currency and exact
  parsed input; supplier/org GET cleanup/context checks were source reviewed.

No unrelated files, schema migrations, backend operations, posted unit rescale,
production flags or parent acceptance changes were found. Supporting child task
records are needed for a valid controller graph; siblings remain todo. All scoped
pure/render/transport checks, 402 unit tests, typecheck, zero-error lint, inventory,
legacy guard and structural validation passed. Existing 105 lint warnings remain.

Limitations: no live browser effects/interaction, screenshot requirement,
independent accounting/linguistic/migration/security approval, full signed-int64
public workflow or production qualification. Existing numeric quantity and safe
workflow limits are explicit; remaining consumers have named owners. MON-132,
MON-129 and MON-007 keep independent integration criteria. No scoped blocker.

Result: approve MON-138 for this bounded bill-creation UI delivery only.
