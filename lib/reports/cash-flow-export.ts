import type { Statement } from "./statement-export";
import type { CashFlowData } from "./cash-flow-service";

export function cashFlowExportStatement(
  cf: CashFlowData,
  operating: { accountName: string; accountCode: string; amount: number }[],
  investing: { accountName: string; accountCode: string; amount: number }[],
  financing: { accountName: string; accountCode: string; amount: number }[],
  currency: string
): Statement {
  const toRows = (
    items: { accountName: string; accountCode: string; amount: number }[]
  ) =>
    items.map((i) => ({
      code: i.accountCode || undefined,
      name: i.accountName,
      amount: i.amount,
      depth: 1,
    }));

  return {
    title: "Cash Flow Statement",
    periodLabel: `${cf.startDate} to ${cf.endDate} (${cf.method}, ${cf.basis} basis)`,
    currency,
    sections: [
      {
        label: "Operating Activities",
        rows: toRows(operating),
        subtotal: cf.operatingActivities.total,
      },
      {
        label: "Investing Activities",
        rows: toRows(investing),
        subtotal: cf.investingActivities.total,
      },
      {
        label: "Financing Activities",
        rows: toRows(financing),
        subtotal: cf.financingActivities.total,
      },
      {
        label: "Cash Reconciliation",
        rows: [
          { name: "Opening cash balance", amount: cf.openingCashBalance, depth: 1 },
          { name: "Net change in cash", amount: cf.netCashChange, depth: 1 },
          { name: "Closing cash balance", amount: cf.closingCashBalance, depth: 1, bold: true },
          {
            name: "Movement per cash accounts (closing - opening)",
            amount: cf.reconciliation.cashAccountMovement,
            depth: 1,
          },
          {
            name: "Unreconciled difference",
            amount: cf.reconciliation.difference,
            depth: 1,
            bold: true,
          },
        ],
      },
    ],
    grandTotal: cf.netCashChange,
  };
}
