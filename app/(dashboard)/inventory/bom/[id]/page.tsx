"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { expenseMoneyDisplay } from "@/lib/money/expense-display";

interface BOMDetail {
  bom: {
    id: string;
    name: string;
    description: string | null;
    assemblyItem: { id: string; name: string; code: string } | null;
    currencyCode: string;
    laborCostCents: number;
    overheadCostCents: number;
    isActive: boolean;
    components: {
      id: string;
      quantity: string;
      wastagePercent: string | null;
      wastagePercentExact: string;
      componentItem: { id: string; name: string; code: string; purchasePrice: number; purchasePriceMinor: string } | null;
    }[];
  };
  costBreakdown: {
    componentCost: number;
    componentCostMinor: string;
    laborCost: number;
    laborCostMinor: string;
    overheadCost: number;
    overheadCostMinor: string;
    totalCost: number;
    totalCostMinor: string;
  };
}

export default function BOMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BOMDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle("Inventory · BOM Details");

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId") || "";
    return { "x-organization-id": orgId };
  }

  useEffect(() => {
    fetch(`/api/v1/inventory/bom/${id}`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((result) => { if (result.bom) setData(result); else toast.error(result.error || "Unable to load BOM"); })
      .finally(() => setLoading(false));
  }, [id]);

  async function removeComponent(componentId: string) {
    const removal = await fetch(`/api/v1/inventory/bom/${id}/components?componentId=${componentId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!removal.ok) { const result = await removal.json(); toast.error(result.error || "Unable to remove component"); return; }
    toast.success("Component removed");
    // Refetch
    const res = await fetch(`/api/v1/inventory/bom/${id}`, { headers: getHeaders() });
    const result = await res.json();
    if (result.bom) setData(result); else toast.error(result.error || "Unable to reload BOM");
  }

  if (loading) return <BrandLoader />;
  if (!data) return <div className="py-20 text-center text-sm text-muted-foreground">BOM not found</div>;

  const { bom, costBreakdown } = data;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{bom.name}</h2>
            {!bom.isActive && <Badge variant="outline">Inactive</Badge>}
          </div>
          {bom.description && (
            <p className="text-sm text-muted-foreground mt-1">{bom.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Produces: {bom.assemblyItem?.name || "Unknown"} ({bom.assemblyItem?.code})
          </p>
        </div>

        {/* Cost Breakdown */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Cost Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Components</p>
              <p className="text-sm font-mono font-medium tabular-nums">{expenseMoneyDisplay(BigInt(costBreakdown.componentCostMinor), bom.currencyCode)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Labor</p>
              <p className="text-sm font-mono font-medium tabular-nums">{expenseMoneyDisplay(BigInt(costBreakdown.laborCostMinor), bom.currencyCode)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overhead</p>
              <p className="text-sm font-mono font-medium tabular-nums">{expenseMoneyDisplay(BigInt(costBreakdown.overheadCostMinor), bom.currencyCode)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Cost</p>
              <p className="text-sm font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{expenseMoneyDisplay(BigInt(costBreakdown.totalCostMinor), bom.currencyCode)}</p>
            </div>
          </div>
        </div>

        {/* Components */}
        <div>
          <h3 className="text-sm font-medium mb-3">Components ({bom.components.length})</h3>
          {bom.components.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No components added yet
            </div>
          ) : (
            <div className="space-y-1">
              {bom.components.map((comp) => (
                <div key={comp.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {comp.componentItem?.name || "Unknown"} ({comp.componentItem?.code})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {comp.quantity}
                      {comp.wastagePercent && !/^0(?:\.0+)?$/.test(comp.wastagePercentExact) && ` · ${comp.wastagePercent}% wastage`}
                      {comp.componentItem && ` · ${expenseMoneyDisplay(BigInt(comp.componentItem.purchasePriceMinor), bom.currencyCode)} each`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="size-7 p-0 text-destructive" onClick={() => removeComponent(comp.id)}>
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
