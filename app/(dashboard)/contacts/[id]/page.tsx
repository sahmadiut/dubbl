"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ContentReveal } from "@/components/ui/content-reveal";
import { displayJson, contactDetailUi, contactCreditInput, contactCreditDecimal } from "@/lib/money/contact-dashboard-ui";
import { currencyMetadata } from "@/lib/money/exact";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useContactContext, getOrgId } from "./layout";
import type { Account, TaxRate, ContactDetail } from "./layout";

export default function ContactDetailsPage() {
  const t = useTranslations("ContactDetails");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    contact,
    setContact,
    confirm,
    formType,
    setFormType,
    formTaxExempt,
    setFormTaxExempt,
    form1099Vendor,
    setForm1099Vendor,
    formCreditLimit,
    setFormCreditLimit,
    formCurrencyCode,
    setFormCurrencyCode,
    formRevenueAccountId,
    setFormRevenueAccountId,
    formExpenseAccountId,
    setFormExpenseAccountId,
    formTaxRateId,
    setFormTaxRateId,
    saving,
    setSaving,
  } = useContactContext();

  const [deleting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const fetchReferenceData = useCallback(() => {
    const orgId = getOrgId();
    if (!orgId) return;

    fetch("/api/v1/accounts", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Reference request failed");
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data.accounts) || !data.accounts.every((a: Partial<Account> | null) =>
          a && typeof a.id === "string" && typeof a.code === "string" && typeof a.name === "string" && typeof a.type === "string")) {
          throw new Error("Invalid accounts response");
        }
        setAccounts(data.accounts);
      })
      .catch(() => toast.error(t("referenceFailed")));

    fetch("/api/v1/tax-rates", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Reference request failed");
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data.taxRates) || !data.taxRates.every((rate: Partial<TaxRate> | null) =>
          rate && typeof rate.id === "string" && typeof rate.name === "string" && typeof rate.rate === "number" && Number.isFinite(rate.rate))) {
          throw new Error("Invalid tax rates response");
        }
        setTaxRates(data.taxRates);
      })
      .catch(() => toast.error(t("referenceFailed")));
  }, [t]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const orgId = getOrgId();
    if (!orgId) return;
    setSaving(true);

    const creditLimitValue = formCreditLimit;

    try {
      const res = await fetch(`/api/v1/contacts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email") || null,
          phone: form.get("phone") || null,
          taxNumber: form.get("taxNumber") || null,
          type: formType,
          paymentTermsDays:
            parseInt(form.get("paymentTermsDays") as string) || 30,
          ...contactCreditInput(creditLimitValue, formCurrencyCode),
          isTaxExempt: formTaxExempt,
          is1099Vendor: form1099Vendor,
          currencyCode: formCurrencyCode || null,
          defaultRevenueAccountId: formRevenueAccountId !== "none" ? formRevenueAccountId : null,
          defaultExpenseAccountId: formExpenseAccountId !== "none" ? formExpenseAccountId : null,
          defaultTaxRateId: formTaxRateId !== "none" ? formTaxRateId : null,
          notes: form.get("notes") || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");
      const c = await displayJson(res, body => contactDetailUi((body as { contact: ContactDetail }).contact));
      setContact(c);
      setFormType(c.type);
      setFormRevenueAccountId(c.defaultRevenueAccountId || "none");
      setFormExpenseAccountId(c.defaultExpenseAccountId || "none");
      setFormTaxRateId(c.defaultTaxRateId || "none");
      setFormTaxExempt(c.isTaxExempt);
      setForm1099Vendor(c.is1099Vendor ?? false);
      setFormCreditLimit(c.creditLimit != null ? contactCreditDecimal(c.creditLimit, c.currencyCode) : "");
      setFormCurrencyCode(c.currencyCode || "");
      toast.success(t("updated"));
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        const orgId = getOrgId();
        try {
          if (!orgId) throw new Error("Organization required");
          const res = await fetch(`/api/v1/contacts/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          if (!res.ok) throw new Error("Contact delete failed");
          toast.success(t("deleted"));
          router.push("/contacts");
        } catch {
          toast.error(t("deleteFailed"));
          throw new Error(t("deleteFailed"));
        }
      },
    });
  }

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  return (
    <ContentReveal key="details">
      <form onSubmit={handleSubmit} className="space-y-10">
        <Section title={t("general")} description={t("generalDescription")}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("name")}</Label>
              <Input name="name" required defaultValue={contact.name} placeholder={t("namePlaceholder")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("email")}</Label>
                <Input name="email" type="email" defaultValue={contact.email || ""} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("phone")}</Label>
                <Input name="phone" defaultValue={contact.phone || ""} placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("type")}</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">{t("customer")}</SelectItem>
                    <SelectItem value="supplier">{t("supplier")}</SelectItem>
                    <SelectItem value="both">{t("both")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("taxNumber")}</Label>
                <Input name="taxNumber" defaultValue={contact.taxNumber || ""} placeholder={t("taxPlaceholder")} />
              </div>
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("payment")} description={t("paymentDescription")}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("terms")}</Label>
                <Input
                  name="paymentTermsDays"
                  type="number"
                  min={0}
                  defaultValue={contact.paymentTermsDays}
                  placeholder={t("termsPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("currency")}</Label>
                <CurrencySelect
                  value={formCurrencyCode}
                  onValueChange={setFormCurrencyCode}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("creditLimit")}</Label>
                <CurrencyInput
                  prefix={formCurrencyCode || undefined}
                  fractionDigits={formCurrencyCode ? currencyMetadata(formCurrencyCode).minorUnits : 2}
                  value={formCreditLimit}
                  onChange={setFormCreditLimit}
                  placeholder={t("noLimit")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("taxStatus")}</Label>
                <div className="flex h-9 items-center space-x-2">
                  <Checkbox
                    id="isTaxExempt"
                    checked={formTaxExempt}
                    onCheckedChange={(checked) =>
                      setFormTaxExempt(checked === true)
                    }
                  />
                  <Label
                    htmlFor="isTaxExempt"
                    className="cursor-pointer text-sm font-normal"
                  >
                    {t("taxExempt")}
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("usTax")}</Label>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="is1099Vendor"
                  className="mt-0.5"
                  checked={form1099Vendor}
                  onCheckedChange={(checked) =>
                    setForm1099Vendor(checked === true)
                  }
                />
                <Label
                  htmlFor="is1099Vendor"
                  className="cursor-pointer text-sm font-normal leading-snug"
                >
                  {t("vendor1099")}
                  <span className="block text-[12px] font-normal text-muted-foreground">
                    {t("vendor1099Hint")}
                  </span>
                </Label>
              </div>
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("accounts")} description={t("accountsDescription")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("incomeAccount")}</Label>
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
              <Label className="text-xs">{t("expenseAccount")}</Label>
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

        <Section title={t("taxRate")} description={t("taxRateDescription")}>
          <div className="max-w-xs">
            <Select
              value={formTaxRateId}
              onValueChange={setFormTaxRateId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectTaxRate")} />
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

        <Section title={t("notes")} description={t("notesDescription")}>
          <Textarea
            name="notes"
            defaultValue={contact.notes || ""}
            rows={3}
            placeholder={t("notesPlaceholder")}
          />
        </Section>

        <div className="h-px bg-border" />

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={saving}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Danger zone */}
        <Section title={t("danger")} description={t("dangerDescription")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteContact")}</p>
              <p className="text-[12px] text-muted-foreground">
                {t("deleteHint")}
              </p>
            </div>
            <Button
              variant="destructive"
              type="button"
              size="sm"
              loading={deleting}
              onClick={handleDelete}
            >
              {t("delete")}
            </Button>
          </div>
        </Section>
      </form>
    </ContentReveal>
  );
}
