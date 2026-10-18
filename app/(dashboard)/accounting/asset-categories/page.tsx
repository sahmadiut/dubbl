"use client";

import { useTranslations } from "next-intl";
import { ASSET_CATEGORY_METHODS, ASSET_CATEGORY_CONVENTIONS, assetCategoryMethodLabel, assetCategoryJson, assetCategoryFailureMessage } from "@/i18n/asset-category-presentation";

import { useState, useEffect, useCallback } from "react";
import { Plus, Layers, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { assetMoneyDisplay as formatMoney, assetCentsInput, assetCentsDecimal, assetLifeInput, assetRateInput } from "@/lib/money/asset-display";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";

// ── Types ──────────────────────────────────────────────────────────────────
interface AssetCategory {
  id: string;
  name: string;
  defaultDepreciationMethod: string;
  defaultConvention: string;
  defaultUsefulLifeMonths: number | null;
  defaultResidualValue: number; // cents
  defaultDepreciationRateBp: number | null;
  assetAccountId: string | null;
  depreciationAccountId: string | null;
  accumulatedDepAccountId: string | null;
  cwipAccountId: string | null;
  isActive: boolean;
}

// ── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  defaultDepreciationMethod: string;
  defaultConvention: string;
  usefulLifeMonths: string; // raw input
  residualValue: string; // raw input (major units)
  depreciationRatePct: string; // raw input (percent)
  assetAccountId: string;
  depreciationAccountId: string;
  accumulatedDepAccountId: string;
  cwipAccountId: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  defaultDepreciationMethod: "straight_line",
  defaultConvention: "full_month",
  usefulLifeMonths: "",
  residualValue: "",
  depreciationRatePct: "",
  assetAccountId: "",
  depreciationAccountId: "",
  accumulatedDepAccountId: "",
  cwipAccountId: "",
  isActive: true,
};

function categoryToForm(c: AssetCategory): FormState {
  return {
    name: c.name,
    defaultDepreciationMethod: c.defaultDepreciationMethod,
    defaultConvention: c.defaultConvention,
    usefulLifeMonths:
      c.defaultUsefulLifeMonths != null ? String(c.defaultUsefulLifeMonths) : "",
    residualValue: c.defaultResidualValue ? assetCentsDecimal(c.defaultResidualValue) : "",
    depreciationRatePct:
      c.defaultDepreciationRateBp != null
        ? String(c.defaultDepreciationRateBp / 100)
        : "",
    assetAccountId: c.assetAccountId || "",
    depreciationAccountId: c.depreciationAccountId || "",
    accumulatedDepAccountId: c.accumulatedDepAccountId || "",
    cwipAccountId: c.cwipAccountId || "",
    isActive: c.isActive,
  };
}

