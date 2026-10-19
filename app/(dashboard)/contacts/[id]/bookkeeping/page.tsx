"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentReveal } from "@/components/ui/content-reveal";
import { displayJson, contactDetailUi, contactCreditInput } from "@/lib/money/contact-dashboard-ui";
import { useContactContext, getOrgId } from "../layout";
import type { Account, TaxRate, ContactDetail } from "../layout";

export default function ContactBookkeepingPage() {
  const t = useTranslations("ContactBookkeeping");
  const { id } = useParams<{ id: string }>();
  const {
    contact,
    setContact,
    formType,
    setFormType,
    formRevenueAccountId,
    setFormRevenueAccountId,
    formExpenseAccountId,
    setFormExpenseAccountId,
    formTaxRateId,
    setFormTaxRateId,
    formTaxExempt,
    formCreditLimit,
    formCurrencyCode,
    saving,
    setSaving,
  } = useContactContext();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const fetchReferenceData = useCallback(() => {
    const orgId = getOrgId();
    if (!orgId) return;

    fetch("/api/v1/accounts", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Reference request failed"); return r.json(); })
      .then((data) => {
        if (!Array.isArray(data.accounts) || !data.accounts.every((a: Account) => a && typeof a.id === "string" && typeof a.code === "string" && typeof a.name === "string" && typeof a.type === "string")) throw new Error("Invalid accounts");
        setAccounts(data.accounts);
      })
      .catch(() => { toast.error(t("referenceFailed")); });

    fetch("/api/v1/tax-rates", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => { if (!r.ok) throw new Error("Reference request failed"); return r.json(); })
      .then((data) => {
        if (!Array.isArray(data.taxRates) || !data.taxRates.every((r: TaxRate) => r && typeof r.id === "string" && typeof r.name === "string" && Number.isFinite(r.rate))) throw new Error("Invalid tax rates");
        setTaxRates(data.taxRates);
      })
      .catch(() => { toast.error(t("referenceFailed")); });
  }, [t]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const orgId = getOrgId();
    if (!orgId) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/contacts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          taxNumber: contact.taxNumber || null,
          type: formType,
          paymentTermsDays: contact.paymentTermsDays,
          ...contactCreditInput(formCreditLimit, formCurrencyCode),
          isTaxExempt: formTaxExempt,
          currencyCode: formCurrencyCode || null,
          defaultRevenueAccountId: formRevenueAccountId !== "none" ? formRevenueAccountId : null,
          defaultExpenseAccountId: formExpenseAccountId !== "none" ? formExpenseAccountId : null,
          defaultTaxRateId: formTaxRateId !== "none" ? formTaxRateId : null,
          notes: contact.notes || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");
      const c = await displayJson(res, body => contactDetailUi((body as { contact: ContactDetail }).contact));
      setContact(c);
      setFormType(c.type);
      setFormRevenueAccountId(c.defaultRevenueAccountId || "none");
      setFormExpenseAccountId(c.defaultExpenseAccountId || "none");
      setFormTaxRateId(c.defaultTaxRateId || "none");
      toast.success(t("updated"));
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ContentReveal key="bookkeeping">
      <form onSubmit={handleSubmit} className="space-y-10">
        <Section title={t("accounts")} description={t("accountsDescription")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("income")}</Label>
              <Select
                value={formRevenueAccountId}
                onValueChange={setFormRevenueAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("none")}</SelectItem>
                  {revenueAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("expense")}</Label>
              <Select
                value={formExpenseAccountId}
                onValueChange={setFormExpenseAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("none")}</SelectItem>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("tax")} description={t("taxDescription")}>
          <div className="max-w-xs">
            <Select
              value={formTaxRateId}
              onValueChange={setFormTaxRateId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectTax")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("none")}</SelectItem>
                {taxRates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({(t.rate / 100).toFixed(1)}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={saving}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {t("save")}
          </Button>
        </div>
      </form>
    </ContentReveal>
  );
}
