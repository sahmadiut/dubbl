"use client";

import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";
import { procurementMoney, procurementQuantityText } from "@/lib/money/procurement-ui";

type Line = { id: string; description: string; quantity?: number; quantityReceived?: number; quantityBilled?: number;
  unitPrice?: bigint; unitCost?: bigint; amount: bigint; taxAmount?: bigint;
  account?: { code: string; name: string } | null; inventoryItem?: { name: string; sku?: string | null } | null; warehouse?: { name: string } | null };
export function ProcurementMoneyDetails({ document, receipt = false }: {
  document: { currencyCode: string; total: bigint; subtotal?: bigint; taxTotal?: bigint; lines: Line[] }; receipt?: boolean;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("ProcurementDetails");
  const format = (amount: bigint) => procurementMoney(amount, document.currencyCode, unitPresentation);
  return <div className="rounded-lg border overflow-x-auto">
    <div className="grid min-w-[760px] grid-cols-[1fr_80px_110px_120px_110px_110px] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
      <span>{t("item")}</span><span className="text-right">{t("quantity")}</span><span className="text-right">{t(receipt ? "unitCost" : "unitPrice")}</span>
      <span className="text-right">{t("amount")}</span><span className="text-right">{t(receipt ? "location" : "received")}</span><span className="text-right">{receipt ? "" : t("billedReserved")}</span>
    </div>
    {document.lines.map(line => <div key={line.id} className="grid min-w-[760px] grid-cols-[1fr_80px_110px_120px_110px_110px] gap-2 border-b px-4 py-3 last:border-b-0 text-sm">
      <div>{line.inventoryItem?.name || line.description}{line.inventoryItem?.sku && <p className="text-xs text-muted-foreground">{line.inventoryItem.sku}</p>}{line.account && <p className="text-xs text-muted-foreground">{line.account.code} · {line.account.name}</p>}</div>
      <span className="text-right font-mono">{procurementQuantityText((receipt ? line.quantityReceived : line.quantity)!)}</span>
      <span className="text-right font-mono break-all">{format((receipt ? line.unitCost : line.unitPrice)!)}</span>
      <span className="text-right font-mono break-all">{format(line.amount)}</span>
      <span className="text-right">{receipt ? line.warehouse?.name || "—" : line.quantityReceived === undefined ? "—" : procurementQuantityText(line.quantityReceived)}</span>
      <span className="text-right font-mono">{!receipt && line.quantityBilled !== undefined ? procurementQuantityText(line.quantityBilled) : "—"}</span>
    </div>)}
    <div className="space-y-1 px-4 py-3 text-right font-mono break-all">
      {document.subtotal !== undefined && <p>{t("subtotal", { amount: format(document.subtotal) })}</p>}
      {document.taxTotal !== undefined && <p>{t("tax", { amount: format(document.taxTotal) })}</p>}
      <p className="font-bold">{t(receipt ? "totalValue" : "total", { amount: format(document.total) })}</p>
    </div>
  </div>;
}
