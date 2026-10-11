# MON-137 self-review

2026-10-11 (Asia/Tehran), coding-assistant; self-review, not peer/human review.

Inspected scoped diff, recurring create/read/preview/generation services, schemas,
unit/SSR tests, REST/MCP/SQL fixture and ownership registries. Approved: corrected-fixture typecheck and full lint pass. Full lint has zero
errors and 103 existing warnings; scoped lint is clean. Four focused rendered/pure
groups, 436 unit tests and two real REST/MCP/SQL integrations pass. Inventory,
legacy-money, controller validation and whitespace checks pass.

Findings resolved:

- Standard price-first invoice preview extends the original decimal quantity.
  Recurring generation instead extends the stored rounded hundredths. Dedicated
  recurring calculator/fixtures now cover USD 1 x 1.234 = 123 minor units.
- Recurring defaults are USD, unlike contact/org-resolved receipt defaults.
  Explicit currency selection retains USD default; real REST/MCP tests verify it.
- Upcoming lineTotal is gross before discounts/tax. Labels retain that meaning,
  use saved currency and checked Minor aliases, and suppress invalid amounts.
- Saved details previously rounded quantities to whole numbers and multiplied
  money as Number. Checked bigint products/totals and fractional quantities now
  preserve units and low digits; large values wrap in a horizontally scrollable grid.
- Fixture used an incorrect generation return shape; corrected to numeric counts
  plus direct SQL rows. A concurrent baseline timeout was resolved by serial rerun.
- Obsolete reads cannot supply money for a different org/detail context; list
  requests abort, pagination uses filter generations, and drawers remount by org.

No new API/MCP operation is needed: existing adopted recurring transports support
the exact fields and schedule operations used here. No schema, stored units,
production IRR flags, FX policy or parent status changed. Financial limits, tax
timing and pending consumers remain explicit in CORE_UI_MONEY_CUTOVER/MONEY_MANIFEST.
Browser effect timing was source-reviewed, not live-executed; no screenshots or
independent accounting qualification claimed. Parents MON-131/MON-129/MON-007
retain separate combined acceptance. See attempt 1 for actual command outcomes.