export default function AssetCategoriesPage() {
  const t = useTranslations("AssetCategories");
  const errors = useTranslations("AssetCategoryErrors");
  useDocumentTitle(t("documentTitle"));

  const orgId =
    typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!orgId) return;
    setRefetching(true);
    fetch(`/api/v1/asset-categories?limit=200`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => assetCategoryJson(r, errors, t("readFailed")))
      .then((data) => {
        if (!Array.isArray(data.data)) throw new Error(t("readFailed"));
        setCategories(data.data);
        setReadError(null);
      })
      .catch((error) => setReadError(assetCategoryFailureMessage(error, errors, t("readFailed"))))
      .finally(() => {
        setInitialLoad(false);
        setRefetching(false);
      });
  }, [orgId, t, errors]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((c: AssetCategory) => {
    setEditingId(c.id);
    setForm(categoryToForm(c));
    setError(null);
    setDialogOpen(true);
  }, []);

  const isDeclining = form.defaultDepreciationMethod === "declining_balance";

  const handleSave = useCallback(async () => {
    if (!orgId) return;
    if (!form.name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        defaultDepreciationMethod: form.defaultDepreciationMethod,
        defaultConvention: form.defaultConvention,
        defaultUsefulLifeMonths: form.usefulLifeMonths.trim() ? assetLifeInput(form.usefulLifeMonths.trim()) : null,
        defaultResidualValueMinor: assetCentsInput(form.residualValue.trim() || "0"),
        defaultDepreciationRateBp: form.depreciationRatePct.trim() ? assetRateInput(form.depreciationRatePct.trim()) : null,
        assetAccountId: form.assetAccountId || null,
        depreciationAccountId: form.depreciationAccountId || null,
        accumulatedDepAccountId: form.accumulatedDepAccountId || null,
        cwipAccountId: form.cwipAccountId || null,
        isActive: form.isActive,
      };
      const url = editingId ? `/api/v1/asset-categories/${editingId}` : `/api/v1/asset-categories`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify(payload),
      });
      const data = await assetCategoryJson(res, errors, t("saveFailed"));
      if (typeof data.category?.id !== "string" || !data.category.id) throw new Error(t("saveFailed"));
      setDialogOpen(false);
      load();
    } catch (error) {
      setError(assetCategoryFailureMessage(error, errors, t("saveFailed")));
    } finally {
      setSaving(false);
    }
  }, [orgId, form, editingId, load, t, errors]);

  const columns: Column<AssetCategory>[] = [
    {
      key: "name",
      header: t("name"),
      render: (r) => (
        <span className="text-sm font-medium">{r.name}</span>
      ),
    },
    {
      key: "method",
      header: t("method"),
      render: (r) => (
        <span className="text-sm">{assetCategoryMethodLabel(t, r.defaultDepreciationMethod)}</span>
      ),
    },
    {
      key: "life",
      header: t("lifespan"),
      className: "w-32",
      render: (r) => (
        <span className="text-sm">
          {r.defaultUsefulLifeMonths != null
            ? t("months", { count: r.defaultUsefulLifeMonths })
            : "—"}
        </span>
      ),
    },
    {
      key: "residual",
      header: t("residual"),
      className: "w-32 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          {r.defaultResidualValue ? formatMoney(r.defaultResidualValue) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      className: "w-24",
      render: (r) =>
        r.isActive ? (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            {t("active")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {t("inactive")}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16 text-right",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          aria-label={t("editAction", { name: r.name })}
          onClick={(e) => {
            e.stopPropagation();
            openEdit(r);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      ),
    },
  ];

  if (readError) return <p role="alert" className="text-sm text-destructive">{readError}</p>;

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg">
            {t("description")}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
        >
          <Plus className="mr-2 size-4" />
          {t("newAction")}
        </Button>
      </div>

      <div className="h-px bg-border" />

      {refetching ? (
        <BrandLoader className="h-48" />
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Layers className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              {t("emptyDescription")}
            </p>
          </div>
          <Button onClick={openCreate} variant="outline" size="sm">
            <Plus className="mr-2 size-4" />
            {t("newAction")}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          loading={false}
          emptyMessage={t("emptyTable")}
          onRowClick={(r) => openEdit(r)}
        />
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("editTitle") : t("newTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ac-name">{t("name")}</Label>
              <Input
                id="ac-name"
                placeholder={t("nameExample")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Method + convention */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("method")}</Label>
                <Select
                  value={form.defaultDepreciationMethod}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, defaultDepreciationMethod: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORY_METHODS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("convention")}</Label>
                <Select
                  value={form.defaultConvention}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, defaultConvention: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORY_CONVENTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Life + residual + rate */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ac-life">{t("lifeMonths")}</Label>
                <Input
                  id="ac-life"
                  type="number"
                  min={1}
                  placeholder={t("lifeExample")}
                  value={form.usefulLifeMonths}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("lifeHint")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-residual">{t("residual")}</Label>
                <Input
                  id="ac-residual"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.residualValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, residualValue: e.target.value }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("residualHint")}
                </p>
              </div>
            </div>

            {isDeclining && (
              <div className="space-y-1.5">
                <Label htmlFor="ac-rate">{t("rate")}</Label>
                <Input
                  id="ac-rate"
                  type="number"
                  min={0}
                  max={1000}
                  step="0.01"
                  placeholder={t("rateExample")}
                  value={form.depreciationRatePct}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depreciationRatePct: e.target.value }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("rateHint")}
                </p>
              </div>
            )}

            {/* Account pickers */}
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("books")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("assetAccount")}</Label>
                  <AccountPicker
                    value={form.assetAccountId}
                    onChange={(id) =>
                      setForm((f) => ({ ...f, assetAccountId: id }))
                    }
                    typeFilter={["asset"]}
                    placeholder={t("selectAccount")}
                    allowCreate
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("expenseAccount")}</Label>
                  <AccountPicker
                    value={form.depreciationAccountId}
                    onChange={(id) =>
                      setForm((f) => ({ ...f, depreciationAccountId: id }))
                    }
                    typeFilter={["expense"]}
                    placeholder={t("selectAccount")}
                    allowCreate
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("accumulatedAccount")}</Label>
                  <AccountPicker
                    value={form.accumulatedDepAccountId}
                    onChange={(id) =>
                      setForm((f) => ({ ...f, accumulatedDepAccountId: id }))
                    }
                    typeFilter={["asset"]}
                    placeholder={t("selectAccount")}
                    allowCreate
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("cwipAccount")}</Label>
                  <AccountPicker
                    value={form.cwipAccountId}
                    onChange={(id) =>
                      setForm((f) => ({ ...f, cwipAccountId: id }))
                    }
                    typeFilter={["asset"]}
                    placeholder={t("selectAccount")}
                    allowCreate
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("cwipHint")}
                  </p>
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="ac-active">{t("available")}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("availableHint")}
                </p>
              </div>
              <Switch
                id="ac-active"
                checked={form.isActive}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isActive: v }))
                }
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingId ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
