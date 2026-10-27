# Iran business capabilities delivery plan

Owner instruction, 2026-10-27 (DEC-010): add the reviewed Iran business capabilities, excluding all new tax work, in a separate phase before phase 5. Stable phase ID 12 is scheduled after phase 7 and before phase 5; existing phase IDs are retained. Execution order: `0, 1, 2, 3, 4, 11, 6, 7, 12, 5, 8, 9, 10`. AI-001 remains next. Phase 5 is preserved for possible later owner reconsideration; its open tasks wait for IRN-001. The new tasks do not depend on phase-5 tasks.

Scope: configurable organization modules and personal workspaces; reusable service catalog/pricing; checks/Sayad evidence tracking and promissory notes; Iranian party/bank data and CSV imports; explicit rial/toman convenience; operational Jalali dates and configurable fiscal periods; optional POS, hardware adapters and bounded offline synchronization; non-tax payroll; record collaboration and optional organization chat. External integrations need actual interface/access/hardware evidence; local Sayad tracking is not official registration.

Excluded: new tax engines/rates, VAT, payroll tax, tax-specific identifiers/reporting, Modian/e-invoicing/fiscal-device integration, and statutory tax calendars. The owner will define Iranian tax tasks later. Existing tax functionality stays intact. No new statutory insurance submission is included. DEC-006 is superseded only for the explicitly listed toman and operational fiscal-period/non-tax payroll scope; other deferred work remains deferred. Stripe freeze, IRR qualification, native/accounting review and production-release gates remain intact.

All 21 implementation/design tasks and the independent IRN-001 acceptance task are mandatory backlog work; POS/chat are optional to enable in the product.

## Tasks

| Task | Outcome | Depends on (in addition to AI-013 and L10N-012) |
|---|---|---|
| [MOD-001](../tasks/MOD-001.md) | Define module registry and lifecycle contracts | None |
| [MOD-002](../tasks/MOD-002.md) | Enforce organization module settings across execution paths | MOD-001 |
| [MOD-003](../tasks/MOD-003.md) | Add personal workspace preferences and business presets | MOD-002 |
| [SVC-001](../tasks/SVC-001.md) | Implement goods and services catalog types | MOD-002 |
| [SVC-002](../tasks/SVC-002.md) | Implement service pricing and sales document integration | SVC-001 |
| [SVC-003](../tasks/SVC-003.md) | Deliver services catalog and pricing user workflows | SVC-002, MOD-003 |
| [TRY-001](../tasks/TRY-001.md) | Define check and promissory-note accounting contracts | MOD-002 |
| [TRY-002](../tasks/TRY-002.md) | Implement received and issued check treasury lifecycle | TRY-001 |
| [TRY-003](../tasks/TRY-003.md) | Implement promissory notes and guarantees | TRY-001 |
| [TRY-004](../tasks/TRY-004.md) | Deliver treasury workspace reminders and reconciliation | TRY-002, TRY-003, MOD-003 |
| [IRO-001](../tasks/IRO-001.md) | Add Iranian party and banking data workflows | MOD-002, DATA-001 |
| [IRO-002](../tasks/IRO-002.md) | Implement explicit rial and toman input and display preferences | MOD-003 |
| [IRO-003](../tasks/IRO-003.md) | Complete Persian operational dates and configurable fiscal periods | MOD-003 |
| [POS-001](../tasks/POS-001.md) | Implement POS sessions and cashier shifts | MOD-002, SVC-002 |
| [POS-002](../tasks/POS-002.md) | Deliver fast checkout payments returns and receipts | POS-001, SVC-003, IRO-002 |
| [POS-003](../tasks/POS-003.md) | Add qualified receipt and payment-terminal adapters | POS-002 |
| [POS-004](../tasks/POS-004.md) | Implement bounded offline checkout and safe synchronization | POS-002 |
| [PAYIR-001](../tasks/PAYIR-001.md) | Specify Iranian non-tax payroll workflows | MOD-002 |
| [PAYIR-002](../tasks/PAYIR-002.md) | Implement non-tax payroll policies and Persian payslips | PAYIR-001, IRO-003 |
| [COL-001](../tasks/COL-001.md) | Add record comments mentions and activity notifications | MOD-003 |
| [COL-002](../tasks/COL-002.md) | Implement optional organization channels and direct messaging | COL-001 |
| [IRN-001](../tasks/IRN-001.md) | Qualify the integrated Iran business capabilities | MOD-001, MOD-002, MOD-003, SVC-001, SVC-002, SVC-003, TRY-001, TRY-002, TRY-003, TRY-004, IRO-001, IRO-002, IRO-003, POS-001, POS-002, POS-003, POS-004, PAYIR-001, PAYIR-002, COL-001, COL-002 |

## Acceptance and scheduling

IRN-001 independently accepts every task above and gates open phase-5 work plus QA-001. Phase 7 continues accepting existing capabilities; the new phase supplies its own native review instead of reopening completed localization work. No task is started or marked complete by this planning change. Human review is required on instrument accounting contracts, non-tax payroll contracts and final integrated acceptance.
