"use client";

import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { PackageCheck, ShieldAlert, Percent, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ContentReveal } from "@/components/ui/content-reveal";

export interface ProcurementSettings {
  priceTolerancePercent: number; // basis points (500 = 5%)
  qtyTolerancePercent: number; // basis points (500 = 5%)
  requireGrnBeforeBill: boolean;
  blockOverBill: boolean;
}

// Tolerances are stored in basis points (500 = 5%); display & edit as percent.
export function bpsToPercent(bps: number): string {
  return String(bps / 100);
}

export function percentToBps(percent: string): number {
  const n = Number(percent);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

interface Props {
  saving: boolean;
  settings: ProcurementSettings;
  priceInput: string;
  qtyInput: string;
  onSave: () => void;
  onPriceChange: (value: string) => void;
  onQtyChange: (value: string) => void;
  onSettingsChange: Dispatch<SetStateAction<ProcurementSettings>>;
}

export function ProcurementSettingsForm({ saving, settings, priceInput, qtyInput, onSave, onPriceChange, onQtyChange, onSettingsChange }: Props) {
  const st = useTranslations("SettingsProcurement");
  return (
    <ContentReveal>
      <div className="space-y-6 px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{st("billMatching")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {st("controlHowSupplierBillsAreCheckedAgainstOrdersAndGoodsReceived")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onSave} disabled={saving}>
              <Save className="size-3" />
              {saving ? st("saving") : st("saveChanges")}
            </Button>
          </div>
        </div>

        {/* Tolerances */}
        <div className="rounded-lg border divide-y">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg text-blue-500 bg-blue-500/10">
              <Percent className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{st("allowedPriceDifference")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {st("howMuchABillSPriceCanBeAboveTheOrderBefore")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={priceInput}
                onChange={(e) => onPriceChange(e.target.value)}
                className="h-8 w-20 text-sm text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg text-indigo-500 bg-indigo-500/10">
              <Percent className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{st("allowedQuantityDifference")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {st("howMuchABillSQuantityCanBeAboveWhatWasOrdered")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={qtyInput}
                onChange={(e) => onQtyChange(e.target.value)}
                className="h-8 w-20 text-sm text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="rounded-lg border divide-y">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg text-emerald-500 bg-emerald-500/10">
              <PackageCheck className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{st("requireGoodsToBeReceivedFirst")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {st("aSupplierBillCanTBeEnteredUntilTheGoodsHaveBeen")}
              </p>
            </div>
            <Switch
              checked={settings.requireGrnBeforeBill}
              onCheckedChange={(v) => onSettingsChange((s) => ({ ...s, requireGrnBeforeBill: v }))}
              className="scale-90 shrink-0"
            />
          </div>

          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg text-amber-500 bg-amber-500/10">
              <ShieldAlert className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{st("blockBillsThatChargeMoreThanOrdered")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {st("stopABillFromBeingSavedWhenItsTotalIsHigherThan")}
              </p>
            </div>
            <Switch
              checked={settings.blockOverBill}
              onCheckedChange={(v) => onSettingsChange((s) => ({ ...s, blockOverBill: v }))}
              className="scale-90 shrink-0"
            />
          </div>
        </div>
      </div>
    </ContentReveal>
  );
}
