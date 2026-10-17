"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { toast } from "sonner";
import { ProcurementSettingsForm, bpsToPercent, percentToBps, type ProcurementSettings } from "@/components/settings/procurement-settings-form";

const DEFAULT_SETTINGS: ProcurementSettings = {
  priceTolerancePercent: 0,
  qtyTolerancePercent: 0,
  requireGrnBeforeBill: false,
  blockOverBill: false,
};

export default function ProcurementSettingsPage() {
  const st = useTranslations("SettingsProcurement");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ProcurementSettings>(DEFAULT_SETTINGS);
  const [priceInput, setPriceInput] = useState("0");
  const [qtyInput, setQtyInput] = useState("0");

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    fetch("/api/v1/procurement-settings", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.procurementSettings) {
          const s = data.procurementSettings as ProcurementSettings;
          setSettings(s);
          setPriceInput(bpsToPercent(s.priceTolerancePercent));
          setQtyInput(bpsToPercent(s.qtyTolerancePercent));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/procurement-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          priceTolerancePercent: percentToBps(priceInput),
          qtyTolerancePercent: percentToBps(qtyInput),
          requireGrnBeforeBill: settings.requireGrnBeforeBill,
          blockOverBill: settings.blockOverBill,
        }),
      });

      if (!res.ok) throw new Error(st("failedToSave"));

      const data = await res.json();
      if (data.procurementSettings) {
        const s = data.procurementSettings as ProcurementSettings;
        setSettings(s);
        setPriceInput(bpsToPercent(s.priceTolerancePercent));
        setQtyInput(bpsToPercent(s.qtyTolerancePercent));
      }
      toast.success(st("billMatchingSettingsSaved"));
    } catch {
      toast.error(st("failedToSaveSettings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <BrandLoader />;

  return <ProcurementSettingsForm saving={saving} settings={settings} priceInput={priceInput} qtyInput={qtyInput}
    onSave={handleSave} onPriceChange={setPriceInput} onQtyChange={setQtyInput} onSettingsChange={setSettings} />;
}
