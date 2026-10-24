"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";

import { assemblyBomJson, assemblyDeletedJson, type AssemblyBomDetail } from "@/i18n/inventory-assembly-presentation";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { expenseMoneyDisplay } from "@/lib/money/expense-display";

export default function BOMDetailPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("InventoryAssembly");
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AssemblyBomDetail | null>(null);
  const [readError, setReadError] = useState(false);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("detailDocumentTitle"));

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) throw new Error("Organization required");
    return { "x-organization-id": orgId };
  }

  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true); setData(null); setReadError(false);
      try {
        const result = await assemblyBomJson(await fetch(`/api/v1/inventory/bom/${id}`, { headers: getHeaders() }));
        if (!disposed) setData(result);
      } catch { if (!disposed) setReadError(true); }
      finally { if (!disposed) setLoading(false); }
    }
    void load();
    return () => { disposed = true; };
  }, [id]);

  async function removeComponent(componentId: string) {
    try {
      await assemblyDeletedJson(await fetch(`/api/v1/inventory/bom/${id}/components?componentId=${componentId}`, {
        method: "DELETE", headers: getHeaders(),
      }));
    } catch { toast.error(t("removeFailed")); return; }
    toast.success(t("removed"));
    // Removal is already verified; a failed refresh reports read feedback.
    try {
      const result = await assemblyBomJson(await fetch(`/api/v1/inventory/bom/${id}`, { headers: getHeaders() }));
      setData(result);
    } catch { setData(null); setReadError(true); }
  }

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("detailReadFailed")}</p>;
  if (!data) return <div className="py-20 text-center text-sm text-muted-foreground">{t("notFound")}</div>;

  const { bom, costBreakdown } = data;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold"><BidiText>{bom.name}</BidiText></h2>
            {!bom.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
          </div>
          {bom.description && (
            <p className="text-sm text-muted-foreground mt-1"><BidiText>{bom.description}</BidiText></p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            <BidiText>{t("produces", { name: bom.assemblyItem?.name || t("unknown"), code: bom.assemblyItem?.code || "" })}</BidiText>
          </p>
        </div>

        {/* Cost Breakdown */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">{t("costBreakdown")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("components")}</p>
              <p className="text-sm font-mono font-medium tabular-nums"><BidiText dir="ltr">{expenseMoneyDisplay(BigInt(costBreakdown.componentCostMinor), bom.currencyCode, unitPresentation)}</BidiText></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("labor")}</p>
              <p className="text-sm font-mono font-medium tabular-nums"><BidiText dir="ltr">{expenseMoneyDisplay(BigInt(costBreakdown.laborCostMinor), bom.currencyCode, unitPresentation)}</BidiText></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("overhead")}</p>
              <p className="text-sm font-mono font-medium tabular-nums"><BidiText dir="ltr">{expenseMoneyDisplay(BigInt(costBreakdown.overheadCostMinor), bom.currencyCode, unitPresentation)}</BidiText></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("totalCost")}</p>
              <p className="text-sm font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"><BidiText dir="ltr">{expenseMoneyDisplay(BigInt(costBreakdown.totalCostMinor), bom.currencyCode, unitPresentation)}</BidiText></p>
            </div>
          </div>
        </div>

        {/* Components */}
        <div>
          <h3 className="text-sm font-medium mb-3"><BidiText>{t("componentCount", { count: bom.components.length })}</BidiText></h3>
          {bom.components.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t("noComponents")}
            </div>
          ) : (
            <div className="space-y-1">
              {bom.components.map((comp) => (
                <div key={comp.id} className="flex items-center justify-between rounded-lg border bg-card p-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <BidiText>{comp.componentItem?.name || t("unknown")}</BidiText> (<IdentifierText>{comp.componentItem?.code}</IdentifierText>)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <BidiText>{t("quantity", { quantity: comp.quantity })}</BidiText>
                      {comp.wastagePercent && !/^0(?:\.0+)?$/.test(comp.wastagePercentExact) && t("wastage", { percent: comp.wastagePercent })}
                      <BidiText>{comp.componentItem && t("each", { cost: expenseMoneyDisplay(BigInt(comp.componentItem.purchasePriceMinor), bom.currencyCode, unitPresentation) })}</BidiText>
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="size-7 p-0 text-destructive" aria-label={t("removeComponent")} onClick={() => removeComponent(comp.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ContentReveal>
  );
}
