---
{
  "id": "PAYIR-002",
  "title": "Implement non-tax payroll policies and Persian payslips",
  "phase": 12,
  "role": "backend",
  "depends_on": [
    "AI-013",
    "L10N-012",
    "PAYIR-001",
    "IRO-003"
  ],
  "split_children": [],
  "source_pages": [],
  "source_sections": [
    "iran-business-capabilities-owner-extension"
  ],
  "status": "todo",
  "priority": 2,
  "optional": false,
  "human_review": false,
  "owner": null,
  "block_reason": null,
  "evidence": [],
  "review": null,
  "waiver": null
}
---

# PAYIR-002 - Implement non-tax payroll policies and Persian payslips

## Objective and implementation scope

Implement the approved non-tax payroll gaps through existing payroll services with effective-dated configuration and Persian outputs.

All new user-facing behavior includes English/Persian catalogs, RTL, organization permissions, audit and REST/MCP parity. Use shared direct-DB domain services, wrapTool and described Zod inputs. Schema changes require committed Drizzle migrations. Preserve existing money contracts and Stripe freeze. No new tax work is authorized.

## Inputs

- [Owner requirements](../sources/SOURCE.md#iran-business-capabilities-owner-extension).
- [Delivery plan](../docs/IRAN_BUSINESS_PLAN.md), DEC-010 and actual repository/dependency evidence.

## Acceptance criteria

- [ ] Approved salary/attendance/leave/overtime/bonus/advance examples match independent calculations and preserve historical payslips.
- [ ] Approval, reversal, bank-payment exports and journal entries enforce organization scope, period locks and idempotency with REST/MCP parity.
- [ ] Persian payslips render correctly and disclose excluded calculations; no new tax calculation, tax report, Modian or statutory insurance submission is implemented.

## Verification

Run focused behavioral and negative tests for owned financial/permission/migration paths, typecheck and lint for application changes, and catalog checks. Use isolated PostgreSQL fixtures where needed; compare ledger values independently. No full build or unrequested dev server. Record actual commands, results and limitations; simulated provider success does not qualify a live integration.

## Handoff

Not started. Audit the existing implementation and dependency evidence before implementing this bounded scope. Production IRR and release gates remain separate.

## History

- 2026-10-27: Added at owner request, excluding tax; new phase scheduled before phase 5 and after phase 7.
