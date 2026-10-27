---
{
  "id": "PAYIR-001",
  "title": "Specify Iranian non-tax payroll workflows",
  "phase": 12,
  "role": "accounting",
  "depends_on": [
    "AI-013",
    "L10N-012",
    "MOD-002"
  ],
  "split_children": [],
  "source_pages": [],
  "source_sections": [
    "iran-business-capabilities-owner-extension"
  ],
  "status": "todo",
  "priority": 2,
  "optional": false,
  "human_review": true,
  "owner": null,
  "block_reason": null,
  "evidence": [],
  "review": null,
  "waiver": null
}
---

# PAYIR-001 - Specify Iranian non-tax payroll workflows

## Objective and implementation scope

Audit existing payroll and define effective-dated non-tax salary components, attendance, leave, overtime, bonuses, advances and deductions; tax and statutory submissions are excluded.

All new user-facing behavior includes English/Persian catalogs, RTL, organization permissions, audit and REST/MCP parity. Use shared direct-DB domain services, wrapTool and described Zod inputs. Schema changes require committed Drizzle migrations. Preserve existing money contracts and Stripe freeze. No new tax work is authorized.

## Inputs

- [Owner requirements](../sources/SOURCE.md#iran-business-capabilities-owner-extension).
- [Delivery plan](../docs/IRAN_BUSINESS_PLAN.md), DEC-010 and actual repository/dependency evidence.

## Acceptance criteria

- [ ] Map existing capabilities and publish bounded examples for salary, overtime, leave, bonuses, advances and settlement without payroll-tax or insurance-submission work.
- [ ] Separate configurable employment policies from verified legal formulas; record provenance/effective dates and obtain attributable accounting review.
- [ ] Define exact rounding, approval, period locks and payslip content; missing tax support is explicit and never represented as full statutory payroll compliance.

## Verification

Run focused behavioral and negative tests for owned financial/permission/migration paths, typecheck and lint for application changes, and catalog checks. Use isolated PostgreSQL fixtures where needed; compare ledger values independently. No full build or unrequested dev server. Record actual commands, results and limitations; simulated provider success does not qualify a live integration.

## Handoff

Not started. Audit the existing implementation and dependency evidence before implementing this bounded scope. Production IRR and release gates remain separate.

## History

- 2026-10-27: Added at owner request, excluding tax; new phase scheduled before phase 5 and after phase 7.
