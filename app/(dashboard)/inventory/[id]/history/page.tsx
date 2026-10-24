"use client";

import { BidiText } from "@/components/ui/bidi-text";

import { inventoryMovementsJson, inventoryMovementKey, type PresentedInventoryMovement } from "@/i18n/inventory-item-presentation";
import { useTranslations } from "next-intl";

import { inventoryUiMovement } from "@/lib/money/inventory-ui";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Clock } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

const movementTypeColors: Record<string, string> = {
  adjustment: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  stock_take: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  purchase: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  sale: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  transfer_in: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  transfer_out: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800",
  initial: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800",
};

export default function InventoryItemHistoryPage() {
  const t = useTranslations("InventoryItems");
  const { id } = useParams<{ id: string }>();
  const [movements, setMovements] = useState<PresentedInventoryMovement[]>([]);
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("historyTitle"));

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    let cancelled = false;
    async function readMovements() {
      if (!orgId) { setLoading(false); return; }
      setLoading(true);
      setReadError("");
      try {
        const data = await inventoryMovementsJson(await fetch(`/api/v1/inventory/${id}/movements?limit=50`, {
          headers: { "x-organization-id": orgId },
        }));
        if (!cancelled) setMovements(data.map(inventoryUiMovement));
      } catch { if (!cancelled) setReadError(t("historyReadFailed")); }
      finally { if (!cancelled) setLoading(false); }
    }
    void readMovements();
    return () => { cancelled = true; };
  }, [id, t]);

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{readError}</p>;

  if (movements.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title={t("emptyHistory")}
        description={t("emptyHistoryHelp")}
        compact
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card divide-y">
      {movements.map((m, i) => {
        const qty = m.quantity;
        const isPositive = qty > 0;
        const typeKey = m.type.replace(/-/g, "_");
        const typeLabel = inventoryMovementKey(typeKey);
        return (
          <div key={m.id || i} className="flex items-start gap-4 p-4 flex-wrap">
            <div className="flex flex-col items-center gap-1 pt-0.5">
              <Badge variant="outline" className={cn("text-[10px] capitalize", Object.hasOwn(movementTypeColors, typeKey) ? movementTypeColors[typeKey] : movementTypeColors.initial)}>
                {typeLabel ? t(typeLabel) : m.type}
              </Badge>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "text-sm font-mono font-semibold tabular-nums",
                  isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  <BidiText dir="ltr">{isPositive ? "+" : ""}{qty}</BidiText>
                </span>
                {(m.previousQuantity != null && m.newQuantity != null) && (
                  <span dir="ltr" className="text-xs text-muted-foreground font-mono tabular-nums">
                    <BidiText>{m.previousQuantity}</BidiText> &rarr; <BidiText>{m.newQuantity}</BidiText>
                  </span>
                )}
              </div>
              {m.reason && (
                <p className="text-xs text-muted-foreground mt-0.5"><BidiText>{m.reason}</BidiText></p>
              )}
              {m.createdBy && (
                <p className="text-[11px] text-muted-foreground/70 mt-0.5"><BidiText>{t("by", { name: m.createdBy })}</BidiText></p>
              )}
            </div>
            <div className="text-end shrink-0">
              <p className="text-xs text-muted-foreground">
                {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
