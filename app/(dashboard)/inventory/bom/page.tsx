"use client";

import { BidiText } from "@/components/ui/bidi-text";
import { formatExactCurrencyDecimal } from "@/i18n/numbers";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";

import { assemblyBomsJson, assemblyDeletedJson, type AssemblyBom } from "@/i18n/inventory-assembly-presentation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Trash2, MoreHorizontal, ExternalLink, Layers, Calculator, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { expenseMoneyDisplay } from "@/lib/money/expense-display";

export default function BOMListPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("InventoryAssembly");
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [boms, setBoms] = useState<AssemblyBom[]>([]);
  const [readError, setReadError] = useState(false);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("bomDocumentTitle"));

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) throw new Error("Organization required");
    return { "x-organization-id": orgId };
  }

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const rows = await assemblyBomsJson(await fetch("/api/v1/inventory/bom", { headers: getHeaders() }));
        if (!disposed) setBoms(rows);
      } catch { if (!disposed) setReadError(true); }
      finally { if (!disposed) setLoading(false); }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  async function handleDelete(bom: AssemblyBom) {
    await confirm({
      title: t("deleteTitle", { name: bom.name }),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          await assemblyDeletedJson(await fetch(`/api/v1/inventory/bom/${bom.id}`, { method: "DELETE", headers: getHeaders() }));
          toast.success(t("deleted"));
          setBoms((prev) => prev.filter((b) => b.id !== bom.id));
        } catch { toast.error(t("deleteFailed")); }
      },
    });
  }

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("bomReadFailed")}</p>;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">{t("bomTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("bomDescription")}
            </p>
          </div>
        </div>

        {boms.length === 0 ? (
          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start pt-4">
            {/* Left: mock BOM card */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="bg-muted/30 px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("exampleBom")}
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/40">
                    <Package className="size-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("deskFrame")}</p>
                    <p className="text-xs text-muted-foreground font-mono">SKU-DESK-001</p>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{t("components")}</p>
                <div className="space-y-1.5">
                  {[
                    { name: t("steel"), qty: "4", cost: (unitPresentation.locale === "en-US" ? "$12.00" : formatExactCurrencyDecimal("12.00", "USD", unitPresentation)) },
                    { name: t("motor"), qty: "1", cost: (unitPresentation.locale === "en-US" ? "$45.00" : formatExactCurrencyDecimal("45.00", "USD", unitPresentation)) },
                    { name: t("controller"), qty: "1", cost: (unitPresentation.locale === "en-US" ? "$28.00" : formatExactCurrencyDecimal("28.00", "USD", unitPresentation)) },
                    { name: t("brackets"), qty: "8", cost: (unitPresentation.locale === "en-US" ? "$2.50" : formatExactCurrencyDecimal("2.50", "USD", unitPresentation)) },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="flex-1 whitespace-normal [overflow-wrap:anywhere] flex-wrap">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">x{c.qty}</span>
                      <span className="text-xs font-mono tabular-nums w-16 text-end">{c.cost}</span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-border" />
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: t("materials"), value: (unitPresentation.locale === "en-US" ? "$141.00" : formatExactCurrencyDecimal("141.00", "USD", unitPresentation)) },
                    { label: t("labor"), value: (unitPresentation.locale === "en-US" ? "$35.00" : formatExactCurrencyDecimal("35.00", "USD", unitPresentation)) },
                    { label: t("total"), value: (unitPresentation.locale === "en-US" ? "$176.00" : formatExactCurrencyDecimal("176.00", "USD", unitPresentation)) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/50 px-2 py-2">
                      <p className="text-sm font-bold font-mono tabular-nums">{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: benefits */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("bomBenefits")}
              </p>
              {[
                {
                  title: t("recipes"),
                  desc: t("recipesDescription"),
                  icon: Layers,
                  color: "border-s-orange-400",
                },
                {
                  title: t("costRollup"),
                  desc: t("costRollupDescription"),
                  icon: Calculator,
                  color: "border-s-blue-400",
                },
                {
                  title: t("assemblyBenefit"),
                  desc: t("assemblyBenefitDescription"),
                  icon: ListChecks,
                  color: "border-s-emerald-400",
                },
                {
                  title: t("wastageTracking"),
                  desc: t("wastageTrackingDescription"),
                  icon: Package,
                  color: "border-s-violet-400",
                },
              ].map(({ title, desc, icon: Icon, color }) => (
                <div key={title} className={`rounded-lg border border-s-[3px] ${color} bg-card px-4 py-3`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ms-[22px]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {boms.map((bom) => {

              return (
                <div
                  key={bom.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 cursor-pointer hover:bg-muted/50 transition-colors flex-wrap"
                  onClick={() => router.push(`/inventory/bom/${bom.id}`)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium"><BidiText>{bom.name}</BidiText></h3>
                      {!bom.isActive && (
                        <Badge variant="outline" className="text-[10px]">{t("inactive")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <BidiText>{t("bomSummary", { item: bom.assemblyItem?.name || t("unknownItem"), count: bom.components.length, cost: expenseMoneyDisplay(BigInt(bom.costBreakdown.totalCostMinor), bom.currencyCode, unitPresentation) })}</BidiText>
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-7 p-0" aria-label={t("actions")} onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/inventory/bom/${bom.id}`); }}>
                        <ExternalLink className="size-4" /> {t("open")}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); handleDelete(bom); }}>
                        <Trash2 className="size-4" /> {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        {confirmDialog}
      </div>
    </ContentReveal>
  );
}
