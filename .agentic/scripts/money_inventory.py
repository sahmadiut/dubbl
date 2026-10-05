"""Reproducible source-only MON-001 inventory; never imports DB or reads .env.

Lexical references are a conservative work queue, not an AST/dataflow proof.
Explicit schema classification is deliberately separate from search patterns.
Run with --write to refresh artifacts, or without arguments to verify drift.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
JSON_PATH = ROOT / ".agentic/registries/MONEY_BOUNDARIES.json"
MD_PATH = ROOT / ".agentic/registries/MONEY_COLUMNS.md"

# All monetary columns, reviewed against actual schema and domain consumers.
MONEY = {
    "organization": "billApprovalThreshold mileageRate",
    "contact": "creditLimit",
    "journalLine": "debitAmount creditAmount",
    "taxReturnLine": "amount",
    "bankAccount": "balance lowBalanceThreshold",
    "bankStatementImport": "openingBalance closingBalance",
    "bankTransaction": "amount balance",
    "bankReconciliation": "startBalance endBalance",
    "invoice": "subtotal taxTotal total amountPaid amountDue",
    "invoiceLine": "unitPrice taxAmount amount",
    "quote": "subtotal taxTotal total billedTotal",
    "quoteLine": "unitPrice taxAmount amount",
    "creditNote": "subtotal taxTotal total amountApplied amountRemaining",
    "creditNoteLine": "unitPrice taxAmount amount",
    "salesReceipt": "subtotal taxTotal total",
    "salesReceiptLine": "unitPrice taxAmount amount",
    "customerCredit": "originalAmount amountRemaining",
    "bill": "subtotal taxTotal total amountPaid amountDue",
    "billLine": "unitPrice taxAmount amount",
    "purchaseOrder": "subtotal taxTotal total",
    "purchaseOrderLine": "unitPrice taxAmount amount",
    "debitNote": "subtotal taxTotal total amountApplied amountRemaining",
    "debitNoteLine": "unitPrice taxAmount amount",
    "purchaseRequisition": "subtotal taxTotal total",
    "purchaseRequisitionLine": "unitPrice taxAmount amount",
    "landedCostAllocation": "totalCostAmount",
    "landedCostComponent": "amount",
    "landedCostLineAllocation": "allocatedAmount",
    "goodsReceiptLine": "unitCost",
    "payment": "amount",
    "paymentAllocation": "amount",
    "expenseClaim": "totalAmount",
    "expenseItem": "amount mileageRate",
    "inventoryItem": "purchasePrice salePrice averageCost standardCost totalValue",
    "inventoryMovement": "unitCost value",
    "inventoryItemSupplier": "purchasePrice",
    "stockTakeLine": "valueAdjustment",
    "inventoryVariant": "purchasePrice salePrice",
    "inventoryCostLayer": "unitCost remainingValue",
    "inventoryLayerConsumption": "unitCost value",
    "billOfMaterials": "laborCostCents overheadCostCents",
    "assetCategory": "defaultResidualValue",
    "fixedAsset": "purchasePrice residualValue accumulatedDepreciation netBookValue revaluedAmount revaluationSurplusBalance disposalAmount",
    "depreciationEntry": "amount",
    "assetRevaluation": "previousCarryingAmount revaluedAmount changeAmount surplusAmount impairmentAmount",
    "cwipCost": "amount",
    "loan": "principalAmount monthlyPayment",
    "loanSchedule": "principalAmount interestAmount totalPayment remainingBalance",
    "budgetLine": "total",
    "budgetPeriod": "amount",
    "recurringTemplateLine": "unitPrice debitAmount creditAmount",
    "accrualSchedule": "totalAmount",
    "accrualEntry": "amount",
    "revenueSchedule": "totalAmount recognizedAmount",
    "revenueEntry": "amount",
    "scheduledPayment": "amount",
    "paymentBatch": "totalAmount",
    "paymentBatchItem": "amount",
    "consolidationEliminationEntry": "amount varianceAmount",
    "priceListItem": "unitPrice",
    "deal": "valueCents",
    "project": "budget hourlyRate fixedPrice totalBilled",
    "projectMember": "hourlyRate costRate",
    "projectBillableItem": "costAmount billedAmount",
    "milestoneAssignment": "amount",
    "projectMilestone": "amount invoicedAmountCents",
    "timeEntry": "hourlyRate",
    "payrollSettings": "ssWageBaseCents addlMedicareThresholdCents futaWageBaseCents sutaWageBaseCents",
    "payrollEmployee": "salary hourlyRate",
    "payrollRun": "totalGross totalDeductions totalNet",
    "payrollItem": "grossAmount taxAmount deductions netAmount overtimeAmount bonusAmount preTaxDeductions postTaxDeductions",
    "deductionType": "defaultAmount",
    "employeeDeduction": "amount",
    "payrollItemDeduction": "amount",
    "payrollBonus": "amount",
    "payrollItemOvertime": "regularAmount overtimeAmount",
    "contractor": "hourlyRate",
    "contractorPayment": "amount",
    "compensationBand": "minSalary midSalary maxSalary",
    "compensationReview": "totalBudget",
    "compensationReviewEntry": "currentSalary proposedSalary",
    "taxBracket": "minIncome maxIncome baseAmountCents standardDeductionCents",
    "taxAllowanceConfig": "allowanceValueCents standardDeductionCents",
    "payrollItemTaxBreakdown": "amount",
    "payrollItemEmployerTax": "amount",
    "payrollTaxPayment": "amount",
    "employeeTaxConfig": "additionalWithholding",
    "payslip": "grossAmount netAmount taxAmount ytdGross ytdNet ytdTax",
}
MONEY = {t: set(fields.split()) for t, fields in MONEY.items()}
FX = {"journalLine.exchangeRate", "exchangeRate.rate", "consolidationRate.rate", "payrollItem.fxRate", "journalLine.rateExact", "exchangeRate.rateExact", "consolidationRate.rateExact", "payrollItem.rateExact"}
PARENTS = {
    "invoiceLine": "invoice", "quoteLine": "quote", "creditNoteLine": "creditNote",
    "salesReceiptLine": "salesReceipt", "billLine": "bill", "purchaseOrderLine": "purchaseOrder",
    "debitNoteLine": "debitNote", "purchaseRequisitionLine": "purchaseRequisition",
    "landedCostComponent": "landedCostAllocation", "landedCostLineAllocation": "landedCostAllocation",
    "goodsReceiptLine": "goodsReceipt -> purchaseOrder",
    "paymentAllocation": "payment (also allocated invoice/bill; must validate currency agreement)",
    "expenseItem": "expenseClaim", "recurringTemplateLine": "recurringTemplate",
    "priceListItem": "priceList", "projectMember": "project", "projectBillableItem": "project",
    "projectMilestone": "project", "milestoneAssignment": "projectMilestone -> project",
    "timeEntry": "project", "revenueSchedule": "invoice (posting must convert to org base)",
    "revenueEntry": "revenueSchedule -> invoice", "loanSchedule": "loan -> organization",
    "budgetLine": "budget -> organization", "budgetPeriod": "budgetLine -> budget -> organization",
    "depreciationEntry": "fixedAsset -> organization", "assetRevaluation": "fixedAsset -> organization",
    "cwipCost": "fixedAsset -> organization", "accrualEntry": "accrualSchedule -> organization",
    "inventoryItemSupplier": "inventoryItem -> organization (supplier currency is not stored here)",
    "inventoryVariant": "inventoryItem -> organization", "inventoryMovement": "inventoryItem -> organization",
    "stockTakeLine": "stockTake -> organization", "inventoryCostLayer": "inventoryItem -> organization",
    "inventoryLayerConsumption": "inventoryCostLayer -> inventoryItem -> organization",
    "payrollRun": "payrollRun.baseCurrency snapshot; legacy null uses organization.defaultCurrency bridge; items have distinct currencies",
    "payrollItemDeduction": "payrollItem.currency", "payrollItemOvertime": "payrollItem.currency",
    "payrollItemTaxBreakdown": "payrollItem.currency", "payrollItemEmployerTax": "payrollItem.currency",
    "employeeDeduction": "payrollEmployee.currency", "payrollBonus": "payrollEmployee.currency",
    "employeeTaxConfig": "payrollEmployee.currency", "payslip": "payrollItem.currency",
    "compensationReviewEntry": "payrollEmployee.currency (no currency snapshot)",
    "bankReconciliation": "bankAccount.currencyCode",
}
JSON_MONEY = {
    "bankRule.conditions": "conditional amount strings in matched bank currency; other fields are text",
    "bankRule.splitAllocations": "amount is fixed legacy cents; percent is plain percent; matched bank currency",
    "approvalWorkflow.conditions": "value strings may be document amount thresholds; entity currency, no stored currency",
    "payslip.deductionsBreakdown": "amount numbers in payrollItem.currency",
    "taxForm.formData": "heterogeneous tax totals; template/jurisdiction unit contract, no stored currency",
    "auditLog.changes": "old/new monetary and FX values retain historical entity/wire contract",
    "webhookDelivery.payload": "entity money/FX numbers in legacy webhook wire contract",
    "stripeSyncLog.payload": "provider raw amounts with provider currency; preserve original payload",
    "stripeEntityMap.metadata": "mapping metadata can carry amounts; provider/entity currency",
    "bankTransaction.rawPayload": "bank/provider raw amount strings; statement/account currency",
    "bankStatementImport.metadata": "bank import metadata; statement/account currency",
    "savedReport.config": "report filters may carry thresholds; report currency/context",
}
PATTERNS = {
    "fixed_100": r"(?:/|\*)\s*100\b|(?:/|\*)\s*1e2\b",
    "basis_10000": r"(?:/|\*)\s*(?:10000|10_000)\b",
    "fx_scale": r"\b(?:1000000|1_000_000|1000000000000|RATE_SCALE)\b|\bfxRate\b",
    "money_helper": r"\b(?:decimalToCents|centsToDecimal|decimalToMinorUnits|minorUnitsToDecimal|parseMoney|formatMoney|sumCents|calculateTax|addTax)\b",
    "float_or_number": r"\b(?:parseFloat|Number|parseInt)\s*\(",
    "round_or_format": r"\bMath\.(?:round|floor|ceil|pow)\s*\(|\.toFixed\s*\(",
    "sql_aggregate": r"\b(?:sum|avg)\s*\(|::(?:int|integer|numeric|bigint)",
    "wire": r"JSON\.(?:stringify|parse)|\b(?:NextResponse\.json|apiSuccess|z\.number)\s*\(",
    "money_name": r"\b\w{0,60}(?:[Cc]ents|[Aa]mount|[Pp]rice|[Cc]ost|[Ss]alary|[Bb]alance|[Tt]otal|[Rr]ate)\w{0,60}\b",
}


def currency_source(table, block):
    if table == "journalLine":
        return "organization.defaultCurrency for posted debit/credit; currencyCode tags original document; manual entry semantics need MON-007 review"
    if table == "exchangeRate":
        return "baseCurrency -> targetCurrency (target units per one base unit)"
    if table == "consolidationRate":
        return "currencyCode -> consolidationGroup.presentationCurrency"
    if table == "bankStatementImport":
        return "statementCurrency if supplied, otherwise linked bankAccount.currencyCode"
    if table == "bankTransaction":
        return "currencyCode nullable; linked bankAccount.currencyCode fallback"
    if table in PARENTS:
        return "inherited: " + PARENTS[table]
    for name in ("currencyCode", "currency", "defaultCurrency"):
        if re.search(rf"\b{name}: text\(", block):
            return f"{table}.{name} (schema defaults/nullable preserved)"
    if table in {"taxBracket", "taxAllowanceConfig"}:
        return "jurisdiction/country tax configuration; no currency column; existing cents assumptions need explicit MON-008 policy"
    if table in {"deductionType", "compensationReview"}:
        return "organization/payroll context; no currency snapshot; mixed employee currencies need MON-008 policy"
    return "organization.defaultCurrency via organization/parent; no local currency snapshot"


def classify(table, field, typ, source):
    key = f"{table}.{field}"
    if field == "rateFormatVersion":
        return "metadata", "FX storage format version; not an amount", "MON-004"
    if key in FX:
        unit = "exact quote units per one base unit; positive 20 whole/18 fractional digits, nullable quarantine; format v1" if field == "rateExact" else "unscaled local->base decimal multiplier" if typ == "real" else "FX multiplier x 1,000,000"
        return "fx", unit, "MON-004; MON-005; MON-007/008"
    if field in MONEY.get(table, set()):
        unit = "legacy minor-unit integer (cents contract; not proof of currency-correct input)"
        if field in {"unitPrice", "unitCost", "purchasePrice", "salePrice", "averageCost", "standardCost"} and table not in {"fixedAsset"}:
            unit += " per item unit"
        if field in {"hourlyRate", "costRate"}:
            unit += " per hour"
        if field == "mileageRate":
            unit += " per mile"
        return "money", unit, "MON-003; MON-007/008; MON-006 wire"
    if key in JSON_MONEY:
        return "money_envelope", JSON_MONEY[key], "MON-006; MON-008; DATA-001/002 where applicable"
    if key == "landedCostLineAllocation.allocationBasis":
        return "allocation_basis", "by_value: money; by_quantity/by_weight: quantity/weight basis (method-dependent)", "MON-003; MON-008 preserve method"
    if typ == "jsonb":
        return "non_money", "structured non-money metadata; retain schema contract", "retain; MON-001 exclusions"
    if table == "currency" and field == "decimalPlaces":
        return "metadata", "currency display exponent; not an amount", "MON-009; LOC-003"
    if "basis points" in source or "basis_points" in source or field.endswith(("Bp", "BasisPoints")) or key in {
        "chartAccount.taxDisallowedPercent", "taxRate.recoverablePercent", "organization.interestRate",
        "payrollSettings.defaultTaxRate", "payrollEmployee.taxRate", "taxJurisdiction.stateRate",
        "taxJurisdiction.countyRate", "taxJurisdiction.cityRate", "taxJurisdiction.specialRate",
        "assetCategory.defaultDepreciationRateBp", "procurementSettings.priceTolerancePercent",
        "procurementSettings.qtyTolerancePercent",
    }:
        return "percentage", "basis points: 10000 = 100%; not currency scaling", "MON-002 arithmetic; MON-007/008 consumers; retain unit"
    if re.search(r"[Pp]ercent|Pct|probability", field):
        return "percentage", "plain percent: 100 = 100%; not currency scaling", "MON-002 arithmetic; MON-008 consumers; retain unit"
    if "Multiplier" in field:
        return "multiplier", "dimensionless factor", "MON-002 arithmetic; MON-008 consumers"
    if table.endswith("Line") and field in {"quantity", "quantityReceived", "quantityBilled"} and table in {
        "invoiceLine", "quoteLine", "creditNoteLine", "salesReceiptLine", "billLine", "purchaseOrderLine",
        "debitNoteLine", "purchaseRequisitionLine", "recurringTemplateLine", "goodsReceiptLine",
    }:
        return "quantity", "item quantity x 100 (1 item = 100); preserve independently of money", "MON-007/008; retain quantity scale"
    if field == "distanceMiles":
        return "quantity", "miles x 100", "MON-008; retain distance scale"
    if re.search(r"[Hh]ours|[Mm]inutes|[Ss]econds|accrualRate|carryOverMax", field) or table == "employeeLeaveBalance" or key == "leavePolicy.maxBalance":
        unit = "minutes" if "Minutes" in field or "minutes" == field or table == "project" else "seconds" if "Seconds" in field else "hours (leave accrual: hours/period)"
        return "time_or_count", unit, "retain; MON-008 where used to price labor"
    return "non_money", "count/order/date component/physical quantity; schema contract (see declaration)", "retain; MON-001 exclusions"


def generate():
    # Include new nonignored source before commit as well as tracked source.
    tracked = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT).decode().split("\0")
    paths = sorted(p for p in set(tracked) if p and Path(p).suffix in {".ts", ".tsx", ".js", ".mjs", ".json", ".mdx"}
                   and not p.startswith((".agentic/", "drizzle/")) and p not in {"package-lock.json", "pnpm-lock.yaml"})
    schema = []
    tables = {}
    for path in sorted((ROOT / "lib/db/schema").glob("*.ts")):
        text = path.read_text(encoding="utf-8")
        starts = list(re.finditer(r'export const (\w+) = pgTable\(\s*"([^"]+)"', text))
        for i, m in enumerate(starts):
            block = text[m.end():starts[i + 1].start() if i + 1 < len(starts) else len(text)]
            table, sql_table = m[1], m[2]
            tables[table] = currency_source(table, block)
            for f in re.finditer(r'^\s+(\w+): (integer|numeric|decimal|real|bigint|moneyInteger|exactFxNumeric|doublePrecision|jsonb)\("([^"]+)"\)([^\n]*)', block, re.M):
                field, typ, sql_col = f[1], f[2], f[3]
                if typ == "moneyInteger":
                    typ = "bigint"
                if typ == "exactFxNumeric":
                    typ = "numeric"
                line = text.count("\n", 0, m.end() + f.start()) + 1
                # Leading whitespace can include the previous newline.
                line += f[0][:f[0].index(field)].count("\n")
                classification, unit, owner = classify(table, field, typ, f[0])
                limits = {"integer": "-2147483648..2147483647", "bigint": "-9223372036854775808..9223372036854775807",
                          "real": "binary32 approximate; no exact decimal guarantee", "numeric": "unconstrained exact decimal; Drizzle string",
                          "jsonb": "no numeric schema bound; JS numeric leaves limited by Number"}
                schema.append(dict(key=f"{table}.{field}", table=sql_table, column=sql_col,
                                   path=path.relative_to(ROOT).as_posix(), line=line, type=typ,
                                   declaration=f[0].strip(), classification=classification, units=unit,
                                   storage_range="positive <10^20; at most 18 nonzero fractional places; SQL CHECK and string adapter; nullable quarantine" if field == "rateExact" else limits.get(typ, "inspect declared precision"), currency_source=("payrollItem.currency -> payrollSettings.defaultCurrency / organization posting base" if table == "payrollItem" and field in {"fxRate", "rateExact"} else tables[table]) if classification in {"money", "fx", "allocation_basis"} else "not currency" if classification != "money_envelope" else unit,
                                   migration_owner=owner))
    found = {s["key"] for s in schema}
    required = {f"{t}.{f}" for t, fields in MONEY.items() for f in fields} | FX | set(JSON_MONEY)
    assert required <= found, f"Missing classified columns: {sorted(required - found)}"
    compiled = {name: re.compile(pattern) for name, pattern in PATTERNS.items()}
    consumers = []
    names = sorted({s["key"].split(".")[1] for s in schema if s["classification"] in {"money", "fx", "allocation_basis"}})
    name_re = re.compile(r"\b(?:" + "|".join(names) + r")\b")
    for path in paths:
        if path.startswith("lib/db/schema/"):
            continue
        source = (ROOT / path).read_text(encoding="utf-8")
        matches = []
        for line, content in enumerate(source.splitlines(), 1):
            tags = [n for n, pattern in compiled.items() if pattern.search(content)]
            if name_re.search(content):
                tags.append("column_name")
            if tags:
                matches.append(dict(line=line, patterns=tags))
        tokens = set(re.findall(r"\b\w+\b", source))
        refs = [t for t in tables if t in tokens and (t in MONEY or t in {"exchangeRate", "consolidationRate"})]
        if not matches and not refs:
            continue
        if path.startswith(("app/api/", "lib/mcp/")):
            owner = "MON-006 contracts; MON-007 core/MON-008 auxiliary arithmetic"
        elif path.startswith(("app/", "components/")):
            owner = "MON-008; LOC-003 formatting/input"
        elif path.startswith("lib/money/"):
            owner = "MON-002 exact primitives; MON-009 currency regimes"
        elif path.startswith("lib/currency/"):
            owner = "MON-002 primitives; MON-004/005 FX; MON-009 metadata"
        elif path.startswith(("tests/", "scripts/")):
            owner = "MON-010 qualification; MON-003/004 fixtures"
        else:
            owner = "MON-007 core/MON-008 auxiliary; MON-006 serialization"
        consumers.append(dict(path=path, sha256=hashlib.sha256(source.replace("\r\n", "\n").encode()).hexdigest(),
                              table_references=sorted(refs), units="currency-tagged bigint minor units; rational operands have explicit units" if path.startswith("lib/money/") else "per referenced column; mixed money/FX/quantity/percent; legacy Number candidates require inspection",
                              range="signed int64 final amounts; arbitrary-precision intermediate ratios" if path.startswith("lib/money/") else "Number safe integer +/-9007199254740991; DB money columns bigint via guarded safe-number bridge; intermediates/SQL casts may narrow",
                              currency_sources={t: tables[t] for t in sorted(refs)},
                              currency_resolution="explicit currency props/arguments or organization context; absent currency defaults must be reviewed, never infer from locale",
                              migration_owner=owner, occurrences=matches))
    result = dict(version=1, method="explicit column classification plus conservative lexical consumer search; not transitive dataflow proof",
                  patterns=PATTERNS, scanned_paths=paths, schema_columns=schema, consumers=consumers)
    lines = ["# Money inventory: column appendix", "", "Generated by `.agentic/scripts/money_inventory.py`; see [manifest](MONEY_MANIFEST.md) for semantic findings and limits.", "",
             "Each row is a real numeric/JSON column. Ranges are physical storage bounds, not validation promises. JSON envelopes and method-dependent allocation bases are included. Non-money rows must not be blindly widened/rescaled.", "",
             "| Schema source | Table.column (Drizzle key) | Type / range | Class / unit | Currency source | Migration owner |",
             "|---|---|---|---|---|---|"]
    for s in schema:
        link = f"[source](../../{s['path']}#L{s['line']})"
        values = [link, f"`{s['table']}.{s['column']}` (`{s['key']}`)", f"{s['type']}; {s['storage_range']}",
                  f"{s['classification']}; {s['units']}", s['currency_source'], s['migration_owner']]
        lines.append("| " + " | ".join(v.replace("|", "\\|") for v in values) + " |")
    # One compact consumer per line avoids committing repeated source excerpts.
    # Paths, line numbers, pattern tags and LF-normalized hashes recover them.
    header = json.dumps({k: v for k, v in result.items() if k != "consumers"}, indent=2, ensure_ascii=False)
    data = header[:-2] + ',\n  "consumers": [\n' + ',\n'.join(
        '    ' + json.dumps(c, ensure_ascii=False, separators=(',', ':')) for c in consumers
    ) + '\n  ]\n}\n'
    return data, "\n".join(lines) + "\n", result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    data, markdown, result = generate()
    for path, expected in ((JSON_PATH, data), (MD_PATH, markdown)):
        if args.write:
            path.write_text(expected, encoding="utf-8", newline="\n")
        elif not path.exists() or path.read_text(encoding="utf-8") != expected:
            raise SystemExit(f"Inventory drift: {path.relative_to(ROOT)}; inspect source changes, then use --write")
    print(json.dumps(dict(columns=len(result['schema_columns']), classifications=Counter(s['classification'] for s in result['schema_columns']),
                          scanned_files=len(result['scanned_paths']), consumer_files=len(result['consumers']),
                          occurrences=sum(len(c['occurrences']) for c in result['consumers'])), indent=2))


if __name__ == "__main__":
    main()
