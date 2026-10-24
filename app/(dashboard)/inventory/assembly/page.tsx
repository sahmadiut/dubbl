"use client";

import { BidiText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";

import { assemblyOrdersJson, assemblyUpdatedJson, type AssemblyOrderView } from "@/i18n/inventory-assembly-presentation";
import { useState, useEffect } from "react";
import { Play, CheckCircle2, ClipboardList, ArrowRightLeft, BarChart3, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

const STATUS_BADGE: Record<string, string> = {
  draft: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function AssemblyOrdersPage() {
  const t = useTranslations("InventoryAssembly");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [orders, setOrders] = useState<AssemblyOrderView[]>([]);
  const [readError, setReadError] = useState(false);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(t("assemblyDocumentTitle"));

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) throw new Error("Organization required");
    return { "x-organization-id": orgId, "Content-Type": "application/json" };
  }

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const rows = await assemblyOrdersJson(await fetch("/api/v1/inventory/assembly-orders", { headers: getHeaders() }));
        if (!disposed) setOrders(rows);
      } catch { if (!disposed) setReadError(true); }
      finally { if (!disposed) setLoading(false); }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  async function handleComplete(order: AssemblyOrderView) {
    await confirm({
      title: t("completeTitle"),
      description: t("completeDescription", { quantity: order.quantity }),
      confirmLabel: t("complete"),
      cancelLabel: t("cancel"),
      onConfirm: async () => {
        try {
          const result = await assemblyUpdatedJson(await fetch(`/api/v1/inventory/assembly-orders/${order.id}/complete`, {
            method: "POST", headers: getHeaders(),
          }), order.id, "completed");
          setOrders(prev => prev.map(row => row.id === order.id ? { ...row, ...result } : row));
          toast.success(t("assemblyCompleted"));
        } catch { toast.error(t("completeFailed")); }
      },
    });
  }

  async function handleStart(orderId: string) {
    try {
      const result = await assemblyUpdatedJson(await fetch(`/api/v1/inventory/assembly-orders/${orderId}`, {
        method: "PATCH", headers: getHeaders(), body: JSON.stringify({ status: "in_progress" }),
      }), orderId, "in_progress");
      setOrders(prev => prev.map(row => row.id === orderId ? { ...row, ...result } : row));
      toast.success(t("assemblyStarted"));
    } catch { toast.error(t("startFailed")); }
  }

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("assemblyReadFailed")}</p>;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t("assemblyOrders")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("assemblyDescription")}
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-[1fr_1fr] items-start pt-4">
            {/* Left: mock assembly lifecycle */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="bg-muted/30 px-5 py-3 border-b">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("exampleWorkflow")}
                </p>
              </div>
              <div className="p-5 space-y-3">
                {/* Draft */}
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex size-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                        <ClipboardList className="size-3 text-zinc-500" />
                      </div>
                      <p className="text-sm font-medium">{t("deskOrder")}</p>
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE.draft + " text-[10px]"}>{t("draft")}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("exampleRecipe")}</p>
                </div>
                <div className="flex justify-center flex-wrap"><ArrowRight className="size-3.5 text-muted-foreground/30 rotate-90 rtl:rotate-180" /></div>
                {/* In progress */}
                <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex size-6 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                        <Play className="size-3 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium">{t("assembling")}</p>
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE.in_progress + " text-[10px]"}>{t("inProgress")}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("reserved")}</p>
                </div>
                <div className="flex justify-center flex-wrap"><ArrowRight className="size-3.5 text-muted-foreground/30 rotate-90 rtl:rotate-180" /></div>
                {/* Completed */}
                <div className="rounded-lg border border-dashed border-emerald-200 dark:border-emerald-900/40 p-3 opacity-60">
                  <div className="flex items-center justify-between mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex size-6 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                      </div>
                      <p className="text-sm font-medium">{t("complete")}</p>
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE.completed + " text-[10px]"}>{t("completed")}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("finishedStock")}</p>
                </div>
              </div>
            </div>

            {/* Right: benefits */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("howAssembly")}
              </p>
              {[
                {
                  title: t("createFromBoms"),
                  desc: t("createFromBomsDescription"),
                  icon: ClipboardList,
                  color: "border-s-blue-400",
                },
                {
                  title: t("trackProgress"),
                  desc: t("trackProgressDescription"),
                  icon: Play,
                  color: "border-s-amber-400",
                },
                {
                  title: t("autoInventory"),
                  desc: t("autoInventoryDescription"),
                  icon: ArrowRightLeft,
                  color: "border-s-emerald-400",
                },
                {
                  title: t("auditTrail"),
                  desc: t("auditTrailDescription"),
                  icon: BarChart3,
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
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border bg-card p-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium">
                      <BidiText>{t("orderName", { name: order.bom?.assemblyItem?.name || t("unknown"), quantity: order.quantity })}</BidiText>
                    </h3>
                    <Badge variant="outline" className={STATUS_BADGE[order.status]}>
                      {t(order.status === "in_progress" ? "inProgress" : order.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <BidiText>{t("recipeName", { name: order.bom?.name || t("unknown") })}</BidiText>
                    {order.completedAt && t("completedDate", { date: new Date(order.completedAt).toLocaleDateString() })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {order.status === "draft" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" onClick={() => handleStart(order.id)}>
                      <Play className="size-3" /> {t("start")}
                    </Button>
                  )}
                  {(order.status === "draft" || order.status === "in_progress") && (
                    <Button size="sm" className="h-7 text-xs gap-1 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" onClick={() => handleComplete(order)}>
                      <CheckCircle2 className="size-3" /> {t("complete")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {confirmDialog}
      </div>
    </ContentReveal>
  );
}
