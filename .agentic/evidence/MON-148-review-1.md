# MON-148 self-review 1

2026-10-11, codex; self-review, not independent peer/human review.

Reviewed five page diffs, shared payment adapters and rendered amount preview,
pure/REST/MCP/SQL assertions, compatibility mappings, source inventory and removed
legacy allowances. Approve this scoped UI cutover based on attempt-1 evidence.

- Safe numeric history and optional canonical agreeing Minor aliases preserve
  original raw units; signed noncash allocation carriers are not coerced positive.
  Bigint sums retain low digits. Currency grouping prevents false USD totals;
  averages preserve legacy signed ties. Batch/remittance total/currency agreement
  is checked rather than inferred. No UI FX calculation or second conversion.
- Batch preview/payload share exact parsing with identity/supplier/currency/due
  checks and safe aggregate limit. Schedule preview and submit share exact
  currency/range/due checks. Both emit supported Minor fields and explicit saved
  currency. Real transports and independent SQL cover scales and low digits.
- Historical allocation button did not allocate existing cash; it posted a new
  invoice payment. No safe allocation operation exists. Its removal and visible
  historical-balance explanation are explicitly documented. Existing pay,
  schedule/process, batch submit/remove/remittance/email controls are retained.
- Context keys/aborts and scheduled read generations reject stale reads; delayed
  batch confirmation verifies the organization. Keyboard bill selection and
  decimal input labels/errors plus wrapping support English behavior/layout.
  Pure/static renders verify the actual scheduled preview component. Effects and
  real browser interactions are source-reviewed, not browser-tested.
- Source review maps existing invoice/bill controls and receipt/prepayment
  drawers to completed owners; no standalone payment drawer exists. Other core
  consumers remain in MON-149..152, with parent integration open. Existing
  public/auxiliary domain acceptance is not claimed here.

Final focused/scoped checks are clean; full unit suite 455/455 and five integration
families pass. Full lint warnings are outside the changed slice. Synthetic IRR
fixtures do not enable production IRR. No schema/API/MCP/provider/flag change,
historical rescale, full-int64 or parent qualification claim. No blockers remain
for MON-148; MON-133/MON-129/MON-007 retain independent acceptance.
