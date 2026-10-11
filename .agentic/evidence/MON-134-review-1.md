# MON-134 review 1

2026-10-11, Asia/Tehran. Reviewer: coding-assistant. Kind: self. This is the same
operator that completed the work; no independent or human approval is asserted.

Reviewed the full task source diff, exact invoice schema/calculator and domain
wire inventory, authenticated currency GET envelopes, form submit/error flow,
shared compatibility consumers, rendered tests and actual REST/MCP/SQL fixture.
Also reviewed the user-authorized CI repair and its live failure log.

## Findings

- Exact prices remain strings through unitPriceExact. Preview uses the actual
  transport policy; safe numeric bridges occur only after the backend's bigint
  products/totals are guarded. Currency is explicit for invoice submission.
  Independent SQL values confirm max-safe low digits and zero/three digit scale.
- Sub-minor positive/negative ties distinguish REST price-first from MCP extended
  rounding; neither transport is falsely claimed to agree with the other's
  historical policy. Tax basis points and quantity units are unchanged.
- Draft default preview rendered dashes because its display checked the optional
  caller prop rather than its resolved compatibility currency. Repaired and
  covered by real rendered default-caller tests.
- Missing currency, invalid price/quantity, missing tax, unsafe products/sums and
  malformed fields fail closed. The shared editor renders an alert and suppresses
  totals, and InvoiceDrawer gates saving/reparses payload. Stale customer requests
  are aborted and keyed to org/customer. Tax editor remounts on org changes.
  Line/currency edits revalidate, including unchanged-currency selection.
- Tax percentage/reclaim/deposit conversions are nonmoney basis-point controls.
  Other drawers keep explicit fixed-two/extended preview defaults and their
  pending ownership, without an unsupported claim of saved parity.
- CI had one real failure in MON-021: captured UTC date predated later approval.
  Freezing only the synthetic fixture clock repairs the rollover; a snapshot-
  backed earlier-date rejection verifies the product guard remains enforced.
  No production date logic was weakened. Historical done evidence is untouched.
- The entry task/sibling split drafts are necessary controller planning records
  and are included coherently; none of the siblings or parents is closed.

## Verification and limits

Evidence: MON-134-attempt-1.md and CI-expense-utc-midnight-fix-2026-10-11.md.
Unit suite: 391/391; focused editor render/adapter: 8/8; editor/invoice/expense
integration: 3/3; repaired combined integration: 1/1. Typecheck, changed-file
lint, full lint (0 errors, 105 existing warnings), exact inventory and legacy
guards passed. Focused controller workflow tests passed: 40 run, 39 passed and one
Windows symlink-permission skip. Final validation passed for 187 tasks. Both
optional exhaustive graph replay cases remain unverified.
No new CI success, browser effects/keyboard session, screenshot,
independent accounting/locale/security/migration review or production approval
is inferred. Dedicated fixtures use local PostgreSQL 18 rather than CI's 16.

Recommendation: approve this bounded child; all scoped acceptance checks passed;
retain MON-131/MON-129/MON-007 combined acceptance and MON-135..137 caller cutover.
