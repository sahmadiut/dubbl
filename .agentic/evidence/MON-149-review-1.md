# MON-149 self-review 1

2026-10-11 (Asia/Tehran). Reviewer: coding-assistant. Kind: self; no independent
peer or human approval is asserted. Reviewed the implementation diff, scoped
ownership registry and actual verification results in MON-149-attempt-1.md.

Approved this bounded expense/mileage UI task:

- Ordinary input/preview/save share currency-scale exact rounding and safe bounds;
  no parseFloat, monetary Number product, fixed cents formatter or guessed USD
  remains in scoped consumers. Creation resolves the organization mileage setting;
  saved currency owns edit/reimbursement. Numeric object fields are compatibility
  values, validated against canonical aliases before bigint use.
- Mileage amount uses original entered ratios; distance/rate metadata rounds
  separately. Saved amounts are never recomputed from rounded metadata. Physical
  int32 distance and nonmoney tax basis points retain their units. Zero edit/API
  policy is separate from positive creation. The new fixture verifies these saved
  values and preserves tax, center and mileage metadata through both transports.
- Saved header/item totals, null-rate aliases, malformed/range/currency cases and
  summary grouping fail visibly. English decimal input names and existing table/
  sheet layout remain usable under DEC-005. Workspace/drawer keys reset drafts
  on identity/organization/open changes; live browser lifecycle is unqualified.
- Recurring type=expense keeps MON-099 fixed-two prices and gross-only generation,
  explicit USD/default currency and schedule/supplier controls. An added negative
  subminor case exposed the retained recurring positive-infinity tie behavior
  (a tiny negative could round to zero); lexical negative input now rejects before
  rounding and final focused tests pass. This does not alter backend contracts.
- Verification passed: 6 focused groups, 461 unit tests, four real disposable
  PostgreSQL fixtures, typecheck, scoped/full lint, money and controller guards,
  diff checks. Existing unrelated lint warnings remain. No schema/API/MCP change,
  history rescaling, provider call, application DB, build/dev or deployment.

No remaining blocking finding in MON-149. MON-133/MON-129/MON-007 retain their
independent combined acceptance; sibling UI tasks, full-int64, locale/provider
and production IRR qualification are not completed by this approval.
